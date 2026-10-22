"use client";

import { useState } from "react";

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field.length === 0) quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  if (rows.length < 2) throw new Error("Het CSV-bestand bevat geen spelersregels.");
  const headers = rows[0].map(h => h.replace(/^\uFEFF/, "").trim());
  const required = ["cm_player_id","full_name","current_ability","resolved_potential_ability","positions_json","sides_json"];
  const missing = required.filter(h => !headers.includes(h));
  if (missing.length) throw new Error("Dit lijkt niet het juiste CM0102-bestand. Ontbrekende kolommen: " + missing.join(", "));
  return rows.slice(1).filter(r => r.some(v => v.trim() !== "")).map(r => {
    const item: CsvRow = {};
    headers.forEach((h, i) => item[h] = r[i] ?? "");
    return item;
  });
}

export default function Cm0102ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  async function startImport() {
    if (!file || busy) return;
    setBusy(true); setError(""); setStatus("Bestand lezen…"); setProgress(0);
    try {
      const csv = await file.text();
      const rows = parseCsv(csv);
      setTotal(rows.length);
      setStatus("Spelers controleren en importeren…");
      const chunkSize = 1000;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const response = await fetch("/api/import/cm0102", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: rows.slice(i, i + chunkSize) })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(`Batch vanaf speler ${i + 1}: ${result.error ?? "import mislukt"}`);
        setProgress(Math.min(i + chunkSize, rows.length));
        setStatus(`Bezig: ${Math.min(i + chunkSize, rows.length).toLocaleString("nl-NL")} van ${rows.length.toLocaleString("nl-NL")} spelers verwerkt`);
      }
      setStatus(`Klaar! ${rows.length.toLocaleString("nl-NL")} spelers zijn naar Neon verstuurd. De import is opnieuw uitvoerbaar zonder dubbele spelers.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import mislukt.");
      setStatus("De import is gestopt. Reeds verwerkte batches blijven staan; start opnieuw om veilig verder te verwerken.");
    } finally { setBusy(false); }
  }
  const percent = total ? Math.round(progress / total * 100) : 0;
  return <main style={{minHeight:"100vh",background:"#0b1220",color:"#e5edf7",padding:"36px 18px",fontFamily:"Arial,sans-serif"}}>
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <a href="/" style={{color:"#9fb4cf",textDecoration:"none"}}>← Terug naar Retro Football Manager</a>
      <h1 style={{fontSize:32,margin:"26px 0 8px"}}>CM0102-spelers importeren</h1>
      <p style={{color:"#a9b8cc",lineHeight:1.6}}>Upload het bestand <strong>cm0102_players_correctly_decoded.csv</strong>. De spelers worden in batches verwerkt en op CM-speler-ID bijgewerkt, zodat opnieuw starten geen dubbele spelers oplevert.</p>
      <section style={{marginTop:26,padding:24,border:"1px solid #26364d",borderRadius:16,background:"#111c2e"}}>
        <label htmlFor="csvfile" style={{display:"block",fontWeight:700,marginBottom:12}}>Kies het CSV-bestand</label>
        <input id="csvfile" type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>{setFile(e.target.files?.[0] ?? null);setError("");setStatus("");setProgress(0);setTotal(0);}} style={{display:"block",width:"100%",padding:12,background:"#0b1220",border:"1px solid #34465f",borderRadius:8,color:"#e5edf7"}} />
        {file && <p style={{fontSize:14,color:"#a9b8cc"}}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
        <button disabled={!file || busy} onClick={startImport} style={{marginTop:16,padding:"12px 18px",border:0,borderRadius:8,background:busy||!file?"#42516a":"#5be0a0",color:"#07140f",fontWeight:700,cursor:busy||!file?"not-allowed":"pointer"}}>
          {busy ? "Import bezig…" : "Import starten"}
        </button>
        {status && <div role="status" style={{marginTop:20,lineHeight:1.6}}>{status}</div>}
        {(busy || progress > 0) && total > 0 && <div style={{marginTop:12,height:10,background:"#26364d",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:percent+"%",background:"#5be0a0",transition:"width .2s"}} /></div>}
        {error && <div role="alert" style={{marginTop:18,padding:14,borderRadius:8,background:"#4a1e2a",color:"#ffdce2",lineHeight:1.5}}>{error}</div>}
      </section>
      <section style={{marginTop:20,color:"#a9b8cc",fontSize:14,lineHeight:1.7}}>
        <strong style={{color:"#e5edf7"}}>Wat wordt meegenomen?</strong>
        <ul><li>CA en opgeloste PA (0–200), plus de oorspronkelijke PA-code</li><li>Posities, speelzijden, voetvoorkeur en voetvaardigheid</li><li>Alle spelerattributen; nulwaarden blijven gemarkeerd voor randomisatie bij de start van een spel</li></ul>
      </section>
    </div>
  </main>;
}
