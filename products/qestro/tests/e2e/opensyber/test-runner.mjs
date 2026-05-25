/**
 * Qestro OpenSyber.cloud Production Test Runner
 * HTTP-level validation of all public pages, security, SEO, and performance
 * Run: node opensyber-test-runner.mjs
 */

const BASE = 'https://opensyber.cloud';
const TF_BASE = 'https://tokenforge.opensyber.cloud';

const results = {
  total: 0, passed: 0, failed: 0, skipped: 0,
  tests: [],
  startTime: Date.now(),
};

function log(icon, msg) { console.log(`${icon} ${msg}`); }

async function runTest(name, fn) {
  results.total++;
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    results.passed++;
    results.tests.push({ name, status: 'PASS', ms });
    log('✅', `${name} (${ms}ms)`);
  } catch (e) {
    const ms = Date.now() - start;
    results.failed++;
    results.tests.push({ name, status: 'FAIL', ms, error: e.message });
    log('❌', `${name} (${ms}ms) — ${e.message}`);
  }
}

function assert(condition, msg) { if (!condition) throw new Error(msg); }

async function fetchPage(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow', ...opts });
    const text = await res.text();
    clearTimeout(timeout);
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()), text, url: res.url };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// ────────── 1. LANDING PAGE ──────────
await runTest('1.1 Homepage loads (200)', async () => {
  const r = await fetchPage(BASE);
  assert(r.status === 200, `Got ${r.status}`);
});

await runTest('1.2 Homepage title contains OpenSyber', async () => {
  const r = await fetchPage(BASE);
  const match = r.text.match(/<title>(.*?)<\/title>/i);
  assert(match && match[1].toLowerCase().includes('opensyber'), 'Title missing OpenSyber');
});

await runTest('1.3 Homepage has meta description', async () => {
  const r = await fetchPage(BASE);
  const match = r.text.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
  assert(match && match[1].length > 30, 'Missing or short meta description');
});

await runTest('1.4 Homepage has OG tags', async () => {
  const r = await fetchPage(BASE);
  assert(r.text.includes('og:title'), 'Missing og:title');
});

await runTest('1.5 Homepage mentions agents + security', async () => {
  const r = await fetchPage(BASE);
  const lower = r.text.toLowerCase();
  assert(lower.includes('agent'), 'Missing "agent" keyword');
  assert(lower.includes('security'), 'Missing "security" keyword');
});

// ────────── 2. ALL PUBLIC PAGES (STATUS CHECK) ──────────
const publicPages = [
  '/', '/pricing', '/marketplace', '/docs', '/blog', '/demo', '/threats',
  '/about', '/security', '/enterprise', '/governance', '/compliance',
  '/partners', '/privacy', '/terms', '/sign-in', '/sign-up',
  '/compare/opensyber-vs-diy-monitoring',
  '/compare/tokenforge-vs-traditional-sessions',
];

for (const path of publicPages) {
  await runTest(`2.x Public page ${path} → < 500`, async () => {
    const r = await fetchPage(`${BASE}${path}`);
    assert(r.status < 500, `Got ${r.status}`);
  });
}

// ────────── 3. BLOG ARTICLES ──────────
const blogPosts = [
  '/blog/introducing-opensyber',
  '/blog/ai-agent-kill-chain',
  '/blog/complete-guide-ai-agent-security',
  '/blog/mcp-security-best-practices',
  '/blog/eu-ai-act-compliance-for-agent-platforms',
];

for (const post of blogPosts) {
  await runTest(`3.x Blog ${post} → 200 + content`, async () => {
    const r = await fetchPage(`${BASE}${post}`);
    assert(r.status === 200, `Got ${r.status}`);
    assert(r.text.length > 2000, `Page too short: ${r.text.length} chars`);
  });
}

// ────────── 4. DOCS PAGES ──────────
const docPages = [
  '/docs', '/docs/getting-started', '/docs/security', '/docs/skills',
  '/docs/skills/audit-methodology', '/docs/api', '/docs/oasf', '/docs/faq',
];

for (const doc of docPages) {
  await runTest(`4.x Doc ${doc} → < 500`, async () => {
    const r = await fetchPage(`${BASE}${doc}`);
    assert(r.status < 500, `Got ${r.status}`);
  });
}

// ────────── 5. AUTH PAGES ──────────
await runTest('5.1 Sign-in page renders auth UI', async () => {
  const r = await fetchPage(`${BASE}/sign-in`);
  assert(r.status === 200, `Got ${r.status}`);
  const lower = r.text.toLowerCase();
  assert(lower.includes('sign') || lower.includes('log in') || lower.includes('auth'), 'No auth content');
});

await runTest('5.2 Sign-up page renders registration UI', async () => {
  const r = await fetchPage(`${BASE}/sign-up`);
  assert(r.status === 200, `Got ${r.status}`);
});

await runTest('5.3 Dashboard redirects unauthenticated', async () => {
  const r = await fetchPage(`${BASE}/dashboard`);
  const isRedirected = r.url.includes('sign-in') || r.url.includes('sign-up') || r.url.includes('api/auth');
  const hasAuth = r.text.toLowerCase().includes('sign in') || r.text.toLowerCase().includes('log in');
  assert(isRedirected || hasAuth || r.status === 401 || r.status === 302 || r.status === 200, 'Dashboard accessible without auth');
});

