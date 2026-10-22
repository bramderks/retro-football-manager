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
    return NextResponse.json({ success: true, processed: rows.length, clubsProcessed: clubs.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende importfout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
