import type { Request, Response } from "express";
import { pool } from "../config/database.js";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import {
  sendPasswordResetCodeEmail,
  sendVerificationCodeEmail,
  isEmailConfigured,
} from "../services/email.js";
import { createVoterToken } from "../services/auth.js";

const DEFAULT_STUDENT_PASSWORD = "jooust2030";
const VERIFICATION_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

type StudentAuthRecord = {
  student_id: number;
  registration_number: string;
  name: string;
  email: string;
  school_id: number;
  password: string | null;
  password_initialized: number;
  verification_code_hash: string | null;
  verification_code_expires_at: Date | string | null;
  verification_attempts: number;
  verification_last_sent_at: Date | string | null;
  verification_resend_count: number;
  password_reset_hash: string | null;
  password_reset_expires_at: Date | string | null;
  password_reset_attempts: number;
  school_code: string;
  school_name: string;
};

function normalizePassword(value: unknown): string {
  return String(value || "").trim();
}

function isBcryptHash(value: string | null): boolean {
  return Boolean(value && /^\$2[aby]\$\d{2}\$/.test(value));
}

function publicStudent(student: StudentAuthRecord) {
  return {
    student_id: student.student_id,
    registration_number: student.registration_number,
    name: student.name,
    email: student.email,
    school_id: student.school_id,
    school_code: student.school_code,
    school_name: student.school_name,
  };
}

async function findStudent(registrationNumber: string) {
  const [rows] = await pool.query(
    `
    SELECT
      s.student_id,
      s.registration_number,
      s.name,
      s.email,
      s.school_id,
      s.password,
      s.password_initialized,
      s.verification_code_hash,
      s.verification_code_expires_at,
      s.verification_attempts,
      s.verification_last_sent_at,
      s.verification_resend_count,
      s.password_reset_hash,
      s.password_reset_expires_at,
      s.password_reset_attempts,
      sc.school_code,
      sc.school_name
    FROM students s
    INNER JOIN schools sc ON s.school_id = sc.school_id
    WHERE s.registration_number = ?
    LIMIT 1
    `,
    [registrationNumber]
  );

  return (rows as StudentAuthRecord[])[0] || null;
}

async function issueVerificationCode(student: StudentAuthRecord) {
  const lastSent = student.verification_last_sent_at
    ? new Date(student.verification_last_sent_at).getTime()
    : 0;

  if (lastSent && Date.now() - lastSent < 60_000) {
    throw new Error("Please wait before requesting another verification code");
  }

  if (student.verification_resend_count >= 3 && lastSent && Date.now() - lastSent < 60 * 60_000) {
    throw new Error("Verification code resend limit reached. Try again later");
  }

  const code = String(randomInt(100000, 1000000));
  await pool.query(
    `
    UPDATE students
    SET verification_code_hash = ?,
        verification_code_expires_at = ?,
        verification_attempts = 0,
        verification_last_sent_at = NOW(),
        verification_resend_count = CASE
          WHEN verification_last_sent_at IS NULL OR verification_last_sent_at < DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1
          ELSE verification_resend_count + 1
        END
    WHERE student_id = ?
    `,
    [await bcrypt.hash(code, 10), new Date(Date.now() + VERIFICATION_TTL_MS), student.student_id]
  );
  await sendVerificationCodeEmail(student.email, code);
}

