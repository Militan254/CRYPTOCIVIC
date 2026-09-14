import type { Request, Response } from "express";
import { pool } from "../config/database.js";
import {
  comparePassword,
  createAuthToken,
} from "../services/auth.js";

export async function loginAdmin(
  req: Request,
  res: Response
) {
  return loginWithRole(req, res);
}

export async function loginSuperAdmin(
  req: Request,
  res: Response
) {
  return loginWithRole(req, res, "SUPER_ADMIN");
}

async function loginWithRole(
  req: Request,
  res: Response,
  requiredRole?: string
) {
  try {
    const email = String(
      req.body.email || ""
    ).trim().toLowerCase();

    const password = String(
      req.body.password || ""
    );

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT
        admin_id,
        name,
        email,
        password,
        role
      FROM administrators
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    const admins = rows as Array<{
      admin_id: number;
      name: string;
      email: string;
      password: string;
      role: string;
    }>;

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const admin = admins[0];

    if (requiredRole && admin.role !== requiredRole) {
      return res.status(401).json({
        success: false,
        message: "Invalid super administrator credentials",
      });
    }

    const passwordValid =
      await comparePassword(
        password,
        admin.password
      );

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = createAuthToken({
      adminId: admin.admin_id,
      role: admin.role,
    });

    return res.json({
      success: true,
      message: "Login successful",
      token,
      admin: {
        admin_id: admin.admin_id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });

  } catch (error) {
    console.error(
      "Admin login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to login",
    });
  }
}
