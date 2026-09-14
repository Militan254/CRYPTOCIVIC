import { pool } from "../config/database.js";

export type ElectionStatus =
  | "UPCOMING"
  | "ACTIVE"
  | "CLOSED";

/**
 * Synchronize an election's database status with its
 * configured start/end time.
 *
 * Time rules:
 *
 * NOW < start_time
 *     → UPCOMING
 *
 * start_time <= NOW < end_time
 *     → ACTIVE
 *
 * NOW >= end_time
 *     → CLOSED
 */
export async function syncElectionStatus(
  electionId: number
): Promise<ElectionStatus | null> {
  const [rows] = await pool.query(
    `
    SELECT
      election_id,
      start_time,
      end_time,
      status
    FROM elections
    WHERE election_id = ?
    LIMIT 1
    `,
    [electionId]
  );

  const elections = rows as Array<{
    election_id: number;
    start_time: Date;
    end_time: Date;
    status: ElectionStatus;
  }>;

  if (elections.length === 0) {
    return null;
  }

  const election = elections[0];

  const now = new Date();
  const startTime = new Date(election.start_time);
  const endTime = new Date(election.end_time);

  let correctStatus: ElectionStatus;

  if (now < startTime) {
    correctStatus = "UPCOMING";
  } else if (now < endTime) {
    correctStatus = "ACTIVE";
  } else {
    correctStatus = "CLOSED";
  }

  if (election.status !== correctStatus) {
    await pool.query(
      `
      UPDATE elections
      SET status = ?
      WHERE election_id = ?
      `,
      [correctStatus, electionId]
    );
  }

  return correctStatus;
}

/**
 * Synchronize all elections with their configured
 * start/end times.
 *
 * This can be called before returning election lists.
 */
export async function syncAllElectionStatuses(): Promise<void> {
  const [rows] = await pool.query(
    `
    SELECT
      election_id
    FROM elections
    `
  );

  const elections = rows as Array<{
    election_id: number;
  }>;

  for (const election of elections) {
    await syncElectionStatus(
      election.election_id
    );
  }
}

/**
 * Check whether an election is currently ACTIVE.
 *
 * The status is synchronized against the clock first.
 */
export async function isElectionActive(
  electionId: number
): Promise<boolean> {
  const status =
    await syncElectionStatus(electionId);

  return status === "ACTIVE";
}

