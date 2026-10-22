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
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const rows = await sql.query(
      `SELECT p.cm_player_id AS id,
              COALESCE(NULLIF(BTRIM(p.common_name), ''), NULLIF(BTRIM(p.full_name), 'Onbekend'), p.full_name) AS full_name,
              p.full_name AS legal_name,
              p.date_of_birth,
              p.nationality_id,
              p.current_ability,
              p.potential_ability,
              p.positions,
              p.sides,
              p.preferred_foot
         FROM public.cm0102_player_profiles p
         LEFT JOIN public.cm0102_player_club_assignments a ON a.cm_player_id = p.cm_player_id
        WHERE a.cm_player_id IS NULL
          AND COALESCE(p.full_name, '') <> ''
          AND ($1 = '' OR COALESCE(p.common_name, p.full_name, '') ILIKE '%' || $1 || '%')
        ORDER BY COALESCE(NULLIF(BTRIM(p.common_name), ''), p.full_name)
        LIMIT $2`,
      [search, limit]
    );
    return NextResponse.json({ players: rows, totalReturned: rows.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Free-transfer list failed", error);
    return NextResponse.json({ error: "Transfervrije spelers konden niet worden geladen." }, { status: 500 });
  }
}
