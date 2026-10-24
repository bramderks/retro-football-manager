import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const FIRST = ["Alex","Mateo","Luca","Noah","Milan","Elias","Adam","Jonas","Ruben","Daan","Finn","Youssef","Theo","Nico","Leo","Samir","Mats","Ibrahim","Victor","Oscar","Julian","Daniel","Kai","Amir","Sven","Tomas","Mika","Liam","Jesse","Robin"];
const LAST = ["van Dijk","Jansen","de Vries","Bakker","Visser","Smit","Meijer","de Jong","Willems","Peters","Fischer","Silva","Rossi","Garcia","Novak","Kovac","Martin","Schmidt","Andersson","Eriksen","Vermeer","Bos","Mulder","Costa","Meyer","Hassan","Diallo","Bennett","Santos","Kramer"];
const POSITIONS = ["GK","GK","LB","CB","CB","RB","DM","DM","CM","CM","CM","AM","LM","RM","LW","RW","ST","ST"];
const slug = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const hash = (value: string) => Array.from(value).reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 2147483647, 7);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const chunks = <T,>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
};

async function ensureYouthSquads(sql: any, seasonId: string) {
  const teams = await sql.query(
    "SELECT t.id,t.name,t.reputation,t.city FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id=$1 ORDER BY t.id",
    [seasonId]
  );
  const existing = await sql.query(
    "SELECT ys.id,ys.club_id,COUNT(yp.id)::int AS player_count FROM youth_squads ys LEFT JOIN youth_squad_players yp ON yp.squad_id=ys.id WHERE ys.season_id=$1 GROUP BY ys.id,ys.club_id ORDER BY ys.id",
    [seasonId]
  );
  const squadByClub = new Map<string, { id: string; count: number }>();
  for (const row of existing) {
    if (!squadByClub.has(String(row.club_id))) squadByClub.set(String(row.club_id), { id: String(row.id), count: Number(row.player_count || 0) });
  }
  const missingSquads: Array<{ id: string; clubId: string; name: string; seasonId: string }> = [];
  for (const team of teams) {
    if (squadByClub.has(String(team.id))) continue;
    const id = "youth-" + slug(String(team.id)) + "-" + seasonId;
    squadByClub.set(String(team.id), { id, count: 0 });
    missingSquads.push({ id, clubId: String(team.id), name: String(team.name) + " O19", seasonId });
  }
  for (const batch of chunks(missingSquads, 100)) {
    if (!batch.length) continue;
    const values = batch.map(() => "($1,$2,$3,$4)");
    const params: unknown[] = [];
    const rows = batch.map((item) => {
      const start = params.length;
      params.push(item.id, item.clubId, item.name, item.seasonId);
      return "(" + [1,2,3,4].map((n) => "$" + (start + n)).join(",") + ")";
    }).join(",");
    await sql.query("INSERT INTO youth_squads(id,club_id,name,season_id) VALUES " + rows + " ON CONFLICT(id) DO NOTHING", params);
  }

  const playerRows: unknown[][] = [];
  const membershipRows: unknown[][] = [];
  for (const team of teams) {
    const clubId = String(team.id);
    const squad = squadByClub.get(clubId)!;
    const targetCount = 18;
    const count = Math.min(targetCount, squad.count);
    const reputation = clamp(Number(team.reputation || 45), 1, 100);
    for (let i = count + 1; i <= targetCount; i++) {
      const seed = hash(clubId + ":" + seasonId + ":" + i);
      const seed2 = hash("potential:" + clubId + ":" + seasonId + ":" + i);
      const age = 15 + seed % 4;
      const year = Number(seasonId.slice(0, 4)) - age;
      const month = 1 + (seed2 % 12);
      const day = 1 + (seed % 27);
      const dob = year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
      const currentAbility = clamp(Math.round(13 + reputation * 0.37 + (seed % 23) - 11), 8, 65);
      // CA/PA deliberately varies across the full academy, not just a collection of wonderkids.
      // Club reputation lifts the average ceiling; high-end potential is uncommon and deterministic.
      const growth = 3 + (seed2 % 25) + Math.floor((reputation - 50) / 10) + (seed2 % 17 === 0 ? 10 : 0);
      const potentialAbility = clamp(currentAbility + growth, currentAbility, 95);
      const firstName = FIRST[seed % FIRST.length];
      const lastName = LAST[Math.floor(seed / 7) % LAST.length];
      const fullName = firstName + " " + lastName;
      const playerId = "regen-youth-" + slug(clubId) + "-" + seasonId + "-" + String(i).padStart(2, "0");
      const youthPlayerId = "youth-member-" + slug(clubId) + "-" + seasonId + "-" + String(i).padStart(2, "0");
      const position = POSITIONS[(seed + i) % POSITIONS.length];
      playerRows.push([
        playerId, fullName, firstName, dob, "Fictief", position, currentAbility, potentialAbility,
        seed % 9 - 4, String(team.name)
      ]);
      membershipRows.push([youthPlayerId, squad.id, playerId, age]);
    }
  }
  for (const batch of chunks(playerRows, 100)) {
    if (!batch.length) continue;
    const params: unknown[] = [];
    const rows = batch.map((item) => {
      const start = params.length;
      params.push(...item);
      return "(" + Array.from({ length: 10 }, (_, i) => "$" + (start + i + 1)).join(",") + ")";
    }).join(",");
    await sql.query(
      "INSERT INTO players(id,full_name,known_as,date_of_birth,nationality,position,overall_rating,potential_rating,development_bias,source_club_name) VALUES " + rows +
      " ON CONFLICT(id) DO NOTHING",
      params
    );
  }
  for (const batch of chunks(membershipRows, 100)) {
    if (!batch.length) continue;
    const params: unknown[] = [];
    const rows = batch.map((item) => {
      const start = params.length;
      params.push(...item);
      return "(" + Array.from({ length: 4 }, (_, i) => "$" + (start + i + 1)).join(",") + ")";
    }).join(",");
    await sql.query(
      "INSERT INTO youth_squad_players(id,squad_id,player_id,age_years) VALUES " + rows + " ON CONFLICT(id) DO NOTHING",
      params
    );
  }
  return { teams: teams.length, squadsCreated: missingSquads.length, playersCreated: membershipRows.length };
}

