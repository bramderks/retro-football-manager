-- Calibrate 2026/27 club reputation against UEFA's current five-season club coefficients,
-- using the ten-season coefficient/history as context and domestic tier for unranked clubs.
-- FIFA does not publish an equivalent ongoing global club ranking; do not label a made-up score as FIFA ranking.
BEGIN;

UPDATE teams t
SET reputation = CASE
  WHEN t.id = 'ger-bayern-munchen-1' THEN 96
  WHEN t.id = 'eng-arsenal-1' THEN 95
  WHEN t.id = 'esp-real-madrid-1' THEN 94
  WHEN t.id = 'fra-paris-saint-germain-1' THEN 93
  WHEN t.id = 'ita-inter-1' THEN 92
  WHEN t.id = 'eng-liverpool-1' THEN 91
  WHEN t.id = 'eng-manchester-city-1' THEN 90
  WHEN t.id = 'esp-fc-barcelona-1' THEN 89
  WHEN t.id = 'ger-borussia-dortmund-1' THEN 88
  WHEN t.id = 'ger-bayer-leverkusen-1' THEN 87
  -- Dutch clubs are calibrated below the current top coefficient tier; Ajax was around 41st
  -- in the 2026 five-year coefficient table, not a world-leading top-10 club.
  WHEN t.id = 'psv' THEN 81
  WHEN t.id = 'feyenoord' THEN 80
  WHEN t.id = 'ajax' THEN 78
  WHEN t.id = 'az' THEN 72
  WHEN t.id = 'fc-twente' THEN 70
  WHEN t.id = 'fc-utrecht' THEN 66
  WHEN t.id = 'nec' THEN 65
  WHEN t.id = 'fc-groningen' THEN 64
  WHEN t.id = 'nac-breda' THEN 60
  WHEN d.tier = 1 THEN LEAST(86, GREATEST(58, t.reputation))
  ELSE LEAST(68, GREATEST(50, t.reputation - 3))
END
FROM divisions d
WHERE d.id = t.division_id AND d.season_id = '2026-2027';

-- The previous Ajax youth squad contained historical CM0102 players (e.g. real 2001-era players).
-- Keep those people in the one central players table, but remove their incorrect current O19 membership.
-- The standard generator will refill Ajax O19 with fictional current-era youth players.
DELETE FROM youth_squad_players yp
USING youth_squads ys
WHERE ys.id = yp.squad_id
  AND ys.season_id = '2026-2027'
  AND yp.player_id LIKE 'cm0102-%'
  AND yp.promoted_at IS NULL;

-- Recalculate generated youth players only; never overwrite the real CM0102/current-player CA or PA.
WITH generated_youth AS (
  SELECT
    yp.player_id,
    t.reputation,
    CASE RIGHT(p.id, 2)::int
      WHEN 1 THEN -6 WHEN 2 THEN -5 WHEN 3 THEN -4 WHEN 4 THEN -3 WHEN 5 THEN -2
      WHEN 6 THEN -1 WHEN 12 THEN 1 WHEN 13 THEN 2 WHEN 14 THEN 3 WHEN 15 THEN 4
      WHEN 16 THEN 5 WHEN 17 THEN 6 ELSE 0
    END AS variation
  FROM youth_squad_players yp
  JOIN youth_squads ys ON ys.id = yp.squad_id
  JOIN teams t ON t.id = ys.club_id
  JOIN players p ON p.id = yp.player_id
  WHERE ys.season_id = '2026-2027'
    AND p.id LIKE 'regen-youth-%'
    AND yp.promoted_at IS NULL
),
calculated AS (
  SELECT
    player_id,
    GREATEST(8, LEAST(70, ROUND(12 + reputation * 0.42 + variation)::int)) AS ca,
    GREATEST(8, LEAST(95, ROUND(25 + reputation * 0.55 + variation)::int)) AS pa
  FROM generated_youth
)
UPDATE players p
SET overall_rating = c.ca,
    potential_rating = GREATEST(c.ca + 8, c.pa),
    current_ability = GREATEST(c.ca, 1) * 2,
    potential_ability = GREATEST(c.ca + 8, c.pa) * 2
FROM calculated c
WHERE p.id = c.player_id;

COMMIT;
