type Sql = { query: (query: string, params?: any[]) => Promise<any[]> };
const clamp = (n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const seasonYear = (season:string)=>Number(season.slice(0,4));
const seed = (s:string)=>Array.from(s).reduce((a,c)=>a+c.charCodeAt(0),0);
const slug = (s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const MARKET:Record<string,number>={ENG:1.8,ESP:1.3,GER:1.35,ITA:1.2,FRA:1.05,NED:.85,POR:.78,BEL:.65,SCO:.6,TUR:.7,AUT:.52,CZE:.45,GRE:.45};
const COUNTRY_NAMES:Record<string,string>={ENG:"England",ESP:"Spain",GER:"Germany",ITA:"Italy",FRA:"France",NED:"Netherlands",POR:"Portugal",BEL:"Belgium",SCO:"Scotland",TUR:"Türkiye",AUT:"Austria",CZE:"Czechia",GRE:"Greece"};
const compNames:Record<string,string>={UCL:"UEFA Champions League",UEL:"UEFA Europa League",UECL:"UEFA Conference League"};

async function finishPreviousSeason(sql:Sql,from:string){
 const fixtures=await sql.query("SELECT f.id,f.competition_id,f.home_club_id,f.away_club_id,f.home_goals,f.away_goals,f.status,h.country_code AS hc,a.country_code AS ac FROM uefa_fixtures f JOIN uefa_clubs h ON h.id=f.home_club_id JOIN uefa_clubs a ON a.id=f.away_club_id WHERE f.season_id=$1 AND f.stage='league_phase'",[from]);
 const stats=new Map<string,{played:number;points:number;gf:number;ga:number;wins:number;draws:number;losses:number}>();
 const get=(id:string)=>{if(!stats.has(id))stats.set(id,{played:0,points:0,gf:0,ga:0,wins:0,draws:0,losses:0});return stats.get(id)!;};
 const assoc=new Map<string,{points:number;clubs:Set<string>}>();
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
   const s=get(id);s.played++;s.gf+=g;s.ga+=a;if(g>a){s.points+=2;s.wins++;}else if(g===a){s.points++;s.draws++;}else s.losses++;
   const cc=countryById.get(id)||"UNK";if(!assoc.has(cc))assoc.set(cc,{points:0,clubs:new Set()});const ac=assoc.get(cc)!;ac.points+=g>a?2:g===a?1:0;ac.clubs.add(id);
  }
 }
 for(const [clubId,s] of stats){
  await sql.query("INSERT INTO uefa_club_season_coefficients(season_id,club_id,points) VALUES($1,$2,$3) ON CONFLICT(season_id,club_id) DO UPDATE SET points=EXCLUDED.points",[from,clubId,s.points]);
  await sql.query("UPDATE uefa_participants SET played=$3,points=$4,wins=$5,draws=$6,losses=$7,goals_for=$8,goals_against=$9 WHERE competition_id IN (SELECT id FROM uefa_competitions WHERE season_id=$1) AND club_id=$2",[from,clubId,s.played,s.points,s.wins,s.draws,s.losses,s.gf,s.ga]);
 }
 for(const [country,stats] of assoc){
  const coefficient=stats.clubs.size?stats.points/stats.clubs.size:0;
  await sql.query("INSERT INTO uefa_association_season_coefficients(season_id,country_code,points,participating_clubs,coefficient) VALUES($1,$2,$3,$4,$5) ON CONFLICT(season_id,country_code) DO UPDATE SET points=EXCLUDED.points,participating_clubs=EXCLUDED.participating_clubs,coefficient=EXCLUDED.coefficient",[from,country,stats.points,stats.clubs.size,coefficient.toFixed(3)]);
 }
 const countries=await sql.query("SELECT DISTINCT country_code FROM uefa_clubs");
 const allAssoc:any[]=[];
 for(const c of countries){
  const rows=await sql.query("SELECT coefficient FROM uefa_association_season_coefficients WHERE country_code=$1 AND season_id IN (SELECT id FROM seasons WHERE starts_on <= (SELECT starts_on FROM seasons WHERE id=$2) ORDER BY starts_on DESC LIMIT 5)",[c.country_code,from]);
  const total=rows.reduce((sum:number,x:any)=>sum+Number(x.coefficient||0),0);
  allAssoc.push({country:String(c.country_code),total,coefficient:total});
 }
 allAssoc.sort((a,b)=>b.total-a.total||a.country.localeCompare(b.country));
 for(let i=0;i<allAssoc.length;i++){
  const c=allAssoc[i];await sql.query("INSERT INTO uefa_association_coefficients(country_code,latest_season_id,five_season_total,coefficient,ranking) VALUES($1,$2,$3,$3,$4) ON CONFLICT(country_code) DO UPDATE SET latest_season_id=EXCLUDED.latest_season_id,five_season_total=EXCLUDED.five_season_total,coefficient=EXCLUDED.coefficient,ranking=EXCLUDED.ranking",[c.country,from,c.total.toFixed(3),i+1]);
 }
 const clubRows=await sql.query("SELECT c.id,COALESCE(SUM(sc.points),0) total FROM uefa_clubs c LEFT JOIN uefa_club_season_coefficients sc ON sc.club_id=c.id AND sc.season_id IN (SELECT id FROM seasons WHERE starts_on <= (SELECT starts_on FROM seasons WHERE id=$1) ORDER BY starts_on DESC LIMIT 5) GROUP BY c.id ORDER BY total DESC,c.id",[from]);
 for(let i=0;i<clubRows.length;i++){
  const x=clubRows[i];const ten=await sql.query("SELECT COALESCE(SUM(points),0) total FROM uefa_club_season_coefficients WHERE club_id=$1 AND season_id IN (SELECT id FROM seasons WHERE starts_on <= (SELECT starts_on FROM seasons WHERE id=$2) ORDER BY starts_on DESC LIMIT 10)",[x.id,from]);
  const association=countryById.get(String(x.id))||"UNK";const assocCoeff=allAssoc.find(a=>a.country===association)?.total||0;
  const tenTotal=Math.max(Number(ten[0]?.total||0),assocCoeff*.2);
  await sql.query("INSERT INTO uefa_club_coefficients(club_id,five_season_total,ten_season_total,coefficient,ranking) VALUES($1,$2,$3,$2,$4) ON CONFLICT(club_id) DO UPDATE SET five_season_total=EXCLUDED.five_season_total,ten_season_total=EXCLUDED.ten_season_total,coefficient=EXCLUDED.coefficient,ranking=EXCLUDED.ranking",[x.id,Number(x.total||0).toFixed(3),tenTotal.toFixed(3),i+1]);
 }
}

