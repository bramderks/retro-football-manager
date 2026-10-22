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
  full_name: string | null;
  position: string | null;
  shirt_number: number | null;
  overall_rating: number | null;
  potential_rating: number | null;
  player_source_url: string | null;
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
        p.id AS player_id, p.full_name, p.position, p.shirt_number,
        p.overall_rating, p.potential_rating,
        p.source_url AS player_source_url,
        p.source_checked_at
      FROM teams t
      JOIN divisions d ON d.id = t.division_id
      LEFT JOIN (
        SELECT DISTINCT ON (team_id, lower(full_name))
          id, team_id, full_name, position, shirt_number, overall_rating, potential_rating,
          source_url, source_checked_at
        FROM all_players
        WHERE team_id IS NOT NULL AND is_active = TRUE AND record_source <> 'cm0102'
        ORDER BY team_id, lower(full_name), CASE WHEN record_source = 'current' THEN 0 ELSE 1 END, overall_rating DESC
      ) p ON p.team_id = t.id
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
      if (row.player_id && row.full_name && row.position) {
        teams.get(row.id)!.players.push({
          id: row.player_id,
          name: row.full_name,
          position: row.position,
          shirtNumber: row.shirt_number,
          overallRating: row.overall_rating ?? 55,
          potentialRating: row.potential_rating ?? 60,
          sourceUrl: row.player_source_url,
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
