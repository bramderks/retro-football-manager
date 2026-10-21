import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const conn = process.env.DATABASE_URL;
  if (!conn) return NextResponse.json({ error: "DATABASE_URL ontbreekt." }, { status: 503 });
  try {
    const sql = neon(conn);
    const competitions = await sql.query("SELECT id,code,name,season_id,league_phase_clubs,matches_per_club FROM uefa_competitions WHERE season_id=$1 ORDER BY CASE code WHEN 'UCL' THEN 1 WHEN 'UEL' THEN 2 ELSE 3 END", ["2026-2027"]);
    const clubs = await sql.query("SELECT p.competition_id,p.points,p.played,p.wins,p.draws,p.losses,p.goals_for,p.goals_against,c.id AS club_id,c.name,c.country_code,c.team_strength FROM uefa_participants p JOIN uefa_clubs c ON c.id=p.club_id ORDER BY p.competition_id,p.points DESC,(p.goals_for-p.goals_against) DESC,c.name");
    const allClubs = await sql.query("SELECT id,name,country_code,reputation,team_strength,domestic_team_id FROM uefa_clubs ORDER BY country_code,name");
    const fixtures = await sql.query("SELECT f.id,f.competition_id,f.matchday,f.kickoff_date,f.home_goals,f.away_goals,f.status,h.name AS home_club,a.name AS away_club FROM uefa_fixtures f JOIN uefa_clubs h ON h.id=f.home_club_id JOIN uefa_clubs a ON a.id=f.away_club_id WHERE f.season_id=$1 ORDER BY f.kickoff_date,f.matchday LIMIT 500", ["2026-2027"]);
    return NextResponse.json({ competitions, clubs, allClubs, fixtures }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("UEFA API", error);
    return NextResponse.json({ error: "Europese competities konden niet worden geladen." }, { status: 500 });
  }
}
