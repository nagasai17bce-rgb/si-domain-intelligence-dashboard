"use client";

import { useEffect, useMemo, useState } from "react";

type Result = {
  input: string;
  domain: string;
  status: string;
  detail: string;
  rdapUrl?: string;
};

type FeedItem = {
  domain: string;
  seenAt: string;
};

const signalFor = (domain: string) => {
  const name = domain.replace(/\.si$/i, "");
  if (/ai|agent|voice|llm|ml/.test(name)) return "AI / Agent";
  if (/data|cloud|dev|tech|bot|lab|labs/.test(name)) return "Tech";
  if (/legal|law/.test(name)) return "LegalTech";
  return "General";
};

const scoreFor = (domain: string) => {
  const name = domain.replace(/\.si$/i, "");
  let score = 42;
  if (name.length <= 8) score += 18;
  if (name.length <= 5) score += 12;
  if (/ai|agent|voice|llm|ml|data|cloud|tech|bot|lab|legal/.test(name)) score += 18;
  return Math.min(99, score);
};

export default function Dashboard() {
  const [mode, setMode] = useState<"feed" | "check">("feed");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [configured, setConfigured] = useState(false);
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [lastSync, setLastSync] = useState("");

  async function loadFeed() {
    setFeedLoading(true);
    setFeedError("");
    try {
      const response = await fetch("/api/check?pattern=*.si", { cache: "no-store" });
      const data = await response.json();
      setConfigured(Boolean(data.configured));

      if (!response.ok) {
        setFeedError(data.error || "Registry feed unavailable");
        return;
      }

      const now = new Date().toISOString();
      setFeed((data.domains || []).map((domain: string) => ({ domain, seenAt: now })));
      setLastSync(now);
    } catch {
      setFeedError("Could not connect to the registry feed.");
    } finally {
      setFeedLoading(false);
    }
  }

  useEffect(() => {
    loadFeed();
    const timer = window.setInterval(loadFeed, 60000);
    return () => window.clearInterval(timer);
  }, []);

  async function checkDomain() {
    if (!query.trim()) return;
    setLoading(true);
    setNotice("Checking official Register.si RDAP…");

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: [query] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Check failed");

      setResults(data.results || []);
      const item = data.results?.[0];

      if (item?.status === "LIKELY_AVAILABLE") {
        setNotice("RDAP returned 404. The name appears available; confirm at a registrar before purchase.");
      } else if (item?.status === "REGISTERED_OR_UNAVAILABLE") {
        setNotice("Register.si reports this domain as registered or unavailable.");
      } else {
        setNotice("Registry check complete.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Check failed");
    } finally {
      setLoading(false);
    }
  }

  const shown = useMemo(
    () =>
      feed
        .filter((item) => item.domain.includes(filter.toLowerCase()))
        .sort((a, b) => b.seenAt.localeCompare(a.seenAt)),
    [feed, filter]
  );

  const aiSignals = feed.filter((item) => signalFor(item.domain) !== "General");
  const topOpportunities = [...aiSignals]
    .sort((a, b) => scoreFor(b.domain) - scoreFor(a.domain))
    .slice(0, 6);

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">.si</div>
          <div>
            <strong>Domain Intelligence</strong>
            <span>REGISTRY RADAR</span>
          </div>
        </div>

        <nav className="sideNav">
          <button className={mode === "feed" ? "sideActive" : ""} onClick={() => setMode("feed")}><span>◉</span> Live Feed</button>
          <button className={mode === "check" ? "sideActive" : ""} onClick={() => setMode("check")}><span>⌕</span> Domain Search</button>
          <button onClick={() => setMode("feed")}><span>▤</span> All Domains</button>
          <button onClick={() => setMode("feed")}><span>✦</span> AI Opportunities</button>
          <button onClick={() => setMode("feed")}><span>⌁</span> Analytics</button>
          <button onClick={() => setMode("feed")}><span>☆</span> Watchlist</button>
        </nav>

        <div className="sourceCard">
          <div className="sourceDot" />
          <div>
            <b>Data Source</b>
            <strong>Register.si</strong>
            <span>{configured ? "Authenticated RDAP" : "Public RDAP / setup pending"}</span>
            <small>{lastSync ? "Last sync " + new Date(lastSync).toLocaleTimeString() : "Waiting for registry data"}</small>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <div className="eyebrow">.SI REGISTRY MONITOR</div>
            <h1>.si Domain Intelligence</h1>
            <p>Real registry data, domain discovery and AI/startup opportunity signals.</p>
          </div>
          <div className="topActions">
            <div className="systemStatus"><span className={configured ? "statusDot online" : "statusDot"} />{configured ? "System online" : "Setup required"}</div>
            <button className="refreshButton" onClick={loadFeed} disabled={feedLoading}>↻ {feedLoading ? "Syncing" : "Sync now"}</button>
          </div>
        </header>

        <div className="statGrid">
          <div className="statCard"><span className="statIcon blue">◫</span><div><small>Domains in current feed</small><strong>{feed.length.toLocaleString()}</strong></div></div>
          <div className="statCard"><span className="statIcon green">↗</span><div><small>Detected this sync</small><strong>{feed.length.toLocaleString()}</strong></div></div>
          <div className="statCard"><span className="statIcon purple">✦</span><div><small>AI / startup signals</small><strong>{aiSignals.length.toLocaleString()}</strong></div></div>
          <div className="statCard"><span className="statIcon orange">◷</span><div><small>Last registry sync</small><strong className="timeStat">{lastSync ? new Date(lastSync).toLocaleTimeString() : "—"}</strong></div></div>
        </div>

        {mode === "feed" ? (
          <div className="dashboardGrid">
            <section className="panel feedPanel">
              <div className="panelHeader">
                <div>
                  <div className="liveTitle"><span className="liveDot" /> Live .si Domain Feed</div>
                  <p>Domains returned by the official registry source during the latest sync.</p>
                </div>
                <div className="panelControls"><span className="refreshLabel">Auto-refresh · 60s</span><select defaultValue="all"><option value="all">All domains</option><option value="signals">AI signals</option></select></div>
              </div>

              <div className="feedSearch"><span>⌕</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter domains…" /></div>

              {feedError ? (
                <div className="emptyState errorState"><b>Registry feed is not active</b><p>{feedError}</p><small>Direct domain checks remain available through the Domain Search tab.</small></div>
              ) : shown.length ? (
                <div className="domainTable">
                  <div className="tableHead"><span>TIME DETECTED</span><span>DOMAIN</span><span>STATUS</span><span>SIGNAL</span><span>SCORE</span></div>
                  {shown.slice(0, 500).map((item) => (
                    <div className="domainRow" key={item.domain}>
                      <span className="detectedTime">{new Date(item.seenAt).toLocaleTimeString()}</span>
                      <div className="domainName"><b>{item.domain}</b><small>Registry result</small></div>
                      <span className="registeredPill">REGISTERED</span>
                      <span className="signalPill">{signalFor(item.domain)}</span>
                      <div className="scoreWrap"><div className="scoreBar"><i style={{ width: scoreFor(item.domain) + "%" }} /></div><b>{scoreFor(item.domain)}</b></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="emptyState">
                  <div className="emptyIcon">◎</div>
                  <b>{configured ? "No domains returned by this query" : "Connect authenticated Register.si access"}</b>
                  <p>{configured ? "The registry returned an empty result for the current wildcard query." : "The public RDAP endpoint supports direct lookups. Wildcard registry discovery requires authenticated access."}</p>
                  <button onClick={() => setMode("check")}>Check a domain instead →</button>
                </div>
              )}
            </section>

            <aside className="rightRail">
              <section className="panel searchPanel">
                <div className="railTitle"><span>⌕</span> Check a .si Domain</div>
                <div className="inlineSearch">
                  <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") checkDomain(); }} placeholder="example" />
                  <span>.si</span>
                  <button onClick={checkDomain} disabled={loading || !query.trim()}>Check</button>
                </div>
                {results[0] ? (
                  <div className={"checkResult " + (results[0].status === "LIKELY_AVAILABLE" ? "available" : "registered")}>
                    <b>{results[0].status === "LIKELY_AVAILABLE" ? "✓ AVAILABLE" : "● REGISTERED / UNAVAILABLE"}</b>
                    <span>{results[0].domain}</span>
                    <small>{results[0].detail}</small>
                  </div>
                ) : <div className="searchHint">Use the official Register.si RDAP to check one domain.</div>}
              </section>

              <section className="panel opportunities">
                <div className="railTitle"><span>✦</span> AI / Startup Opportunities <small>{aiSignals.length} found</small></div>
                <p>Signals are heuristic name matches, not claims about ownership or business activity.</p>
                {topOpportunities.length ? topOpportunities.map((item) => (
                  <div className="opportunityRow" key={item.domain}><div><b>{item.domain}</b><span>{signalFor(item.domain)}</span></div><strong>{scoreFor(item.domain)}</strong></div>
                )) : <div className="miniEmpty">No opportunity signals in the current feed.</div>}
              </section>

              <section className="panel integrity">
                <div className="railTitle"><span>✓</span> Authentic Data Policy</div>
                <p>No fabricated domains, purchase timestamps or registration events. “Detected” means our collector observed the domain in a registry response.</p>
                <a href="https://www.register.si/en/rdap/" target="_blank" rel="noreferrer">View Register.si RDAP ↗</a>
              </section>
            </aside>
          </div>
        ) : (
          <section className="panel searchPage">
            <div className="railTitle">Check a .si domain</div>
            <div className="largeSearch">
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") checkDomain(); }} placeholder="example.si or example" />
              <button onClick={checkDomain} disabled={loading || !query.trim()}>{loading ? "Checking…" : "Check availability"}</button>
            </div>
            <div className="sourceLine">Source: <a href="https://www.register.si/en/rdap/" target="_blank" rel="noreferrer">Register.si RDAP</a></div>
            {notice && <div className="notice">{notice}</div>}
            {results.map((item) => (
              <div className="resultCard" key={item.domain}><b>{item.domain}</b><span className={"resultPill " + item.status.toLowerCase()}>{item.status === "LIKELY_AVAILABLE" ? "AVAILABLE" : item.status === "REGISTERED_OR_UNAVAILABLE" ? "REGISTERED / UNAVAILABLE" : item.status}</span><small>{item.detail}</small></div>
            ))}
          </section>
        )}

        <footer>Register.si is the authoritative registry for .si registration status. Availability shown by RDAP should still be confirmed with a registrar before purchase.</footer>
      </section>
    </main>
  );
}
