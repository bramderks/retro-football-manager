import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SEASON = "2026-2027";
const START = "2026-08-01";
const COUNTRY_LABELS: Record<string,string> = { NED:"Nederland",ENG:"Engeland",GER:"Duitsland",FRA:"Frankrijk",ITA:"Italië",ESP:"Spanje" };
function makeSchedule(teams: any[], divisionId: string, season: string) { const list=[...teams].sort((a,b)=>String(a.id).localeCompare(String(b.id))); if(list.length%2)list.push({id:"BYE"}); const n=list.length, rounds=n-1, first:any[]=[]; let rotation=[...list]; for(let r=0;r<rounds;r++){for(let i=0;i<n/2;i++){let a=rotation[i],b=rotation[n-1-i];if(a.id==="BYE"||b.id==="BYE")continue;if((r+i)%2===0)[a,b]=[b,a];first.push({round:r+1,home:a.id,away:b.id});}rotation=[rotation[0],rotation[n-1],...rotation.slice(1,n-1)];}const fixtures:any[]=[];const base=new Date("2026-08-07T12:00:00Z");for(const m of first){const date=new Date(base);date.setUTCDate(date.getUTCDate()+(m.round-1)*7);fixtures.push({id:divisionId+"-md"+m.round+"-"+m.home+"-"+m.away,season,divisionId,round:m.round,date:date.toISOString().slice(0,10),home:m.home,away:m.away});}for(const m of first){const round=m.round+rounds,date=new Date(base);date.setUTCDate(date.getUTCDate()+(round-1)*7);fixtures.push({id:divisionId+"-md"+round+"-"+m.away+"-"+m.home,season,divisionId,round,date:date.toISOString().slice(0,10),home:m.away,away:m.home});}return fixtures;}
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const dateOnly = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
function matchScore(home: number, away: number, ht: any = {}, at: any = {}) {
  const factor = (t: any, o: any) => (t.mentality === "Aanvallend" ? 1.12 : t.mentality === "Verdedigend" ? .86 : 1) * (t.counter && o.mentality === "Aanvallend" ? 1.07 : 1) * (t.pressing ? 1.02 : 1);
  const baseH = Math.max(.35, Math.min(2.4, 1.28 + (home-away)*.024 + .14)) * factor(ht,at);
  const baseA = Math.max(.25, Math.min(2.1, 1.12 + (away-home)*.024)) * factor(at,ht);
  let h=0,a=0;
  for(let m=1;m<=90;m++){
    let rh=baseH/90, ra=baseA/90;
    if(h-a>=2)rh*=h-a>=4?.42:.64;
    if(a-h>=2)ra*=a-h>=4?.42:.64;
    if(h-a<=-2)rh*=h-a<=-4?1.38:1.2;
    if(a-h<=-2)ra*=a-h<=-4?1.38:1.2;
    if(m>75&&h<a)rh*=1.08;
    if(m>75&&a<h)ra*=1.08;
    if(ht.offside)ra*=.97;if(at.offside)rh*=.97;
    if(Math.random()<rh)h++;if(Math.random()<ra)a++;
  }
  return {homeGoals:Math.min(8,h),awayGoals:Math.min(8,a)};
}
export async function GET(request: Request) {
  const conn=process.env.DATABASE_URL;if(!conn)return fail("DATABASE_URL ontbreekt.",503);
  try{
    const sql=neon(conn), url=new URL(request.url), saveId=url.searchParams.get("saveId");
    const clubs=await sql.query("SELECT t.id,t.name,t.city,t.reputation,t.team_strength,d.name AS division,d.tier,d.country_code FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id=$1 ORDER BY d.country_code,d.tier,t.name",[SEASON]);
    if(!saveId)return NextResponse.json({season:SEASON,clubs});
    const got=await sql.query("SELECT s.*,m.full_name AS manager_name,t.name AS club_name,t.city,t.reputation,t.team_strength,d.name AS division,d.id AS division_id,d.country_code FROM career_saves s JOIN managers m ON m.id=s.manager_id JOIN teams t ON t.id=s.club_id JOIN divisions d ON d.id=t.division_id WHERE s.id=$1 LIMIT 1",[saveId]);
    if(!got.length)return fail("Carrière niet gevonden.",404);
    const save:any=got[0];
    const standings=await sql.query("SELECT t.id,t.name,COUNT(f.id) FILTER(WHERE COALESCE(cr.status,'scheduled')='played')::int AS played,COALESCE(SUM(CASE WHEN cr.status='played' AND ((f.home_team_id=t.id AND cr.home_goals>cr.away_goals) OR (f.away_team_id=t.id AND cr.away_goals>cr.home_goals)) THEN 3 WHEN cr.status='played' AND cr.home_goals=cr.away_goals THEN 1 ELSE 0 END),0)::int AS points,COALESCE(SUM(CASE WHEN f.home_team_id=t.id AND cr.status='played' THEN cr.home_goals WHEN f.away_team_id=t.id AND cr.status='played' THEN cr.away_goals ELSE 0 END),0)::int AS gf,COALESCE(SUM(CASE WHEN f.home_team_id=t.id AND cr.status='played' THEN cr.away_goals WHEN f.away_team_id=t.id AND cr.status='played' THEN cr.home_goals ELSE 0 END),0)::int AS ga FROM teams t LEFT JOIN fixtures f ON(f.home_team_id=t.id OR f.away_team_id=t.id) AND f.season_id=$1 LEFT JOIN career_fixture_results cr ON cr.fixture_id=f.id AND cr.save_id=$3 WHERE t.division_id=$2 GROUP BY t.id,t.name ORDER BY points DESC,t.name",[SEASON,save.division_id,saveId]);
    const fixtures=await sql.query("SELECT f.id,f.matchday,f.kickoff_date,cr.home_goals,cr.away_goals,COALESCE(cr.status,'scheduled') AS status,h.name AS home_team,a.name AS away_team,(f.home_team_id=$1 OR f.away_team_id=$1) AS user_match FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id LEFT JOIN career_fixture_results cr ON cr.fixture_id=f.id AND cr.save_id=$5 WHERE f.division_id=$2 AND f.kickoff_date >= $3 AND (f.home_team_id=$4 OR f.away_team_id=$4) ORDER BY f.kickoff_date,f.matchday LIMIT 12",[save.club_id,save.division_id,dateOnly(save.game_date),save.club_id,saveId]);
    const news=await sql.query("SELECT id,news_date,category,headline,body,is_read FROM career_news WHERE save_id=$1 ORDER BY id DESC LIMIT 25",[saveId]);
    const objectives=await sql.query("SELECT id,objective_type,description,target_value,progress_value,status FROM board_objectives WHERE save_id=$1 ORDER BY objective_type",[saveId]);
    const finances=await sql.query("SELECT entry_date,category,description,amount,balance_after FROM club_finances WHERE save_id=$1 ORDER BY id DESC LIMIT 20",[saveId]);
    const squad=await sql.query("SELECT p.id,p.full_name,p.position,p.overall_rating,p.potential_rating,cps.fitness,cps.morale,cps.sharpness,cps.injury_type,cps.injury_until FROM career_player_states cps JOIN players p ON p.id=cps.player_id WHERE cps.save_id=$1 AND cps.club_id=$2 AND p.is_active=TRUE ORDER BY p.overall_rating DESC,p.full_name LIMIT 40",[saveId,save.club_id]);
    const windowRows=await sql.query("SELECT id,window_name,opens_on,closes_on FROM transfer_windows WHERE season_id=$1 AND opens_on <= $2 AND closes_on >= $2 ORDER BY opens_on LIMIT 1",[SEASON,dateOnly(save.game_date)]);
    const market=await sql.query("SELECT p.id,p.full_name,p.position,p.overall_rating,p.potential_rating,p.date_of_birth,t.id AS club_id,t.name AS club_name,t.reputation AS club_reputation,GREATEST(50000,p.overall_rating*p.overall_rating*450) AS asking_price FROM career_player_states cps JOIN players p ON p.id=cps.player_id JOIN teams t ON t.id=cps.club_id WHERE cps.save_id=$1 AND cps.club_id<>$2 AND p.is_active=TRUE AND p.overall_rating>=58 AND t.id NOT LIKE 'jong-%' ORDER BY p.potential_rating DESC,p.overall_rating DESC LIMIT 60",[saveId,save.club_id]);
    const offers=await sql.query("SELECT o.id,o.fee,o.wage_offer,o.status,o.submitted_on,o.expires_on,p.full_name,t.name AS buying_club FROM transfer_offers o JOIN players p ON p.id=o.player_id JOIN teams t ON t.id=o.buying_club_id WHERE o.save_id=$1 ORDER BY o.id DESC LIMIT 20",[saveId]);
    const applications=await sql.query("SELECT a.id,a.target_role,a.applied_on,a.response_on,a.status,t.name AS target_club,t.city FROM career_applications a JOIN teams t ON t.id=a.target_club_id WHERE a.save_id=$1 ORDER BY a.id DESC LIMIT 20",[saveId]);
    const opportunities=await sql.query("SELECT t.id AS club_id,t.name AS club_name,t.city,d.name AS division,d.country_code,t.reputation FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id=$1 AND t.id<>$2 ORDER BY t.reputation DESC,t.name LIMIT 80",[SEASON,save.club_id]);
    return NextResponse.json({season:SEASON,save,standings,fixtures,news,finances,squad,objectives,transferWindow:windowRows[0]||null,market,offers,applications,opportunities},{headers:{"Cache-Control":"no-store"}});
  }catch(e){console.error("career GET",e);return fail("Carrière kon niet worden geladen.",500);}
}
export async function POST(request: Request) {
 const conn=process.env.DATABASE_URL;if(!conn)return fail("DATABASE_URL ontbreekt.",503);
 try{
  const b=await request.json(),sql=neon(conn);
  if(b.action==="create"){
   if(!b.clubId)return fail("Kies een club.");
   if(!["manager","sporting_director","chairperson"].includes(b.role||"manager"))return fail("Kies een geldige startfunctie.");
   const clubs=await sql.query("SELECT t.id,t.name,t.reputation,t.team_strength,t.division_id,d.country_code FROM teams t JOIN divisions d ON d.id=t.division_id WHERE t.id=$1 AND d.season_id=$2 LIMIT 1",[b.clubId,SEASON]);
   if(!clubs.length)return fail("Club niet gevonden.",404);
   const c:any=clubs[0], managerId="mgr-"+crypto.randomUUID(),saveId="save-"+crypto.randomUUID(),name=String(b.managerName||"Nieuwe manager").trim().slice(0,80)||"Nieuwe manager";
   const budget=Math.max(250000,Math.round(Number(c.team_strength)*Number(c.reputation)*3000)), wages=Math.max(12000,Math.round(Number(c.team_strength)*Number(c.reputation)*10)), balance=Math.max(500000,Math.round(budget*1.35));
   await sql.query("INSERT INTO managers(id,full_name) VALUES($1,$2)",[managerId,name]);
   await sql.query("INSERT INTO career_saves(id,manager_id,club_id,role,game_date,season_id,cash_balance,transfer_budget,wage_budget_weekly) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",[saveId,managerId,c.id,b.role||'manager',START,SEASON,balance,budget,wages]);
   await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'club',$3,$4)",[saveId,START,"Welkom bij "+c.name,"Het bestuur heeft je aangesteld als manager. Je bent verantwoordelijk voor resultaten, financiën en de selectie."]);
      await sql.query("INSERT INTO board_objectives(id,save_id,season_id,objective_type,description,target_value) VALUES($1,$2,$3,$4,$5,$6)",["obj-"+saveId,saveId,SEASON,"league_position",Number(c.team_strength)>=78?"Eindig bij de eerste drie":Number(c.team_strength)>=68?"Eindig in de bovenste helft":"Handhaaf je in de divisie",Number(c.team_strength)>=78?3:Number(c.team_strength)>=68?9:15]);
   await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,'other','Beginsaldo clubkas',$3,$3)",[saveId,START,balance]);
   await sql.query("INSERT INTO career_player_states(save_id,player_id,club_id) SELECT $1,id,team_id FROM players WHERE is_active=TRUE ON CONFLICT(save_id,player_id) DO NOTHING",[saveId]);
   const fixtureCount=await sql.query("SELECT COUNT(*)::int AS n FROM fixtures WHERE season_id=$1 AND division_id=$2",[SEASON,c.division_id]);
   if(Number(fixtureCount[0]?.n||0)===0){const divisionTeams=await sql.query("SELECT id FROM teams WHERE division_id=$1 ORDER BY id",[c.division_id]);const schedule=makeSchedule(divisionTeams,c.division_id,SEASON);for(let i=0;i<schedule.length;i+=60){const batch=schedule.slice(i,i+60);const values:any[]=[];const tuples=batch.map((x:any,j:number)=>{const k=j*7;values.push(x.id,x.season,x.divisionId,x.round,x.date,x.home,x.away);return `(${k+1},${k+2},${k+3},${k+4},${k+5},${k+6},${k+7})`;});await sql.query("INSERT INTO fixtures(id,season_id,division_id,matchday,kickoff_date,home_team_id,away_team_id) VALUES "+tuples.join(",")+" ON CONFLICT(id) DO NOTHING",values);}}
   return NextResponse.json({saveId,clubId:c.id,club:c.name});
  }
  if(!b.saveId)return fail("saveId ontbreekt.");
  const rows=await sql.query("SELECT s.*,t.name AS club_name,t.division_id,m.full_name AS manager_name FROM career_saves s JOIN teams t ON t.id=s.club_id JOIN managers m ON m.id=s.manager_id WHERE s.id=$1 LIMIT 1",[b.saveId]);
  if(!rows.length)return fail("Carrière niet gevonden.",404);const s:any=rows[0];
  if(b.action==="tactics"){await sql.query("UPDATE career_saves SET tactical_setup=$1::jsonb,updated_at=NOW() WHERE id=$2",[JSON.stringify(b.tactics||{}),b.saveId]);return NextResponse.json({ok:true});}
  if(b.action==="offer_transfer"){
   const playerId=String(b.playerId||""),fee=Math.max(0,Math.round(Number(b.fee)||0)),wage=Math.max(0,Math.round(Number(b.wage)||0));
   const win=await sql.query("SELECT id FROM transfer_windows WHERE season_id=$1 AND opens_on <= $2 AND closes_on >= $2 LIMIT 1",[SEASON,dateOnly(s.game_date)]);
   if(!win.length)return fail("De transfermarkt is gesloten. Je kunt alleen binnen een transferwindow onderhandelen.");
   const player=await sql.query("SELECT p.id,cps.club_id AS team_id,p.full_name,p.overall_rating,t.name AS club_name FROM players p JOIN career_player_states cps ON cps.player_id=p.id AND cps.save_id=$3 JOIN teams t ON t.id=cps.club_id WHERE p.id=$1 AND p.is_active=TRUE AND cps.club_id<>$2 LIMIT 1",[playerId,s.club_id,b.saveId]);
   if(!player.length)return fail("Deze speler is niet beschikbaar voor een bod.",404);
   if(fee>Number(s.transfer_budget))return fail("Dit bod ligt boven het beschikbare transferbudget.");
   const p:any=player[0],offerId="offer-"+crypto.randomUUID(),expires=new Date(String(s.game_date)+"T12:00:00Z");expires.setUTCDate(expires.getUTCDate()+7);
   await sql.query("INSERT INTO transfer_offers(id,save_id,player_id,buying_club_id,selling_club_id,fee,wage_offer,status,submitted_on,expires_on,notes) VALUES($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10)",[offerId,b.saveId,p.id,s.club_id,p.team_id,fee,wage,dateOnly(s.game_date),dateOnly(expires),"Bod uitgebracht op "+p.full_name]);
   await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'transfer',$3,$4)",[b.saveId,dateOnly(s.game_date),"Transferbod uitgebracht","Een bod van €"+fee.toLocaleString("nl-NL")+" is uitgebracht op "+p.full_name+" ("+p.club_name+"). De club reageert na onderhandelingen."]);
   return NextResponse.json({ok:true,offerId});
  }
  if(b.action==="apply_job"){
   const targetClubId=String(b.targetClubId||""),targetRole=String(b.targetRole||"manager");
   if(!["manager","sporting_director","chairperson"].includes(targetRole))return fail("Ongeldige functie.");
   if(targetClubId===s.club_id)return fail("Je werkt al bij deze club.");
   if(targetRole==="chairperson" && Number(s.career_xp||0)<250)return fail("Voor een voorzittersfunctie heb je minimaal 250 XP nodig.");
   if(targetRole==="sporting_director" && Number(s.career_xp||0)<60)return fail("Voor een functie als technisch directeur heb je minimaal 60 XP nodig.");
   const target=await sql.query("SELECT id,name FROM teams WHERE id=$1 LIMIT 1",[targetClubId]);if(!target.length)return fail("Club niet gevonden.",404);
   const duplicate=await sql.query("SELECT id FROM career_applications WHERE save_id=$1 AND target_club_id=$2 AND target_role=$3 AND status='pending' LIMIT 1",[b.saveId,targetClubId,targetRole]);if(duplicate.length)return fail("Je sollicitatie bij deze club loopt al.");
   const responseDate=new Date(String(s.game_date)+"T12:00:00Z");responseDate.setUTCDate(responseDate.getUTCDate()+7);
   const id="application-"+crypto.randomUUID();await sql.query("INSERT INTO career_applications(id,save_id,target_club_id,target_role,applied_on,response_on,status,note) VALUES($1,$2,$3,$4,$5,$6,'pending',$7)",[id,b.saveId,targetClubId,targetRole,dateOnly(s.game_date),dateOnly(responseDate),"Sollicitatie voor "+targetRole]);
   await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'board',$3,$4)",[b.saveId,dateOnly(s.game_date),"Sollicitatie verstuurd",s.manager_name+" heeft gesolliciteerd als "+targetRole+" bij "+target[0].name+". Een reactie wordt binnen een week verwacht."]);
   return NextResponse.json({ok:true,applicationId:id});
  }
  if(b.action==="change_role") return fail("Je kunt niet rechtstreeks van functie wisselen. Solliciteer via Loopbaan.");
  if(b.action==="finish_match"){
   const fixtureId=String(b.fixtureId||"");
   const homeGoals=Math.max(0,Math.min(8,Math.floor(Number(b.homeGoals))));
   const awayGoals=Math.max(0,Math.min(8,Math.floor(Number(b.awayGoals))));
   if(!fixtureId||!Number.isFinite(homeGoals)||!Number.isFinite(awayGoals))return fail("Wedstrijdgegevens ontbreken.");
   const nextDate=new Date(dateOnly(s.game_date)+"T12:00:00Z");nextDate.setUTCDate(nextDate.getUTCDate()+1);const day=dateOnly(nextDate);
   const matches=await sql.query("SELECT f.*,h.name AS home_name,a.name AS away_name FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id WHERE f.id=$1 AND f.division_id=$2 AND f.kickoff_date=$3 AND (f.home_team_id=$4 OR f.away_team_id=$4) LIMIT 1",[fixtureId,s.division_id,day,s.club_id]);
   if(!matches.length)return fail("Deze wedstrijd hoort niet bij jouw volgende wedstrijddag.",409);
   const f:any=matches[0];
   const existing=await sql.query("SELECT id FROM career_fixture_results WHERE save_id=$1 AND fixture_id=$2 LIMIT 1",[b.saveId,fixtureId]);
   if(existing.length)return fail("Deze wedstrijd is al opgeslagen.",409);
   await sql.query("INSERT INTO career_fixture_results(save_id,fixture_id,home_goals,away_goals,status,played_at) VALUES($1,$2,$3,$4,'played',NOW())",[b.saveId,fixtureId,homeGoals,awayGoals]);
   const otherMatches=await sql.query("SELECT f.*,h.team_strength AS hs,h.reputation AS hr,a.team_strength AS aws,a.reputation AS ar FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id WHERE f.kickoff_date=$1 AND f.status='scheduled' AND f.division_id=$2 AND f.id<>$3 AND NOT EXISTS (SELECT 1 FROM career_fixture_results cr WHERE cr.fixture_id=f.id AND cr.save_id=$4)",[day,s.division_id,fixtureId,b.saveId]);
   for(const other of otherMatches as any[]){const score=matchScore(Number(other.hs)+Number(other.hr)*.08,Number(other.aws)+Number(other.ar)*.08);await sql.query("INSERT INTO career_fixture_results(save_id,fixture_id,home_goals,away_goals,status,played_at) VALUES($1,$2,$3,$4,'played',NOW()) ON CONFLICT(save_id,fixture_id) DO NOTHING",[b.saveId,other.id,score.homeGoals,score.awayGoals]);}
   const gf=f.home_team_id===s.club_id?homeGoals:awayGoals,ga=f.home_team_id===s.club_id?awayGoals:homeGoals,opponent=f.home_team_id===s.club_id?f.away_name:f.home_name;
   const title=gf>ga?"Overwinning voor "+s.club_name:gf<ga?"Nederlaag voor "+s.club_name:"Gelijkspel voor "+s.club_name;
   await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'match',$3,$4)",[b.saveId,day,title,s.club_name+" "+gf+"-"+ga+" "+opponent]);
   const conf=Math.max(0,Math.min(100,Number(s.board_confidence)+(gf>ga?2:gf<ga?-3:0))),morale=Math.max(0,Math.min(100,Number(s.club_morale)+(gf>ga?3:gf<ga?-4:0)));
   await sql.query("UPDATE career_saves SET game_date=$1,board_confidence=$2,club_morale=$3,updated_at=NOW() WHERE id=$4",[day,conf,morale,b.saveId]);
   return NextResponse.json({ok:true,gameDate:day,fixtureId,homeGoals,awayGoals});
  }
  if(b.action==="advance_day"){
   const dayDate=new Date(dateOnly(s.game_date)+"T12:00:00Z");dayDate.setUTCDate(dayDate.getUTCDate()+1);const day=dateOnly(dayDate);
   const userFixture=await sql.query("SELECT f.id,f.home_team_id,f.away_team_id,f.kickoff_date,h.name AS home_name,a.name AS away_name FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id WHERE f.kickoff_date=$1 AND f.status='scheduled' AND f.division_id=$2 AND (f.home_team_id=$3 OR f.away_team_id=$3) AND NOT EXISTS (SELECT 1 FROM career_fixture_results cr WHERE cr.fixture_id=f.id AND cr.save_id=$4) LIMIT 1",[day,s.division_id,s.club_id,b.saveId]);
   if(userFixture.length)return NextResponse.json({ok:true,needsMatch:true,fixture:userFixture[0],gameDate:day});
   await sql.query("UPDATE career_saves SET game_date=$1,updated_at=NOW() WHERE id=$2",[day,b.saveId]);
   const scheduled=await sql.query("SELECT f.*,h.team_strength AS hs,h.reputation AS hr,a.team_strength AS aws,a.reputation AS ar FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id WHERE f.kickoff_date=$1 AND f.status='scheduled' AND f.division_id=$2 AND NOT EXISTS (SELECT 1 FROM career_fixture_results cr WHERE cr.fixture_id=f.id AND cr.save_id=$3)",[day,s.division_id,b.saveId]);
   const results=[];
   for(const f of scheduled as any[]){
    const ht=f.home_team_id===s.club_id?(s.tactical_setup||{}):{},at=f.away_team_id===s.club_id?(s.tactical_setup||{}):{};
    const score=matchScore(Number(f.hs)+Number(f.hr)*.08,Number(f.aws)+Number(f.ar)*.08,ht,at);
    await sql.query("INSERT INTO career_fixture_results(save_id,fixture_id,home_goals,away_goals,status,played_at) VALUES($1,$2,$3,$4,'played',NOW()) ON CONFLICT(save_id,fixture_id) DO NOTHING",[b.saveId,f.id,score.homeGoals,score.awayGoals]);
    results.push({id:f.id,homeTeamId:f.home_team_id,awayTeamId:f.away_team_id,...score});
    if(f.home_team_id===s.club_id||f.away_team_id===s.club_id){
      const gf=f.home_team_id===s.club_id?score.homeGoals:score.awayGoals,ga=f.home_team_id===s.club_id?score.awayGoals:score.homeGoals;
      const opponentId=f.home_team_id===s.club_id?f.away_team_id:f.home_team_id,op=(await sql.query("SELECT name FROM teams WHERE id=$1",[opponentId]))[0] as any;
      const title=gf>ga?"Overwinning voor "+s.club_name:gf<ga?"Nederlaag voor "+s.club_name:"Gelijkspel voor "+s.club_name;
      await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'match',$3,$4)",[b.saveId,day,title,s.club_name+" "+gf+"-"+ga+" "+op.name]);
      const conf=Math.max(0,Math.min(100,Number(s.board_confidence)+(gf>ga?2:gf<ga?-3:0))),morale=Math.max(0,Math.min(100,Number(s.club_morale)+(gf>ga?3:gf<ga?-4:0)));
      await sql.query("UPDATE career_saves SET board_confidence=$1,club_morale=$2 WHERE id=$3",[conf,morale,b.saveId]);
    }
   }
   const dailyCost=Math.round(Number(s.wage_budget_weekly||0)/7+Math.max(250,Number(s.cash_balance)*.00004)); const userFixture=results.find((x:any)=>x.homeTeamId===s.club_id||x.awayTeamId===s.club_id); const matchRevenue=userFixture?(userFixture.homeTeamId===s.club_id?120000+Number(s.reputation||50)*9000:45000):0; const balance=Number(s.cash_balance)-dailyCost+matchRevenue;
   await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,'wages','Dagelijkse lonen en exploitatie',$3,$4)",[b.saveId,day,-dailyCost,balance]);
    if(userFixture && matchRevenue>0) await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,$3,$4,$5,$6)",[b.saveId,day,userFixture.homeTeamId===s.club_id?"ticketing":"broadcast",userFixture.homeTeamId===s.club_id?"Wedstrijddag: kaartverkoop en horeca":"Wedstrijddag: media-inkomsten",matchRevenue,balance]);
   await sql.query("UPDATE career_saves SET cash_balance=$1 WHERE id=$2",[balance,b.saveId]);
   
   const players=await sql.query("SELECT cps.player_id AS id,cps.fitness,cps.injury_until FROM career_player_states cps JOIN players p ON p.id=cps.player_id WHERE cps.save_id=$1 AND cps.club_id=$2 AND p.is_active=TRUE",[b.saveId,s.club_id]);
   for(const p of players as any[]){
    const injury=userFixture && !p.injury_until && Math.random()<.003,fit=Math.max(40,Math.min(100,Number(p.fitness)+(userFixture?-(8+Math.floor(Math.random()*10)):1+Math.floor(Math.random()*2)))),kind=injury?(Math.random()<.5?"Hamstringblessure":"Enkelblessure"):null;
    const until=injury?dateOnly(new Date(dayDate.getTime()+(7+Math.floor(Math.random()*35))*86400000)):null;
    await sql.query("UPDATE career_player_states SET fitness=$1,injury_type=CASE WHEN $2::text IS NOT NULL THEN $2 WHEN injury_until < $3::date THEN NULL ELSE injury_type END,injury_until=CASE WHEN $2::text IS NOT NULL THEN $4 WHEN injury_until < $3::date THEN NULL ELSE injury_until END,updated_at=NOW() WHERE save_id=$5 AND player_id=$6",[fit,kind,day,until,b.saveId,p.id]);
    if(injury)await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'injury','Blessure tijdens training','Een speler is geblesseerd geraakt; de medische staf beoordeelt de verwachte herstelduur.')",[b.saveId,day]);
   }
   const applications=await sql.query("SELECT a.*,t.name AS target_club FROM career_applications a JOIN teams t ON t.id=a.target_club_id WHERE a.save_id=$1 AND a.status='pending' AND a.response_on <= $2::date",[b.saveId,day]);
   for(const app of applications as any[]){const accepted=Math.random()<(Math.max(0,Math.min(0.78,0.15+Number(s.career_xp||0)/500+Number(s.board_confidence||50)/500)));const status=accepted?"accepted":"rejected";await sql.query("UPDATE career_applications SET status=$1 WHERE id=$2",[status,app.id]);if(accepted){await sql.query("UPDATE career_saves SET club_id=$1,role=$2,board_confidence=60,updated_at=NOW() WHERE id=$3",[app.target_club_id,app.target_role,b.saveId]);await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'board',$3,$4)",[b.saveId,day,"Sollicitatie geslaagd", "Je bent aangenomen als "+app.target_role+" bij "+app.target_club+". Je nieuwe loopbaan begint vandaag."]);}else{await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'board',$3,$4)",[b.saveId,day,"Sollicitatie afgewezen",app.target_club+" heeft voor een andere kandidaat gekozen."]);}}
   const pending=await sql.query("SELECT o.*,p.full_name,p.overall_rating FROM transfer_offers o JOIN players p ON p.id=o.player_id WHERE o.save_id=$1 AND o.status='pending' AND o.submitted_on <= $2::date - INTERVAL '3 days'",[b.saveId,day]);
   for(const offer of pending as any[]){
    const asking=Math.max(50000,Number(offer.overall_rating)*Number(offer.overall_rating)*450);
    const accepted=Number(offer.fee)>=asking*.92?Math.random()<.78:Number(offer.fee)>=asking*.7?Math.random()<.32:Math.random()<.08;
    if(accepted&&Number(offer.fee)<=balance){
     await sql.query("UPDATE transfer_offers SET status='completed' WHERE id=$1",[offer.id]);
     await sql.query("UPDATE career_player_states SET club_id=$1,updated_at=NOW() WHERE save_id=$2 AND player_id=$3",[s.club_id,b.saveId,offer.player_id]);
     await sql.query("INSERT INTO career_player_contracts(id,save_id,player_id,club_id,start_date,end_date,weekly_wage,squad_status) VALUES($1,$2,$3,$4,$5,'2028-06-30',$6,'rotation')",["contract-"+crypto.randomUUID(),b.saveId,offer.player_id,s.club_id,day,offer.wage_offer]);
     await sql.query("UPDATE career_saves SET cash_balance=cash_balance-$1,transfer_budget=GREATEST(0,transfer_budget-$1) WHERE id=$2",[offer.fee,b.saveId]);
     await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,'transfer_out',$3,$4,$5)",[b.saveId,day,"Transfervergoeding "+offer.full_name,-Number(offer.fee),balance-Number(offer.fee)]);
     await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'transfer',$3,$4)",[b.saveId,day,"Transfer afgerond: "+offer.full_name,offer.full_name+" komt naar "+s.club_name+" voor €"+Number(offer.fee).toLocaleString("nl-NL")+"."]);
    }else{
     await sql.query("UPDATE transfer_offers SET status='rejected' WHERE id=$1",[offer.id]);
     await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'transfer',$3,$4)",[b.saveId,day,"Transferbod afgewezen",offer.full_name+" blijft voorlopig bij zijn huidige club."]);
    }
   }
   const xpGain=1+results.filter((x:any)=>(x.homeTeamId===s.club_id&&x.homeGoals>x.awayGoals)||(x.awayTeamId===s.club_id&&x.awayGoals>x.homeGoals)).length*3;
   await sql.query("UPDATE career_saves SET career_xp=career_xp+$1 WHERE id=$2",[xpGain,b.saveId]);
   // Keep the board objective tied to the live, save-specific league table.
   const currentRank=await sql.query("WITH table_rows AS (SELECT t.id,ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CASE WHEN cr.status='played' AND ((f.home_team_id=t.id AND cr.home_goals>cr.away_goals) OR (f.away_team_id=t.id AND cr.away_goals>cr.home_goals)) THEN 3 WHEN cr.status='played' AND cr.home_goals=cr.away_goals THEN 1 ELSE 0 END),0) DESC,COALESCE(SUM(CASE WHEN f.home_team_id=t.id AND cr.status='played' THEN cr.home_goals WHEN f.away_team_id=t.id AND cr.status='played' THEN cr.away_goals ELSE 0 END)-SUM(CASE WHEN f.home_team_id=t.id AND cr.status='played' THEN cr.away_goals WHEN f.away_team_id=t.id AND cr.status='played' THEN cr.home_goals ELSE 0 END),0) DESC) AS rank FROM teams t LEFT JOIN fixtures f ON (f.home_team_id=t.id OR f.away_team_id=t.id) AND f.season_id=$1 LEFT JOIN career_fixture_results cr ON cr.fixture_id=f.id AND cr.save_id=$3 WHERE t.division_id=$2 GROUP BY t.id) SELECT rank FROM table_rows WHERE id=$4",[SEASON,s.division_id,b.saveId,s.club_id]);
   if(currentRank.length){const rank=Number(currentRank[0].rank);await sql.query("UPDATE board_objectives SET progress_value=$1,status=CASE WHEN $1<=target_value THEN 'completed' ELSE 'active' END WHERE save_id=$2 AND objective_type='league_position'",[rank,b.saveId]);}
   const seasonEnd=await sql.query("SELECT MAX(kickoff_date) AS last_match,COUNT(*) FILTER(WHERE cr.status IS DISTINCT FROM 'played')::int AS unplayed FROM fixtures f LEFT JOIN career_fixture_results cr ON cr.fixture_id=f.id AND cr.save_id=$3 WHERE f.season_id=$1 AND f.division_id=$2",[SEASON,s.division_id,b.saveId]);
   if(seasonEnd[0]?.last_match && day>=dateOnly(seasonEnd[0].last_match) && Number(seasonEnd[0].unplayed)===0){
    const champion=await sql.query("SELECT t.name,COALESCE(SUM(CASE WHEN cr.status='played' AND ((f.home_team_id=t.id AND cr.home_goals>cr.away_goals) OR (f.away_team_id=t.id AND cr.away_goals>cr.home_goals)) THEN 3 WHEN cr.status='played' AND cr.home_goals=cr.away_goals THEN 1 ELSE 0 END),0)::int AS points FROM teams t LEFT JOIN fixtures f ON (f.home_team_id=t.id OR f.away_team_id=t.id) AND f.season_id=$1 LEFT JOIN career_fixture_results cr ON cr.fixture_id=f.id AND cr.save_id=$3 WHERE t.division_id=$2 GROUP BY t.id,t.name ORDER BY points DESC,t.name LIMIT 1",[SEASON,s.division_id,b.saveId]);
    if(champion.length)await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) SELECT $1,$2,'league','Seizoensslot: kampioen bekend',$3 WHERE NOT EXISTS (SELECT 1 FROM career_news WHERE save_id=$1 AND category='league' AND headline='Seizoensslot: kampioen bekend')",[b.saveId,day,champion[0].name+" is kampioen van "+s.club_name+"’s divisie met "+champion[0].points+" punten. Het seizoen is volledig uitgespeeld."]); 
   }
   return NextResponse.json({ok:true,gameDate:day,matchesPlayed:results.length,results,cashBalance:balance,leaguePosition:currentRank.length?Number(currentRank[0].rank):null,seasonComplete:Boolean(seasonEnd[0]?.last_match && day>=dateOnly(seasonEnd[0].last_match) && Number(seasonEnd[0].unplayed)===0)});
  }
  return fail("Onbekende actie.");
 }catch(e){console.error("career POST",e);return fail("Carrièreactie kon niet worden opgeslagen.",500);}
}
