"use client";

import { useCallback, useEffect, useState } from "react";

type YouthPlayer = {
  id: string; full_name: string; age_years: number | null; nationality: string | null;
  position: string; overall_rating: number; potential_rating: number; source_url: string | null;
  promoted: boolean; promoted_to: string | null;
};
type Club = { id: string; name: string };

export default function JeugdPage() {
  const [players,setPlayers] = useState<YouthPlayer[]>([]);
  const [clubs,setClubs] = useState<Club[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState<string | null>(null);
  const [message,setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/youth-squad",{cache:"no-store"});
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Laden mislukt");
      setPlayers(data.players || []); setClubs(data.clubs || []);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Laden mislukt"); }
    finally { setLoading(false); }
  },[]);
  useEffect(() => { void load(); },[load]);
  async function promote(p: YouthPlayer, teamId: string) {
    if (!window.confirm(p.full_name + " overhevelen naar " + (clubs.find(c=>c.id===teamId)?.name || teamId) + "?")) return;
    setBusy(p.id); setMessage("");
    try {
      const r = await fetch("/api/youth-squad",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"promote",youthPlayerId:p.id,teamId})});
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Overhevelen mislukt");
      setMessage(p.full_name + " is overgeheveld naar " + (clubs.find(c=>c.id===teamId)?.name || teamId) + ".");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Overhevelen mislukt"); }
    finally { setBusy(null); }
  }
  const active = players.filter(p=>!p.promoted);
  return <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 md:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header><p className="text-sm uppercase tracking-[.25em] text-cyan-300">Ajax academy</p><h1 className="mt-2 text-3xl font-bold">Ajax O19</h1><p className="mt-2 text-slate-400">Jeugdselectie buiten de competitie-indeling, met doorstroom naar Jong Ajax en Ajax 1.</p></header>
      {message && <div role="status" className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">{message}</div>}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-sm text-slate-400">Jeugdspelers</p><p className="mt-1 text-2xl font-semibold">{active.length}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-sm text-slate-400">Overgeheveld</p><p className="mt-1 text-2xl font-semibold">{players.length-active.length}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-sm text-slate-400">Gem. beoordeling</p><p className="mt-1 text-2xl font-semibold">{active.length ? Math.round(active.reduce((n,p)=>n+p.overall_rating,0)/active.length) : "—"}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-sm text-slate-400">Gem. potentie</p><p className="mt-1 text-2xl font-semibold">{active.length ? Math.round(active.reduce((n,p)=>n+p.potential_rating,0)/active.length) : "—"}</p></div>
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><h2 className="font-semibold">Selectie</h2><button onClick={()=>void load()} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">Vernieuwen</button></div>
        {loading ? <p className="p-6 text-slate-400">Selectie laden…</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-950/60 text-slate-400"><tr>{["Speler","Leeftijd","Positie","Nat.","Beoordeling","Potentie","Overhevelen"].map(x=><th key={x} className="px-4 py-3 font-medium">{x}</th>)}</tr></thead><tbody>{players.map(p=><tr key={p.id} className="border-t border-slate-800"><td className="px-4 py-3 font-medium">{p.full_name}{p.promoted && <p className="text-xs text-emerald-300">Overgeheveld naar {p.promoted_to}</p>}</td><td className="px-4 py-3">{p.age_years ?? "—"}</td><td className="px-4 py-3">{p.position}</td><td className="px-4 py-3">{p.nationality || "—"}</td><td className="px-4 py-3 tabular-nums">{p.overall_rating}</td><td className="px-4 py-3 tabular-nums">{p.potential_rating}</td><td className="px-4 py-3">{p.promoted ? "Klaar" : <div className="flex gap-2">{clubs.map(c=><button key={c.id} disabled={!!busy} onClick={()=>void promote(p,c.id)} className="rounded-md bg-cyan-700 px-2.5 py-1.5 text-xs font-medium hover:bg-cyan-600 disabled:opacity-50">{busy===p.id ? "Bezig…" : c.name}</button>)}</div>}</td></tr>)}</tbody></table></div>}
      </section>
      <p className="text-xs leading-5 text-slate-500">Bron: publiek geïndexeerde FM26-clubdata. CA/PA is omgerekend van 0–200 naar 1–100. Exacte geboortedata en voorkeursvoet zijn niet voor alle spelers in de gebruikte openbare lijst beschikbaar; ontbrekende gegevens zijn daarom niet verzonnen.</p>
    </div>
  </main>;
}
