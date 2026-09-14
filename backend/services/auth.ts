import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET: string = process.env.JWT_SECRET || "";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

export async function hashPassword(
  password: string
): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function createAuthToken(payload: {
  adminId: number;
  role: string;
}) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "8h",
  });
}

export function createVoterToken(payload: {
  studentId: number;
  registrationNumber: string;
}) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "2h",
  });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, JWT_SECRET);
}
