package api

import "net/http"

// latencyPageHTML is an Apple-HIG status card page that polls the
// public /health/latency endpoint every 5 seconds. Served inline by
// the API so the marketing promise ("sub-50ms, publicly measured")
// has a URL to link to before the main marketing site catches up.
const latencyPageHTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AMLIQ — Live latency</title>
<meta name="color-scheme" content="light dark">
<style>
:root{--ink:#0A2540;--sky:#0066CC;--signal:#F59E0B;--clear:#10B981;
 --mist:#F5F7FA;--graphite:#1C1C1E;--muted:#6B7280;--line:#E5E7EB;}
@media(prefers-color-scheme:dark){:root{--ink:#F5F7FA;--mist:#1C1C1E;
 --line:#2C2C2E;--muted:#8E8E93;}}
*{box-sizing:border-box}html,body{margin:0;background:var(--mist);
 color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,
 "SF Pro Display","Inter",sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:860px;margin:0 auto;padding:48px 24px}
h1{font-size:32px;font-weight:600;letter-spacing:-0.02em;margin:0 0 4px}
p.sub{color:var(--muted);margin:0 0 32px;font-size:15px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
 gap:16px}
.card{background:var(--mist);border:1px solid var(--line);
 border-radius:14px;padding:20px 22px;transition:transform .2s}
.card:hover{transform:translateY(-1px)}
.k{font-size:13px;text-transform:uppercase;letter-spacing:0.06em;
 color:var(--muted);font-weight:500}
.v{font-size:40px;font-weight:600;letter-spacing:-0.02em;
 font-variant-numeric:tabular-nums;margin-top:6px}
.unit{font-size:18px;color:var(--muted);font-weight:500;margin-left:4px}
.good{color:var(--clear)}.warn{color:var(--signal)}
.meta{margin-top:32px;font-size:12px;color:var(--muted)}
a{color:var(--sky);text-decoration:none}
footer{margin-top:48px;padding-top:24px;border-top:1px solid var(--line);
 font-size:13px;color:var(--muted)}
</style></head><body><div class="wrap">
<h1>Live screening latency</h1>
<p class="sub">Rolling percentiles across the last 10,000 production
  screens. Updated every 5 seconds. Public. No auth.</p>
<div class="grid">
  <div class="card"><div class="k">p50</div>
    <div class="v" id="p50">—<span class="unit">ms</span></div></div>
  <div class="card"><div class="k">p95</div>
    <div class="v" id="p95">—<span class="unit">ms</span></div></div>
  <div class="card"><div class="k">p99</div>
    <div class="v" id="p99">—<span class="unit">ms</span></div></div>
  <div class="card"><div class="k">average</div>
    <div class="v" id="avg">—<span class="unit">ms</span></div></div>
  <div class="card"><div class="k">throughput</div>
    <div class="v" id="rps">—<span class="unit">/sec</span></div></div>
  <div class="card"><div class="k">total screens</div>
    <div class="v" id="total">—</div></div>
</div>
<div class="meta">Source: <a href="/health/latency">/health/latency</a> ·
  <span id="age">just now</span></div>
<footer>AMLIQ — Clarity at every transaction.</footer>
</div>
<script>
const cls=(el,ms)=>{el.classList.remove('good','warn');
  if(ms<=50)el.classList.add('good');else if(ms>200)el.classList.add('warn');};
async function tick(){try{
  const r=await fetch('/health/latency',{cache:'no-store'});
  const j=await r.json();const d=j.data||j;
  const set=(id,n,check)=>{const el=document.getElementById(id);
    el.firstChild.nodeValue=String(n);if(check)cls(el,n);};
  set('p50',d.p50_latency_ms,true);set('p95',d.p95_latency_ms,true);
  set('p99',d.p99_latency_ms,true);set('avg',d.avg_latency_ms,true);
  set('rps',d.screenings_per_second.toFixed(1),false);
  set('total',d.screenings_total.toLocaleString(),false);
  document.getElementById('age').textContent=new Date().toLocaleTimeString();
}catch(e){document.getElementById('age').textContent='fetch failed';}}
tick();setInterval(tick,5000);
</script></body></html>`

func latencyPage(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=60")
	_, _ = w.Write([]byte(latencyPageHTML))
}
