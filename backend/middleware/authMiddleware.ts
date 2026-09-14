import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  verifyAuthToken,
} from "../services/auth.js";
import { pool } from "../config/database.js";

type AuthenticatedAdmin = {
  adminId: number;
  role: string;
};

declare global {
  namespace Express {
    interface Request {
      admin?: AuthenticatedAdmin;
    }
  }
}

export async function authenticateAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authorization =
      req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const [scheme, token] =
      authorization.split(" ");

    if (
      scheme !== "Bearer" ||
      !token
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization header",
      });
    }

    const decoded =
      verifyAuthToken(token);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("adminId" in decoded) ||
      !("role" in decoded)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    const adminId = Number(
      (decoded as { adminId: unknown }).adminId
    );

    if (!Number.isInteger(adminId) || adminId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid administrator token",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT admin_id, role
      FROM administrators
      WHERE admin_id = ?
      LIMIT 1
      `,
      [adminId]
    );

    const admin = (rows as Array<{
      admin_id: number;
      role: string;
    }>)[0];

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Administrator account is no longer active",
      });
    }

    req.admin = {
      adminId: admin.admin_id,
      role: admin.role,
    };

    next();

  } catch (error) {
    console.error(
      "Authentication error:",
      error
    );

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
}
export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.admin.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Super administrator privileges required",
    });
  }

  next();
}
