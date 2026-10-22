import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const validPosition = new Set(["GK","RB","CB","LB","RWB","LWB","DM","CM","AM","RW","LW","ST"]);

export async function GET() {
  const conn = process.env.DATABASE_URL;
  if (!conn) return fail("DATABASE_URL ontbreekt.", 503);
  try {
    const sql = neon(conn);
    const squads = await sql.query(
      "SELECT s.id,s.name,s.season_id,t.name AS club_name,COUNT(p.id) FILTER (WHERE p.promoted_at IS NULL)::int AS active_players FROM youth_squads s JOIN teams t ON t.id=s.club_id LEFT JOIN youth_squad_players p ON p.squad_id=s.id GROUP BY s.id,t.name ORDER BY s.name"
    );
    const players = await sql.query(
      "SELECT p.*, (p.promoted_at IS NOT NULL) AS promoted, t.name AS promoted_to FROM youth_squad_players p LEFT JOIN teams t ON t.id=p.promoted_to_team_id WHERE p.squad_id='ajax-o19' ORDER BY p.promoted_at NULLS FIRST,p.position,p.full_name"
    );
    const clubs = await sql.query(
      "SELECT t.id,t.name FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id='2026-2027' AND t.id IN ('ajax','jong-ajax') ORDER BY CASE WHEN t.id='jong-ajax' THEN 1 ELSE 2 END"
    );
    return NextResponse.json({ squads, players, clubs }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("youth squad GET", error);
    return fail("Jeugdselectie kon niet worden geladen.", 500);
  }
}

export async function POST(request: Request) {
  const conn = process.env.DATABASE_URL;
  if (!conn) return fail("DATABASE_URL ontbreekt.", 503);
  try {
    const body = await request.json();
    if (body.action !== "promote") return fail("Ongeldige actie.");
    const youthId = String(body.youthPlayerId || "");
    const teamId = String(body.teamId || "");
    if (!youthId || !["ajax","jong-ajax"].includes(teamId)) return fail("Kies een jeugdspeler en Ajax 1 of Jong Ajax.");
    const sql = neon(conn);
    const rows = await sql.query(
      "SELECT yp.* FROM youth_squad_players yp WHERE yp.id=$1 AND yp.squad_id='ajax-o19' AND yp.promoted_at IS NULL LIMIT 1",
      [youthId]
    );
    if (!rows.length) return fail("Jeugdspeler niet gevonden of al overgeheveld.", 404);
    const p: any = rows[0];
    const slug = p.full_name.normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const playerId = "ajax-youth-" + slug;
    const result = await sql.query(
      "INSERT INTO players(id,team_id,full_name,known_as,date_of_birth,nationality,position,preferred_foot,overall_rating,potential_rating,source_url,source_checked_at,is_active,career_status) VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,CURRENT_DATE,TRUE,'active') ON CONFLICT(id) DO UPDATE SET team_id=EXCLUDED.team_id,nationality=COALESCE(players.nationality,EXCLUDED.nationality),position=EXCLUDED.position,overall_rating=EXCLUDED.overall_rating,potential_rating=EXCLUDED.potential_rating,is_active=TRUE,career_status='active' RETURNING id",
      [playerId, teamId, p.full_name, p.full_name.split(" ")[0], p.nationality, p.position, p.preferred_foot, p.overall_rating, p.potential_rating, p.source_url]
    );
    await sql.query(
      "UPDATE youth_squad_players SET promoted_player_id=$2,promoted_to_team_id=$3,promoted_at=NOW() WHERE id=$1",
      [youthId, result[0].id, teamId]
    );
    return NextResponse.json({ ok: true, playerId: result[0].id, teamId, player: p.full_name });
  } catch (error) {
    console.error("youth squad POST", error);
    return fail("Overhevelen is mislukt.", 500);
  }
}
