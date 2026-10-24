-- Reputation events keep the invisible points calculation auditable without exposing it in the UI.
CREATE TABLE IF NOT EXISTS team_reputation_events (
  id BIGSERIAL PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  source TEXT NOT NULL,
  points SMALLINT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id,season_id,source)
);
CREATE INDEX IF NOT EXISTS idx_team_reputation_events_team ON team_reputation_events(team_id,season_id DESC);
