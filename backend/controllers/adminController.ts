import type { Request, Response } from "express";
import { pool } from "../config/database.js";

import bcrypt from "bcryptjs";
const DEFAULT_STUDENT_PASSWORD = "jooust2030";

export async function createAdmin(
  req: Request,
  res: Response
) {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = String(req.body.role || "ADMIN").trim().toUpperCase();

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid administrator role",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const [existingRows] = await pool.query(
      `
      SELECT admin_id
      FROM administrators
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    if ((existingRows as Array<unknown>).length > 0) {
      return res.status(409).json({
        success: false,
        message: "Administrator email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    const [result] = await pool.query(
      `
      INSERT INTO administrators
        (name, email, password, role)
      VALUES
        (?, ?, ?, ?)
      `,
      [
        name,
        email,
        passwordHash,
        role,
      ]
    );

    const insertResult = result as {
      insertId: number;
    };

    return res.status(201).json({
      success: true,
      message: "Administrator created successfully",
      administrator: {
        admin_id: insertResult.insertId,
        name,
        email,
        role,
      },
    });

  } catch (error) {
    console.error(
      "Administrator creation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create administrator",
    });
  }
}

export async function importVoters(req: Request, res: Response) {
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, message: "CSV voter file is required" });

  try {
    const lines = file.buffer.toString("utf8").split(/\r?\n/).filter(Boolean);
    const [headerLine, ...dataLines] = lines;
    const headers = headerLine.split(",").map((header) => header.trim().toLowerCase());
    const required = ["name", "registration_number", "email", "school_id"];
    if (!required.every((field) => headers.includes(field))) {
      return res.status(400).json({ success: false, message: "CSV must contain name, registration_number, email and school_id columns" });
    }

    const passwordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 12);
    let created = 0;
    const rejected: string[] = [];

    for (const line of dataLines) {
      const values = line.split(",").map((value) => value.trim());
      const record = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
      const schoolId = Number(record.school_id);

      if (!record.name || !record.registration_number || !record.email || !Number.isInteger(schoolId) || schoolId <= 0) {
        rejected.push(record.registration_number || line);
        continue;
      }

      try {
        await pool.query(
          `INSERT INTO students (registration_number, name, email, school_id, password, password_initialized, verification_attempts)
           VALUES (?, ?, ?, ?, ?, 0, 0)`,
          [record.registration_number, record.name, record.email.toLowerCase(), schoolId, passwordHash]
        );
        created++;
      } catch (error) {
        rejected.push(record.registration_number);
      }
    }

    return res.json({ success: true, created, rejected });
  } catch (error) {
    console.error("Voter import error:", error);
    return res.status(400).json({ success: false, message: "Unable to import voter CSV" });
  }
}

export async function getAdmins(
  _req: Request,
  res: Response
) {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        admin_id,
        name,
        email,
        role,
        created_at
      FROM administrators
      ORDER BY admin_id
      `
    );

    return res.json({
      success: true,
      administrators: rows,
    });

  } catch (error) {
    console.error(
      "Administrator retrieval error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve administrators",
    });
  }
}

export async function updateAdminRole(
  req: Request,
  res: Response
) {
  try {
    const adminId = Number(req.params.adminId);
    const newRole = String(
      req.body.role || ""
    ).trim().toUpperCase();

    if (!Number.isInteger(adminId) || adminId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid administrator ID",
      });
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(newRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid administrator role",
      });
    }

    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (req.admin.adminId === adminId) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own administrator role",
      });
    }

    const [adminRows] = await pool.query(
      `
      SELECT
        admin_id,
        name,
        email,
        role
      FROM administrators
      WHERE admin_id = ?
      LIMIT 1
      `,
      [adminId]
    );

    const admins = adminRows as Array<{
      admin_id: number;
      name: string;
      email: string;
      role: string;
    }>;

    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Administrator not found",
      });
    }

    const targetAdmin = admins[0];

    if (
      targetAdmin.role === "SUPER_ADMIN" &&
      newRole === "ADMIN"
    ) {
      const [countRows] = await pool.query(
        `
        SELECT COUNT(*) AS super_admin_count
        FROM administrators
        WHERE role = 'SUPER_ADMIN'
        `
      );

      const countResult = (
        countRows as Array<{
          super_admin_count: number;
        }>
      )[0];

      if (Number(countResult.super_admin_count) <= 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot demote the last remaining SUPER_ADMIN",
        });
      }
    }

    await pool.query(
      `
      UPDATE administrators
      SET role = ?
      WHERE admin_id = ?
      `,
      [newRole, adminId]
    );

    return res.json({
      success: true,
      message: "Administrator role updated successfully",
      administrator: {
        admin_id: targetAdmin.admin_id,
        name: targetAdmin.name,
        email: targetAdmin.email,
        role: newRole,
      },
    });

  } catch (error) {
    console.error(
      "Administrator role update error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update administrator role",
    });
  }
}

