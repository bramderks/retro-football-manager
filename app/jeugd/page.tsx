"use client";

import AppSidebar from "../components/AppSidebar";
import { useCallback, useEffect, useState } from "react";

type YouthPlayer = {
  id: string;
  full_name: string;
  age_years: number | null;
  nationality: string | null;
  position: string;
  overall_rating: number;
  potential_rating: number;
  promoted: boolean;
  promoted_to: string | null;
};
type Club = { id: string; name: string; division?: string; tier?: number; reputation?: number };
type SquadSummary = { club_id: string; active_players: number; total_players: number };
type Payload = {
  seasonId: string;
  selectedClubId: string;
  clubs: Club[];
  promotionTargets: Club[];
  players: YouthPlayer[];
  squads: SquadSummary[];
};

export default function JeugdPage() {
  const [players, setPlayers] = useState<YouthPlayer[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [targets, setTargets] = useState<Club[]>([]);
  const [squads, setSquads] = useState<SquadSummary[]>([]);
  const [selectedClubId, setSelectedClubId] = useState("");
  const [seasonId, setSeasonId] = useState("2026-2027");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async (clubId?: string) => {
    setLoading(true);
    try {
      const query = clubId ? "?clubId=" + encodeURIComponent(clubId) : "";
      const response = await fetch("/api/youth-squad" + query, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Laden mislukt");
      const payload = data as Payload;
      setPlayers(payload.players || []);
      setClubs(payload.clubs || []);
      setTargets(payload.promotionTargets || []);
      setSquads(payload.squads || []);
      setSeasonId(payload.seasonId || "2026-2027");
      if (payload.selectedClubId) setSelectedClubId(payload.selectedClubId);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(selectedClubId || undefined); }, [load, selectedClubId]);

  async function promote(player: YouthPlayer, target: Club) {
    if (!window.confirm(player.full_name + " overhevelen naar " + target.name + "?")) return;
    setBusy(player.id);
    setMessage("");
    try {
      const response = await fetch("/api/youth-squad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "promote", youthPlayerId: player.id, teamId: target.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Overhevelen mislukt");
      setMessage(player.full_name + " is overgeheveld naar " + target.name + ".");
      await load(selectedClubId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Overhevelen mislukt");
    } finally {
      setBusy(null);
    }
  }

  const active = players.filter((player) => !player.promoted);
  const selectedClub = clubs.find((club) => club.id === selectedClubId);
  const squadByClub = new Map(squads.map((squad) => [squad.club_id, squad]));

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
    <AppSidebar />
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[.25em] text-cyan-300">Academy & jeugdopleiding</p>
          <h1 className="mt-2 text-3xl font-bold">{selectedClub ? selectedClub.name + " O19" : "Jeugdelftallen"}</h1>
          <p className="mt-2 max-w-2xl text-slate-400">Iedere club heeft een eigen jeugdelftal. Fictieve jeugdspelers staan in dezelfde centrale spelersdatabase als alle andere spelers. CA en PA verschillen per speler en worden mede bepaald door de clubreputatie.</p>
        </div>
        <label className="flex min-w-64 flex-col gap-2 text-sm text-slate-300">
          Club / jeugdelftal
          <select value={selectedClubId} onChange={(event) => setSelectedClubId(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100">
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name} — {club.division || "Competitie"}</option>)}
          </select>
        </label>
      </header>

      {message && <div role="status" className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">{message}</div>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-sm text-slate-400">Jeugdspelers</p><p className="mt-1 text-2xl font-semibold">{active.length}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-sm text-slate-400">Overgeheveld</p><p className="mt-1 text-2xl font-semibold">{players.length - active.length}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-sm text-slate-400">Gem. CA</p><p className="mt-1 text-2xl font-semibold">{active.length ? Math.round(active.reduce((sum, player) => sum + player.overall_rating, 0) / active.length) : "—"}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-sm text-slate-400">Gem. PA</p><p className="mt-1 text-2xl font-semibold">{active.length ? Math.round(active.reduce((sum, player) => sum + player.potential_rating, 0) / active.length) : "—"}</p></div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold">Jeugdselectie</h2><p className="mt-1 text-xs text-slate-500">Seizoen {seasonId} · clubreputatie {selectedClub?.reputation ?? "—"}/100 · {players.length} spelers</p></div>
          <button onClick={() => void load(selectedClubId)} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">Vernieuwen</button>
        </div>
        {loading ? <p className="p-6 text-slate-400">Jeugdelftallen laden en ontbrekende selecties aanvullen…</p> : players.length === 0 ? <p className="p-6 text-slate-400">Er zijn nog geen spelers voor dit jeugdelftal.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-slate-950/60 text-slate-400"><tr>{["Speler","Leeftijd","Positie","Nat.","CA","PA","Doorstromen"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody>{players.map((player) => <tr key={player.id} className="border-t border-slate-800">
            <td className="px-4 py-3 font-medium">{player.full_name}{player.promoted && <p className="text-xs text-emerald-300">Overgeheveld naar {player.promoted_to}</p>}</td>
            <td className="px-4 py-3">{player.age_years ?? "—"}</td><td className="px-4 py-3">{player.position}</td><td className="px-4 py-3">{player.nationality || "—"}</td>
            <td className="px-4 py-3 tabular-nums">{player.overall_rating}</td><td className="px-4 py-3 tabular-nums">{player.potential_rating}</td>
            <td className="px-4 py-3">{player.promoted ? "Klaar" : <div className="flex flex-wrap gap-2">{targets.map((target) => <button key={target.id} disabled={!!busy} onClick={() => void promote(player, target)} className="rounded-md bg-cyan-700 px-2.5 py-1.5 text-xs font-medium hover:bg-cyan-600 disabled:opacity-50">{busy === player.id ? "Bezig…" : target.name}</button>)}</div>}</td>
          </tr>)}</tbody>
        </table></div>}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-semibold">Jeugdopleiding per club</h2>
        <p className="mt-1 text-sm text-slate-400">Het systeem vult iedere clubselectie aan tot 18 spelers. Hogere reputatie verhoogt gemiddeld de CA/PA, maar de meeste spelers blijven gewone talenten; uitzonderlijke potentiële toppers zijn zeldzaam.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {clubs.map((club) => {
            const squad = squadByClub.get(club.id);
            return <button key={club.id} onClick={() => setSelectedClubId(club.id)} className="rounded-lg border border-slate-800 px-3 py-2 text-left hover:bg-slate-800">
              <span className="block font-medium">{club.name}</span>
              <span className="text-xs text-slate-500">{club.division || "Competitie"} · reputatie {club.reputation ?? "—"} · {squad?.active_players ?? 0} actief / {squad?.total_players ?? 0} totaal</span>
            </button>;
          })}
        </div>
      </section>
    </div>
  </main>;
}
