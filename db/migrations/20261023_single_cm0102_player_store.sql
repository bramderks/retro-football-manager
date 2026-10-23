-- Phase 1/3: prepare a low-storage in-place table swap. Do not run the full backfill in one transaction.
DROP VIEW IF EXISTS public.all_players;

ALTER TABLE public.career_player_contracts DROP CONSTRAINT IF EXISTS career_player_contracts_player_id_fkey;
ALTER TABLE public.career_player_match_stats DROP CONSTRAINT IF EXISTS career_player_match_stats_player_id_fkey;
ALTER TABLE public.career_player_states DROP CONSTRAINT IF EXISTS career_player_states_player_id_fkey;
ALTER TABLE public.player_conditions DROP CONSTRAINT IF EXISTS player_conditions_player_id_fkey;
ALTER TABLE public.player_contracts DROP CONSTRAINT IF EXISTS player_contracts_player_id_fkey;
ALTER TABLE public.player_history DROP CONSTRAINT IF EXISTS player_history_player_id_fkey;
ALTER TABLE public.transfer_offers DROP CONSTRAINT IF EXISTS transfer_offers_player_id_fkey;
ALTER TABLE public.youth_squad_players DROP CONSTRAINT IF EXISTS youth_squad_players_promoted_player_id_fkey;
ALTER TABLE public.cm0102_player_club_assignments DROP CONSTRAINT IF EXISTS cm0102_player_club_assignments_cm_player_id_fkey;

