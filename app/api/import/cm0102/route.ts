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
const POSITION_MAP: Record<string, string> = {
  K:"GK", GK:"GK", KEEP:"GK", GOALKEEPER:"GK",
  DL:"LB", LB:"LB", LV:"LB", DCL:"CV", DC:"CV", DCR:"CV", CB:"CV", CV:"CV",
  DR:"RB", RB:"RB", RV:"RB", WBL:"LB", WBR:"RB", DMC:"VM", DM:"VM", VM:"VM",
  MC:"CM", MCL:"CM", MCR:"CM", ML:"LM", AML:"AML", MLW:"AML", MR:"RM", AMR:"AMR", MRW:"AMR",
  AMC:"AM", AM:"AM", FC:"SP", SC:"SP", ST:"SP", SCL:"SP", SCR:"SP", FCL:"SP", FCR:"SP",
  FL:"LA", FR:"RA", AMLF:"LA", AMRF:"RA"
};

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
function primaryPosition(positions: unknown): string {
  const list = Array.isArray(positions) ? positions : [positions];
  for (const entry of list) {
    const raw = typeof entry === "string" ? entry :
      entry && typeof entry === "object"
        ? String((entry as Record<string, unknown>).position ?? (entry as Record<string, unknown>).code ?? (entry as Record<string, unknown>).name ?? "")
        : "";
    const mapped = POSITION_MAP[raw.trim().toUpperCase()];
    if (mapped) return mapped;
  }
  return "SP";
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
  const positions = jsonValue(row.positions_json, []);
  const sides = jsonValue(row.sides_json, []);
  const left = num(row.left_foot);
  const right = num(row.right_foot);
  const rawFoot = String(row.preferred_foot ?? "").toLowerCase();
  const preferredFoot = left === 20 && right === 20 ? "both" :
    ["right", "left", "both"].includes(rawFoot) ? rawFoot :
    left !== null && right !== null && left !== right ? (left > right ? "left" : "right") : null;
  const attributes: Record<string, number | null> = {};
  for (const key of ATTRIBUTES) attributes[key] = num(row[key]);
  return {
    cmPlayerId, cmStaffId: num(row.cm_staff_id), fullName,
    commonName: String(row.common_name ?? "").trim() || null,
    dob: String(row.date_of_birth ?? "").trim() || null,
    nationalityId: num(row.nationality_id), secondNationalityId: num(row.second_nationality_id),
    ca, pa, sourcePa: num(row.source_potential_ability),
    paRule: String(row.pa_resolution_rule ?? "").trim() || null,
    positions, sides, position: primaryPosition(positions), preferredFoot,
    footAttributes: { left, right }, attributes,
    caStars: Math.min(5, Math.round((ca / 40) * 10) / 10),
    paStars: Math.min(5, Math.round((pa / 40) * 10) / 10),
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
    let processed = 0;
    for (let offset = 0; offset < cleaned.length; offset += 25) {
      const batch = cleaned.slice(offset, offset + 25);
      const columns = [
        "id","team_id","full_name","known_as","date_of_birth","nationality","position",
        "preferred_foot","overall_rating","potential_rating","source_url","source_checked_at",
        "is_active","career_status","record_source","cm_player_id","cm_staff_id","cm_nationality_id",
        "cm_second_nationality_id","cm_current_ability","cm_potential_ability","cm_source_potential_ability",
        "cm_pa_resolution_rule","cm_positions","cm_sides","cm_attributes","cm_foot_attributes",
        "cm_current_ability_stars","cm_potential_ability_stars","cm_randomize_zero_attributes","source_version"
      ];
      const params: unknown[] = [];
      const values = batch.map((p) => {
        const vals = [
          "cm0102-" + p.cmPlayerId, null, p.fullName, p.commonName, p.dob, null, p.position,
          p.preferredFoot, Math.max(1, Math.min(100, Math.round(p.ca / 2))),
          Math.max(1, Math.min(100, Math.round(p.pa / 2))), null, null, true, "active", "cm0102",
          p.cmPlayerId, p.cmStaffId, p.nationalityId, p.secondNationalityId, p.ca, p.pa,
          p.sourcePa, p.paRule, JSON.stringify(p.positions), JSON.stringify(p.sides),
          JSON.stringify(p.attributes), JSON.stringify(p.footAttributes), p.caStars, p.paStars,
          p.randomizeZeroAttributes, "CM0102 May 2026 Data Update"
        ];
        const start = params.length;
        params.push(...vals);
        return "(" + vals.map((_, j) => "$" + (start + j + 1)).join(",") + ")";
      });
      const updateColumns = columns.filter(c => !["id","cm_player_id","team_id","cm_club_id"].includes(c));
      const query = `INSERT INTO public.players (${columns.join(",")}) VALUES ${values.join(",")}
        ON CONFLICT (cm_player_id) WHERE cm_player_id IS NOT NULL DO UPDATE SET
        ${updateColumns.map(c => `${c}=EXCLUDED.${c}`).join(",")},
        team_id=COALESCE(public.players.team_id, EXCLUDED.team_id),
        cm_club_id=public.players.cm_club_id,
        club_name=public.players.club_name`;
      await sql.query(query, params as any[]);

      // If club assignments were imported first, immediately attach the canonical player records.
      const ids = batch.map(p => Number(p.cmPlayerId));
      await sql.query(
        `UPDATE public.players p
            SET cm_club_id=a.cm_club_id, team_id=m.team_id, club_name=t.name,
                record_source='cm0102', is_active=TRUE, career_status='active'
           FROM public.cm0102_player_club_assignments a
           JOIN public.cm0102_game_team_mappings m ON m.cm_club_id=a.cm_club_id
           JOIN public.teams t ON t.id=m.team_id
          WHERE p.cm_player_id=a.cm_player_id
            AND p.cm_player_id = ANY($1::bigint[])
            AND NOT EXISTS (
              SELECT 1 FROM public.players other
               WHERE other.team_id=m.team_id AND other.id<>p.id
                 AND other.is_active=TRUE
                 AND lower(BTRIM(other.full_name))=lower(BTRIM(p.full_name))
            )`,
        [ids]
      );
      await sql.query(
        `INSERT INTO public.career_player_states(save_id,player_id,club_id,current_rating,potential_rating)
         SELECT s.id,p.id,p.team_id,p.overall_rating,p.potential_rating
           FROM public.career_saves s CROSS JOIN public.players p
          WHERE p.cm_player_id = ANY($1::bigint[]) AND p.team_id IS NOT NULL
         ON CONFLICT(save_id,player_id) DO NOTHING`,
        [ids]
      );
      processed += batch.length;
    }
    return NextResponse.json({ success: true, processed, playerStore: "players", canonicalSource: "CM0102" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende importfout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
