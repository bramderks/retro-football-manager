import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const conn = process.env.DATABASE_URL;
  if (!conn) return NextResponse.json({ error: "DATABASE_URL ontbreekt." }, { status: 503 });
  try {
    const sql = neon(conn);
    const saveId = new URL(request.url).searchParams.get("saveId");
    const savedSeason = saveId ? await sql.query("SELECT season_id FROM career_saves WHERE id=$1 AND status='active' LIMIT 1", [saveId]) : [];
    const latestCompetitionSeason = savedSeason.length ? savedSeason : await sql.query("SELECT season_id FROM uefa_competitions GROUP BY season_id ORDER BY season_id DESC LIMIT 1");
    const season = String(latestCompetitionSeason[0]?.season_id || "2026-2027");
    const competitions = await sql.query("SELECT id,code,name,season_id,league_phase_clubs,matches_per_club FROM uefa_competitions WHERE season_id=$1 ORDER BY CASE code WHEN 'UCL' THEN 1 WHEN 'UEL' THEN 2 ELSE 3 END", [season]);
    const clubs = await sql.query("SELECT p.competition_id,p.points,p.played,p.wins,p.draws,p.losses,p.goals_for,p.goals_against,c.id AS club_id,c.name,c.country_code,c.team_strength FROM uefa_participants p JOIN uefa_clubs c ON c.id=p.club_id JOIN uefa_competitions uc ON uc.id=p.competition_id WHERE uc.season_id=$1 ORDER BY p.competition_id,p.points DESC,(p.goals_for-p.goals_against) DESC,c.name", [season]);
    const allClubs = await sql.query("SELECT u.id,u.name,u.country_code,u.reputation,u.team_strength,u.domestic_team_id,COUNT(p.id)::int AS roster_count FROM uefa_clubs u LEFT JOIN uefa_club_player_memberships um ON um.club_id=u.id AND um.season_id=$1 AND um.membership_type='primary' LEFT JOIN players p ON p.id=um.player_id AND p.is_active=TRUE AND p.career_status='active' GROUP BY u.id ORDER BY u.country_code,u.name", [season]);
    const fixtures = await sql.query("SELECT f.id,f.competition_id,f.matchday,f.kickoff_date,f.home_goals,f.away_goals,f.status,h.name AS home_club,a.name AS away_club FROM uefa_fixtures f JOIN uefa_clubs h ON h.id=f.home_club_id JOIN uefa_clubs a ON a.id=f.away_club_id WHERE f.season_id=$1 ORDER BY f.kickoff_date,f.matchday LIMIT 500", [season]);
    return NextResponse.json({ season, competitions, clubs, allClubs, fixtures }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("UEFA API", error);
    return NextResponse.json({ error: "Europese competities konden niet worden geladen." }, { status: 500 });
  }
}
