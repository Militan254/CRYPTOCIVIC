import positionRoutes from "./routes/positionRoutes.js";
import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import voteRoutes from "./routes/voteRoutes.js";
import resultRoutes from "./routes/resultRoutes.js";

import { pool } from "./config/database.js";
import studentRoutes from "./routes/studentRoutes.js";
import electionRoutes from "./routes/electionRoutes.js";
import candidateRoutes from "./routes/candidateRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import schoolRoutes from "./routes/schoolRoutes.js";
import { apiRateLimiter } from "./middleware/rateLimiters.js";
import { runMigrations } from "./services/migrations.js";

export const app = express();
const PORT = Number(process.env.PORT || 3000);

async function ensureStudentPasswordColumn() {
  const [columns] = await pool.query(
    "SHOW COLUMNS FROM students LIKE 'password'"
  );

  const columnRows = Array.isArray(columns) ? columns : [];

  if (columnRows.length === 0) {
    await pool.query(
      "ALTER TABLE students ADD COLUMN password VARCHAR(255) NOT NULL DEFAULT 'jooust2030'"
    );
  }

  const extraColumns = [
    ["password_initialized", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["verification_code_hash", "VARCHAR(255) NULL"],
    ["verification_code_expires_at", "DATETIME NULL"],
    ["verification_attempts", "INT NOT NULL DEFAULT 0"],
  ] as const;

  for (const [name, definition] of extraColumns) {
    const [existingColumns] = await pool.query(
      "SHOW COLUMNS FROM students LIKE ?",
      [name]
    );

    if ((existingColumns as unknown[]).length === 0) {
      await pool.query(
        `ALTER TABLE students ADD COLUMN ${name} ${definition}`
      );
    }
  }

  await pool.query(
    "UPDATE students SET password = 'jooust2030', password_initialized = 0 WHERE password IS NULL OR password = ''"
  );

  console.log("Student password column ensured and seeded with jooust2030.");
}

async function ensureElectionPositions() {
  const positions = [
    "President",
    "Deputy President",
    "Secretary General",
    "Deputy Secretary General",
    "Treasurer",
    "Deputy Treasurer",
    "Academic Secretary",
    "Welfare Secretary",
    "Organizing Secretary",
    "Congress Representative",
  ];

  for (const position of positions) {
    await pool.query(
      `
      INSERT INTO positions (position_name)
      SELECT ?
      WHERE NOT EXISTS (
        SELECT 1 FROM positions WHERE position_name = ?
      )
      `,
      [position, position]
    );
  }
}

async function ensureDatabaseConstraints() {
  const constraints = [
    ["uq_students_registration_number", "students", "CONSTRAINT", "UNIQUE (registration_number)"],
    ["uq_candidates_student_election", "candidates", "CONSTRAINT", "UNIQUE (student_id, election_id)"],
    ["uq_votes_student_election", "votes", "CONSTRAINT", "UNIQUE (student_id, election_id)"],
    ["uq_positions_name", "positions", "CONSTRAINT", "UNIQUE (position_name)"],
    ["idx_elections_status_end_time", "elections", "INDEX", "(status, end_time)"],
    ["idx_candidates_election_status", "candidates", "INDEX", "(election_id, approval_status)"],
  ] as const;

  for (const [indexName, tableName, kind, definition] of constraints) {
    const [indexes] = await pool.query(
      `SHOW INDEX FROM \`${tableName}\` WHERE Key_name = ?`,
      [indexName]
    );

    if ((indexes as unknown[]).length === 0) {
      await pool.query(
        `ALTER TABLE \`${tableName}\` ADD ${kind} \`${indexName}\` ${definition}`
      );
    }
  }
}

async function ensureConfiguredSuperAdmin() {
  const email = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.SUPER_ADMIN_PASSWORD || "");

  if (!email || !password) {
    console.warn("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are not configured; skipping super-admin bootstrap.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [existingRows] = await pool.query(
    "SELECT admin_id FROM administrators WHERE email = ? LIMIT 1",
    [email]
  );
  const existing = (existingRows as Array<{ admin_id: number }>)[0];

  if (existing) {
    await pool.query(
      "UPDATE administrators SET password = ?, role = 'SUPER_ADMIN' WHERE admin_id = ?",
      [passwordHash, existing.admin_id]
    );
  } else {
    await pool.query(
      `
      INSERT INTO administrators (name, email, password, role)
      VALUES (?, ?, ?, 'SUPER_ADMIN')
      `,
      ["System Super Administrator", email, passwordHash]
    );
  }

  console.log(`Configured super-admin account ensured for ${email}.`);
}

// Middleware
const allowedOrigins = (process.env.FRONTEND_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
  })
);
app.use(express.json());
app.use("/api", apiRateLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/elections", electionRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/votes", voteRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/positions", positionRoutes);


// Database health check
app.get("/api/health", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT 1 AS database_ok"
    );

    res.json({
      success: true,
      message: "JOOUST Voting API is running",
      database: rows,
    });
  } catch (error) {
    console.error(
      "Database connection failed:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// Start server only after the database is ready.
async function startServer() {
  try {
    await runMigrations();
    await ensureStudentPasswordColumn();
    await ensureElectionPositions();
    await ensureDatabaseConstraints();
    await ensureConfiguredSuperAdmin();

    app.listen(PORT, () => {
      console.log(`JOOUST Voting API running on port ${PORT}`);
    });
  } catch (error) {
    console.error(
      "Unable to start the API because the database is unavailable. Start MySQL/MariaDB and try again.",
      error
    );
    process.exitCode = 1;
  }
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
