ALTER TABLE students
  ADD COLUMN verification_last_sent_at DATETIME NULL,
  ADD COLUMN verification_resend_count INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN password_reset_hash VARCHAR(255) NULL,
  ADD COLUMN password_reset_expires_at DATETIME NULL,
  ADD COLUMN password_reset_attempts INT UNSIGNED NOT NULL DEFAULT 0;