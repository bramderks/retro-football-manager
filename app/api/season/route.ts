import { NextResponse } from "next/server";
import { POST as generateWorldSeason } from "../world/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One season engine only: the world route owns fixtures, promotion/relegation,
// canonical player aging and team memberships. Keep this older endpoint as a
// compatibility alias instead of maintaining a second roster generator.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const forwarded = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        fromSeason: body.fromSeason || "2026-2027",
        season: body.season || "2027-2028",
      }),
    });
    return await generateWorldSeason(forwarded);
  } catch (error) {
    console.error("season compatibility route", error);
    return NextResponse.json({ error: "Nieuw seizoen kon niet worden opgebouwd." }, { status: 500 });
  }
}
