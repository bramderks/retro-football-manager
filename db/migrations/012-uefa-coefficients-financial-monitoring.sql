-- Annual UEFA coefficient, access-list and financial monitoring support.
BEGIN;
CREATE TABLE IF NOT EXISTS uefa_association_season_coefficients (
  season_id TEXT NOT NULL,
  country_code TEXT NOT NULL,
  points NUMERIC(8,3) NOT NULL DEFAULT 0,
  participating_clubs SMALLINT NOT NULL DEFAULT 0,
  coefficient NUMERIC(8,3) NOT NULL DEFAULT 0,
  ranking SMALLINT,
  PRIMARY KEY (season_id,country_code)
);
CREATE TABLE IF NOT EXISTS uefa_association_coefficients (
  country_code TEXT PRIMARY KEY,
  latest_season_id TEXT NOT NULL,
  five_season_total NUMERIC(8,3) NOT NULL DEFAULT 0,
  coefficient NUMERIC(8,3) NOT NULL DEFAULT 0,
  ranking SMALLINT
);
CREATE TABLE IF NOT EXISTS uefa_club_season_coefficients (
  season_id TEXT NOT NULL,
  club_id TEXT NOT NULL REFERENCES uefa_clubs(id),
  points NUMERIC(8,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (season_id,club_id)
);
CREATE TABLE IF NOT EXISTS uefa_club_coefficients (
  club_id TEXT PRIMARY KEY REFERENCES uefa_clubs(id),
  five_season_total NUMERIC(8,3) NOT NULL DEFAULT 0,
  ten_season_total NUMERIC(8,3) NOT NULL DEFAULT 0,
  coefficient NUMERIC(8,3) NOT NULL DEFAULT 0,
  ranking SMALLINT
);
CREATE TABLE IF NOT EXISTS club_financial_monitoring (
  team_id TEXT NOT NULL REFERENCES teams(id),
  season_id TEXT NOT NULL,
  relevant_revenue BIGINT NOT NULL DEFAULT 0,
  squad_cost BIGINT NOT NULL DEFAULT 0,
  squad_cost_ratio NUMERIC(6,2) NOT NULL DEFAULT 0,
  overdue_club_payables BIGINT NOT NULL DEFAULT 0,
  overdue_employee_payables BIGINT NOT NULL DEFAULT 0,
  overdue_tax_payables BIGINT NOT NULL DEFAULT 0,
  football_earnings_deviation BIGINT NOT NULL DEFAULT 0,
  compliance_status TEXT NOT NULL DEFAULT 'compliant',
  sanctions JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(team_id,season_id)
);
CREATE TABLE IF NOT EXISTS national_financial_rules (
 country_code TEXT PRIMARY KEY,
 rule_code TEXT NOT NULL,
 rule_name TEXT NOT NULL,
 squad_cost_limit_pct NUMERIC(6,2) NOT NULL DEFAULT 70,
 allowed_loss_eur BIGINT NOT NULL DEFAULT 60000000,
 monitoring_years SMALLINT NOT NULL DEFAULT 3,
 requires_licence BOOLEAN NOT NULL DEFAULT TRUE,
 procedure_notes TEXT NOT NULL DEFAULT ''
);
INSERT INTO national_financial_rules(country_code,rule_code,rule_name,squad_cost_limit_pct,allowed_loss_eur,monitoring_years,requires_licence,procedure_notes) VALUES
('ENG','PREMIER_LEAGUE_PSR','Premier League PSR / UEFA FSR overlay',70,125000000,3,TRUE,'Simuleert driejaarsverliescontrole en UEFA squad-cost monitoring; de echte PSR-berekening is geen simpele salarisratio.'),
('ESP','LALIGA_ECONOMIC_CONTROL','LaLiga economische controle',70,60000000,3,TRUE,'Simuleert budgetlimiet op basis van goedgekeurde inkomsten, loonkosten en selectie-uitgaven.'),
('GER','DFL_LICENSING','DFL licentie en liquiditeitscontrole',70,60000000,3,TRUE,'Simuleert licentiecontrole, liquiditeit en selectie-uitgaven; echte Duitse procedures hebben eigen beoordelingscriteria.'),
('ITA','FIGC_COVISOC','FIGC / COVISOC financiële controle',70,60000000,3,TRUE,'Simuleert licentie, solvabiliteit en betalingsverplichtingen.'),
('FRA','DNCG','DNCG financiële controle',70,60000000,3,TRUE,'Simuleert begrotingsgoedkeuring, solvabiliteit en mogelijke toezichtmaatregelen.'),
('NED','KNVB_LICENSING','KNVB licentie en financiële beoordeling',70,60000000,3,TRUE,'Simuleert licentiecontrole en betalingsachterstanden.'),
('POR','FPF_LICENSING','Portugese licentie en UEFA FSR',70,60000000,3,TRUE,'Simuleert licentie, betalingsachterstanden en squad-cost controle.'),
('BEL','RBFA_LICENSING','Belgische licentie en UEFA FSR',70,60000000,3,TRUE,'Simuleert licentiecontrole en solvabiliteit.'),
('SCO','SPFL_SFA_FINANCIAL','Schotse licentie en UEFA FSR',70,60000000,3,TRUE,'Simuleert licentie en betalingsverplichtingen.'),
('TUR','TFF_FINANCIAL','TFF financiële licentie en UEFA FSR',70,60000000,3,TRUE,'Simuleert licentiecontrole en betalingsachterstanden.')
ON CONFLICT(country_code) DO UPDATE SET rule_code=EXCLUDED.rule_code,rule_name=EXCLUDED.rule_name,squad_cost_limit_pct=EXCLUDED.squad_cost_limit_pct,allowed_loss_eur=EXCLUDED.allowed_loss_eur,monitoring_years=EXCLUDED.monitoring_years,requires_licence=EXCLUDED.requires_licence,procedure_notes=EXCLUDED.procedure_notes;
INSERT INTO national_financial_rules(country_code,rule_code,rule_name,squad_cost_limit_pct,allowed_loss_eur,monitoring_years,requires_licence,procedure_notes)
SELECT x.country_code,x.country_code||'_LICENSING',x.country_code||' national licensing and UEFA FSR overlay',70,60000000,3,TRUE,
'Generic game simulation profile: licensing, overdue-payables and UEFA squad-cost controls. Replace with verified national rules where the league has a distinct published framework.'
FROM (SELECT DISTINCT country_code FROM uefa_clubs) x
ON CONFLICT(country_code) DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_uefa_assoc_coefficient_rank ON uefa_association_coefficients(ranking);
CREATE INDEX IF NOT EXISTS idx_uefa_club_coefficient_rank ON uefa_club_coefficients(ranking);
COMMIT;
