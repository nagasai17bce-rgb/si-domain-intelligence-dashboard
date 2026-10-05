import { NextRequest, NextResponse } from "next/server";

const endpoint = "https://rdap.register.si/domain/";
const clean = (v: string) => v.trim().toLowerCase().replace(/\.si$/, "").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");

type CheckResult = {
  input: string;
  domain: string;
  status: string;
  detail: string;
  rdapUrl?: string;
};

async function check(input: string): Promise<CheckResult> {
  const label = clean(input);
  const domain = label + ".si";
  if (!label || label.length < 2 || label.length > 63) {
    return { input, domain, status: "INVALID", detail: "Invalid domain label" };
  }
  const url = endpoint + encodeURIComponent(domain);

  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": "si-domain-intelligence-dashboard/1.0" },
        cache: "no-store"
      });

      if (r.status === 404) {
        return { input, domain, status: "LIKELY_AVAILABLE", detail: "RDAP 404; verify at registrar", rdapUrl: url };
      }
      if (r.status === 200 || r.status === 401) {
        return { input, domain, status: "REGISTERED_OR_UNAVAILABLE", detail: "RDAP HTTP " + r.status, rdapUrl: url };
      }
      if (r.status === 429 || r.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** i));
        continue;
      }
      return { input, domain, status: "CHECK_MANUALLY", detail: "RDAP HTTP " + r.status, rdapUrl: url };
    } catch {
      if (i === 3) {
        return { input, domain, status: "CHECK_FAILED", detail: "RDAP connection failed", rdapUrl: url };
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** i));
    }
  }

  return { input, domain, status: "CHECK_FAILED", detail: "Retry limit reached", rdapUrl: url };
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("names" in body) ||
      !Array.isArray((body as { names: unknown }).names)
    ) {
      return NextResponse.json({ error: "names must be an array" }, { status: 400 });
    }

    const rawNames = (body as { names: unknown[] }).names;
    const names: string[] = [...new Set(
      rawNames
        .map((value) => String(value).trim())
        .filter((value) => Boolean(value))
    )].slice(0, 500);

    const results: CheckResult[] = await Promise.all(names.map((name: string) => check(name)));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
