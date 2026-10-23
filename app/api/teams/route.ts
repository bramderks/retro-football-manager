import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  city: string;
  division_id: string;
  division_name: string;
  tier: number;
  reputation: number;
  team_strength: number;
  player_id: string | null;
  player_name: string | null;
  position: string | null;
  overall_rating: number | null;
  potential_rating: number | null;
  source_checked_at: string | null;
};

export async function GET() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: "DATABASE_URL ontbreekt in de serveromgeving." }, { status: 503 });
  }

  try {
    const sql = neon(connectionString);
    const rows = await sql`
      SELECT
        t.id, t.name, t.city, t.division_id,
        d.name AS division_name, d.tier,
        t.reputation, t.team_strength,
        p.id AS player_id,
        COALESCE(NULLIF(BTRIM(p.known_as), ''), p.full_name) AS player_name,
        p.position, p.overall_rating, p.potential_rating, p.source_checked_at
      FROM teams t
      JOIN divisions d ON d.id = t.division_id
      LEFT JOIN team_player_memberships tm
        ON tm.team_id = t.id
       AND tm.season_id = d.season_id
      LEFT JOIN players p
        ON p.id = tm.player_id
       AND (p.source_cm_player_id IS NOT NULL OR p.source_type = 'regen')
       AND p.is_active = TRUE
       AND p.source_type IN ('cm0102','regen')
      WHERE d.season_id = '2026-2027'
      ORDER BY d.tier, t.name, p.position, p.full_name
    `;

    const teams = new Map<string, {
      id: string; name: string; city: string; divisionId: string;
      division: string; tier: number; reputation: number; teamStrength: number;
      players: Array<{ id: string; name: string; position: string; shirtNumber: number | null; overallRating: number; potentialRating: number; sourceUrl: string | null; sourceCheckedAt: string | null }>;
    }>();

    for (const row of rows as unknown as Row[]) {
      if (!teams.has(row.id)) {
        teams.set(row.id, {
          id: row.id,
          name: row.name,
          city: row.city,
          divisionId: row.division_id,
          division: row.division_name,
          tier: row.tier,
          reputation: row.reputation,
          teamStrength: row.team_strength,
          players: [],
        });
      }
      if (row.player_id && row.player_name && row.position) {
        teams.get(row.id)!.players.push({
          id: row.player_id,
          name: row.player_name,
          position: row.position,
          shirtNumber: null,
          overallRating: row.overall_rating ?? 50,
          potentialRating: row.potential_rating ?? 60,
          sourceUrl: null,
          sourceCheckedAt: row.source_checked_at,
        });
      }
    }

    const teamList = [...teams.values()];
    return NextResponse.json({
      season: "2026-2027",
      divisions: [
        { id: "eredivisie-2026-2027", name: "VriendenLoterij Eredivisie", tier: 1 },
        { id: "kkd-2026-2027", name: "Keuken Kampioen Divisie", tier: 2 },
      ],
      totals: {
        teams: teamList.length,
        players: teamList.reduce((sum, team) => sum + team.players.length, 0),
        source: "CM0102",
      },
      teams: teamList,
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Failed to load league database", error);
    return NextResponse.json({ error: "De competities konden niet uit de database worden geladen." }, { status: 500 });
  }
}
