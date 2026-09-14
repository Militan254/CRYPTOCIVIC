import type { Request, Response } from "express";
import { pool } from "../config/database.js";

export async function getSchools(
  _req: Request,
  res: Response
) {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        school_id,
        school_code,
        school_name
      FROM schools
      ORDER BY school_id
      `
    );

    return res.json({
      success: true,
      schools: rows,
    });
  } catch (error) {
    console.error(
      "School retrieval error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve schools",
    });
  }
}
