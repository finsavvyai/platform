/**
 * Qestro UI Verification Script
 * Tests that the frontend API integration works correctly
 * Run: node verify-ui.mjs
 */

const API_BASE = 'http://localhost:3000';
const BACKEND = 'http://localhost:3020';

const results = { total: 0, passed: 0, failed: 0, tests: [] };

async function test(name, fn) {
  results.total++;
  try {
    await fn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`✅ ${name}`);
  } catch (e) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: e.message });
    console.log(`❌ ${name} — ${e.message}`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ─── Backend Health ─────────────────────────────────────────
await test('Backend is healthy', async () => {
  const r = await fetch(`${BACKEND}/health`);
  const d = await r.json();
  assert(d.status === 'healthy', `Status: ${d.status}`);
});

// ─── Test Cases API via Proxy ───────────────────────────────
await test('Frontend proxy → /api/test-cases returns data', async () => {
  const r = await fetch(`${API_BASE}/api/test-cases`);
  const d = await r.json();
  assert(d.success === true, 'success not true');
  assert(d.data.length > 0, 'No test cases returned');
});

await test('57 OpenSyber test cases are seeded', async () => {
  const r = await fetch(`${API_BASE}/api/test-cases?limit=100`);
  const d = await r.json();
  assert(d.total >= 57, `Only ${d.total} test cases found`);
});

await test('Test cases have correct structure', async () => {
  const r = await fetch(`${API_BASE}/api/test-cases`);
  const d = await r.json();
  const tc = d.data[0];
  assert(tc.id, 'Missing id');
  assert(tc.title || tc.name, 'Missing title/name');
  assert(tc.status, 'Missing status');
  assert(tc.priority, 'Missing priority');
  assert(tc.type, 'Missing type');
  assert(tc.projectId, 'Missing projectId');
});

await test('Test cases cover all categories', async () => {
  const r = await fetch(`${API_BASE}/api/test-cases?limit=100`);
  const d = await r.json();
  const titles = d.data.map(tc => (tc.title || tc.name).toLowerCase());
  const categories = ['homepage', 'sign-in', 'pricing', 'marketplace', 'docs', 'blog', 'tokenforge', 'privacy', 'security'];
  for (const cat of categories) {
    assert(titles.some(t => t.includes(cat)), `Missing category: ${cat}`);
  }
});

// ─── Projects API ───────────────────────────────────────────
await test('Projects API returns OpenSyber project', async () => {
  const r = await fetch(`${API_BASE}/api/projects`);
  const d = await r.json();
  assert(d.success === true, 'success not true');
  const os = d.data.find(p => p.id === 'proj-opensyber');
  assert(os, 'OpenSyber project not found');
  assert(os.name === 'OpenSyber', `Name: ${os.name}`);
});

// ─── Dashboard Stats API ────────────────────────────────────
await test('Dashboard stats returns test case count', async () => {
  const r = await fetch(`${API_BASE}/api/dashboard/stats`);
  const d = await r.json();
  assert(d.success === true, 'success not true');
  assert(d.data.testCases.total >= 57, `Only ${d.data.testCases.total} tests`);
  assert(d.data.testCases.active >= 57, `Only ${d.data.testCases.active} active`);
});

// ─── CRUD Operations ────────────────────────────────────────
await test('Create new test case via API', async () => {
  const r = await fetch(`${API_BASE}/api/test-cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'UI Verification Test Case',
      description: 'Created by verify-ui.mjs to test CRUD',
      type: 'web',
      status: 'Active',
      priority: 'Low',
      projectId: 'proj-opensyber',
      tags: ['verification'],
    }),
  });
  const d = await r.json();
  assert(d.success === true, 'Create failed');
  assert(d.data.id, 'No id returned');
  // Clean up
  await fetch(`${API_BASE}/api/test-cases/${d.data.id}`, { method: 'DELETE' });
});

await test('Run test case via API', async () => {
  // Get first test case
  const list = await fetch(`${API_BASE}/api/test-cases`);
  const ld = await list.json();
  const tc = ld.data[0];

  const r = await fetch(`${API_BASE}/api/test-cases/${tc.id}/run`, { method: 'POST' });
  const d = await r.json();
  assert(d.success === true, 'Run failed');
  assert(d.data.runId, 'No runId');
  assert(d.data.status === 'passed' || d.data.status === 'failed', `Unexpected status: ${d.data.status}`);
});

// ─── Auth Endpoints ─────────────────────────────────────────
await test('Mock login returns tokens', async () => {
  const r = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@qestro.io', password: 'test123' }),
  });
  const d = await r.json();
  assert(d.tokens?.accessToken, 'No access token');
  assert(d.tokens?.refreshToken, 'No refresh token');
  assert(d.user?.email === 'test@qestro.io', 'Wrong email');
});

await test('Mock /auth/me with valid token returns user', async () => {
  const r = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: 'Bearer mock-jwt-access-test' },
  });
  const d = await r.json();
  assert(d.email === 'test@qestro.io', `Email: ${d.email}`);
});

// ─── AI Generation Endpoint ─────────────────────────────────
await test('AI generate-test endpoint returns code', async () => {
  const r = await fetch(`${API_BASE}/api/ai/generate-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'Login to opensyber.cloud',
      framework: 'playwright',
      testType: 'e2e',
    }),
  });
  const d = await r.json();
  assert(d.success === true, 'Generation failed');
  assert(d.testCode.includes('playwright'), 'No playwright in generated code');
  assert(d.confidence > 0.5, `Low confidence: ${d.confidence}`);
});

// ─── Automation Runs ────────────────────────────────────────
await test('Automation runs endpoint responds', async () => {
  const r = await fetch(`${API_BASE}/api/automation-runs`);
  assert(r.status < 500, `Status: ${r.status}`);
});

// ─── Frontend Serves SPA ────────────────────────────────────
await test('Frontend serves HTML at /', async () => {
  const r = await fetch(`${API_BASE}/`);
  const t = await r.text();
  assert(r.status === 200, `Status: ${r.status}`);
  assert(t.includes('Qestro'), 'No Qestro in HTML');
});

await test('Frontend SPA handles /cases route', async () => {
  const r = await fetch(`${API_BASE}/cases`);
  assert(r.status === 200, `Status: ${r.status}`);
});

await test('Frontend SPA handles /dashboard route', async () => {
  const r = await fetch(`${API_BASE}/dashboard`);
  assert(r.status === 200, `Status: ${r.status}`);
});

await test('Frontend SPA handles /recording-studio route', async () => {
  const r = await fetch(`${API_BASE}/recording-studio`);
  assert(r.status === 200, `Status: ${r.status}`);
});

// ─── Report ─────────────────────────────────────────────────
console.log('\n' + '═'.repeat(50));
console.log(`QESTRO UI VERIFICATION REPORT`);
console.log('═'.repeat(50));
console.log(`Total: ${results.total} | ✅ ${results.passed} | ❌ ${results.failed}`);
console.log(`Pass Rate: ${((results.passed / results.total) * 100).toFixed(0)}%`);
console.log('═'.repeat(50));

if (results.failed > 0) {
  console.log('\nFailed:');
  results.tests.filter(t => t.status === 'FAIL').forEach(t => {
    console.log(`  ❌ ${t.name}: ${t.error}`);
  });
}

process.exit(results.failed > 0 ? 1 : 0);
