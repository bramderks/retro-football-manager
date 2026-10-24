"use client";


import AppSidebar from "../../components/AppSidebar";
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
  if (rows.length < 2) throw new Error("Het CSV-bestand bevat geen koppelingen.");
  const headers = rows[0].map(h => h.replace(/^\uFEFF/, "").trim());
  const required = ["cm_player_id","cm_staff_id","cm_club_id","club_name","player_name"];
  const missing = required.filter(h => !headers.includes(h));
  if (missing.length) throw new Error("Dit is niet het CM0102-koppelbestand. Ontbrekende kolommen: " + missing.join(", "));
  return rows.slice(1).filter(r => r.some(v => v.trim() !== "")).map(r => {
    const item: CsvRow = {};
    headers.forEach((h, i) => item[h] = r[i] ?? "");
    return item;
  });
}

export default function Cm0102ClubImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importToken, setImportToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  async function startImport() {
    if (!file || !importToken.trim() || busy) return;
    setBusy(true); setError(""); setStatus("Bestand lezen…"); setProgress(0);
    try {
      const rows = parseCsv(await file.text());
      setTotal(rows.length);
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        let succeeded = false, lastError = "onbekende netwerkfout";
        for (let attempt = 1; attempt <= 3 && !succeeded; attempt++) {
          try {
            const response = await fetch("/api/import/cm0102-clubs", {
              method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + importToken.trim() },
              body: JSON.stringify({ rows: rows.slice(i, i + chunkSize) })
            });
            const body = await response.text();
            let result: { error?: string } = {};
            try { result = JSON.parse(body); }
            catch { throw new Error(`Server gaf geen geldig antwoord (HTTP ${response.status}). ${body.slice(0, 180)}`); }
            if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}: import mislukt`);
            succeeded = true;
          } catch (e) {
            lastError = e instanceof Error ? e.message : String(e);
            if (attempt < 3) {
              setStatus(`Batch ${Math.floor(i / chunkSize) + 1}: verbinding herstellen (poging ${attempt + 1}/3)…`);
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        }
        if (!succeeded) throw new Error(`Batch vanaf regel ${i + 1} is niet verwerkt: ${lastError}. Start opnieuw; batches worden zonder duplicaten bijgewerkt.`);
        const done = Math.min(i + chunkSize, rows.length);
        setProgress(done);
        setStatus(`Bezig: ${done.toLocaleString("nl-NL")} van ${rows.length.toLocaleString("nl-NL")} koppelingen verwerkt`);
      }
      setStatus(`Klaar! ${rows.length.toLocaleString("nl-NL")} CM0102-spelers zijn aan hun oorspronkelijke club gekoppeld.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import mislukt.");
      setStatus("De import is gestopt. Start opnieuw om veilig verder te verwerken.");
    } finally { setBusy(false); }
  }
  const percent = total ? Math.round(progress / total * 100) : 0;
  return <AppSidebar />
    <main style={{minHeight:"100vh",background:"#0b1220",color:"#e5edf7",padding:"36px 18px",fontFamily:"Arial,sans-serif"}}>
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <a href="/importeren" style={{color:"#9fb4cf",textDecoration:"none"}}>← Terug naar CM0102-import</a>
      <h1 style={{fontSize:32,margin:"26px 0 8px"}}>CM0102-clubkoppelingen importeren</h1>
      <p style={{color:"#a9b8cc",lineHeight:1.6}}>Upload <strong>cm0102_player_club_mapping.csv</strong>. Dit bestand koppelt iedere speler aan de oorspronkelijke club uit Data.zip. De bestaande spelers en opgeslagen carrières worden niet vervangen.</p>
      <section style={{marginTop:26,padding:24,border:"1px solid #26364d",borderRadius:16,background:"#111c2e"}}>
        <label htmlFor="import-token" style={{display:"block",fontWeight:700,marginBottom:8}}>Importbeveiligingscode</label><input id="import-token" type="password" autoComplete="current-password" value={importToken} disabled={busy} onChange={e=>setImportToken(e.target.value)} placeholder="Voer DATABASE_IMPORT_TOKEN in" style={{display:"block",width:"100%",padding:12,marginBottom:18,background:"#fff",border:"1px solid #96a6b2",color:"#172d40"}}/><p style={{fontSize:12,color:"#a9b8cc",marginBottom:14}}>De code moet overeenkomen met de beveiligingsvariabele in Vercel.</p><label htmlFor="mappingfile" style={{display:"block",fontWeight:700,marginBottom:12}}>Kies het koppelbestand</label>
        <input id="mappingfile" type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>{setFile(e.target.files?.[0] ?? null);setError("");setStatus("");setProgress(0);setTotal(0);}} style={{display:"block",width:"100%",padding:12,background:"#0b1220",border:"1px solid #34465f",borderRadius:8,color:"#e5edf7"}} />
        {file && <p style={{fontSize:14,color:"#a9b8cc"}}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
        <button disabled={!file || !importToken.trim() || busy} onClick={startImport} style={{marginTop:16,padding:"12px 18px",border:0,borderRadius:8,background:busy||!file?"#42516a":"#5be0a0",color:"#07140f",fontWeight:700,cursor:busy||!file?"not-allowed":"pointer"}}>
          {busy ? "Koppelingen importeren…" : "Clubkoppelingen importeren"}
        </button>
        {status && <div role="status" style={{marginTop:20,lineHeight:1.6}}>{status}</div>}
        {(busy || progress > 0) && total > 0 && <div style={{marginTop:12,height:10,background:"#26364d",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:percent+"%",background:"#5be0a0",transition:"width .2s"}} /></div>}
        {error && <div role="alert" style={{marginTop:18,padding:14,borderRadius:8,background:"#4a1e2a",color:"#ffdce2",lineHeight:1.5}}>{error}</div>}
      </section>
      <section style={{marginTop:20,color:"#a9b8cc",fontSize:14,lineHeight:1.7}}>
        <strong style={{color:"#e5edf7"}}>Wat doet deze import?</strong>
        <ul><li>Maakt een aparte CM0102-clubdatabase aan, met originele club-ID's en namen.</li><li>Koppelt spelers via hun CM0102-staff-ID aan de juiste club.</li><li>Werkt veilig opnieuw uit te voeren; bestaande carrières en de huidige spelersdatabase blijven intact.</li></ul>
      </section>
    </div>
  </main>;
}
