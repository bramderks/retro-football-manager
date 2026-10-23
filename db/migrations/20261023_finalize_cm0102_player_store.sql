-- Phase 3/3: run only after the batched backfill reports 0 updated rows.
ALTER TABLE public.players ADD CONSTRAINT canonical_players_pkey PRIMARY KEY(id);
ALTER TABLE public.players ADD CONSTRAINT players_source_cm_player_id_key UNIQUE(source_cm_player_id);
ALTER TABLE public.players DROP COLUMN cm_player_id;

-- Bring across the small legacy game roster; CM data remains in the same canonical table.
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

UPDATE public.players SET preferred_foot=NULL WHERE preferred_foot='unknown';
ALTER TABLE public.players ADD CONSTRAINT players_preferred_foot_check CHECK (preferred_foot IS NULL OR preferred_foot = ANY (ARRAY['left','right','both']::text[]));

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

CREATE TABLE IF NOT EXISTS public.team_player_memberships (
  season_id TEXT NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  membership_type TEXT NOT NULL CHECK (membership_type IN ('primary','youth-affiliate')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(season_id,team_id,player_id)
);
INSERT INTO public.team_player_memberships(season_id,team_id,player_id,membership_type)
SELECT d.season_id,p.team_id,p.id,'primary'
FROM public.players p
JOIN public.teams t ON t.id=p.team_id
JOIN public.divisions d ON d.id=t.division_id
WHERE p.source_cm_player_id IS NOT NULL AND p.is_active=TRUE
ON CONFLICT(season_id,team_id,player_id) DO UPDATE SET membership_type='primary';

WITH youth_roster AS (
  SELECT yd.season_id,y.id AS youth_team_id,p.id AS player_id,
         ROW_NUMBER() OVER(PARTITION BY y.id ORDER BY p.date_of_birth DESC NULLS LAST,p.overall_rating DESC,p.potential_rating DESC,p.full_name) AS rn
  FROM public.teams y
  JOIN public.divisions yd ON yd.id=y.division_id AND yd.season_id='2026-2027'
  JOIN public.teams parent ON parent.name=CASE y.name
    WHEN 'Jong AZ' THEN 'AZ'
    WHEN 'Jong Ajax' THEN 'Ajax'
    WHEN 'Jong FC Utrecht' THEN 'FC Utrecht'
    WHEN 'Jong PSV' THEN 'PSV'
  END
  JOIN public.divisions pd ON pd.id=parent.division_id AND pd.season_id=yd.season_id
  JOIN public.players p ON p.team_id=parent.id AND p.source_cm_player_id IS NOT NULL AND p.is_active=TRUE
  WHERE y.name IN ('Jong AZ','Jong Ajax','Jong FC Utrecht','Jong PSV')
)
INSERT INTO public.team_player_memberships(season_id,team_id,player_id,membership_type)
SELECT season_id,youth_team_id,player_id,'youth-affiliate'
FROM youth_roster WHERE rn<=24
ON CONFLICT(season_id,team_id,player_id) DO NOTHING;

INSERT INTO public.career_player_states(save_id,player_id,club_id,current_rating,potential_rating)
SELECT s.id,p.id,COALESCE(tm.team_id,p.team_id),p.overall_rating,p.potential_rating
FROM public.career_saves s CROSS JOIN public.players p
LEFT JOIN public.team_player_memberships tm ON tm.player_id=p.id AND tm.team_id=s.club_id AND tm.season_id=s.season_id
WHERE p.source_cm_player_id IS NOT NULL AND COALESCE(tm.team_id,p.team_id) IS NOT NULL AND p.is_active=TRUE
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