async function getSeason(sql: any) {
  const rows = await sql.query(
    "SELECT s.id FROM seasons s WHERE EXISTS (SELECT 1 FROM divisions d JOIN teams t ON t.division_id=d.id WHERE d.season_id=s.id) ORDER BY s.starts_on DESC NULLS LAST,s.id DESC LIMIT 1"
  );
  return String(rows[0]?.id || "2026-2027");
}

export async function GET(request: Request) {
  const conn = process.env.DATABASE_URL;
  if (!conn) return fail("DATABASE_URL ontbreekt.", 503);
  try {
    const sql = neon(conn);
    const seasonId = await getSeason(sql);
    const generated = await ensureYouthSquads(sql, seasonId);
    const clubs = await sql.query(
      "SELECT t.id,t.name,d.name AS division,d.tier,t.reputation FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id=$1 ORDER BY d.tier,d.country_code,t.name",
      [seasonId]
    );
    const url = new URL(request.url);
    const requestedClubId = url.searchParams.get("clubId");
    const selectedClubId = clubs.some((c: any) => String(c.id) === requestedClubId)
      ? String(requestedClubId)
      : String(clubs.find((c: any) => c.id === "ajax")?.id || clubs[0]?.id || "");
    const squadRows = await sql.query(
      "SELECT id,name FROM youth_squads WHERE club_id=$1 AND season_id=$2 ORDER BY created_at,id LIMIT 1",
      [selectedClubId, seasonId]
    );
    const squadId = squadRows[0]?.id ? String(squadRows[0].id) : "";
    const players = squadId ? await sql.query(
      "SELECT yp.id,yp.squad_id,yp.age_years,yp.promoted_at,yp.promoted_to_team_id,p.id AS player_id,p.full_name,p.nationality,p.position,p.preferred_foot,p.overall_rating,p.potential_rating,p.source_url,p.source_checked_at,(yp.promoted_at IS NOT NULL) AS promoted,t.name AS promoted_to FROM youth_squad_players yp JOIN players p ON p.id=yp.player_id LEFT JOIN teams t ON t.id=yp.promoted_to_team_id WHERE yp.squad_id=$1 ORDER BY yp.promoted_at NULLS FIRST,p.position,p.full_name",
      [squadId]
    ) : [];
    const squads = await sql.query(
      "SELECT ys.id,ys.name,ys.season_id,ys.club_id,t.name AS club_name,COUNT(yp.id) FILTER (WHERE yp.promoted_at IS NULL)::int AS active_players,COUNT(yp.id)::int AS total_players FROM youth_squads ys JOIN teams t ON t.id=ys.club_id LEFT JOIN youth_squad_players yp ON yp.squad_id=ys.id WHERE ys.season_id=$1 GROUP BY ys.id,t.name ORDER BY t.name",
      [seasonId]
    );
    const promotionTargets = clubs.filter((c: any) => String(c.id) === selectedClubId || (selectedClubId === "ajax" && String(c.id) === "jong-ajax"));
    return NextResponse.json(
      { seasonId, selectedClubId, selectedSquadId: squadId, clubs, promotionTargets, squads, players, generated },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("youth squad GET", error);
    return fail("Jeugdselecties konden niet worden geladen.", 500);
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
    if (!youthId || !teamId) return fail("Kies een jeugdspeler en een bestemming.");
    const sql = neon(conn);
    const seasonId = await getSeason(sql);
    const rows = await sql.query(
      "SELECT yp.id,yp.player_id,yp.squad_id,ys.club_id,p.full_name,p.overall_rating,p.potential_rating FROM youth_squad_players yp JOIN youth_squads ys ON ys.id=yp.squad_id JOIN players p ON p.id=yp.player_id WHERE yp.id=$1 AND ys.season_id=$2 AND yp.promoted_at IS NULL LIMIT 1",
      [youthId, seasonId]
    );
    if (!rows.length) return fail("Jeugdspeler niet gevonden of al overgeheveld.", 404);
    const p: any = rows[0];
    const sameClub = teamId === String(p.club_id);
    const ajaxReserve = String(p.club_id) === "ajax" && teamId === "jong-ajax";
    if (!sameClub && !ajaxReserve) return fail("Jeugdspelers kunnen alleen naar het eigen eerste elftal of Jong Ajax worden overgeheveld.");
    const target = await sql.query("SELECT id FROM teams WHERE id=$1 LIMIT 1", [teamId]);
    if (!target.length) return fail("Bestemming niet gevonden.", 404);
    const playerId = String(p.player_id);
    await sql.query("UPDATE players SET team_id=$2,is_active=TRUE,career_status='active' WHERE id=$1", [playerId, teamId]);
    await sql.query("DELETE FROM team_player_memberships WHERE season_id=$1 AND player_id=$2", [seasonId, playerId]);
    const membershipType = teamId === "jong-ajax" ? "youth-affiliate" : "primary";
    await sql.query(
      "INSERT INTO team_player_memberships(season_id,team_id,player_id,membership_type) VALUES($1,$2,$3,$4) ON CONFLICT(season_id,team_id,player_id) DO UPDATE SET membership_type=EXCLUDED.membership_type",
      [seasonId, teamId, playerId, membershipType]
    );
    await sql.query("UPDATE youth_squad_players SET promoted_to_team_id=$2,promoted_at=NOW() WHERE id=$1", [youthId, teamId]);
    await sql.query(
      "UPDATE career_player_states cps SET club_id=$2 FROM career_saves s WHERE cps.save_id=s.id AND s.club_id=$2 AND cps.player_id=$1",
      [playerId, teamId]
    );
    await sql.query(
      "INSERT INTO career_player_states(save_id,player_id,club_id,current_rating,potential_rating) SELECT s.id,p.id,$2,p.overall_rating,p.potential_rating FROM career_saves s JOIN players p ON p.id=$1 WHERE s.club_id=$2 ON CONFLICT(save_id,player_id) DO NOTHING",
      [playerId, teamId]
    );
    await sql.query(
      "INSERT INTO career_player_contracts(id,save_id,player_id,club_id,start_date,end_date,weekly_wage,squad_status,release_clause) SELECT 'contract-'||s.id||'-'||p.id,s.id,p.id,$2,CURRENT_DATE,($3::text||'-06-30')::date,GREATEST(500,p.overall_rating*p.overall_rating*2),'rotation',GREATEST(100000,p.overall_rating*p.overall_rating*900) FROM career_saves s JOIN players p ON p.id=$1 WHERE s.club_id=$2 ON CONFLICT DO NOTHING",
      [playerId, teamId, String(Number(seasonId.slice(0, 4)) + 2)]
    );
    return NextResponse.json({ ok: true, playerId, teamId, player: p.full_name });
  } catch (error) {
    console.error("youth squad POST", error);
    return fail("Overhevelen is mislukt.", 500);
  }
}
