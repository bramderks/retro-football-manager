-- Retro Football Manager: database schema for the 2026/27 Dutch league dataset
-- Apply to a dedicated PostgreSQL database; do not run against another app's database.
CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  starts_on DATE,
  ends_on DATE
);
CREATE TABLE IF NOT EXISTS divisions (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tier SMALLINT NOT NULL,
  UNIQUE (season_id, name)
);
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  division_id TEXT NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  short_name TEXT,
  reputation SMALLINT NOT NULL DEFAULT 50 CHECK (reputation BETWEEN 1 AND 100),
  team_strength SMALLINT NOT NULL DEFAULT 50 CHECK (team_strength BETWEEN 1 AND 100),
  source_url TEXT,
  source_checked_at DATE,
  UNIQUE (division_id, name)
);
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  known_as TEXT,
  date_of_birth DATE,
  nationality TEXT,
  position TEXT NOT NULL CHECK (position IN ('GK','RB','CB','LB','RWB','LWB','DM','CM','AM','RW','LW','ST')),
  shirt_number SMALLINT,
  preferred_foot TEXT CHECK (preferred_foot IN ('left','right','both')),
  overall_rating SMALLINT NOT NULL DEFAULT 50 CHECK (overall_rating BETWEEN 1 AND 100),
  potential_rating SMALLINT NOT NULL DEFAULT 60 CHECK (potential_rating BETWEEN 1 AND 100),
  source_url TEXT,
  source_checked_at DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, full_name)
);
CREATE INDEX IF NOT EXISTS idx_teams_division ON teams(division_id);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);
INSERT INTO seasons (id, label, starts_on, ends_on)
VALUES ('2026-2027', 'Seizoen 2026/27', '2026-08-01', '2027-06-30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO divisions (id, season_id, name, tier) VALUES
('eredivisie-2026-2027','2026-2027','VriendenLoterij Eredivisie',1),
('kkd-2026-2027','2026-2027','Keuken Kampioen Divisie',2)
ON CONFLICT (id) DO NOTHING;


CREATE TABLE IF NOT EXISTS world_fixture_results (
  fixture_id text PRIMARY KEY REFERENCES fixtures(id) ON DELETE CASCADE,
  season_id text NOT NULL,
  home_goals smallint NOT NULL CHECK(home_goals BETWEEN 0 AND 8),
  away_goals smallint NOT NULL CHECK(away_goals BETWEEN 0 AND 8),
  simulated_at timestamptz NOT NULL DEFAULT now()
);
