import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
 const conn=process.env.DATABASE_URL;
 if(!conn)return NextResponse.json({error:"DATABASE_URL ontbreekt."},{status:503});
 try {
  const sql=neon(conn),url=new URL(request.url),season=url.searchParams.get("season")||"2026-2027";
  const events=await sql.query("SELECT id,season_id,event_date,event_type,title,description,status FROM season_calendar WHERE season_id=$1 UNION ALL SELECT 'uefa-calendar-'||f.id AS id,f.season_id,f.kickoff_date AS event_date,'uefa_match' AS event_type,c.name||' · '||h.name||' – '||a.name AS title,'Europese wedstrijd · speelronde '||f.matchday||' · '||f.stage AS description,f.status FROM uefa_fixtures f JOIN uefa_competitions c ON c.id=f.competition_id JOIN uefa_clubs h ON h.id=f.home_club_id JOIN uefa_clubs a ON a.id=f.away_club_id WHERE f.season_id=$1 ORDER BY event_date,event_type,title",[season]);
  const seasons=await sql.query("SELECT id,label,starts_on,ends_on FROM seasons ORDER BY starts_on DESC LIMIT 10");
  return NextResponse.json({season,events,seasons},{headers:{"Cache-Control":"no-store"}});
 } catch(e) { console.error("calendar GET",e);return NextResponse.json({error:"Kalender kon niet worden geladen."},{status:500});}
}
