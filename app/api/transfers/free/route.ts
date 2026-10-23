import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const connection = process.env.DATABASE_URL;
  if (!connection) return NextResponse.json({ error: "DATABASE_URL ontbreekt." }, { status: 503 });

  try {
    const sql = neon(connection);
    const url = new URL(request.url);
    const search = (url.searchParams.get("q") || "").trim();
    const parsedLimit = Number(url.searchParams.get("limit") || 100);
    const limit = Number.isFinite(parsedLimit) ? Math.min(200, Math.max(1, Math.trunc(parsedLimit))) : 100;
    const imported = await sql.query("SELECT COUNT(*)::int AS n FROM public.cm0102_player_club_assignments");
    if (Number(imported[0]?.n || 0) === 0) {
      return NextResponse.json(
        { error: "De oorspronkelijke CM 01/02-clubkoppelingen zijn nog niet geïmporteerd. De spelers worden niet onterecht als transfervrij getoond." },
        { status: 409 }
      );
    }
    const rows = await sql.query(
      `SELECT p.source_cm_player_id AS id,
              COALESCE(NULLIF(BTRIM(p.known_as), ''), NULLIF(BTRIM(p.full_name), '')) AS full_name,
              p.full_name AS legal_name,
              p.date_of_birth,
              p.source_cm_nationality_id AS nationality_id,
              p.source_current_ability AS current_ability,
              p.source_potential_ability AS potential_ability,
              p.source_positions AS positions,
              p.source_sides AS sides,
              p.preferred_foot,
              p.source_current_ability_stars AS current_ability_stars,
              p.source_potential_ability_stars AS potential_ability_stars
         FROM public.players p
         LEFT JOIN public.cm0102_player_club_assignments a ON a.cm_player_id = p.source_cm_player_id
        WHERE p.source_cm_player_id IS NOT NULL
          AND p.is_active = TRUE
          AND a.cm_player_id IS NULL
          AND COALESCE(p.full_name, '') <> ''
          AND ($1 = '' OR COALESCE(p.known_as, p.full_name, '') ILIKE '%' || $1 || '%')
        ORDER BY COALESCE(NULLIF(BTRIM(p.known_as), ''), p.full_name)
        LIMIT $2`,
      [search, limit]
    );
    return NextResponse.json({ players: rows, totalReturned: rows.length, playerStore: "players" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Free-transfer list failed", error);
    return NextResponse.json({ error: "Transfervrije spelers konden niet worden geladen." }, { status: 500 });
  }
}
