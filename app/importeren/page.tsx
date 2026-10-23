"use client";

import { useState } from "react";

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const delimiters = [",", ";", "\t"];
  const delimiter = delimiters.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field.length === 0) quoted = true;
    else if (ch === delimiter) { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  if (rows.length < 2) throw new Error("Het CSV-bestand bevat geen spelersregels.");
  const headers = rows[0].map(h => h.replace(/^\uFEFF/, "").trim().toLowerCase());
  const required = ["cm_player_id", "full_name", "current_ability", "positions_json", "sides_json"];
  const missing = required.filter(h => !headers.includes(h));
  if (missing.length) throw new Error("Dit lijkt niet het juiste CM0102-bestand. Ontbrekende kolommen: " + missing.join(", "));
  if (!headers.includes("resolved_potential_ability") && !headers.includes("potential_ability")) {
    throw new Error("CSV mist de kolom resolved_potential_ability of potential_ability.");
  }
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
      const rows = parseCsv(await file.text());
      setTotal(rows.length);
      setStatus("Spelers controleren en importeren…");
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        let lastError = "onbekende netwerkfout", succeeded = false;
        for (let attempt = 1; attempt <= 3 && !succeeded; attempt++) {
          try {
            const response = await fetch("/api/import/cm0102", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: rows.slice(i, i + chunkSize) }) });
            const responseText = await response.text();
            let result: { error?: string } = {};
            try { result = JSON.parse(responseText); }
            catch { throw new Error(`Server gaf geen geldig antwoord (HTTP ${response.status}). ${responseText.slice(0, 180)}`); }
            if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}: import mislukt`);
            succeeded = true;
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            if (attempt < 3) { setStatus(`Batch ${Math.floor(i / chunkSize) + 1}: verbinding herstellen (poging ${attempt + 1}/3)…`); await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); }
          }
        }
        if (!succeeded) throw new Error(`Batch vanaf speler ${i + 1}: ${lastError}. Start opnieuw; reeds verwerkte spelers worden veilig bijgewerkt zonder duplicaten.`);
        setProgress(Math.min(i + chunkSize, rows.length));
        setStatus(`Bezig: ${Math.min(i + chunkSize, rows.length).toLocaleString("nl-NL")} van ${rows.length.toLocaleString("nl-NL")} spelers verwerkt`);
      }
      setStatus(`Klaar: ${rows.length.toLocaleString("nl-NL")} spelers geïmporteerd of bijgewerkt in de centrale database.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import mislukt.");
      setStatus("Import gestopt. Reeds verwerkte batches blijven staan; start opnieuw om veilig verder te gaan.");
    } finally { setBusy(false); }
  }
  const percent = total ? Math.round(progress / total * 100) : 0;
  return <main className="import-page">
    <div className="import-wrap">
      <div className="import-top"><a href="/">← Terug naar Retro Football Manager</a><span>DATABASEBEHEER / CM 01/02</span></div>
      <header className="import-header"><div className="import-mark">CM</div><div><div className="import-kicker">CENTRALE SPELERSDATABASE</div><h1>Spelersbestand importeren</h1><p>Werk de centrale database bij vanuit een CM 01/02 CSV-export. Teams, selecties, transfers en profielen blijven naar dezelfde spelerrecords verwijzen.</p></div></header>
      <section className="import-panel">
        <div className="import-panel-head"><div><span className="import-kicker">STAP 1</span><h2>Kies je CSV-bestand</h2></div><span className="import-chip">CSV · UTF-8</span></div>
        <label className="import-drop" htmlFor="csvfile"><span className="import-file-icon">↑</span><strong>{file ? file.name : "Selecteer een CM0102-spelersbestand"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · klaar om te controleren` : "Komma-, puntkomma- en tabgescheiden CSV worden ondersteund."}</small><input id="csvfile" type="file" accept=".csv,text/csv" disabled={busy} onChange={e => {setFile(e.target.files?.[0] ?? null);setError("");setStatus("");setProgress(0);setTotal(0);}} /></label>
        <div className="import-actions"><div><strong>Importmodus: bijwerken + toevoegen</strong><small>CM-speler-ID is de unieke sleutel; bestaande spelers worden niet dubbel aangemaakt.</small></div><button disabled={!file || busy} onClick={startImport}>{busy ? "Import bezig…" : "Import starten →"}</button></div>
        {status && <div className="import-status" role="status"><div>{status}</div>{total > 0 && <><div className="import-progress"><span style={{width: percent + "%"}} /></div><small>{percent}% · {progress.toLocaleString("nl-NL")} / {total.toLocaleString("nl-NL")}</small></>}</div>}
        {error && <div role="alert" className="import-error">{error}</div>}
      </section>
      <div className="import-info-grid"><section className="import-info"><h3>Wordt bijgewerkt</h3><ul><li>Naam, geboortedatum en nationaliteiten</li><li>CA, PA en oorspronkelijke PA-bron</li><li>Posities, speelzijden en voetvoorkeur</li><li>Alle beschikbare technische, mentale en fysieke attributen</li></ul></section><section className="import-info"><h3>Veilig importeren</h3><ul><li>Herhaalde imports voorkomen dubbele spelers</li><li>Loopbaanontwikkeling en gespeelde transfers blijven behouden</li><li>Grote bestanden worden in kleine batches verwerkt</li><li>Bij een onderbreking kan dezelfde CSV opnieuw worden ingelezen</li></ul></section></div>
      <footer className="import-footer">RETRO FOOTBALL MANAGER <span>·</span> CENTRALE DATABASE</footer>
    </div>
    <style jsx>{`
      .import-page{min-height:100vh;background:#d4dde4;color:#1a3449;font:13px Arial,Helvetica,sans-serif;padding:26px 18px 42px}
      .import-wrap{max-width:900px;margin:0 auto}
      .import-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:16px;border-bottom:1px solid #a9b8c3;color:#4d6678;font-size:11px;font-weight:bold;letter-spacing:.08em}
      .import-top a{color:#235b87;text-decoration:none;letter-spacing:0}
      .import-header{display:flex;gap:18px;align-items:center;padding:28px 0 24px}
      .import-mark{display:grid;place-items:center;flex:0 0 62px;height:62px;background:#244f72;color:white;border:3px solid #fff;outline:1px solid #244f72;font-weight:900;font-size:22px}
      .import-kicker{color:#2b638f;font-size:10px;font-weight:800;letter-spacing:.12em}
      h1{font-size:29px;margin:6px 0 8px;color:#183b56} .import-header p{max-width:690px;margin:0;color:#5a6e7d;line-height:1.6}
      .import-panel{background:#f6f8f9;border:1px solid #9eafbb;box-shadow:0 2px 5px #243f5410}
      .import-panel-head{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;background:#e6edf2;border-bottom:1px solid #b3c1ca}
      .import-panel-head h2{font-size:17px;margin:5px 0 0;color:#193d58}.import-chip{padding:6px 8px;border:1px solid #a5b7c4;background:#f8fafb;color:#3e5e75;font-size:10px;font-weight:bold}
      .import-drop{display:flex;flex-direction:column;align-items:center;text-align:center;margin:20px;padding:28px 14px;border:2px dashed #9eafbb;background:#fff;cursor:pointer;gap:8px}
      .import-file-icon{display:grid;place-items:center;width:38px;height:38px;background:#e4edf4;color:#255f8d;font-size:23px;font-weight:bold}
      .import-drop strong{font-size:14px;color:#203e54}.import-drop small{color:#647887}.import-drop input{max-width:100%;margin-top:10px;color:#536c7d}
      .import-actions{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 20px;border-top:1px solid #d0d9df;background:#edf2f5}
      .import-actions div{display:flex;flex-direction:column;gap:5px}.import-actions strong{font-size:12px}.import-actions small{color:#627888;line-height:1.5}
      button{padding:11px 16px;background:#285f8c;color:#fff;border:1px solid #1d4b70;font-weight:bold;white-space:nowrap;cursor:pointer}
      button:disabled{background:#b6c3cc;border-color:#a8b6c0;color:#637785;cursor:not-allowed}
      .import-status{padding:15px 20px;background:#edf6f0;color:#235d3b;line-height:1.5;border-top:1px solid #c1d8c9}
      .import-progress{height:9px;background:#d2e2d7;margin:10px 0 5px}.import-progress span{display:block;height:100%;background:#43875b;transition:width .2s}
      .import-error{margin:16px;padding:12px;background:#fbecea;border:1px solid #dfb3ae;color:#8a2c25;line-height:1.5}
      .import-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
      .import-info{background:#f3f6f8;border:1px solid #b1bec7;padding:16px 18px}.import-info h3{font-size:13px;color:#244e70;margin:0 0 9px}
      .import-info ul{padding-left:18px;margin:0;color:#526a7b;line-height:1.85}
      .import-footer{padding-top:20px;color:#687c8a;font-size:10px;letter-spacing:.09em}.import-footer span{padding:0 6px;color:#2b638f}
      @media(max-width:600px){.import-page{padding:16px 10px}.import-header{align-items:flex-start;gap:12px}.import-mark{flex-basis:48px;height:48px;font-size:17px}h1{font-size:23px}.import-info-grid{grid-template-columns:1fr}.import-actions{align-items:stretch;flex-direction:column}.import-actions button{width:100%}.import-drop{margin:12px;padding:20px 10px}}
    `}</style>
  </main>;
}
