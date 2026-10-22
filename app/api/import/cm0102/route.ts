import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ImportRow = Record<string, unknown>;
const ATTRIBUTES = [
  "acceleration","aggression","agility","anticipation","balance","bravery","consistency",
  "corners","crossing","decisions","dirtiness","dribbling","finishing","flair","free_kicks",
  "handling","heading","important_matches","injury_proneness","jumping","leadership",
  "long_shots","marking","movement","natural_fitness","one_on_ones","pace","passing",
  "penalties","positioning","reflexes","stamina","strength","tackling","teamwork",
  "technique","throw_ins","versatility","vision","work_rate","player_morale"
] as const;

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function jsonValue(value: unknown, fallback: unknown) {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value ?? fallback;
}
function clean(row: ImportRow) {
  const cmPlayerId = num(row.cm_player_id);
  const fullName = String(row.full_name ?? "").trim();
  if (cmPlayerId === null || !fullName) throw new Error("Elke speler moet een cm_player_id en full_name hebben.");
  const ca = num(row.current_ability);
  const pa = num(row.resolved_potential_ability ?? row.potential_ability);
  if (ca === null || ca < 0 || ca > 200 || pa === null || pa < 0 || pa > 200) {
    throw new Error("CA en PA moeten getallen tussen 0 en 200 zijn.");
  }
  const rawFoot = String(row.preferred_foot ?? "unknown").toLowerCase();
  const preferredFoot = ["right","left","both"].includes(rawFoot) ? rawFoot : "unknown";
  const attributes: Record<string, number | null> = {};
  for (const key of ATTRIBUTES) attributes[key] = num(row[key]);
  return {
    cmPlayerId, cmStaffId: num(row.cm_staff_id), fullName,
    commonName: String(row.common_name ?? "").trim() || null,
    dob: String(row.date_of_birth ?? "").trim() || null,
    nationalityId: num(row.nationality_id), secondNationalityId: num(row.second_nationality_id),
    ca, pa, sourcePa: num(row.source_potential_ability),
    paRule: String(row.pa_resolution_rule ?? "").trim() || null,
    positions: jsonValue(row.positions_json, []),
    sides: jsonValue(row.sides_json, []),
    preferredFoot,
    footAttributes: { left: num(row.left_foot), right: num(row.right_foot) },
    attributes,
    randomizeZeroAttributes: true
  };
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL ontbreekt in de Vercel-omgevingsvariabelen." }, { status: 500 });
  }
  try {
    const body = await request.json();
    const rows = body?.rows;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 1000) {
      return NextResponse.json({ error: "Stuur een batch van 1 tot 1000 spelers." }, { status: 400 });
    }
    const cleaned = rows.map(clean);
    const sql = neon(process.env.DATABASE_URL);
    let inserted = 0;
    for (let offset = 0; offset < cleaned.length; offset += 50) {
      const batch = cleaned.slice(offset, offset + 50);
      const columns = [
        "cm_player_id","cm_staff_id","full_name","common_name","date_of_birth",
        "nationality_id","second_nationality_id","current_ability","potential_ability",
        "source_potential_ability","pa_resolution_rule","current_ability_stars",
        "potential_ability_stars","positions","sides","preferred_foot","foot_attributes",
        "attributes","randomize_zero_attributes","source_version"
      ];
      const params: unknown[] = [];
      const values = batch.map((p, i) => {
        const vals = [
          p.cmPlayerId,p.cmStaffId,p.fullName,p.commonName,p.dob,p.nationalityId,
          p.secondNationalityId,p.ca,p.pa,p.sourcePa,p.paRule,
          Math.min(5, Math.round((p.ca / 40) * 10) / 10),
          Math.min(5, Math.round((p.pa / 40) * 10) / 10),
          JSON.stringify(p.positions),JSON.stringify(p.sides),p.preferredFoot,
          JSON.stringify(p.footAttributes),JSON.stringify(p.attributes),
          p.randomizeZeroAttributes,"CM0102 May 2026 Data Update"
        ];
        params.push(...vals);
        const start = i * columns.length;
        return "(" + vals.map((_, j) => "$" + (start + j + 1)).join(",") + ")";
      });
      const updateColumns = columns.filter(c => c !== "cm_player_id" && c !== "imported_at");
      const query = `INSERT INTO public.cm0102_player_profiles (${columns.join(",")}) VALUES ${values.join(",")} ON CONFLICT (cm_player_id) DO UPDATE SET ${updateColumns.map(c => `${c}=EXCLUDED.${c}`).join(",")}, imported_at=NOW()`;
      await sql.query(query, params as any[]);
      inserted += batch.length;
    }
    return NextResponse.json({ success: true, processed: inserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende importfout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
