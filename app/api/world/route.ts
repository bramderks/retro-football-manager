import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const first=["Alex","Mateo","Luca","Noah","Milan","Elias","Adam","Jonas","Ruben","Daan","Finn","Youssef","Theo","Nico","Leo","Samir","Mats","Ibrahim","Victor","Oscar","Julian","Daniel","Kai","Amir","Sven","Tomas"];
const last=["van Dijk","Jansen","de Vries","Bakker","Visser","Smit","Meijer","de Jong","Willems","Peters","Fischer","Silva","Rossi","Garcia","Novak","Kovac","Martin","Schmidt","Andersson","Eriksen"];
const pos=["GK","GK","RB","CB","CB","CB","LB","DM","CM","CM","AM","RW","LW","ST","ST","RWB","LWB","CM","DM","CB","RB","LB","AM"];
const slug=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const seed=(s:string)=>Array.from(s).reduce((a,c)=>a+c.charCodeAt(0),0);
const name=(id:string,i:number)=>first[(seed(id)+i*7)%first.length]+" "+last[(seed(id)*3+i*11)%last.length];
async function fillRoster(sql:any,t:any,season:string){
 const n=await sql.query("SELECT COUNT(*)::int n FROM team_player_memberships tm JOIN players p ON p.id=tm.player_id WHERE tm.team_id=$1 AND tm.season_id=$2 AND tm.membership_type='primary' AND p.is_active=TRUE AND p.career_status='active'",[t.id,season]);let added=0;
 for(let i=0;i<Math.max(0,23-Number(n[0]?.n||0));i++){const s=seed(t.id)+i*19,age=17+s%20,r=Math.max(34,Math.min(82,Number(t.team_strength||55)-13+s%22)),id="generated-"+slug(t.id)+"-"+season+"-"+String(i+1).padStart(2,"0");
 const x=await sql.query("INSERT INTO players(id,team_id,full_name,known_as,date_of_birth,nationality,position,shirt_number,preferred_foot,overall_rating,potential_rating,is_active,career_status,development_bias,source_type,source_club_name) VALUES($1,$2,$3,$4,$5,'Fictief',$6,$7,$8,$9,$10,TRUE,'active',$11,'regen',$12) ON CONFLICT DO NOTHING RETURNING id",[id,t.id,name(t.id,i),name(t.id,i).split(" ")[0],(Number(season.slice(0,4))-age)+"-"+String(1+s%12).padStart(2,"0")+"-"+String(1+s%27).padStart(2,"0"),pos[s%pos.length],i%99+1,s%2?"left":"right",r,Math.min(94,r+5+s%14),s%9-4,t.name]);if(x.length){await sql.query("INSERT INTO team_player_memberships(season_id,team_id,player_id,membership_type) VALUES($1,$2,$3,'primary') ON CONFLICT DO NOTHING",[season,t.id,x[0].id]);}added+=x.length;}
 return added;
}
async function fillEuropean(sql:any,c:any,season:string){
 if(c.domestic_team_id){
  await sql.query("INSERT INTO uefa_club_player_memberships(season_id,club_id,player_id,membership_type) SELECT $1,$2,tm.player_id,'primary' FROM team_player_memberships tm JOIN players p ON p.id=tm.player_id WHERE tm.team_id=$3 AND tm.season_id=$1 AND tm.membership_type='primary' AND p.is_active=TRUE AND p.career_status='active' ON CONFLICT(season_id,club_id,player_id) DO NOTHING",[season,c.id,c.domestic_team_id]);
  return 0;
 }
 const count=await sql.query("SELECT COUNT(*)::int n FROM uefa_club_player_memberships um JOIN players p ON p.id=um.player_id WHERE um.club_id=$1 AND um.season_id=$2 AND um.membership_type='primary' AND p.is_active=TRUE AND p.career_status='active'",[c.id,season]);
 let added=0;
 for(let i=0;i<Math.max(0,23-Number(count[0]?.n||0));i++){
  const s=seed(c.id)+i*19,age=17+s%9,r=Math.max(35,Math.min(84,Number(c.team_strength||c.reputation||55)-10+s%22)),id="regen-europe-"+slug(c.id)+"-"+season+"-"+String(i+1).padStart(2,"0"),fullName=name(c.id,i);
  const player=await sql.query("INSERT INTO players(id,team_id,full_name,known_as,date_of_birth,nationality,position,shirt_number,preferred_foot,overall_rating,potential_rating,is_active,career_status,development_bias,source_type,source_club_name) VALUES($1,NULL,$2,$3,$4,'Fictief',$5,$6,$7,$8,$9,TRUE,'active',$10,'regen',$11) ON CONFLICT DO NOTHING RETURNING id",[id,fullName,fullName.split(" ")[0],(Number(season.slice(0,4))-age)+"-"+String(1+s%12).padStart(2,"0")+"-"+String(1+s%27).padStart(2,"0"),pos[s%pos.length],i%99+1,s%2?"left":"right",r,Math.min(95,r+5+s%12),s%9-4,c.name]);
  if(player.length){await sql.query("INSERT INTO uefa_club_player_memberships(season_id,club_id,player_id,membership_type) VALUES($1,$2,$3,'primary') ON CONFLICT DO NOTHING",[season,c.id,player[0].id]);added+=player.length;}
 }
 return added;
}
function makeFixtures(teams:any[],div:string,season:string){
 let a=[...teams].sort((x,y)=>String(x.id).localeCompare(String(y.id)));if(a.length<2)return[];if(a.length%2)a.push({id:"BYE"});
 const n=a.length,rounds=n-1;let rot=[...a],one:any[]=[];const homeCount=new Map<string,number>();
 for(let r=0;r<rounds;r++){for(let i=0;i<n/2;i++){let x=rot[i],y=rot[n-1-i];if(x.id==="BYE"||y.id==="BYE")continue;const xh=homeCount.get(x.id)||0,yh=homeCount.get(y.id)||0;let h=x,v=y;if(xh>yh||(xh===yh&&(r+i)%2===0)){h=y;v=x;}one.push({r:r+1,h:h.id,a:v.id});homeCount.set(h.id,(homeCount.get(h.id)||0)+1);}rot=[rot[0],rot[n-1],...rot.slice(1,n-1)];}
 const out:any[]=[],base=new Date(Number(season.slice(0,4)),7,8,12);for(const m of one)for(let leg=0;leg<2;leg++){const round=m.r+leg*rounds,d=new Date(base);d.setDate(d.getDate()+(round-1)*7);out.push({id:div+"-"+season+"-"+round+"-"+(leg?m.a:m.h)+"-"+(leg?m.h:m.a),round,date:d.toISOString().slice(0,10),home:leg?m.a:m.h,away:leg?m.h:m.a});}return out;
}
export async function GET(){
 const now=new Date(); if(now.getUTCMonth()===6 && now.getUTCDate()===1){const y=now.getUTCFullYear();return POST(new Request("https://internal/api/world",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fromSeason:(y-1)+"-"+y,season:y+"-"+(y+1)})}));}
 const conn=process.env.DATABASE_URL;if(!conn)return NextResponse.json({error:"DATABASE_URL ontbreekt"},{status:503});
 try{const s=neon(conn);const current=await s.query("SELECT s.id FROM seasons s WHERE EXISTS (SELECT 1 FROM divisions d JOIN teams t ON t.division_id=d.id WHERE d.season_id=s.id) ORDER BY s.starts_on DESC LIMIT 1");const season=String(current[0]?.id||"2026-2027");const a=await s.query("SELECT COUNT(DISTINCT t.id)::int n FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id=$1",[season]);const b=await s.query("SELECT COUNT(*)::int n FROM (SELECT t.id,COUNT(p.id)::int c FROM teams t JOIN divisions d ON d.id=t.division_id AND d.season_id=$1 LEFT JOIN team_player_memberships tm ON tm.team_id=t.id AND tm.season_id=d.season_id AND tm.membership_type='primary' LEFT JOIN players p ON p.id=tm.player_id AND p.is_active AND p.career_status='active' GROUP BY t.id HAVING COUNT(p.id)<23) x",[season]);const c=await s.query("SELECT COUNT(*)::int n FROM (SELECT u.id FROM uefa_clubs u LEFT JOIN uefa_club_player_memberships um ON um.club_id=u.id AND um.season_id=$1 AND um.membership_type='primary' LEFT JOIN players p ON p.id=um.player_id AND p.is_active AND p.career_status='active' GROUP BY u.id HAVING COUNT(p.id)<23) x",[season]);const unlinked=await s.query("SELECT COUNT(*)::int n FROM uefa_clubs WHERE domestic_team_id IS NULL");const d=await s.query("SELECT COUNT(*)::int n FROM world_financial_profiles WHERE season_id=$1",[season]);const e=await s.query("SELECT id,label,starts_on,ends_on FROM seasons ORDER BY starts_on DESC LIMIT 8");return NextResponse.json({season,domesticTeams:a[0]?.n,domesticTeamsBelow23:b[0]?.n,europeanClubsBelow23:c[0]?.n,unlinkedEuropeanClubs:unlinked[0]?.n,financialProfiles:d[0]?.n,seasons:e},{headers:{"Cache-Control":"no-store"}})}catch(e){return NextResponse.json({error:"Wereldstatus niet beschikbaar",detail:String(e)},{status:500})}
}
export async function POST(req:Request){
 const conn=process.env.DATABASE_URL;if(!conn)return NextResponse.json({error:"DATABASE_URL ontbreekt"},{status:503});
 try{
 const sql=neon(conn),body=await req.json().catch(()=>({})),from=String(body.fromSeason||"2026-2027"),season=String(body.season||"2027-2028"),saveId=String(body.saveId||"");
 if(!/^20\d\d-20\d\d$/.test(from)||!/^20\d\d-20\d\d$/.test(season)||Number(season.slice(0,4))!==Number(from.slice(0,4))+1)return NextResponse.json({error:"Geef opeenvolgende seizoenen op."},{status:400});
 const prev=await sql.query("SELECT status FROM world_season_runs WHERE season_id=$1",[season]);if(prev.some((x:any)=>x.status==="completed"))return NextResponse.json({ok:true,alreadyGenerated:true,season});
 const start=season.slice(0,4)+"-07-01",end=season.slice(5)+"-06-30";
 await sql.query("INSERT INTO seasons(id,label,starts_on,ends_on) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",[season,season.slice(0,4)+"/"+season.slice(5),start,end]);
 await sql.query("INSERT INTO world_season_runs(season_id,previous_season_id,status) VALUES($1,$2,'started') ON CONFLICT(season_id) DO UPDATE SET status='started'",[season,from]);
 const divs=await sql.query("SELECT id,name,tier,country_code FROM divisions WHERE season_id=$1 ORDER BY country_code,tier",[from]);if(!divs.length)return NextResponse.json({error:"Geen divisies voor voorgaand seizoen."},{status:409});
 for(const d of divs)await sql.query("INSERT INTO divisions(id,season_id,name,tier,country_code) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",[d.country_code+"-"+d.tier+"-"+season,season,d.name,d.tier,d.country_code]);
 const old=await sql.query("SELECT t.id,t.name,t.city,t.division_id,t.reputation,t.team_strength,t.stadium_name,t.stadium_capacity,t.ticket_price,t.annual_revenue,t.annual_wage_bill,t.season_budget,t.debt,d.tier,d.country_code FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id=$1",[from]);
 // Freeze world results for fixtures not already covered by the selected career save.
if(saveId){
 const careerScores=await sql.query("SELECT cr.fixture_id,cr.home_goals,cr.away_goals FROM career_fixture_results cr JOIN fixtures f ON f.id=cr.fixture_id WHERE cr.save_id=$1 AND f.season_id=$2",[saveId,from]);
 for(const result of careerScores)await sql.query("INSERT INTO world_fixture_results(fixture_id,season_id,home_goals,away_goals) VALUES($1,$2,$3,$4) ON CONFLICT(fixture_id) DO UPDATE SET season_id=EXCLUDED.season_id,home_goals=EXCLUDED.home_goals,away_goals=EXCLUDED.away_goals,simulated_at=now()",[result.fixture_id,from,result.home_goals,result.away_goals]);
}
const unfinished=await sql.query("SELECT f.id,f.home_goals,f.away_goals,COALESCE(h.team_strength,55)::int AS hs,COALESCE(a.team_strength,55)::int AS aw FROM fixtures f JOIN teams h ON h.id=f.home_team_id JOIN teams a ON a.id=f.away_team_id WHERE f.season_id=$1 AND NOT EXISTS(SELECT 1 FROM world_fixture_results wr WHERE wr.fixture_id=f.id)",[from]);
for(const fixture of unfinished){
 let hg=fixture.home_goals,ag=fixture.away_goals;
 if(hg===null||ag===null){
  const homeExpected=1.25+(Number(fixture.hs)-Number(fixture.aw))*0.025+0.18;
  const awayExpected=1.1+(Number(fixture.aw)-Number(fixture.hs))*0.025;
  if(hg===null)hg=Math.max(0,Math.min(6,Math.round(homeExpected+(Math.random()-0.5)*2.8)));
  if(ag===null)ag=Math.max(0,Math.min(6,Math.round(awayExpected+(Math.random()-0.5)*2.8)));
 }
 await sql.query("INSERT INTO world_fixture_results(fixture_id,season_id,home_goals,away_goals) VALUES($1,$2,$3,$4) ON CONFLICT(fixture_id) DO NOTHING",[fixture.id,from,hg,ag]);
}
let promoted=0,relegated=0;
 for(const d of divs){
  const ts=old.filter((t:any)=>t.division_id===d.id);const standing=await sql.query("SELECT t.id,COALESCE(SUM(CASE WHEN COALESCE(cr.home_goals,wr.home_goals,f.home_goals) IS NULL OR COALESCE(cr.away_goals,wr.away_goals,f.away_goals) IS NULL THEN 0 WHEN f.home_team_id=t.id AND COALESCE(cr.home_goals,wr.home_goals,f.home_goals)>COALESCE(cr.away_goals,wr.away_goals,f.away_goals) THEN 3 WHEN f.away_team_id=t.id AND COALESCE(cr.away_goals,wr.away_goals,f.away_goals)>COALESCE(cr.home_goals,wr.home_goals,f.home_goals) THEN 3 WHEN COALESCE(cr.home_goals,wr.home_goals,f.home_goals)=COALESCE(cr.away_goals,wr.away_goals,f.away_goals) THEN 1 ELSE 0 END),0)::int points,COALESCE(SUM(CASE WHEN f.home_team_id=t.id THEN COALESCE(cr.home_goals,wr.home_goals,f.home_goals) ELSE COALESCE(cr.away_goals,wr.away_goals,f.away_goals) END),0)::int gf,COALESCE(SUM(CASE WHEN f.home_team_id=t.id THEN COALESCE(cr.away_goals,wr.away_goals,f.away_goals) ELSE COALESCE(cr.home_goals,wr.home_goals,f.home_goals) END),0)::int ga FROM teams t LEFT JOIN fixtures f ON (f.home_team_id=t.id OR f.away_team_id=t.id) AND f.season_id=$1 AND f.division_id=$2 LEFT JOIN world_fixture_results wr ON wr.fixture_id=f.id LEFT JOIN career_fixture_results cr ON cr.fixture_id=f.id AND cr.save_id=$3 GROUP BY t.id ORDER BY points DESC,(gf-ga) DESC,gf DESC,t.id",[from,d.id,saveId]);
  const higher=divs.find((x:any)=>x.country_code===d.country_code&&Number(x.tier)===Number(d.tier)-1),lower=divs.find((x:any)=>x.country_code===d.country_code&&Number(x.tier)===Number(d.tier)+1);
  for(let i=0;i<standing.length;i++){
   const row=standing[i],t=ts.find((x:any)=>x.id===row.id);if(!t)continue;
   let nextTier=Number(d.tier),up=false,down=false;
   if(higher&&i<2){nextTier--;up=true;promoted++;}else if(lower&&i>=Math.max(0,standing.length-2)){nextTier++;down=true;relegated++;}
   const target=divs.find((x:any)=>x.country_code===d.country_code&&Number(x.tier)===nextTier)||d;
   await sql.query("INSERT INTO team_season_history(id,team_id,season_id,division_id,final_position,promoted,relegated,points) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(team_id,season_id) DO UPDATE SET final_position=EXCLUDED.final_position,promoted=EXCLUDED.promoted,relegated=EXCLUDED.relegated,points=EXCLUDED.points",[from+"-"+t.id,t.id,from,d.id,i+1,up,down,Number(row.points||0)]);
   const topQuarter=i<Math.max(1,Math.ceil(standing.length*0.25)),bottomQuarter=i>=Math.floor(standing.length*0.75);
   let reputationPoints=i===0?5:i===1?3:i===2?2:topQuarter?1:bottomQuarter?-1:0;
   if(up)reputationPoints+=2;if(down)reputationPoints-=3;
   reputationPoints=Math.max(-5,Math.min(7,reputationPoints));
   const oldReputation=Number(t.reputation||45),newReputation=Math.max(1,Math.min(100,oldReputation+reputationPoints));
   await sql.query("UPDATE teams SET division_id=$2,reputation=$3 WHERE id=$1",[t.id,target.country_code+"-"+target.tier+"-"+season,newReputation]);
   await sql.query("INSERT INTO team_reputation_events(team_id,season_id,source,points,description) VALUES($1,$2,'league_final',$3,$4) ON CONFLICT(team_id,season_id,source) DO NOTHING",[t.id,from,reputationPoints,"League finish "+(i+1)+"/"+standing.length+"; promoted="+up+"; relegated="+down]);
   const marketFactor=({ENG:1.8,ESP:1.3,GER:1.35,ITA:1.2,FRA:1.05,NED:0.85} as Record<string,number>)[String(d.country_code)]||0.45;
   const prizeShare=i===0?0.16:i===1?0.11:i===2?0.08:topQuarter?0.045:0.018;
   const prizeMoney=Math.round(80000000*marketFactor*prizeShare/Math.pow(Number(d.tier)||1,1.55));
   await sql.query("UPDATE world_financial_profiles SET cash_balance=cash_balance+$1,transfer_budget=transfer_budget+ROUND($1*0.25)::bigint,annual_revenue=annual_revenue+$1,updated_at=now() WHERE team_id=$2",[prizeMoney,t.id]);
   await sql.query("INSERT INTO world_financial_events(team_id,season_id,event_date,category,description,amount,balance_after) SELECT $1,$2,$3,'prize_money',$4,$5,COALESCE((SELECT cash_balance FROM world_financial_profiles WHERE team_id=$1),0) ON CONFLICT DO NOTHING",[t.id,from,end,"League prize money: position "+(i+1),prizeMoney]);
   if(saveId){
    const saved=await sql.query("UPDATE career_saves SET cash_balance=cash_balance+$1,transfer_budget=transfer_budget+ROUND($1*0.25)::bigint,updated_at=NOW() WHERE id=$2 AND club_id=$3 RETURNING cash_balance",[prizeMoney,saveId,t.id]);
    if(saved.length){
     await sql.query("INSERT INTO club_finances(save_id,entry_date,category,description,amount,balance_after) VALUES($1,$2,'prize_money',$3,$4,$5)",[saveId,end,"Competition prize money: league position "+(i+1),prizeMoney,Number(saved[0].cash_balance)]);
     await sql.query("INSERT INTO career_news(save_id,news_date,category,headline,body) VALUES($1,$2,'finance',$3,$4)",[saveId,end,"Competitiepremie ontvangen","De club ontvangt €"+prizeMoney.toLocaleString("nl-NL")+" aan competitiepremies op basis van de eindklassering."]);
    }
   }
  }
 }
 await sql.query("INSERT INTO team_player_memberships(season_id,team_id,player_id,membership_type) SELECT $1,tm.team_id,tm.player_id,tm.membership_type FROM team_player_memberships tm JOIN teams t ON t.id=tm.team_id JOIN divisions d ON d.id=t.division_id WHERE tm.season_id=$2 AND d.season_id=$1 ON CONFLICT(season_id,team_id,player_id) DO NOTHING",[season,from]);
 await sql.query("INSERT INTO uefa_club_player_memberships(season_id,club_id,player_id,membership_type) SELECT $1,um.club_id,um.player_id,um.membership_type FROM uefa_club_player_memberships um JOIN uefa_clubs u ON u.id=um.club_id WHERE um.season_id=$2 AND u.domestic_team_id IS NULL ON CONFLICT(season_id,club_id,player_id) DO NOTHING",[season,from]);
 const teams=await sql.query("SELECT t.id,t.name,t.city,t.reputation,t.team_strength,t.stadium_name,t.stadium_capacity,t.ticket_price,d.tier,d.country_code FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id=$1 ORDER BY t.id",[season]);let added=0;
 for(const t of teams){
  added+=await fillRoster(sql,t,season);
  const rep=Number(t.reputation||45),strength=Number(t.team_strength||45),tier=Number(t.tier||1);
  const market=({ENG:1.8,ESP:1.3,GER:1.35,ITA:1.2,FRA:1.05,NED:0.85} as Record<string,number>)[String(t.country_code)]||0.45;
  const tierFactor=tier===1?1:tier===2?0.42:tier===3?0.23:0.14;
  const stadium=String(t.stadium_name||"Stadion "+t.name);
  const capacity=Math.max(2500,Math.min(100000,Number(t.stadium_capacity||Math.round(4500+rep*rep*15))));
  const stadiumFactor=Math.max(0.65,Math.min(1.6,Math.sqrt(capacity/30000)));
  const revenue=Math.max(250000,Math.round((250000+rep*rep*10500+strength*strength*4800)*tierFactor*market*stadiumFactor));
  const wages=Math.round(revenue*Math.max(0.38,Math.min(0.72,0.36+strength/280)));
  const budget=Math.round(revenue*Math.max(0.06,Math.min(0.18,0.07+rep/900)));
  const price=Math.max(6,Math.min(95,Number((3.5+rep*0.43*Math.sqrt(market)).toFixed(2))));
  const debtRatio=Math.max(0.015,Math.min(0.32,(70-rep)/180+(tier-1)*0.045));
  const debt=Math.round(revenue*debtRatio);
  const cash=Math.round(revenue*Math.max(0.02,Math.min(0.14,0.045+rep/1100))-debt*0.08);
  await sql.query("UPDATE teams SET stadium_name=COALESCE(stadium_name,$2),stadium_capacity=$3,ticket_price=$4,annual_revenue=$5,annual_wage_bill=$6,season_budget=$7,debt=$8,financial_tier=CASE WHEN reputation>=85 THEN 'elite' WHEN reputation>=70 THEN 'upper' WHEN reputation>=50 THEN 'stable' ELSE 'small' END WHERE id=$1",[t.id,stadium,capacity,price,revenue,wages,budget,debt]);
  await sql.query("INSERT INTO stadiums(id,team_id,name,city,capacity,ticket_price,hospitality_price,annual_maintenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(team_id) DO UPDATE SET capacity=EXCLUDED.capacity,ticket_price=EXCLUDED.ticket_price,annual_maintenance=EXCLUDED.annual_maintenance",["stadium-"+slug(t.id),t.id,stadium,t.city,capacity,price,price*4,Math.round(capacity*10)]);
  await sql.query("INSERT INTO world_financial_profiles(team_id,season_id,cash_balance,transfer_budget,annual_revenue,annual_wages,debt,ticket_price) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(team_id) DO UPDATE SET season_id=EXCLUDED.season_id,cash_balance=EXCLUDED.cash_balance,transfer_budget=EXCLUDED.transfer_budget,annual_revenue=EXCLUDED.annual_revenue,annual_wages=EXCLUDED.annual_wages,debt=EXCLUDED.debt,ticket_price=EXCLUDED.ticket_price,updated_at=now()",[t.id,season,cash,budget,revenue,wages,debt,price]);
  await sql.query("INSERT INTO world_financial_events(team_id,season_id,event_date,category,description,amount,balance_after) VALUES($1,$2,$3,'season_budget','Season budget opening estimate',$4,$5) ON CONFLICT DO NOTHING",[t.id,season,start,budget,cash]);
 }
 
 // Every non-human manager and staff member gets a generated birthday if the source data lacks one.
 await sql.query("UPDATE managers SET date_of_birth=(DATE '1950-01-01' + ((ASCII(SUBSTRING(id,1,1))*173 + LENGTH(id)*29) % 15000)::int) WHERE date_of_birth IS NULL AND career_status='active'");
 await sql.query("UPDATE club_staff SET date_of_birth=(DATE '1950-01-01' + ((ASCII(SUBSTRING(id,1,1))*137 + LENGTH(id)*31) % 16000)::int) WHERE date_of_birth IS NULL AND career_status='active'");
 const managerAges=await sql.query("UPDATE managers SET career_status=CASE WHEN EXTRACT(YEAR FROM age($1::date,date_of_birth))>=75 THEN 'retired' ELSE career_status END,retired_on=CASE WHEN EXTRACT(YEAR FROM age($1::date,date_of_birth))>=75 THEN $1::date ELSE retired_on END WHERE career_status='active' AND id NOT IN (SELECT manager_id FROM career_saves WHERE status='active') RETURNING id,full_name,career_status,date_of_birth",[start]);
 const staffAges=await sql.query("UPDATE club_staff SET career_status=CASE WHEN EXTRACT(YEAR FROM age($1::date,date_of_birth))>=72 THEN 'retired' ELSE career_status END,employed_until=CASE WHEN EXTRACT(YEAR FROM age($1::date,date_of_birth))>=72 THEN $1::date ELSE employed_until END WHERE career_status='active' RETURNING id,full_name,role,career_status,date_of_birth",[start]);
 for(const person of [...managerAges,...staffAges].filter((p:any)=>p.career_status==='retired'))await sql.query("INSERT INTO world_person_history(person_type,person_id,season_id,event_type,details) VALUES($1,$2,$3,'retirement',$4::jsonb)",[managerAges.some((m:any)=>m.id===person.id)?"manager":"staff",person.id,season,JSON.stringify({name:person.full_name,role:person.role||"manager"})]);
 // Annual football-world AI: fill every club's leadership and backroom roles without duplicating active contracts.
 const staffRoles=[{role:"manager",rep:1},{role:"assistant_manager",rep:1},{role:"coach",rep:1},{role:"scout",rep:1},{role:"physio",rep:1},{role:"sporting_director",rep:1},{role:"chairperson",rep:1}];
 const staffFirst=["Martin","David","Marco","Thomas","André","Peter","Michael","Jürgen","Luis","Roberto","Erik","Stefan","Patrick","Daniel","Johan","Frank","Rafael","Simon","Nico","Alex"];
 const staffLast=["Meyer","Schneider","Fischer","Weber","Wagner","Becker","Schulz","Hoffmann","Keller","Bauer","Ricci","Moreau","Silva","Costa","Svensson","Jensen","Kowalski","Novak","Müller","Bennett"];
 for(const t of teams as any[]){
  for(const r of staffRoles){
   const active=await sql.query("SELECT id FROM club_staff WHERE club_id=$1 AND role=$2 AND career_status='active' AND (employed_until IS NULL OR employed_until >= $3::date) LIMIT 1",[t.id,r.role,start]);
   if(active.length)continue;
   const rep=Math.max(10,Math.min(100,Number(t.reputation||40)+(r.role==="manager"?5:r.role==="chairperson"?8:0)-Math.floor(seed(t.id+r.role)%18)));
   const wage=Math.max(250,Math.round((Number(t.team_strength||45)*Number(t.team_strength||45))*({manager:7,chairperson:5,sporting_director:5,assistant_manager:3,coach:2,scout:2,physio:2} as any)[r.role]));
   const id="staff-ai-"+slug(t.id)+"-"+r.role+"-"+season;
   const full=staffFirst[seed(t.id+r.role+season)%staffFirst.length]+" "+staffLast[seed(r.role+t.id+season)%staffLast.length];
   await sql.query("INSERT INTO club_staff(id,club_id,full_name,role,reputation,wage_weekly,employed_from,date_of_birth,career_status,career_path) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active','generated-ai') ON CONFLICT(id) DO NOTHING",[id,t.id,full,r.role,rep,wage,start,(Number(season.slice(0,4))-35-seed(id)%20)+"-01-01"]);
  }
 }
 // FIFA-style international breaks and two transfer windows are regenerated with every season.
 const internationalEvents=[
  [season+"-intl-sep",season.slice(0,4)+"-09-07","international_break","Internationale periode — september"],
  [season+"-intl-oct",season.slice(0,4)+"-10-05","international_break","Internationale periode — oktober"],
  [season+"-intl-nov",season.slice(0,4)+"-11-09","international_break","Internationale periode — november"],
  [season+"-intl-mar",String(Number(season.slice(0,4))+1)+"-03-22","international_break","Internationale periode — maart"]
 ];
 for(const e of internationalEvents)await sql.query("INSERT INTO season_calendar(id,season_id,event_date,event_type,title,description) VALUES($1,$2,$3,$4,$5,'Nationale teams kunnen spelers oproepen; competitieprogramma houdt waar mogelijk rekening met deze periode.') ON CONFLICT(id) DO NOTHING",[e[0],season,e[1],e[2],e[3]]);
 for(const country of await sql.query("SELECT DISTINCT country_code FROM divisions WHERE season_id=$1",[season])){
  await sql.query("INSERT INTO transfer_windows(id,season_id,country_code,window_name,opens_on,closes_on) VALUES($1,$2,$3,'Zomerwindow',$4,$5) ON CONFLICT(id) DO NOTHING",[season+"-"+country.country_code+"-summer",season,country.country_code,start,season.slice(0,4)+"-08-31"]);
  await sql.query("INSERT INTO transfer_windows(id,season_id,country_code,window_name,opens_on,closes_on) VALUES($1,$2,$3,'Winterwindow',$4,$5) ON CONFLICT(id) DO NOTHING",[season+"-"+country.country_code+"-winter",season,country.country_code,String(Number(season.slice(0,4))+1)+"-01-01",String(Number(season.slice(0,4))+1)+"-01-31"]);
 }
 // UEFA fixtures are generated by buildUefaSeason from the coefficient-based access list.
 const aged=await sql.query("UPDATE players SET overall_rating=CASE WHEN EXTRACT(YEAR FROM age($1::date,date_of_birth))>=34 THEN GREATEST(20,overall_rating-2) WHEN EXTRACT(YEAR FROM age($1::date,date_of_birth))<=22 THEN LEAST(potential_rating,overall_rating+1) ELSE overall_rating END,career_status=CASE WHEN EXTRACT(YEAR FROM age($1::date,date_of_birth))>=40 THEN 'retired' ELSE career_status END,retired_on=CASE WHEN EXTRACT(YEAR FROM age($1::date,date_of_birth))>=40 THEN $1::date ELSE retired_on END,is_active=CASE WHEN EXTRACT(YEAR FROM age($1::date,date_of_birth))>=40 THEN FALSE ELSE is_active END WHERE source_type='regen' AND career_status='active' AND date_of_birth IS NOT NULL RETURNING id,team_id,full_name,career_status,date_of_birth,overall_rating",[start]);
 let converted=0;for(const p of aged.filter((x:any)=>x.career_status==="retired")){await sql.query("INSERT INTO world_person_history(person_type,person_id,season_id,event_type,details) VALUES('player',$1,$2,'retirement',$3::jsonb)",[p.id,season,JSON.stringify({name:p.full_name})]);if(Number(p.overall_rating)>=68&&seed(p.id)%4===0){const m=await sql.query("INSERT INTO managers(id,full_name,reputation,coaching,tactical_knowledge,man_management,date_of_birth,career_status,career_role) VALUES($1,$2,$3,$4,$5,$6,$7,'active','manager') ON CONFLICT(id) DO NOTHING RETURNING id",["ex-player-manager-"+p.id,p.full_name,Math.max(25,p.overall_rating-8),Math.max(25,p.overall_rating-5),Math.max(25,p.overall_rating-3),Math.max(25,p.overall_rating-7),p.date_of_birth]);converted+=m.length;}}
 const euro=await sql.query("SELECT id,name,country_code,reputation,team_strength,domestic_team_id FROM uefa_clubs");for(const c of euro)added+=await fillEuropean(sql,c,season);
 const { buildUefaSeason } = await import("../../../lib/uefa-season");
 const uefaBuild=await buildUefaSeason(sql,from,season);
 for(const d of divs){const id=d.country_code+"-"+d.tier+"-"+season,ts=await sql.query("SELECT id FROM teams WHERE division_id=$1",[id]),fs=makeFixtures(ts,id,season);for(let i=0;i<fs.length;i+=30){const batch=fs.slice(i,i+30),vals:any[]=[];const tuples=batch.map((f:any,j:number)=>{const k=j*7;vals.push(f.id,season,id,f.round,f.date,f.home,f.away);return "($"+(k+1)+",$"+(k+2)+",$"+(k+3)+",$"+(k+4)+",$"+(k+5)+",$"+(k+6)+",$"+(k+7)+")"});if(batch.length)await sql.query("INSERT INTO fixtures(id,season_id,division_id,matchday,kickoff_date,home_team_id,away_team_id) VALUES "+tuples.join(",")+" ON CONFLICT(id) DO NOTHING",vals);}}
 const events=[[season+"-start",start,"season_start","Start seizoen "+season],[season+"-summer-window",start,"transfer_window","Zomertransferwindow opent"],[season+"-domestic-start",season.slice(0,4)+"-08-08","domestic_round","Start nationale competities"],[season+"-winter-window",season.slice(0,4)+"-01-01","transfer_window","Wintertransferwindow opent"],[season+"-end",end,"season_end","Einde seizoen "+season]];
 for(const e of events)await sql.query("INSERT INTO season_calendar(id,season_id,event_date,event_type,title,description) VALUES($1,$2,$3,$4,$5,'Jaarlijkse wereldsimulatie') ON CONFLICT(id) DO NOTHING",[e[0],season,e[1],e[2],e[3]]);
 await sql.query("UPDATE career_saves SET season_id=$1,game_date=GREATEST(game_date,$2::date) WHERE season_id=$3 AND status='active'",[season,start,from]);
 await sql.query("UPDATE world_season_runs SET status='completed',teams_processed=$2,players_added=$3,people_aged=$4,promoted=$5,relegated=$6,completed_at=now() WHERE season_id=$1",[season,teams.length,added,aged.length,promoted,relegated]);
 return NextResponse.json({ok:true,season,teamsProcessed:teams.length,playersAdded:added,peopleAged:aged.length,playersRetired:aged.filter((x:any)=>x.career_status==="retired").length,convertedToManagers:converted,promotionRelegation:{promoted,relegated},financialProfiles:teams.length,stadiums:teams.length,minimumSquadRule:"23 actieve spelers per nationale en Europese club"});
 }catch(e){console.error("world rollover",e);return NextResponse.json({error:"Seizoensopbouw mislukt",detail:String(e)},{status:500})}
}
