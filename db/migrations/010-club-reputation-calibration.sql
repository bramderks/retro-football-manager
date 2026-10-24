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
  -- Remaining coefficient-ranked clubs use the 2026 five-year UEFA table as a baseline.
  WHEN t.id = 'eng-chelsea-1' THEN 87
  WHEN t.id = 'ita-as-roma-1' THEN 86
  WHEN t.id = 'eng-aston-villa-1' THEN 83
  WHEN t.id = 'eng-tottenham-hotspur-1' THEN 82
  WHEN t.id = 'eng-manchester-united-1' THEN 81
  WHEN t.id = 'ita-fiorentina-1' THEN 80
  WHEN t.id = 'esp-real-betis-1' THEN 79
  WHEN t.id = 'ita-juventus-1' THEN 78
  WHEN t.id = 'psv' THEN 77
  WHEN t.id = 'feyenoord' THEN 76
  WHEN t.id = 'fra-losc-lille-1' THEN 75
  WHEN t.id = 'ita-ac-milan-1' THEN 74
  WHEN t.id = 'fra-olympique-lyonnais-1' THEN 73
  WHEN t.id = 'ita-napoli-1' THEN 72
  WHEN t.id = 'az' THEN 71
  WHEN t.id = 'ger-rb-leipzig-1' THEN 70
  WHEN t.id = 'esp-villarreal-cf-1' THEN 69
  WHEN t.id = 'ita-lazio-1' THEN 68
  WHEN t.id = 'ajax' THEN 67
  WHEN t.id = 'esp-real-sociedad-1' THEN 66
  WHEN t.id = 'ger-sc-freiburg-1' THEN 65
  WHEN t.id = 'fra-as-monaco-1' THEN 64
  WHEN t.id = 'fra-olympique-de-marseille-1' THEN 63
  WHEN t.id = 'esp-sevilla-fc-1' THEN 62
  WHEN t.id = 'esp-athletic-club-1' THEN 61
  WHEN t.id = 'fra-stade-rennais-1' THEN 60
  WHEN t.id = 'ita-bologna-1' THEN 59
  WHEN t.id = 'eng-newcastle-united-1' THEN 61
  WHEN t.id = 'ger-vfb-stuttgart-1' THEN 60
  WHEN t.id = 'eng-nottingham-forest-1' THEN 59
  WHEN t.id = 'eng-crystal-palace-1' THEN 58
  WHEN t.id = 'esp-rayo-vallecano-1' THEN 57
  WHEN t.id = 'fra-rc-strasbourg-alsace-1' THEN 56
  WHEN t.id = 'fra-ogc-nice-1' THEN 55
  WHEN t.id = 'esp-rc-celta-de-vigo-1' THEN 54
  WHEN t.id = 'ger-1-fsv-mainz-05-1' THEN 53
  WHEN t.id = 'fra-rc-lens-1' THEN 52
  WHEN t.id = 'fra-toulouse-fc-1' THEN 51
  WHEN t.id = 'fra-fc-nantes-1' THEN 50
  WHEN t.id = 'go-ahead-eagles' THEN 49
  WHEN t.id = 'fc-twente' THEN 48
  WHEN t.id = 'fc-utrecht' THEN 47
  WHEN t.id = 'nec' THEN 65
  WHEN t.id = 'fc-groningen' THEN 64
  WHEN t.id = 'nac-breda' THEN 57
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
