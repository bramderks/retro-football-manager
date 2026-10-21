-- Career-specific squad ownership and player condition state.
-- Base player records remain shared static database data; transfers and condition changes are save-local.
CREATE TABLE IF NOT EXISTS career_player_states (
  save_id TEXT NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  club_id TEXT NOT NULL REFERENCES teams(id),
  fitness SMALLINT NOT NULL DEFAULT 100 CHECK (fitness BETWEEN 0 AND 100),
  morale SMALLINT NOT NULL DEFAULT 60 CHECK (morale BETWEEN 0 AND 100),
  sharpness SMALLINT NOT NULL DEFAULT 50 CHECK (sharpness BETWEEN 0 AND 100),
  injury_type TEXT,
  injury_until DATE,
  suspended_until DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(save_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_career_player_states_roster ON career_player_states(save_id, club_id);
