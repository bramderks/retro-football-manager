-- Consolidate CM 01/02 records into the canonical public.players table without copying the 139k-row profile store.
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
INSERT INTO public.cm0102_game_team_mappings(cm_club_id, team_id, mapping_method)
SELECT c.cm_club_id, t.id, 'exact-normalized-name'
FROM public.cm0102_clubs c
JOIN public.teams t
  ON regexp_replace(lower(c.club_name), '[^a-z0-9]', '', 'g')
   = regexp_replace(lower(t.name), '[^a-z0-9]', '', 'g')
ON CONFLICT (cm_club_id) DO NOTHING;

ALTER TABLE public.players RENAME TO legacy_players;
ALTER TABLE public.cm0102_player_profiles DROP CONSTRAINT IF EXISTS cm0102_player_profiles_pkey;
ALTER TABLE public.cm0102_player_profiles ADD COLUMN IF NOT EXISTS id TEXT;
UPDATE public.cm0102_player_profiles SET id='cm0102-' || cm_player_id::text WHERE id IS NULL;
ALTER TABLE public.cm0102_player_profiles ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.cm0102_player_profiles ADD CONSTRAINT cm0102_profiles_id_key UNIQUE(id);
ALTER TABLE public.cm0102_player_profiles RENAME TO players;

-- Extend the CM table in place. Keep raw JSON attributes in their original columns to avoid duplicating 238 MB of data.
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
ALTER TABLE public.players ADD CONSTRAINT canonical_players_pkey PRIMARY KEY(id);
ALTER TABLE public.players ADD CONSTRAINT players_position_check CHECK (position = ANY (ARRAY[
  'GK','LB','CV','RB','VM','CM','LM','RM','AM','AML','AMR','LA','RA','SP','CB','DM','LWB','RWB','LW','RW','ST'
]::text[]));
ALTER TABLE public.players ADD CONSTRAINT players_preferred_foot_check CHECK (preferred_foot IS NULL OR preferred_foot = ANY (ARRAY['left','right','both']::text[]));
ALTER TABLE public.players ADD CONSTRAINT players_overall_rating_check CHECK (overall_rating BETWEEN 1 AND 100);
ALTER TABLE public.players ADD CONSTRAINT players_potential_rating_check CHECK (potential_rating BETWEEN 1 AND 100);
UPDATE public.players SET preferred_foot=NULL WHERE preferred_foot='unknown';

UPDATE public.players
SET source_cm_player_id=cm_player_id,
    known_as=NULLIF(BTRIM(common_name),''),
    source_type='cm0102',
    source_current_ability=current_ability,
    source_potential_ability=potential_ability,
    source_original_potential_ability=source_potential_ability,
    source_cm_staff_id=cm_staff_id,
    source_cm_nationality_id=nationality_id,
    source_cm_second_nationality_id=second_nationality_id,
    source_pa_resolution_rule=pa_resolution_rule,
    source_current_ability_stars=current_ability_stars,
    source_potential_ability_stars=potential_ability_stars,
    source_randomize_zero_attributes=COALESCE(randomize_zero_attributes,TRUE),
    source_version=source_version,
    overall_rating=GREATEST(1,LEAST(100,ROUND(30 + COALESCE(current_ability,0)*0.345)::int)),
    potential_rating=GREATEST(1,LEAST(100,ROUND(30 + COALESCE(potential_ability,0)*0.345)::int)),
    position=CASE
      WHEN positions ? 'goalkeeper' THEN 'GK'
      WHEN positions ? 'left_back' THEN 'LB'
      WHEN positions ? 'right_back' THEN 'RB'
      WHEN positions ? 'defender' THEN 'CV'
      WHEN positions ? 'defensive_midfielder' THEN 'VM'
      WHEN positions ? 'attacking_midfielder' THEN 'AM'
      WHEN positions ? 'left_wing' THEN 'AML'
      WHEN positions ? 'right_wing' THEN 'AMR'
      WHEN positions ? 'attacker' OR positions ? 'striker' THEN 'SP'
      ELSE 'CM'
    END,
    is_active=TRUE,
    career_status='active';

-- Keep CM IDs as source_cm_player_id and allow the old CM-only import ID column to disappear.
ALTER TABLE public.players ADD CONSTRAINT players_source_cm_player_id_key UNIQUE(source_cm_player_id);
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS cm0102_profiles_cm_player_id_key;
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS cm0102_player_profiles_cm_player_id_key;
ALTER TABLE public.players DROP COLUMN cm_player_id;

