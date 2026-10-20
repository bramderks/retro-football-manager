-- Career simulation foundation for Retro Football Manager.
-- Additive migration: preserves the existing league and player database.
CREATE TABLE IF NOT EXISTS managers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  reputation SMALLINT NOT NULL DEFAULT 35 CHECK (reputation BETWEEN 1 AND 100),
  coaching SMALLINT NOT NULL DEFAULT 40 CHECK (coaching BETWEEN 1 AND 100),
  tactical_knowledge SMALLINT NOT NULL DEFAULT 40 CHECK (tactical_knowledge BETWEEN 1 AND 100),
  man_management SMALLINT NOT NULL DEFAULT 40 CHECK (man_management BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS career_saves (
  id TEXT PRIMARY KEY,
  manager_id TEXT NOT NULL REFERENCES managers(id),
  club_id TEXT NOT NULL REFERENCES teams(id),
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('manager','sporting_director','chairperson')),
  game_date DATE NOT NULL DEFAULT '2026-08-01',
  season_id TEXT NOT NULL REFERENCES seasons(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','sacked','resigned','retired')),
  cash_balance BIGINT NOT NULL DEFAULT 0,
  transfer_budget BIGINT NOT NULL DEFAULT 0,
  wage_budget_weekly BIGINT NOT NULL DEFAULT 0,
  board_confidence SMALLINT NOT NULL DEFAULT 60 CHECK (board_confidence BETWEEN 0 AND 100),
  club_morale SMALLINT NOT NULL DEFAULT 60 CHECK (club_morale BETWEEN 0 AND 100),
  tactical_setup JSONB NOT NULL DEFAULT '{"formation":"4-3-3","mentality":"Normaal","passing":"Direct","pressing":false,"offside":false,"counter":false,"hardTackles":false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fixtures (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  division_id TEXT NOT NULL REFERENCES divisions(id),
  matchday SMALLINT NOT NULL,
  kickoff_date DATE NOT NULL,
  home_team_id TEXT NOT NULL REFERENCES teams(id),
  away_team_id TEXT NOT NULL REFERENCES teams(id),
  home_goals SMALLINT,
  away_goals SMALLINT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','played','postponed')),
  played_at TIMESTAMPTZ,
  UNIQUE(season_id, division_id, matchday, home_team_id, away_team_id),
  CHECK (home_team_id <> away_team_id),
  CHECK ((status = 'played' AND home_goals IS NOT NULL AND away_goals IS NOT NULL) OR status <> 'played')
);
CREATE TABLE IF NOT EXISTS player_contracts (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  club_id TEXT NOT NULL REFERENCES teams(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weekly_wage BIGINT NOT NULL DEFAULT 0,
  squad_status TEXT NOT NULL DEFAULT 'rotation' CHECK (squad_status IN ('key_player','first_team','rotation','prospect','surplus')),
  release_clause BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);
CREATE TABLE IF NOT EXISTS player_conditions (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  fitness SMALLINT NOT NULL DEFAULT 100 CHECK (fitness BETWEEN 0 AND 100),
  morale SMALLINT NOT NULL DEFAULT 60 CHECK (morale BETWEEN 0 AND 100),
  sharpness SMALLINT NOT NULL DEFAULT 50 CHECK (sharpness BETWEEN 0 AND 100),
  injury_type TEXT,
  injury_until DATE,
  suspended_until DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS transfer_windows (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  country_code TEXT NOT NULL DEFAULT 'NED',
  window_name TEXT NOT NULL,
  opens_on DATE NOT NULL,
  closes_on DATE NOT NULL,
  CHECK (closes_on >= opens_on)
);
CREATE TABLE IF NOT EXISTS transfer_offers (
  id TEXT PRIMARY KEY,
  save_id TEXT NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  buying_club_id TEXT NOT NULL REFERENCES teams(id),
  selling_club_id TEXT NOT NULL REFERENCES teams(id),
  fee BIGINT NOT NULL DEFAULT 0,
  wage_offer BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn','completed')),
  submitted_on DATE NOT NULL,
  expires_on DATE NOT NULL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS club_finances (
  id BIGSERIAL PRIMARY KEY,
  save_id TEXT NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ticketing','broadcast','sponsorship','prize_money','wages','transfer_in','transfer_out','operating_cost','stadium','youth','other')),
  description TEXT NOT NULL,
  amount BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS career_news (
  id BIGSERIAL PRIMARY KEY,
  save_id TEXT NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
  news_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('club','match','transfer','injury','finance','board','player','league')),
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS player_history (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  club_id TEXT NOT NULL REFERENCES teams(id),
  appearances SMALLINT NOT NULL DEFAULT 0,
  goals SMALLINT NOT NULL DEFAULT 0,
  assists SMALLINT NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,1),
  UNIQUE(player_id, season_id, club_id)
);
CREATE TABLE IF NOT EXISTS club_staff (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('assistant_manager','coach','fitness_coach','scout','doctor','sporting_director','chairperson')),
  reputation SMALLINT NOT NULL DEFAULT 40 CHECK (reputation BETWEEN 1 AND 100),
  wage_weekly BIGINT NOT NULL DEFAULT 0,
  employed_from DATE NOT NULL,
  employed_until DATE
);
CREATE TABLE IF NOT EXISTS career_actions (
  id BIGSERIAL PRIMARY KEY,
  save_id TEXT NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
  action_date DATE NOT NULL,
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fixtures_date ON fixtures(season_id, kickoff_date, status);
CREATE INDEX IF NOT EXISTS idx_fixtures_division_day ON fixtures(division_id, matchday);
CREATE INDEX IF NOT EXISTS idx_saves_club ON career_saves(club_id);
CREATE INDEX IF NOT EXISTS idx_news_save_date ON career_news(save_id, news_date DESC);
CREATE INDEX IF NOT EXISTS idx_finances_save_date ON club_finances(save_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_offers_save_status ON transfer_offers(save_id, status);

INSERT INTO transfer_windows(id,season_id,country_code,window_name,opens_on,closes_on) VALUES
('ned-summer-2026','2026-2027','NED','Zomertransferwindow','2026-06-16','2026-09-01'),
('ned-winter-2027','2026-2027','NED','Wintertransferwindow','2027-01-02','2027-02-02')
ON CONFLICT (id) DO NOTHING;
