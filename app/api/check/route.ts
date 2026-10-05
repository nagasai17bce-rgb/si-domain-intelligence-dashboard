import { NextRequest, NextResponse } from "next/server";

const endpoint = "https://rdap.register.si/domain/";
const clean = (v:string) => v.trim().toLowerCase().replace(/\.si$/,"").replace(/[^a-z0-9-]/g,"").replace(/-+/g,"-").replace(/^-+|-+$/g,"");

async function check(input:string){
  const label=clean(input), domain=label+".si";
  if(!label || label.length<2 || label.length>63) return {input,domain,status:"INVALID",detail:"Invalid domain label"};
  const url=endpoint+encodeURIComponent(domain);
  for(let i=0;i<4;i++){
    try{
      const r=await fetch(url,{method:"HEAD",headers:{"User-Agent":"si-domain-intelligence-dashboard/1.0"},cache:"no-store"});
      if(r.status===404) return {input,domain,status:"LIKELY_AVAILABLE",detail:"RDAP 404; verify at registrar",rdapUrl:url};
      if(r.status===200 || r.status===401) return {input,domain,status:"REGISTERED_OR_UNAVAILABLE",detail:"RDAP HTTP "+r.status,rdapUrl:url};
      if(r.status===429 || r.status>=500){ await new Promise(x=>setTimeout(x,500*2**i)); continue; }
      return {input,domain,status:"CHECK_MANUALLY",detail:"RDAP HTTP "+r.status,rdapUrl:url};
    }catch{
      if(i===3) return {input,domain,status:"CHECK_FAILED",detail:"RDAP connection failed",rdapUrl:url};
      await new Promise(x=>setTimeout(x,500*2**i));
    }
  }
  return {input,domain,status:"CHECK_FAILED",detail:"Retry limit reached",rdapUrl:url};
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    if(!Array.isArray(body?.names)) return NextResponse.json({error:"names must be an array"},{status:400});
    const names=[...new Set(body.names.map(String).map((x:string)=>x.trim()).filter(Boolean))].slice(0,500);
    return NextResponse.json({results:await Promise.all(names.map(check))});
  }catch{
    return NextResponse.json({error:"Invalid request"},{status:400});
  }
}
