import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET() {
  const conn = process.env.DATABASE_URL;
  if (!conn) return fail("DATABASE_URL ontbreekt.", 503);
  try {
    const sql = neon(conn);
    const squads = await sql.query(
      "SELECT s.id,s.name,s.season_id,t.name AS club_name,COUNT(yp.player_id) FILTER (WHERE yp.promoted_at IS NULL)::int AS active_players FROM youth_squads s JOIN teams t ON t.id=s.club_id LEFT JOIN youth_squad_players yp ON yp.squad_id=s.id GROUP BY s.id,t.name ORDER BY s.name"
    );
    const players = await sql.query(
      "SELECT yp.id,yp.squad_id,yp.age_years,yp.promoted_at,yp.promoted_to_team_id,p.id AS player_id,p.full_name,p.nationality,p.position,p.preferred_foot,p.overall_rating,p.potential_rating,p.source_url,p.source_checked_at,(yp.promoted_at IS NOT NULL) AS promoted,t.name AS promoted_to FROM youth_squad_players yp JOIN players p ON p.id=yp.player_id LEFT JOIN teams t ON t.id=yp.promoted_to_team_id WHERE yp.squad_id='ajax-o19' ORDER BY yp.promoted_at NULLS FIRST,p.position,p.full_name"
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
      "SELECT yp.id,yp.player_id,p.full_name,p.overall_rating,p.potential_rating FROM youth_squad_players yp JOIN players p ON p.id=yp.player_id WHERE yp.id=$1 AND yp.squad_id='ajax-o19' AND yp.promoted_at IS NULL LIMIT 1",
      [youthId]
    );
    if (!rows.length) return fail("Jeugdspeler niet gevonden of al overgeheveld.", 404);
    const p: any = rows[0];
    const playerId = String(p.player_id);

    await sql.query(
      "UPDATE players SET team_id=$2,is_active=TRUE,career_status='active' WHERE id=$1",
      [playerId, teamId]
    );
    await sql.query("DELETE FROM team_player_memberships WHERE season_id='2026-2027' AND player_id=$1",[playerId]);
    const membershipType = teamId === "jong-ajax" ? "youth-affiliate" : "primary";
    await sql.query(
      "INSERT INTO team_player_memberships(season_id,team_id,player_id,membership_type) VALUES('2026-2027',$1,$2,$3) ON CONFLICT(season_id,team_id,player_id) DO UPDATE SET membership_type=EXCLUDED.membership_type",
      [teamId, playerId, membershipType]
    );
    await sql.query(
      "UPDATE youth_squad_players SET promoted_to_team_id=$2,promoted_at=NOW() WHERE id=$1",
      [youthId, teamId]
    );
    await sql.query(
      "UPDATE career_player_states cps SET club_id=$2 FROM career_saves s WHERE cps.save_id=s.id AND s.club_id=$2 AND cps.player_id=$1",
      [playerId, teamId]
    );
    await sql.query(
      "INSERT INTO career_player_states(save_id,player_id,club_id,current_rating,potential_rating) SELECT s.id,p.id,$2,p.overall_rating,p.potential_rating FROM career_saves s JOIN players p ON p.id=$1 WHERE s.club_id=$2 ON CONFLICT(save_id,player_id) DO NOTHING",
      [playerId, teamId]
    );
    await sql.query(
      "INSERT INTO career_player_contracts(id,save_id,player_id,club_id,start_date,end_date,weekly_wage,squad_status,release_clause) SELECT 'contract-'||s.id||'-'||p.id,s.id,p.id,$2,CURRENT_DATE,'2028-06-30',GREATEST(500,p.overall_rating*p.overall_rating*2),'rotation',GREATEST(100000,p.overall_rating*p.overall_rating*900) FROM career_saves s JOIN players p ON p.id=$1 WHERE s.club_id=$2 ON CONFLICT DO NOTHING",
      [playerId, teamId]
    );
    return NextResponse.json({ ok: true, playerId, teamId, player: p.full_name });
  } catch (error) {
    console.error("youth squad POST", error);
    return fail("Overhevelen is mislukt.", 500);
  }
}
