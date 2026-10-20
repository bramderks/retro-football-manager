"use client";

import { useEffect, useMemo, useState } from "react";

type Team = { name: string; city?: string; rating: number; reputation: number; keeper: number };
type Tactics = { mentality: string; passing: string; pressing: boolean; offside: boolean; counter: boolean; hardTackles: boolean; formation: string };
type EventLine = { minute: number | string; text: string; kind?: "goal" | "var" | "system" };
type Scorer = { team: 0 | 1; minute: number; name: string; assist?: string; penalty?: boolean };
type Player = { name: string; position: "keeper" | "defender" | "midfielder" | "forward" };
type DatabasePlayer = { id: string; name: string; position: string; overallRating: number; potentialRating: number; sourceUrl: string | null };
type DatabaseTeam = { id: string; name: string; city: string; division: string; tier: number; reputation: number; teamStrength: number; players: DatabasePlayer[] };
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
const AJAX: Team = { name: "Ajax", city: "Amsterdam", rating: 88, reputation: 92, keeper: 78 };
const NEC: Team = { name: "NEC", city: "Nijmegen", rating: 70, reputation: 68, keeper: 74 };
const initialTactics: Tactics = { mentality: "Normaal", passing: "Direct", pressing: false, offside: false, counter: false, hardTackles: false, formation: "4-3-3" };
const zeroStats = (): Stats => ({ shots: 0, onTarget: 0, chances: 0, corners: 0 });

