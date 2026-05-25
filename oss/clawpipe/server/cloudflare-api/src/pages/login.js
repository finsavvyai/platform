/** Login page HTML template — Apple HIG design. */

export const LOGIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FinSavvyAI — Sign In</title>
<style>
:root {
  --blue: #007AFF; --blue-hover: #0056CC;
  --bg: #F2F2F7; --bg-card: #FFFFFF;
  --text: #000000; --text-secondary: #3C3C43; --text-tertiary: #8E8E93;
  --separator: #C6C6C8; --fill: rgba(120,120,128,0.2);
  --shadow: 0 4px 12px rgba(0,0,0,0.08);
  --radius: 12px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000; --bg-card: #1C1C1E;
    --text: #FFFFFF; --text-secondary: #EBEBF5; --text-tertiary: #8E8E93;
    --separator: #38383A; --fill: rgba(120,120,128,0.36);
    --shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
  background: var(--bg); color: var(--text);
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh; padding: 16px;
}
.card {
  background: var(--bg-card); border-radius: 20px; padding: 40px;
  box-shadow: var(--shadow); width: 100%; max-width: 400px; text-align: center;
}
.logo { font-size: 48px; margin-bottom: 16px; }
h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
.subtitle { font-size: 15px; color: var(--text-secondary); margin-bottom: 32px; }
.input-group { text-align: left; margin-bottom: 20px; }
.input-group label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 500; }
.input-group input {
  width: 100%; padding: 12px 16px; border: 1px solid var(--separator);
  border-radius: 8px; font-size: 15px; background: var(--fill);
  color: var(--text); outline: none; transition: border-color 0.2s;
}
.input-group input:focus { border-color: var(--blue); }
.btn {
  width: 100%; padding: 14px; border: none; border-radius: 12px;
  background: var(--blue); color: #FFF; font-size: 17px; font-weight: 600;
  cursor: pointer; transition: background 0.2s; min-height: 44px;
}
.btn:hover { background: var(--blue-hover); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.error { color: #FF3B30; font-size: 13px; margin-top: 12px; display: none; }
.error.visible { display: block; }
.back { margin-top: 20px; }
.back a {
  color: var(--blue); text-decoration: none; font-size: 15px; font-weight: 500;
}
</style>
</head>
<body>
<div class="card">
  <div class="logo">&#x1F512;</div>
  <h1>FinSavvyAI</h1>
  <p class="subtitle">Sign in with your API key</p>
  <form id="login-form">
    <div class="input-group">
      <label for="api-key">API Key</label>
      <input type="password" id="api-key" placeholder="fsa_..." autocomplete="off" required>
    </div>
    <button type="submit" class="btn" id="submit-btn">Sign In</button>
    <p class="error" id="error-msg"></p>
  </form>
  <div class="back"><a href="/">&larr; Back to Home</a></div>
</div>
<script>
const form = document.getElementById('login-form');
const keyInput = document.getElementById('api-key');
const btn = document.getElementById('submit-btn');
const errEl = document.getElementById('error-msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.classList.remove('visible');
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  try {
    const resp = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: keyInput.value.trim() }),
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      localStorage.setItem('fsa_api_key', keyInput.value.trim());
      localStorage.setItem('fsa_user_name', data.name || '');
      localStorage.setItem('fsa_tier', data.tier || 'free');
      window.location.href = '/';
    } else {
      errEl.textContent = data.error || 'Authentication failed';
      errEl.classList.add('visible');
    }
  } catch (err) {
    errEl.textContent = 'Network error. Please try again.';
    errEl.classList.add('visible');
  }
  btn.disabled = false;
  btn.textContent = 'Sign In';
});
</script>
</body>
</html>`;
