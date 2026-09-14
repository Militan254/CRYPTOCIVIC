import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../services/auth.js";

declare global {
  namespace Express {
    interface Request {
      voter?: {
        studentId: number;
        registrationNumber: string;
      };
    }
  }
}

export function authenticateVoter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const [scheme, token] = String(req.headers.authorization || "").split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        message: "Voter authentication required",
      });
    }

    const decoded = verifyAuthToken(token);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("studentId" in decoded) ||
      !("registrationNumber" in decoded)
    ) {
      return res.status(401).json({ success: false, message: "Invalid voter token" });
    }

    const studentId = Number((decoded as { studentId: unknown }).studentId);
    const registrationNumber = String(
      (decoded as { registrationNumber: unknown }).registrationNumber
    );

    if (!Number.isInteger(studentId) || studentId <= 0 || !registrationNumber) {
      return res.status(401).json({ success: false, message: "Invalid voter token" });
    }

    req.voter = { studentId, registrationNumber };
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired voter session",
    });
  }
}