import type { Request, Response } from "express";
import { pool } from "../config/database.js";
import {
  registerVoterOnBlockchain,
  castVoteOnBlockchain,
  getCandidateVotesOnBlockchain,
} from "../services/blockchain.js";
export async function registerVoter(
  req: Request,
  res: Response
) {
  try {
    const registrationNumber =
      String(req.body.registration_number || "").trim();

    if (!registrationNumber) {
      return res.status(400).json({
        success: false,
        message: "Registration number is required",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT
        s.student_id,
        s.registration_number,
        s.name,
        s.school_id,
        sc.school_code,
        sc.school_name
      FROM students s
      INNER JOIN schools sc
        ON s.school_id = sc.school_id
      WHERE s.registration_number = ?
      LIMIT 1
      `,
      [registrationNumber]
    );

    const students = rows as Array<{
      student_id: number;
      registration_number: string;
      name: string;
      school_id: number;
      school_code: string;
      school_name: string;
    }>;

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student = students[0];

    const voterHash =
      await registerVoterOnBlockchain(
        student.registration_number,
        student.school_id
      );

    return res.json({
      success: true,
      message: "Student registered on blockchain",
      student: {
        student_id: student.student_id,
        registration_number:
          student.registration_number,
        name: student.name,
        school_id: student.school_id,
        school_code: student.school_code,
        school_name: student.school_name,
      },
      voterHash,
    });

  } catch (error) {
    console.error(
      "Blockchain voter registration error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to register student on blockchain",
    });
  }
}
export async function castVote(
  req: Request,
  res: Response
) {
  try {
    const registrationNumber =
      String(req.body.registration_number || "").trim();

    const electionId =
      Number(req.body.election_id);

    const candidateId =
      Number(req.body.candidate_id);

    if (!registrationNumber) {
      return res.status(400).json({
        success: false,
        message: "Registration number is required",
      });
    }

    if (!Number.isInteger(electionId) || electionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid election ID is required",
      });
    }

    if (!Number.isInteger(candidateId) || candidateId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid candidate ID is required",
      });
    }

    // Find the student
    const [studentRows] = await pool.query(
      `
      SELECT
        s.student_id,
        s.registration_number,
        s.name,
        s.school_id
      FROM students s
      WHERE s.registration_number = ?
      LIMIT 1
      `,
      [registrationNumber]
    );

    const students = studentRows as Array<{
      student_id: number;
      registration_number: string;
      name: string;
      school_id: number;
    }>;

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student = students[0];

    // Check that the election exists and is active
    const [electionRows] = await pool.query(
      `
      SELECT
        election_id,
        title,
        position,
        election_scope,
        school_id,
        status
      FROM elections
      WHERE election_id = ?
      LIMIT 1
      `,
      [electionId]
    );

    const elections = electionRows as Array<{
      election_id: number;
      title: string;
      position: string;
      election_scope: "SCHOOL" | "UNIVERSITY";
      school_id: number | null;
      status: "UPCOMING" | "ACTIVE" | "CLOSED";
    }>;

    if (elections.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Election not found",
      });
    }

    const election = elections[0];

    if (election.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Election is not active",
      });
    }

    // School-election eligibility check
    if (
      election.election_scope === "SCHOOL" &&
      election.school_id !== student.school_id
    ) {
      return res.status(403).json({
        success: false,
        message: "Student is not eligible for this school election",
      });
    }

    // Check that the candidate belongs to this election
    const [candidateRows] = await pool.query(
      `
      SELECT
        c.candidate_id,
        c.student_id,
        c.election_id,
        c.manifesto,
        c.photo,
        c.approval_status,
        s.registration_number,
        s.name
      FROM candidates c
      INNER JOIN students s
        ON c.student_id = s.student_id
      WHERE c.candidate_id = ?
        AND c.election_id = ?
      LIMIT 1
      `,
      [candidateId, electionId]
    );

    const candidates = candidateRows as Array<{
      candidate_id: number;
      student_id: number;
      election_id: number;
      manifesto: string | null;
      photo: string | null;
      approval_status: "PENDING" | "APPROVED" | "REJECTED";
      registration_number: string;
      name: string;
    }>;

    if (candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found in this election",
      });
    }

    const candidate = candidates[0];

    if (candidate.approval_status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Candidate is not approved",
      });
    }

    // Send the vote to the blockchain
    const blockchainResult =
      await castVoteOnBlockchain(
        electionId,
        candidateId,
        student.registration_number
      );

    return res.json({
      success: true,
      message: "Vote cast successfully",
      election: {
        election_id: election.election_id,
        title: election.title,
        position: election.position,
      },
      candidate: {
        candidate_id: candidate.candidate_id,
        name: candidate.name,
        registration_number:
          candidate.registration_number,
      },
      transactionHash:
        blockchainResult.transactionHash,
      voterHash:
        blockchainResult.voterHash,
    });

  } catch (error) {
    console.error(
      "Blockchain vote error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to cast vote on blockchain",
    });
  }
}
export async function getCandidateVotes(
  req: Request,
  res: Response
) {
  try {
    const candidateId = Number(
      req.params.candidateId
    );

    if (
      !Number.isInteger(candidateId) ||
      candidateId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid candidate ID",
      });
    }

    const votes =
      await getCandidateVotesOnBlockchain(candidateId);

    return res.json({
      success: true,
      candidate_id: candidateId,
      vote_count: Number(votes),
    });

  } catch (error) {
    console.error(
      "Blockchain results error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve candidate votes",
    });
  }
}
