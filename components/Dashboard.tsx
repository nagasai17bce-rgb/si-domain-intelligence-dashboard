"use client";
import { useEffect, useMemo, useState } from "react";

type Result={input:string;domain:string;status:string;detail:string;rdapUrl?:string};
type Feed={domain:string;seenAt:string};
const scoreName=(domain:string)=>{const n=domain.replace(/\.si$/,"");let s=40;if(n.length<=6)s+=20;if(n.length<=4)s+=10;if(/ai|agent|voice|data|lab|labs|dev|legal|cloud|tech|bot/.test(n))s+=20;return Math.min(100,s)};
const aiSignal=(d:string)=>/ai|agent|voice|data|lab|labs|dev|legal|cloud|tech|bot|llm|ml/.test(d.replace(".si",""))?"AI/Startup signal":"General";
export default function Dashboard(){
 const [mode,setMode]=useState<"feed"|"check">("feed"),[feed,setFeed]=useState<Feed[]>([]),[feedLoading,setFeedLoading]=useState(false),[feedError,setFeedError]=useState(""),[configured,setConfigured]=useState(false),[query,setQuery]=useState(""),[results,setResults]=useState<Result[]>([]),[loading,setLoading]=useState(false),[notice,setNotice]=useState(""),[filter,setFilter]=useState("");
 const [lastSync,setLastSync]=useState<string>("");
 async function loadFeed(){
  setFeedLoading(true);setFeedError("");
  try{
   const r=await fetch("/api/check?pattern=*.si",{cache:"no-store"});const d=await r.json();
   setConfigured(Boolean(d.configured));
   if(!r.ok){setFeedError(d.error||"Registry feed unavailable");return}
   const now=new Date().toISOString();
   setFeed((d.domains||[]).map((domain:string)=>({domain,seenAt:now})));
   setLastSync(now);
  }catch{setFeedError("Could not connect to the registry feed.");}
  finally{setFeedLoading(false);}
 }
 useEffect(()=>{loadFeed();const id=window.setInterval(loadFeed,60000);return()=>window.clearInterval(id)},[]);
 async function check(){
  if(!query.trim())return;setLoading(true);setNotice("Checking official Register.si RDAP…");
  try{const r=await fetch("/api/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({names:[query]})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Check failed");setResults(d.results||[]);const x=d.results?.[0];setNotice(x?.status==="LIKELY_AVAILABLE"?x.domain+" appears available; confirm with a registrar.":x?.status==="REGISTERED_OR_UNAVAILABLE"?x.domain+" is registered/unavailable according to Register.si.":"Registry check complete.");}catch(e){setNotice(e instanceof Error?e.message:"Check failed")}finally{setLoading(false)}
 }
 const shown=useMemo(()=>feed.filter(x=>x.domain.includes(filter.toLowerCase())).sort((a,b)=>b.domain.localeCompare(a.domain)),[feed,filter]);
 return <main className="shell">
  <header><div><div className="eyebrow">REGISTER.SI · REGISTRY RADAR</div><h1>.si Domain Intelligence</h1><p>Registry-sourced .si registrations and direct availability checks.</p></div><a className="github" href="https://github.com/nagasai17bce-rgb/si-domain-intelligence-dashboard" target="_blank" rel="noreferrer">GitHub ↗</a></header>
  <nav className="tabs"><button className={mode==="feed"?"tabActive":""} onClick={()=>setMode("feed")}>🔴 Live registry feed</button><button className={mode==="check"?"tabActive":""} onClick={()=>setMode("check")}>Check a domain</button></nav>
  {mode==="feed"?<section>
   <section className="stats"><div className="card"><small>Domains received</small><strong>{feed.length.toLocaleString()}</strong></div><div className="card"><small>Registry connection</small><strong className={configured?"green":"yellow"}>{configured?"ONLINE":"SETUP NEEDED"}</strong></div><div className="card"><small>Last sync</small><strong className="sync">{lastSync?new Date(lastSync).toLocaleTimeString():"—"}</strong></div><div className="card"><small>AI/startup signals</small><strong>{feed.filter(x=>aiSignal(x.domain)!=="General").length.toLocaleString()}</strong></div></section>
   <section className="card feed"><div className="feedHead"><div><h2>All registry domains</h2><p>Returned directly by authenticated Register.si wildcard RDAP. Polling the feed every 60 seconds.</p></div><button onClick={loadFeed} disabled={feedLoading}>{feedLoading?"Syncing…":"Sync now"}</button></div>
   <div className="feedTools"><input placeholder="Filter domains…" value={filter} onChange={e=>setFilter(e.target.value)}/></div>
   {feedError?<div className="feedEmpty error">{feedError}</div>:shown.length?<div>{shown.slice(0,500).map((x,i)=><div className="feedItem" key={x.domain+"-"+i}><span className="dot"/><div className="feedDomain"><b>{x.domain}</b><span className="signal">{aiSignal(x.domain)}</span><small>Registry result · detected {new Date(x.seenAt).toLocaleTimeString()}</small></div><strong className="domainScore">{scoreName(x.domain)}</strong></div>)}</div>:<div className="feedEmpty">{configured?"No domains returned by the current wildcard query.":"Add Register.si credentials in Vercel to activate the full registry feed."}</div>}
   </section>
   <section className="card honesty"><b>Authentic data policy</b><p>Every domain in this feed comes from the authenticated Register.si RDAP bulk query. The dashboard does not invent registration events or purchase timestamps. “Detected” means the domain was returned by the registry during a sync.</p></section>
  </section>:<section className="card searchBox"><div className="searchLabel">Check a .si domain</div><div className="searchRow"><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")check()}} placeholder="example.si or example"/><button className="primary searchBtn" disabled={loading||!query.trim()} onClick={check}>{loading?"Checking…":"Check availability"}</button></div><div className="sourceLine">Source: <a href="https://www.register.si/en/rdap/" target="_blank" rel="noreferrer">Register.si RDAP</a></div><div className="notice">{notice}</div>{results.map(r=><div className="singleResult" key={r.domain}><b>{r.domain}</b><span className={"pill "+r.status.toLowerCase()}>{r.status==="LIKELY_AVAILABLE"?"AVAILABLE":r.status==="REGISTERED_OR_UNAVAILABLE"?"REGISTERED / UNAVAILABLE":r.status}</span><small>{r.detail}</small></div>)}</section>}
  <footer>Source: Register.si · Registry data is authoritative for .si registration status. Registration availability may still require registrar confirmation.</footer>
 </main>
}