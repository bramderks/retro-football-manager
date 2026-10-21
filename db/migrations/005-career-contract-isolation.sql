-- Contracts belong to a career save; never mutate the shared base player contract data.
CREATE TABLE IF NOT EXISTS career_player_contracts (
  id TEXT PRIMARY KEY,
  save_id TEXT NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  club_id TEXT NOT NULL REFERENCES teams(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weekly_wage BIGINT NOT NULL DEFAULT 0 CHECK (weekly_wage >= 0),
  squad_status TEXT NOT NULL DEFAULT 'rotation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_career_player_contracts_save ON career_player_contracts(save_id, player_id);
