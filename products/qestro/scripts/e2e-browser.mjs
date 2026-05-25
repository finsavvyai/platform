#!/usr/bin/env node
/**
 * Browser smoke test — loads every page on qestro.app
 * Checks for JS errors, console errors, and visible content.
 */
import { chromium } from 'playwright';

const BASE = 'https://qestro.app';

const PAGES = [
  { path: '/', name: 'Landing' },
  { path: '/login', name: 'Login' },
  { path: '/register', name: 'Register' },
  { path: '/pricing', name: 'Pricing' },
  { path: '/privacy', name: 'Privacy' },
  { path: '/terms', name: 'Terms' },
];

const AUTH_PAGES = [
  { path: '/', name: 'Dashboard (auth)' },
  { path: '/cases', name: 'Test Cases (auth)' },
  { path: '/runs', name: 'Runs (auth)' },
  { path: '/test-plans', name: 'Test Plans (auth)' },
  { path: '/cycles', name: 'Cycles (auth)' },
  { path: '/analytics', name: 'Analytics (auth)' },
  { path: '/visual-regression', name: 'Visual Regression (auth)' },
  { path: '/recording-studio', name: 'Recording Studio (auth)' },
  { path: '/settings', name: 'Settings (auth)' },
  { path: '/billing', name: 'Billing (auth)' },
];

let pass = 0, fail = 0;
const fails = [];
const jsErrors = [];

async function testPage(page, label, path) {
  const pageErrors = [];
  const consoleErrors = [];

  const errH = (e) => pageErrors.push(e.message);
  const conH = (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); };
  page.on('pageerror', errH);
  page.on('console', conH);

  try {
    const resp = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 20_000 });
    const status = resp?.status() ?? 0;
    await page.waitForTimeout(1000);

    const title = await page.title();
    const bodyLen = (await page.textContent('body'))?.length ?? 0;

    const ok = status === 200 && bodyLen > 100 && pageErrors.length === 0;
    if (ok) {
      pass++;
      console.log(`  ✓ ${label} — ${status}, ${bodyLen}B, title="${title.slice(0, 40)}"`);
    } else {
      fail++;
      const msg = `${status}, ${bodyLen}B, ${pageErrors.length} js err`;
      fails.push(`${label}: ${msg}`);
      console.log(`  ✗ ${label} — ${msg}`);
    }

    if (pageErrors.length) {
      jsErrors.push(...pageErrors.map(e => `${label}: ${e.slice(0, 120)}`));
    }
  } catch (e) {
    fail++;
    fails.push(`${label}: ${e.message}`);
    console.log(`  ✗ ${label} — ${e.message}`);
  } finally {
    page.off('pageerror', errH);
    page.off('console', conH);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log('=== PUBLIC PAGES (no auth) ===');
  for (const p of PAGES) {
    await testPage(page, p.name, p.path);
  }

  console.log('\n=== AUTHENTICATED PAGES ===');
  // Inject fake auth
  await page.goto(BASE + '/login');
  await page.evaluate(() => {
    localStorage.setItem('qestro-auth', JSON.stringify({
      state: {
        user: { id: 'e2e', email: 'e2e@qestro.io', name: 'E2E', role: 'admin' },
        isAuthenticated: true,
      },
      version: 0,
    }));
    localStorage.setItem('access_token', 'fake-e2e-token');
  });

  for (const p of AUTH_PAGES) {
    await testPage(page, p.name, p.path);
  }

  console.log('\n=== MOBILE VIEWPORT ===');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const p of [{ path: '/', name: 'Dashboard mobile' }, { path: '/login', name: 'Login mobile' }, { path: '/cases', name: 'Cases mobile' }]) {
    await testPage(page, p.name, p.path);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    if (overflow) {
      fail++; pass--;
      fails.push(`${p.name}: horizontal overflow`);
      console.log(`  ✗ ${p.name}: horizontal overflow detected`);
    }
  }

  await browser.close();

  console.log('\n=== BROWSER RESULTS ===');
  console.log(`Pass: ${pass}`);
  console.log(`Fail: ${fail}`);
  if (fails.length) {
    console.log('\nFailures:');
    fails.forEach(f => console.log(`  ✗ ${f}`));
  }
  if (jsErrors.length) {
    console.log('\nJS errors (first 10):');
    jsErrors.slice(0, 10).forEach(e => console.log(`  ${e}`));
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
