"use client";


import AppSidebar from "../components/AppSidebar";
import { useEffect, useState } from "react";

type Player = {
  id: number;
  full_name: string;
  legal_name: string;
  date_of_birth: string | null;
  nationality_id: number | null;
  current_ability: number | null;
  potential_ability: number | null;
  positions: unknown;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const raw=String(value);
  const match=raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
  const date=match ? new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12) : new Date(raw);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("nl-NL");
}

export default function FreeTransfersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(q = query) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/transfers/free?q=${encodeURIComponent(q)}&limit=200`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Laden mislukt.");
      setPlayers(data.players || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(""); }, []);

  return (<>
    <AppSidebar />
    <main style={{ minHeight: "100vh", padding: 24, background: "#171717", color: "#f2f2f2", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ borderBottom: "3px solid #315bdf", paddingBottom: 12, marginBottom: 18 }}>
          <div style={{ color: "#8da8ff", fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>RETRO FOOTBALL MANAGER</div>
          <h1 style={{ margin: "5px 0", fontSize: 28 }}>Transfermarkt — Free Transfers</h1>
          <div style={{ color: "#aaa", fontSize: 13 }}>CM 01/02 · spelers zonder geldige clubkoppeling · volledige spelersnamen</div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void load(); }} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek op voor- of achternaam…" aria-label="Zoek speler" style={{ flex: 1, minWidth: 0, padding: "11px 12px", color: "#fff", background: "#292929", border: "1px solid #555", borderRadius: 4 }} />
          <button type="submit" style={{ padding: "10px 18px", background: "#315bdf", color: "white", border: 0, borderRadius: 4, fontWeight: 700 }}>Zoeken</button>
        </form>

        <div style={{ color: "#bbb", fontSize: 13, marginBottom: 10 }}>{loading ? "Spelers laden…" : `${players.length} spelers weergegeven (maximaal 200 per zoekopdracht)`}</div>
        {error && <p role="alert" style={{ color: "#ff9292" }}>{error}</p>}
        <div style={{ overflowX: "auto", border: "1px solid #444", borderRadius: 4 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={{ background: "#252525", color: "#8da8ff", textAlign: "left" }}>
              <tr>{["Speler", "Geboortedatum", "Posities", "CA", "PA", "Status"].map((x) => <th key={x} style={{ padding: 11, borderBottom: "1px solid #444", whiteSpace: "nowrap" }}>{x}</th>)}</tr>
            </thead>
            <tbody>
              {players.map((p) => <tr key={p.id}>
                <td style={{ padding: 11, borderBottom: "1px solid #333", fontWeight: 700, whiteSpace: "nowrap" }}>{p.full_name}</td>
                <td style={{ padding: 11, borderBottom: "1px solid #333", whiteSpace: "nowrap" }}>{formatDate(p.date_of_birth)}</td>
                <td style={{ padding: 11, borderBottom: "1px solid #333" }}>{Array.isArray(p.positions) ? p.positions.join(", ") : "—"}</td>
                <td style={{ padding: 11, borderBottom: "1px solid #333" }}>{p.current_ability ?? "—"}</td>
                <td style={{ padding: 11, borderBottom: "1px solid #333" }}>{p.potential_ability ?? "—"}</td>
                <td style={{ padding: 11, borderBottom: "1px solid #333", color: "#8fe3a1", whiteSpace: "nowrap" }}>Free Transfer</td>
              </tr>)}
              {!loading && players.length === 0 && <tr><td colSpan={6} style={{ padding: 20, color: "#aaa" }}>Geen spelers gevonden.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main></>
  );
}
