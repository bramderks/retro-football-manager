-- Player profiles, season performance, development and discipline.
-- Idempotent migration: safe to run against an existing career database.
ALTER TABLE career_player_match_stats
  ADD COLUMN IF NOT EXISTS yellow_cards INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS red_cards INTEGER NOT NULL DEFAULT 0;

ALTER TABLE career_player_states
  ADD COLUMN IF NOT EXISTS current_rating SMALLINT,
  ADD COLUMN IF NOT EXISTS potential_rating SMALLINT;

UPDATE career_player_states cps
SET current_rating = COALESCE(cps.current_rating, p.overall_rating),
    potential_rating = COALESCE(cps.potential_rating, p.potential_rating)
FROM players p
WHERE p.id = cps.player_id
  AND (cps.current_rating IS NULL OR cps.potential_rating IS NULL);

-- Keep all player records in the same tactical position vocabulary.
UPDATE players
SET position = CASE UPPER(position)
  WHEN 'K' THEN 'GK' WHEN 'KEEPER' THEN 'GK' WHEN 'GOALKEEPER' THEN 'GK'
  WHEN 'CV' THEN 'CB' WHEN 'CB1' THEN 'CB' WHEN 'CB2' THEN 'CB' WHEN 'CB3' THEN 'CB'
  WHEN 'LV' THEN 'LB' WHEN 'RV' THEN 'RB'
  WHEN 'VM' THEN 'DM' WHEN 'CDM' THEN 'DM'
  WHEN 'LM' THEN 'LW' WHEN 'RM' THEN 'RW'
  WHEN 'LA' THEN 'LW' WHEN 'RA' THEN 'RW'
  WHEN 'SP' THEN 'ST' WHEN 'CF' THEN 'ST'
  WHEN 'WB' THEN CASE WHEN position ILIKE 'L%' THEN 'LWB' ELSE 'RWB' END
  ELSE UPPER(position)
END
WHERE UPPER(position) IN ('K','KEEPER','GOALKEEPER','CV','CB1','CB2','CB3','LV','RV','VM','CDM','LM','RM','LA','RA','SP','CF','WB');

-- Recalibrate ratings consistently against the strength of the player's current club,
-- preserving most of the original player rating while making the full database coherent.
UPDATE players p
SET overall_rating = GREATEST(1, LEAST(100, ROUND(p.overall_rating * 0.75 + COALESCE(t.team_strength, 50) * 0.25)::int)),
    potential_rating = GREATEST(
      GREATEST(1, LEAST(100, ROUND(p.overall_rating * 0.75 + COALESCE(t.team_strength, 50) * 0.25)::int)),
      LEAST(100, ROUND(p.potential_rating * 0.75 + COALESCE(t.team_strength, 50) * 0.25)::int)
    )
FROM teams t
WHERE t.id = p.team_id;

UPDATE career_player_states cps
SET current_rating = p.overall_rating,
    potential_rating = p.potential_rating,
    updated_at = NOW()
FROM players p
WHERE p.id = cps.player_id
  AND cps.current_rating IS NULL;

CREATE INDEX IF NOT EXISTS idx_player_match_stats_season_rating
  ON career_player_match_stats(save_id, player_id, rating);
