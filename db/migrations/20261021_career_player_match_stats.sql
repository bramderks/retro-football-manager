CREATE TABLE IF NOT EXISTS career_player_match_stats (
  id TEXT PRIMARY KEY,
  save_id TEXT NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
  fixture_id TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  club_id TEXT NOT NULL REFERENCES teams(id),
  appearances INTEGER NOT NULL DEFAULT 0,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (save_id, fixture_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_career_player_match_stats_save_player
  ON career_player_match_stats(save_id, player_id);
