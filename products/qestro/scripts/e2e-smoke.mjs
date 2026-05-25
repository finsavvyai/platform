#!/usr/bin/env node
/**
 * Full E2E smoke — tests every page + endpoint on production.
 * Creates a fresh user, exercises every flow, reports pass/fail.
 */

const API = 'https://api.qestro.app';
const WEB = 'https://qestro.app';

let pass = 0;
let fail = 0;
const fails = [];

function log(label, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else    { fail++; fails.push(`${label} — ${detail}`); console.log(`  ✗ ${label} — ${detail}`); }
}

async function http(url, opts = {}) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, ok: r.ok, body: json ?? text, text };
}

async function main() {
  console.log('\n=== 1. FRONTEND PAGES ===');
  const pages = [
    '/', '/login', '/register', '/pricing', '/analytics',
    '/visual-regression', '/settings', '/billing', '/cases',
    '/runs', '/test-plans', '/cycles', '/recording-studio',
    '/ai-test-generation', '/test-gen-studio',
  ];
  for (const p of pages) {
    const r = await http(WEB + p);
    log(`GET ${p}`, r.status === 200, `HTTP ${r.status}`);
  }

  console.log('\n=== 2. PUBLIC API ===');
  for (const p of ['/', '/api/health', '/api/auth/providers']) {
    const r = await http(API + p);
    log(`GET ${p}`, r.status === 200, `HTTP ${r.status}`);
  }

  console.log('\n=== 3. OAUTH PROVIDERS ===');
  for (const p of ['google', 'github', 'microsoft', 'linkedin', 'discord', 'twitter']) {
    const r = await fetch(`${API}/api/auth/${p}`, { redirect: 'manual' });
    const is302 = r.status === 302;
    const is503 = r.status === 503;
    log(`/api/auth/${p}`, is302 || is503, `HTTP ${r.status} (${is302 ? 'ready' : is503 ? 'not configured' : 'broken'})`);
  }

  console.log('\n=== 4. AUTH FLOW ===');
  const email = `e2e-${Date.now()}@qestro.app`;
  let token = '';

  const reg = await http(API + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'TestPass123!', name: 'E2E User' }),
  });
  log('POST /register', (reg.status === 200 || reg.status === 201) && reg.body?.success, `HTTP ${reg.status}`);
  token = reg.body?.data?.tokens?.accessToken || '';
  log('Token returned', token.length > 50, `len=${token.length}`);

  const login = await http(API + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'TestPass123!' }),
  });
  log('POST /login', login.status === 200, `HTTP ${login.status}`);

  const me = await http(API + '/api/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  log('GET /auth/me', me.status === 200, `HTTP ${me.status}`);

  console.log('\n=== 5. PROTECTED API ===');
  const auth = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const endpoints = [
    '/api/projects', '/api/test-cases', '/api/test-plans', '/api/runs',
    '/api/cycles', '/api/dashboard/stats', '/api/insights/overview',
    '/api/missions/stats/summary', '/api/explorations',
  ];
  for (const p of endpoints) {
    const r = await http(API + p, { headers: auth });
    log(`GET ${p}`, r.status === 200, `HTTP ${r.status}`);
  }

  console.log('\n=== 6. CRUD FLOWS ===');
  const proj = await http(API + '/api/projects', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ name: 'E2E Project', description: 'auto' }),
  });
  log('POST /projects', proj.status === 201 || proj.status === 200, `HTTP ${proj.status}`);
  const projectId = proj.body?.data?.id;
  log('Project ID returned', !!projectId, `id=${projectId}`);

  if (projectId) {
    const tc = await http(API + '/api/test-cases', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ projectId, title: 'E2E Test Case', type: 'web', priority: 'high' }),
    });
    log('POST /test-cases', tc.status === 201 || tc.status === 200, `HTTP ${tc.status}`);
    const testCaseId = tc.body?.data?.id;

    const tp = await http(API + '/api/test-plans', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ projectId, name: 'E2E Plan', description: 'auto' }),
    });
    log('POST /test-plans', tp.status === 201 || tp.status === 200, `HTTP ${tp.status}`);

    const run = await http(API + '/api/runs', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ projectId, name: 'E2E Run', environment: 'staging' }),
    });
    log('POST /runs', run.status === 201 || run.status === 200, `HTTP ${run.status}`);

    const cycle = await http(API + '/api/cycles', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ projectId, name: 'E2E Cycle', description: 'auto' }),
    });
    log('POST /cycles', cycle.status === 201 || cycle.status === 200, `HTTP ${cycle.status}`);
  }

  console.log('\n=== 7. AI ENDPOINTS ===');
  const gen = await http(API + '/api/ai/generate-test', {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      description: 'Test login flow', framework: 'playwright',
      url: 'https://qestro.app/login',
    }),
  });
  log('POST /ai/generate-test', gen.status === 200 && gen.body?.success, `HTTP ${gen.status}`);
  const isRealCode = gen.body?.testCode?.includes('playwright') || gen.body?.testCode?.includes('test(');
  log('AI returns real code (not stub)', isRealCode, gen.body?.testCode?.slice(0, 60));

  const bug = await http(API + '/api/ai/analyze-failure', {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      errorMessage: 'Timeout waiting for .button', testCode: 'await page.click(".button")',
    }),
  });
  log('POST /ai/analyze-failure', bug.status === 200, `HTTP ${bug.status}`);

  console.log('\n=== 8. RECORDING ENDPOINTS ===');
  const recList = await http(API + '/api/recordings/openclaw/sessions', { headers: auth });
  log('GET /recordings/openclaw/sessions', recList.status === 200, `HTTP ${recList.status}`);

  const recStart = await http(API + '/api/recordings/openclaw/start', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ url: 'https://qestro.app', name: 'E2E Rec' }),
  });
  log('POST /recordings/openclaw/start', recStart.status === 200, `HTTP ${recStart.status}`);
  const recId = recStart.body?.data?.id;

  if (recId) {
    const recStop = await http(API + `/api/recordings/openclaw/${recId}/stop`, {
      method: 'POST', headers: auth,
    });
    log('POST /recordings/openclaw/:id/stop', recStop.status === 200, `HTTP ${recStop.status}`);
  }

  console.log('\n=== 9. OPENCLAW BRIDGE ===');
  const oc = await http(API + '/api/openclaw/status', { headers: auth });
  log('GET /openclaw/status', oc.status === 200, `HTTP ${oc.status}`);

  const ocIn = await http(API + '/api/openclaw/incoming', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ action: 'dashboard', params: {} }),
  });
  log('POST /openclaw/incoming', ocIn.status === 200 && ocIn.body?.success, `HTTP ${ocIn.status}`);

  console.log('\n=== 10. ERROR HANDLING ===');
  const noauth = await http(API + '/api/projects');
  log('Unauth blocked (401)', noauth.status === 401, `HTTP ${noauth.status}`);

  const badjson = await http(API + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid',
  });
  log('Bad JSON rejected', badjson.status >= 400 && badjson.status < 500, `HTTP ${badjson.status}`);

  const dupEmail = await http(API + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'x', name: 'x' }),
  });
  log('Duplicate email blocked', dupEmail.status >= 400 && dupEmail.status < 500, `HTTP ${dupEmail.status}`);

  console.log('\n=== RESULTS ===');
  console.log(`Pass: ${pass}`);
  console.log(`Fail: ${fail}`);
  if (fails.length) {
    console.log('\nFailures:');
    fails.forEach((f) => console.log(`  ✗ ${f}`));
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
