import type { Request, Response } from "express";
import { pool } from "../config/database.js";

import {
  syncElectionStatus,
  syncAllElectionStatuses,
} from "../services/electionService.js";

type ElectionScope =
  | "SCHOOL"
  | "UNIVERSITY";

type ElectionStatus =
  | "UPCOMING"
  | "ACTIVE"
  | "CLOSED";

function isValidDate(
  value: unknown
): value is string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return false;
  }

  const date = new Date(value);

  return !Number.isNaN(
    date.getTime()
  );
}

function formatDateForMySQL(
  value: string
): string {
  return value
    .replace("T", " ")
    .replace("Z", "");
}

/**
 * Get elections that a student is eligible to participate in.
 *
 * GET /api/elections/eligible/:registrationNumber
 */
export async function getEligibleElections(
  req: Request,
  res: Response
) {
  try {
    const registrationNumber =
      String(
        req.params.registrationNumber || ""
      ).trim();

    if (!registrationNumber || !req.voter) {
      return res.status(400).json({
        success: false,
        message:
          "Registration number is required",
      });
    }

    if (registrationNumber !== req.voter.registrationNumber) {
      return res.status(403).json({
        success: false,
        message: "Election request does not match the signed-in voter",
      });
    }

    const [students] =
      await pool.query(
        `
        SELECT
          student_id,
          school_id
        FROM students
        WHERE registration_number = ?
        LIMIT 1
        `,
        [registrationNumber]
      );

    const studentRows =
      students as Array<{
        student_id: number;
        school_id: number;
      }>;

    if (studentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student =
      studentRows[0];

    /*
     * Synchronize election statuses
     * before returning eligible elections.
     */
    await syncAllElectionStatuses();

    const [elections] =
      await pool.query(
        `
        SELECT
          e.election_id,
          e.title,
          e.position,
          e.election_scope,
          e.school_id,
          s.school_name,
          e.start_time,
          e.end_time,
          e.status,
          EXISTS (
            SELECT 1
            FROM votes v
            INNER JOIN students sv
              ON sv.student_id = v.student_id
            WHERE sv.registration_number = ?
              AND v.election_id = e.election_id
          ) AS has_voted
        FROM elections e
        LEFT JOIN schools s
          ON e.school_id = s.school_id
        WHERE (
            e.status = 'ACTIVE'
            OR (
              e.status = 'CLOSED'
              AND e.end_time >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
            )
          )
          AND (
            e.election_scope = 'UNIVERSITY'
            OR (
              e.election_scope = 'SCHOOL'
              AND e.school_id = ?
            )
          )
        ORDER BY e.election_id
        `,
        [registrationNumber, student.school_id]
      );

    return res.json({
      success: true,
      student_id:
        student.student_id,
      school_id:
        student.school_id,
      elections,
    });

  } catch (error) {
    console.error(
      "Eligible elections error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve eligible elections",
    });
  }
}

/**
 * Create a new election.
 *
 * POST /api/elections
 *
 * ADMIN and SUPER_ADMIN
 */
