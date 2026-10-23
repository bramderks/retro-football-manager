import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type MappingRow = Record<string, unknown>;
function integer(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}
function clean(row: MappingRow) {
  const playerId = integer(row.cm_player_id);
  const staffId = integer(row.cm_staff_id);
  const clubId = integer(row.cm_club_id);
  const clubName = String(row.club_name ?? "").trim();
  const playerName = String(row.player_name ?? "").trim();
  if (playerId === null || staffId === null || clubId === null || !clubName || !playerName) {
    throw new Error("Elke regel moet cm_player_id, cm_staff_id, cm_club_id, club_name en player_name bevatten.");
  }
  return {
    playerId, staffId, clubId, clubName,
    clubShortName: String(row.club_short_name ?? "").trim() || null,
    nationId: integer(row.nation_id),
    divisionId: integer(row.division_id),
    jobForClub: integer(row.job_for_club),
    playerName
  };
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL ontbreekt in de Vercel-omgevingsvariabelen." }, { status: 503 });
  }
  try {
    const body = await request.json();
    if (!Array.isArray(body?.rows) || body.rows.length < 1 || body.rows.length > 1000) {
      return NextResponse.json({ error: "Stuur een batch van 1 tot 1000 clubkoppelingen." }, { status: 400 });
    }
    const rows = (body.rows as MappingRow[]).map(clean);
    const sql = neon(process.env.DATABASE_URL);
    const clubs = [...new Map(rows.map(r => [r.clubId, r])).values()];
    const clubParams: unknown[] = [];
    const clubValues = clubs.map((r, i) => {
      const v = [r.clubId, r.clubName, r.clubShortName, r.nationId, r.divisionId];
      clubParams.push(...v);
      const start = i * v.length;
      return "(" + v.map((_, j) => "$" + (start + j + 1)).join(",") + ")";
    });
    await sql.query(
      "INSERT INTO public.cm0102_clubs (cm_club_id,club_name,club_short_name,nation_id,division_id) VALUES " +
      clubValues.join(",") +
      " ON CONFLICT (cm_club_id) DO UPDATE SET club_name=EXCLUDED.club_name,club_short_name=EXCLUDED.club_short_name,nation_id=EXCLUDED.nation_id,division_id=EXCLUDED.division_id,imported_at=NOW()",
      clubParams as any[]
    );

    const assignmentParams: unknown[] = [];
    const assignmentValues = rows.map((r, i) => {
      const v = [r.playerId, r.staffId, r.clubId, r.jobForClub, r.playerName];
      assignmentParams.push(...v);
      const start = i * v.length;
      return "(" + v.map((_, j) => "$" + (start + j + 1)).join(",") + ")";
    });
    await sql.query(
      "INSERT INTO public.cm0102_player_club_assignments (cm_player_id,cm_staff_id,cm_club_id,job_for_club,player_name) VALUES " +
      assignmentValues.join(",") +
      " ON CONFLICT (cm_player_id) DO UPDATE SET cm_staff_id=EXCLUDED.cm_staff_id,cm_club_id=EXCLUDED.cm_club_id,job_for_club=EXCLUDED.job_for_club,player_name=EXCLUDED.player_name,imported_at=NOW()",
      assignmentParams as any[]
    );
    // Build exact-name CM club mappings and attach canonical player records to game teams.
    await sql.query(
      `INSERT INTO public.cm0102_game_team_mappings(cm_club_id,team_id,mapping_method)
       SELECT c.cm_club_id,t.id,'exact-normalized-name'
         FROM public.cm0102_clubs c
         JOIN public.teams t
           ON regexp_replace(lower(c.club_name),'[^a-z0-9]','','g')
            = regexp_replace(lower(t.name),'[^a-z0-9]','','g')
       ON CONFLICT (cm_club_id) DO NOTHING`
    );
    await sql.query(
      `UPDATE public.players old
          SET team_id=NULL,is_active=FALSE,career_status='inactive'
        WHERE old.cm_player_id IS NULL
          AND old.team_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.players cm
            JOIN public.cm0102_player_club_assignments a ON a.cm_player_id=cm.cm_player_id
            JOIN public.cm0102_game_team_mappings m ON m.cm_club_id=a.cm_club_id
            WHERE cm.cm_player_id IS NOT NULL AND m.team_id=old.team_id
              AND lower(BTRIM(cm.full_name))=lower(BTRIM(old.full_name))
          )`
    );
    await sql.query(
      `UPDATE public.players cm
          SET cm_club_id=a.cm_club_id,team_id=m.team_id,club_name=t.name,
              record_source='cm0102',is_active=TRUE,career_status='active'
         FROM public.cm0102_player_club_assignments a
         JOIN public.cm0102_game_team_mappings m ON m.cm_club_id=a.cm_club_id
         JOIN public.teams t ON t.id=m.team_id
        WHERE cm.cm_player_id=a.cm_player_id
          AND cm.cm_player_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.players other
             WHERE other.team_id=m.team_id AND other.id<>cm.id
               AND other.is_active=TRUE
               AND lower(BTRIM(other.full_name))=lower(BTRIM(cm.full_name))
          )`
    );
    await sql.query(
      `INSERT INTO public.career_player_states(save_id,player_id,club_id,current_rating,potential_rating)
       SELECT s.id,p.id,p.team_id,p.overall_rating,p.potential_rating
         FROM public.career_saves s CROSS JOIN public.players p
        WHERE p.cm_player_id IS NOT NULL AND p.team_id IS NOT NULL
          AND p.cm_club_id IN (SELECT cm_club_id FROM public.cm0102_player_club_assignments)
       ON CONFLICT(save_id,player_id) DO NOTHING`
    );
    return NextResponse.json({ success: true, processed: rows.length, clubsProcessed: clubs.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende importfout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