async function ensureDomesticUefaClubs(sql:Sql,from:string){
 const rows=await sql.query("SELECT t.id,t.name,t.reputation,t.team_strength,d.country_code,d.id AS division_id FROM teams t JOIN divisions d ON d.id=t.division_id WHERE d.season_id=$1 AND d.tier=1",[from]);
 for(const t of rows){
  const id="domestic-"+slug(String(t.id));
  await sql.query("INSERT INTO uefa_clubs(id,name,country_code,reputation,team_strength,domestic_division_id,domestic_team_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,country_code=EXCLUDED.country_code,reputation=EXCLUDED.reputation,team_strength=EXCLUDED.team_strength,domestic_division_id=EXCLUDED.domestic_division_id,domestic_team_id=EXCLUDED.domestic_team_id",[id,t.name,t.country_code,clamp(Number(t.reputation||45),1,100),clamp(Number(t.team_strength||45),1,100),t.division_id,t.id]);
 }
}
async function createCompetition(sql:Sql,season:string,code:string,clubs:any[],matches:number){
 const id=season+"-"+code;
 await sql.query("INSERT INTO uefa_competitions(id,season_id,code,name,format,league_phase_clubs,matches_per_club) VALUES($1,$2,$3,$4,'swiss_league',36,$5) ON CONFLICT(season_id,code) DO UPDATE SET format='swiss_league',league_phase_clubs=36,matches_per_club=EXCLUDED.matches_per_club",[id,season,code,compNames[code],matches]);
 for(const c of clubs){
  await sql.query("INSERT INTO uefa_participants(id,competition_id,club_id,entry_stage) VALUES($1,$2,$3,$4) ON CONFLICT(competition_id,club_id) DO UPDATE SET entry_stage=EXCLUDED.entry_stage",[id+"-"+c.id,id,c.id,"league_phase"]);
 }
 const selected=clubs.slice(0,36);if(selected.length<2)return;
 // Swiss-style round robin slice: every round is a perfect matching, so no club plays itself or twice in a matchday.
 const rotation=[...selected];if(rotation.length%2)rotation.push({id:"BYE"} as any);
 const n=rotation.length,rounds=n-1,roundPairs:any[][]=[];
 let ring=[...rotation];
 for(let r=0;r<rounds;r++){
  const pairs:any[]=[];for(let i=0;i<n/2;i++){const h=ring[i],a=ring[n-1-i];if(h.id!=="BYE"&&a.id!=="BYE")pairs.push({h,a});}
  roundPairs.push(pairs);ring=[ring[0],ring[n-1],...ring.slice(1,n-1)];
 }
 const offset=seed(season+code)%rounds;
 for(let md=1;md<=matches;md++){
  const pairs=roundPairs[(md-1+offset)%rounds];
  const date=new Date(Date.UTC(seasonYear(season)+(md>5?1:0),md<=5?8:1,md<=5?1+md*7:1+(md-5)*7,12));
  for(let i=0;i<pairs.length;i++){
   const pair=pairs[(i+md-1)%pairs.length],flip=((md+i+seed(code))%2)===0;
   const home=flip?pair.h:pair.a,away=flip?pair.a:pair.h;
   await sql.query("INSERT INTO uefa_fixtures(id,competition_id,season_id,matchday,kickoff_date,home_club_id,away_club_id,stage,status) VALUES($1,$2,$3,$4,$5,$6,$7,'league_phase','scheduled') ON CONFLICT DO NOTHING",[id+"-md"+md+"-"+home.id+"-"+away.id,id,season,md,date.toISOString().slice(0,10),home.id,away.id]);
  }
 }
}
export async function buildUefaSeason(sql:Sql,from:string,season:string){
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
 // Winners of last season retain a league-phase place if not qualified domestically.
 for(const code of ["UCL","UEL"]){
  const prev=await sql.query("SELECT f.home_club_id,f.away_club_id,f.home_goals,f.away_goals,f.stage FROM uefa_fixtures f JOIN uefa_competitions c ON c.id=f.competition_id WHERE c.season_id=$1 AND c.code=$2 AND f.stage='final' AND f.status='played' ORDER BY f.kickoff_date DESC LIMIT 1",[from,code]);
  if(prev.length){const winner=Number(prev[0].home_goals)>Number(prev[0].away_goals)?prev[0].home_club_id:prev[0].away_club_id;const club=await sql.query("SELECT id,name,reputation,team_strength FROM uefa_clubs WHERE id=$1",[winner]);if(club.length&&!pools.UCL.some((x:any)=>x.id===winner))pools.UCL.push({...club[0],entry_rank:0,association_rank:rank.get(String(club[0].country_code))||999});}
 }
 const fallback=await sql.query("SELECT id,name,country_code,reputation,team_strength,domestic_team_id FROM uefa_clubs ORDER BY reputation DESC,team_strength DESC,id");
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
  const limit=Number(rule.squad_cost_limit_pct||70);
  const sanctions:any[]=[];
  if(ratio>limit)sanctions.push({type:"squad_cost_ratio",severity:ratio>limit+10?"major":"warning",ratio:Number(ratio.toFixed(2)),ceiling:limit,rule:rule.rule_code});
  const debt=Number(t.debt||0);
  const estimatedLoss=Math.max(0,debt-revenue*.2);
  if(estimatedLoss>Number(rule.allowed_loss_eur||60000000))sanctions.push({type:"football_earnings",estimated_loss:estimatedLoss,allowed_loss:Number(rule.allowed_loss_eur||60000000),monitoring_years:Number(rule.monitoring_years||3)});
  const overdueClub=debt>revenue*.35?Math.round(debt-revenue*.35):0;
  if(overdueClub>0)sanctions.push({type:"solvency_review",amount:overdueClub});
  const status=sanctions.some((x:any)=>x.severity==="major"||x.type==="football_earnings")?"breach":sanctions.length?"review":"compliant";
  await sql.query("INSERT INTO club_financial_monitoring(team_id,season_id,relevant_revenue,squad_cost,squad_cost_ratio,overdue_club_payables,compliance_status,sanctions) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(team_id,season_id) DO UPDATE SET relevant_revenue=EXCLUDED.relevant_revenue,squad_cost=EXCLUDED.squad_cost,squad_cost_ratio=EXCLUDED.squad_cost_ratio,overdue_club_payables=EXCLUDED.overdue_club_payables,compliance_status=EXCLUDED.compliance_status,sanctions=EXCLUDED.sanctions,reviewed_at=now()",[t.id,season,revenue,squadCost,ratio.toFixed(2),overdueClub,status,JSON.stringify([{national_rule:rule.rule_code,national_rule_name:rule.rule_name,licence_required:rule.requires_licence},...sanctions])]);
 }
 return {competitions:3,associationCount:assoc.length,entrants:{UCL:pools.UCL.slice(0,36).length,UEL:pools.UEL.slice(0,36).length,UECL:pools.UECL.slice(0,36).length}};
}
