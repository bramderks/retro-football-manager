type Sql = { query: (query: string, params?: any[]) => Promise<any[]> };
const clamp = (n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const seasonYear = (season:string)=>Number(season.slice(0,4));
const seed = (s:string)=>Array.from(s).reduce((a,c)=>a+c.charCodeAt(0),0);
const slug = (s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const MARKET:Record<string,number>={ENG:1.8,ESP:1.3,GER:1.35,ITA:1.2,FRA:1.05,NED:.85,POR:.78,BEL:.65,SCO:.6,TUR:.7,AUT:.52,CZE:.45,GRE:.45};
const COUNTRY_NAMES:Record<string,string>={ENG:"England",ESP:"Spain",GER:"Germany",ITA:"Italy",FRA:"France",NED:"Netherlands",POR:"Portugal",BEL:"Belgium",SCO:"Scotland",TUR:"Türkiye",AUT:"Austria",CZE:"Czechia",GRE:"Greece"};
const compNames:Record<string,string>={UCL:"UEFA Champions League",UEL:"UEFA Europa League",UECL:"UEFA Conference League"};


const HISTORICAL_ASSOCIATION_COEFFICIENTS: [string, number, number[]][] = [["ENG",1,[24.357,21,23,17.375,29.464,28.68]],["ITA",2,[16.285,15.714,22.357,21,21.875,19]],["ESP",3,[19.5,18.428,16.571,16.062,23.892,22.093]],["GER",4,[15.214,16.214,17.125,19.357,18.421,21.785]],["FRA",5,[7.916,18.416,12.583,16.25,17.928,18.321]],["NED",6,[9.2,19.2,13.5,10,15.25,9.979]],["POR",7,[9.6,12.916,12.5,11,16.25,20.5]],["BEL",8,[6,6.6,14.2,14.4,15.65,11.4]],["CZE",9,[6.6,6.7,6.75,13.5,10.55,11.025]],["TUR",10,[3.1,6.7,11.8,12,10.3,11.075]],["NOR",11,[6.5,7.625,5.75,8,11.812,8.05]],["GRE",12,[5.1,8,2.125,11.4,12.687,14.2]],["AUT",13,[6.7,10.4,4.9,4.8,9.65,4.1]],["SCO",14,[8.5,7.9,3.5,6.4,9.25,5]],["POL",15,[4,4.625,7.75,6.875,11.75,15.75]],["DEN",16,[4.125,7.8,5.9,8.5,7.656,12.25]],["SUI",17,[5.125,7.75,8.5,5.2,7.05,6.2]],["ISR",18,[7,6.75,6.25,8.75,2.875,2.875]],["CYP",19,[4,4.125,5.1,3.75,10.562,12.156]],["SWE",20,[2.5,5.125,6.25,1.875,11.375,5]],["CRO",21,[5.9,6,3.375,5.875,5.875,7.031]],["SRB",22,[5.5,9.5,5.375,1.4,3.725,5.75]],["UKR",23,[6.8,4.2,5.7,4.1,3.6,8.312]],["HUN",24,[4.25,2.75,5.875,4.5,6.625,7.437]],["ROU",25,[3.75,2.25,6.25,3.25,7.75,5.75]],["SVK",26,[1.5,4.125,6,5,4.625,2.625]],["SVN",27,[2.25,3,2.125,3.875,9.093,6.375]],["BUL",28,[4,3.375,4.5,4.375,3.625,5.187]],["AZE",29,[2.5,4.375,4,5.875,2.875,5.812]],["RUS",30,[4.333,5.3,4.333,4.333,0,4.333]],["IRL",31,[1.875,2.875,3.375,1.5,5.343,4.25]],["MDA",32,[1.375,5.25,3.75,2,2.125,1.5]],["ISL",33,[0.625,1.5,3,3.833,4.562,3.625]],["BIH",34,[2.625,1.625,2,2.25,4.531,3.312]],["ARM",35,[1.375,1.875,2.375,2.25,4.375,4.187]],["LVA",36,[1.375,2.625,2.75,1.625,3.875,2]],["FIN",38,[1.375,3.75,2.625,1.75,2.25,3.625]],["KAZ",39,[1,2.875,1.125,3.125,3,3.625]],["ALB",46,[2,1.625,0.875,2.125,1.25,2.25]],["AND",53,[0.666,1.5,0.666,1.666,1,2]],["GEO",50,[1.75,1.25,1.125,1.25,1.25,1.125]],["GIB",54,[1.666,1.25,0.875,0.166,1.5,3.333]],["LTU",43,[1.625,1.75,2.375,1.125,1.375,1.125]],["EST",45,[1.375,3.666,1.166,.125,1.625,1.625]],["FRO",40,[2.75,1.5,2.25,2.75,1.5,1.75]],["KOS",37,[1.833,2.333,2.875,3,2,3.781]],["LIE",44,[.5,0,6.5,.5,.5,1]],["LUX",48,[1,1.25,1.125,2.25,1.25,.75]],["MLT",41,[1.5,1.875,2.625,1.5,1,2]],["MNE",47,[1.625,.75,1,1.333,2.5,1]],["NIR",42,[2.833,1.625,1.25,1.125,1.5,1.75]],["SMR",55,[.5,.166,.833,.333,.666,.833]],["WAL",49,[1.5,1.5,1.166,.625,2,.333]],["MKD",51,[1.75,.625,1.625,1.5,.666,3.343]]];
const HISTORICAL_SEASONS = ["2020-2021","2021-2022","2022-2023","2023-2024","2024-2025","2025-2026"];
const HISTORICAL_CLUB_COEFFICIENTS: Record<string,number> = {"real-madrid":131.5,"bayern-munchen":124.25,"inter":121.25,"man-city":117.75,"manchester-city":117.75,"liverpool":115.5,"paris-saint-germain":109.5,"paris":109.5,"borussia-dortmund":98.75,"b-dortmund":98.75,"leverkusen":98.25,"bayer-leverkusen":98.25,"barcelona":96.25,"arsenal":93};
async function ensureHistoricalCoefficients(sql:Sql){
 for(const [country,officialRank,values] of HISTORICAL_ASSOCIATION_COEFFICIENTS){
  for(let i=0;i<HISTORICAL_SEASONS.length;i++){
   const coefficient=values[i];
   await sql.query("INSERT INTO uefa_association_season_coefficients(season_id,country_code,points,participating_clubs,coefficient,ranking) VALUES($1,$2,$3,1,$3,$4) ON CONFLICT(season_id,country_code) DO NOTHING",[HISTORICAL_SEASONS[i],country,coefficient,officialRank]);
  }
  const total=values.slice(0,5).reduce((a,b)=>a+b,0);
  await sql.query("INSERT INTO uefa_association_coefficients(country_code,latest_season_id,five_season_total,coefficient,ranking) VALUES($1,'2024-2025',$2,$2,$3) ON CONFLICT(country_code) DO NOTHING",[country,total.toFixed(3),officialRank]);
 }
 const clubs=await sql.query("SELECT u.id,u.name,u.country_code,COALESCE(a.five_season_total,0) AS association_total FROM uefa_clubs u LEFT JOIN uefa_association_coefficients a ON a.country_code=u.country_code");
 const seeded=clubs.map((c:any)=>({id:String(c.id),value:Math.max(HISTORICAL_CLUB_COEFFICIENTS[slug(String(c.name))]||0,Number(c.association_total||0)*.2)})).sort((a:any,b:any)=>b.value-a.value||a.id.localeCompare(b.id));
 for(let i=0;i<seeded.length;i++){const c=seeded[i];await sql.query("INSERT INTO uefa_club_coefficients(club_id,five_season_total,ten_season_total,coefficient,ranking) VALUES($1,$2,$2,$2,$3) ON CONFLICT(club_id) DO NOTHING",[c.id,c.value.toFixed(3),i+1]);}
}

async function finishPreviousSeason(sql:Sql,from:string){
 const fixtures=await sql.query("SELECT f.id,f.competition_id,f.home_club_id,f.away_club_id,f.home_goals,f.away_goals,f.status,h.country_code AS hc,a.country_code AS ac FROM uefa_fixtures f JOIN uefa_clubs h ON h.id=f.home_club_id JOIN uefa_clubs a ON a.id=f.away_club_id WHERE f.season_id=$1 AND f.stage='league_phase'",[from]);
 const stats=new Map<string,{played:number;points:number;gf:number;ga:number;wins:number;draws:number;losses:number}>();
 const get=(competitionId:string,id:string)=>{const key=competitionId+"|"+id;if(!stats.has(key))stats.set(key,{played:0,points:0,gf:0,ga:0,wins:0,draws:0,losses:0});return stats.get(key)!;};
 const assoc=new Map<string,{points:number;clubs:Set<string>}>();
 const coefficientPoints=new Map<string,number>();
 const addCoefficient=(id:string,points:number)=>coefficientPoints.set(id,(coefficientPoints.get(id)||0)+points);
 const clubs=await sql.query("SELECT id,country_code FROM uefa_clubs");
 const countryById=new Map(clubs.map((c:any)=>[String(c.id),String(c.country_code)]));
 for(const f of fixtures){
  let hg=f.home_goals,ag=f.away_goals;
  if(hg===null||ag===null){
   const home=await sql.query("SELECT team_strength FROM uefa_clubs WHERE id=$1",[f.home_club_id]);
   const away=await sql.query("SELECT team_strength FROM uefa_clubs WHERE id=$1",[f.away_club_id]);
   const diff=(Number(home[0]?.team_strength||55)-Number(away[0]?.team_strength||55))*.025;
   hg=hg===null?clamp(Math.round(1.3+diff+(seed(f.id)%7-3)*.35),0,6):Number(hg);
   ag=ag===null?clamp(Math.round(1.05-diff+(seed(f.id+"a")%7-3)*.35),0,6):Number(ag);
   await sql.query("UPDATE uefa_fixtures SET home_goals=$2,away_goals=$3,status='played' WHERE id=$1 AND status<>'played'",[f.id,hg,ag]);
  }
  if(String(f.status)!=="played"){
   await sql.query("UPDATE uefa_participants SET played=played+1,points=points+$1,wins=wins+$2,draws=draws+$3,losses=losses+$4,goals_for=goals_for+$5,goals_against=goals_against+$6 WHERE competition_id=$7 AND club_id=$8",[hg>ag?3:hg===ag?1:0,hg>ag?1:0,hg===ag?1:0,hg<ag?1:0,hg,ag,f.competition_id,f.home_club_id]);
   await sql.query("UPDATE uefa_participants SET played=played+1,points=points+$1,wins=wins+$2,draws=draws+$3,losses=losses+$4,goals_for=goals_for+$5,goals_against=goals_against+$6 WHERE competition_id=$7 AND club_id=$8",[ag>hg?3:ag===hg?1:0,ag>hg?1:0,ag===hg?1:0,ag<hg?1:0,ag,hg,f.competition_id,f.away_club_id]);
  }
  for(const [id,g,a] of [[String(f.home_club_id),Number(hg),Number(ag)],[String(f.away_club_id),Number(ag),Number(hg)]] as any[]){
   const s=get(String(f.competition_id),id);s.played++;s.gf+=g;s.ga+=a;if(g>a){s.points+=3;s.wins++;addCoefficient(id,2);}else if(g===a){s.points++;s.draws++;addCoefficient(id,1);}else s.losses++;
   const cc=countryById.get(id)||"UNK";if(!assoc.has(cc))assoc.set(cc,{points:0,clubs:new Set()});const ac=assoc.get(cc)!;ac.points+=g>a?2:g===a?1:0;ac.clubs.add(id);
  }
 }
 for(const [key,s] of stats){
  const [competitionId,clubId]=key.split("|");
  await sql.query("INSERT INTO uefa_club_season_coefficients(season_id,club_id,points) VALUES($1,$2,$3) ON CONFLICT(season_id,club_id) DO UPDATE SET points=EXCLUDED.points",[from,clubId,coefficientPoints.get(clubId)||0]);
  await sql.query("UPDATE uefa_participants SET played=$3,points=$4,wins=$5,draws=$6,losses=$7,goals_for=$8,goals_against=$9 WHERE competition_id=$1 AND club_id=$2",[competitionId,clubId,s.played,s.points,s.wins,s.draws,s.losses,s.gf,s.ga]);
 }
 // Generate and resolve the knockout bracket for the completed league phase.
 const bonusByCompetition:Record<string,number>={UCL:1.5,UEL:1,UECL:.5};
 const competitions=await sql.query("SELECT id,code,matches_per_club FROM uefa_competitions WHERE season_id=$1 ORDER BY code",[from]);
 const matchDate=(comp:any,stage:string,matchday:number)=>{
  const y=seasonYear(from),date=(month:number,day:number,next=false)=>new Date(Date.UTC(y+(next?1:0),month-1,day,12)).toISOString().slice(0,10);
  const calendars:Record<string,string[]>={UCL:[date(9,8),date(10,13),date(10,20),date(11,3),date(11,24),date(12,8),date(1,19,true),date(1,27,true)],UEL:[date(9,16),date(10,15),date(10,22),date(11,5),date(11,26),date(12,10),date(1,21,true),date(1,28,true)],UECL:[date(10,15),date(10,22),date(11,5),date(11,26),date(12,10),date(12,17)]};
  if(stage==="league_phase")return calendars[String(comp.code)]?.[matchday-1]||date(9,8);
  const knockout:Record<string,Record<number,string>>={
   UCL:{9:date(2,16,true),10:date(2,23,true),11:date(3,9,true),12:date(3,16,true),13:date(4,6,true),14:date(4,13,true),15:date(4,27,true),16:date(5,4,true),17:date(6,5,true)},
   UEL:{9:date(2,18,true),10:date(2,25,true),11:date(3,11,true),12:date(3,18,true),13:date(4,8,true),14:date(4,15,true),15:date(4,29,true),16:date(5,6,true),17:date(5,26,true)},
   UECL:{9:date(2,18,true),10:date(2,25,true),11:date(3,11,true),12:date(3,18,true),13:date(4,8,true),14:date(4,15,true),15:date(4,29,true),16:date(5,6,true),17:date(6,2,true)}
  };
  return knockout[String(comp.code)]?.[matchday]||date(6,5,true);
 };
 const playMatch=async(comp:any,matchday:number,home:any,away:any,stage:string)=>{
  const id=String(comp.id)+"-"+stage+"-"+matchday+"-"+home.id+"-"+away.id;
  const prior=await sql.query("SELECT home_goals,away_goals,status FROM uefa_fixtures WHERE id=$1 LIMIT 1",[id]);
  let hg:number,ag:number;
  if(prior.length&&prior[0].status==="played"&&prior[0].home_goals!==null&&prior[0].away_goals!==null){hg=Number(prior[0].home_goals);ag=Number(prior[0].away_goals);}
  else{
   const diff=(Number(home.team_strength||55)-Number(away.team_strength||55))*.025;
   hg=clamp(Math.round(1.3+diff+(seed(id)%7-3)*.35),0,6);
   ag=clamp(Math.round(1.05-diff+(seed(id+"a")%7-3)*.35),0,6);
   if(stage==="final"&&hg===ag){if(seed(id+"pen")%2===0)hg++;else ag++;}
   await sql.query("INSERT INTO uefa_fixtures(id,competition_id,season_id,matchday,kickoff_date,home_club_id,away_club_id,stage,home_goals,away_goals,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'played') ON CONFLICT(id) DO UPDATE SET home_goals=EXCLUDED.home_goals,away_goals=EXCLUDED.away_goals,status='played'",[id,comp.id,from,matchday,matchDate(comp,stage,matchday),home.id,away.id,stage,hg,ag]);
  }
  addCoefficient(String(home.id),hg>ag?2:hg===ag?1:0);addCoefficient(String(away.id),ag>hg?2:hg===ag?1:0);
  for(const [clubId,goals,against] of [[String(home.id),hg,ag],[String(away.id),ag,hg]] as any[]){
   const cc=countryById.get(clubId)||"UNK";if(!assoc.has(cc))assoc.set(cc,{points:0,clubs:new Set()});const ac=assoc.get(cc)!;ac.points+=goals>against?2:goals===against?1:0;ac.clubs.add(clubId);
  }
  return {hg,ag};
 };
 const playTie=async(comp:any,round:number,home:any,away:any,stage:string,twoLegs=true)=>{
  const bonus=["round_of_16","quarter_final","semi_final","final"].includes(stage)?(bonusByCompetition[String(comp.code)]||0):0;
  if(bonus>0){addCoefficient(String(home.id),bonus);addCoefficient(String(away.id),bonus);for(const club of [home,away]){const cc=countryById.get(String(club.id))||"UNK";if(!assoc.has(cc))assoc.set(cc,{points:0,clubs:new Set()});const a=assoc.get(cc)!;a.points+=bonus;a.clubs.add(String(club.id));}}
  const first=await playMatch(comp,round*2-1,home,away,stage);
  if(!twoLegs)return first.hg===first.ag?(seed(String(comp.id)+home.id+away.id)%2===0?home:away):(first.hg>first.ag?home:away);
  const second=await playMatch(comp,round*2,away,home,stage);
  const hTotal=first.hg+second.ag,aTotal=first.ag+second.hg;
  return hTotal===aTotal?(Number(home.team_strength||55)+seed(String(home.id))%10>=Number(away.team_strength||55)+seed(String(away.id))%10?home:away):(hTotal>aTotal?home:away);
 };
 for(const comp of competitions){
  const table=await sql.query("SELECT p.club_id AS id,c.name,c.country_code,c.team_strength,p.points,p.goals_for,p.goals_against,COALESCE(cc.five_season_total,0) AS coefficient FROM uefa_participants p JOIN uefa_clubs c ON c.id=p.club_id LEFT JOIN uefa_club_coefficients cc ON cc.club_id=c.id WHERE p.competition_id=$1 ORDER BY p.points DESC,(p.goals_for-p.goals_against) DESC,p.goals_for DESC,coefficient DESC,c.name",[comp.id]);
  if(table.length<16)continue;
  const playoffWinners:any[]=[];
  for(let i=8;i<Math.min(16,table.length);i+=1){
   const home=table[i],away=table[Math.min(23,table.length-1)-(i-8)];
   if(!home||!away||home.id===away.id)continue;
   const winner=await playTie(comp,5,home,away,"knockout_playoff",true);
   if(!playoffWinners.some((x:any)=>x.id===winner.id))playoffWinners.push(winner);
  }
  const round16:any[]=[];
  for(let i=0;i<8;i++){const seedClub=table[i],opponent=playoffWinners[i];if(seedClub&&opponent){round16.push(await playTie(comp,6,seedClub,opponent,"round_of_16",true));}}
  let quarter=round16;
  if(quarter.length>=4){const next:any[]=[];for(let i=0;i+1<quarter.length;i+=2)next.push(await playTie(comp,7,quarter[i],quarter[i+1],"quarter_final",true));quarter=next;}
  let semi=quarter;
  if(semi.length>=2){const next:any[]=[];for(let i=0;i+1<semi.length;i+=2)next.push(await playTie(comp,8,semi[i],semi[i+1],"semi_final",true));semi=next;}
  if(semi.length>=2)await playTie(comp,9,semi[0],semi[1],"final",false);
 }
 for(const [clubId,points] of coefficientPoints){
  await sql.query("INSERT INTO uefa_club_season_coefficients(season_id,club_id,points) VALUES($1,$2,$3) ON CONFLICT(season_id,club_id) DO UPDATE SET points=EXCLUDED.points",[from,clubId,points.toFixed(3)]);
 }
 for(const [country,stats] of assoc){
  const coefficient=stats.clubs.size?stats.points/stats.clubs.size:0;
  await sql.query("INSERT INTO uefa_association_season_coefficients(season_id,country_code,points,participating_clubs,coefficient) VALUES($1,$2,$3,$4,$5) ON CONFLICT(season_id,country_code) DO UPDATE SET points=EXCLUDED.points,participating_clubs=EXCLUDED.participating_clubs,coefficient=EXCLUDED.coefficient",[from,country,stats.points,stats.clubs.size,coefficient.toFixed(3)]);
 }
 const countries=await sql.query("SELECT country_code FROM uefa_association_season_coefficients WHERE split_part(season_id,'-',1)::int <= split_part($1,'-',1)::int GROUP BY country_code UNION SELECT DISTINCT country_code FROM uefa_clubs",[from]);
 const allAssoc:any[]=[];
 for(const c of countries){
  const rows=await sql.query("SELECT coefficient FROM uefa_association_season_coefficients WHERE country_code=$1 AND split_part(season_id,'-',1)::int <= split_part($2,'-',1)::int ORDER BY split_part(season_id,'-',1)::int DESC LIMIT 5",[c.country_code,from]);
  const total=rows.reduce((sum:number,x:any)=>sum+Number(x.coefficient||0),0);
  allAssoc.push({country:String(c.country_code),total,coefficient:total});
 }
 const recentAssoc=new Map<string,number>();for(const c of countries){const r=await sql.query("SELECT coefficient FROM uefa_association_season_coefficients WHERE country_code=$1 AND split_part(season_id,'-',1)::int <= split_part($2,'-',1)::int ORDER BY split_part(season_id,'-',1)::int DESC LIMIT 1",[c.country_code,from]);recentAssoc.set(String(c.country_code),Number(r[0]?.coefficient||0));}
 allAssoc.sort((a,b)=>b.total-a.total||(recentAssoc.get(b.country)||0)-(recentAssoc.get(a.country)||0)||a.country.localeCompare(b.country));
 for(let i=0;i<allAssoc.length;i++){
  const c=allAssoc[i];await sql.query("INSERT INTO uefa_association_coefficients(country_code,latest_season_id,five_season_total,coefficient,ranking) VALUES($1,$2,$3,$3,$4) ON CONFLICT(country_code) DO UPDATE SET latest_season_id=EXCLUDED.latest_season_id,five_season_total=EXCLUDED.five_season_total,coefficient=EXCLUDED.coefficient,ranking=EXCLUDED.ranking",[c.country,from,c.total.toFixed(3),i+1]);
 }
 const clubRows=await sql.query("SELECT c.id,c.country_code,COALESCE(SUM(sc.points),0) total FROM uefa_clubs c LEFT JOIN uefa_club_season_coefficients sc ON sc.club_id=c.id AND sc.season_id IN (SELECT season_id FROM uefa_club_season_coefficients WHERE club_id=c.id AND split_part(season_id,'-',1)::int <= split_part($1,'-',1)::int GROUP BY season_id ORDER BY split_part(season_id,'-',1)::int DESC LIMIT 5) GROUP BY c.id,c.country_code ORDER BY total DESC,c.id",[from]);
 for(let i=0;i<clubRows.length;i++){
  const x=clubRows[i];const ten=await sql.query("SELECT COALESCE(SUM(points),0) total FROM uefa_club_season_coefficients WHERE club_id=$1 AND season_id IN (SELECT season_id FROM uefa_club_season_coefficients WHERE club_id=$1 AND split_part(season_id,'-',1)::int <= split_part($2,'-',1)::int GROUP BY season_id ORDER BY split_part(season_id,'-',1)::int DESC LIMIT 10)",[x.id,from]);
  const association=String(x.country_code||"UNK");const assocCoeff=allAssoc.find(a=>a.country===association)?.total||0;
  const assocTen=await sql.query("SELECT COALESCE(SUM(coefficient),0) AS total FROM (SELECT coefficient FROM uefa_association_season_coefficients WHERE country_code=$1 AND split_part(season_id,'-',1)::int <= split_part($2,'-',1)::int ORDER BY split_part(season_id,'-',1)::int DESC LIMIT 10) h",[association,from]);
  const fiveTotal=Math.max(Number(x.total||0),assocCoeff*.2);
  const tenTotal=Math.max(Number(ten[0]?.total||0),Number(assocTen[0]?.total||0)*.2);
  await sql.query("INSERT INTO uefa_club_coefficients(club_id,five_season_total,ten_season_total,coefficient,ranking) VALUES($1,$2,$3,$2,$4) ON CONFLICT(club_id) DO UPDATE SET five_season_total=EXCLUDED.five_season_total,ten_season_total=EXCLUDED.ten_season_total,coefficient=EXCLUDED.coefficient,ranking=EXCLUDED.ranking",[x.id,fiveTotal.toFixed(3),tenTotal.toFixed(3),i+1]);
 }
}

async function ensureDomesticUefaClubs(sql:Sql,from:string){
 const rows=await sql.query("SELECT t.id,t.name,t.reputation,t.team_strength,d.country_code,d.id AS division_id FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id=$1 AND d.tier=1",[from]);
 for(const t of rows){
  const existing=await sql.query("SELECT id FROM uefa_clubs WHERE domestic_team_id=$1 ORDER BY id LIMIT 1",[t.id]);
  const id=String(existing[0]?.id||("domestic-"+slug(String(t.id))));
  await sql.query("INSERT INTO uefa_clubs(id,name,country_code,reputation,team_strength,domestic_division_id,domestic_team_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,country_code=EXCLUDED.country_code,reputation=EXCLUDED.reputation,team_strength=EXCLUDED.team_strength,domestic_division_id=EXCLUDED.domestic_division_id,domestic_team_id=EXCLUDED.domestic_team_id",[id,t.name,t.country_code,clamp(Number(t.reputation||45),1,100),clamp(Number(t.team_strength||45),1,100),t.division_id,t.id]);
 }
}

function buildConstrainedUefaRounds(clubs:any[],code:string,matches:number,seedBase:string,coefficientById:Map<string,number>){
 const selected=[...clubs].sort((a:any,b:any)=>(coefficientById.get(String(b.id))||0)-(coefficientById.get(String(a.id))||0)||String(a.id).localeCompare(String(b.id)));
 if(selected.length!==36)return null;
 const potCount=code==="UECL"?6:4,potSize=36/potCount,quota=code==="UECL"?1:2,homeTarget=matches/2,groupCount=code==="UECL"?3:4;
 const potById=new Map<string,number>();selected.forEach((c:any,i:number)=>potById.set(String(c.id),Math.floor(i/potSize)));
 for(let attempt=0;attempt<160;attempt++){
  const states=new Map<string,any>();
  for(const c of selected)states.set(String(c.id),{played:new Set<string>(),byPot:Array(potCount).fill(0),homeByGroup:Array(groupCount).fill(0),awayByGroup:Array(groupCount).fill(0),home:0,away:0,countryCount:new Map<string,number>()});
  const groupFor=(pot:number)=>code==="UECL"?Math.floor(pot/2):pot;
  const orientations=(a:any,b:any)=>{
   const sa=states.get(String(a.id)),sb=states.get(String(b.id)),pa=potById.get(String(a.id))||0,pb=potById.get(String(b.id))||0;
   const ga=groupFor(pb),gb=groupFor(pa),out:any[]=[];
   if(sa.home<homeTarget&&sb.away<homeTarget&&sa.homeByGroup[ga]<1&&sb.awayByGroup[gb]<1)out.push({h:a,a:b});
   if(sb.home<homeTarget&&sa.away<homeTarget&&sb.homeByGroup[gb]<1&&sa.awayByGroup[ga]<1)out.push({h:b,a});
   return out;
  };
  const allowed=(a:any,b:any)=>{
   if(String(a.id)===String(b.id)||String(a.country_code)===String(b.country_code))return false;
   const sa=states.get(String(a.id)),sb=states.get(String(b.id)),pa=potById.get(String(a.id))||0,pb=potById.get(String(b.id))||0;
   if(sa.played.has(String(b.id))||sb.played.has(String(a.id))||sa.byPot[pb]>=quota||sb.byPot[pa]>=quota)return false;
   if((sa.countryCount.get(String(b.country_code))||0)>=2||(sb.countryCount.get(String(a.country_code))||0)>=2)return false;
   return orientations(a,b).length>0;
  };
  const apply=(home:any,away:any)=>{
   const sh=states.get(String(home.id)),sa=states.get(String(away.id)),ph=potById.get(String(home.id))||0,pa=potById.get(String(away.id))||0;
   sh.played.add(String(away.id));sa.played.add(String(home.id));sh.byPot[pa]++;sa.byPot[ph]++;
   sh.home++;sa.away++;sh.homeByGroup[groupFor(pa)]++;sa.awayByGroup[groupFor(ph)]++;
   sh.countryCount.set(String(away.country_code),(sh.countryCount.get(String(away.country_code))||0)+1);
   sa.countryCount.set(String(home.country_code),(sa.countryCount.get(String(home.country_code))||0)+1);
  };
  const built:any[][]=[];let ok=true;
  for(let md=0;md<matches&&ok;md++){
   const unpaired=[...selected],pairs:any[]=[];
   while(unpaired.length){
    let chosen:any=null,choices:any[]=[];
    for(const club of unpaired){
     const candidates=unpaired.filter((other:any)=>allowed(club,other)).map((other:any)=>({club:other,options:orientations(club,other),tie:seed(seedBase+attempt+md+String(club.id)+String(other.id))}));
     if(chosen===null||candidates.length<choices.length){chosen=club;choices=candidates;}
     if(candidates.length===0)break;
    }
    if(!chosen||choices.length===0){ok=false;break;}
    choices.sort((a:any,b:any)=>a.options.length-b.options.length||a.tie-b.tie);
    const opponent=choices[0].club,options=choices[0].options;
    const orientation=options[seed(seedBase+attempt+md+String(chosen.id)+String(opponent.id)+"home")%options.length];
    apply(orientation.h,orientation.a);pairs.push(orientation);
    unpaired.splice(unpaired.findIndex((x:any)=>String(x.id)===String(chosen.id)),1);
    unpaired.splice(unpaired.findIndex((x:any)=>String(x.id)===String(opponent.id)),1);
   }
   if(ok)built.push(pairs);
  }
  if(ok&&built.length===matches)return built;
 }
 return null;
}

async function createCompetition(sql:Sql,season:string,code:string,clubs:any[],matches:number){
 const id=season+"-"+code;
 await sql.query("INSERT INTO uefa_competitions(id,season_id,code,name,format,league_phase_clubs,matches_per_club) VALUES($1,$2,$3,$4,'swiss_league',36,$5) ON CONFLICT(season_id,code) DO UPDATE SET format='swiss_league',league_phase_clubs=36,matches_per_club=EXCLUDED.matches_per_club",[id,season,code,compNames[code],matches]);
 for(const c of clubs){
  await sql.query("INSERT INTO uefa_participants(id,competition_id,club_id,entry_stage) VALUES($1,$2,$3,$4) ON CONFLICT(competition_id,club_id) DO UPDATE SET entry_stage=EXCLUDED.entry_stage",[id+"-"+c.id,id,c.id,"league_phase"]);
 }
 const selected=clubs.slice(0,36);if(selected.length<36)return;
 const coefficientRows=await sql.query("SELECT club_id,five_season_total FROM uefa_club_coefficients WHERE club_id=ANY($1::text[])",[selected.map((c:any)=>String(c.id))]);
 const coefficientById=new Map(coefficientRows.map((c:any)=>[String(c.club_id),Number(c.five_season_total||0)]));
 const roundPairs=buildConstrainedUefaRounds(selected,code,matches,season+code,coefficientById);
 if(!roundPairs)throw new Error("UEFA draw constraints could not be satisfied for "+season+" "+code);
 const offset=seed(season+code)%roundPairs.length;
 for(let md=1;md<=matches;md++){
  const pairs=roundPairs[(md-1+offset)%roundPairs.length];
  const y=seasonYear(season),dateFor=(month:number,day:number,next=false)=>new Date(Date.UTC(y+(next?1:0),month-1,day,12)).toISOString().slice(0,10);
  const calendar:Record<string,string[]>={UCL:[dateFor(9,8),dateFor(10,13),dateFor(10,20),dateFor(11,3),dateFor(11,24),dateFor(12,8),dateFor(1,19,true),dateFor(1,27,true)],UEL:[dateFor(9,16),dateFor(10,15),dateFor(10,22),dateFor(11,5),dateFor(11,26),dateFor(12,10),dateFor(1,21,true),dateFor(1,28,true)],UECL:[dateFor(10,15),dateFor(10,22),dateFor(11,5),dateFor(11,26),dateFor(12,10),dateFor(12,17)]};
  for(let i=0;i<pairs.length;i++){
   const pair=pairs[(i+md-1)%pairs.length];
   const home=pair.h,away=pair.a;
   await sql.query("INSERT INTO uefa_fixtures(id,competition_id,season_id,matchday,kickoff_date,home_club_id,away_club_id,stage,status) VALUES($1,$2,$3,$4,$5,$6,$7,'league_phase','scheduled') ON CONFLICT DO NOTHING",[id+"-md"+md+"-"+home.id+"-"+away.id,id,season,md,calendar[code]?.[md-1]||dateFor(9,8),home.id,away.id]);
  }
 }
}
export async function advanceUefaDay(sql:Sql,day:string){
 const due=await sql.query("SELECT f.id,f.competition_id,f.season_id,f.matchday,f.stage,f.home_club_id,f.away_club_id,h.team_strength AS home_strength,a.team_strength AS away_strength FROM uefa_fixtures f JOIN uefa_clubs h ON h.id=f.home_club_id JOIN uefa_clubs a ON a.id=f.away_club_id WHERE f.kickoff_date<=$1::date AND f.status='scheduled' ORDER BY f.kickoff_date,f.competition_id,f.matchday,f.id",[day]);
 for(const f of due){
  let hg=clamp(Math.round(1.3+(Number(f.home_strength||55)-Number(f.away_strength||55))*.025+(seed(String(f.id))%7-3)*.35),0,6);
  let ag=clamp(Math.round(1.05+(Number(f.away_strength||55)-Number(f.home_strength||55))*.025+(seed(String(f.id)+"a")%7-3)*.35),0,6);
  if(f.stage==="final"&&hg===ag){if(seed(String(f.id)+"pen")%2===0)hg++;else ag++;}
  const claimed=await sql.query("UPDATE uefa_fixtures SET home_goals=$2,away_goals=$3,status='played' WHERE id=$1 AND status='scheduled' RETURNING id",[f.id,hg,ag]);
  if(!claimed.length)continue;
  if(f.stage==="league_phase"){
   await sql.query("UPDATE uefa_participants SET played=played+1,points=points+$1,wins=wins+$2,draws=draws+$3,losses=losses+$4,goals_for=goals_for+$5,goals_against=goals_against+$6 WHERE competition_id=$7 AND club_id=$8",[hg>ag?3:hg===ag?1:0,hg>ag?1:0,hg===ag?1:0,hg<ag?1:0,hg,ag,f.competition_id,f.home_club_id]);
   await sql.query("UPDATE uefa_participants SET played=played+1,points=points+$1,wins=wins+$2,draws=draws+$3,losses=losses+$4,goals_for=goals_for+$5,goals_against=goals_against+$6 WHERE competition_id=$7 AND club_id=$8",[ag>hg?3:ag===hg?1:0,ag>hg?1:0,ag===hg?1:0,ag<hg?1:0,ag,hg,f.competition_id,f.away_club_id]);
  }
 }
 const seasons=await sql.query("SELECT id FROM seasons WHERE starts_on<=$1::date AND ends_on>=$1::date ORDER BY starts_on DESC LIMIT 1",[day]);
 if(!seasons.length)return {played:due.length,scheduledKnockout:0};
 const season=String(seasons[0].id);
 const comps=await sql.query("SELECT id,code FROM uefa_competitions WHERE season_id=$1",[season]);
 let scheduledKnockout=0;
 const addDays=(n:number)=>{const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const fixturesFor=async(compId:string,stage:string)=>sql.query("SELECT id,matchday,kickoff_date,home_club_id,away_club_id,home_goals,away_goals,status FROM uefa_fixtures WHERE competition_id=$1 AND stage=$2 ORDER BY matchday,kickoff_date,id",[compId,stage]);
 const complete=async(compId:string,stage:string)=>{const fs=await fixturesFor(compId,stage);return fs.length>0&&fs.every((x:any)=>x.status==="played");};
 const hasStage=async(compId:string,stage:string)=>{const r=await sql.query("SELECT 1 FROM uefa_fixtures WHERE competition_id=$1 AND stage=$2 LIMIT 1",[compId,stage]);return r.length>0;};
 const table=async(compId:string)=>sql.query("SELECT p.club_id AS id,c.name,c.country_code,c.team_strength,p.points,p.goals_for,p.goals_against,COALESCE(cc.five_season_total,0) AS coefficient FROM uefa_participants p JOIN uefa_clubs c ON c.id=p.club_id LEFT JOIN uefa_club_coefficients cc ON cc.club_id=c.id WHERE p.competition_id=$1 ORDER BY p.points DESC,(p.goals_for-p.goals_against) DESC,p.goals_for DESC,coefficient DESC,c.name",[compId]);
 const winners=async(compId:string,stage:string)=>{
  const fs=await fixturesFor(compId,stage),groups=new Map<string,any[]>();
  for(const f of fs){const key=[String(f.home_club_id),String(f.away_club_id)].sort().join("|");if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(f);}
  const out:any[]=[];
  for(const group of [...groups.values()].sort((a:any[],b:any[])=>Number(a[0].matchday)-Number(b[0].matchday)||String(a[0].id).localeCompare(String(b[0].id)))){
   const totals=new Map<string,number>();for(const f of group){totals.set(String(f.home_club_id),(totals.get(String(f.home_club_id))||0)+Number(f.home_goals||0));totals.set(String(f.away_club_id),(totals.get(String(f.away_club_id))||0)+Number(f.away_goals||0));}
   const ids=[...totals.keys()];let winner=ids[0],loser=ids[1],a=totals.get(winner)||0,b=totals.get(loser)||0;
   if(a===b){const teams=await sql.query("SELECT id,team_strength FROM uefa_clubs WHERE id=ANY($1::text[])",[ids]);const strength=new Map(teams.map((x:any)=>[String(x.id),Number(x.team_strength||55)]));if((strength.get(loser)||55)+seed(loser)%10>(strength.get(winner)||55)+seed(winner)%10){const temp=winner;winner=loser;loser=temp;}}
   const club=await sql.query("SELECT id,name,country_code,team_strength FROM uefa_clubs WHERE id=$1",[winner]);if(club.length)out.push(club[0]);
  }
  return out;
 };
 const scheduleTies=async(comp:any,stage:string,firstMatchday:number,pairs:any[],twoLegs=true)=>{
  const y=seasonYear(season),dateOf=(month:number,day:number)=>new Date(Date.UTC(y+(month<=6?1:0),month-1,day,12)).toISOString().slice(0,10);
  const calendar:Record<string,Record<string,string[]>>={
   UCL:{knockout_playoff:[dateOf(2,16),dateOf(2,23)],round_of_16:[dateOf(3,9),dateOf(3,16)],quarter_final:[dateOf(4,6),dateOf(4,13)],semi_final:[dateOf(4,27),dateOf(5,4)],final:[dateOf(6,5)]},
   UEL:{knockout_playoff:[dateOf(2,18),dateOf(2,25)],round_of_16:[dateOf(3,11),dateOf(3,18)],quarter_final:[dateOf(4,8),dateOf(4,15)],semi_final:[dateOf(4,29),dateOf(5,6)],final:[dateOf(5,26)]},
   UECL:{knockout_playoff:[dateOf(2,18),dateOf(2,25)],round_of_16:[dateOf(3,11),dateOf(3,18)],quarter_final:[dateOf(4,8),dateOf(4,15)],semi_final:[dateOf(4,29),dateOf(5,6)],final:[dateOf(6,2)]}
  };
  const dates=calendar[String(comp.code)]?.[stage]||[dateOf(5,26)];
  const firstDate=dates[0],secondDate=dates[1]||dates[0];
  for(let i=0;i<pairs.length;i++){
   const [home,away]=pairs[i];if(!home||!away||home.id===away.id)continue;
   const firstId=comp.id+"-"+stage+"-"+firstMatchday+"-"+home.id+"-"+away.id;
   await sql.query("INSERT INTO uefa_fixtures(id,competition_id,season_id,matchday,kickoff_date,home_club_id,away_club_id,stage,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'scheduled') ON CONFLICT DO NOTHING",[firstId,comp.id,season,firstMatchday,firstDate,home.id,away.id,stage]);
   if(twoLegs){const secondId=comp.id+"-"+stage+"-"+(firstMatchday+1)+"-"+away.id+"-"+home.id;await sql.query("INSERT INTO uefa_fixtures(id,competition_id,season_id,matchday,kickoff_date,home_club_id,away_club_id,stage,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'scheduled') ON CONFLICT DO NOTHING",[secondId,comp.id,season,firstMatchday+1,secondDate,away.id,home.id,stage]);}
   scheduledKnockout+=twoLegs?2:1;
  }
 };
 for(const comp of comps){
  const league=await fixturesFor(String(comp.id),"league_phase");
  if(!league.length||!league.every((x:any)=>x.status==="played"))continue;
  const standings=await table(String(comp.id));
  if(!await hasStage(String(comp.id),"knockout_playoff")){
   const pairs:any[]=[];for(let i=8;i<16&&i<standings.length;i++){const opponent=standings[23-(i-8)];if(opponent)pairs.push([standings[i],opponent]);}
   await scheduleTies(comp,"knockout_playoff",9,pairs,true);continue;
  }
  if(!await complete(String(comp.id),"knockout_playoff"))continue;
  if(!await hasStage(String(comp.id),"round_of_16")){
   const playoffWinners=await winners(String(comp.id),"knockout_playoff"),pairs:any[]=[];
   for(let i=0;i<8;i++)if(standings[i]&&playoffWinners[i])pairs.push([standings[i],playoffWinners[i]]);
   await scheduleTies(comp,"round_of_16",11,pairs,true);continue;
  }
  if(!await complete(String(comp.id),"round_of_16"))continue;
  if(!await hasStage(String(comp.id),"quarter_final")){
   const won=await winners(String(comp.id),"round_of_16"),pairs:any[]=[];for(let i=0;i+1<won.length;i+=2)pairs.push([won[i],won[i+1]]);
   await scheduleTies(comp,"quarter_final",13,pairs,true);continue;
  }
  if(!await complete(String(comp.id),"quarter_final"))continue;
  if(!await hasStage(String(comp.id),"semi_final")){
   const won=await winners(String(comp.id),"quarter_final"),pairs:any[]=[];for(let i=0;i+1<won.length;i+=2)pairs.push([won[i],won[i+1]]);
   await scheduleTies(comp,"semi_final",15,pairs,true);continue;
  }
  if(!await complete(String(comp.id),"semi_final"))continue;
  if(!await hasStage(String(comp.id),"final")){
   const won=await winners(String(comp.id),"semi_final");if(won.length>=2)await scheduleTies(comp,"final",17,[[won[0],won[1]]],false);
  }
 }
 return {played:due.length,scheduledKnockout};
}

export async function buildUefaSeason(sql:Sql,from:string,season:string){
 await ensureHistoricalCoefficients(sql);
 await finishPreviousSeason(sql,from);
 await ensureDomesticUefaClubs(sql,season);
 const domestic=await sql.query("SELECT h.team_id,h.final_position,h.points,h.division_id,d.country_code,d.tier,t.name,t.reputation,t.team_strength FROM team_season_history h JOIN divisions d ON d.id=h.division_id JOIN teams t ON t.id=h.team_id WHERE h.season_id=$1 AND d.tier=1 ORDER BY d.country_code,h.final_position,h.points DESC,t.id",[from]);
 const assoc=await sql.query("SELECT country_code,ranking,coefficient FROM uefa_association_coefficients ORDER BY ranking");
 const rank=new Map(assoc.map((x:any)=>[String(x.country_code),Number(x.ranking||999)]));
 const countryRows=new Map<string,any[]>();for(const t of domestic){const key=String(t.country_code);if(!countryRows.has(key))countryRows.set(key,[]);countryRows.get(key)!.push(t);}
 const orderedCountries=[...countryRows.keys()].sort((a,b)=>(rank.get(a)||999)-(rank.get(b)||999)||a.localeCompare(b));
 const pools:Record<string,any[]>={UCL:[],UEL:[],UECL:[]};
 for(const country of orderedCountries){
  const rows=countryRows.get(country)!;const cr=rank.get(country)||999;
  const uclSlots=cr<=4?4:cr<=6?3:cr<=10?2:cr<=15?1:0;
  const uelSlots=cr<=6?2:cr<=15?2:1;
  const ueclSlots=cr<=10?2:cr<=30?2:1;
  const clubRows=await sql.query("SELECT id,name,domestic_team_id,reputation,team_strength FROM uefa_clubs WHERE domestic_team_id=ANY($1::text[]) ORDER BY id",[rows.map((x:any)=>String(x.team_id))]);
  const byTeam=new Map(clubRows.map((c:any)=>[String(c.domestic_team_id),c]));
  const ranked=rows.map((r:any)=>({...r,club:byTeam.get(String(r.team_id))})).filter((r:any)=>r.club);
  const champion=ranked.find((r:any)=>Number(r.final_position)===1);
  const top=ranked.filter((r:any)=>Number(r.final_position)<=Math.max(uclSlots,1));
  for(const r of top.slice(0,uclSlots))pools.UCL.push({...r.club,entry_rank:Number(r.final_position),association_rank:cr});
  for(const r of ranked.filter((r:any)=>Number(r.final_position)>uclSlots&&Number(r.final_position)<=uclSlots+uelSlots))pools.UEL.push({...r.club,entry_rank:Number(r.final_position),association_rank:cr});
  for(const r of ranked.filter((r:any)=>Number(r.final_position)>uclSlots+uelSlots&&Number(r.final_position)<=uclSlots+uelSlots+ueclSlots))pools.UECL.push({...r.club,entry_rank:Number(r.final_position),association_rank:cr});
  if(champion&&!pools.UCL.some((x:any)=>x.id===champion.club.id))pools.UCL.push({...champion.club,entry_rank:1,association_rank:cr});
 }
 // UEFA's two European Performance Spots go to the highest-placed additional domestic clubs from the two best-performing associations in the previous European season.
 const epsCountries=await sql.query("SELECT country_code FROM uefa_association_season_coefficients WHERE season_id=$1 ORDER BY coefficient DESC,country_code LIMIT 2",[from]);
 for(const e of epsCountries){
  const country=String(e.country_code);
  const rows=countryRows.get(country)||[];
  const candidate=rows.map((r:any)=>({...r,club:(r as any).club||null})).sort((a:any,b:any)=>Number(a.final_position)-Number(b.final_position)||Number(b.points)-Number(a.points));
  let chosen:any=null;
  for(const r of candidate){
   const club=await sql.query("SELECT id,name,country_code,reputation,team_strength FROM uefa_clubs WHERE domestic_team_id=$1 ORDER BY id LIMIT 1",[r.team_id]);
   if(club.length&&!pools.UCL.some((x:any)=>x.id===club[0].id)){chosen={...club[0],entry_rank:0,association_rank:rank.get(country)||999,eps:true};break;}
  }
  if(chosen)pools.UCL.push(chosen);
 }
 // Winners of last season retain a league-phase place if not qualified domestically.
 for(const code of ["UCL","UEL"]){
  const prev=await sql.query("SELECT f.home_club_id,f.away_club_id,f.home_goals,f.away_goals,f.stage FROM uefa_fixtures f JOIN uefa_competitions c ON c.id=f.competition_id WHERE c.season_id=$1 AND c.code=$2 AND f.stage='final' AND f.status='played' ORDER BY f.kickoff_date DESC LIMIT 1",[from,code]);
  if(prev.length){const winner=Number(prev[0].home_goals)>Number(prev[0].away_goals)?prev[0].home_club_id:prev[0].away_club_id;const club=await sql.query("SELECT id,name,reputation,team_strength FROM uefa_clubs WHERE id=$1",[winner]);if(club.length&&!pools.UCL.some((x:any)=>x.id===winner))pools.UCL.push({...club[0],entry_rank:0,association_rank:rank.get(String(club[0].country_code))||999});}
 }
 const fallback=await sql.query("SELECT id,name,country_code,reputation,team_strength,domestic_team_id FROM uefa_clubs WHERE domestic_team_id IS NULL ORDER BY reputation DESC,team_strength DESC,id");
 for(const code of ["UCL","UEL","UECL"]){
  const used=new Set(pools[code].map((x:any)=>String(x.id)));
  const samePool=pools[code];
  for(const c of fallback){if(samePool.length>=36)break;if(used.has(String(c.id)))continue;if(code!=="UCL"&&pools.UCL.some((x:any)=>x.id===c.id))continue;if(code==="UECL"&&pools.UEL.some((x:any)=>x.id===c.id))continue;samePool.push({...c,entry_rank:999,association_rank:rank.get(String(c.country_code))||999});used.add(String(c.id));}
  samePool.sort((a:any,b:any)=>Number(a.entry_rank)-Number(b.entry_rank)||Number(a.association_rank)-Number(b.association_rank)||Number(b.reputation)-Number(a.reputation));
  await createCompetition(sql,season,code,samePool.slice(0,36),code==="UECL"?6:8);
  await sql.query("INSERT INTO uefa_club_player_memberships(season_id,club_id,player_id,membership_type) SELECT $1,u.id,tm.player_id,'primary' FROM uefa_clubs u JOIN team_player_memberships tm ON tm.team_id=u.domestic_team_id AND tm.season_id=$1 AND tm.membership_type='primary' JOIN players p ON p.id=tm.player_id AND p.is_active=TRUE AND p.career_status='active' WHERE u.id=ANY($2::text[]) ON CONFLICT(season_id,club_id,player_id) DO NOTHING",[season,samePool.slice(0,36).map((x:any)=>String(x.id))]);
 }
 // Domestic financial monitoring: UEFA 70% squad-cost ceiling plus solvency and break-even controls.
 const finance=await sql.query("SELECT t.id,t.annual_revenue,t.annual_wage_bill,t.season_budget,t.debt,t.reputation,d.country_code,d.tier FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id=$1",[season]);
 const rules=await sql.query("SELECT country_code,rule_code,rule_name,squad_cost_limit_pct,allowed_loss_eur,monitoring_years,requires_licence FROM national_financial_rules");
 const ruleByCountry=new Map(rules.map((x:any)=>[String(x.country_code),x]));
 for(const t of finance){
  const revenue=Math.max(1,Number(t.annual_revenue||0));
  const rule:any=ruleByCountry.get(String(t.country_code))||{rule_code:"UEFA_FSR",rule_name:"UEFA financial sustainability",squad_cost_limit_pct:70,allowed_loss_eur:60000000,monitoring_years:3,requires_licence:true};
  const squadCost=Math.round(Number(t.annual_wage_bill||0)+Number(t.season_budget||0)*.35);
  const ratio=squadCost/revenue*100;
  const europeanEntry=await sql.query("SELECT 1 FROM uefa_participants p JOIN uefa_competitions c ON c.id=p.competition_id JOIN uefa_clubs u ON u.id=p.club_id WHERE c.season_id=$1 AND u.domestic_team_id=$2 LIMIT 1",[season,t.id]);
  const nationalLimit=Number(rule.squad_cost_limit_pct||100);
  const limit=europeanEntry.length?Math.min(70,nationalLimit):nationalLimit;
  const sanctions:any[]=[];
  if(ratio>limit)sanctions.push({type:europeanEntry.length?"uefa_squad_cost_rule":"national_budget_control",severity:ratio>limit+10?"major":"warning",ratio:Number(ratio.toFixed(2)),ceiling:limit,rule:europeanEntry.length?"UEFA_FSR":rule.rule_code});
  const estimatedOperatingDeficit=Math.max(0,squadCost-revenue);
  const annualLossAllowance=Number(rule.allowed_loss_eur||60000000)/Math.max(1,Number(rule.monitoring_years||3));
  if(estimatedOperatingDeficit>annualLossAllowance)sanctions.push({type:"football_earnings_estimate",severity:estimatedOperatingDeficit>annualLossAllowance*2?"major":"warning",estimated_deficit:estimatedOperatingDeficit,annual_allowance:annualLossAllowance,monitoring_years:Number(rule.monitoring_years||3)});
  const debt=Number(t.debt||0);
  const debtToRevenue=debt/revenue;
  if(debtToRevenue>1.5)sanctions.push({type:"debt_sustainability_review",debt_to_revenue:Number(debtToRevenue.toFixed(2)),threshold:1.5});
  // Debt is not the same as an overdue payable; those stay unasserted until a separate payment ledger exists.
  const overdueClub=0;
  const status=sanctions.some((x:any)=>x.severity==="major")?"breach":sanctions.length?"review":"compliant";
  await sql.query("INSERT INTO club_financial_monitoring(team_id,season_id,relevant_revenue,squad_cost,squad_cost_ratio,overdue_club_payables,compliance_status,sanctions) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(team_id,season_id) DO UPDATE SET relevant_revenue=EXCLUDED.relevant_revenue,squad_cost=EXCLUDED.squad_cost,squad_cost_ratio=EXCLUDED.squad_cost_ratio,overdue_club_payables=EXCLUDED.overdue_club_payables,compliance_status=EXCLUDED.compliance_status,sanctions=EXCLUDED.sanctions,reviewed_at=now()",[t.id,season,revenue,squadCost,ratio.toFixed(2),overdueClub,status,JSON.stringify([{national_rule:rule.rule_code,national_rule_name:rule.rule_name,licence_required:rule.requires_licence},...sanctions])]);
 }
 return {competitions:3,associationCount:assoc.length,entrants:{UCL:pools.UCL.slice(0,36).length,UEL:pools.UEL.slice(0,36).length,UECL:pools.UECL.slice(0,36).length}};
}
