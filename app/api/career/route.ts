import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SEASON = "2026-2027";
const START = "2026-08-01";
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
    const clubs=await sql.query("SELECT t.id,t.name,t.city,t.reputation,t.team_strength,d.name AS division,d.tier FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id=$1 AND t.id NOT LIKE 'jong-%' ORDER BY d.tier,t.name",[SEASON]);
    if(!saveId)return NextResponse.json({season:SEASON,clubs});
    const got=await sql.query("SELECT s.*,m.full_name AS manager_name,t.name AS club_name,t.city,t.reputation,t.team_strength,d.name AS division,d.id AS division_id FROM career_saves s JOIN managers m ON m.id=s.manager_id JOIN teams t ON t.id=s.club_id JOIN divisions d ON d.id=t.division_id WHERE s.id=$1 LIMIT 1",[saveId]);
    if(!got.length)return fail("Carrière niet gevonden.",404);
    const save:any=got[0];
    const standings=await sql.query("SELECT t.id,t.name,COUNT(f.id) FILTER(WHERE f.status='played')::int AS played,COALESCE(SUM(CASE WHEN f.status='played' AND ((f.home_team_id=t.id AND f.home_goals>f.away_goals) OR (f.away_team_id=t.id AND f.away_goals>f.home_goals)) THEN 3 WHEN f.status='played' AND f.home_goals=f.away_goals THEN 1 ELSE 0 END),0)::int AS points,COALESCE(SUM(CASE WHEN f.home_team_id=t.id AND f.status='played' THEN f.home_goals WHEN f.away_team_id=t.id AND f.status='played' THEN f.away_goals ELSE 0 END),0)::int AS gf,COALESCE(SUM(CASE WHEN f.home_team_id=t.id AND f.status='played' THEN f.away_goals WHEN f.away_team_id=t.id AND f.status='played' THEN f.home_goals ELSE 0 END),0)::int AS ga FROM teams t LEFT JOIN fixtures f ON(f.home_team_id=t.id OR f.away_team_id=t.id) AND f.season_id=$1 WHERE t.division_id=$2 GROUP BY t.id,t.name ORDER BY points DESC,(gf-ga) DESC,gf DESC,t.name",[SEASON,save.division_id]);
    const fixtures=await sql.query("SELECT f.id,f.matchday,f.kickoff_date,f.home_goals,f.away_goals,f.status,h.name AS home_team,a.name AS away_team,(f.home_team_id=$1 OR f.away_team_id=$1) AS user_match FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id WHERE f.division_id=$2 AND f.kickoff_date >= $3 ORDER BY f.kickoff_date,f.matchday LIMIT 12",[save.club_id,save.division_id,dateOnly(save.game_date)]);
    const news=await sql.query("SELECT id,news_date,category,headline,body,is_read FROM career_news WHERE save_id=$1 ORDER BY id DESC LIMIT 25",[saveId]);
    const finances=await sql.query("SELECT entry_date,category,description,amount,balance_after FROM club_finances WHERE save_id=$1 ORDER BY id DESC LIMIT 20",[saveId]);
    const squad=await sql.query("SELECT p.id,p.full_name,p.position,p.overall_rating,p.potential_rating,COALESCE(pc.fitness,100)::int AS fitness,COALESCE(pc.morale,60)::int AS morale,COALESCE(pc.sharpness,50)::int AS sharpness,pc.injury_type,pc.injury_until FROM players p LEFT JOIN player_conditions pc ON pc.player_id=p.id WHERE p.team_id=$1 AND p.is_active=TRUE ORDER BY p.overall_rating DESC,p.full_name LIMIT 40",[save.club_id]);
    const windowRows=await sql.query("SELECT id,window_name,opens_on,closes_on FROM transfer_windows WHERE season_id=$1 AND opens_on <= $2 AND closes_on >= $2 ORDER BY opens_on LIMIT 1",[SEASON,dateOnly(save.game_date)]);
    const market=await sql.query("SELECT p.id,p.full_name,p.position,p.overall_rating,p.potential_rating,p.date_of_birth,t.id AS club_id,t.name AS club_name,t.reputation AS club_reputation, GREATEST(50000,p.overall_rating*p.overall_rating*450) AS asking_price FROM players p JOIN teams t ON t.id=p.team_id WHERE p.is_active=TRUE AND t.id<>$1 AND p.overall_rating>=58 AND t.id NOT LIKE 'jong-%' ORDER BY p.potential_rating DESC,p.overall_rating DESC LIMIT 60",[save.club_id]);
    const offers=await sql.query("SELECT o.id,o.fee,o.wage_offer,o.status,o.submitted_on,o.expires_on,p.full_name,t.name AS buying_club FROM transfer_offers o JOIN players p ON p.id=o.player_id JOIN teams t ON t.id=o.buying_club_id WHERE o.save_id=$1 ORDER BY o.id DESC LIMIT 20",[saveId]);
    return NextResponse.json({season:SEASON,save,standings,fixtures,news,finances,squad,transferWindow:windowRows[0]||null,market,offers},{headers:{"Cache-Control":"no-store"}});
  }catch(e){console.error("career GET",e);return fail("Carrière kon niet worden geladen.",500);}
}
export async function POST(request: Request) {
 const conn=process.env.DATABASE_URL;if(!conn)return fail("DATABASE_URL ontbreekt.",503);
 try{
  const b=await request.json(),sql=neon(conn);
  if(b.action==="create"){
   if(!b.clubId)return fail("Kies een club.");
   const clubs=await sql.query("SELECT t.id,t.name,t.reputation,t.team_strength,t.division_id FROM teams t JOIN divisions d ON d.id=t.division_id WHERE t.id=$1 AND d.season_id=$2 LIMIT 1",[b.clubId,SEASON]);
   if(!clubs.length)return fail("Club niet gevonden.",404);
   const c:any=clubs[0], managerId="mgr-"+crypto.randomUUID(),saveId="save-"+crypto.randomUUID(),name=String(b.managerName||"Nieuwe manager").trim().slice(0,80)||"Nieuwe manager";
   const budget=Math.max(100000,Math.round(Number(c.team_strength)*Number(c.reputation)*17000)), wages=Math.max(50000,Math.round(Number(c.team_strength)*1800)), balance=budget*4;
   await sql.query("INSERT INTO managers(id,full_name) VALUES($1,$2)",[managerId,name]);
   await sql.query("INSERT INTO career_saves(id,manager_id,club_id,role,game_date,season_id,cash_balance,transfer_budget,wage_budget_weekly) VALUES($1,$2,$3,'manager',$4,$5,$6,$7,$8)",[saveId,managerId,c.id,START,SEASON,balance,budget,wages]);
   await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'club',$3,$4)",[saveId,START,"Welkom bij "+c.name,"Het bestuur heeft je aangesteld als manager. Je bent verantwoordelijk voor resultaten, financiën en de selectie."]);
   await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,'other','Beginsaldo clubkas',$3,$3)",[saveId,START,balance]);
   await sql.query("INSERT INTO player_conditions(player_id) SELECT id FROM players WHERE team_id=$1 AND is_active=TRUE ON CONFLICT(player_id) DO NOTHING",[c.id]);
   return NextResponse.json({saveId,clubId:c.id,club:c.name});
  }
  if(!b.saveId)return fail("saveId ontbreekt.");
  const rows=await sql.query("SELECT s.*,t.name AS club_name,t.division_id FROM career_saves s JOIN teams t ON t.id=s.club_id WHERE s.id=$1 LIMIT 1",[b.saveId]);
  if(!rows.length)return fail("Carrière niet gevonden.",404);const s:any=rows[0];
  if(b.action==="tactics"){await sql.query("UPDATE career_saves SET tactical_setup=$1::jsonb,updated_at=NOW() WHERE id=$2",[JSON.stringify(b.tactics||{}),b.saveId]);return NextResponse.json({ok:true});}
  if(b.action==="offer_transfer"){
   const playerId=String(b.playerId||""),fee=Math.max(0,Math.round(Number(b.fee)||0)),wage=Math.max(0,Math.round(Number(b.wage)||0));
   const win=await sql.query("SELECT id FROM transfer_windows WHERE season_id=$1 AND opens_on <= $2 AND closes_on >= $2 LIMIT 1",[SEASON,dateOnly(s.game_date)]);
   if(!win.length)return fail("De transfermarkt is gesloten. Je kunt alleen binnen een transferwindow onderhandelen.");
   const player=await sql.query("SELECT p.id,p.team_id,p.full_name,p.overall_rating,t.name AS club_name FROM players p JOIN teams t ON t.id=p.team_id WHERE p.id=$1 AND p.is_active=TRUE AND p.team_id<>$2 LIMIT 1",[playerId,s.club_id]);
   if(!player.length)return fail("Deze speler is niet beschikbaar voor een bod.",404);
   if(fee>Number(s.transfer_budget))return fail("Dit bod ligt boven het beschikbare transferbudget.");
   const p:any=player[0],offerId="offer-"+crypto.randomUUID(),expires=new Date(String(s.game_date)+"T12:00:00Z");expires.setUTCDate(expires.getUTCDate()+7);
   await sql.query("INSERT INTO transfer_offers(id,save_id,player_id,buying_club_id,selling_club_id,fee,wage_offer,status,submitted_on,expires_on,notes) VALUES($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10)",[offerId,b.saveId,p.id,s.club_id,p.team_id,fee,wage,dateOnly(s.game_date),dateOnly(expires),"Bod uitgebracht op "+p.full_name]);
   await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'transfer',$3,$4)",[b.saveId,dateOnly(s.game_date),"Transferbod uitgebracht","Een bod van €"+fee.toLocaleString("nl-NL")+" is uitgebracht op "+p.full_name+" ("+p.club_name+"). De club reageert na onderhandelingen."]);
   return NextResponse.json({ok:true,offerId});
  }
  if(b.action==="change_role"){
   if(!["manager","sporting_director","chairperson"].includes(b.role))return fail("Ongeldige rol.");
   await sql.query("UPDATE career_saves SET role=$1,updated_at=NOW() WHERE id=$2",[b.role,b.saveId]);return NextResponse.json({ok:true,role:b.role});
  }
  if(b.action==="advance_day"){
   const dayDate=new Date(dateOnly(s.game_date)+"T12:00:00Z");dayDate.setUTCDate(dayDate.getUTCDate()+1);const day=dateOnly(dayDate);
   await sql.query("UPDATE career_saves SET game_date=$1,updated_at=NOW() WHERE id=$2",[day,b.saveId]);
   const scheduled=await sql.query("SELECT f.*,h.team_strength AS hs,h.reputation AS hr,a.team_strength AS aws,a.reputation AS ar FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id WHERE f.kickoff_date=$1 AND f.status='scheduled' AND f.division_id=$2",[day,s.division_id]);
   const results=[];
   for(const f of scheduled as any[]){
    const ht=f.home_team_id===s.club_id?(s.tactical_setup||{}):{},at=f.away_team_id===s.club_id?(s.tactical_setup||{}):{};
    const score=matchScore(Number(f.hs)+Number(f.hr)*.08,Number(f.aws)+Number(f.ar)*.08,ht,at);
    await sql.query("UPDATE fixtures SET home_goals=$1,away_goals=$2,status='played',played_at=NOW() WHERE id=$3",[score.homeGoals,score.awayGoals,f.id]);
    results.push({id:f.id,...score});
    if(f.home_team_id===s.club_id||f.away_team_id===s.club_id){
      const gf=f.home_team_id===s.club_id?score.homeGoals:score.awayGoals,ga=f.home_team_id===s.club_id?score.awayGoals:score.homeGoals;
      const opponentId=f.home_team_id===s.club_id?f.away_team_id:f.home_team_id,op=(await sql.query("SELECT name FROM teams WHERE id=$1",[opponentId]))[0] as any;
      const title=gf>ga?"Overwinning voor "+s.club_name:gf<ga?"Nederlaag voor "+s.club_name:"Gelijkspel voor "+s.club_name;
      await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'match',$3,$4)",[b.saveId,day,title,s.club_name+" "+gf+"-"+ga+" "+op.name]);
      const conf=Math.max(0,Math.min(100,Number(s.board_confidence)+(gf>ga?2:gf<ga?-3:0))),morale=Math.max(0,Math.min(100,Number(s.club_morale)+(gf>ga?3:gf<ga?-4:0)));
      await sql.query("UPDATE career_saves SET board_confidence=$1,club_morale=$2 WHERE id=$3",[conf,morale,b.saveId]);
    }
   }
   const dailyCost=Math.round(Number(s.wage_budget_weekly||0)/7+Math.max(250,Number(s.cash_balance)*.00004)),balance=Number(s.cash_balance)-dailyCost;
   await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,'wages','Dagelijkse lonen en exploitatie',$3,$4)",[b.saveId,day,-dailyCost,balance]);
   await sql.query("UPDATE career_saves SET cash_balance=$1 WHERE id=$2",[balance,b.saveId]);
   const players=await sql.query("SELECT p.id,COALESCE(pc.fitness,100)::int AS fitness FROM players p LEFT JOIN player_conditions pc ON pc.player_id=p.id WHERE p.team_id=$1 AND p.is_active=TRUE",[s.club_id]);
   for(const p of players as any[]){
    const injury=Math.random()<.0005,fit=Math.max(45,Math.min(100,Number(p.fitness)+(Math.random()<.35?2:1))),kind=injury?(Math.random()<.5?"Hamstringblessure":"Enkelblessure"):null;
    const until=injury?dateOnly(new Date(dayDate.getTime()+(7+Math.floor(Math.random()*35))*86400000)):null;
    await sql.query("INSERT INTO player_conditions(player_id,fitness,injury_type,injury_until) VALUES($1,$2,$3,$4) ON CONFLICT(player_id) DO UPDATE SET fitness=$2,injury_type=CASE WHEN $3::text IS NOT NULL THEN $3 WHEN player_conditions.injury_until < $5::date THEN NULL ELSE player_conditions.injury_type END,injury_until=CASE WHEN $3::text IS NOT NULL THEN $4 WHEN player_conditions.injury_until < $5::date THEN NULL ELSE player_conditions.injury_until END,updated_at=NOW()",[p.id,fit,kind,until,day]);
    if(injury)await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'injury','Blessure tijdens training','Een speler is geblesseerd geraakt; de medische staf beoordeelt de verwachte herstelduur.')",[b.saveId,day]);
   }
   return NextResponse.json({ok:true,gameDate:day,matchesPlayed:results.length,results,cashBalance:balance});
  }
  return fail("Onbekende actie.");
 }catch(e){console.error("career POST",e);return fail("Carrièreactie kon niet worden opgeslagen.",500);}
}
