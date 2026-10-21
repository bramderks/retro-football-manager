"use client";
import { useEffect, useState } from "react";
export default function EuropeanCompetitions() {
 const [data,setData]=useState<any>(null);
 const [code,setCode]=useState("UCL");
 const [error,setError]=useState("");
 useEffect(()=>{fetch("/api/uefa",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Laden mislukt");setData(d)}).catch(e=>setError(e.message||"Europese competities konden niet worden geladen."))},[]);
 const comp=data?.competitions?.find((c:any)=>c.code===code);
 const clubs=(data?.clubs||[]).filter((c:any)=>c.competition_id===comp?.id);
 const fixtures=(data?.fixtures||[]).filter((f:any)=>f.competition_id===comp?.id);
 return <main style={{maxWidth:1400,margin:"0 auto",padding:24,color:"var(--foreground,#eee)"}}>
 <p style={{letterSpacing:3,fontSize:12,opacity:.7}}>RETRO FOOTBALL MANAGER · SEIZOEN 2026/27</p>
 <h1 style={{fontSize:36,margin:"8px 0"}}>Europese competities</h1>
 <p style={{opacity:.8}}>De league phase is opgezet met 36 clubs per competitie. Champions League en Europa League spelen 8 speeldagen; Conference League speelt 6 speeldagen.</p>
 <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"22px 0"}}>{(data?.competitions||[]).map((c:any)=><button key={c.code} onClick={()=>setCode(c.code)} style={{padding:"10px 14px",borderRadius:8,border:"1px solid #555",background:code===c.code?"#d8e3f0":"#222",color:code===c.code?"#111":"#eee",cursor:"pointer"}}>{c.name}</button>)}</div>
 {error&&<p>{error}</p>}{!data&&!error&&<p>Competities laden…</p>}
 {data&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:20}}>
 <section style={{border:"1px solid #444",borderRadius:12,padding:16,overflow:"hidden"}}><h2>League-phaseoverzicht</h2><p style={{opacity:.7,fontSize:13}}>36 deelnemers · {comp?.matches_per_club} wedstrijden per club</p><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["#","Club","Land","G","DS","P"].map(x=><th key={x} style={{textAlign:"left",padding:"8px 5px",borderBottom:"1px solid #555"}}>{x}</th>)}</tr></thead><tbody>{clubs.map((c:any,i:number)=><tr key={c.club_id}><td style={{padding:6,borderBottom:"1px solid #333"}}>{i+1}</td><td style={{padding:6,borderBottom:"1px solid #333"}}>{c.name}</td><td style={{padding:6,borderBottom:"1px solid #333"}}>{c.country_code}</td><td style={{padding:6,borderBottom:"1px solid #333"}}>{c.played}</td><td style={{padding:6,borderBottom:"1px solid #333"}}>{Number(c.goals_for)-Number(c.goals_against)}</td><td style={{padding:6,borderBottom:"1px solid #333",fontWeight:700}}>{c.points}</td></tr>)}</tbody></table></div></section>
 <section style={{border:"1px solid #444",borderRadius:12,padding:16}}><h2>Programma</h2>{fixtures.map((f:any)=><div key={f.id} style={{display:"grid",gridTemplateColumns:"70px 1fr 32px",gap:8,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #333",fontSize:13}}><span style={{opacity:.7}}>{new Date(f.kickoff_date).toLocaleDateString("nl-NL",{day:"2-digit",month:"short"})}</span><span>{f.home_club} – {f.away_club}<small style={{display:"block",opacity:.6}}>Speeldag {f.matchday}</small></span><strong>{f.status==="played"?f.home_goals+"-"+f.away_goals:"—"}</strong></div>)}</section>
 </div>}
 <p style={{marginTop:24,fontSize:13,opacity:.65}}>Let op: dit is de opzet van de league phase. De koppeling met carrièredagen, echte uitslagverwerking en knock-outfases moet nog worden afgemaakt. De paringen zijn speldata en niet de officiële UEFA-loting.</p>
 </main>
}
