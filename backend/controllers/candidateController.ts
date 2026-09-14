import type { Request, Response } from "express";
import { pool } from "../config/database.js";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Uploaded candidate files.
 */
type CandidateUploadedFiles = {
  photo?: Express.Multer.File[];
  video?: Express.Multer.File[];
  fee_statement?: Express.Multer.File[];
  result_slip?: Express.Multer.File[];
};

/**
 * Get approved candidates for an active election.
 *
 * GET /api/candidates/:electionId
 */
export async function getElectionCandidates(
  req: Request,
  res: Response
) {
  try {
    const electionId = Number(
      req.params.electionId
    );

    if (
      !Number.isInteger(electionId) ||
      electionId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid election ID",
      });
    }

    const [electionRows] =
      await pool.query(
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
          AND status = 'ACTIVE'
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
        school_id: number | null;
        status: string;
      }>;

    if (elections.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Active election not found",
      });
    }

    const election = elections[0];

    const [candidateRows] =
      await pool.query(
        `
        SELECT
          c.candidate_id,
          c.student_id,
          c.election_id,

          s.registration_number,
          s.name,
          s.email,

          sc.school_id,
          sc.school_code,
          sc.school_name,

          c.phone,
          c.course,
          c.year_of_study,

          c.manifesto,
          c.motivation,
          c.leadership_experience,
          c.vision,
          c.priorities,

          c.photo,
          c.video,
          c.fee_statement,
          c.result_slip,

          c.approval_status,
          c.created_at

        FROM candidates c

        INNER JOIN students s
          ON c.student_id = s.student_id

        LEFT JOIN schools sc
          ON s.school_id = sc.school_id

        WHERE c.election_id = ?
          AND c.approval_status = 'APPROVED'

        ORDER BY c.candidate_id
        `,
        [electionId]
      );

    return res.json({
      success: true,
      election,
      candidates: candidateRows,
    });

  } catch (error) {
    console.error(
      "Candidate retrieval error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve candidates",
    });
  }
}