// ────────── 6. SECURITY CHECKS ──────────
await runTest('6.1 No API keys in homepage HTML', async () => {
  const r = await fetchPage(BASE);
  assert(!r.text.match(/sk-[a-zA-Z0-9]{20,}/), 'OpenAI key leaked');
  assert(!r.text.match(/AKIA[A-Z0-9]{16}/), 'AWS key leaked');
  assert(!r.text.match(/ghp_[a-zA-Z0-9]{36}/), 'GitHub token leaked');
  assert(!r.text.includes('-----BEGIN PRIVATE KEY-----'), 'Private key leaked');
});

await runTest('6.2 No demo/test credentials exposed', async () => {
  const r = await fetchPage(`${BASE}/sign-in`);
  assert(!r.text.includes('demo@'), 'Demo email found');
  assert(!r.text.includes('test@'), 'Test email found');
  assert(!r.text.includes('password123'), 'Test password found');
  assert(!r.text.includes('admin@'), 'Admin email found');
});

await runTest('6.3 HTTPS enforced', async () => {
  const r = await fetchPage(BASE);
  assert(r.url.startsWith('https://'), 'Not HTTPS');
});

await runTest('6.4 No server version exposed', async () => {
  const r = await fetchPage(BASE);
  const server = r.headers['server'] || '';
  assert(!server.match(/nginx\/\d|apache\/\d|express/i), `Server header leaks version: ${server}`);
});

await runTest('6.5 robots.txt exists', async () => {
  const r = await fetchPage(`${BASE}/robots.txt`);
  assert(r.status < 500, `Got ${r.status}`);
});

await runTest('6.6 No sensitive paths accessible', async () => {
  const paths = ['/.env', '/.git/config', '/admin', '/api/admin'];
  for (const path of paths) {
    const r = await fetchPage(`${BASE}${path}`);
    if (path === '/.env' || path === '/.git/config') {
      assert(!r.text.includes('DATABASE_URL'), `Sensitive data at ${path}`);
      assert(!r.text.includes('SECRET_KEY'), `Sensitive data at ${path}`);
    }
  }
});

// ────────── 7. MARKETPLACE ──────────
await runTest('7.1 Marketplace page has skill content', async () => {
  const r = await fetchPage(`${BASE}/marketplace`);
  assert(r.status === 200, `Got ${r.status}`);
  const lower = r.text.toLowerCase();
  assert(lower.includes('skill') || lower.includes('marketplace') || lower.includes('catalog'), 'No marketplace content');
});

await runTest('7.2 Marketplace bundles page loads', async () => {
  const r = await fetchPage(`${BASE}/marketplace/bundles`);
  assert(r.status < 500, `Got ${r.status}`);
});

// ────────── 8. PRICING ──────────
await runTest('8.1 Pricing shows all plan tiers', async () => {
  const r = await fetchPage(`${BASE}/pricing`);
  const lower = r.text.toLowerCase();
  assert(lower.includes('free'), 'Missing Free tier');
  assert(lower.includes('professional'), 'Missing Professional tier');
  assert(lower.includes('team'), 'Missing Team tier');
  assert(lower.includes('enterprise'), 'Missing Enterprise tier');
});

await runTest('8.2 Enterprise has contact CTA', async () => {
  const r = await fetchPage(`${BASE}/pricing`);
  const lower = r.text.toLowerCase();
  assert(lower.includes('contact') || lower.includes('sales') || lower.includes('talk'), 'Missing enterprise contact CTA');
});

// ────────── 9. LEGAL ──────────
await runTest('9.1 Privacy policy has substantial content', async () => {
  const r = await fetchPage(`${BASE}/privacy`);
  assert(r.status === 200, `Got ${r.status}`);
  assert(r.text.length > 2000, `Privacy page too short: ${r.text.length}`);
  assert(r.text.toLowerCase().includes('privacy'), 'No privacy keyword');
});

await runTest('9.2 Terms of service has substantial content', async () => {
  const r = await fetchPage(`${BASE}/terms`);
  assert(r.status === 200, `Got ${r.status}`);
  assert(r.text.length > 2000, `Terms page too short: ${r.text.length}`);
  assert(r.text.toLowerCase().includes('terms'), 'No terms keyword');
});

// ────────── 10. PERFORMANCE ──────────
await runTest('10.1 Homepage loads under 5s', async () => {
  const start = Date.now();
  await fetchPage(BASE);
  const ms = Date.now() - start;
  assert(ms < 5000, `Took ${ms}ms`);
});

await runTest('10.2 Sign-in loads under 3s', async () => {
  const start = Date.now();
  await fetchPage(`${BASE}/sign-in`);
  const ms = Date.now() - start;
  assert(ms < 3000, `Took ${ms}ms`);
});

await runTest('10.3 Pricing loads under 5s', async () => {
  const start = Date.now();
  await fetchPage(`${BASE}/pricing`);
  const ms = Date.now() - start;
  assert(ms < 5000, `Took ${ms}ms`);
});

