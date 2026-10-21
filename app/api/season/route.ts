import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const firstNames=["Daan","Milan","Sem","Luca","Finn","Noah","Jesse","Ruben","Adam","Youssef","Amir","Lucas","Thomas","Max","Jayden","Niels","Omar","Ibrahim","Matteo","Julian","Elias","Mats","Sven","Alex","Ryan","Oscar","Victor","Daniel","Benjamin","Kai"];
const lastNames=["de Vries","Jansen","Bakker","Visser","Smit","Meijer","de Jong","Mulder","Bos","Vos","Peters","Hendriks","Dekker","van Dijk","Willems","Kok","Vermeer","van den Berg","Fischer","Schmidt","Dubois","Martin","Rossi","Garcia","Silva","Petrov","Novak","Kovac","Andersson","Eriksen"];
const positions=["GK","CB","CB","LB","RB","DM","CM","CM","AM","LW","RW","ST","ST","CM","CB","LB","RB","DM","LW","RW","ST","GK"];
const slug=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function schedule(teams:any[],divisionId:string,season:string){
 const list=[...teams].sort((a,b)=>String(a.id).localeCompare(String(b.id)));if(list.length<2)return[];if(list.length%2)list.push({id:"BYE"});
 const n=list.length,rounds=n-1;let rotation=[...list],first:any[]=[];const homeCount=new Map<string,number>();
 for(let r=0;r<rounds;r++){
  for(let i=0;i<n/2;i++){
   let a=rotation[i],b=rotation[n-1-i];if(a.id==="BYE"||b.id==="BYE")continue;
   const ah=homeCount.get(a.id)||0,bh=homeCount.get(b.id)||0;let home=a,away=b;
   if(ah>bh||(ah===bh&&(r+i)%2===0)){home=b;away=a;}
   first.push({round:r+1,home:home.id,away:away.id});homeCount.set(home.id,(homeCount.get(home.id)||0)+1);
  }
  rotation=[rotation[0],rotation[n-1],...rotation.slice(1,n-1)];
 }
 const fixtures:any[]=[],base=new Date(Number(season.slice(0,4)),7,8,12);
 for(const m of first){const d=new Date(base);d.setDate(d.getDate()+(m.round-1)*7);fixtures.push({id:divisionId+"-"+season+"-"+m.round+"-"+m.home+"-"+m.away,season,divisionId,round:m.round,date:d.toISOString().slice(0,10),home:m.home,away:m.away});}
 for(const m of first){const round=m.round+rounds,d=new Date(base);d.setDate(d.getDate()+(round-1)*7);fixtures.push({id:divisionId+"-"+season+"-"+round+"-"+m.away+"-"+m.home,season,divisionId,round,date:d.toISOString().slice(0,10),home:m.away,away:m.home});}
 return fixtures;
}
export async function POST(request:Request){
 const conn=process.env.DATABASE_URL;if(!conn)return NextResponse.json({error:"DATABASE_URL ontbreekt."},{status:503});
 try{
  const body=await request.json(),sql=neon(conn),season=String(body.season||"2027-2028");
  if(!/^20\d\d-20\d\d$/.test(season)||Number(season.slice(5))!==Number(season.slice(0,4))+1)return NextResponse.json({error:"Seizoen moet bijvoorbeeld 2027-2028 zijn."},{status:400});
  const existing=await sql.query("SELECT season_id FROM season_generation_log WHERE season_id=$1",[season]);
  if(existing.length)return NextResponse.json({ok:true,alreadyGenerated:true,season});
  const start=season.slice(0,4)+"-07-01",end=String(Number(season.slice(5)))+"-06-30";
  await sql.query("INSERT INTO seasons(id,label,starts_on,ends_on) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",[season,season.slice(0,4)+"/"+season.slice(5),start,end]);
  const divisions=await sql.query("SELECT id,name,tier,country_code FROM divisions WHERE season_id=$1 ORDER BY country_code,tier",[body.fromSeason||"2026-2027"]);
  if(!divisions.length)return NextResponse.json({error:"Geen nationale divisies gevonden om het volgende seizoen op te bouwen."},{status:400});
  let fixtureCount=0,clubCount=0,playersAdded=0;
  const rosterTeams=await sql.query("SELECT t.id,t.name,t.division_id,t.team_strength,t.reputation FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id=$1 ORDER BY t.id",[body.fromSeason||"2026-2027"]);
  clubCount=rosterTeams.length;
  for(const team of rosterTeams as any[]){
   const count=await sql.query("SELECT COUNT(*)::int AS n FROM players WHERE team_id=$1 AND is_active=TRUE",[team.id]);
   let missing=Math.max(0,23-Number(count[0]?.n||0));
   for(let i=0;i<missing;i++){
    const idx=(Number(String(team.id).split("").reduce((a:number,c:string)=>a+c.charCodeAt(0),0))+i*17)%firstNames.length;
    const pos=positions[(i+Number(team.team_strength||60))%positions.length];
    const age=18+((i*3+idx)%17),year=Number(season.slice(0,4))-age,month=1+((idx+i)%12),day=1+((idx*3+i)%27);
    const playerId="regen-"+slug(team.id)+"-"+season+"-"+String(i+1).padStart(2,"0");
    const overall=Math.max(38,Math.min(80,Number(team.team_strength||60)-12+((i*7+idx)%21)));
    await sql.query("INSERT INTO players(id,team_id,full_name,known_as,date_of_birth,nationality,position,shirt_number,preferred_foot,overall_rating,potential_rating,source_url,source_checked_at,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL,CURRENT_DATE,TRUE) ON CONFLICT(id) DO NOTHING",[playerId,team.id,firstNames[idx]+" "+lastNames[(idx*3+i)%lastNames.length],firstNames[idx],String(year)+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0"),"Fictief",pos, i+1, i%2?"Links":"Rechts",overall,Math.min(90,overall+((i*5)%16))]);
    playersAdded++;
   }
  }
  for(const div of divisions as any[]){
   const teams=rosterTeams.filter((t:any)=>t.division_id===div.id);
   const check=await sql.query("SELECT COUNT(*)::int AS n FROM fixtures WHERE season_id=$1 AND division_id=$2",[season,div.id]);
   if(Number(check[0]?.n||0)>0)continue;
   const fixtures=schedule(teams,div.id,season);
   for(let i=0;i<fixtures.length;i+=40){const batch=fixtures.slice(i,i+40),values:any[]=[];const tuples=batch.map((f:any,j:number)=>{const k=j*7;values.push(f.id,f.season,f.divisionId,f.round,f.date,f.home,f.away);return "($"+(k+1)+",$"+(k+2)+",$"+(k+3)+",$"+(k+4)+",$"+(k+5)+",$"+(k+6)+",$"+(k+7)+")"});await sql.query("INSERT INTO fixtures(id,season_id,division_id,matchday,kickoff_date,home_team_id,away_team_id) VALUES "+tuples.join(",")+" ON CONFLICT(id) DO NOTHING",values);fixtureCount+=batch.length;}
  }
  const events=[
   [season+"-season-start",start,"season_start","Start seizoen "+season.slice(0,4)+"/"+season.slice(5),"Automatische seizoensopbouw en selectiecontrole."],
   [season+"-summer-window",start,"transfer_window","Zomertransferwindow opent",""],
   [season+"-domestic-start",season.slice(0,4)+"-08-07","domestic_round","Start nationale competities",""],
   [season+"-winter-window",season.slice(0,4)+"-01-01","transfer_window","Wintertransferwindow opent",""],
   [season+"-season-end",end,"season_end","Einde seizoen "+season.slice(0,4)+"/"+season.slice(5),"Eindstanden en Europese plaatsen vaststellen."]
  ];
  for(const e of events)await sql.query("INSERT INTO season_calendar(id,season_id,event_date,event_type,title,description) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING",[e[0],season,e[1],e[2],e[3],e[4]]);
  await sql.query("INSERT INTO season_generation_log(season_id,generated_by,clubs_count,fixtures_count,players_added,notes) VALUES($1,'manual-or-summer-trigger',$2,$3,$4,$5)",[season,clubCount,fixtureCount,playersAdded,"National schedules and minimum squad depth generated. Promotion/relegation and UEFA qualification are separate stages."]);
  return NextResponse.json({ok:true,season,clubCount,fixtureCount,playersAdded,promotionRelegation:"pending-integration",uefaQualification:"pending-integration"});
 }catch(e){console.error("season generation",e);return NextResponse.json({error:"Nieuw seizoen kon niet volledig worden opgebouwd."},{status:500});}
}
