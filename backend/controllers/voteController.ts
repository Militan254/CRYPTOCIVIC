import type { Request, Response } from "express";
import { pool } from "../config/database.js";
import { syncElectionStatus } from "../services/electionService.js";

/**
 * Cast a vote for an election.
 *
 * POST /api/votes
 *
 * Body:
 * {
 *   "registration_number": "A131G1000224",
 *   "election_id": 2,
 *   "candidate_id": 5
 * }
 */
export async function castVote(
  req: Request,
  res: Response
) {
  const connection =
    await pool.getConnection();

  try {
    const registrationNumber = req.voter?.registrationNumber || "";
    const studentIdFromToken = req.voter?.studentId;

    const electionId =
      Number(
        req.body.election_id
      );

    const candidateId =
      Number(
        req.body.candidate_id
      );

    if (
      !registrationNumber ||
      !studentIdFromToken ||
      !Number.isInteger(
        electionId
      ) ||
      electionId <= 0 ||
      !Number.isInteger(
        candidateId
      ) ||
      candidateId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Registration number, election ID and candidate ID are required",
      });
    }

    /*
     * Make sure the election status reflects
     * its configured start/end times.
     */
    const electionStatus =
      await syncElectionStatus(
        electionId
      );

    if (electionStatus === null) {
      return res.status(404).json({
        success: false,
        message:
          "Election not found",
      });
    }

    if (
      electionStatus !==
      "ACTIVE"
    ) {
      return res.status(403).json({
        success: false,
        message:
          electionStatus ===
          "UPCOMING"
            ? "Election has not started"
            : "Election has ended",
      });
    }

    await connection.beginTransaction();

    /*
     * Find the student.
     */
    const [studentRows] =
      await connection.query(
        `
        SELECT
          student_id,
          registration_number,
          school_id
        FROM students
        WHERE student_id = ?
        LIMIT 1
        `,
        [studentIdFromToken]
      );

    const students =
      studentRows as Array<{
        student_id: number;
        registration_number: string;
        school_id: number;
      }>;

    if (students.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          "Student not found",
      });
    }

    const student =
      students[0];

    /*
     * Verify the election is eligible
     * for this student's school.
     */
    const [electionRows] =
      await connection.query(
        `
        SELECT
          election_id,
          election_scope,
          school_id,
          status
        FROM elections
        WHERE election_id = ?
        LIMIT 1
        `,
        [electionId]
      );

    const elections =
      electionRows as Array<{
        election_id: number;
        election_scope:
          | "SCHOOL"
          | "UNIVERSITY";
        school_id:
          | number
          | null;
        status:
          | "UPCOMING"
          | "ACTIVE"
          | "CLOSED";
      }>;

    if (elections.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          "Election not found",
      });
    }

    const election =
      elections[0];

    if (
      election.status !==
      "ACTIVE"
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message:
          "Election is not active",
      });
    }

    if (
      election.election_scope ===
        "SCHOOL" &&
      election.school_id !==
        student.school_id
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message:
          "Student is not eligible for this school election",
      });
    }

    /*
     * Verify the candidate belongs to
     * this election and has been approved.
     */
    const [candidateRows] =
      await connection.query(
        `
        SELECT
          candidate_id,
          student_id,
          election_id,
          approval_status
        FROM candidates
        WHERE candidate_id = ?
          AND election_id = ?
          AND approval_status = 'APPROVED'
        LIMIT 1
        `,
        [
          candidateId,
          electionId,
        ]
      );

    const candidates =
      candidateRows as Array<{
        candidate_id: number;
        student_id: number;
        election_id: number;
        approval_status: string;
      }>;

    if (
      candidates.length === 0
    ) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          "Approved candidate not found for this election",
      });
    }

    /*
     * Check whether this student has
     * already voted in this election.
     */
    const [existingVoteRows] =
      await connection.query(
        `
        SELECT
          vote_id
        FROM votes
        WHERE student_id = ?
          AND election_id = ?
        LIMIT 1
        `,
        [
          student.student_id,
          electionId,
        ]
      );

    if (
      (existingVoteRows as Array<unknown>)
        .length > 0
    ) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message:
          "Student has already voted in this election",
      });
    }

    /*
     * Record the vote.
     *
     * The unique constraint on
     * (student_id, election_id)
     * provides an additional database-level
     * protection against duplicate votes.
     */
    await connection.query(
      `
      INSERT INTO votes
        (
          election_id,
          candidate_id,
          student_id
        )
      VALUES
        (?, ?, ?)
      `,
      [
        electionId,
        candidateId,
        student.student_id,
      ]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message:
        "Vote cast successfully",
      vote: {
        election_id:
          electionId,
        candidate_id:
          candidateId,
      },
    });

  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback errors.
    }

    /*
     * MariaDB duplicate-key error.
     *
     * This can happen if two requests attempt
     * to vote for the same student/election
     * at nearly the same time.
     */
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown })
        .code === "ER_DUP_ENTRY"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Student has already voted in this election",
      });
    }

    console.error(
      "Vote casting error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to cast vote",
    });

  } finally {
    connection.release();
  }
}