export async function createElection(
  req: Request,
  res: Response
) {
  try {
    const title =
      String(
        req.body.title || ""
      ).trim();

    const position =
      String(
        req.body.position || ""
      ).trim();

    const electionScope =
      String(
        req.body.election_scope || ""
      )
        .trim()
        .toUpperCase() as ElectionScope;

    const schoolId =
      req.body.school_id === null ||
      req.body.school_id === undefined ||
      req.body.school_id === ""
        ? null
        : Number(
            req.body.school_id
          );

    const startTime =
      String(
        req.body.start_time || ""
      ).trim();

    const endTime =
      String(
        req.body.end_time || ""
      ).trim();

    if (!title || !position) {
      return res.status(400).json({
        success: false,
        message:
          "Title and position are required",
      });
    }
    const [positionRows] =
  await pool.query(
    `
    SELECT
      position_id,
      position_name
    FROM positions
    WHERE position_name = ?
    LIMIT 1
    `,
    [position]
  );

if (
  (positionRows as Array<unknown>).length === 0
) {
  return res.status(400).json({
    success: false,
    message: "Invalid position selected",
  });
}

    if (
      electionScope !== "SCHOOL" &&
      electionScope !== "UNIVERSITY"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Election scope must be SCHOOL or UNIVERSITY",
      });
    }

    if (
      !isValidDate(startTime) ||
      !isValidDate(endTime)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid start_time and end_time are required",
      });
    }

    const start =
      new Date(startTime);

    const end =
      new Date(endTime);

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message:
          "End time must be after start time",
      });
    }

    if (
      electionScope === "SCHOOL"
    ) {
      if (
        schoolId === null ||
        !Number.isInteger(
          schoolId
        ) ||
        schoolId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "school_id is required for SCHOOL elections",
        });
      }

      const [schoolRows] =
        await pool.query(
          `
          SELECT
            school_id
          FROM schools
          WHERE school_id = ?
          LIMIT 1
          `,
          [schoolId]
        );

      if (
        (schoolRows as Array<unknown>)
          .length === 0
      ) {
        return res.status(404).json({
          success: false,
          message: "School not found",
        });
      }
    }

    if (
      electionScope ===
        "UNIVERSITY" &&
      schoolId !== null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "school_id must be null for UNIVERSITY elections",
      });
    }

    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const [result] =
      await pool.query(
        `
        INSERT INTO elections
          (
            title,
            position,
            election_scope,
            school_id,
            start_time,
            end_time,
            status,
            created_by
          )
        VALUES
          (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            'UPCOMING',
            ?
          )
        `,
        [
          title,
          position,
          electionScope,
          schoolId,
          formatDateForMySQL(
            startTime
          ),
          formatDateForMySQL(
            endTime
          ),
          req.admin.adminId,
        ]
      );

    const insertResult =
      result as {
        insertId: number;
      };

    return res.status(201).json({
      success: true,
      message:
        "Election created successfully",
      election: {
        election_id:
          insertResult.insertId,
        title,
        position,
        election_scope:
          electionScope,
        school_id:
          schoolId,
        start_time:
          formatDateForMySQL(
            startTime
          ),
        end_time:
          formatDateForMySQL(
            endTime
          ),
        status: "UPCOMING",
        created_by:
          req.admin.adminId,
      },
    });

  } catch (error) {
    console.error(
      "Election creation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create election",
    });
  }
}

/**
 * List all elections.
 *
 * GET /api/elections
 *
 * ADMIN and SUPER_ADMIN
 */
export async function getAllElections(
  _req: Request,
  res: Response
) {
  try {
    /*
     * Synchronize every election
     * before returning the list.
     */
    await syncAllElectionStatuses();

    const [elections] =
      await pool.query(
        `
        SELECT
          e.election_id,
          e.title,
          e.position,
          e.election_scope,
          e.school_id,
          s.school_name,
          e.start_time,
          e.end_time,
          e.status,
          e.created_by,
          a.name AS created_by_name,
          e.created_at
        FROM elections e
        LEFT JOIN schools s
          ON e.school_id = s.school_id
        LEFT JOIN administrators a
          ON e.created_by = a.admin_id
        ORDER BY e.election_id DESC
        `
      );

    return res.json({
      success: true,
      elections,
    });

  } catch (error) {
    console.error(
      "Election listing error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve elections",
    });
  }
}

export async function getOpenElections(
  _req: Request,
  res: Response
) {
  try {
    await syncAllElectionStatuses();

    const [rows] = await pool.query(
      `
      SELECT
        e.election_id,
        e.title,
        e.position,
        e.election_scope,
        e.school_id,
        s.school_name,
        e.start_time,
        e.end_time,
        e.status
      FROM elections e
      LEFT JOIN schools s
        ON e.school_id = s.school_id
      WHERE e.status IN ('UPCOMING', 'ACTIVE')
      ORDER BY e.start_time ASC
      `
    );

    return res.json({
      success: true,
      elections: rows,
    });
  } catch (error) {
    console.error("Open election listing error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve open elections",
    });
  }
}

/**
 * Delete a closed election and its related votes/applications.
 *
 * DELETE /api/elections/:electionId
 */
