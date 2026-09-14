CREATE TABLE IF NOT EXISTS schools (
  school_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  school_code VARCHAR(32) NOT NULL,
  school_name VARCHAR(255) NOT NULL,
  PRIMARY KEY (school_id),
  UNIQUE KEY uq_schools_code (school_code),
  UNIQUE KEY uq_schools_name (school_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS students (
  student_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  registration_number VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  school_id INT UNSIGNED NOT NULL,
  password VARCHAR(255) NULL,
  password_initialized TINYINT(1) NOT NULL DEFAULT 0,
  verification_code_hash VARCHAR(255) NULL,
  verification_code_expires_at DATETIME NULL,
  verification_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id),
  UNIQUE KEY uq_students_registration_number (registration_number),
  UNIQUE KEY uq_students_email (email),
  KEY idx_students_school (school_id),
  CONSTRAINT fk_students_school FOREIGN KEY (school_id) REFERENCES schools (school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS administrators (
  admin_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'ADMIN',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_id),
  UNIQUE KEY uq_administrators_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS positions (
  position_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  position_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  PRIMARY KEY (position_id),
  UNIQUE KEY uq_positions_name (position_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS elections (
  election_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  position VARCHAR(255) NOT NULL,
  election_scope ENUM('SCHOOL', 'UNIVERSITY') NOT NULL,
  school_id INT UNSIGNED NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status ENUM('UPCOMING', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'UPCOMING',
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (election_id),
  KEY idx_elections_status_end_time (status, end_time),
  KEY idx_elections_school (school_id),
  CONSTRAINT fk_elections_school FOREIGN KEY (school_id) REFERENCES schools (school_id),
  CONSTRAINT fk_elections_created_by FOREIGN KEY (created_by) REFERENCES administrators (admin_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidates (
  candidate_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id INT UNSIGNED NOT NULL,
  election_id INT UNSIGNED NOT NULL,
  phone VARCHAR(50) NOT NULL,
  course VARCHAR(255) NOT NULL,
  year_of_study VARCHAR(50) NOT NULL,
  manifesto TEXT NOT NULL,
  motivation TEXT NOT NULL,
  leadership_experience TEXT NOT NULL,
  vision TEXT NOT NULL,
  priorities TEXT NOT NULL,
  photo VARCHAR(500) NOT NULL,
  fee_statement VARCHAR(500) NOT NULL,
  result_slip VARCHAR(500) NOT NULL,
  video VARCHAR(500) NOT NULL,
  approval_status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (candidate_id),
  UNIQUE KEY uq_candidates_student_election (student_id, election_id),
  KEY idx_candidates_election_status (election_id, approval_status),
  CONSTRAINT fk_candidates_student FOREIGN KEY (student_id) REFERENCES students (student_id),
  CONSTRAINT fk_candidates_election FOREIGN KEY (election_id) REFERENCES elections (election_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS votes (
  vote_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  election_id INT UNSIGNED NOT NULL,
  candidate_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (vote_id),
  UNIQUE KEY uq_votes_student_election (student_id, election_id),
  KEY idx_votes_candidate (candidate_id),
  CONSTRAINT fk_votes_election FOREIGN KEY (election_id) REFERENCES elections (election_id),
  CONSTRAINT fk_votes_candidate FOREIGN KEY (candidate_id) REFERENCES candidates (candidate_id),
  CONSTRAINT fk_votes_student FOREIGN KEY (student_id) REFERENCES students (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
