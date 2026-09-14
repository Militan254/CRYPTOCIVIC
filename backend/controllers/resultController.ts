import type { Request, Response } from "express";

import { pool } from "../config/database.js";
import { syncElectionStatus } from "../services/electionService.js";

export async function getElectionResults(
  req: Request,
  res: Response
) {
  try {
    const electionId =
      Number(req.params.electionId);

    if (
      !Number.isInteger(electionId) ||
      electionId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid election ID",
      });
    }

    /*
     * Keep the election status synchronized
     * with its start and end times.
     */
    const status =
      await syncElectionStatus(
        electionId
      );

    if (status === null) {
      return res.status(404).json({
        success: false,
        message: "Election not found",
      });
    }

    /*
     * Retrieve election information.
     */
    const [electionRows] =
      await pool.query(
        `
        SELECT
          e.election_id,
          e.title,
          e.position,
          e.election_scope,
          e.start_time,
          e.end_time,
          e.status
        FROM elections e
        WHERE e.election_id = ?
        LIMIT 1
        `,
        [electionId]
      );

    const elections =
      electionRows as Array<{
        election_id: number;
        title: string;
        position: string;
        election_scope:
          | "SCHOOL"
          | "UNIVERSITY";
        start_time: Date;
        end_time: Date;
        status:
          | "UPCOMING"
          | "ACTIVE"
          | "CLOSED";
      }>;

    if (elections.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Election not found",
      });
    }

    const election =
      elections[0];

    /*
     * Retrieve vote counts.
     *
     * LEFT JOIN ensures candidates with
     * zero votes are still returned.
     */
    const [resultRows] =
      await pool.query(
        `
        SELECT
          c.candidate_id,
          s.name,
          c.manifesto,
          c.photo,
          COUNT(v.vote_id) AS votes
        FROM candidates c
        INNER JOIN students s
          ON c.student_id = s.student_id
        LEFT JOIN votes v
          ON v.candidate_id = c.candidate_id
          AND v.election_id = c.election_id
        WHERE c.election_id = ?
          AND c.approval_status = 'APPROVED'
        GROUP BY
          c.candidate_id,
          s.name,
          c.manifesto,
          c.photo
        ORDER BY
          votes DESC,
          c.candidate_id ASC
        `,
        [electionId]
      );

    /*
     * Get total votes.
     */
    const [totalRows] =
      await pool.query(
        `
        SELECT
          COUNT(*) AS total_votes
        FROM votes
        WHERE election_id = ?
        `,
        [electionId]
      );

    const totalResult =
      totalRows as Array<{
        total_votes:
          | number
          | string;
      }>;

    const totalVotes =
      Number(
        totalResult[0]
          ?.total_votes || 0
      );

    /*
     * Convert database results into
     * frontend-friendly results with
     * percentages.
     */
    const results =
      (
        resultRows as Array<{
          candidate_id: number;
          name: string;
          manifesto: string | null;
          photo: string | null;
          votes:
            | number
            | string;
        }>
      ).map((candidate) => {
        const votes =
          Number(
            candidate.votes
          );

        const percentage =
          totalVotes > 0
            ? Number(
                (
                  (votes /
                    totalVotes) *
                  100
                ).toFixed(2)
              )
            : 0;

        return {
          candidate_id:
            candidate.candidate_id,

          name:
            candidate.name,

          manifesto:
            candidate.manifesto,

          photo:
            candidate.photo,

          votes,

          percentage,
        };
      });

    /*
     * Return live election results.
     */
    return res.json({
      success: true,

      election: {
        election_id:
          election.election_id,

        title:
          election.title,

        position:
          election.position,

        election_scope:
          election.election_scope,

        start_time:
          election.start_time,

        end_time:
          election.end_time,

        status:
          election.status,
      },

      results,

      total_votes:
        totalVotes,

      updated_at:
        new Date().toISOString(),
    });

  } catch (error) {
    console.error(
      "Election results error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve election results",
    });
  }
}