export async function deleteAdmin(
  req: Request,
  res: Response
) {
  try {
    const adminId = Number(req.params.adminId);

    if (!Number.isInteger(adminId) || adminId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid administrator ID" });
    }

    if (!req.admin) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (req.admin.adminId === adminId) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own administrator account",
      });
    }

    const [rows] = await pool.query(
      "SELECT admin_id, role FROM administrators WHERE admin_id = ? LIMIT 1",
      [adminId]
    );
    const target = (rows as Array<{ admin_id: number; role: string }>)[0];

    if (!target) {
      return res.status(404).json({ success: false, message: "Administrator not found" });
    }

    if (target.role === "SUPER_ADMIN") {
      const [countRows] = await pool.query(
        "SELECT COUNT(*) AS super_admin_count FROM administrators WHERE role = 'SUPER_ADMIN'"
      );
      const count = Number((countRows as Array<{ super_admin_count: number }>)[0]?.super_admin_count || 0);

      if (count <= 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete the last remaining SUPER_ADMIN",
        });
      }
    }

    await pool.query("DELETE FROM administrators WHERE admin_id = ?", [adminId]);

    return res.json({ success: true, message: "Administrator deleted successfully" });
  } catch (error) {
    console.error("Administrator deletion error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete administrator" });
  }
}

export async function getAdminOverview(
  _req: Request,
  res: Response
) {
  try {
    const [rows] = await pool.query(`
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
        e.created_at,
        COUNT(DISTINCT c.candidate_id) AS candidate_count,
        COUNT(DISTINCT CASE WHEN c.approval_status = 'PENDING' THEN c.candidate_id END) AS pending_candidates,
        COUNT(DISTINCT CASE WHEN c.approval_status = 'APPROVED' THEN c.candidate_id END) AS approved_candidates,
        COUNT(DISTINCT CASE WHEN c.approval_status = 'REJECTED' THEN c.candidate_id END) AS rejected_candidates,
        COUNT(DISTINCT v.vote_id) AS total_votes
      FROM elections e
      LEFT JOIN schools s ON e.school_id = s.school_id
      LEFT JOIN candidates c ON c.election_id = e.election_id
      LEFT JOIN votes v ON v.election_id = e.election_id
      GROUP BY e.election_id, s.school_name
      ORDER BY e.election_id DESC
    `);

    const [summaryRows] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM administrators) AS administrator_count,
        (SELECT COUNT(*) FROM students) AS student_count,
        (SELECT COUNT(*) FROM elections) AS election_count,
        (SELECT COUNT(*) FROM candidates) AS candidate_count,
        (SELECT COUNT(*) FROM votes) AS vote_count
    `);

    return res.json({
      success: true,
      summary: (summaryRows as Array<Record<string, number>>)[0],
      elections: rows,
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve admin overview" });
  }
}

export async function createVoter(
  req: Request,
  res: Response
) {
  try {
    const name = String(req.body.name || "").trim();
    const registrationNumber = String(req.body.registration_number || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const schoolId = Number(req.body.school_id);

    if (!name || !registrationNumber || !email || !Number.isInteger(schoolId) || schoolId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Name, registration number, email and school are required",
      });
    }

    const [existingRows] = await pool.query(
      "SELECT student_id FROM students WHERE registration_number = ? OR email = ? LIMIT 1",
      [registrationNumber, email]
    );

    if ((existingRows as Array<unknown>).length > 0) {
      return res.status(409).json({ success: false, message: "Student registration number or email already exists" });
    }

    const [schoolRows] = await pool.query(
      "SELECT school_id FROM schools WHERE school_id = ? LIMIT 1",
      [schoolId]
    );

    if ((schoolRows as Array<unknown>).length === 0) {
      return res.status(400).json({ success: false, message: "Selected school does not exist" });
    }

    const [result] = await pool.query(
      `
      INSERT INTO students
        (registration_number, name, email, school_id, password, password_initialized, verification_attempts)
      VALUES (?, ?, ?, ?, ?, 0, 0)
      `,
      [registrationNumber, name, email, schoolId, DEFAULT_STUDENT_PASSWORD]
    );

    return res.status(201).json({
      success: true,
      message: "Voter added successfully. They must verify their identity on first login.",
      voter: {
        student_id: (result as { insertId: number }).insertId,
        registration_number: registrationNumber,
        name,
        email,
        school_id: schoolId,
      },
    });
  } catch (error) {
    console.error("Voter creation error:", error);
    return res.status(500).json({ success: false, message: "Failed to add voter" });
  }
}