export async function deleteElection(
  req: Request,
  res: Response
) {
  const electionId = Number(req.params.electionId);

  if (!Number.isInteger(electionId) || electionId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid election ID",
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
      SELECT status, end_time
      FROM elections
      WHERE election_id = ?
      FOR UPDATE
      `,
      [electionId]
    );

    const election = (rows as Array<{
      status: ElectionStatus;
      end_time: string;
    }>)[0];

    if (!election) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Election not found" });
    }

    if (election.status !== "CLOSED") {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Only closed elections can be deleted",
      });
    }

    await connection.query("DELETE FROM votes WHERE election_id = ?", [electionId]);
    await connection.query("DELETE FROM candidates WHERE election_id = ?", [electionId]);
    await connection.query("DELETE FROM elections WHERE election_id = ?", [electionId]);
    await connection.commit();

    return res.json({
      success: true,
      message: "Election and its archived results were deleted",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Election deletion error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete election",
    });
  } finally {
    connection.release();
  }
}

/**
 * Get one election.
 *
 * GET /api/elections/:electionId
 *
 * ADMIN and SUPER_ADMIN
 */
export async function getElectionById(
  req: Request,
  res: Response
) {
  try {
    const electionId =
      Number(
        req.params.electionId
      );

    if (
      !Number.isInteger(
        electionId
      ) ||
      electionId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid election ID",
      });
    }

    const status =
      await syncElectionStatus(
        electionId
      );

    if (status === null) {
      return res.status(404).json({
        success: false,
        message:
          "Election not found",
      });
    }

    const [rows] =
      await pool.query(
        `
        SELECT
          e.election_id,
          e.title,
          e.position,
          e.election_scope,
          e.school_id,
          s.school_name,
          e.start_time,
          e.end_time,
          e.status,
          e.created_by,
          a.name AS created_by_name,
          e.created_at
        FROM elections e
        LEFT JOIN schools s
          ON e.school_id = s.school_id
        LEFT JOIN administrators a
          ON e.created_by = a.admin_id
        WHERE e.election_id = ?
        LIMIT 1
        `,
        [electionId]
      );

    const elections =
      rows as Array<{
        election_id: number;
      }>;

    if (
      elections.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Election not found",
      });
    }

    return res.json({
      success: true,
      election:
        elections[0],
    });

  } catch (error) {
    console.error(
      "Election retrieval error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve election",
    });
  }
}

/**
 * Update an UPCOMING election.
 *
 * PATCH /api/elections/:electionId
 *
 * ADMIN and SUPER_ADMIN
 */
export async function updateElection(
  req: Request,
  res: Response
) {
  try {
    const electionId =
      Number(
        req.params.electionId
      );

    if (
      !Number.isInteger(
        electionId
      ) ||
      electionId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid election ID",
      });
    }

    /*
     * Synchronize status before deciding
     * whether this election can be edited.
     */
    const currentStatus =
      await syncElectionStatus(
        electionId
      );

    if (currentStatus === null) {
      return res.status(404).json({
        success: false,
        message:
          "Election not found",
      });
    }

    if (
      currentStatus !==
      "UPCOMING"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Only UPCOMING elections can be edited",
      });
    }

    const title =
      String(
        req.body.title || ""
      ).trim();

    const position =
      String(
        req.body.position || ""
      ).trim();

    const electionScope =
      String(
        req.body.election_scope ||
          ""
      )
        .trim()
        .toUpperCase() as ElectionScope;

    const schoolId =
      req.body.school_id === null ||
      req.body.school_id === undefined ||
      req.body.school_id === ""
        ? null
        : Number(
            req.body.school_id
          );

    const startTime =
      String(
        req.body.start_time || ""
      ).trim();

    const endTime =
      String(
        req.body.end_time || ""
      ).trim();

    if (!title || !position) {
      return res.status(400).json({
        success: false,
        message:
          "Title and position are required",
      });
    }

    if (
      electionScope !== "SCHOOL" &&
      electionScope !==
        "UNIVERSITY"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Election scope must be SCHOOL or UNIVERSITY",
      });
    }

    if (
      !isValidDate(startTime) ||
      !isValidDate(endTime)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid start_time and end_time are required",
      });
    }

    if (
      new Date(endTime) <=
      new Date(startTime)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "End time must be after start time",
      });
    }

    if (
      electionScope ===
      "SCHOOL"
    ) {
      if (
        schoolId === null ||
        !Number.isInteger(
          schoolId
        ) ||
        schoolId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "school_id is required for SCHOOL elections",
        });
      }

      const [schoolRows] =
        await pool.query(
          `
          SELECT
            school_id
          FROM schools
          WHERE school_id = ?
          LIMIT 1
          `,
          [schoolId]
        );

      if (
        (schoolRows as Array<unknown>)
          .length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "School not found",
        });
      }
    }

    if (
      electionScope ===
        "UNIVERSITY" &&
      schoolId !== null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "school_id must be null for UNIVERSITY elections",
      });
    }

    await pool.query(
      `
      UPDATE elections
      SET
        title = ?,
        position = ?,
        election_scope = ?,
        school_id = ?,
        start_time = ?,
        end_time = ?
      WHERE election_id = ?
      `,
      [
        title,
        position,
        electionScope,
        schoolId,
        formatDateForMySQL(
          startTime
        ),
        formatDateForMySQL(
          endTime
        ),
        electionId,
      ]
    );

    return res.json({
      success: true,
      message:
        "Election updated successfully",
      election_id:
        electionId,
    });

  } catch (error) {
    console.error(
      "Election update error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update election",
    });
  }
}

/**
 * Manually activate an UPCOMING election.
 *
 * PATCH /api/elections/:electionId/activate
 *
 * ADMIN and SUPER_ADMIN
 */
export async function activateElection(
  req: Request,
  res: Response
) {
  try {
    const electionId =
      Number(
        req.params.electionId
      );

    if (
      !Number.isInteger(
        electionId
      ) ||
      electionId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid election ID",
      });
    }

    const [rows] =
      await pool.query(
        `
        SELECT
          election_id,
          title,
          start_time,
          end_time,
          status
        FROM elections
        WHERE election_id = ?
        LIMIT 1
        `,
        [electionId]
      );

    const elections =
      rows as Array<{
        election_id: number;
        title: string;
        start_time: Date;
        end_time: Date;
        status: ElectionStatus;
      }>;

    if (
      elections.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Election not found",
      });
    }

    const election =
      elections[0];

    /*
     * Do not allow an election to be manually
     * activated after its configured end time.
     */
    const now = new Date();

    if (
      now >=
      new Date(
        election.end_time
      )
    ) {
      await syncElectionStatus(
        electionId
      );

      return res.status(409).json({
        success: false,
        message:
          "Election end time has already passed",
      });
    }

    if (now < new Date(election.start_time)) {
      return res.status(409).json({
        success: false,
        message: "Election cannot be activated before its configured start time",
      });
    }

    if (
      election.status !==
      "UPCOMING"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Only UPCOMING elections can be activated",
      });
    }

    await pool.query(
      `
      UPDATE elections
      SET status = 'ACTIVE'
      WHERE election_id = ?
        AND status = 'UPCOMING'
      `,
      [electionId]
    );

    return res.json({
      success: true,
      message:
        "Election activated successfully",
      election: {
        election_id:
          electionId,
        title:
          election.title,
        status:
          "ACTIVE",
      },
    });

  } catch (error) {
    console.error(
      "Election activation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to activate election",
    });
  }
}

/**
 * Manually close an ACTIVE election.
 *
 * PATCH /api/elections/:electionId/close
 *
 * ADMIN and SUPER_ADMIN
 */
export async function closeElection(
  req: Request,
  res: Response
) {
  try {
    const electionId =
      Number(
        req.params.electionId
      );

    if (
      !Number.isInteger(
        electionId
      ) ||
      electionId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid election ID",
      });
    }

    const status =
      await syncElectionStatus(
        electionId
      );

    if (status === null) {
      return res.status(404).json({
        success: false,
        message:
          "Election not found",
      });
    }

    if (
      status !== "ACTIVE"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Only ACTIVE elections can be closed",
      });
    }

    const [rows] =
      await pool.query(
        `
        SELECT
          election_id,
          title
        FROM elections
        WHERE election_id = ?
        LIMIT 1
        `,
        [electionId]
      );

    const elections =
      rows as Array<{
        election_id: number;
        title: string;
      }>;

    if (
      elections.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Election not found",
      });
    }

    await pool.query(
      `
      UPDATE elections
      SET status = 'CLOSED'
      WHERE election_id = ?
        AND status = 'ACTIVE'
      `,
      [electionId]
    );

    return res.json({
      success: true,
      message:
        "Election closed successfully",
      election: {
        election_id:
          electionId,
        title:
          elections[0].title,
        status:
          "CLOSED",
      },
    });

  } catch (error) {
    console.error(
      "Election closing error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to close election",
    });
  }
}

