-- Make public.players the single canonical player store, including the CM 01/02 source data.
-- Career state, contracts and match statistics continue to reference players.id.
ALTER TABLE public.players ALTER COLUMN team_id DROP NOT NULL;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS cm_player_id BIGINT,
  ADD COLUMN IF NOT EXISTS cm_staff_id BIGINT,
  ADD COLUMN IF NOT EXISTS cm_club_id INTEGER,
  ADD COLUMN IF NOT EXISTS cm_nationality_id INTEGER,
  ADD COLUMN IF NOT EXISTS cm_second_nationality_id INTEGER,
  ADD COLUMN IF NOT EXISTS cm_current_ability SMALLINT,
  ADD COLUMN IF NOT EXISTS cm_potential_ability SMALLINT,
  ADD COLUMN IF NOT EXISTS cm_source_potential_ability SMALLINT,
  ADD COLUMN IF NOT EXISTS cm_pa_resolution_rule TEXT,
  ADD COLUMN IF NOT EXISTS cm_positions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cm_sides JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cm_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cm_foot_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cm_current_ability_stars NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS cm_potential_ability_stars NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS cm_randomize_zero_attributes BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS source_version TEXT,
  ADD COLUMN IF NOT EXISTS record_source TEXT NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS club_name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_cm_player_id_unique
  ON public.players(cm_player_id) WHERE cm_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_cm_free_transfer
  ON public.players(cm_player_id, full_name) WHERE cm_player_id IS NOT NULL AND is_active = TRUE;

