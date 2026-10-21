CREATE TABLE IF NOT EXISTS career_fixture_schedule (
  save_id TEXT NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  matchday SMALLINT NOT NULL,
  kickoff_date DATE NOT NULL,
  home_team_id TEXT NOT NULL REFERENCES teams(id),
  away_team_id TEXT NOT NULL REFERENCES teams(id),
  PRIMARY KEY (save_id, fixture_id),
  CHECK (home_team_id <> away_team_id)
);
CREATE INDEX IF NOT EXISTS career_fixture_schedule_next_match
  ON career_fixture_schedule(save_id, kickoff_date, matchday);
