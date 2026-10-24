-- Annual UEFA coefficient, access-list and financial monitoring support.
BEGIN;
CREATE TABLE IF NOT EXISTS uefa_association_season_coefficients (
  season_id TEXT NOT NULL,
  country_code TEXT NOT NULL,
  points NUMERIC(8,3) NOT NULL DEFAULT 0,
  participating_clubs SMALLINT NOT NULL DEFAULT 0,
  coefficient NUMERIC(8,3) NOT NULL DEFAULT 0,
  ranking SMALLINT,
  PRIMARY KEY (season_id,country_code)
);
CREATE TABLE IF NOT EXISTS uefa_association_coefficients (
  country_code TEXT PRIMARY KEY,
  latest_season_id TEXT NOT NULL,
  five_season_total NUMERIC(8,3) NOT NULL DEFAULT 0,
  coefficient NUMERIC(8,3) NOT NULL DEFAULT 0,
  ranking SMALLINT
);
CREATE TABLE IF NOT EXISTS uefa_club_season_coefficients (
  season_id TEXT NOT NULL,
  club_id TEXT NOT NULL REFERENCES uefa_clubs(id),
  points NUMERIC(8,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (season_id,club_id)
);
CREATE TABLE IF NOT EXISTS uefa_club_coefficients (
  club_id TEXT PRIMARY KEY REFERENCES uefa_clubs(id),
  five_season_total NUMERIC(8,3) NOT NULL DEFAULT 0,
  ten_season_total NUMERIC(8,3) NOT NULL DEFAULT 0,
  coefficient NUMERIC(8,3) NOT NULL DEFAULT 0,
  ranking SMALLINT
);
CREATE TABLE IF NOT EXISTS club_financial_monitoring (
  team_id TEXT NOT NULL REFERENCES teams(id),
  season_id TEXT NOT NULL,
  relevant_revenue BIGINT NOT NULL DEFAULT 0,
  squad_cost BIGINT NOT NULL DEFAULT 0,
  squad_cost_ratio NUMERIC(6,2) NOT NULL DEFAULT 0,
  overdue_club_payables BIGINT NOT NULL DEFAULT 0,
  overdue_employee_payables BIGINT NOT NULL DEFAULT 0,
  overdue_tax_payables BIGINT NOT NULL DEFAULT 0,
  football_earnings_deviation BIGINT NOT NULL DEFAULT 0,
  compliance_status TEXT NOT NULL DEFAULT 'compliant',
  sanctions JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(team_id,season_id)
);
CREATE INDEX IF NOT EXISTS idx_uefa_assoc_coefficient_rank ON uefa_association_coefficients(ranking);
CREATE INDEX IF NOT EXISTS idx_uefa_club_coefficient_rank ON uefa_club_coefficients(ranking);
COMMIT;
