-- Phase 2/3: run this statement repeatedly until it updates 0 rows.
-- Keep each batch small and commit between calls. VACUUM (ANALYZE) public.players after every 4-6 batches.
WITH todo AS (
  SELECT ctid
  FROM public.players
  WHERE id IS NULL
  ORDER BY cm_player_id
  LIMIT 3000
  FOR UPDATE SKIP LOCKED
)
UPDATE public.players p
SET id='cm0102-' || p.cm_player_id::text,
    source_cm_player_id=p.cm_player_id,
    known_as=NULLIF(BTRIM(p.common_name),''),
    source_type='cm0102',
    source_current_ability=p.current_ability,
    source_potential_ability=p.potential_ability,
    source_original_potential_ability=p.source_potential_ability,
    source_cm_staff_id=p.cm_staff_id,
    source_cm_nationality_id=p.nationality_id,
    source_cm_second_nationality_id=p.second_nationality_id,
    source_pa_resolution_rule=p.pa_resolution_rule,
    source_current_ability_stars=p.current_ability_stars,
    source_potential_ability_stars=p.potential_ability_stars,
    source_randomize_zero_attributes=COALESCE(p.randomize_zero_attributes,TRUE),
    source_version=p.source_version,
    overall_rating=GREATEST(1,LEAST(100,ROUND(30 + COALESCE(p.current_ability,0)*0.345)::int)),
    potential_rating=GREATEST(1,LEAST(100,ROUND(30 + COALESCE(p.potential_ability,0)*0.345)::int)),
    position=CASE
      WHEN p.positions ? 'goalkeeper' THEN 'GK'
      WHEN p.positions ? 'left_back' THEN 'LB'
      WHEN p.positions ? 'right_back' THEN 'RB'
      WHEN p.positions ? 'defender' THEN 'CV'
      WHEN p.positions ? 'defensive_midfielder' THEN 'VM'
      WHEN p.positions ? 'attacking_midfielder' THEN 'AM'
      WHEN p.positions ? 'left_wing' THEN 'AML'
      WHEN p.positions ? 'right_wing' THEN 'AMR'
      WHEN p.positions ? 'attacker' OR p.positions ? 'striker' THEN 'SP'
      ELSE 'CM'
    END,
    preferred_foot=CASE WHEN p.preferred_foot IN ('left','right','both') THEN p.preferred_foot ELSE NULL END,
    source_checked_at=p.imported_at::date,
    source_cm_club_id=(SELECT a.cm_club_id FROM public.cm0102_player_club_assignments a WHERE a.cm_player_id=p.cm_player_id),
    source_club_name=(SELECT c.club_name FROM public.cm0102_player_club_assignments a JOIN public.cm0102_clubs c ON c.cm_club_id=a.cm_club_id WHERE a.cm_player_id=p.cm_player_id),
    team_id=(SELECT m.team_id FROM public.cm0102_player_club_assignments a JOIN public.cm0102_game_team_mappings m ON m.cm_club_id=a.cm_club_id WHERE a.cm_player_id=p.cm_player_id),
    is_active=TRUE,
    career_status='active'
FROM todo
WHERE p.ctid=todo.ctid;