export async function getCandidateFile(
  req: Request,
  res: Response
) {
  const candidateId = Number(req.params.candidateId);
  const fileType = Array.isArray(req.params.fileType)
    ? req.params.fileType[0]
    : req.params.fileType;
  const fileColumns: Record<string, string> = {
    photo: "photo",
    video: "video",
    fee_statement: "fee_statement",
    result_slip: "result_slip",
  };
  const column = fileColumns[fileType];

  if (!Number.isInteger(candidateId) || candidateId <= 0 || !column) {
    return res.status(400).json({
      success: false,
      message: "Invalid candidate file request",
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT \`${column}\` AS file_path FROM candidates WHERE candidate_id = ? LIMIT 1`,
      [candidateId]
    );
    const filePath = (rows as Array<{ file_path: string | null }>)[0]?.file_path;

    if (!filePath || !filePath.startsWith("/uploads/candidates/")) {
      return res.status(404).json({ success: false, message: "Candidate file not found" });
    }

    const uploadRoot = path.resolve(process.cwd(), "backend", "uploads");
    const absolutePath = path.resolve(process.cwd(), "backend", filePath.slice(1));

    if (!absolutePath.startsWith(`${uploadRoot}${path.sep}`)) {
      return res.status(400).json({ success: false, message: "Invalid candidate file path" });
    }

    const disposition = fileType === "photo" || fileType === "video" ? "inline" : "attachment";
    res.setHeader("Content-Disposition", `${disposition}; filename="candidate-${candidateId}-${fileType}"`);
    return res.sendFile(absolutePath);
  } catch (error) {
    console.error("Candidate file retrieval error:", error);
    return res.status(404).json({ success: false, message: "Candidate file not found" });
  }
}

/**
 * Register a student as a candidate.
 *
 * POST /api/candidates/register
 *
 * Content-Type:
 * multipart/form-data
 *
 * Text fields:
 * - registration_number
 * - election_id
 * - phone
 * - course
 * - year_of_study
 * - motivation
 * - leadership_experience
 * - vision
 * - priorities
 * - manifesto
 *
 * Files:
 * - photo
 * - video
 * - fee_statement
 * - result_slip
 */
export async function registerCandidate(
  req: Request,
  res: Response
) {
  const uploadedFiles = req.files as CandidateUploadedFiles | undefined;
  const uploadedPaths = Object.values(uploadedFiles || {})
    .flatMap((files) => files || [])
    .map((file) => file.path);

  async function removeUploadedFiles() {
    await Promise.all(
      uploadedPaths.map(async (filePath) => {
        try {
          await fs.unlink(filePath);
        } catch {
          // The file may not have been written if multer rejected the upload.
        }
      })
    );
  }

  try {
    const registrationNumber = req.voter?.registrationNumber || "";
    const authenticatedStudentId = req.voter?.studentId;

    const electionId = Number(
      req.body.election_id
    );

    const phone =
      String(
        req.body.phone || ""
      ).trim();

    const course =
      String(
        req.body.course || ""
      ).trim();

    const yearOfStudy =
      String(
        req.body.year_of_study || ""
      ).trim();

    const motivation =
      String(
        req.body.motivation || ""
      ).trim();

    const leadershipExperience =
      String(
        req.body.leadership_experience || ""
      ).trim();

    const vision =
      String(
        req.body.vision || ""
      ).trim();

    const priorities =
      String(
        req.body.priorities || ""
      ).trim();

    const manifesto =
      String(
        req.body.manifesto || ""
      ).trim();

    /*
     * Basic validation.
     */
    if (!registrationNumber || !authenticatedStudentId) {
      return res.status(400).json({
        success: false,
        message:
          "Registration number is required",
      });
    }

    if (
      !Number.isInteger(electionId) ||
      electionId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid election ID is required",
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        message:
          "Phone number is required",
      });
    }

    if (!course) {
      return res.status(400).json({
        success: false,
        message:
          "Course is required",
      });
    }

    if (!yearOfStudy) {
      return res.status(400).json({
        success: false,
        message:
          "Year of study is required",
      });
    }

    if (!motivation) {
      return res.status(400).json({
        success: false,
        message:
          "Motivation is required",
      });
    }

    if (!leadershipExperience) {
      return res.status(400).json({
        success: false,
        message:
          "Leadership experience is required",
      });
    }

    if (!vision) {
      return res.status(400).json({
        success: false,
        message:
          "Vision is required",
      });
    }

    if (!priorities) {
      return res.status(400).json({
        success: false,
        message:
          "Priorities are required",
      });
    }

    if (!manifesto) {
      return res.status(400).json({
        success: false,
        message:
          "Manifesto is required",
      });
    }

    /*
     * Retrieve uploaded files from multer.
     */
    const photo =
      uploadedFiles?.photo?.[0];

    const video =
      uploadedFiles?.video?.[0];

    const feeStatement =
      uploadedFiles?.fee_statement?.[0];

    const resultSlip =
      uploadedFiles?.result_slip?.[0];

    /*
     * All four documents/files are mandatory.
     */
    if (!photo) {
      await removeUploadedFiles();
      return res.status(400).json({
        success: false,
        message:
          "Candidate photograph is required",
      });
    }

    if (!video) {
      await removeUploadedFiles();
      return res.status(400).json({
        success: false,
        message:
          "Candidate motivation video is required",
      });
    }

    if (!feeStatement) {
      await removeUploadedFiles();
      return res.status(400).json({
        success: false,
        message:
          "Fee statement is required",
      });
    }

    if (!resultSlip) {
      await removeUploadedFiles();
      return res.status(400).json({
        success: false,
        message:
          "Previous semester result slip is required",
      });
    }

    /*
     * Find the student.
     */
    const [studentRows] =
      await pool.query(
        `
        SELECT
          student_id,
          registration_number,
          name,
          email,
          school_id
        FROM students
        WHERE student_id = ?
        LIMIT 1
        `,
        [authenticatedStudentId]
      );

    const students =
      studentRows as Array<{
        student_id: number;
        registration_number: string;
        name: string;
        email: string;
        school_id: number;
      }>;

    if (students.length === 0) {
      await removeUploadedFiles();
      return res.status(404).json({
        success: false,
        message:
          "Student not found",
      });
    }

    const student = students[0];

    /*
     * Find the election.
     */
    const [electionRows] =
      await pool.query(
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

    const elections =
      electionRows as Array<{
        election_id: number;
        title: string;
        position: string;
        election_scope:
          | "SCHOOL"
          | "UNIVERSITY";
        school_id: number | null;
        status:
          | "UPCOMING"
          | "ACTIVE"
          | "CLOSED";
      }>;

    if (elections.length === 0) {
      await removeUploadedFiles();
      return res.status(404).json({
        success: false,
        message:
          "Election not found",
      });
    }

    const election = elections[0];

    /* Candidate applications close when voting begins. */
    if (election.status !== "UPCOMING") {
      await removeUploadedFiles();
      return res.status(400).json({
        success: false,
        message: "Candidate applications are closed once voting begins",
      });
    }

    /*
     * School election eligibility.
     */
    if (
      election.election_scope ===
        "SCHOOL" &&
      election.school_id !==
        student.school_id
    ) {
      await removeUploadedFiles();
      return res.status(403).json({
        success: false,
        message:
          "Student is not eligible to contest this school election",
      });
    }

    /*
     * Prevent duplicate applications.
     */
    const [existingRows] =
      await pool.query(
        `
        SELECT
          candidate_id,
          approval_status
        FROM candidates
        WHERE student_id = ?
          AND election_id = ?
        LIMIT 1
        `,
        [
          student.student_id,
          electionId,
        ]
      );

    const existing =
      existingRows as Array<{
        candidate_id: number;
        approval_status:
          | "PENDING"
          | "APPROVED"
          | "REJECTED";
      }>;

    if (existing.length > 0) {
      await removeUploadedFiles();
      return res.status(409).json({
        success: false,
        message:
          "Student has already registered as a candidate for this election",
        candidate: existing[0],
      });
    }

    /*
     * Store relative URLs to uploaded files.
     */
    const photoPath =
      `/uploads/candidates/photos/${photo.filename}`;

    const videoPath =
      `/uploads/candidates/videos/${video.filename}`;

    const feeStatementPath =
      `/uploads/candidates/fee-statements/${feeStatement.filename}`;

    const resultSlipPath =
      `/uploads/candidates/result-slips/${resultSlip.filename}`;

    /*
     * Insert the complete application.
     */
    const [result] =
      await pool.query(
        `
        INSERT INTO candidates
        (
          student_id,
          election_id,
          phone,
          course,
          year_of_study,
          manifesto,
          motivation,
          leadership_experience,
          vision,
          priorities,
          photo,
          fee_statement,
          result_slip,
          video,
          approval_status
        )
        VALUES
        (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          'PENDING'
        )
        `,
        [
          student.student_id,
          electionId,
          phone,
          course,
          yearOfStudy,
          manifesto,
          motivation,
          leadershipExperience,
          vision,
          priorities,
          photoPath,
          feeStatementPath,
          resultSlipPath,
          videoPath,
        ]
      );

    const insertResult =
      result as {
        insertId: number;
      };

    return res.status(201).json({
      success: true,
      message:
        "Candidate application submitted successfully for review",

      candidate: {
        candidate_id:
          insertResult.insertId,

        student_id:
          student.student_id,

        registration_number:
          student.registration_number,

        name:
          student.name,

        email:
          student.email,

        school_id:
          student.school_id,

        election_id:
          electionId,

        election_title:
          election.title,

        position:
          election.position,

        election_scope:
          election.election_scope,

        phone,
        course,
        year_of_study:

          yearOfStudy,

        motivation,
        leadership_experience:
          leadershipExperience,

        vision,
        priorities,
        manifesto,

        photo:
          photoPath,

        video:
          videoPath,

        fee_statement:
          feeStatementPath,

        result_slip:
          resultSlipPath,

        approval_status:
          "PENDING",
      },
    });

  } catch (error) {
    await removeUploadedFiles();
    console.error(
      "Candidate registration error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to register candidate application",
    });
  }
}

