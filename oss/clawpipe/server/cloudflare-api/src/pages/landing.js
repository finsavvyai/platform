/** Landing page HTML template — Apple HIG design with product navigation. */

export const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FinSavvyAI — AI Gateway</title>
<style>
:root {
  --blue: #007AFF; --green: #34C759; --purple: #AF52DE; --orange: #FF9500; --teal: #30B0C7;
  --bg: #F2F2F7; --bg-card: #FFFFFF; --bg-nav: rgba(255,255,255,0.72);
  --text: #000; --text-sec: #3C3C43; --text-ter: #8E8E93;
  --sep: #C6C6C8; --shadow: 0 4px 12px rgba(0,0,0,0.08);
  --r-card: 16px; --r-btn: 12px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000; --bg-card: #1C1C1E; --bg-nav: rgba(28,28,30,0.72);
    --text: #FFF; --text-sec: #EBEBF5; --text-ter: #8E8E93;
    --sep: #38383A; --shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
}
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
  background: var(--bg); color: var(--text); min-height: 100vh;
}
nav {
  position: sticky; top: 0; z-index: 100; padding: 12px 24px;
  background: var(--bg-nav); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-bottom: 0.5px solid var(--sep); display: flex; align-items: center; gap: 24px;
}
nav .brand { font-size: 17px; font-weight: 700; flex-shrink: 0; }
nav .links { display: flex; gap: 16px; flex: 1; }
nav a { color: var(--blue); text-decoration: none; font-size: 15px; font-weight: 500; min-height: 36px; display: flex; align-items: center; }
nav a:hover { opacity: 0.8; }
nav .auth-area { font-size: 13px; color: var(--text-ter); display: flex; align-items: center; gap: 8px; }
nav .auth-area a { font-size: 13px; }
.hero {
  text-align: center; padding: 80px 24px 48px;
}
.hero h1 { font-size: 40px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 12px; }
.hero p { font-size: 20px; color: var(--text-sec); max-width: 600px; margin: 0 auto; line-height: 1.4; }
.grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px; padding: 0 24px 64px; max-width: 1000px; margin: 0 auto;
}
.card {
  background: var(--bg-card); border-radius: var(--r-card); padding: 24px;
  box-shadow: var(--shadow); cursor: pointer; text-decoration: none; color: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease; display: block;
}
.card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.12); }
.card .icon { font-size: 36px; margin-bottom: 12px; }
.card h3 { font-size: 17px; font-weight: 600; margin-bottom: 4px; }
.card p { font-size: 13px; color: var(--text-sec); line-height: 1.4; }
.card .badge {
  display: inline-block; margin-top: 12px; padding: 4px 10px;
  border-radius: 8px; font-size: 11px; font-weight: 600;
}
.b-blue { background: rgba(0,122,255,0.12); color: var(--blue); }
.b-green { background: rgba(52,199,89,0.12); color: var(--green); }
.b-purple { background: rgba(175,82,222,0.12); color: var(--purple); }
.b-orange { background: rgba(255,149,0,0.12); color: var(--orange); }
.b-teal { background: rgba(48,176,199,0.12); color: var(--teal); }
.footer {
  text-align: center; padding: 32px; color: var(--text-ter); font-size: 13px;
  border-top: 0.5px solid var(--sep);
}
</style>
</head>
<body>
<nav>
  <span class="brand">FinSavvyAI</span>
  <div class="links">
    <a href="/chat">Chat</a>
    <a href="/dashboard">Dashboard</a>
    <a href="/hub">Control Hub</a>
  </div>
  <div class="auth-area" id="auth-area">
    <a href="/login">Sign In</a>
  </div>
</nav>
<section class="hero">
  <h1>AI Gateway</h1>
  <p>Enterprise-grade LLM routing with OpenAI, Anthropic, and local models — all behind one API.</p>
</section>
<section class="grid">
  <a class="card" href="/chat">
    <div class="icon">&#x1F4AC;</div>
    <h3>Chat</h3>
    <p>Interactive AI chat interface. Send messages to any connected model in real time.</p>
    <span class="badge b-blue">Try Now</span>
  </a>
  <a class="card" href="/dashboard">
    <div class="icon">&#x1F4CA;</div>
    <h3>Dashboard</h3>
    <p>Monitor API usage, view connected providers, and track performance metrics.</p>
    <span class="badge b-green">Analytics</span>
  </a>
  <a class="card" href="/hub">
    <div class="icon">&#x1F5A5;</div>
    <h3>Control Hub</h3>
    <p>Manage cluster nodes, worker configurations, and system health across your infrastructure.</p>
    <span class="badge b-purple">Management</span>
  </a>
  <a class="card" href="/v1/models">
    <div class="icon">&#x1F916;</div>
    <h3>API</h3>
    <p>OpenAI-compatible REST API. Drop-in replacement at /v1/chat/completions.</p>
    <span class="badge b-orange">Developer</span>
  </a>
  <a class="card" href="/health">
    <div class="icon">&#x1F49A;</div>
    <h3>System Health</h3>
    <p>Real-time health status of all connected providers and services.</p>
    <span class="badge b-teal">Status</span>
  </a>
</section>
<footer class="footer">FinSavvyAI v5.0 &mdash; Powered by Cloudflare Workers</footer>
<script>
(function() {
  const name = localStorage.getItem('fsa_user_name');
  const tier = localStorage.getItem('fsa_tier');
  const el = document.getElementById('auth-area');
  if (name) {
    el.innerHTML = '<span>' + name + ' (' + (tier || 'free') + ')</span> <a href="#" id="logout-link">Sign Out</a>';
    document.getElementById('logout-link').addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/logout', { method: 'POST' });
      localStorage.removeItem('fsa_api_key');
      localStorage.removeItem('fsa_user_name');
      localStorage.removeItem('fsa_tier');
      window.location.reload();
    });
  }
})();
</script>
</body>
</html>`;
