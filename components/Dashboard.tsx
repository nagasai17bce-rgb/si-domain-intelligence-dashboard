"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Result={input:string;domain:string;status:string;detail:string;rdapUrl?:string};
type FeedEvent={id:string;time:string;domain:string;from:string;to:string;detail:string};
const examples=["perplexity","lawvyn","openai","anthropic","cursor"];
const score=(r:Result)=>{
  if(r.status!=="LIKELY_AVAILABLE") return 0;
  const n=r.domain.slice(0,-3); let s=55;
  if(n.length<=6) s+=20; if(n.length<=4) s+=10; if(/ai|agent|voice|data|lab|labs|dev|legal|cloud/.test(n)) s+=10;
  return Math.min(100,s);
};
const risk=(r:Result)=>r.status!=="LIKELY_AVAILABLE"?"—":(/lawvyn|openai|perplexity|anthropic|cursor/.test(r.domain)?"HIGH":"REVIEW");
const label=(s:string)=>s.replaceAll("_"," ");

export default function Dashboard(){
  const [names,setNames]=useState(examples),[results,setResults]=useState<Result[]>([]),[q,setQ]=useState(""),[loading,setLoading]=useState(false),[live,setLive]=useState(false),[notice,setNotice]=useState("Load a CSV or scan the examples."),[feed,setFeed]=useState<FeedEvent[]>([]);
  const previous=useRef<Map<string,string>>(new Map());
  const initialized=useRef(false);
  const filtered=useMemo(()=>results.filter(r=>r.domain.includes(q.toLowerCase())),[results,q]);
  const available=results.filter(r=>r.status==="LIKELY_AVAILABLE").length;
  const registered=results.filter(r=>r.status==="REGISTERED_OR_UNAVAILABLE").length;
  const review=results.length-available-registered;

  useEffect(()=>{
    try { setFeed(JSON.parse(localStorage.getItem("si-live-feed")||"[]")); } catch {}
  },[]);
  useEffect(()=>{ localStorage.setItem("si-live-feed",JSON.stringify(feed.slice(0,100))); },[feed]);

  async function scan(isLive=false){
    if(!names.length) return;
    setLoading(true); if(!isLive) setNotice("Checking Register.si RDAP…");
    try{
      const r=await fetch("/api/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({names:names.slice(0,100)})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error||"Scan failed");
      const next:Result[]=d.results||[];
      if(initialized.current){
        const events:FeedEvent[]=[];
        for(const item of next){
          const old=previous.current.get(item.domain);
          if(old && old!==item.status){
            events.push({id:item.domain+"-"+Date.now(),time:new Date().toISOString(),domain:item.domain,from:old,to:item.status,detail:item.detail});
          }
        }
        if(events.length) setFeed(f=>[...events,...f].slice(0,100));
      }
      previous.current=new Map(next.map((item:Result)=>[item.domain,item.status]));
      initialized.current=true;
      setResults(next);
      setNotice(isLive ? "Live check complete · "+new Date().toLocaleTimeString() : "Scan complete: "+next.length+" domains checked.");
    }catch(e){setNotice(e instanceof Error?e.message:"Scan failed");}finally{setLoading(false);}
  }

  useEffect(()=>{
    if(!live) return;
    scan(true);
    const id=window.setInterval(()=>scan(true),60000);
    return ()=>window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[live,names]);

  async function loadCSV(file:File){const text=await file.text();const p=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>x.split(",")[0].replace(/^"|"$/g,"").trim()).filter(Boolean).slice(0,500);setNames(p);setNotice(p.length+" candidate names loaded.");}
  function exportCSV(){
    const esc=(x:string)=>'"'+x.replace(/"/g,'""')+'"';
    const rows=[["domain","status","risk","score","detail"],...filtered.map(r=>[r.domain,r.status,risk(r),String(score(r)),r.detail])];
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.map(x=>x.map(esc).join(",")).join("\n")],{type:"text/csv"}));a.download="si-domain-results.csv";a.click();
  }
  function clearFeed(){setFeed([]);localStorage.removeItem("si-live-feed");}

  return <main className="shell">
    <header><div><div className="eyebrow">DOMAIN RESEARCH · LIVE MONITOR</div><h1>.si Domain Intelligence</h1><p>Bulk availability checks with a live change feed.</p></div><a className="github" href="https://github.com/nagasai17bce-rgb/si-domain-intelligence-dashboard" target="_blank" rel="noreferrer">GitHub ↗</a></header>
    <section className="card controls"><div className="buttons">
      <label className="btn"><input type="file" accept=".csv" onChange={e=>{const f=e.target.files?.[0];if(f)loadCSV(f)}}/>Upload CSV</label>
      <button onClick={()=>setNames(examples)}>Examples</button><button className="primary" disabled={loading||!names.length} onClick={()=>scan(false)}>{loading?"Scanning…":"Scan domains"}</button><button disabled={!results.length} onClick={exportCSV}>Export</button>
      <button className={live?"liveOn":""} disabled={!names.length} onClick={()=>setLive(v=>!v)}>{live?"● Live · 60s":"○ Start live feed"}</button>
    </div><div className="chips">{names.slice(0,20).map(n=><span key={n}>{n}.si</span>)}{names.length>20&&<span>+{names.length-20} more</span>}</div><div className="notice">{notice}</div></section>
    <section className="stats"><div className="card"><small>Total</small><strong>{results.length}</strong></div><div className="card"><small>Likely available</small><strong className="green">{available}</strong></div><div className="card"><small>Registered / unavailable</small><strong className="red">{registered}</strong></div><div className="card"><small>Needs verification</small><strong className="yellow">{review}</strong></div></section>

    <section className="card feed"><div className="feedHead"><div><h2>Live feed</h2><p>Changes detected while this dashboard is open. Polling interval: 60 seconds.</p></div><button onClick={clearFeed} disabled={!feed.length}>Clear</button></div>
      {feed.length ? <div>{feed.slice(0,20).map(e=><div className="feedItem" key={e.id}><span className="dot"/><div><b>{e.domain}</b> <span className="arrow">{label(e.from)} → <strong>{label(e.to)}</strong></span><small>{new Date(e.time).toLocaleString()} · {e.detail}</small></div></div>)}</div> : <div className="feedEmpty">No changes detected yet. Start the live feed to monitor your candidates.</div>}
    </section>

    <section className="card table"><div className="tableTop"><div><h2>Results</h2><p>RDAP results are informational; confirm at a registrar before purchase.</p></div><input placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/></div>
      <div className="scroll"><table><thead><tr><th>Domain</th><th>Status</th><th>Risk</th><th>Score</th><th>Detail</th><th>RDAP</th></tr></thead><tbody>
      {filtered.map(r=><tr key={r.domain}><td><b>{r.domain}</b></td><td><span className={"pill "+r.status.toLowerCase()}>{label(r.status)}</span></td><td>{risk(r)}</td><td>{score(r)||"—"}</td><td>{r.detail}</td><td>{r.rdapUrl?<a href={r.rdapUrl} target="_blank" rel="noreferrer">open ↗</a>:"—"}</td></tr>)}
      {!filtered.length&&<tr><td colSpan={6} className="empty">Run a scan to populate results.</td></tr>}</tbody></table></div>
    </section>
    <footer>Source: Register.si RDAP · Live monitoring polls every 60s while this page is open · Availability is not a registration guarantee.</footer>
  </main>;
}
