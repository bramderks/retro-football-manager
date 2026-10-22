-- Ajax O19 youth squad, kept separate from league teams/fixtures.
CREATE TABLE IF NOT EXISTS youth_squads (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, name, season_id)
);
CREATE TABLE IF NOT EXISTS youth_squad_players (
  id TEXT PRIMARY KEY,
  squad_id TEXT NOT NULL REFERENCES youth_squads(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  age_years SMALLINT,
  nationality TEXT,
  position TEXT NOT NULL CHECK (position IN ('GK','RB','CB','LB','RWB','LWB','DM','CM','AM','RW','LW','ST')),
  preferred_foot TEXT CHECK (preferred_foot IN ('left','right','both')),
  overall_rating SMALLINT NOT NULL DEFAULT 50 CHECK (overall_rating BETWEEN 1 AND 100),
  potential_rating SMALLINT NOT NULL DEFAULT 60 CHECK (potential_rating BETWEEN 1 AND 100),
  source_url TEXT,
  source_checked_at DATE,
  promoted_player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
  promoted_to_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (squad_id, full_name)
);
CREATE INDEX IF NOT EXISTS idx_youth_squad_players_squad ON youth_squad_players(squad_id);
INSERT INTO youth_squads(id,club_id,name,season_id)
VALUES ('ajax-o19','ajax','Ajax O19','2026-2027')
ON CONFLICT (id) DO NOTHING;
-- Seed the initial squad from publicly indexed FM26 youth-squad data. Current/potential ability
-- values from the source are normalized from its 0-200 scale to this game's 1-100 scale.
INSERT INTO youth_squad_players
(id,squad_id,full_name,age_years,nationality,position,overall_rating,potential_rating,source_url)
VALUES
('ajax-o19-rayane-bounida','ajax-o19','Rayane Bounida',19,'Belgisch','AM',57,84,'https://fmplayer.net/fm-26/rayane-bounida-2000127879'),
('ajax-o19-ethan-butera','ajax-o19','Ethan Butera',19,'Belgisch','CB',50,83,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-abdellah-ouazane','ajax-o19','Abdellah Ouazane',17,'Marokkaans','CM',51,81,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-jorthy-mokio','ajax-o19','Jorthy Mokio',17,'Belgisch','CB',57,80,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-emre-unuvar','ajax-o19','Emre Ünüvar',17,'Nederlands','ST',51,78,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-sean-steur','ajax-o19','Sean Steur',17,'Nederlands','CM',53,77,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-kayden-wolff','ajax-o19','Kayden Wolff',19,'Nederlands','LW',48,75,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-levi-acheampong','ajax-o19','Levi Acheampong',17,'Nederlands','AM',44,74,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-mylo-van-der-lans','ajax-o19','Mylo van der Lans',18,'Nederlands','CB',41,74,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-skye-vink','ajax-o19','Skye Vink',19,'Nederlands','ST',51,74,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-lucas-jetten','ajax-o19','Lucas Jetten',18,'Nederlands','LB',52,73,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-aaron-bouwman','ajax-o19','Aaron Bouwman',18,'Nederlands','CB',48,72,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-hasan-ayyildiz','ajax-o19','Hasan Ayyildiz',17,'Turks','AM',45,72,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-nafairon-landvreugd','ajax-o19','Nafairon Landvreugd',17,'Nederlands','RW',44,69,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-don-oneil','ajax-o19','Don O’Niel',18,'Nederlands','AM',41,69,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-pharell-nash','ajax-o19','Pharell Nash',17,'Nederlands','LW',40,69,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-avery-appiah','ajax-o19','Avery Appiah',17,'Nederlands','RB',51,69,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-sam-cuntapay','ajax-o19','Sam Cuntapay',17,'Nederlands','DM',39,68,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-joshua-bastien','ajax-o19','Joshua Bastien',15,'Nederlands','LB',40,67,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-jinairo-johnson','ajax-o19','Jinairo Johnson',17,'Nederlands','DM',47,67,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-mark-verkuijl','ajax-o19','Mark Verkuijl',19,'Nederlands','DM',52,66,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-daniel-skaarud','ajax-o19','Daniel Johan Skaarud',17,'Noors','RW',49,66,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-martin-henrion','ajax-o19','Martin Henrion',17,'Belgisch','GK',44,66,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-guus-olgers','ajax-o19','Guus Olgers',16,'Nederlands','GK',40,66,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-eternal-barron','ajax-o19','Eternal Barron',17,'Nederlands','RW',40,66,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-mark-engel','ajax-o19','Mark Engel',17,'Nederlands','GK',46,65,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-ryan-van-de-pavert','ajax-o19','Ryan van de Pavert',17,'Nederlands','CB',46,65,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-lasse-abildgaard','ajax-o19','Lasse Abildgaard',17,'Deens','RW',41,65,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-luka-vieillevoye','ajax-o19','Luka Vieillevoye',17,'Nederlands','CB',40,64,'https://fmplayer.net/club/fm-26/ajax-992'),
('ajax-o19-thijmen-romers','ajax-o19','Thijmen Romers',19,'Nederlands','CM',39,64,'https://fmplayer.net/club/fm-26/ajax-992')
ON CONFLICT (squad_id,full_name) DO UPDATE SET
 age_years=EXCLUDED.age_years,nationality=EXCLUDED.nationality,position=EXCLUDED.position,
 overall_rating=EXCLUDED.overall_rating,potential_rating=EXCLUDED.potential_rating,source_url=EXCLUDED.source_url;