export async function getMyCandidateApplications(
  req: Request,
  res: Response
) {
  const studentId = req.voter?.studentId;

  if (!studentId) {
    return res.status(401).json({
      success: false,
      message: "Voter authentication required",
    });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        c.candidate_id,
        c.election_id,
        e.title AS election_title,
        e.position,
        e.election_scope,
        e.school_id,
        c.approval_status,
        c.created_at
      FROM candidates c
      INNER JOIN elections e ON c.election_id = e.election_id
      WHERE c.student_id = ?
      ORDER BY c.created_at DESC
      `,
      [studentId]
    );

    return res.json({ success: true, applications: rows });
  } catch (error) {
    console.error("Candidate status retrieval error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your candidate applications",
    });
  }
}

/**
 * Get all candidate applications for administrative review.
 *
 * GET /api/candidates/pending/list
 *
 * ADMIN and SUPER_ADMIN only.
 */
export async function getPendingCandidates(
  _req: Request,
  res: Response
) {
  try {
    const [rows] =
      await pool.query(
        `
        SELECT
          c.candidate_id,
          c.student_id,
          c.election_id,

          s.registration_number,
          s.name,
          s.email,

          s.school_id,
          sc.school_code,
          sc.school_name,

          c.phone,
          c.course,
          c.year_of_study,

          c.manifesto,
          c.motivation,
          c.leadership_experience,
          c.vision,
          c.priorities,

          c.photo,
          c.video,
          c.fee_statement,
          c.result_slip,

          c.approval_status,
          c.created_at

        FROM candidates c

        INNER JOIN students s
          ON c.student_id = s.student_id

        LEFT JOIN schools sc
          ON s.school_id = sc.school_id

        INNER JOIN elections e
          ON c.election_id = e.election_id

        ORDER BY c.created_at ASC
        `
      );

    return res.json({
      success: true,
      candidates: rows,
    });

  } catch (error) {
    console.error(
      "Pending candidate retrieval error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to retrieve pending candidates",
    });
  }
}

/**
 * Approve or reject a candidate application.
 *
 * PATCH /api/candidates/:candidateId/approval
 *
 * Body:
 * {
 *   "approval_status": "APPROVED"
 * }
 *
 * or
 *
 * {
 *   "approval_status": "REJECTED"
 * }
 */
export async function updateCandidateApproval(
  req: Request,
  res: Response
) {
  try {
    const candidateId =
      Number(
        req.params.candidateId
      );

    const approvalStatus =
      String(
        req.body.approval_status || ""
      )
        .trim()
        .toUpperCase();

    if (
      !Number.isInteger(candidateId) ||
      candidateId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid candidate ID",
      });
    }

    if (
      ![
        "APPROVED",
        "REJECTED",
      ].includes(approvalStatus)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Approval status must be APPROVED or REJECTED",
      });
    }

    /*
     * Find candidate.
     */
    const [candidateRows] =
      await pool.query(
        `
        SELECT
          candidate_id,
          student_id,
          election_id,
          approval_status
        FROM candidates
        WHERE candidate_id = ?
        LIMIT 1
        `,
        [candidateId]
      );

    const candidates =
      candidateRows as Array<{
        candidate_id: number;
        student_id: number;
        election_id: number;
        approval_status:
          | "PENDING"
          | "APPROVED"
          | "REJECTED";
      }>;

    if (candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Candidate application not found",
      });
    }

    const candidate =
      candidates[0];

    /*
     * Only pending applications
     * can be reviewed.
     */
    if (
      candidate.approval_status !==
      "PENDING"
    ) {
      return res.status(409).json({
        success: false,
        message:
          `Candidate has already been ${candidate.approval_status.toLowerCase()}`,
      });
    }

    /*
     * Get admin ID from authentication
     * middleware when available.
     */
    const adminId =
      req.admin?.adminId ?? null;

    /*
     * Update candidate.
     *
     * The review columns are only included
     * if they exist in the database.
     *
     * Your current table does NOT contain
     * reviewed_by/reviewed_at/review_comment,
     * so we only update approval_status here.
     */
    await pool.query(
      `
      UPDATE candidates
      SET approval_status = ?
      WHERE candidate_id = ?
      `,
      [
        approvalStatus,
        candidateId,
      ]
    );

    return res.json({
      success: true,

      message:
        approvalStatus ===
        "APPROVED"
          ? "Candidate approved successfully"
          : "Candidate rejected successfully",

      candidate: {
        candidate_id:
          candidate.candidate_id,

        student_id:
          candidate.student_id,

        election_id:
          candidate.election_id,

        approval_status:
          approvalStatus,

        reviewed_by:
          adminId,
      },
    });

  } catch (error) {
    console.error(
      "Candidate approval error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update candidate approval",
    });
  }
}

