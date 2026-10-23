-- Consolidate CM 01/02 records into the existing canonical public.players table.
-- Existing save-local state/contracts/statistics keep referencing players.id.
ALTER TABLE public.players ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS source_cm_staff_id INTEGER,
  ADD COLUMN IF NOT EXISTS source_cm_club_id INTEGER,
  ADD COLUMN IF NOT EXISTS source_cm_nationality_id INTEGER,
  ADD COLUMN IF NOT EXISTS source_cm_second_nationality_id INTEGER,
  ADD COLUMN IF NOT EXISTS source_current_ability SMALLINT,
  ADD COLUMN IF NOT EXISTS source_potential_ability SMALLINT,
  ADD COLUMN IF NOT EXISTS source_original_potential_ability SMALLINT,
  ADD COLUMN IF NOT EXISTS source_pa_resolution_rule TEXT,
  ADD COLUMN IF NOT EXISTS source_foot_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_sides JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_current_ability_stars NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS source_potential_ability_stars NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS source_randomize_zero_attributes BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS source_version TEXT;

CREATE TABLE IF NOT EXISTS public.cm0102_game_team_mappings (
  cm_club_id INTEGER PRIMARY KEY,
  team_id TEXT NOT NULL UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,
  mapping_method TEXT NOT NULL DEFAULT 'manual',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Match exact normalized names only; ambiguous/non-matching CM clubs require an explicit mapping.
INSERT INTO public.cm0102_game_team_mappings(cm_club_id, team_id, mapping_method)
SELECT c.cm_club_id, t.id, 'exact-normalized-name'
FROM public.cm0102_clubs c
JOIN public.teams t
  ON regexp_replace(lower(c.club_name), '[^a-z0-9]', '', 'g')
   = regexp_replace(lower(t.name), '[^a-z0-9]', '', 'g')
ON CONFLICT (cm_club_id) DO NOTHING;

-- Free the exact team/name slot before inserting the CM record; old references remain valid but inactive.
UPDATE public.players old
SET team_id = NULL, is_active = FALSE, career_status = 'inactive'
WHERE old.source_cm_player_id IS NULL
  AND old.team_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.cm0102_player_profiles cp
    JOIN public.cm0102_player_club_assignments a ON a.cm_player_id = cp.cm_player_id
    JOIN public.cm0102_game_team_mappings m ON m.cm_club_id = a.cm_club_id
    WHERE m.team_id = old.team_id
      AND lower(BTRIM(cp.full_name)) = lower(BTRIM(old.full_name))
  );

-- Move all imported profiles into players, preserving raw CM attributes and CA/PA.
INSERT INTO public.players (
  id, team_id, full_name, known_as, date_of_birth, nationality, position,
  preferred_foot, overall_rating, potential_rating, source_url, source_checked_at,
  is_active, career_status, source_type, source_cm_player_id, source_cm_staff_id,
  source_cm_club_id, source_cm_nationality_id, source_cm_second_nationality_id,
  source_current_ability, source_potential_ability, source_original_potential_ability,
  source_pa_resolution_rule, source_club_name, source_positions, source_sides, source_attributes,
  source_foot_attributes, source_current_ability_stars, source_potential_ability_stars,
  source_randomize_zero_attributes, source_version
)
SELECT
  'cm0102-' || cp.cm_player_id::text,
  CASE WHEN m.team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.players existing
    WHERE existing.team_id = m.team_id
      AND lower(BTRIM(existing.full_name)) = lower(BTRIM(cp.full_name))
      AND existing.source_cm_player_id IS NULL AND existing.is_active = TRUE
  ) THEN m.team_id ELSE NULL END,
  cp.full_name, NULLIF(BTRIM(cp.common_name), ''), cp.date_of_birth, NULL,
  CASE
    WHEN cp.positions ? 'goalkeeper' THEN 'GK'
    WHEN cp.positions ? 'left_back' THEN 'LB'
    WHEN cp.positions ? 'right_back' THEN 'RB'
    WHEN cp.positions ? 'defender' THEN 'CV'
    WHEN cp.positions ? 'defensive_midfielder' THEN 'VM'
    WHEN cp.positions ? 'attacking_midfielder' THEN 'AM'
    WHEN cp.positions ? 'left_wing' THEN 'AML'
    WHEN cp.positions ? 'right_wing' THEN 'AMR'
    WHEN cp.positions ? 'attacker' OR cp.positions ? 'striker' THEN 'SP'
    ELSE 'CM'
  END,
  CASE WHEN cp.preferred_foot IN ('left','right','both') THEN cp.preferred_foot ELSE NULL END,
  GREATEST(1, LEAST(100, ROUND(30 + COALESCE(cp.current_ability, 0) * 0.345)::int)),
  GREATEST(1, LEAST(100, ROUND(30 + COALESCE(cp.potential_ability, 0) * 0.345)::int)),
  NULL, cp.imported_at::date, TRUE, 'active', 'cm0102', cp.cm_player_id, cp.cm_staff_id,
  a.cm_club_id, cp.nationality_id, cp.second_nationality_id, cp.current_ability,
  cp.potential_ability, cp.source_potential_ability, cp.pa_resolution_rule, c.club_name,
  COALESCE(cp.positions, '[]'::jsonb), COALESCE(cp.sides, '[]'::jsonb), COALESCE(cp.attributes, '{}'::jsonb),
  COALESCE(cp.foot_attributes, '{}'::jsonb), cp.current_ability_stars,
  cp.potential_ability_stars, COALESCE(cp.randomize_zero_attributes, TRUE), cp.source_version
