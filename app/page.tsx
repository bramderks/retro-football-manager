"use client";

import { useEffect, useMemo, useState } from "react";

type Team = { name: string; rating: number; reputation: number; keeper: number };
type Tactics = { mentality: string; passing: string; pressing: boolean; offside: boolean; counter: boolean; hardTackles: boolean };
type EventLine = { minute: number | string; text: string; kind?: "goal" | "var" | "system" };
type Scorer = { team: 0 | 1; minute: number; name: string; assist?: string; penalty?: boolean };
type Player = { name: string; position: "keeper" | "defender" | "midfielder" | "forward" };
const AJAX_PLAYERS: Player[] = [
  { name: "Pasveer", position: "keeper" }, { name: "Hato", position: "defender" }, { name: "Sutalo", position: "defender" }, { name: "Rensch", position: "defender" },
  { name: "Taylor", position: "midfielder" }, { name: "Klaassen", position: "midfielder" }, { name: "Berghuis", position: "midfielder" },
  { name: "Godts", position: "forward" }, { name: "Brobbey", position: "forward" }, { name: "Akpom", position: "forward" }
];
const NEC_PLAYERS: Player[] = [
  { name: "Cillessen", position: "keeper" }, { name: "Dasa", position: "defender" }, { name: "Sandler", position: "defender" }, { name: "Nuytinck", position: "defender" },
  { name: "Proper", position: "midfielder" }, { name: "Sano", position: "midfielder" }, { name: "Chery", position: "midfielder" },
  { name: "Hansen", position: "forward" }, { name: "Ogawa", position: "forward" }, { name: "González", position: "forward" }
];
type Stats = { shots: number; onTarget: number; chances: number; corners: number };
const AJAX: Team = { name: "Ajax", rating: 88, reputation: 92, keeper: 78 };
const NEC: Team = { name: "NEC", rating: 70, reputation: 68, keeper: 74 };
const initialTactics: Tactics = { mentality: "Normaal", passing: "Direct", pressing: false, offside: false, counter: false, hardTackles: false };
const zeroStats = (): Stats => ({ shots: 0, onTarget: 0, chances: 0, corners: 0 });

