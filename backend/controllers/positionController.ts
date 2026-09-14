import type { Request, Response } from "express";
import { pool } from "../config/database.js";

export async function getPositions(
  _req: Request,
  res: Response
) {
  try {
    const [rows] = await pool.query(`
      SELECT
        position_id,
        position_name,
        description
      FROM positions
      ORDER BY position_id
    `);

    return res.json({
      success: true,
      positions: rows,
    });
  } catch (error) {
    console.error(
      "Positions retrieval error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve positions",
    });
  }
}