FROM public.cm0102_player_profiles cp
LEFT JOIN public.cm0102_player_club_assignments a ON a.cm_player_id = cp.cm_player_id
LEFT JOIN public.cm0102_clubs c ON c.cm_club_id = a.cm_club_id
LEFT JOIN public.cm0102_game_team_mappings m ON m.cm_club_id = a.cm_club_id
WHERE COALESCE(BTRIM(cp.full_name), '') <> ''
ON CONFLICT (source_cm_player_id) WHERE source_cm_player_id IS NOT NULL DO UPDATE SET
  full_name=EXCLUDED.full_name,
  known_as=EXCLUDED.known_as,
  date_of_birth=EXCLUDED.date_of_birth,
  position=EXCLUDED.position,
  preferred_foot=EXCLUDED.preferred_foot,
  overall_rating=EXCLUDED.overall_rating,
  potential_rating=EXCLUDED.potential_rating,
  is_active=TRUE,
  career_status='active',
  source_type='cm0102',
  source_cm_staff_id=EXCLUDED.source_cm_staff_id,
  source_cm_club_id=EXCLUDED.source_cm_club_id,
  source_cm_nationality_id=EXCLUDED.source_cm_nationality_id,
  source_cm_second_nationality_id=EXCLUDED.source_cm_second_nationality_id,
  source_current_ability=EXCLUDED.source_current_ability,
  source_potential_ability=EXCLUDED.source_potential_ability,
  source_original_potential_ability=EXCLUDED.source_original_potential_ability,
  source_pa_resolution_rule=EXCLUDED.source_pa_resolution_rule,
  source_club_name=EXCLUDED.source_club_name,
  source_positions=EXCLUDED.source_positions,
  source_sides=EXCLUDED.source_sides,
  source_attributes=EXCLUDED.source_attributes,
  source_foot_attributes=EXCLUDED.source_foot_attributes,
  source_current_ability_stars=EXCLUDED.source_current_ability_stars,
  source_potential_ability_stars=EXCLUDED.source_potential_ability_stars,
  source_randomize_zero_attributes=EXCLUDED.source_randomize_zero_attributes,
  source_version=EXCLUDED.source_version;

-- Assign mapped CM records to their game club, without retaining a second player source.
UPDATE public.players cm
SET team_id=m.team_id, source_cm_club_id=a.cm_club_id, source_club_name=t.name,
    source_type='cm0102', is_active=TRUE, career_status='active'
FROM public.cm0102_player_club_assignments a
JOIN public.cm0102_game_team_mappings m ON m.cm_club_id=a.cm_club_id
JOIN public.teams t ON t.id=m.team_id
WHERE cm.source_cm_player_id=a.cm_player_id
  AND NOT EXISTS (
    SELECT 1 FROM public.players other
    WHERE other.team_id=m.team_id AND other.id<>cm.id
      AND other.is_active=TRUE
      AND lower(BTRIM(other.full_name))=lower(BTRIM(cm.full_name))
  );

INSERT INTO public.career_player_states(save_id,player_id,club_id,current_rating,potential_rating)
SELECT s.id,p.id,p.team_id,p.overall_rating,p.potential_rating
FROM public.career_saves s CROSS JOIN public.players p
WHERE p.source_cm_player_id IS NOT NULL AND p.team_id IS NOT NULL
ON CONFLICT(save_id,player_id) DO NOTHING;

-- Keep the compatibility view, but make it a projection of the one canonical players table.
CREATE OR REPLACE VIEW public.all_players AS
SELECT p.id, p.team_id, p.full_name, p.known_as, p.date_of_birth, p.nationality,
       p.position, p.shirt_number, p.preferred_foot, p.overall_rating, p.potential_rating,
       p.source_url, p.source_checked_at, p.is_active, p.career_status, p.retired_on,
       p.source_type, p.source_cm_player_id, p.source_world_player_id,
       COALESCE(p.source_club_name, t.name) AS club_name,
       p.source_positions, p.source_attributes,
       CASE WHEN p.source_type='world_roster' THEN 'world_roster'
            WHEN p.source_type='cm0102' THEN 'cm0102' ELSE 'current' END AS record_source
FROM public.players p
LEFT JOIN public.teams t ON t.id=p.team_id;

DROP TABLE public.cm0102_player_profiles;
