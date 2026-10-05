import { NextRequest, NextResponse } from "next/server";

const endpoint = "https://rdap.register.si/";
const clean = (v: string) => v.trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/.*$/,"").replace(/\.si$/,"").replace(/[^a-z0-9-]/g,"").replace(/-+/g,"-").replace(/^-+|-+$/g,"");

type CheckResult={input:string;domain:string;status:string;detail:string;rdapUrl?:string};

async function rdapFetch(url:string){
  const headers:Record<string,string>={"User-Agent":"si-domain-intelligence-dashboard/1.0","Accept":"application/rdap+json, application/json"};
  const user=process.env.REGISTER_SI_USERNAME;
  const pass=process.env.REGISTER_SI_PASSWORD;
  if(user && pass) headers.Authorization="Basic "+Buffer.from(user+":"+pass).toString("base64");
  return fetch(url,{headers,cache:"no-store"});
}

async function check(input:string):Promise<CheckResult>{
  const label=clean(input),domain=label+".si";
  if(!label||label.length<2||label.length>63)return{input,domain,status:"INVALID",detail:"Invalid domain label"};
  const url=endpoint+"domain/"+encodeURIComponent(domain);
  for(let i=0;i<4;i++){
    try{
      const r=await rdapFetch(url);
      if(r.status===404)return{input,domain,status:"LIKELY_AVAILABLE",detail:"Register.si RDAP 404; verify at registrar",rdapUrl:url};
      if(r.status===200||r.status===401)return{input,domain,status:"REGISTERED_OR_UNAVAILABLE",detail:"Register.si RDAP HTTP "+r.status,rdapUrl:url};
      if(r.status===429||r.status>=500){await new Promise(x=>setTimeout(x,500*2**i));continue;}
      return{input,domain,status:"CHECK_MANUALLY",detail:"Register.si RDAP HTTP "+r.status,rdapUrl:url};
    }catch{
      if(i===3)return{input,domain,status:"CHECK_FAILED",detail:"Register.si RDAP connection failed",rdapUrl:url};
      await new Promise(x=>setTimeout(x,500*2**i));
    }
  }
  return{input,domain,status:"CHECK_FAILED",detail:"Retry limit reached",rdapUrl:url};
}

function extractDomains(data:unknown):string[]{
  if(!data||typeof data!=="object")return[];
  const o=data as Record<string,unknown>;
  const candidates=[o.domainSearchResults,o.domains,o.results];
  for(const value of candidates){
    if(Array.isArray(value)){
      return value.flatMap((item)=>{
        if(typeof item==="string")return[item];
        if(item&&typeof item==="object"){
          const x=item as Record<string,unknown>;
          if(typeof x.ldhName==="string")return[x.ldhName];
          if(typeof x.domain==="string")return[x.domain];
          if(typeof x.href==="string"){try{return[new URL(x.href).pathname.split("/").pop()||""]}catch{return[]}}
          if(Array.isArray(x.links))return x.links.flatMap((l)=>{
            if(l&&typeof l==="object"&&typeof (l as Record<string,unknown>).href==="string"){try{return[new URL((l as Record<string,string>).href).pathname.split("/").pop()||""]}catch{return[]}}
            return[];
          });
        }
        return[];
      }).map(x=>x.toLowerCase()).filter(x=>x.endsWith(".si"));
    }
  }
  return[];
}

export async function POST(req:NextRequest){
  try{
    const body:unknown=await req.json();
    if(typeof body!=="object"||body===null||!("names" in body)||!Array.isArray((body as {names:unknown}).names))
      return NextResponse.json({error:"names must be an array"},{status:400});
    const names=(body as {names:unknown[]}).names.map(v=>String(v).trim()).filter(Boolean).slice(0,500);
    const results:CheckResult[]=await Promise.all(names.map(check));
    return NextResponse.json({results});
  }catch{return NextResponse.json({error:"Invalid request"},{status:400});}
}

export async function GET(req:NextRequest){
  const username=process.env.REGISTER_SI_USERNAME;
  const password=process.env.REGISTER_SI_PASSWORD;
  if(!username||!password)
    return NextResponse.json({configured:false,error:"Register.si authenticated access is not configured. Add REGISTER_SI_USERNAME and REGISTER_SI_PASSWORD in Vercel."},{status:503});

  const cursor=req.nextUrl.searchParams.get("cursor");
  const pattern=req.nextUrl.searchParams.get("pattern")||"*.si";
  const url=new URL(endpoint+"domains");
  url.searchParams.set("name",pattern);
  if(cursor)url.searchParams.set("cursor",cursor);

  try{
    const r=await rdapFetch(url.toString());
    const text=await r.text();
    if(!r.ok)return NextResponse.json({configured:true,status:r.status,error:"Register.si bulk RDAP returned HTTP "+r.status,raw:text.slice(0,1000)},{status:r.status});
    let data:unknown;
    try{data=JSON.parse(text)}catch{return NextResponse.json({configured:true,error:"Register.si returned non-JSON data"},{status:502});}
    const domains=extractDomains(data);
    const next=(data&&typeof data==="object")?((data as Record<string,unknown>).next||null):null;
    return NextResponse.json({configured:true,source:"Register.si authenticated RDAP",pattern,count:domains.length,domains,next});
  }catch{return NextResponse.json({configured:true,error:"Could not reach Register.si authenticated RDAP"},{status:502});}
}
