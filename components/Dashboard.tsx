"use client";
import { useMemo, useState } from "react";

type Result={input:string;domain:string;status:string;detail:string;rdapUrl?:string};
const score=(r:Result)=>{
  if(r.status!=="LIKELY_AVAILABLE") return 0;
  const n=r.domain.slice(0,-3); let s=55;
  if(n.length<=6) s+=20; if(n.length<=4) s+=10; if(/ai|agent|voice|data|lab|labs|dev|legal|cloud/.test(n)) s+=10;
  return Math.min(100,s);
};
const risk=(r:Result)=>r.status!=="LIKELY_AVAILABLE"?"—":(/lawvyn|openai|perplexity|anthropic|cursor/.test(r.domain)?"HIGH":"REVIEW");

export default function Dashboard(){
  const [query,setQuery]=useState(""),[results,setResults]=useState<Result[]>([]),[q,setQ]=useState(""),[loading,setLoading]=useState(false),[notice,setNotice]=useState("Enter a .si name to check its real registry status.");
  const filtered=useMemo(()=>results.filter(r=>r.domain.includes(q.toLowerCase())),[results,q]);
  const available=results.filter(r=>r.status==="LIKELY_AVAILABLE").length;
  const registered=results.filter(r=>r.status==="REGISTERED_OR_UNAVAILABLE").length;
  const review=results.length-available-registered;

  async function checkNames(names:string[]){
    setLoading(true); setNotice("Checking the official Register.si registry…");
    try{
      const r=await fetch("/api/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({names})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error||"Registry check failed");
      setResults(d.results||[]);
      const first=d.results?.[0];
      if(first?.status==="LIKELY_AVAILABLE") setNotice(first.domain+" appears available according to RDAP. Confirm at a registrar before purchase.");
      else if(first?.status==="REGISTERED_OR_UNAVAILABLE") setNotice(first.domain+" is registered/unavailable according to Register.si RDAP.");
      else setNotice("Registry check complete.");
    }catch(e){setNotice(e instanceof Error?e.message:"Registry check failed");}finally{setLoading(false);}
  }
  function check(){const n=query.trim(); if(!n)return; checkNames([n]);}
  function exampleSearch(n:string){setQuery(n);checkNames([n]);}
  function exportCSV(){
    const esc=(x:string)=>'"'+x.replace(/"/g,'""')+'"';
    const rows=[["domain","status","risk","score","detail"],...filtered.map(r=>[r.domain,r.status,risk(r),String(score(r)),r.detail])];
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.map(x=>x.map(esc).join(",")).join("\n")],{type:"text/csv"}));a.download="si-domain-results.csv";a.click();
  }

  return <main className="shell">
    <header><div><div className="eyebrow">OFFICIAL REGISTRY CHECK</div><h1>.si Domain Radar</h1><p>Check whether a .si domain is genuinely registered or appears available.</p></div><a className="github" href="https://github.com/nagasai17bce-rgb/si-domain-intelligence-dashboard" target="_blank" rel="noreferrer">GitHub ↗</a></header>

    <section className="card searchBox">
      <div className="searchLabel">Check a .si domain</div>
      <div className="searchRow">
        <input autoFocus value={query} onChange={e=>setQuery(e.target.value.replace(/https?:\/\//,"").replace(/\/.*$/,""))} onKeyDown={e=>{if(e.key==="Enter")check()}} placeholder="example.si or example" />
        <button className="primary searchBtn" disabled={loading||!query.trim()} onClick={check}>{loading?"Checking…":"Check availability"}</button>
      </div>
      <div className="sourceLine">Source: <a href="https://www.register.si/en/rdap/" target="_blank" rel="noreferrer">Register.si RDAP</a> · No CSV required · Live registry response</div>
      <div className="notice">{notice}</div>
    </section>

    <section className="quick">
      <div><small>Try a real lookup</small><div className="quickBtns">
        {["openai.si","perplexity.si","anthropic.si","cursor.si","lawvyn.si"].map(n=><button key={n} onClick={()=>exampleSearch(n)}>{n}</button>)}
      </div></div>
    </section>

    <section className="stats"><div className="card"><small>Checked</small><strong>{results.length}</strong></div><div className="card"><small>Appears available</small><strong className="green">{available}</strong></div><div className="card"><small>Registered / unavailable</small><strong className="red">{registered}</strong></div><div className="card"><small>Needs verification</small><strong className="yellow">{review}</strong></div></section>

    <section className="card table"><div className="tableTop"><div><h2>Registry results</h2><p>“Registered” means Register.si returned a registration response. “Available” is a 404 signal and still requires registrar confirmation.</p></div><div className="tableActions"><input placeholder="Filter…" value={q} onChange={e=>setQ(e.target.value)}/><button disabled={!results.length} onClick={exportCSV}>Export</button></div></div>
      <div className="scroll"><table><thead><tr><th>Domain</th><th>Registry status</th><th>Risk signal</th><th>Score</th><th>Registry detail</th><th>RDAP</th></tr></thead><tbody>
      {filtered.map(r=><tr key={r.domain}><td><b>{r.domain}</b></td><td><span className={"pill "+r.status.toLowerCase()}>{r.status==="LIKELY_AVAILABLE"?"AVAILABLE":r.status==="REGISTERED_OR_UNAVAILABLE"?"REGISTERED / UNAVAILABLE":r.status.replaceAll("_"," ")}</span></td><td>{risk(r)}</td><td>{score(r)||"—"}</td><td>{r.detail}</td><td>{r.rdapUrl?<a href={r.rdapUrl} target="_blank" rel="noreferrer">open ↗</a>:"—"}</td></tr>)}
      {!filtered.length&&<tr><td colSpan={6} className="empty">Enter a domain above to check it against the official .si registry.</td></tr>}</tbody></table></div>
    </section>
    <section className="card honesty"><b>What this feed can and cannot prove</b><p>Register.si RDAP can verify whether a specific .si domain is registered. It does not provide a public anonymous second-by-second stream of every new .si registration, so this dashboard will never invent “purchased” domains or fake purchase timestamps.</p></section>
    <footer>Register.si is the authoritative .si registry source. Availability is not a registration guarantee.</footer>
  </main>;
}