export default function Home() {
  const [minute, setMinute] = useState(0);
  const [goals, setGoals] = useState<[number, number]>([0, 0]);
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [stats, setStats] = useState<[Stats, Stats]>([zeroStats(), zeroStats()]);
  const [feed, setFeed] = useState<EventLine[]>([
    { minute: "INFO", text: "Ajax – NEC · Eredivisie. Druk op Start om af te trappen.", kind: "system" },
  ]);
  const [activeScreen, setActiveScreen] = useState("Wedstrijd");
  const [homeTactics, setHomeTactics] = useState<Tactics>({ ...initialTactics });
  const [awayTactics, setAwayTactics] = useState<Tactics>({ mentality: "Verdedigend", passing: "Direct", pressing: false, offside: false, counter: true, hardTackles: false, formation: "4-4-2" });
  const [databaseTeams, setDatabaseTeams] = useState<DatabaseTeam[]>([]);
  const [databaseError, setDatabaseError] = useState(false);
  const [careerClubs, setCareerClubs] = useState<any[]>([]);
  const [careerSaveId, setCareerSaveId] = useState("");
  const [careerData, setCareerData] = useState<any>(null);
  const [managerName, setManagerName] = useState("Nieuwe manager");
  const [careerClubId, setCareerClubId] = useState("ajax");
  const [careerBusy, setCareerBusy] = useState(false);
  const [careerError, setCareerError] = useState("");
  const [selectedHomeId, setSelectedHomeId] = useState("ajax");
  const [selectedAwayId, setSelectedAwayId] = useState("nec");
  const databaseHome = databaseTeams.find(t => t.id === selectedHomeId);
  const databaseAway = databaseTeams.find(t => t.id === selectedAwayId);
  const homeTeam: Team = databaseHome ? { name: databaseHome.name, city: databaseHome.city, rating: databaseHome.teamStrength, reputation: databaseHome.reputation, keeper: databaseHome.players.find(p => p.position === "GK")?.overallRating ?? 56 } : AJAX;
  const awayTeam: Team = databaseAway ? { name: databaseAway.name, city: databaseAway.city, rating: databaseAway.teamStrength, reputation: databaseAway.reputation, keeper: databaseAway.players.find(p => p.position === "GK")?.overallRating ?? 56 } : NEC;
  const [speed, setSpeed] = useState("Normaal");
  const [running, setRunning] = useState(false);
  const finished = minute >= 90;
  const possession = useMemo(() => {
    const total = stats[0].shots + stats[1].shots;
    const home = total === 0 ? 50 : Math.max(25, Math.min(75, 50 + (stats[0].chances - stats[1].chances) * 2));
    return [home, 100 - home];
  }, [stats]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/teams", { cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error("Database API unavailable"); return response.json(); })
      .then(data => { if (!cancelled && Array.isArray(data.teams)) { setDatabaseTeams(data.teams); setDatabaseError(false); } })
      .catch(() => { if (!cancelled) setDatabaseError(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetch("/api/career", { cache: "no-store" }).then(r => r.json()).then(d => { if (Array.isArray(d.clubs)) { setCareerClubs(d.clubs); if (d.clubs.length && !d.clubs.some((x:any) => x.id === careerClubId)) setCareerClubId(d.clubs[0].id); } }).catch(() => setCareerError("Competitiedatabase kon niet worden geladen."));
    const saved = window.localStorage.getItem("rfm-career-save"); if (saved) setCareerSaveId(saved);
  }, []);
  useEffect(() => {
    if (!careerSaveId) return;
    let cancelled = false;
    fetch("/api/career?saveId=" + encodeURIComponent(careerSaveId), { cache: "no-store" }).then(r => r.json()).then(d => { if (!cancelled && d.save) { setCareerData(d); setSelectedHomeId(d.save.club_id); setHomeTactics({ ...initialTactics, ...(d.save.tactical_setup || {}) }); } }).catch(() => { if (!cancelled) setCareerError("Carrière kon niet worden geladen."); });
    return () => { cancelled = true; };
  }, [careerSaveId]);
  async function createCareer() {
    setCareerBusy(true); setCareerError("");
    try { const r = await fetch("/api/career", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", clubId: careerClubId, managerName }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Carrière starten mislukt."); window.localStorage.setItem("rfm-career-save", d.saveId); setCareerSaveId(d.saveId); setSelectedHomeId(d.clubId); setActiveScreen("Overzicht"); } catch (e) { setCareerError(e instanceof Error ? e.message : "Carrière starten mislukt."); } finally { setCareerBusy(false); }
  }
  async function advanceCareerDay() {
    if (!careerSaveId || careerBusy) return; setCareerBusy(true); setCareerError("");
    try { const r = await fetch("/api/career", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "advance_day", saveId: careerSaveId }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Dag doorspelen mislukt."); const refreshed = await fetch("/api/career?saveId=" + encodeURIComponent(careerSaveId), { cache: "no-store" }).then(x => x.json()); setCareerData(refreshed); } catch (e) { setCareerError(e instanceof Error ? e.message : "Dag doorspelen mislukt."); } finally { setCareerBusy(false); }
  }
  async function saveCareerTactics(tactics: Tactics) {
    setHomeTactics(tactics); if (!careerSaveId) return;
    fetch("/api/career", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "tactics", saveId: careerSaveId, tactics }) }).catch(() => setCareerError("Tactiek kon niet worden opgeslagen."));
  }
  useEffect(() => {
    if (!running || finished) return;
    const delays: Record<string, number> = { Langzaam: 1500, Normaal: 900, Snel: 350, Ultra: 175 };
    const timer = window.setTimeout(() => playMinute(), delays[speed] ?? 900);
    return () => window.clearTimeout(timer);
  }, [running, minute, speed, finished]);

  function addEvent(item: EventLine) { setFeed(prev => [...prev, item].slice(-300)); }
  function newMatch() {
    setRunning(false); setMinute(0); setGoals([0, 0]); setScorers([]); setStats([zeroStats(), zeroStats()]);
    setFeed([{ minute: "INFO", text: homeTeam.name + " – " + awayTeam.name + " · " + (databaseHome?.division ?? "Eredivisie") + ". Druk op Start om af te trappen.", kind: "system" }]);
  }
  function teamStrength(team: Team, t: Tactics) {
    return team.rating + team.reputation * .12 + ({ Verdedigend: -7, Normaal: 0, Aanvallend: 7 }[t.mentality] ?? 0)
      + ({ Kort: 3, Direct: 2, Lang: -1 }[t.passing] ?? 0) + (t.pressing ? 3 : 0) + (t.counter ? 2 : 0) + ({ "4-3-3": 2, "4-4-2": 0, "4-2-3-1": 1, "3-5-2": 1, "5-3-2": -1 }[t.formation] ?? 0);
  }
  function tacticPower(team: Team, t: Tactics) {
    return Math.round(teamStrength(team, t) + (t.formation === "4-3-3" ? 2 : t.formation === "3-5-2" ? 1 : 0) + (t.pressing ? 1 : 0) + (t.offside ? 1 : 0));
  }
  function pickPlayer(team: 0 | 1, positions?: Player["position"][]) {
    const selectedId = team === 0 ? selectedHomeId : selectedAwayId;
    const dbTeam = databaseTeams.find(t => t.id === selectedId);
    const fallback = team === 0 ? AJAX_PLAYERS : NEC_PLAYERS;
    const squad: Player[] = dbTeam?.players.length ? dbTeam.players.map(p => ({
      name: p.name,
      position: p.position === "GK" ? "keeper" : p.position === "ST" || p.position === "RW" || p.position === "LW" ? "forward" : p.position === "CB" || p.position === "LB" || p.position === "RB" ? "defender" : "midfielder",
    })) : fallback;
    const pool = positions?.length ? squad.filter(p => positions.includes(p.position)) : squad.filter(p => p.position !== "keeper");
    return pool[Math.floor(Math.random() * pool.length)] ?? squad[0];
  }
  function playMinute() {
    const m = minute + 1; setMinute(m);
    if (m === 1) { const player = pickPlayer(0, ["midfielder"]); addEvent({ minute: "1'", text: "Aftrap! " + player.name + " tikt de bal terug en " + homeTeam.name + " begint rustig aan de opbouw.", kind: "system" }); return; }
    const homeRating = teamStrength(homeTeam, homeTactics);
    const awayRating = teamStrength(awayTeam, awayTactics);
    const homeShare = Math.max(.24, Math.min(.82, .5 + (homeRating - awayRating) * .012));
    const home = Math.random() < homeShare;
    const team = home ? homeTeam.name : awayTeam.name; const other = home ? awayTeam.name : homeTeam.name;
    const ownIndex = home ? 0 : 1; const own = { ...stats[ownIndex] };
    const t = home ? homeTactics : awayTactics;
    const opponentTactics = home ? awayTactics : homeTactics;
    const tacticalEdge = ({ Verdedigend: -.08, Normaal: 0, Aanvallend: .09 }[t.mentality] ?? 0)
      - ({ Verdedigend: -.08, Normaal: 0, Aanvallend: .09 }[opponentTactics.mentality] ?? 0);
    const passingBonus = ({ Kort: .035, Direct: .02, Lang: -.005 }[t.passing] ?? 0);
    const counterBonus = t.counter && opponentTactics.mentality === "Aanvallend" ? .11 : t.counter ? .035 : 0;
    const pressingBonus = t.pressing ? .045 : 0;
    const chanceQuality = Math.max(.04, Math.min(.48, .16 + ((home ? homeRating : awayRating) - (home ? awayRating : homeRating)) * .0045 + tacticalEdge * .65 + passingBonus * .7 + counterBonus * .7 + pressingBonus * .65));
    const stamp = m + "'"; const r = Math.random();
    if (r < .22) {
      const passer = pickPlayer(ownIndex as 0 | 1, ["defender", "midfielder"]);
      const receiver = pickPlayer(ownIndex as 0 | 1, ["midfielder", "forward"]);
      addEvent({ minute: stamp, text: t.passing === "Kort" ? passer.name + " combineert met " + receiver.name + " en zoekt een opening." : t.passing === "Lang" ? passer.name + " verstuurt een lange bal richting " + receiver.name + " achter de verdediging." : passer.name + " speelt direct vooruit op " + receiver.name + "." });
    }
    else if (r < .38 && t.pressing) { const tackler = pickPlayer(ownIndex as 0 | 1, ["midfielder", "defender"]); addEvent({ minute: stamp, text: team + " voert de druk op: " + tackler.name + " jaagt door, verovert de bal en zet " + other + " vast op eigen helft." }); }
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
          const keeper = home ? awayTeam.keeper : homeTeam.keeper;
          const scorerQuality = home ? homeTeam.rating : awayTeam.rating;
          if (Math.random() < Math.max(.025, Math.min(.48, .20 + (scorerQuality - keeper) * .006))) {
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
      if (opponentTactics.hardTackles && Math.random() < .22) addEvent({ minute: "KAART", text: "Stevige tackle van " + defender.name + "! De scheidsrechter toont hem geel." });
      if (Math.random() < (opponentTactics.hardTackles ? .16 : .10)) {
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
    <nav className="nav">{["Overzicht", "Wedstrijd", "Selectie", "Tactiek", "Competitie", "Transfers"].map(n => <button key={n} className={activeScreen === n ? "nav-button active" : "nav-button"} onClick={() => setActiveScreen(n)}>{n}</button>)}</nav>
    {activeScreen === "Overzicht" ? <main className="career-screen">
      <div className="career-header"><div><div className="eyebrow">CLUBMANAGEMENT / SEIZOEN 2026/27</div><h1>{careerData ? careerData.save.club_name : "Begin jouw voetbalcarrière"}</h1><p>{careerData ? careerData.save.manager_name + " · " + careerData.save.division + " · " + new Date(careerData.save.game_date).toLocaleDateString("nl-NL") : "Kies een club, word manager en bouw aan jouw eigen voetbalgeschiedenis."}</p></div>{careerData ? <button className="primary-action" disabled={careerBusy} onClick={advanceCareerDay}>{careerBusy ? "Even wachten…" : "▶ Volgende dag"}</button> : null}</div>
      {careerError ? <div className="career-error">{careerError}</div> : null}
      {!careerData ? <section className="new-career-card"><div className="eyebrow">NIEUWE CARRIÈRE</div><label>Naam manager<input value={managerName} onChange={e=>setManagerName(e.target.value)} placeholder="Jouw naam"/></label><label>Kies jouw club<select value={careerClubId} onChange={e=>setCareerClubId(e.target.value)}>{careerClubs.map((club:any)=><option key={club.id} value={club.id}>{club.name} · {club.division}</option>)}</select></label><div className="club-preview">{careerClubs.find((x:any)=>x.id===careerClubId)?.name || "Club"} <span>Reputatie {careerClubs.find((x:any)=>x.id===careerClubId)?.reputation ?? "—"} · Teamkracht {careerClubs.find((x:any)=>x.id===careerClubId)?.team_strength ?? "—"}</span></div><button className="primary-action" disabled={careerBusy||!careerClubs.length} onClick={createCareer}>{careerBusy ? "Carrière aanmaken…" : "Start carrière"}</button></section> :
      <>
      <div className="career-kpis"><div><small>CLUBKAS</small><strong>€{Number(careerData.save.cash_balance).toLocaleString("nl-NL")}</strong></div><div><small>TRANSFERBUDGET</small><strong>€{Number(careerData.save.transfer_budget).toLocaleString("nl-NL")}</strong></div><div><small>BESTUURVERTROUWEN</small><strong>{careerData.save.board_confidence}%</strong></div><div><small>SELECTIEMORAAL</small><strong>{careerData.save.club_morale}%</strong></div></div>
      <div className="career-grid"><section className="career-panel"><div className="eyebrow">COMPETITIESTAND</div><div className="career-table-wrap"><table className="career-table"><thead><tr><th>#</th><th>Club</th><th>G</th><th>DS</th><th>P</th></tr></thead><tbody>{careerData.standings.map((team:any,i:number)=><tr key={team.id} className={team.id===careerData.save.club_id?"my-club":""}><td>{i+1}</td><td>{team.name}</td><td>{team.played}</td><td>{team.gf-team.ga}</td><td><strong>{team.points}</strong></td></tr>)}</tbody></table></div></section>
      <section className="career-panel"><div className="eyebrow">KALENDER & VOLGENDE WEDSTRIJDEN</div>{careerData.fixtures.slice(0,8).map((f:any)=><div className={"fixture-row "+(f.user_match?"my-fixture":"")} key={f.id}><time>{new Date(f.kickoff_date).toLocaleDateString("nl-NL",{day:"2-digit",month:"short"})}</time><span>{f.home_team} – {f.away_team}</span><strong>{f.status==="played"?f.home_goals+" - "+f.away_goals:"—"}</strong></div>)}</section>
      <section className="career-panel"><div className="eyebrow">CLUBNIEUWS</div>{careerData.news.map((n:any)=><article className="news-row" key={n.id}><small>{new Date(n.news_date).toLocaleDateString("nl-NL")} · {n.category.toUpperCase()}</small><strong>{n.headline}</strong><p>{n.body}</p></article>)}</section>
      <section className="career-panel"><div className="eyebrow">LAATSTE FINANCIËLE MUTATIES</div>{careerData.finances.slice(0,8).map((f:any,i:number)=><div className="finance-row" key={i}><span>{f.description}<small>{new Date(f.entry_date).toLocaleDateString("nl-NL")}</small></span><strong className={Number(f.amount)<0?"negative":"positive"}>{Number(f.amount)<0?"−":"+"}€{Math.abs(Number(f.amount)).toLocaleString("nl-NL")}</strong></div>)}</section></div></>}
    </main> : activeScreen === "Tactiek" ? 
      <div className="tactics-screen-header"><div><div className="eyebrow">MANAGER / TACTIEK</div><h1>{homeTeam.name} · Tactische opstelling</h1><p>Pas de formatie en speelwijze van jouw team aan. De tegenstander wordt aangestuurd door de computer.</p></div><button className="back-match" onClick={() => setActiveScreen("Wedstrijd")}>Terug naar wedstrijd</button></div>
      <div className="tactics-layout">
        <section className="pitch-panel"><div className="pitch-heading"><span>OPSTELLING</span><label>Formatie<select value={homeTactics.formation} onChange={e => saveCareerTactics({...homeTactics,formation:e.target.value})}><option>4-3-3</option><option>4-4-2</option><option>4-2-3-1</option><option>3-5-2</option><option>5-3-2</option></select></label></div>
          <div className="football-pitch"><div className="pitch-line halfway"/><div className="pitch-circle"/><div className="penalty-box top"/><div className="penalty-box bottom"/><div className="goal-box top"/><div className="goal-box bottom"/>
            {([{x:50,y:91,p:"GK"},{x:18,y:73,p:"LB"},{x:39,y:76,p:"CB"},{x:61,y:76,p:"CB"},{x:82,y:73,p:"RB"},{x:30,y:51,p:"CM"},{x:50,y:56,p:"CM"},{x:70,y:51,p:"CM"},{x:18,y:26,p:"LW"},{x:50,y:19,p:"ST"},{x:82,y:26,p:"RW"}]).map((p,i)=><div key={i} className="player-dot" style={{left:p.x+"%",top:p.y+"%"}}><span>{i+1}</span><small>{p.p}</small></div>)}
          </div><div className="pitch-legend">11 posities · Positieschema is de basis voor de volgende stap: spelers aan posities koppelen.</div>
        </section>
        <section className="tactics-controls"><div className="eyebrow">SPEELWIJZE</div><div className="tactic-setting"><label htmlFor="mentality">Mentaliteit</label><select id="mentality" value={homeTactics.mentality} onChange={e=>saveCareerTactics({...homeTactics,mentality:e.target.value})}><option>Verdedigend</option><option>Normaal</option><option>Aanvallend</option></select><p>Stelt in hoeveel risico het team neemt bij aanvallen.</p></div>
          <div className="tactic-setting"><label htmlFor="passing">Passing</label><select id="passing" value={homeTactics.passing} onChange={e=>saveCareerTactics({...homeTactics,passing:e.target.value})}><option>Kort</option><option>Direct</option><option>Lang</option></select><p>Bepaalt hoe het team de bal naar voren brengt.</p></div>
          {([[ "pressing","Pressie","Meer balveroveringen, maar hogere belasting." ],["offside","Buitenspelval","De verdediging probeert aanvallers buitenspel te zetten."],["counter","Counter","Snelle omschakeling, vooral tegen aanvallende teams."],["hardTackles","Hard tackelen","Meer fysieke duels, met extra risico op kaarten."]] as const).map(([key,label,help])=><label className="tactic-check" key={key}><span><strong>{label}</strong><small>{help}</small></span><input type="checkbox" checked={homeTactics[key]} onChange={e=>saveCareerTactics({...homeTactics,[key]:e.target.checked})}/></label>)}
          <div className="power-card"><div><span>TACTISCHE KRACHT</span><strong>{tacticPower(homeTeam,homeTactics)}</strong></div><div className="power-meter"><i style={{width:Math.max(5,Math.min(100,tacticPower(homeTeam,homeTactics)))+"%"}}/></div><p>Dit is een relatieve enginescore op basis van teamsterkte, mentaliteit, passing, formatie en instructies. De engine gebruikt deze bij kansen en wedstrijdverloop.</p></div>
          <div className="ai-note"><strong>Computertegenstander · {awayTeam.name}</strong><p>De AI kiest zelf mentaliteit, passing, pressie, buitenspelval, counter en tackles. Deze instellingen zijn niet door jou bedienbaar.</p></div>
        </section>
      </div>
    </main> : <div className="workspace">
      <aside className="sidebar"><section className="side-section"><div className="eyebrow">WEDSTRIJDINFO</div><div className="fixture-title">{databaseHome?.division ?? "Eredivisie"}</div><div className="muted">Seizoen 2026/27 · Competitiewedstrijd</div><div className="stadium">◈ {homeTeam.city ?? "Amsterdam"} · 20:00</div></section>
      <section className="side-section"><div className="eyebrow">TEAMS UIT DATABASE</div><label>Thuis<select value={selectedHomeId} onChange={e => { const id = e.target.value; setSelectedHomeId(id); setMinute(0); setGoals([0,0]); setScorers([]); setStats([zeroStats(),zeroStats()]); setRunning(false); setFeed([{ minute: "INFO", text: (databaseTeams.find(t => t.id === id)?.name ?? "Thuisploeg") + " – " + awayTeam.name + ". Druk op Start om af te trappen.", kind: "system" }]); }}>{databaseTeams.filter(t => t.id !== selectedAwayId || t.id === selectedHomeId).filter(t => t.tier === 1).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}{databaseTeams.filter(t => t.id !== selectedAwayId || t.id === selectedHomeId).filter(t => t.tier === 2).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Uit<select value={selectedAwayId} onChange={e => { const id = e.target.value; setSelectedAwayId(id); setMinute(0); setGoals([0,0]); setScorers([]); setStats([zeroStats(),zeroStats()]); setRunning(false); setFeed([{ minute: "INFO", text: homeTeam.name + " – " + (databaseTeams.find(t => t.id === id)?.name ?? "Uitploeg") + ". Druk op Start om af te trappen.", kind: "system" }]); }}>{databaseTeams.filter(t => t.id !== selectedHomeId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><div className="muted">{databaseTeams.length ? databaseTeams.length + " clubs geladen" : databaseError ? "Database niet bereikbaar" : "Database laden…"}</div></section><section className="side-section"><div className="eyebrow">WEDSTRIJDSTATISTIEKEN</div>{[["Balbezit", possession[0] + "% — " + possession[1] + "%"],["Schoten",stats[0].shots+" — "+stats[1].shots],["Op doel",stats[0].onTarget+" — "+stats[1].onTarget],["Kansen",stats[0].chances+" — "+stats[1].chances],["Corners",stats[0].corners+" — "+stats[1].corners]].map(([k,v]) => <div className="stat-row" key={k}><span>{k}</span><strong>{v}</strong></div>)}</section>
      <section className="side-section"><div className="eyebrow">WEDSTRIJDREGELAARS</div><div className="control-grid"><button className="start-button" onClick={()=>!finished&&setRunning(true)} disabled={running||finished}>▶ Start</button><button onClick={()=>setRunning(false)}>Ⅱ Pauze</button><button onClick={()=>!finished&&setRunning(true)} disabled={running||finished}>▶▶ Verder</button><button onClick={newMatch}>↻ Nieuwe match</button></div><label className="speed-label">Wedstrijdtempo<select value={speed} onChange={e=>setSpeed(e.target.value)}><option>Langzaam</option><option>Normaal</option><option>Snel</option><option>Ultra</option></select></label></section></aside>
      <section className="match-area"><div className="match-meta"><span>● LIVE MATCH CENTRE</span><span>SEIZOEN 2026/27 · SPEELDAG 1</span></div><div className="scoreboard"><div className="team"><div className="crest ajax">{homeTeam.name.slice(0,1).toUpperCase()}</div><div><div className="team-name">{homeTeam.name.toUpperCase()}</div><div className="team-meta">{(homeTeam.city ?? "THUIS").toUpperCase()}</div></div></div><div className="score-block"><div className="score">{goals[0]} <span>:</span> {goals[1]}</div><div className="clock">{String(minute).padStart(2,"0")}:00 <span>·</span> {finished?"AFGELOPEN":running?"LIVE WEDSTRIJD":minute?"GEPAUZEERD":"WACHT OP AFTRAP"}</div></div><div className="team away"><div><div className="team-name">{awayTeam.name.toUpperCase()}</div><div className="team-meta">{(awayTeam.city ?? "UIT").toUpperCase()}</div></div><div className="crest nec">{awayTeam.name.slice(0,1).toUpperCase()}</div></div></div><div className="scorers-panel"><div className="eyebrow">DOELPUNTEN</div><div className="scorers-under-score">{[0,1].map(side => <div className="scorer-side" key={side}><div className="scorer-team-label">{side===0?homeTeam.name:awayTeam.name}</div>{scorers.filter(s => s.team === side).map((s,i) => <div className="scorer-line" key={i}>{s.penalty ? <span className="penalty-icon" title="Penaltydoelpunt">⚽🥅</span> : <span className="goal-icon">⚽</span>} {s.name} {s.assist ? <span className="assist">({s.assist})</span> : null} <span className="goal-minute">{s.minute}'</span></div>)}</div>)}</div></div>
      <div className="commentary-head"><div><span className="eyebrow">MATCH FEED</span><h2>Live wedstrijdcommentaar</h2></div><span className={running?"status-live":"status-idle"}>{running?"● LIVE":finished?"AFGELOPEN":"KLAAR"}</span></div><div className="commentary" key="commentary">{feed.map((line,i)=><div className={"event "+(line.kind||"")} key={i}><div className="event-minute">{line.minute}</div><div className="event-text">{line.text}</div></div>)}</div>
      <footer className="match-footer"><span>◉ ENGINE STATUS</span><span>LIVE MATCH ENGINE</span><span>VAR SYSTEM ACTIVE</span><span>{databaseError ? "DB OFFLINE" : databaseTeams.length ? "DB ONLINE · " + databaseTeams.reduce((n, t) => n + t.players.length, 0) + " SPELERS" : "DB VERBINDEN…"}</span></footer></section>
    </div>}<div className="bottom-note">RETRO FOOTBALL MANAGER <span>Een doorlopende ontwikkeling vanuit GitHub · Wedstrijdopslag volgt</span></div>
  </main>;
}