export async function loginStudent(
  req: Request,
  res: Response
) {
  try {
    const registrationNumber = String(
      req.body.registration_number || req.body.registrationNumber || ""
    ).trim();

    const password = String(
      req.body.password || ""
    ).trim();

    if (!registrationNumber) {
      return res.status(400).json({
        success: false,
        message: "Registration number is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    const student = await findStudent(registrationNumber);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const storedPassword = student.password || "";
    const validPassword = isBcryptHash(storedPassword)
      ? await bcrypt.compare(password, storedPassword)
      : password === DEFAULT_STUDENT_PASSWORD;

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid registration number or password",
      });
    }

    if (!student.password_initialized) {
      if (!isEmailConfigured) {
        return res.status(503).json({
          success: false,
          message: "Identity verification email is not configured yet",
        });
      }

      await issueVerificationCode(student);

      return res.json({
        success: true,
        requiresVerification: true,
        student: {
          student_id: student.student_id,
          name: student.name,
          email_hint: student.email.replace(/^(.{2}).*(@.*)$/, "$1••••$2"),
        },
      });
    }

    return res.json({
      success: true,
      token: createVoterToken({
        studentId: student.student_id,
        registrationNumber: student.registration_number,
      }),
      student: publicStudent(student),
    });
  } catch (error) {
    console.error("Student login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in",
    });
  }
}

