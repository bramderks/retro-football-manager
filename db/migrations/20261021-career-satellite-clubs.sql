CREATE TABLE IF NOT EXISTS career_satellite_clubs (
  id TEXT PRIMARY KEY,
  save_id TEXT NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
  parent_club_id TEXT NOT NULL REFERENCES teams(id),
  satellite_club_id TEXT NOT NULL REFERENCES teams(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','rejected','ended')),
  first_option BOOLEAN NOT NULL DEFAULT TRUE,
  scouting_access BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(save_id,satellite_club_id),
  CHECK(parent_club_id<>satellite_club_id)
);
CREATE INDEX IF NOT EXISTS career_satellite_clubs_by_save ON career_satellite_clubs(save_id,status);