export default function Home() {
  const [minute, setMinute] = useState(0);
  const [goals, setGoals] = useState<[number, number]>([0, 0]);
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [stats, setStats] = useState<[Stats, Stats]>([zeroStats(), zeroStats()]);
  const [feed, setFeed] = useState<EventLine[]>([
    { minute: "INFO", text: "Ajax – NEC · Eredivisie. Druk op Start om af te trappen.", kind: "system" },
  ]);
  const [tactics, setTactics] = useState<Tactics>(initialTactics);
  const [speed, setSpeed] = useState("Normaal");
  const [running, setRunning] = useState(false);
  const finished = minute >= 90;
  const possession = useMemo(() => {
    const total = stats[0].shots + stats[1].shots;
    const home = total === 0 ? 50 : Math.max(25, Math.min(75, 50 + (stats[0].chances - stats[1].chances) * 2));
    return [home, 100 - home];
  }, [stats]);

  useEffect(() => {
    if (!running || finished) return;
    const delays: Record<string, number> = { Langzaam: 1500, Normaal: 900, Snel: 350, Ultra: 175 };
    const timer = window.setTimeout(() => playMinute(), delays[speed] ?? 900);
    return () => window.clearTimeout(timer);
  }, [running, minute, speed, finished]);

  function addEvent(item: EventLine) { setFeed(prev => [...prev, item].slice(-300)); }
  function newMatch() {
    setRunning(false); setMinute(0); setGoals([0, 0]); setScorers([]); setStats([zeroStats(), zeroStats()]);
    setFeed([{ minute: "INFO", text: "Ajax – NEC · Eredivisie. Druk op Start om af te trappen.", kind: "system" }]);
  }
  function teamStrength(team: Team, t: Tactics) {
    return team.rating + team.reputation * .12 + ({ Verdedigend: -7, Normaal: 0, Aanvallend: 7 }[t.mentality] ?? 0)
      + ({ Kort: 3, Direct: 2, Lang: -1 }[t.passing] ?? 0) + (t.pressing ? 3 : 0) + (t.counter ? 2 : 0);
  }
  function pickPlayer(team: 0 | 1, positions?: Player["position"][]) {
    const squad = team === 0 ? AJAX_PLAYERS : NEC_PLAYERS;
    const pool = positions?.length ? squad.filter(p => positions.includes(p.position)) : squad.filter(p => p.position !== "keeper");
    return pool[Math.floor(Math.random() * pool.length)] ?? squad[0];
  }
  function playMinute() {
    const m = minute + 1; setMinute(m);
    if (m === 1) { const player = pickPlayer(0, ["midfielder"]); addEvent({ minute: "1'", text: "Aftrap! " + player.name + " tikt de bal terug en Ajax begint rustig aan de opbouw.", kind: "system" }); return; }
    const homeRating = teamStrength(AJAX, tactics);
    const awayTactics: Tactics = { mentality: Math.random() < .35 ? "Verdedigend" : "Normaal", passing: "Direct", pressing: false, offside: false, counter: Math.random() < .45, hardTackles: false };
    const awayRating = teamStrength(NEC, awayTactics);
    const homeShare = Math.max(.24, Math.min(.82, .5 + (homeRating - awayRating) * .012));
    const home = Math.random() < homeShare;
    const team = home ? AJAX.name : NEC.name; const other = home ? NEC.name : AJAX.name;
    const ownIndex = home ? 0 : 1; const own = { ...stats[ownIndex] };
    const t = home ? tactics : awayTactics;
    const chanceQuality = Math.max(.08, Math.min(.78, .29 + ((home ? homeRating : awayRating) - (home ? awayRating : homeRating)) * .012 + (t.counter && t.mentality === "Verdedigend" ? .1 : 0)));
    const stamp = m + "'"; const r = Math.random();
    if (r < .22) {
      const passer = pickPlayer(ownIndex as 0 | 1, ["defender", "midfielder"]);
      const receiver = pickPlayer(ownIndex as 0 | 1, ["midfielder", "forward"]);
      addEvent({ minute: stamp, text: t.passing === "Kort" ? passer.name + " combineert met " + receiver.name + " en zoekt een opening." : t.passing === "Lang" ? passer.name + " verstuurt een lange bal richting " + receiver.name + " achter de verdediging." : passer.name + " speelt direct vooruit op " + receiver.name + "." });
    }
    else if (r < .38 && t.pressing && home) { const tackler = pickPlayer(0, ["midfielder", "defender"]); addEvent({ minute: stamp, text: "Ajax voert de druk op: " + tackler.name + " jaagt door, verovert de bal en zet NEC vast op eigen helft." }); }
    else if (r < .60 || r < .76) {
      const creator = pickPlayer(ownIndex as 0 | 1, ["midfielder", "forward"]);
      const runner = pickPlayer(ownIndex as 0 | 1, ["forward", "midfielder"]);
      addEvent({ minute: stamp, text: r < .60 ? creator.name + " versnelt over de flank en geeft voor op " + runner.name + "." : creator.name + " steekt de bal prachtig door het centrum richting " + runner.name + "!" });
      if (Math.random() < chanceQuality * (t.mentality === "Aanvallend" ? 1.18 : 1)) {
        own.chances++; own.shots++;
        const shooter = pickPlayer(ownIndex as 0 | 1, ["forward", "midfielder"]);
        addEvent({ minute: "KANS", text: shooter.name + " krijgt ruimte in het strafschopgebied en haalt uit!" });
        if (Math.random() < .66) {
          own.onTarget++;
          const keeper = home ? NEC.keeper : AJAX.keeper;
          const scorerQuality = home ? AJAX.rating : NEC.rating;
          if (Math.random() < Math.max(.035, Math.min(.72, .3 + (scorerQuality - keeper) * .012))) {
            addEvent({ minute: "VAR", text: "VAR controleert het doelpunt op buitenspel of een overtreding.", kind: "var" });
            if (Math.random() < .10) addEvent({ minute: "VAR", text: "Doelpunt afgekeurd na VAR-check: buitenspel in de aanloop.", kind: "var" });
            else { const scorer = pickPlayer(ownIndex as 0 | 1, ["forward", "midfielder"]); const assist = Math.random() < .72 ? pickPlayer(ownIndex as 0 | 1, ["midfielder", "forward", "defender"]).name : undefined; setGoals(prev => home ? [prev[0] + 1, prev[1]] : [prev[0], prev[1] + 1]); setScorers(prev => [...prev, { team: ownIndex as 0 | 1, minute: m, name: scorer.name, assist }]); addEvent({ minute: "GOAL", text: scorer.name + " scoort een prachtige goal voor " + team + (assist ? ", op aangeven van " + assist : "") + "! De bal vliegt onhoudbaar in het doel.", kind: "goal" }); }
          } else { const keeper = pickPlayer((home ? 1 : 0) as 0 | 1, ["keeper"]); addEvent({ minute: "SAVE", text: keeper.name + " redt knap op de inzet van " + shooter.name + " en houdt " + other + " op de been." }); }
        } else addEvent({ minute: "SCHOT", text: shooter.name + " haalt uit, maar de bal vliegt net over of naast." });
      } else if (Math.random() < .35) { own.corners++; const defender = pickPlayer((home ? 1 : 0) as 0 | 1, ["defender"]); addEvent({ minute: "COR", text: defender.name + " werkt de voorzet weg. Corner voor " + team + "." }); }
      else { const defender = pickPlayer((home ? 1 : 0) as 0 | 1, ["defender"]); addEvent({ minute: "INFO", text: defender.name + " onderschept de aanval en ruimt de bal op voor " + other + "." }); }
    } else if (r < .84) { own.corners++; const taker = pickPlayer(ownIndex as 0 | 1, ["midfielder", "forward"]); const target = pickPlayer(ownIndex as 0 | 1, ["forward", "defender"]); addEvent({ minute: stamp, text: "Corner voor " + team + ". " + taker.name + " slingert de bal voor het doel, waar " + target.name + " klaarstaat." }); }
    else if (r < .93) {
      const defender = pickPlayer((home ? 1 : 0) as 0 | 1, ["defender", "midfielder"]);
      const attacker = pickPlayer(ownIndex as 0 | 1, ["forward", "midfielder"]);
      addEvent({ minute: stamp, text: defender.name + " komt te laat in op " + attacker.name + ". De scheidsrechter fluit voor een overtreding." });
      if (t.hardTackles && Math.random() < .22) addEvent({ minute: "KAART", text: "Stevige tackle van " + defender.name + "! De scheidsrechter toont hem geel." });
      if (Math.random() < .10) {
        addEvent({ minute: "VAR", text: "VAR bekijkt een mogelijk strafschopmoment voor " + team + ".", kind: "var" });
        if (Math.random() < .45) {
          addEvent({ minute: "VAR", text: "De VAR grijpt in: de scheidsrechter kent alsnog een strafschop toe!", kind: "var" });
          own.chances++;
          if (Math.random() < (home ? .76 : .68)) { const scorer = pickPlayer(ownIndex as 0 | 1, ["forward", "midfielder"]); setGoals(prev => home ? [prev[0] + 1, prev[1]] : [prev[0], prev[1] + 1]); setScorers(prev => [...prev, { team: ownIndex as 0 | 1, minute: m, name: scorer.name, penalty: true }]); addEvent({ minute: "PEN", text: scorer.name + " blijft koel vanaf elf meter en schiet de penalty binnen voor " + team + "!", kind: "goal" }); }
          else { const keeper = pickPlayer((home ? 1 : 0) as 0 | 1, ["keeper"]); const taker = pickPlayer(ownIndex as 0 | 1, ["forward", "midfielder"]); addEvent({ minute: "PEN", text: "GEMISTE STRAFSCHOP! " + taker.name + " ziet zijn penalty gekeerd door " + keeper.name + " van " + other + ".", kind: "var" }); }
        } else addEvent({ minute: "VAR", text: "De scheidsrechter draait zijn beslissing terug na de VAR-check: geen penalty.", kind: "var" });
      }
    } else { const player = pickPlayer(ownIndex as 0 | 1, ["forward", "midfielder"]); addEvent({ minute: stamp, text: player.name + " krijgt een grote mogelijkheid voor " + team + ", maar schiet naast het doel." }); }
    setStats(prev => ownIndex === 0 ? [own, prev[1]] : [prev[0], own]);
    if (m === 45) addEvent({ minute: "45'", text: "Rust! De spelers zoeken de kleedkamer op.", kind: "system" });
    if (m >= 90) { setRunning(false); addEvent({ minute: "90'", text: "Afgefloten! De wedstrijd is afgelopen.", kind: "goal" }); }
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">RFM</span><div><div className="brand-title">RETRO FOOTBALL MANAGER</div><div className="brand-sub">THE CLASSIC GAME, REBUILT</div></div></div><div className="live-pill"><span className="pulse" /> WEB EDITION · v0.1</div></header>
    <nav className="nav">{["Overzicht", "Wedstrijd", "Selectie", "Tactiek", "Competitie", "Transfers"].map((n, i) => <button key={n} className={i === 1 ? "nav-button active" : "nav-button"} onClick={() => i !== 1 && addEvent({ minute: "INFO", text: n + ": dit onderdeel wordt in een volgende ontwikkelstap gebouwd.", kind: "system" })}>{n}</button>)}</nav>
    <div className="workspace">
      <aside className="sidebar"><section className="side-section"><div className="eyebrow">WEDSTRIJDINFO</div><div className="fixture-title">Eredivisie</div><div className="muted">Competitiewedstrijd</div><div className="stadium">◈ Amsterdam Arena · 20:00</div></section>
      <section className="side-section"><div className="eyebrow">WEDSTRIJDSTATISTIEKEN</div>{[["Balbezit", possession[0] + "% — " + possession[1] + "%"],["Schoten",stats[0].shots+" — "+stats[1].shots],["Op doel",stats[0].onTarget+" — "+stats[1].onTarget],["Kansen",stats[0].chances+" — "+stats[1].chances],["Corners",stats[0].corners+" — "+stats[1].corners]].map(([k,v]) => <div className="stat-row" key={k}><span>{k}</span><strong>{v}</strong></div>)}</section>
      <section className="side-section tactics"><div className="eyebrow">TACTISCHE INSTELLINGEN</div><label>Mentaliteit<select value={tactics.mentality} onChange={e=>setTactics({...tactics,mentality:e.target.value})}><option>Verdedigend</option><option>Normaal</option><option>Aanvallend</option></select></label><label>Passing<select value={tactics.passing} onChange={e=>setTactics({...tactics,passing:e.target.value})}><option>Kort</option><option>Direct</option><option>Lang</option></select></label>{([["pressing","Pressie"],["offside","Buitenspelval"],["counter","Counter"],["hardTackles","Hard tackelen"]] as const).map(([key,label])=><label className="toggle-row" key={key}>{label}<input type="checkbox" checked={tactics[key]} onChange={e=>setTactics({...tactics,[key]:e.target.checked})}/><span className="toggle"/></label>)}</section>
      <section className="side-section"><div className="eyebrow">WEDSTRIJDREGELAARS</div><div className="control-grid"><button className="start-button" onClick={()=>!finished&&setRunning(true)} disabled={running||finished}>▶ Start</button><button onClick={()=>setRunning(false)}>Ⅱ Pauze</button><button onClick={()=>!finished&&setRunning(true)} disabled={running||finished}>▶▶ Verder</button><button onClick={newMatch}>↻ Nieuwe match</button></div><label className="speed-label">Wedstrijdtempo<select value={speed} onChange={e=>setSpeed(e.target.value)}><option>Langzaam</option><option>Normaal</option><option>Snel</option><option>Ultra</option></select></label></section></aside>
      <section className="match-area"><div className="match-meta"><span>● LIVE MATCH CENTRE</span><span>SEIZOEN 2026/27 · SPEELDAG 1</span></div><div className="scoreboard"><div className="team"><div className="crest ajax">A</div><div><div className="team-name">AJAX</div><div className="team-meta">AMSTERDAM</div></div></div><div className="score-block"><div className="score">{goals[0]} <span>:</span> {goals[1]}</div><div className="clock">{String(minute).padStart(2,"0")}:00 <span>·</span> {finished?"AFGELOPEN":running?"LIVE WEDSTRIJD":minute?"GEPAUZEERD":"WACHT OP AFTRAP"}</div><div className="scorers-under-score">{[0,1].map(side => <div className="scorer-side" key={side}>{scorers.filter(s => s.team === side).map((s,i) => <div className="scorer-line" key={i}>{s.penalty ? <span className="penalty-icon" title="Penaltydoelpunt">⚽🥅</span> : <span className="goal-icon">⚽</span>} {s.name} {s.assist ? <span className="assist">({s.assist})</span> : null} <span className="goal-minute">{s.minute}\u0027</span></div>)}</div>)}</div></div><div className="team away"><div><div className="team-name">NEC</div><div className="team-meta">NIJMEGEN</div></div><div className="crest nec">N</div></div></div>
      <div className="commentary-head"><div><span className="eyebrow">MATCH FEED</span><h2>Live wedstrijdcommentaar</h2></div><span className={running?"status-live":"status-idle"}>{running?"● LIVE":finished?"AFGELOPEN":"KLAAR"}</span></div><div className="commentary" key="commentary">{feed.map((line,i)=><div className={"event "+(line.kind||"")} key={i}><div className="event-minute">{line.minute}</div><div className="event-text">{line.text}</div></div>)}</div>
      <footer className="match-footer"><span>◉ ENGINE STATUS</span><span>LIVE MATCH ENGINE</span><span>VAR SYSTEM ACTIVE</span><span>BUILD 0.1.0</span></footer></section>
    </div><div className="bottom-note">RETRO FOOTBALL MANAGER <span>Een doorlopende ontwikkeling vanuit GitHub · Wedstrijdopslag volgt</span></div>
  </main>;
}
