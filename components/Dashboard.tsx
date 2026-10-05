"use client";
import { useMemo,useState } from "react";

type Result={input:string;domain:string;status:string;detail:string;rdapUrl?:string};
const examples=["perplexity","lawvyn","openai","anthropic","cursor"];
const score=(r:Result)=>{
  if(r.status!=="LIKELY_AVAILABLE") return 0;
  const n=r.domain.slice(0,-3); let s=55;
  if(n.length<=6) s+=20; if(n.length<=4) s+=10; if(/ai|agent|voice|data|lab|labs|dev|legal|cloud/.test(n)) s+=10;
  return Math.min(100,s);
};
const risk=(r:Result)=>r.status!=="LIKELY_AVAILABLE"?"—":(/lawvyn|openai|perplexity|anthropic|cursor/.test(r.domain)?"HIGH":"REVIEW");

export default function Dashboard(){
  const [names,setNames]=useState(examples),[results,setResults]=useState<Result[]>([]),[q,setQ]=useState(""),[loading,setLoading]=useState(false),[notice,setNotice]=useState("Load a CSV or scan the examples.");
  const filtered=useMemo(()=>results.filter(r=>r.domain.includes(q.toLowerCase())),[results,q]);
  const available=results.filter(r=>r.status==="LIKELY_AVAILABLE").length;
  const registered=results.filter(r=>r.status==="REGISTERED_OR_UNAVAILABLE").length;
  const review=results.length-available-registered;
  async function scan(){
    setLoading(true); setNotice("Checking Register.si RDAP…");
    try{
      const r=await fetch("/api/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({names})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error||"Scan failed");
      setResults(d.results); setNotice("Scan complete: "+d.results.length+" domains checked.");
    }catch(e){setNotice(e instanceof Error?e.message:"Scan failed");}finally{setLoading(false);}
  }
  async function loadCSV(file:File){const text=await file.text();const p=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>x.split(",")[0].replace(/^"|"$/g,"").trim()).filter(Boolean).slice(0,500);setNames(p);setNotice(p.length+" candidate names loaded.");}
  function exportCSV(){
    const esc=(x:string)=>'"'+x.replace(/"/g,'""')+'"';
    const rows=[["domain","status","risk","score","detail"],...filtered.map(r=>[r.domain,r.status,risk(r),String(score(r)),r.detail])];
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.map(x=>x.map(esc).join(",")).join("\n")],{type:"text/csv"}));a.download="si-domain-results.csv";a.click();
  }
  return <main className="shell">
    <header><div><div className="eyebrow">DOMAIN RESEARCH</div><h1>.si Domain Intelligence</h1><p>Bulk availability checks with verification and risk signals.</p></div><a className="github" href="https://github.com/nagasai17bce-rgb/si-domain-intelligence-dashboard" target="_blank" rel="noreferrer">GitHub ↗</a></header>
    <section className="card controls"><div className="buttons">
      <label className="btn"><input type="file" accept=".csv" onChange={e=>{const f=e.target.files?.[0];if(f)loadCSV(f)}}/>Upload CSV</label>
      <button onClick={()=>setNames(examples)}>Examples</button><button className="primary" disabled={loading||!names.length} onClick={scan}>{loading?"Scanning…":"Scan domains"}</button><button disabled={!results.length} onClick={exportCSV}>Export</button>
    </div><div className="chips">{names.slice(0,20).map(n=><span key={n}>{n}.si</span>)}</div><div className="notice">{notice}</div></section>
    <section className="stats"><div className="card"><small>Total</small><strong>{results.length}</strong></div><div className="card"><small>Likely available</small><strong className="green">{available}</strong></div><div className="card"><small>Registered / unavailable</small><strong className="red">{registered}</strong></div><div className="card"><small>Needs verification</small><strong className="yellow">{review}</strong></div></section>
    <section className="card table"><div className="tableTop"><div><h2>Results</h2><p>RDAP results are informational; confirm at a registrar before purchase.</p></div><input placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/></div>
      <div className="scroll"><table><thead><tr><th>Domain</th><th>Status</th><th>Risk</th><th>Score</th><th>Detail</th><th>RDAP</th></tr></thead><tbody>
      {filtered.map(r=><tr key={r.domain}><td><b>{r.domain}</b></td><td><span className={"pill "+r.status.toLowerCase()}>{r.status.replaceAll("_"," ")}</span></td><td>{risk(r)}</td><td>{score(r)||"—"}</td><td>{r.detail}</td><td>{r.rdapUrl?<a href={r.rdapUrl} target="_blank" rel="noreferrer">open ↗</a>:"—"}</td></tr>)}
      {!filtered.length&&<tr><td colSpan={6} className="empty">Run a scan to populate results.</td></tr>}</tbody></table></div>
    </section>
    <footer>Source: Register.si RDAP · Availability is not a registration guarantee.</footer>
  </main>;
}
