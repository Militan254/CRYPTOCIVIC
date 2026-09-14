import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../config/database.js";

const migrationsDirectory = path.join(process.cwd(), "migrations");

export async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const files = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const [appliedRows] = await pool.query(
      "SELECT version FROM schema_migrations WHERE version = ? LIMIT 1",
      [file]
    );

    if ((appliedRows as Array<unknown>).length > 0) {
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDirectory, file), "utf8");
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const statements = sql
        .split(/;\s*(?:\r?\n|$)/)
        .map((statement) => statement.trim())
        .filter(Boolean);

      for (const statement of statements) {
        await connection.query(statement);
      }

      await connection.query(
        "INSERT INTO schema_migrations (version) VALUES (?)",
        [file]
      );
      await connection.commit();
      console.log(`Applied database migration ${file}.`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
