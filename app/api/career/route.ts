import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SEASON = "2026-2027";
const START = "2026-08-01";
const COUNTRY_LABELS: Record<string,string> = { NED:"Nederland",ENG:"Engeland",GER:"Duitsland",FRA:"Frankrijk",ITA:"Italië",ESP:"Spanje" };
function makeSchedule(teams:any[],divisionId:string,season:string){
 const list=[...teams].sort((a,b)=>String(a.id).localeCompare(String(b.id)));if(list.length<2)return[];if(list.length%2)list.push({id:"BYE"});
 const n=list.length,rounds=n-1;let rotation=[...list],first:any[]=[];const homeCount=new Map<string,number>();
 for(let r=0;r<rounds;r++){for(let i=0;i<n/2;i++){let a=rotation[i],b=rotation[n-1-i];if(a.id==="BYE"||b.id==="BYE")continue;const ah=homeCount.get(a.id)||0,bh=homeCount.get(b.id)||0;let home=a,away=b;if(ah>bh||(ah===bh&&(r+i)%2===0)){home=b;away=a;}first.push({round:r+1,home:home.id,away:away.id});homeCount.set(home.id,(homeCount.get(home.id)||0)+1);}rotation=[rotation[0],rotation[n-1],...rotation.slice(1,n-1)];}
 const fixtures:any[]=[],base=new Date("2026-08-07T12:00:00Z");
 for(const m of first){const round=2*m.round-1,d=new Date(base);d.setUTCDate(d.getUTCDate()+(round-1)*7);fixtures.push({id:divisionId+"-md"+round+"-"+m.home+"-"+m.away,season,divisionId,round,date:d.toISOString().slice(0,10),home:m.home,away:m.away});}
 const offset=Math.floor(rounds/2);for(const m of first){const shifted=((m.round-1+offset)%rounds)+1,round=2*shifted,d=new Date(base);d.setUTCDate(d.getUTCDate()+(round-1)*7);fixtures.push({id:divisionId+"-md"+round+"-"+m.away+"-"+m.home,season,divisionId,round,date:d.toISOString().slice(0,10),home:m.away,away:m.home});}return fixtures;
}
async function ensureSaveSchedule(sql:any,saveId:string,divisionId:string,seasonId:string){
 const count=await sql.query("SELECT COUNT(*)::int AS n FROM career_fixture_schedule WHERE save_id=$1",[saveId]);
 const fixtureCount=await sql.query("SELECT COUNT(*)::int AS n FROM fixtures WHERE division_id=$1 AND season_id=$2",[divisionId,seasonId]);
 if(Number(count[0]?.n||0)>=Number(fixtureCount[0]?.n||0))return;
 const teams=(await sql.query("SELECT id FROM teams WHERE division_id=$1 ORDER BY id",[divisionId])).map((x:any)=>String(x.id));
     const fixtures=await sql.query("SELECT cfs.fixture_id AS id,cfs.matchday,cfs.kickoff_date,cr.home_goals,cr.away_goals,COALESCE(cr.status,'scheduled') AS status,h.name AS home_team,a.name AS away_team,(cfs.home_team_id=$1 OR cfs.away_team_id=$1) AS user_match FROM career_fixture_schedule cfs JOIN fixtures f ON f.id=cfs.fixture_id JOIN teams h ON h.id=cfs.home_team_id JOIN teams a ON a.id=cfs.away_team_id LEFT JOIN career_fixture_results cr ON cr.fixture_id=f.id AND cr.save_id=$5 WHERE f.division_id=$2 AND cfs.kickoff_date >= $3 AND (cfs.home_team_id=$4 OR cfs.away_team_id=$4) AND cfs.save_id=$5 ORDER BY cfs.kickoff_date,cfs.matchday LIMIT 12",[save.club_id,save.division_id,dateOnly(save.game_date),save.club_id,saveId]);
 if(teams.length<2||!fixtures.length)return;
 const list=[...teams].sort((x,y)=>x.localeCompare(y));if(list.length%2)list.push("__BYE__");const n=list.length;let rotation=[...list],homeCount=new Map<string,number>();const first:any[]=[];
 for(let r=0;r<n-1;r++){for(let i=0;i<n/2;i++){const x=rotation[i],y=rotation[n-1-i];if(x==="__BYE__"||y==="__BYE__")continue;const hx=homeCount.get(x)||0,hy=homeCount.get(y)||0;let home=x,away=y;if(hx>hy||(hx===hy&&(r+i)%2===0)){home=y;away=x;}first.push({home,away});homeCount.set(home,(homeCount.get(home)||0)+1);}rotation=[rotation[0],rotation[n-1],...rotation.slice(1,n-1)];}
 const orientation=new Map<string,{home:string;away:string}>();for(const pair of first)orientation.set([pair.home,pair.away].sort().join("|"),pair);
 const pairs=new Map<string,any[]>();for(const f of fixtures){const key=[String(f.home_team_id),String(f.away_team_id)].sort().join("|");if(!pairs.has(key))pairs.set(key,[]);pairs.get(key)!.push(f);}
 const rows:any[]=[];for(const [key,group] of pairs){const ordered=[...group].sort((x,y)=>Number(x.matchday)-Number(y.matchday));const pair=orientation.get(key);const preserve=group.some(x=>x.played);for(let i=0;i<ordered.length;i++){const f=ordered[i];let home=String(f.home_team_id),away=String(f.away_team_id);if(!preserve&&pair){home=i===0?pair.home:pair.away;away=i===0?pair.away:pair.home;}rows.push({id:f.id,matchday:Number(f.matchday),date:dateOnly(f.kickoff_date),home,away});}}
 for(let i=0;i<rows.length;i+=100){const chunk=rows.slice(i,i+100);const values=chunk.map(x=>"("+[saveId,x.id,x.matchday,x.date,x.home,x.away].map((v:any)=>"'"+String(v).replace(/'/g,"''")+"'").join(",")+")").join(",");await sql.query("INSERT INTO career_fixture_schedule(save_id,fixture_id,matchday,kickoff_date,home_team_id,away_team_id) VALUES "+values+" ON CONFLICT(save_id,fixture_id) DO NOTHING");}
}
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
    if(!saveId){const saves=url.searchParams.get("listSaves")==="1"?await sql.query("SELECT s.id,s.game_date,s.role,s.updated_at,m.full_name AS manager_name,t.name AS club_name,d.name AS division FROM career_saves s JOIN managers m ON m.id=s.manager_id JOIN teams t ON t.id=s.club_id JOIN divisions d ON d.id=t.division_id ORDER BY s.updated_at DESC NULLS LAST,s.created_at DESC LIMIT 5"):[];return NextResponse.json({season:SEASON,clubs,saves},{headers:{"Cache-Control":"no-store"}});}
    const got=await sql.query("SELECT s.*,m.full_name AS manager_name,t.name AS club_name,t.city,t.reputation,t.team_strength,d.name AS division,d.id AS division_id,d.country_code FROM career_saves s JOIN managers m ON m.id=s.manager_id JOIN teams t ON t.id=s.club_id JOIN divisions d ON d.id=t.division_id WHERE s.id=$1 LIMIT 1",[saveId]);
    if(!got.length)return fail("Carrière niet gevonden.",404);
    const save:any=got[0];
     await ensureSaveSchedule(sql,saveId,save.division_id,save.season_id||SEASON);
     const standings=await sql.query("SELECT t.id,t.name,COUNT(f.id) FILTER(WHERE COALESCE(cr.status,'scheduled')='played')::int AS played,COALESCE(SUM(CASE WHEN cr.status='played' AND ((cfs.home_team_id=t.id AND cr.home_goals>cr.away_goals) OR (cfs.away_team_id=t.id AND cr.away_goals>cr.home_goals)) THEN 3 WHEN cr.status='played' AND cr.home_goals=cr.away_goals THEN 1 ELSE 0 END),0)::int AS points,COALESCE(SUM(CASE WHEN cfs.home_team_id=t.id AND cr.status='played' THEN cr.home_goals WHEN cfs.away_team_id=t.id AND cr.status='played' THEN cr.away_goals ELSE 0 END),0)::int AS gf,COALESCE(SUM(CASE WHEN cfs.home_team_id=t.id AND cr.status='played' THEN cr.away_goals WHEN cfs.away_team_id=t.id AND cr.status='played' THEN cr.home_goals ELSE 0 END),0)::int AS ga FROM teams t LEFT JOIN career_fixture_schedule cfs ON cfs.save_id=$3 AND (cfs.home_team_id=t.id OR cfs.away_team_id=t.id) LEFT JOIN fixtures f ON f.id=cfs.fixture_id AND f.season_id=$1 LEFT JOIN career_fixture_results cr ON cr.fixture_id=f.id AND cr.save_id=$3 WHERE t.division_id=$2 GROUP BY t.id,t.name ORDER BY points DESC,t.name",[save.season_id||SEASON,save.division_id,saveId]);
    const fixtures=await sql.query("SELECT f.id,f.matchday,f.kickoff_date,cr.home_goals,cr.away_goals,COALESCE(cr.status,'scheduled') AS status,h.name AS home_team,a.name AS away_team,(f.home_team_id=$1 OR f.away_team_id=$1) AS user_match FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id LEFT JOIN career_fixture_results cr ON cr.fixture_id=f.id AND cr.save_id=$5 WHERE f.division_id=$2 AND f.kickoff_date >= $3 AND (f.home_team_id=$4 OR f.away_team_id=$4) ORDER BY f.kickoff_date,f.matchday LIMIT 12",[save.club_id,save.division_id,dateOnly(save.game_date),save.club_id,saveId]);
    const news=await sql.query("SELECT id,news_date,category,headline,body,is_read FROM career_news WHERE save_id=$1 ORDER BY id DESC LIMIT 25",[saveId]);
    const objectives=await sql.query("SELECT id,objective_type,description,target_value,progress_value,status FROM board_objectives WHERE save_id=$1 ORDER BY objective_type",[saveId]);
    const finances=await sql.query("SELECT entry_date,category,description,amount,balance_after FROM club_finances WHERE save_id=$1 ORDER BY id DESC LIMIT 20",[saveId]);
    const squad=await sql.query("SELECT p.id,p.full_name,p.position,p.overall_rating,p.potential_rating,p.date_of_birth,p.nationality,cps.fitness,cps.morale,cps.sharpness,cps.injury_type,cps.injury_until,pc.weekly_wage,pc.end_date AS contract_end,pc.release_clause FROM career_player_states cps JOIN players p ON p.id=cps.player_id LEFT JOIN player_contracts pc ON pc.player_id=p.id AND pc.club_id=cps.club_id WHERE cps.save_id=$1 AND cps.club_id=$2 AND p.is_active=TRUE ORDER BY p.overall_rating DESC,p.full_name LIMIT 40",[saveId,save.club_id]);
    const windowRows=await sql.query("SELECT id,window_name,opens_on,closes_on FROM transfer_windows WHERE season_id=$1 AND opens_on <= $2 AND closes_on >= $2 ORDER BY opens_on LIMIT 1",[SEASON,dateOnly(save.game_date)]);
    const market=await sql.query("SELECT p.id,p.full_name,p.position,p.overall_rating,p.potential_rating,p.date_of_birth,p.nationality,cps.club_id AS club_id,t.name AS club_name,t.reputation AS club_reputation,COALESCE(ph.appearances,0)::int AS appearances,COALESCE(ph.goals,0)::int AS goals,COALESCE(ph.assists,0)::int AS assists,COALESCE(ph.average_rating,0)::numeric AS average_rating,GREATEST(50000,p.overall_rating*p.overall_rating*450) AS asking_price FROM career_player_states cps JOIN players p ON p.id=cps.player_id JOIN teams t ON t.id=cps.club_id LEFT JOIN (SELECT player_id,club_id,SUM(appearances)::int AS appearances,SUM(goals)::int AS goals,SUM(assists)::int AS assists,ROUND(AVG(rating),2) AS average_rating FROM career_player_match_stats WHERE save_id=$1 GROUP BY player_id,club_id) ph ON ph.player_id=p.id AND ph.club_id=cps.club_id WHERE cps.save_id=$1 AND cps.club_id<>$2 AND p.is_active=TRUE AND p.overall_rating>=45 AND t.id NOT LIKE 'jong-%' ORDER BY p.overall_rating DESC LIMIT 500",[saveId,save.club_id]);
    const offers=await sql.query("SELECT o.id,o.fee,o.wage_offer,o.status,o.submitted_on,o.expires_on,p.full_name,t.name AS buying_club FROM transfer_offers o JOIN players p ON p.id=o.player_id JOIN teams t ON t.id=o.buying_club_id WHERE o.save_id=$1 ORDER BY o.id DESC LIMIT 20",[saveId]);
    const applications=await sql.query("SELECT a.id,a.target_role,a.applied_on,a.response_on,a.status,t.name AS target_club,t.city FROM career_applications a JOIN teams t ON t.id=a.target_club_id WHERE a.save_id=$1 ORDER BY a.id DESC LIMIT 20",[saveId]);
    const opportunities=await sql.query("SELECT t.id AS club_id,t.name AS club_name,t.city,d.name AS division,d.country_code,t.reputation FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id=$1 AND t.id<>$2 ORDER BY t.reputation DESC,t.name LIMIT 80",[SEASON,save.club_id]);
    const clubStaff=await sql.query("SELECT id,full_name,role,reputation,wage_weekly,employed_from,employed_until FROM club_staff WHERE club_id=$1 AND employed_until IS NULL ORDER BY role,full_name",[save.club_id]);
    const playerListings=await sql.query("SELECT payload,action_date FROM career_actions WHERE save_id=$1 AND action_type='player_listing' ORDER BY id DESC LIMIT 50",[saveId]);
    const contractTerms=await sql.query("SELECT payload FROM career_actions WHERE save_id=$1 AND action_type='player_contract_terms' ORDER BY id DESC",[saveId]);
    const facilities=await sql.query("SELECT t.id,t.name,t.reputation,t.stadium_name,t.stadium_capacity,t.ticket_price,t.season_budget,t.annual_revenue,t.annual_wage_bill,st.name AS venue_name,st.capacity AS venue_capacity,st.annual_maintenance FROM teams t LEFT JOIN stadiums st ON st.team_id=t.id WHERE t.id=$1 LIMIT 1",[save.club_id]);
    const facilityUpgrades=await sql.query("SELECT payload,result,action_date FROM career_actions WHERE save_id=$1 AND action_type='facility_upgrade' ORDER BY id DESC LIMIT 50",[saveId]);
    return NextResponse.json({season:SEASON,save,standings,fixtures,news,finances,squad,objectives,transferWindow:windowRows[0]||null,market,offers,applications,opportunities,facilities:facilities[0]||null,facilityUpgrades,clubStaff,playerListings,contractTerms},{headers:{"Cache-Control":"no-store"}});
  }catch(e){console.error("career GET",e);return fail("Carrière kon niet worden geladen.",500);}
}
export async function POST(request: Request) {
 const conn=process.env.DATABASE_URL;if(!conn)return fail("DATABASE_URL ontbreekt.",503);
 try{
  const b=await request.json(),sql=neon(conn);
  if(b.action==="create"){
   const activeSaves=await sql.query("SELECT COUNT(*)::int AS n FROM career_saves");if(Number(activeSaves[0]?.n||0)>=5)return fail("Je kunt maximaal 5 opgeslagen carrières hebben. Verwijder eerst een save om een nieuwe te starten.");
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
   await sql.query("INSERT INTO career_player_contracts(id,save_id,player_id,club_id,start_date,end_date,weekly_wage,squad_status) SELECT 'contract-'||$1||'-'||p.id,$1,p.id,p.team_id,$2,'2028-06-30',GREATEST(500,p.overall_rating*p.overall_rating*2),'rotation' FROM players p WHERE p.is_active=TRUE ON CONFLICT DO NOTHING",[saveId,START]);
   await sql.query("INSERT INTO career_actions(save_id,action_date,action_type,payload,result) SELECT $1,$2,'player_contract_terms',jsonb_build_object('playerId',p.id,'baseWage',GREATEST(500,p.overall_rating*p.overall_rating*2),'goalBonus',GREATEST(100,p.overall_rating*5),'assistBonus',GREATEST(50,p.overall_rating*3),'loyaltyBonus',GREATEST(1000,p.overall_rating*100),'signingBonus',GREATEST(5000,p.overall_rating*100)),'{}'::jsonb FROM players p WHERE p.is_active=TRUE AND p.team_id=$3",[saveId,START,c.id]);
   const fixtureCount=await sql.query("SELECT COUNT(*)::int AS n FROM fixtures WHERE season_id=$1 AND division_id=$2",[SEASON,c.division_id]);
   if(Number(fixtureCount[0]?.n||0)===0){const divisionTeams=await sql.query("SELECT id FROM teams WHERE division_id=$1 ORDER BY id",[c.division_id]);const schedule=makeSchedule(divisionTeams,c.division_id,SEASON);for(let i=0;i<schedule.length;i+=60){const batch=schedule.slice(i,i+60);const values:any[]=[];const tuples=batch.map((x:any,j:number)=>{const k=j*7;values.push(x.id,x.season,x.divisionId,x.round,x.date,x.home,x.away);return `(${k+1},${k+2},${k+3},${k+4},${k+5},${k+6},${k+7})`;});await sql.query("INSERT INTO fixtures(id,season_id,division_id,matchday,kickoff_date,home_team_id,away_team_id) VALUES "+tuples.join(",")+" ON CONFLICT(id) DO NOTHING",values);}}
   await ensureSaveSchedule(sql,saveId,c.division_id,SEASON);
    return NextResponse.json({saveId,clubId:c.id,club:c.name});
  }
  if(!b.saveId)return fail("saveId ontbreekt.");
  const rows=await sql.query("SELECT s.*,t.name AS club_name,t.division_id,m.full_name AS manager_name FROM career_saves s JOIN teams t ON t.id=s.club_id JOIN managers m ON m.id=s.manager_id WHERE s.id=$1 LIMIT 1",[b.saveId]);
  if(!rows.length)return fail("Carrière niet gevonden.",404);const s:any=rows[0];
  if(b.action==="delete_save"){const managerId=s.manager_id;await sql.query("DELETE FROM career_saves WHERE id=$1",[b.saveId]);await sql.query("DELETE FROM managers WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM career_saves WHERE manager_id=$1)",[managerId]);return NextResponse.json({ok:true});}
  if(b.action==="save_game"){await sql.query("UPDATE career_saves SET updated_at=NOW() WHERE id=$1",[b.saveId]);await sql.query("INSERT INTO career_actions(save_id,action_date,action_type,payload,result) VALUES($1,$2,'manual_save',$3::jsonb,$4::jsonb)",[b.saveId,dateOnly(s.game_date),JSON.stringify({gameDate:dateOnly(s.game_date)}),JSON.stringify({saved:true})]);return NextResponse.json({ok:true,savedAt:new Date().toISOString(),gameDate:dateOnly(s.game_date)});}
  if(b.action==="list_player"){
   const playerId=String(b.playerId||"");const listingType=["sale","loan","satellite"].includes(String(b.listingType))?String(b.listingType):"sale";const price=Math.max(0,Math.round(Number(b.askingPrice)||0));
   const player=await sql.query("SELECT p.id,p.full_name FROM career_player_states cps JOIN players p ON p.id=cps.player_id WHERE cps.save_id=$1 AND cps.club_id=$2 AND p.id=$3 AND p.is_active=TRUE LIMIT 1",[b.saveId,s.club_id,playerId]);if(!player.length)return fail("Speler hoort niet bij jouw selectie.",404);
   const payload={playerId,playerName:player[0].full_name,listingType,askingPrice:price,targetClubId:b.targetClubId||null,status:"listed"};
   await sql.query("INSERT INTO career_actions(save_id,action_date,action_type,payload,result) VALUES($1,$2,'player_listing',$3::jsonb,$4::jsonb)",[b.saveId,dateOnly(s.game_date),JSON.stringify(payload),JSON.stringify({ok:true})]);
   await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'transfer',$3,$4)",[b.saveId,dateOnly(s.game_date),"Speler aangeboden: "+player[0].full_name,player[0].full_name+" is op de transfermarkt geplaatst ("+listingType+")."]);
   return NextResponse.json({ok:true});
  }
  if(b.action==="terminate_player_contract"){
   const playerId=String(b.playerId||"");const contract=await sql.query("SELECT id,weekly_wage,end_date FROM career_player_contracts WHERE save_id=$1 AND player_id=$2 AND club_id=$3 AND end_date >= $4::date ORDER BY end_date DESC LIMIT 1",[b.saveId,playerId,s.club_id,dateOnly(s.game_date)]);
   if(!contract.length)return fail("Geen actief contract gevonden voor deze speler.");
   const weeks=Math.max(0,Math.ceil((new Date(String(contract[0].end_date)+"T12:00:00Z").getTime()-new Date(dateOnly(s.game_date)+"T12:00:00Z").getTime())/604800000));const penalty=Math.round(Number(contract[0].weekly_wage)*weeks*.75);
   if(penalty>Number(s.cash_balance||0))return fail("Onvoldoende clubkas voor de afkoopsom van €"+penalty.toLocaleString("nl-NL")+".");
   await sql.query("UPDATE career_player_contracts SET end_date=$1 WHERE id=$2",[dateOnly(s.game_date),contract[0].id]);await sql.query("UPDATE career_saves SET cash_balance=cash_balance-$1,updated_at=NOW() WHERE id=$2",[penalty,b.saveId]);
   await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,'contract',$3,$4,$5)",[b.saveId,dateOnly(s.game_date),"Contract ontbonden (75% resterend loon)",-penalty,Number(s.cash_balance)-penalty]);
   return NextResponse.json({ok:true,penalty});
  }
  if(b.action==="hire_staff"){
   const role=String(b.staffRole||"coach");const roles=["manager","assistant_manager","coach","scout","physio","sporting_director","chairperson"];
   if(!roles.includes(role))return fail("Ongeldige stafrol.");
   const current=await sql.query("SELECT COUNT(*)::int AS n FROM club_staff WHERE club_id=$1 AND role=$2 AND employed_until IS NULL",[s.club_id,role]);const cap=Math.max(1,Math.min(5,Math.ceil(Number(s.reputation||50)/20)));
   if(Number(current[0]?.n||0)>=cap)return fail("Deze club heeft het maximale aantal medewerkers voor deze rol.");
   const names=["Alex Morgan","Robin de Vries","Sam Taylor","Jordan Bakker","Jamie Wilson","Luca Moretti","Milan Jansen","Noah Peters","Ruben Visser","Thomas Smit"];const name=names[Math.floor(Math.random()*names.length)]+" "+(Math.floor(Math.random()*90)+10);
   const wage=Math.max(250,Math.round(Number(s.reputation||50)*Number(s.reputation||50)*(role==="manager"?1.5:role==="sporting_director"?1.1:0.55)));const signing=Math.round(wage*4);
   if(signing>Number(s.cash_balance||0))return fail("Onvoldoende clubkas voor tekengeld.");
   await sql.query("INSERT INTO club_staff(id,club_id,full_name,role,reputation,wage_weekly,employed_from,date_of_birth,career_status,career_path) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'employed',$9)",["staff-"+crypto.randomUUID(),s.club_id,name,role,Math.max(20,Math.min(95,Number(s.reputation||50)+Math.floor(Math.random()*15)-7)),wage,dateOnly(s.game_date),"1980-01-01",role]);
   await sql.query("UPDATE career_saves SET cash_balance=cash_balance-$1,updated_at=NOW() WHERE id=$2",[signing,b.saveId]);
   await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,'staff',$3,$4,$5)",[b.saveId,dateOnly(s.game_date),"Tekengeld staf: "+name,-signing,Number(s.cash_balance)-signing]);
   await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'club',$3,$4)",[b.saveId,dateOnly(s.game_date),"Nieuwe aanstelling: "+name,name+" is aangesteld als "+role.replaceAll("_"," ")+"."]);
   return NextResponse.json({ok:true});
  }
  if(b.action==="terminate_staff_contract"){
   const staffId=String(b.staffId||"");const staff=await sql.query("SELECT id,full_name,role,wage_weekly FROM club_staff WHERE id=$1 AND club_id=$2 AND employed_until IS NULL LIMIT 1",[staffId,s.club_id]);if(!staff.length)return fail("Medewerker niet gevonden.");
   const penalty=Math.round(Number(staff[0].wage_weekly||0)*52*.75);if(penalty>Number(s.cash_balance||0))return fail("Onvoldoende clubkas voor de afkoopsom van €"+penalty.toLocaleString("nl-NL")+".");
   await sql.query("UPDATE club_staff SET employed_until=$1 WHERE id=$2",[dateOnly(s.game_date),staffId]);await sql.query("UPDATE career_saves SET cash_balance=cash_balance-$1,updated_at=NOW() WHERE id=$2",[penalty,b.saveId]);
   await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,'contract',$3,$4,$5)",[b.saveId,dateOnly(s.game_date),"Contract ontbonden: "+staff[0].full_name,-penalty,Number(s.cash_balance)-penalty]);
   return NextResponse.json({ok:true,penalty});
  }
  if(b.action==="upgrade_facility"){
   const facility=String(b.facility||"");const valid=["stadium","lighting","catering","toilets","hospitality","training","youth","marketing","accessibility"];
   if(!valid.includes(facility))return fail("Onbekende faciliteit.");
   const history=await sql.query("SELECT payload FROM career_actions WHERE save_id=$1 AND action_type='facility_upgrade' ORDER BY id DESC LIMIT 100",[b.saveId]);
   const prior=history.find((x:any)=>x.payload?.facility===facility);const level=Math.max(1,Number(prior?.payload?.level||1));const next=level+1;
   if(facility==="stadium"&&next>Math.max(1,Math.min(5,Math.ceil(Number(s.reputation||50)/20))))return fail("De clubreputatie is nog niet hoog genoeg voor deze stadionklasse.");
   if(next>5)return fail("Deze faciliteit heeft al het maximale niveau van 5 sterren.");
   const base:Record<string,number>={stadium:800000,lighting:180000,catering:120000,toilets:90000,hospitality:450000,training:350000,youth:220000,marketing:160000,accessibility:140000};
   const cost=Math.round(base[facility]*Math.pow(next,1.65));if(cost>Number(s.cash_balance||0))return fail("Onvoldoende clubkas voor deze investering.");
   const balance=Number(s.cash_balance)-cost;const payload={facility,level:next,cost};
   await sql.query("INSERT INTO career_actions(save_id,action_date,action_type,payload,result) VALUES($1,$2,'facility_upgrade',$3::jsonb,$4::jsonb)",[b.saveId,dateOnly(s.game_date),JSON.stringify(payload),JSON.stringify({ok:true})]);
   await sql.query("UPDATE career_saves SET cash_balance=$1,updated_at=NOW() WHERE id=$2",[balance,b.saveId]);
   await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,'facility',$3,$4,$5)",[b.saveId,dateOnly(s.game_date),"Investering faciliteit: "+facility,-cost,balance]);
   await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'club',$3,$4)",[b.saveId,dateOnly(s.game_date),"Clubfaciliteit verbeterd","De club investeert €"+cost.toLocaleString("nl-NL")+" in "+facility+". Het niveau is nu "+next+"/5."]);
   return NextResponse.json({ok:true,facility,level:next,cost,balance});
  }
  if(b.action==="report_injury"){
    const playerId=String(b.playerId||"");const injuryType=String(b.injuryType||"Spierblessure").slice(0,120);const days=Math.max(1,Math.min(365,Number(b.recoveryDays)||7));
    const player=await sql.query("SELECT p.full_name FROM career_player_states cps JOIN players p ON p.id=cps.player_id WHERE cps.save_id=$1 AND cps.player_id=$2 LIMIT 1",[b.saveId,playerId]);if(!player.length)return fail("Speler hoort niet bij deze carrièredatabase.",404);
    const until=new Date(String(s.game_date).slice(0,10)+"T12:00:00Z");until.setUTCDate(until.getUTCDate()+days);const untilDate=dateOnly(until);
    await sql.query("UPDATE career_player_states SET injury_type=$1,injury_until=$2,fitness=GREATEST(25,fitness-20),updated_at=NOW() WHERE save_id=$3 AND player_id=$4",[injuryType,untilDate,b.saveId,playerId]);
    await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'injury',$3,$4)",[b.saveId,dateOnly(s.game_date),"Blessure tijdens wedstrijd: "+player[0].full_name,player[0].full_name+" is uitgevallen met "+injuryType+". Verwachte terugkeer: "+untilDate+"."]);
    return NextResponse.json({ok:true,injuryUntil:untilDate});
   }
  if(b.action==="tactics"){await sql.query("UPDATE career_saves SET tactical_setup=$1::jsonb,updated_at=NOW() WHERE id=$2",[JSON.stringify(b.tactics||{}),b.saveId]);return NextResponse.json({ok:true});}
  if(b.action==="offer_transfer"){
   const playerId=String(b.playerId||""),fee=Math.max(0,Math.round(Number(b.fee)||0)),wage=Math.max(0,Math.round(Number(b.wage)||0));
   const win=await sql.query("SELECT id FROM transfer_windows WHERE season_id=$1 AND opens_on <= $2 AND closes_on >= $2 LIMIT 1",[SEASON,dateOnly(s.game_date)]);
   if(!win.length)return fail("De transfermarkt is gesloten. Je kunt alleen binnen een transferwindow onderhandelen.");
   const player=await sql.query("SELECT p.id,cps.club_id AS team_id,p.full_name,p.overall_rating,t.name AS club_name FROM players p JOIN career_player_states cps ON cps.player_id=p.id AND cps.save_id=$3 JOIN teams t ON t.id=cps.club_id WHERE p.id=$1 AND p.is_active=TRUE AND cps.club_id<>$2 LIMIT 1",[playerId,s.club_id,b.saveId]);
   if(!player.length)return fail("Deze speler is niet beschikbaar voor een bod.",404);
   if(fee>Number(s.transfer_budget))return fail("Dit bod ligt boven het beschikbare transferbudget.");
   const p:any=player[0],offerId="offer-"+crypto.randomUUID(),expires=new Date(String(s.game_date)+"T12:00:00Z");expires.setUTCDate(expires.getUTCDate()+7);
   await sql.query("INSERT INTO transfer_offers(id,save_id,player_id,buying_club_id,selling_club_id,fee,wage_offer,status,submitted_on,expires_on,notes) VALUES($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10)",[offerId,b.saveId,p.id,s.club_id,p.team_id,fee,wage,dateOnly(s.game_date),dateOnly(expires),JSON.stringify({summary:"Bod uitgebracht op "+p.full_name,installments:Number(b.installments||1),sellOn:Number(b.sellOn||0),endOfSeason:Boolean(b.endOfSeason),appearanceBonus:Number(b.appearanceBonus||0),goalBonus:Number(b.goalBonus||0),internationalBonus:Number(b.internationalBonus||0),loan:Boolean(b.loan)})]);
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
await sql.query("WITH selected AS (SELECT p.id AS player_id,cps.club_id,ROW_NUMBER() OVER(PARTITION BY cps.club_id ORDER BY CASE WHEN cps.club_id=$7 AND p.id IN (SELECT jsonb_array_elements_text($8::jsonb)) THEN 0 ELSE 1 END,random()) AS rn FROM career_player_states cps JOIN players p ON p.id=cps.player_id WHERE cps.save_id=$1 AND cps.club_id IN ($2,$3) AND p.is_active=TRUE AND cps.injury_until IS NULL AND (cps.club_id<>$7 OR p.id IN (SELECT jsonb_array_elements_text($8::jsonb)))), stats AS (SELECT selected.player_id,selected.club_id,CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements($9::jsonb) sc WHERE sc->>'playerId'=selected.player_id AND ((sc->>'team')::int=0 AND selected.club_id=$2 OR (sc->>'team')::int=1 AND selected.club_id=$3)) THEN 1 ELSE 0 END AS goals,CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements($9::jsonb) sc WHERE sc->>'assistId'=selected.player_id AND ((sc->>'team')::int=0 AND selected.club_id=$2 OR (sc->>'team')::int=1 AND selected.club_id=$3)) THEN 1 ELSE 0 END AS assists,ROUND((6+random()*2)::numeric,2) AS rating FROM selected WHERE rn<=11) INSERT INTO career_player_match_stats(id,save_id,fixture_id,player_id,club_id,appearances,goals,assists,rating) SELECT 'cpm-'||md5(random()::text||player_id),$1,$6,player_id,club_id,1,goals,assists,rating FROM stats ON CONFLICT(save_id,fixture_id,player_id) DO NOTHING",[b.saveId,f.home_team_id,f.away_team_id,homeGoals,awayGoals,fixtureId,s.club_id,JSON.stringify(b.lineup||[]),JSON.stringify(b.scorers||[])]);
   const otherMatches=await sql.query("SELECT f.*,h.team_strength AS hs,h.reputation AS hr,a.team_strength AS aws,a.reputation AS ar FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id WHERE f.kickoff_date=$1 AND f.status='scheduled' AND f.division_id=$2 AND f.id<>$3 AND NOT EXISTS (SELECT 1 FROM career_fixture_results cr WHERE cr.fixture_id=f.id AND cr.save_id=$4)",[day,s.division_id,fixtureId,b.saveId]);
    for(const other of otherMatches as any[]){const score=matchScore(Number(other.hs)+Number(other.hr)*.08,Number(other.aws)+Number(other.ar)*.08);await sql.query("INSERT INTO career_fixture_results(save_id,fixture_id,home_goals,away_goals,status,played_at) VALUES($1,$2,$3,$4,'played',NOW()) ON CONFLICT(save_id,fixture_id) DO NOTHING",[b.saveId,other.id,score.homeGoals,score.awayGoals]);await sql.query("WITH selected AS (SELECT p.id AS player_id,cps.club_id,ROW_NUMBER() OVER(PARTITION BY cps.club_id ORDER BY random()) AS rn FROM career_player_states cps JOIN players p ON p.id=cps.player_id WHERE cps.save_id=$1 AND cps.club_id IN ($2,$3) AND p.is_active=TRUE AND cps.injury_until IS NULL), stats AS (SELECT player_id,club_id,CASE WHEN club_id=$2 AND rn<=LEAST($4,11) THEN 1 WHEN club_id=$3 AND rn<=LEAST($5,11) THEN 1 ELSE 0 END AS goals,CASE WHEN club_id=$2 AND rn>LEAST($4,11) AND rn<=LEAST($4+2,11) THEN 1 WHEN club_id=$3 AND rn>LEAST($5,11) AND rn<=LEAST($5+2,11) THEN 1 ELSE 0 END AS assists,ROUND((6+random()*2)::numeric,2) AS rating FROM selected WHERE rn<=11) INSERT INTO career_player_match_stats(id,save_id,fixture_id,player_id,club_id,appearances,goals,assists,rating) SELECT 'cpm-'||md5(random()::text||player_id),$1,$6,player_id,club_id,1,goals,assists,rating FROM stats ON CONFLICT(save_id,fixture_id,player_id) DO NOTHING",[b.saveId,other.home_team_id,other.away_team_id,score.homeGoals,score.awayGoals,other.id]);}
   const gf=f.home_team_id===s.club_id?homeGoals:awayGoals,ga=f.home_team_id===s.club_id?awayGoals:homeGoals,opponent=f.home_team_id===s.club_id?f.away_name:f.home_name;
   const title=gf>ga?"Overwinning voor "+s.club_name:gf<ga?"Nederlaag voor "+s.club_name:"Gelijkspel voor "+s.club_name;
   await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'match',$3,$4)",[b.saveId,day,title,s.club_name+" "+gf+"-"+ga+" "+opponent]);
   const conf=Math.max(0,Math.min(100,Number(s.board_confidence)+(gf>ga?2:gf<ga?-3:0))),morale=Math.max(0,Math.min(100,Number(s.club_morale)+(gf>ga?3:gf<ga?-4:0)));
   await sql.query("UPDATE career_saves SET game_date=$1,board_confidence=$2,club_morale=$3,updated_at=NOW() WHERE id=$4",[day,conf,morale,b.saveId]);
   return NextResponse.json({ok:true,gameDate:day,fixtureId,homeGoals,awayGoals});
  }
  if(b.action==="advance_day"){
   const dayDate=new Date(dateOnly(s.game_date)+"T12:00:00Z");dayDate.setUTCDate(dayDate.getUTCDate()+1);const day=dateOnly(dayDate);
   const pendingFixture=await sql.query("SELECT f.id,f.home_team_id,f.away_team_id,f.kickoff_date,h.name AS home_name,a.name AS away_name FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id WHERE f.kickoff_date=$1 AND f.status='scheduled' AND f.division_id=$2 AND (f.home_team_id=$3 OR f.away_team_id=$3) AND NOT EXISTS (SELECT 1 FROM career_fixture_results cr WHERE cr.fixture_id=f.id AND cr.save_id=$4) LIMIT 1",[day,s.division_id,s.club_id,b.saveId]);
   if(pendingFixture.length)return NextResponse.json({ok:true,needsMatch:true,fixture:pendingFixture[0],gameDate:day});
   await sql.query("UPDATE career_saves SET game_date=$1,updated_at=NOW() WHERE id=$2",[day,b.saveId]);
   const scheduled=await sql.query("SELECT f.*,h.team_strength AS hs,h.reputation AS hr,a.team_strength AS aws,a.reputation AS ar FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id WHERE f.kickoff_date=$1 AND f.status='scheduled' AND f.division_id=$2 AND NOT EXISTS (SELECT 1 FROM career_fixture_results cr WHERE cr.fixture_id=f.id AND cr.save_id=$3)",[day,s.division_id,b.saveId]);
   const results=[];
   for(const f of scheduled as any[]){
    const ht=f.home_team_id===s.club_id?(s.tactical_setup||{}):{},at=f.away_team_id===s.club_id?(s.tactical_setup||{}):{};
    const score=matchScore(Number(f.hs)+Number(f.hr)*.08,Number(f.aws)+Number(f.ar)*.08,ht,at);
    await sql.query("INSERT INTO career_fixture_results(save_id,fixture_id,home_goals,away_goals,status,played_at) VALUES($1,$2,$3,$4,'played',NOW()) ON CONFLICT(save_id,fixture_id) DO NOTHING",[b.saveId,f.id,score.homeGoals,score.awayGoals]);
await sql.query("WITH selected AS (SELECT p.id AS player_id,cps.club_id,ROW_NUMBER() OVER(PARTITION BY cps.club_id ORDER BY random()) AS rn FROM career_player_states cps JOIN players p ON p.id=cps.player_id WHERE cps.save_id=$1 AND cps.club_id IN ($2,$3) AND p.is_active=TRUE AND cps.injury_until IS NULL), stats AS (SELECT player_id,club_id,CASE WHEN club_id=$2 AND rn<=LEAST($4,11) THEN 1 WHEN club_id=$3 AND rn<=LEAST($5,11) THEN 1 ELSE 0 END AS goals,CASE WHEN club_id=$2 AND rn>LEAST($4,11) AND rn<=LEAST($4+2,11) THEN 1 WHEN club_id=$3 AND rn>LEAST($5,11) AND rn<=LEAST($5+2,11) THEN 1 ELSE 0 END AS assists,ROUND((6+random()*2)::numeric,2) AS rating FROM selected WHERE rn<=11) INSERT INTO career_player_match_stats(id,save_id,fixture_id,player_id,club_id,appearances,goals,assists,rating) SELECT 'cpm-'||md5(random()::text||player_id),$1,$6,player_id,club_id,1,goals,assists,rating FROM stats ON CONFLICT(save_id,fixture_id,player_id) DO NOTHING",[b.saveId,f.home_team_id,f.away_team_id,score.homeGoals,score.awayGoals,f.id]);
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
    const facilityRows=await sql.query("SELECT payload FROM career_actions WHERE save_id=$1 AND action_type='facility_upgrade' ORDER BY id DESC LIMIT 100",[b.saveId]);const facilityLevels:Record<string,number>={};for(const row of facilityRows as any[]){const f=row.payload?.facility;if(f&&!facilityLevels[f])facilityLevels[f]=Number(row.payload?.level||1);}const facilityRevenueFactor=1+Math.max(0,(facilityLevels.catering||1)-1)*.05+Math.max(0,(facilityLevels.hospitality||1)-1)*.08+Math.max(0,(facilityLevels.marketing||1)-1)*.04+Math.max(0,(facilityLevels.accessibility||1)-1)*.02;
    const staffWages=await sql.query("SELECT COALESCE(SUM(wage_weekly),0)::numeric AS total FROM club_staff WHERE club_id=$1 AND employed_until IS NULL",[s.club_id]);
    const dailyCost=Math.round((Number(s.wage_budget_weekly||0)+Number(staffWages[0]?.total||0))/7+Math.max(250,Number(s.cash_balance)*.00004)); const userFixture=results.find((x:any)=>x.homeTeamId===s.club_id||x.awayTeamId===s.club_id); const matchRevenue=userFixture?(userFixture.homeTeamId===s.club_id?Math.round((120000+Number(s.reputation||50)*9000)*facilityRevenueFactor):45000):0; const balance=Number(s.cash_balance)-dailyCost+matchRevenue;
   await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,'wages','Dagelijkse lonen en exploitatie',$3,$4)",[b.saveId,day,-dailyCost,balance]);
    if(userFixture && matchRevenue>0) await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,$3,$4,$5,$6)",[b.saveId,day,userFixture.homeTeamId===s.club_id?"ticketing":"broadcast",userFixture.homeTeamId===s.club_id?"Wedstrijddag: kaartverkoop en horeca":"Wedstrijddag: media-inkomsten",matchRevenue,balance]);
   await sql.query("UPDATE career_saves SET cash_balance=$1 WHERE id=$2",[balance,b.saveId]);
   
   const players=await sql.query("SELECT cps.player_id AS id,p.full_name,cps.fitness,cps.injury_type,cps.injury_until FROM career_player_states cps JOIN players p ON p.id=cps.player_id WHERE cps.save_id=$1 AND cps.club_id=$2 AND p.is_active=TRUE",[b.saveId,s.club_id]);
   for(const p of players as any[]){
    const injury=userFixture && !p.injury_until && Math.random()<.003,fit=Math.max(40,Math.min(100,Number(p.fitness)+(userFixture?-(8+Math.floor(Math.random()*10)):1+Math.floor(Math.random()*2)))),kind=injury?(Math.random()<.5?"Hamstringblessure":"Enkelblessure"):null;
    const until=injury?dateOnly(new Date(dayDate.getTime()+(7+Math.floor(Math.random()*35))*86400000)):null;
    await sql.query("UPDATE career_player_states SET fitness=$1,injury_type=CASE WHEN $2::text IS NOT NULL THEN $2 WHEN injury_until < $3::date THEN NULL ELSE injury_type END,injury_until=CASE WHEN $2::text IS NOT NULL THEN $4 WHEN injury_until < $3::date THEN NULL ELSE injury_until END,updated_at=NOW() WHERE save_id=$5 AND player_id=$6",[fit,kind,day,until,b.saveId,p.id]);
     if(injury)await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'injury',$3,$4)",[b.saveId,day,"Blessure: "+p.full_name,p.full_name+" heeft "+String(kind||"een blessure").toLowerCase()+". Verwachte terugkeer: "+until+"."]);else if(p.injury_type&&p.injury_until&&dateOnly(p.injury_until)<day)await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'injury',$3,$4)",[b.saveId,day,"Terug van blessure: "+p.full_name,p.full_name+" heeft de revalidatie afgerond en is weer beschikbaar voor selectie."]);
   }
       if(Math.random()<0.12){
     const rumour=await sql.query("SELECT p.id,p.full_name,cps.club_id,t.name AS old_club FROM career_player_states cps JOIN players p ON p.id=cps.player_id JOIN teams t ON t.id=cps.club_id WHERE cps.save_id=$1 AND cps.club_id<>$2 AND p.is_active=TRUE AND p.overall_rating>=60 ORDER BY random() LIMIT 1",[b.saveId,s.club_id]);
     if(rumour.length){const p:any=rumour[0];if(Math.random()<0.48){const targets=await sql.query("SELECT id,name FROM teams WHERE id<>$1 AND id<>$2 ORDER BY random() LIMIT 1",[p.club_id,s.club_id]);if(targets.length){const target:any=targets[0];await sql.query("UPDATE career_player_states SET club_id=$1,updated_at=NOW() WHERE save_id=$2 AND player_id=$3",[target.id,b.saveId,p.id]);await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'transfer',$3,$4)",[b.saveId,day,"AI-transfer afgerond: "+p.full_name,p.full_name+" vertrekt bij "+p.old_club+" en tekent bij "+target.name+". De transfer is verwerkt in deze carrière."]);}}else{await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'transfer',$3,$4)",[b.saveId,day,"Transfergerucht: "+p.full_name,p.old_club+" onderzoekt aanbiedingen voor "+p.full_name+". Er is nog geen akkoord bereikt."]);}}
    }
    if(Math.random()<0.045){const managerRumour=await sql.query("SELECT cs.full_name,cs.role,t.name AS club_name FROM club_staff cs JOIN teams t ON t.id=cs.club_id WHERE cs.role IN ('manager','head_coach') AND cs.employed_until IS NULL ORDER BY random() LIMIT 1");if(managerRumour.length){const m:any=managerRumour[0];await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'manager',$3,$4)",[b.saveId,day,"Druk neemt toe bij "+m.club_name,m.full_name+" ligt onder druk na tegenvallende resultaten. Het bestuur overweegt de positie van de "+m.role+"."]);}}
    const dueLoans=await sql.query("SELECT id,payload FROM career_actions WHERE save_id=$1 AND action_type='player_listing' AND payload->>'status'='loaned' AND (payload->>'returnDate')::date <= $2::date",[b.saveId,day]);
    for(const loan of dueLoans as any[]){const p=loan.payload;await sql.query("UPDATE career_player_states SET club_id=$1,updated_at=NOW() WHERE save_id=$2 AND player_id=$3",[p.returnClubId||s.club_id,b.saveId,p.playerId]);const payload={...p,status:"returned"};await sql.query("UPDATE career_actions SET payload=$1::jsonb WHERE id=$2",[JSON.stringify(payload),loan.id]);await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'transfer',$3,$4)",[b.saveId,day,"Huurperiode afgelopen: "+p.playerName,p.playerName+" keert terug van de huurperiode."]);}
    const listedPlayers=await sql.query("SELECT id,payload FROM career_actions WHERE save_id=$1 AND action_type='player_listing' AND payload->>'status'='listed'",[b.saveId]);
    for(const listing of listedPlayers as any[]){if(Math.random()>.12)continue;const p=listing.payload;const targets=await sql.query("SELECT id,name FROM teams WHERE id<>$1 AND id<>$2 ORDER BY random() LIMIT 1",[s.club_id,s.club_id]);if(!targets.length)continue;const target:any=targets[0];const payload={...p,status:p.listingType==='loan'?'loaned':'completed',targetClub:target.name,returnClubId:s.club_id};if(p.listingType==='loan'){const returnDate=new Date(day+"T12:00:00Z");returnDate.setUTCDate(returnDate.getUTCDate()+180);payload.returnDate=dateOnly(returnDate);}await sql.query("UPDATE career_player_states SET club_id=$1,updated_at=NOW() WHERE save_id=$2 AND player_id=$3",[target.id,b.saveId,p.playerId]);await sql.query("UPDATE career_actions SET payload=$1::jsonb WHERE id=$2",[JSON.stringify(payload),listing.id]);await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'transfer',$3,$4)",[b.saveId,day,(p.listingType==='loan'?'Uitgeleend: ':'Transfer afgerond: ')+p.playerName,p.playerName+(p.listingType==='loan'?' wordt tijdelijk uitgeleend aan ':' vertrekt naar ')+target.name+"."]);}
const applications=await sql.query("SELECT a.*,t.name AS target_club FROM career_applications a JOIN teams t ON t.id=a.target_club_id WHERE a.save_id=$1 AND a.status='pending' AND a.response_on <= $2::date",[b.saveId,day]);
   for(const app of applications as any[]){const accepted=Math.random()<(Math.max(0,Math.min(0.78,0.15+Number(s.career_xp||0)/500+Number(s.board_confidence||50)/500)));const status=accepted?"accepted":"rejected";await sql.query("UPDATE career_applications SET status=$1 WHERE id=$2",[status,app.id]);if(accepted){await sql.query("UPDATE career_saves SET club_id=$1,role=$2,board_confidence=60,updated_at=NOW() WHERE id=$3",[app.target_club_id,app.target_role,b.saveId]);await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'board',$3,$4)",[b.saveId,day,"Sollicitatie geslaagd", "Je bent aangenomen als "+app.target_role+" bij "+app.target_club+". Je nieuwe loopbaan begint vandaag."]);}else{await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'board',$3,$4)",[b.saveId,day,"Sollicitatie afgewezen",app.target_club+" heeft voor een andere kandidaat gekozen."]);}}
    const deferred=await sql.query("SELECT id,payload FROM career_actions WHERE save_id=$1 AND action_type='deferred_transfer' AND payload->>'status'='pending' AND (payload->>'dueDate')::date <= $2::date",[b.saveId,day]);
    for(const item of deferred as any[]){const p=item.payload;const upfront=Math.ceil(Number(p.fee)/Math.max(1,Number(p.months||1)));await sql.query("UPDATE career_player_states SET club_id=$1,updated_at=NOW() WHERE save_id=$2 AND player_id=$3",[p.buyingClubId,b.saveId,p.playerId]);await sql.query("INSERT INTO career_player_contracts(id,save_id,player_id,club_id,start_date,end_date,weekly_wage,squad_status) VALUES($1,$2,$3,$4,$5,'2028-06-30',$6,'rotation')",["contract-"+crypto.randomUUID(),b.saveId,p.playerId,p.buyingClubId,day,p.wage]);await sql.query("UPDATE career_saves SET cash_balance=cash_balance-$1,transfer_budget=GREATEST(0,transfer_budget-$1) WHERE id=$2",[upfront,b.saveId]);if(Number(p.months)>1){const next=new Date(day+"T12:00:00Z");next.setUTCDate(next.getUTCDate()+30);const installment={playerId:p.playerId,playerName:p.playerName,remaining:Number(p.months)-1,monthlyAmount:upfront,nextDate:dateOnly(next),status:"pending"};await sql.query("INSERT INTO career_actions(save_id,action_date,action_type,payload,result) VALUES($1,$2,'transfer_installment',$3::jsonb,$4::jsonb)",[b.saveId,day,JSON.stringify(installment),JSON.stringify({ok:true})]);}await sql.query("UPDATE career_actions SET payload=$1::jsonb WHERE id=$2",[JSON.stringify({...p,status:"completed"}),item.id]);await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'transfer',$3,$4)",[b.saveId,day,"Transfer voltooid: "+p.playerName,p.playerName+" sluit zich nu aan bij de club na de afgesproken transfer aan het einde van het seizoen."]);}
    const installments=await sql.query("SELECT id,payload FROM career_actions WHERE save_id=$1 AND action_type='transfer_installment' AND payload->>'status'='pending' AND (payload->>'nextDate')::date <= $2::date",[b.saveId,day]);
    for(const item of installments as any[]){const p=item.payload;const amount=Number(p.monthlyAmount||0);await sql.query("UPDATE career_saves SET cash_balance=cash_balance-$1,updated_at=NOW() WHERE id=$2",[amount,b.saveId]);const remaining=Math.max(0,Number(p.remaining||0)-1),next=new Date(day+"T12:00:00Z");next.setUTCDate(next.getUTCDate()+30);const payload={...p,remaining,nextDate:dateOnly(next),status:remaining===0?"paid":"pending"};await sql.query("UPDATE career_actions SET payload=$1::jsonb WHERE id=$2",[JSON.stringify(payload),item.id]);await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,'transfer_out',$3,$4,$5)",[b.saveId,day,"Termijnbetaling "+p.playerName,-amount,Number(s.cash_balance)-amount]);}
   const pending=await sql.query("SELECT o.*,p.full_name,p.overall_rating FROM transfer_offers o JOIN players p ON p.id=o.player_id WHERE o.save_id=$1 AND o.status='pending' AND o.submitted_on <= $2::date - INTERVAL '3 days'",[b.saveId,day]);
   for(const offer of pending as any[]){
     const asking=Math.max(50000,Number(offer.overall_rating)*Number(offer.overall_rating)*450);
     let terms:any={};try{terms=JSON.parse(String(offer.notes||"{}"));}catch{}
     const months=Math.max(1,Math.min(60,Number(terms.installments||1))),upfront=Math.ceil(Number(offer.fee)/months);
     const accepted=Number(offer.fee)>=asking*.92?Math.random()<.78:Number(offer.fee)>=asking*.7?Math.random()<.32:Math.random()<.08;
     if(accepted&&upfront<=balance){
      if(terms.endOfSeason){
       const payload={playerId:offer.player_id,playerName:offer.full_name,buyingClubId:s.club_id,sellingClubId:offer.selling_club_id,fee:Number(offer.fee),wage:Number(offer.wage_offer),months,dueDate:"2027-06-30",status:"pending"};
       await sql.query("UPDATE transfer_offers SET status='accepted' WHERE id=$1",[offer.id]);
       await sql.query("INSERT INTO career_actions(save_id,action_date,action_type,payload,result) VALUES($1,$2,'deferred_transfer',$3::jsonb,$4::jsonb)",[b.saveId,day,JSON.stringify(payload),JSON.stringify({ok:true})]);
       await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'transfer',$3,$4)",[b.saveId,day,"Akkoord bereikt: "+offer.full_name,offer.full_name+" sluit aan het einde van het seizoen aan bij "+s.club_name+"."]);
       continue;
      }
      const returnDate=new Date(day+"T12:00:00Z");returnDate.setUTCDate(returnDate.getUTCDate()+180);
      await sql.query("UPDATE transfer_offers SET status='completed' WHERE id=$1",[offer.id]);
      await sql.query("UPDATE career_player_states SET club_id=$1,updated_at=NOW() WHERE save_id=$2 AND player_id=$3",[s.club_id,b.saveId,offer.player_id]);
      await sql.query("INSERT INTO career_player_contracts(id,save_id,player_id,club_id,start_date,end_date,weekly_wage,squad_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",["contract-"+crypto.randomUUID(),b.saveId,offer.player_id,s.club_id,day,terms.loan?dateOnly(returnDate):"2028-06-30",offer.wage_offer,terms.loan?"loan":"rotation"]);
      await sql.query("INSERT INTO career_actions(save_id,action_date,action_type,payload,result) VALUES($1,$2,'player_contract_terms',$3::jsonb,$4::jsonb)",[b.saveId,day,JSON.stringify({playerId:offer.player_id,baseWage:Number(offer.wage_offer||0),goalBonus:Math.max(100,Number(offer.overall_rating)*5),assistBonus:Math.max(50,Number(offer.overall_rating)*3),loyaltyBonus:Math.max(1000,Number(offer.overall_rating)*100),signingBonus:Math.max(5000,Number(offer.overall_rating)*100)}),JSON.stringify({ok:true})]);
      if(terms.loan){const payload={playerId:offer.player_id,playerName:offer.full_name,listingType:"loan",status:"loaned",returnDate:dateOnly(returnDate),targetClub:s.club_id,returnClubId:offer.selling_club_id};await sql.query("INSERT INTO career_actions(save_id,action_date,action_type,payload,result) VALUES($1,$2,'player_listing',$3::jsonb,$4::jsonb)",[b.saveId,day,JSON.stringify(payload),JSON.stringify({ok:true})]);}
      if(months>1){const next=new Date(day+"T12:00:00Z");next.setUTCDate(next.getUTCDate()+30);const payload={playerId:offer.player_id,playerName:offer.full_name,remaining:months-1,monthlyAmount:upfront,nextDate:dateOnly(next),status:"pending"};await sql.query("INSERT INTO career_actions(save_id,action_date,action_type,payload,result) VALUES($1,$2,'transfer_installment',$3::jsonb,$4::jsonb)",[b.saveId,day,JSON.stringify(payload),JSON.stringify({ok:true})]);}
      await sql.query("UPDATE career_saves SET cash_balance=cash_balance-$1,transfer_budget=GREATEST(0,transfer_budget-$1) WHERE id=$2",[upfront,b.saveId]);
      await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,'transfer_out',$3,$4,$5)",[b.saveId,day,(terms.loan?"Huurvergoeding ":"Transfertermijn ")+offer.full_name,-upfront,Number(s.cash_balance)-upfront]);
      await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'transfer',$3,$4)",[b.saveId,day,terms.loan?"Huurdeal afgerond: "+offer.full_name:"Transfer afgerond: "+offer.full_name,offer.full_name+(terms.loan?" komt voor zes maanden op huurbasis naar ":" komt naar ")+s.club_name+" voor €"+Number(offer.fee).toLocaleString("nl-NL")+"."]);
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
