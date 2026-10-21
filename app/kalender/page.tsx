"use client";
import {useEffect,useState} from "react";
export default function SeasonCalendar(){
 const [data,setData]=useState<any>(null),[season,setSeason]=useState("2026-2027"),[error,setError]=useState("");
 useEffect(()=>{fetch("/api/calendar?season="+encodeURIComponent(season),{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Kalender laden mislukt");setData(d)}).catch(e=>setError(e.message||"Kalender laden mislukt"))},[season]);
 const fmt=(s:string)=>new Date(s+"T12:00:00Z").toLocaleDateString("nl-NL",{weekday:"short",day:"2-digit",month:"short",year:"numeric",timeZone:"Europe/Amsterdam"});
 const groups:Record<string,any[]>={};for(const e of data?.events||[]){const key=e.event_date.slice(0,7);(groups[key] ||= []).push(e)}
 return <main style={{maxWidth:1050,margin:"0 auto",padding:24,color:"var(--foreground,#eee)"}}>
 <p style={{fontSize:12,letterSpacing:3,opacity:.65}}>RETRO FOOTBALL MANAGER · PLANNING</p><h1 style={{fontSize:36,margin:"8px 0"}}>Seizoenskalender</h1>
 <p style={{opacity:.8}}>Wedstrijddagen, transferwindows, Europese rondes en het jaarlijkse zomeronderhoud op één tijdlijn.</p>
 <div style={{margin:"20px 0"}}><label htmlFor="season">Seizoen </label><select id="season" value={season} onChange={e=>setSeason(e.target.value)} style={{padding:10,marginLeft:8,borderRadius:8}}>{(data?.seasons||[{id:"2026-2027",label:"2026/27"},{id:"2027-2028",label:"2027/28"}]).map((s:any)=><option key={s.id} value={s.id}>{s.label||s.id}</option>)}</select></div>
 {error&&<p>{error}</p>}{!data&&!error&&<p>Kalender laden…</p>}
 {data&&Object.keys(groups).sort().map(month=><section key={month} style={{marginBottom:26}}><h2 style={{fontSize:20,borderBottom:"1px solid #555",paddingBottom:8}}>{new Date(month+"-01T12:00:00Z").toLocaleDateString("nl-NL",{month:"long",year:"numeric",timeZone:"Europe/Amsterdam"})}</h2>{groups[month].map((e:any)=><article key={e.id} style={{display:"grid",gridTemplateColumns:"125px 1fr",gap:14,padding:"12px 0",borderBottom:"1px solid #333"}}><time style={{opacity:.7}}>{fmt(e.event_date)}</time><div><strong>{e.title}</strong><p style={{margin:"4px 0 0",opacity:.7,fontSize:13}}>{e.description||e.event_type.replaceAll("_"," ")}</p></div></article>)}</section>)}
 <section style={{border:"1px solid #555",borderRadius:10,padding:16,marginTop:20}}><h2>Automatische zomerfase</h2><p style={{opacity:.8}}>Op 1 juli hoort het spel de eindstanden vast te leggen, promotie en degradatie toe te passen, Europese plaatsen toe te wijzen, selecties tot minimaal 20 spelers aan te vullen en het volledige rooster voor het volgende seizoen te genereren.</p><p style={{fontSize:13,opacity:.65}}>De kalender is aangesloten op de database. De automatische seizoenswissel is nog niet volledig aangesloten op het doorspelen van de carrière.</p></section>
 </main>
}