-- Mapping layer joins CM club IDs to the game's club IDs without creating a second player table.
CREATE TABLE IF NOT EXISTS public.cm0102_game_team_mappings (
  cm_club_id INTEGER PRIMARY KEY,
  team_id TEXT NOT NULL UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,
  mapping_method TEXT NOT NULL DEFAULT 'manual',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing CM import data is moved into players, preserving raw CM values and IDs.
-- Do not overwrite save-local contract/condition records.
INSERT INTO public.players (
  id, team_id, full_name, known_as, date_of_birth, nationality, position,
  preferred_foot, overall_rating, potential_rating, source_url, source_checked_at,
  is_active, career_status, record_source, club_name, cm_player_id, cm_staff_id,
  cm_nationality_id, cm_second_nationality_id, cm_current_ability, cm_potential_ability,
  cm_source_potential_ability, cm_pa_resolution_rule, cm_positions, cm_sides,
  cm_attributes, cm_foot_attributes, cm_current_ability_stars, cm_potential_ability_stars,
  cm_randomize_zero_attributes, source_version
)
SELECT
  'cm0102-' || p.cm_player_id::text, NULL,
  COALESCE(NULLIF(BTRIM(p.common_name), ''), NULLIF(BTRIM(p.full_name), '')),
  NULLIF(BTRIM(p.common_name), ''),
  p.date_of_birth, NULL,
  CASE
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('GK','K','KEEPER','GOALKEEPER') THEN 'GK'
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('DL','LB','LV') THEN 'LB'
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('DR','RB','RV') THEN 'RB'
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('DC','CB','CV') THEN 'CV'
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('DMC','DM','VM') THEN 'VM'
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('MC','CM') THEN 'CM'
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('ML','LM') THEN 'LM'
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('MR','RM') THEN 'RM'
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('AMC','AM') THEN 'AM'
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('AML','MLF','LW') THEN 'AML'
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('AMR','MRF','RW') THEN 'AMR'
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('FC','ST','SC') THEN 'SP'
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('DLF','LWF','LA') THEN 'LA'
    WHEN UPPER(COALESCE(p.positions->>0, '')) IN ('DRF','RWF','RA') THEN 'RA'
    ELSE 'SP'
  END,
  CASE WHEN LOWER(p.preferred_foot) IN ('left','right','both') THEN LOWER(p.preferred_foot) ELSE NULL END,
  GREATEST(1, LEAST(100, ROUND(p.current_ability / 2.0)::int)),
  GREATEST(1, LEAST(100, ROUND(p.potential_ability / 2.0)::int)),
  NULL, CURRENT_DATE, TRUE, 'active', 'cm0102', NULL, p.cm_player_id, p.cm_staff_id,
  p.nationality_id, p.second_nationality_id, p.current_ability, p.potential_ability,
  p.source_potential_ability, p.pa_resolution_rule, COALESCE(p.positions, '[]'::jsonb),
  COALESCE(p.sides, '[]'::jsonb), COALESCE(p.attributes, '{}'::jsonb),
  COALESCE(p.foot_attributes, '{}'::jsonb), p.current_ability_stars,
  p.potential_ability_stars, COALESCE(p.randomize_zero_attributes, TRUE), p.source_version
FROM public.cm0102_player_profiles p
WHERE COALESCE(BTRIM(p.full_name), '') <> ''
ON CONFLICT (cm_player_id) WHERE cm_player_id IS NOT NULL DO UPDATE SET
  full_name=EXCLUDED.full_name,
  known_as=EXCLUDED.known_as,
  date_of_birth=EXCLUDED.date_of_birth,
  position=EXCLUDED.position,
  preferred_foot=EXCLUDED.preferred_foot,
  overall_rating=EXCLUDED.overall_rating,
  potential_rating=EXCLUDED.potential_rating,
  cm_staff_id=EXCLUDED.cm_staff_id,
  cm_nationality_id=EXCLUDED.cm_nationality_id,
  cm_second_nationality_id=EXCLUDED.cm_second_nationality_id,
  cm_current_ability=EXCLUDED.cm_current_ability,
  cm_potential_ability=EXCLUDED.cm_potential_ability,
  cm_source_potential_ability=EXCLUDED.cm_source_potential_ability,
  cm_pa_resolution_rule=EXCLUDED.cm_pa_resolution_rule,
  cm_positions=EXCLUDED.cm_positions,
  cm_sides=EXCLUDED.cm_sides,
  cm_attributes=EXCLUDED.cm_attributes,
  cm_foot_attributes=EXCLUDED.cm_foot_attributes,
  cm_current_ability_stars=EXCLUDED.cm_current_ability_stars,
  cm_potential_ability_stars=EXCLUDED.cm_potential_ability_stars,
  cm_randomize_zero_attributes=EXCLUDED.cm_randomize_zero_attributes,
  source_version=EXCLUDED.source_version,
  record_source='cm0102';

-- Only exact normalized club-name matches are automated; ambiguous mappings stay unmapped.
INSERT INTO public.cm0102_game_team_mappings(cm_club_id, team_id, mapping_method)
SELECT c.cm_club_id, t.id, 'exact-normalized-name'
FROM public.cm0102_clubs c
JOIN public.teams t
  ON regexp_replace(lower(c.club_name), '[^a-z0-9]', '', 'g')
   = regexp_replace(lower(t.name), '[^a-z0-9]', '', 'g')
ON CONFLICT (cm_club_id) DO NOTHING;

-- Retire duplicate non-CM seed rows when a canonical CM record can take their exact club/name slot.
UPDATE public.players old
SET team_id = NULL, is_active = FALSE, career_status = 'inactive'
WHERE old.cm_player_id IS NULL
  AND old.team_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.players cm
    JOIN public.cm0102_player_club_assignments a ON a.cm_player_id = cm.cm_player_id
    JOIN public.cm0102_game_team_mappings m ON m.cm_club_id = a.cm_club_id
    WHERE cm.cm_player_id IS NOT NULL
      AND m.team_id = old.team_id
      AND lower(BTRIM(cm.full_name)) = lower(BTRIM(old.full_name))
  );

UPDATE public.players cm
SET cm_club_id = a.cm_club_id,
    team_id = m.team_id,
    club_name = t.name,
    record_source = 'cm0102',
    is_active = TRUE,
    career_status = 'active'
FROM public.cm0102_player_club_assignments a
JOIN public.cm0102_game_team_mappings m ON m.cm_club_id = a.cm_club_id
JOIN public.teams t ON t.id = m.team_id
WHERE cm.cm_player_id = a.cm_player_id
  AND cm.cm_player_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.players other
    WHERE other.team_id = m.team_id
      AND lower(BTRIM(other.full_name)) = lower(BTRIM(cm.full_name))
      AND other.id <> cm.id
      AND other.is_active = TRUE
  );