-- Copy the small legacy game roster; CM source attributes remain in the existing positions/sides/attributes/foot_attributes columns.
INSERT INTO public.players (
  id,team_id,full_name,known_as,date_of_birth,nationality,position,shirt_number,preferred_foot,
  overall_rating,potential_rating,source_url,source_checked_at,is_active,created_at,career_status,
  retired_on,development_bias,source_type,source_cm_player_id,source_world_player_id,
  source_club_name,source_positions,source_attributes
)
SELECT
  old.id,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.players cm
    JOIN public.cm0102_player_club_assignments a ON a.cm_player_id=cm.source_cm_player_id
    JOIN public.cm0102_game_team_mappings m ON m.cm_club_id=a.cm_club_id
    WHERE m.team_id=old.team_id AND lower(BTRIM(cm.full_name))=lower(BTRIM(old.full_name))
  ) THEN NULL ELSE old.team_id END,
  old.full_name,old.known_as,old.date_of_birth,old.nationality,old.position,old.shirt_number,
  old.preferred_foot,old.overall_rating,old.potential_rating,old.source_url,old.source_checked_at,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.players cm
    JOIN public.cm0102_player_club_assignments a ON a.cm_player_id=cm.source_cm_player_id
    JOIN public.cm0102_game_team_mappings m ON m.cm_club_id=a.cm_club_id
    WHERE m.team_id=old.team_id AND lower(BTRIM(cm.full_name))=lower(BTRIM(old.full_name))
  ) THEN FALSE ELSE old.is_active END,
  old.created_at,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.players cm
    JOIN public.cm0102_player_club_assignments a ON a.cm_player_id=cm.source_cm_player_id
    JOIN public.cm0102_game_team_mappings m ON m.cm_club_id=a.cm_club_id
    WHERE m.team_id=old.team_id AND lower(BTRIM(cm.full_name))=lower(BTRIM(old.full_name))
  ) THEN 'inactive' ELSE old.career_status END,
  old.retired_on,old.development_bias,old.source_type,old.source_cm_player_id,
  old.source_world_player_id,old.source_club_name,old.source_positions,old.source_attributes
FROM public.legacy_players old
ON CONFLICT (id) DO NOTHING;

UPDATE public.players cm
SET source_cm_club_id=a.cm_club_id,
    source_club_name=c.club_name,
    team_id=m.team_id
FROM public.cm0102_player_club_assignments a
LEFT JOIN public.cm0102_clubs c ON c.cm_club_id=a.cm_club_id
LEFT JOIN public.cm0102_game_team_mappings m ON m.cm_club_id=a.cm_club_id
WHERE cm.source_cm_player_id=a.cm_player_id;

ALTER TABLE public.legacy_players DROP CONSTRAINT IF EXISTS players_team_id_full_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS players_team_id_full_name_non_cm_uq
  ON public.players(team_id,full_name) WHERE source_cm_player_id IS NULL;
DROP TABLE public.legacy_players;

ALTER TABLE public.career_player_contracts ADD CONSTRAINT career_player_contracts_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;
ALTER TABLE public.career_player_match_stats ADD CONSTRAINT career_player_match_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;
ALTER TABLE public.career_player_states ADD CONSTRAINT career_player_states_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;
ALTER TABLE public.player_conditions ADD CONSTRAINT player_conditions_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;
ALTER TABLE public.player_contracts ADD CONSTRAINT player_contracts_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;
ALTER TABLE public.player_history ADD CONSTRAINT player_history_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;
ALTER TABLE public.transfer_offers ADD CONSTRAINT transfer_offers_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id);
ALTER TABLE public.youth_squad_players ADD CONSTRAINT youth_squad_players_promoted_player_id_fkey FOREIGN KEY (promoted_player_id) REFERENCES public.players(id) ON DELETE SET NULL;
ALTER TABLE public.cm0102_player_club_assignments ADD CONSTRAINT cm0102_player_club_assignments_cm_player_id_fkey FOREIGN KEY (cm_player_id) REFERENCES public.players(source_cm_player_id) ON DELETE CASCADE;

INSERT INTO public.career_player_states(save_id,player_id,club_id,current_rating,potential_rating)
SELECT s.id,p.id,p.team_id,p.overall_rating,p.potential_rating
FROM public.career_saves s CROSS JOIN public.players p
WHERE p.source_cm_player_id IS NOT NULL AND p.team_id IS NOT NULL
ON CONFLICT(save_id,player_id) DO NOTHING;

CREATE OR REPLACE VIEW public.all_players AS
SELECT p.id,p.team_id,p.full_name,p.known_as,p.date_of_birth,p.nationality,p.position,
       p.shirt_number,p.preferred_foot,p.overall_rating,p.potential_rating,p.source_url,
       p.source_checked_at,p.is_active,p.career_status,p.retired_on,p.source_type,
       p.source_cm_player_id,p.source_world_player_id,
       COALESCE(p.source_club_name,t.name) AS club_name,
       CASE WHEN p.source_type='cm0102' THEN p.positions ELSE p.source_positions END AS source_positions,
       CASE WHEN p.source_type='cm0102' THEN p.attributes ELSE p.source_attributes END AS source_attributes,
       CASE WHEN p.source_type='world_roster' THEN 'world_roster'
            WHEN p.source_type='cm0102' THEN 'cm0102' ELSE 'current' END AS record_source
FROM public.players p
LEFT JOIN public.teams t ON t.id=p.team_id;
