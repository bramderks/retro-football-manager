-- Annual season cycle, calendar and generated player support.
CREATE TABLE IF NOT EXISTS season_calendar (
 id TEXT PRIMARY KEY,
 season_id TEXT NOT NULL,
 event_date DATE NOT NULL,
 event_type TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'scheduled',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(season_id,event_date,event_type,title)
);
CREATE INDEX IF NOT EXISTS idx_season_calendar_date ON season_calendar(event_date,season_id);
CREATE TABLE IF NOT EXISTS season_generation_log (
 season_id TEXT PRIMARY KEY,
 generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 generated_by TEXT NOT NULL DEFAULT 'automatic',
 clubs_count INTEGER NOT NULL DEFAULT 0,
 fixtures_count INTEGER NOT NULL DEFAULT 0,
 players_added INTEGER NOT NULL DEFAULT 0,
 promotions_count INTEGER NOT NULL DEFAULT 0,
 notes TEXT NOT NULL DEFAULT ''
);
ALTER TABLE uefa_clubs ADD COLUMN IF NOT EXISTS domestic_team_id TEXT;
ALTER TABLE uefa_clubs ADD COLUMN IF NOT EXISTS club_type TEXT NOT NULL DEFAULT 'men';
INSERT INTO seasons(id,label,starts_on,ends_on) VALUES
('2027-2028','2027/28',DATE '2027-07-01',DATE '2028-06-30')
ON CONFLICT(id) DO NOTHING;
INSERT INTO season_calendar(id,season_id,event_date,event_type,title,description) VALUES
('cal-2627-preseason','2026-2027',DATE '2026-07-01','season_start','Start seizoen 2026/27','Start van de jaarlijkse seizoensopbouw en contractcontrole.'),
('cal-2627-window-summer-open','2026-2027',DATE '2026-07-01','transfer_window','Zomertransferwindow opent',''),
('cal-2627-league-start','2026-2027',DATE '2026-08-07','domestic_round','Start nationale competities','Nationale competitieprogramma’s.'),
('cal-2627-ucl-start','2026-2027',DATE '2026-09-08','uefa_round','Champions League - speeldag 1',''),
('cal-2627-uel-start','2026-2027',DATE '2026-09-16','uefa_round','Europa League - speeldag 1',''),
('cal-2627-uecl-start','2026-2027',DATE '2026-10-01','uefa_round','Conference League - speeldag 1',''),
('cal-2627-window-winter','2026-2027',DATE '2027-01-01','transfer_window','Wintertransferwindow',''),
('cal-2627-playoff','2026-2027',DATE '2027-02-16','uefa_knockout','Europese knock-outplay-offs',''),
('cal-2627-final','2026-2027',DATE '2027-06-05','uefa_final','Champions League-finale',''),
('cal-2627-season-end','2026-2027',DATE '2027-06-30','season_end','Einde seizoen 2026/27','Eindstanden, promotie/degradatie en Europese kwalificatie worden vastgesteld.'),
('cal-2728-preseason','2027-2028',DATE '2027-07-01','season_start','Start seizoen 2027/28','Automatische seizoensgeneratie: promotie/degradatie, Europese deelnemers, selectiecontrole en nieuwe kalenders.'),
('cal-2728-window-summer-open','2027-2028',DATE '2027-07-01','transfer_window','Zomertransferwindow opent',''),
('cal-2728-window-summer-close','2027-2028',DATE '2027-08-31','transfer_window','Zomertransferwindow sluit',''),
('cal-2728-league-start','2027-2028',DATE '2027-08-06','domestic_round','Start nationale competities','')
ON CONFLICT(id) DO NOTHING;