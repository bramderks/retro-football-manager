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
  const categoryMap: Array<[string, string]> = [
    ["goalkeeper", "GK"], ["left_back", "LB"], ["right_back", "RB"], ["defender", "CV"],
    ["defensive_midfielder", "VM"], ["midfielder", "CM"], ["attacking_midfielder", "AM"],
    ["left_wing", "AML"], ["right_wing", "AMR"], ["striker", "SP"], ["attacker", "SP"],
    ["wing_back", "RB"], ["sweeper", "CV"]
  ];
  if (positions && typeof positions === "object" && !Array.isArray(positions)) {
    const keys = Object.keys(positions as Record<string, unknown>);
    for (const [key, position] of categoryMap) if (keys.includes(key)) return position;
  }
  const list = Array.isArray(positions) ? positions : [positions];
  for (const entry of list) {
    const raw = typeof entry === "string" ? entry :
      entry && typeof entry === "object"
        ? String((entry as Record<string, unknown>).position ?? (entry as Record<string, unknown>).code ?? (entry as Record<string, unknown>).name ?? "")
        : "";
    const normalized = raw.trim().toLowerCase();
    const category = categoryMap.find(([key]) => key === normalized)?.[1];
    if (category) return category;
    const mapped = POSITION_MAP[raw.trim().toUpperCase()];
    if (mapped) return mapped;
  }
  return "CM";
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
        "is_active","career_status","source_type","source_cm_player_id","source_cm_staff_id",
        "source_cm_club_id","source_cm_nationality_id","source_cm_second_nationality_id",
        "source_current_ability","source_potential_ability","source_original_potential_ability",
        "source_pa_resolution_rule","source_club_name","positions","sides","attributes",
        "foot_attributes","source_current_ability_stars","source_potential_ability_stars",
        "source_randomize_zero_attributes","source_version"
      ];
      const params: unknown[] = [];
      const values = batch.map((p) => {
        const vals = [
          "cm0102-" + p.cmPlayerId, null, p.fullName, p.commonName, p.dob, null, p.position,
          p.preferredFoot, Math.max(1, Math.min(100, Math.round(30 + p.ca * 0.345))),
          Math.max(1, Math.min(100, Math.round(30 + p.pa * 0.345))), null, null, true, "active", "cm0102",
          p.cmPlayerId, p.cmStaffId, null, p.nationalityId, p.secondNationalityId, p.ca, p.pa,
          p.sourcePa, p.paRule, null, JSON.stringify(p.positions), JSON.stringify(p.sides), JSON.stringify(p.attributes),
          JSON.stringify(p.footAttributes), p.caStars, p.paStars, p.randomizeZeroAttributes,
          "CM0102 May 2026 Data Update"
        ];
        const start = params.length;
        params.push(...vals);
        return "(" + vals.map((_, j) => "$" + (start + j + 1)).join(",") + ")";
      });
      // CSV source data may refresh, but live ratings belong to career_player_states and must not be reset by a database import.
      const updateColumns = columns.filter(c => !["id","source_cm_player_id","team_id","source_cm_club_id","overall_rating","potential_rating"].includes(c));
      const query = `INSERT INTO public.players (${columns.join(",")}) VALUES ${values.join(",")}
        ON CONFLICT (source_cm_player_id) DO UPDATE SET
        ${updateColumns.map(c => `${c}=EXCLUDED.${c}`).join(",")},
        team_id=COALESCE(public.players.team_id, EXCLUDED.team_id),
        source_cm_club_id=COALESCE(public.players.source_cm_club_id, EXCLUDED.source_cm_club_id),
        source_club_name=COALESCE(public.players.source_club_name, EXCLUDED.source_club_name)`;
      await sql.query(query, params as any[]);

      // Retire duplicate non-CM seed rows before assigning canonical CM players to the same team/name slot.
      const ids = batch.map(p => Number(p.cmPlayerId));
      await sql.query(
        `UPDATE public.players old
            SET team_id=NULL,is_active=FALSE,career_status='inactive'
          WHERE old.source_cm_player_id IS NULL AND old.team_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.cm0102_player_club_assignments a
              JOIN public.cm0102_game_team_mappings m ON m.cm_club_id=a.cm_club_id
              JOIN public.players cm ON cm.source_cm_player_id=a.cm_player_id
              WHERE cm.source_cm_player_id=ANY($1::integer[]) AND m.team_id=old.team_id
                AND lower(BTRIM(old.full_name))=lower(BTRIM(cm.full_name))
            )`,
        [ids]
      );
      await sql.query(
        `UPDATE public.players p
            SET source_cm_club_id=a.cm_club_id, team_id=m.team_id, source_club_name=c.club_name,
                source_type='cm0102', is_active=TRUE, career_status='active'
           FROM public.cm0102_player_club_assignments a
           LEFT JOIN public.cm0102_game_team_mappings m ON m.cm_club_id=a.cm_club_id
           LEFT JOIN public.cm0102_clubs c ON c.cm_club_id=a.cm_club_id
          WHERE p.source_cm_player_id=a.cm_player_id
            AND p.source_cm_player_id = ANY($1::integer[])`,
        [ids]
      );
      // Reconcile baseline memberships when a refreshed CSV moves a player to another club.
      // Active career saves keep their current club in career_player_states.
      await sql.query(
        `DELETE FROM public.team_player_memberships tm
          USING public.players p
          WHERE tm.player_id=p.id AND tm.season_id='2026-2027'
            AND tm.membership_type='primary'
            AND p.source_cm_player_id = ANY($1::integer[])
            AND (p.team_id IS NULL OR tm.team_id<>p.team_id)`,
        [ids]
      );
      await sql.query(
        `INSERT INTO public.team_player_memberships(season_id,team_id,player_id,membership_type)
         SELECT d.season_id,p.team_id,p.id,'primary'
           FROM public.players p
           JOIN public.teams t ON t.id=p.team_id
           JOIN public.divisions d ON d.id=t.division_id
          WHERE d.season_id='2026-2027' AND p.source_cm_player_id = ANY($1::integer[])
            AND p.team_id IS NOT NULL AND p.is_active=TRUE
            AND NOT EXISTS (SELECT 1 FROM public.team_player_memberships y WHERE y.season_id=d.season_id AND y.player_id=p.id AND y.membership_type='youth-affiliate')
         ON CONFLICT(season_id,team_id,player_id) DO UPDATE SET membership_type='primary'`,
        [ids]
      );
      await sql.query(
        `INSERT INTO public.career_player_states(save_id,player_id,club_id,current_rating,potential_rating)
         SELECT s.id,p.id,COALESCE(tmSelected.team_id,tmPrimary.team_id,tmYouth.team_id,p.team_id),p.overall_rating,p.potential_rating
           FROM public.career_saves s CROSS JOIN public.players p
           LEFT JOIN public.team_player_memberships tmSelected ON tmSelected.player_id=p.id AND tmSelected.team_id=s.club_id AND tmSelected.season_id=s.season_id
           LEFT JOIN public.team_player_memberships tmPrimary ON tmPrimary.player_id=p.id AND tmPrimary.membership_type='primary' AND tmPrimary.season_id=s.season_id
           LEFT JOIN public.team_player_memberships tmYouth ON tmYouth.player_id=p.id AND tmYouth.membership_type='youth-affiliate' AND tmYouth.season_id=s.season_id
          WHERE p.source_cm_player_id = ANY($1::integer[])
            AND COALESCE(tmSelected.team_id,tmPrimary.team_id,tmYouth.team_id,p.team_id) IS NOT NULL AND p.is_active=TRUE
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