CREATE TABLE IF NOT EXISTS public.cm0102_game_team_mappings (
  cm_club_id INTEGER PRIMARY KEY,
  team_id TEXT NOT NULL UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,
  mapping_method TEXT NOT NULL DEFAULT 'manual',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
WITH exact_candidates AS (
  SELECT c.cm_club_id,t.id AS team_id,
         ROW_NUMBER() OVER(PARTITION BY c.cm_club_id ORDER BY d.tier ASC,t.id) AS rn
  FROM public.cm0102_clubs c
  JOIN public.teams t
    ON regexp_replace(lower(c.club_name), '[^a-z0-9]', '', 'g')
     = regexp_replace(lower(t.name), '[^a-z0-9]', '', 'g')
  JOIN public.divisions d ON d.id=t.division_id AND d.season_id='2026-2027'
)
INSERT INTO public.cm0102_game_team_mappings(cm_club_id,team_id,mapping_method)
SELECT cm_club_id,team_id,'exact-normalized-name'
FROM exact_candidates WHERE rn=1
ON CONFLICT (cm_club_id) DO NOTHING;
-- Known historical/modern Dutch club-name aliases for the 2026/27 league data.
WITH aliases(team_name,cm_club_name) AS (VALUES
  ('Excelsior Rotterdam','Excelsior'),
  ('PEC Zwolle','FC Zwolle'),
  ('SC Cambuur','Cambuur Leeuwarden'),
  ('Sparta Rotterdam','Sparta'),
  ('Telstar','Stormvogels Telstar Combinatie'),
  ('FC Dordrecht','Dordrecht ´90'),
  ('FC Eindhoven','EVV Eindhoven'),
  ('FC Emmen','Emmen'),
  ('MVV Maastricht','MVV'),
  ('NAC Breda','NAC'),
  ('Roda JC Kerkrade','Roda JC'),
  ('VVV-Venlo','VVV'),
  ('Almere City FC','FC Omniworld'),
  ('Bournemouth','AFC Bournemouth'),
  ('Brighton & Hove Albion','Brighton and Hove Albion'),
  ('Athletic Club','Athletic Club de Bilbao'),
  ('CA Osasuna','Club Atlético Osasuna'),
  ('Deportivo Alavés','C.D. Alavés'),
  ('Espanyol','R.C.D. Espanyol'),
  ('FC Nantes','FC Nantes Atlantique'),
  ('LOSC Lille','Lille Olympique SC'),
  ('Olympique de Marseille','Olympique Marseille'),
  ('RC Lens','Racing Club Lens'),
  ('RC Strasbourg Alsace','Racing Club Strasbourg'),
  ('Stade de Reims','Stade de Reims Champagne'),
  ('1. FSV Mainz 05','FSV Mainz 05'),
  ('Bayer Leverkusen','Bayer 04 Leverkusen'),
  ('Bayern München','FC Bayern München'),
  ('Borussia Dortmund','BV Borussia Dortmund'),
  ('Borussia Mönchengladbach','Borussia M''gladbach'),
  ('FC St. Pauli','FC St. Pauli'),
  ('Bologna','Bologna 1909'),
  ('Inter','Internazionale'),
  ('Real Madrid','Real Madrid C.F.'),
  ('Real Betis','Real Betis Balompié'),
  ('Real Oviedo','Real Oviedo C.F.'),
  ('Real Sociedad','Real Sociedad C.F.'),
  ('Rayo Vallecano','Rayo Vallecano de Madrid'),
  ('Sevilla FC','Sevilla C.F.'),
  ('Werder Bremen','SV Werder Bremen'),
  ('Deportivo La Coruña','Deportivo de La Coruña'),
  ('Racing Santander','Racing Club de Santander'),
  ('SD Eibar','SD Eibar'),
  ('Sporting Gijón','Sporting de Gijón'),
  ('AC Ajaccio','Ajaccio AC'),
  ('AS Saint-Étienne','AS Saint-Etienne'),
  ('Clermont Foot','Clermont Foot Auvergne'),
  ('EA Guingamp','En Avant Guingamp'),
  ('ESTAC Troyes','Es.Troyes Aube Champagne'),
  ('Red Star FC','Red Star 93'),
  ('SC Bastia','Sporting Club Bastia'),
  ('SM Caen','Stade Malherbe de Caen'),
  ('Dynamo Dresden','1.FC Dynamo Dresden'),
  ('Eintracht Braunschweig','TSV Eintracht Braunschweig'),
  ('Energie Cottbus','FC Energie Cottbus'),
  ('Hertha BSC','Hertha BSC Berlin'),
  ('Holstein Kiel','KSV Holstein Kiel'),
  ('VfL Wolfsburg','VfL Wolfsburg'),
  ('Cittadella','Cittadella Padova'),
  ('Juve Stabia','SS Juve Stabia'),
  ('Mantova','Mantova 1994'),
  ('Palermo','Città di Palermo'),
  ('Spezia','Spezia 1906'),
  ('Sudtirol','F.C. Sudtirol Alto Adige')
) , alias_candidates AS (
  SELECT c.cm_club_id,t.id AS team_id,
         ROW_NUMBER() OVER(PARTITION BY c.cm_club_id ORDER BY d.tier ASC,t.id) AS rn
  FROM aliases a
  JOIN public.teams t ON t.name=a.team_name
  JOIN public.divisions d ON d.id=t.division_id AND d.season_id='2026-2027'
  JOIN public.cm0102_clubs c ON lower(c.club_name)=lower(a.cm_club_name)
)
INSERT INTO public.cm0102_game_team_mappings(cm_club_id,team_id,mapping_method)
SELECT cm_club_id,team_id,'manual-alias' FROM alias_candidates WHERE rn=1
ON CONFLICT DO NOTHING;

ALTER TABLE public.players RENAME TO legacy_players;
ALTER TABLE public.cm0102_player_profiles DROP CONSTRAINT IF EXISTS cm0102_player_profiles_pkey;
ALTER TABLE public.cm0102_player_profiles ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.cm0102_player_profiles RENAME TO players;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS team_id TEXT REFERENCES public.teams(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS known_as TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS position TEXT NOT NULL DEFAULT 'CM',
  ADD COLUMN IF NOT EXISTS shirt_number SMALLINT,
  ADD COLUMN IF NOT EXISTS overall_rating SMALLINT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS potential_rating SMALLINT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_checked_at DATE,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS career_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS retired_on DATE,
  ADD COLUMN IF NOT EXISTS development_bias SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'cm0102',
  ADD COLUMN IF NOT EXISTS source_cm_player_id INTEGER,
  ADD COLUMN IF NOT EXISTS source_world_player_id TEXT,
  ADD COLUMN IF NOT EXISTS source_cm_staff_id INTEGER,
  ADD COLUMN IF NOT EXISTS source_cm_club_id INTEGER,
  ADD COLUMN IF NOT EXISTS source_cm_nationality_id INTEGER,
  ADD COLUMN IF NOT EXISTS source_cm_second_nationality_id INTEGER,
  ADD COLUMN IF NOT EXISTS source_current_ability SMALLINT,
  ADD COLUMN IF NOT EXISTS source_potential_ability SMALLINT,
  ADD COLUMN IF NOT EXISTS source_original_potential_ability SMALLINT,
  ADD COLUMN IF NOT EXISTS source_pa_resolution_rule TEXT,
  ADD COLUMN IF NOT EXISTS source_club_name TEXT,
  ADD COLUMN IF NOT EXISTS source_positions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_current_ability_stars NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS source_potential_ability_stars NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS source_randomize_zero_attributes BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS source_version TEXT;

ALTER TABLE public.players DROP CONSTRAINT IF EXISTS cm0102_player_profiles_preferred_foot_check;
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_position_check;
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_preferred_foot_check;
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_overall_rating_check;
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_potential_rating_check;
ALTER TABLE public.players ADD CONSTRAINT players_position_check CHECK (position = ANY (ARRAY[
  'GK','LB','CV','RB','VM','CM','LM','RM','AM','AML','AMR','LA','RA','SP','CB','DM','LWB','RWB','LW','RW','ST'
]::text[]));
ALTER TABLE public.players ADD CONSTRAINT players_overall_rating_check CHECK (overall_rating BETWEEN 1 AND 100);
ALTER TABLE public.players ADD CONSTRAINT players_potential_rating_check CHECK (potential_rating BETWEEN 1 AND 100);
