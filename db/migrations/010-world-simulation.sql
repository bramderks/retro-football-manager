-- Career-world simulation foundations
ALTER TABLE players ADD COLUMN IF NOT EXISTS career_status text NOT NULL DEFAULT 'active';
ALTER TABLE players ADD COLUMN IF NOT EXISTS retired_on date;
ALTER TABLE players ADD COLUMN IF NOT EXISTS development_bias smallint NOT NULL DEFAULT 0;
ALTER TABLE managers ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE managers ADD COLUMN IF NOT EXISTS career_status text NOT NULL DEFAULT 'active';
ALTER TABLE managers ADD COLUMN IF NOT EXISTS career_role text NOT NULL DEFAULT 'manager';
ALTER TABLE managers ADD COLUMN IF NOT EXISTS retired_on date;
ALTER TABLE club_staff ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE club_staff ADD COLUMN IF NOT EXISTS career_status text NOT NULL DEFAULT 'active';
ALTER TABLE club_staff ADD COLUMN IF NOT EXISTS career_path text NOT NULL DEFAULT 'staff';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS stadium_name text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS stadium_capacity integer;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS ticket_price numeric(8,2);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS season_budget bigint NOT NULL DEFAULT 0;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS annual_revenue bigint NOT NULL DEFAULT 0;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS annual_wage_bill bigint NOT NULL DEFAULT 0;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS debt bigint NOT NULL DEFAULT 0;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS financial_tier text NOT NULL DEFAULT 'stable';
CREATE TABLE IF NOT EXISTS world_roster_players (
 id text PRIMARY KEY,
 club_id text NOT NULL REFERENCES uefa_clubs(id) ON DELETE CASCADE,
 full_name text NOT NULL,
 date_of_birth date NOT NULL,
 nationality text,
 position text NOT NULL CHECK(position IN ('GK','RB','CB','LB','RWB','LWB','DM','CM','AM','RW','LW','ST')),
 overall_rating smallint NOT NULL DEFAULT 50 CHECK(overall_rating BETWEEN 1 AND 100),
 potential_rating smallint NOT NULL DEFAULT 60 CHECK(potential_rating BETWEEN 1 AND 100),
 career_status text NOT NULL DEFAULT 'active',
 retired_on date,
 is_fictional boolean NOT NULL DEFAULT true,
 UNIQUE(club_id,full_name)
);
CREATE INDEX IF NOT EXISTS idx_world_roster_club_active ON world_roster_players(club_id,career_status);
CREATE TABLE IF NOT EXISTS team_season_history (
 id text PRIMARY KEY,
 team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
 season_id text NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
 division_id text NOT NULL REFERENCES divisions(id),
 final_position smallint,
 promoted boolean NOT NULL DEFAULT false,
 relegated boolean NOT NULL DEFAULT false,
 points integer NOT NULL DEFAULT 0,
 UNIQUE(team_id,season_id)
);
CREATE TABLE IF NOT EXISTS world_person_history (
 id bigserial PRIMARY KEY,
 person_type text NOT NULL,
 person_id text NOT NULL,
 season_id text NOT NULL,
 event_type text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stadiums (
 id text PRIMARY KEY,
 team_id text UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
 name text NOT NULL,
 city text NOT NULL,
 capacity integer NOT NULL CHECK(capacity > 0),
 ticket_price numeric(8,2) NOT NULL CHECK(ticket_price >= 0),
 hospitality_price numeric(8,2) NOT NULL DEFAULT 0,
 annual_maintenance bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS world_financial_profiles (
 team_id text PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
 season_id text NOT NULL REFERENCES seasons(id),
 cash_balance bigint NOT NULL DEFAULT 0,
 transfer_budget bigint NOT NULL DEFAULT 0,
 annual_revenue bigint NOT NULL DEFAULT 0,
 annual_wages bigint NOT NULL DEFAULT 0,
 debt bigint NOT NULL DEFAULT 0,
 ticket_price numeric(8,2) NOT NULL DEFAULT 20,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS world_financial_events (
 id bigserial PRIMARY KEY,
 team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
 season_id text NOT NULL,
 event_date date NOT NULL,
 category text NOT NULL,
 description text NOT NULL,
 amount bigint NOT NULL,
 balance_after bigint NOT NULL DEFAULT 0,
 UNIQUE(team_id,season_id,event_date,category,description)
);
CREATE TABLE IF NOT EXISTS world_season_runs (
 season_id text PRIMARY KEY,
 previous_season_id text NOT NULL,
 status text NOT NULL DEFAULT 'started',
 teams_processed integer NOT NULL DEFAULT 0,
 players_added integer NOT NULL DEFAULT 0,
 people_aged integer NOT NULL DEFAULT 0,
 promoted integer NOT NULL DEFAULT 0,
 relegated integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz
);
