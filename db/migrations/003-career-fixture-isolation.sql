-- Keep generated match results isolated per career save.
-- The shared fixtures table remains the canonical schedule and is never mutated by career simulation.
CREATE TABLE IF NOT EXISTS career_fixture_results (
  id BIGSERIAL PRIMARY KEY,
  save_id TEXT NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  home_goals SMALLINT NOT NULL CHECK (home_goals BETWEEN 0 AND 8),
  away_goals SMALLINT NOT NULL CHECK (away_goals BETWEEN 0 AND 8),
  status TEXT NOT NULL DEFAULT 'played' CHECK (status IN ('played')),
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(save_id, fixture_id)
);
CREATE INDEX IF NOT EXISTS idx_career_fixture_results_save ON career_fixture_results(save_id, fixture_id);