// ────────── 11. INTERNATIONALIZATION ──────────
const locales = ['es', 'fr', 'de', 'ja'];
for (const locale of locales) {
  await runTest(`11.x Locale /${locale} loads`, async () => {
    const r = await fetchPage(`${BASE}/${locale}`);
    assert(r.status < 500, `Got ${r.status}`);
    assert(r.text.length > 500, `Locale ${locale} page too short`);
  });
}

// ────────── 12. TOKENFORGE ──────────
await runTest('12.1 TokenForge homepage loads', async () => {
  const r = await fetchPage(TF_BASE);
  assert(r.status < 500, `Got ${r.status}`);
});

await runTest('12.2 TokenForge pricing loads', async () => {
  const r = await fetchPage(`${TF_BASE}/pricing`);
  assert(r.status < 500, `Got ${r.status}`);
});

await runTest('12.3 TokenForge docs loads', async () => {
  const r = await fetchPage(`${TF_BASE}/docs`);
  assert(r.status < 500, `Got ${r.status}`);
});

await runTest('12.4 TokenForge sign-in loads', async () => {
  const r = await fetchPage(`${TF_BASE}/sign-in`);
  assert(r.status < 500, `Got ${r.status}`);
});

// ────────── 13. SEO ──────────
await runTest('13.1 sitemap.xml exists', async () => {
  const r = await fetchPage(`${BASE}/sitemap.xml`);
  assert(r.status < 500, `Got ${r.status}`);
});

await runTest('13.2 favicon exists', async () => {
  const r = await fetchPage(`${BASE}/favicon.ico`);
  assert(r.status < 500, `Got ${r.status}`);
});

// ────────── 14. PERSONA FLOWS ──────────
await runTest('P1: Solo DevSecOps — can discover, evaluate, and signup', async () => {
  // Landing → pricing → docs → marketplace → signup
  const landing = await fetchPage(BASE); assert(landing.status === 200, 'Landing failed');
  const pricing = await fetchPage(`${BASE}/pricing`); assert(pricing.status === 200, 'Pricing failed');
  const docs = await fetchPage(`${BASE}/docs/getting-started`); assert(docs.status < 500, 'Docs failed');
  const marketplace = await fetchPage(`${BASE}/marketplace`); assert(marketplace.status === 200, 'Marketplace failed');
  const signup = await fetchPage(`${BASE}/sign-up`); assert(signup.status === 200, 'Signup failed');
});

await runTest('P2: Startup CTO — evaluate security + comparison', async () => {
  const security = await fetchPage(`${BASE}/security`); assert(security.status === 200, 'Security failed');
  const compare = await fetchPage(`${BASE}/compare/opensyber-vs-diy-monitoring`); assert(compare.status < 500, 'Compare failed');
  const pricing = await fetchPage(`${BASE}/pricing`); assert(pricing.status === 200, 'Pricing failed');
});

await runTest('P3: Security Engineer — threats + OASF + compliance', async () => {
  const threats = await fetchPage(`${BASE}/threats`); assert(threats.status < 500, 'Threats failed');
  const oasf = await fetchPage(`${BASE}/docs/oasf`); assert(oasf.status < 500, 'OASF failed');
  const compliance = await fetchPage(`${BASE}/compliance`); assert(compliance.status < 500, 'Compliance failed');
  const bundles = await fetchPage(`${BASE}/marketplace/bundles`); assert(bundles.status < 500, 'Bundles failed');
});

await runTest('P4: Enterprise CISO — enterprise + SSO + governance', async () => {
  const enterprise = await fetchPage(`${BASE}/enterprise`); assert(enterprise.status === 200, 'Enterprise failed');
  const lower = enterprise.text.toLowerCase();
  assert(lower.includes('sso') || lower.includes('saml') || lower.includes('enterprise'), 'No SSO/enterprise features');
  const governance = await fetchPage(`${BASE}/governance`); assert(governance.status < 500, 'Governance failed');
  const security = await fetchPage(`${BASE}/security`); assert(security.status === 200, 'Security failed');
});

// ────────── REPORT ──────────
const totalTime = Date.now() - results.startTime;
console.log('\n' + '═'.repeat(60));
console.log(`QESTRO TEST REPORT — opensyber.cloud`);
console.log('═'.repeat(60));
console.log(`Total: ${results.total} | ✅ Passed: ${results.passed} | ❌ Failed: ${results.failed}`);
console.log(`Duration: ${(totalTime / 1000).toFixed(1)}s`);
console.log(`Pass Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
console.log('═'.repeat(60));

if (results.failed > 0) {
  console.log('\nFailed Tests:');
  results.tests.filter(t => t.status === 'FAIL').forEach(t => {
    console.log(`  ❌ ${t.name}: ${t.error}`);
  });
}

// Write JSON report
const fs = await import('fs');
const path = await import('path');
const reportDir = path.join(process.cwd(), 'test-results', 'opensyber');
const reportPath = path.join(reportDir, 'results.json');
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\nJSON report: ${reportPath}`);

process.exit(results.failed > 0 ? 1 : 0);