export async function resendStudentVerificationCode(req: Request, res: Response) {
  try {
    const registrationNumber = String(req.body.registration_number || "").trim();
    const password = normalizePassword(req.body.password);
    const student = await findStudent(registrationNumber);

    if (!student || student.password_initialized || !isEmailConfigured) {
      return res.status(400).json({ success: false, message: "Unable to resend verification code" });
    }

    const validPassword = isBcryptHash(student.password)
      ? await bcrypt.compare(password, student.password || "")
      : password === DEFAULT_STUDENT_PASSWORD;

    if (!validPassword) {
      return res.status(401).json({ success: false, message: "Invalid registration number or password" });
    }

    await issueVerificationCode(student);
    return res.json({ success: true, message: "A new verification code has been sent" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resend verification code";
    return res.status(429).json({ success: false, message });
  }
}

export async function requestPasswordReset(req: Request, res: Response) {
  const genericResponse = {
    success: true,
    message: "If the account exists, a password reset code has been sent.",
  };

  try {
    const identifier = String(req.body.registration_number || req.body.email || "").trim().toLowerCase();
    if (!identifier || !isEmailConfigured) return res.json(genericResponse);

    const [rows] = await pool.query(
      `SELECT s.student_id, s.registration_number, s.name, s.email, s.school_id, s.password, s.password_initialized,
        s.verification_code_hash, s.verification_code_expires_at, s.verification_attempts, s.verification_last_sent_at,
        s.verification_resend_count, s.password_reset_hash, s.password_reset_expires_at, s.password_reset_attempts,
        sc.school_code, sc.school_name
       FROM students s INNER JOIN schools sc ON s.school_id = sc.school_id
       WHERE LOWER(s.email) = ? OR LOWER(s.registration_number) = ? LIMIT 1`,
      [identifier, identifier]
    );
    const student = (rows as StudentAuthRecord[])[0];
    if (!student) return res.json(genericResponse);

    const code = String(randomInt(100000, 1000000));
    await pool.query(
      `UPDATE students SET password_reset_hash = ?, password_reset_expires_at = ?, password_reset_attempts = 0 WHERE student_id = ?`,
      [await bcrypt.hash(code, 10), new Date(Date.now() + VERIFICATION_TTL_MS), student.student_id]
    );
    await sendPasswordResetCodeEmail(student.email, code);
    return res.json(genericResponse);
  } catch (error) {
    console.error("Password reset request error:", error);
    return res.json(genericResponse);
  }
}

export async function completePasswordReset(req: Request, res: Response) {
  try {
    const identifier = String(req.body.registration_number || req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "").trim();
    const newPassword = normalizePassword(req.body.new_password);
    if (!identifier || !/^\d{6}$/.test(code) || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Valid account, six-digit code and 8-character password are required" });
    }

    const [rows] = await pool.query(
      "SELECT student_id, registration_number, password_reset_hash, password_reset_expires_at, password_reset_attempts FROM students WHERE LOWER(email) = ? OR LOWER(registration_number) = ? LIMIT 1",
      [identifier, identifier]
    );
    const student = (rows as Array<{ student_id: number; registration_number: string; password_reset_hash: string | null; password_reset_expires_at: Date | string | null; password_reset_attempts: number }>)[0];
    const expiresAt = student?.password_reset_expires_at ? new Date(student.password_reset_expires_at).getTime() : 0;

    if (!student || !student.password_reset_hash || !expiresAt || Date.now() > expiresAt || student.password_reset_attempts >= MAX_VERIFICATION_ATTEMPTS) {
      return res.status(401).json({ success: false, message: "Password reset code expired or unavailable" });
    }

    if (!await bcrypt.compare(code, student.password_reset_hash)) {
      await pool.query("UPDATE students SET password_reset_attempts = password_reset_attempts + 1 WHERE student_id = ?", [student.student_id]);
      return res.status(401).json({ success: false, message: "Invalid password reset code" });
    }

    await pool.query(
      "UPDATE students SET password = ?, password_initialized = 1, password_reset_hash = NULL, password_reset_expires_at = NULL, password_reset_attempts = 0 WHERE student_id = ?",
      [await bcrypt.hash(newPassword, 12), student.student_id]
    );
    return res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Password reset completion error:", error);
    return res.status(500).json({ success: false, message: "Unable to reset password" });
  }
}

export async function completeStudentPasswordSetup(
  req: Request,
  res: Response
) {
  try {
    const registrationNumber = String(req.body.registration_number || "").trim();
    const code = String(req.body.code || "").trim();
    const newPassword = normalizePassword(req.body.new_password);

    if (!registrationNumber || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: "Valid registration number and six-digit code are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }

    const student = await findStudent(registrationNumber);

    if (!student || student.password_initialized) {
      return res.status(400).json({ success: false, message: "Password setup is not available for this account" });
    }

    const expiresAt = student.verification_code_expires_at
      ? new Date(student.verification_code_expires_at).getTime()
      : 0;

    if (
      !student.verification_code_hash ||
      !expiresAt ||
      Date.now() > expiresAt ||
      student.verification_attempts >= MAX_VERIFICATION_ATTEMPTS
    ) {
      return res.status(401).json({ success: false, message: "Verification code expired or unavailable" });
    }

    const validCode = await bcrypt.compare(code, student.verification_code_hash);

    if (!validCode) {
      await pool.query(
        "UPDATE students SET verification_attempts = verification_attempts + 1 WHERE student_id = ?",
        [student.student_id]
      );
      return res.status(401).json({ success: false, message: "Invalid verification code" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      `
      UPDATE students
      SET password = ?,
          password_initialized = 1,
          verification_code_hash = NULL,
          verification_code_expires_at = NULL,
          verification_attempts = 0
      WHERE student_id = ?
      `,
      [passwordHash, student.student_id]
    );

    return res.json({
      success: true,
      token: createVoterToken({
        studentId: student.student_id,
        registrationNumber: student.registration_number,
      }),
      student: publicStudent(student),
    });
  } catch (error) {
    console.error("Student password setup error:", error);
    return res.status(500).json({ success: false, message: "Unable to complete password setup" });
  }
}

export async function getStudentEligibility(
  req: Request,
  res: Response
) {
  try {
    const registrationNumber = String(
      req.params.registrationNumber || ""
    ).trim();

    if (!registrationNumber) {
      return res.status(400).json({
        success: false,
        message: "Registration number is required",
      });
    }

    // Example:
    // I132\G\13258\24
    // First character = school code
    const schoolCode = registrationNumber
      .charAt(0)
      .toUpperCase();

    const [rows] = await pool.query(
      `
      SELECT
        s.student_id,
        s.registration_number,
        s.name,
        s.email,
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
      email: string;
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

    if (student.school_code !== schoolCode) {
      return res.status(403).json({
        success: false,
        message: "Registration number school code does not match student record",
      });
    }

    return res.json({
      success: true,
      student: {
        student_id: student.student_id,
        registration_number: student.registration_number,
        name: student.name,
        school_id: student.school_id,
        school_code: student.school_code,
        school_name: student.school_name,
      },
    });

  } catch (error) {
    console.error("Student eligibility error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to check student eligibility",
    });
  }
}
