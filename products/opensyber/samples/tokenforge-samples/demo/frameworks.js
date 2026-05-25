// ─── Framework Code Examples ───

const EXAMPLES = [
  {
    id: 'express', label: 'Express', file: 'server.ts',
    code: `<span class="cmt">// Express.js — 3 lines to add device-bound security</span>
<span class="kw">import</span> { <span class="fn">tokenForgeMiddleware</span> } <span class="kw">from</span> <span class="str">'@opensyber/tokenforge/express'</span>;

app.<span class="fn">use</span>(<span class="fn">tokenForgeMiddleware</span>({
  <span class="type">apiKey</span>: process.env.<span class="type">TOKENFORGE_API_KEY</span>,
  <span class="type">skipPaths</span>: [<span class="str">'/health'</span>],
}));

app.<span class="fn">get</span>(<span class="str">'/api/profile'</span>, (req, res) =&gt; {
  <span class="cmt">// req.tf.bound, req.tf.trustScore, req.tf.deviceId</span>
  res.<span class="fn">json</span>({ score: req.tf.trustScore });
});`
  },
  {
    id: 'nextjs', label: 'Next.js', file: 'app/api/route.ts',
    code: `<span class="cmt">// Next.js App Router — wrap any route handler</span>
<span class="kw">import</span> { <span class="fn">withTokenForge</span> } <span class="kw">from</span> <span class="str">'@opensyber/tokenforge/nextjs'</span>;

<span class="kw">async function</span> <span class="fn">handler</span>(req: Request, tf: TfContext) {
  <span class="kw">return</span> Response.<span class="fn">json</span>({
    bound: tf.bound,
    score: tf.trustScore,
  });
}

<span class="kw">export const</span> <span class="type">GET</span> = <span class="fn">withTokenForge</span>(handler, {
  <span class="type">apiKey</span>: process.env.<span class="type">TOKENFORGE_API_KEY</span>!,
});`
  },
  {
    id: 'hono', label: 'Hono', file: 'worker.ts',
    code: `<span class="cmt">// Hono / Cloudflare Workers</span>
<span class="kw">import</span> { <span class="fn">tokenForgeMiddleware</span> } <span class="kw">from</span> <span class="str">'@opensyber/tokenforge/hono'</span>;

app.<span class="fn">use</span>(<span class="str">'/api/*'</span>, <span class="fn">tokenForgeMiddleware</span>({
  <span class="type">apiKey</span>: env.<span class="type">TOKENFORGE_API_KEY</span>,
}));

app.<span class="fn">get</span>(<span class="str">'/api/profile'</span>, (c) =&gt; {
  <span class="kw">const</span> tf = c.<span class="fn">get</span>(<span class="str">'tf'</span>);
  <span class="kw">return</span> c.<span class="fn">json</span>({ score: tf.trustScore });
});`
  },
  {
    id: 'react', label: 'React', file: 'App.tsx',
    code: `<span class="cmt">// React — auto-signs every fetch() call</span>
<span class="kw">import</span> { <span class="fn">TokenForgeProvider</span>, <span class="fn">useTokenForge</span> }
  <span class="kw">from</span> <span class="str">'@opensyber/tokenforge/react'</span>;

<span class="kw">function</span> <span class="fn">App</span>() {
  <span class="kw">return</span> (
    &lt;<span class="type">TokenForgeProvider</span>
      <span class="type">sessionId</span>={session.id}
      <span class="type">isSignedIn</span>={!!session}
      <span class="type">apiBase</span>=<span class="str">"/api"</span>&gt;
      &lt;<span class="type">Dashboard</span> /&gt;
    &lt;/<span class="type">TokenForgeProvider</span>&gt;
  );
}`
  },
  {
    id: 'python', label: 'Python', file: 'app.py',
    code: `<span class="cmt"># Python — auto-signing requests session</span>
<span class="kw">from</span> tokenforge <span class="kw">import</span> <span class="type">TokenForge</span>

tf = <span class="type">TokenForge</span>(api_key=<span class="str">"tf_your_key"</span>)
session = tf.<span class="fn">session</span>()

<span class="cmt"># Every request is now signed with ECDSA P-256</span>
resp = session.<span class="fn">get</span>(<span class="str">"https://api.example.com/data"</span>)
<span class="fn">print</span>(resp.<span class="fn">json</span>())`
  },
  {
    id: 'go', label: 'Go', file: 'main.go',
    code: `<span class="cmt">// Go — auto-signing HTTP client</span>
client, _ := tokenforge.<span class="fn">NewClient</span>(<span class="str">"tf_your_key"</span>, <span class="str">""</span>)

<span class="cmt">// RoundTripper signs every outbound request</span>
http := &amp;http.<span class="type">Client</span>{
  <span class="type">Transport</span>: client.<span class="fn">RoundTripper</span>(),
}
resp, _ := http.<span class="fn">Get</span>(<span class="str">"https://api.example.com/data"</span>)`
  },
  {
    id: 'swift', label: 'Swift', file: 'App.swift',
    code: `<span class="cmt">// Swift/iOS — Keychain + CryptoKit</span>
<span class="kw">let</span> tf = <span class="type">TokenForge</span>(apiKey: <span class="str">"tf_your_key"</span>)

<span class="cmt">// Bind device on login</span>
<span class="kw">try await</span> tf.<span class="fn">bind</span>()

<span class="cmt">// Auto-sign all URLSession requests</span>
tf.<span class="fn">registerInterceptor</span>()`
  },
  {
    id: 'kotlin', label: 'Kotlin', file: 'App.kt',
    code: `<span class="cmt">// Kotlin/Android — AndroidKeyStore</span>
<span class="kw">val</span> tf = <span class="type">TokenForge</span>(apiKey = <span class="str">"tf_your_key"</span>)

<span class="cmt">// OkHttp client with auto-signing interceptor</span>
<span class="kw">val</span> client = tf.<span class="fn">okHttpClient</span>()
<span class="kw">val</span> response = client.<span class="fn">newCall</span>(request).<span class="fn">execute</span>()`
  },
];

const FRAMEWORKS = [
  { icon: '⚡', name: 'Express', type: 'Node.js' },
  { icon: '▲', name: 'Next.js', type: 'React' },
  { icon: '🔥', name: 'Hono', type: 'Edge' },
  { icon: '🚀', name: 'Fastify', type: 'Node.js' },
  { icon: '⚛️', name: 'React', type: 'Browser' },
  { icon: '🐍', name: 'Python', type: 'Server' },
  { icon: '🐹', name: 'Go', type: 'Server' },
  { icon: '🍎', name: 'Swift', type: 'iOS' },
  { icon: '🤖', name: 'Kotlin', type: 'Android' },
  { icon: '📱', name: 'React Native', type: 'Mobile' },
  { icon: '🧠', name: 'MCP', type: 'AI Agents' },
  { icon: '🔌', name: 'Proxy', type: 'Zero-Code' },
];

let activeTab = 'express';

function renderTabs() {
  const el = document.getElementById('tabs');
  el.innerHTML = EXAMPLES.map(e =>
    `<button class="tab-btn ${e.id === activeTab ? 'active' : ''}" data-id="${e.id}">${e.label}</button>`
  ).join('');
  el.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => { activeTab = btn.dataset.id; renderTabs(); renderCode(); });
  });
}

function renderCode() {
  const ex = EXAMPLES.find(e => e.id === activeTab);
  document.getElementById('code-filename').textContent = ex.file;
  document.getElementById('code-body').innerHTML = ex.code;
}

function renderGrid() {
  const el = document.getElementById('fw-grid');
  el.innerHTML = FRAMEWORKS.map(f => `
    <div class="fw-card">
      <div class="fw-icon">${f.icon}</div>
      <div class="fw-name">${f.name}</div>
      <div class="fw-type">${f.type}</div>
    </div>
  `).join('');
}

renderTabs();
renderCode();
renderGrid();
