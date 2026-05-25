// Luna heal harness — uses installed playwright-core, no new deps.
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.HEAL_BASE || 'http://localhost:3000';
const ITER = process.env.HEAL_ITER || '1';
const OUT = path.resolve(`.luna/mcpoverflow/browser-test/iterations/${ITER}`);

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'generate', path: '/generate' },
  { name: 'connector-detail', path: '/connector/test-id' },
  { name: 'settings', path: '/settings' },
];

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'wide', width: 1920, height: 1080 },
];

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

async function run() {
  await ensureDir(OUT);
  const cachedChromium =
    process.env.HEAL_CHROMIUM ||
    `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
  const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const execPath = existsSync(cachedChromium) ? cachedChromium : systemChrome;
  const browser = await chromium.launch({ headless: true, executablePath: execPath });
  const report = { iteration: Number(ITER), base: BASE, routes: [] };

  for (const route of ROUTES) {
    const routeResult = { name: route.name, path: route.path, viewports: [] };
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const failedReqs = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 400));
      });
      page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 400)));
      page.on('requestfailed', (r) => {
        const u = r.url();
        if (u.startsWith(BASE)) failedReqs.push({ url: u, err: r.failure()?.errorText || '' });
      });

      let nav = { ok: true, status: 0, error: null };
      try {
        const resp = await page.goto(BASE + route.path, { waitUntil: 'networkidle', timeout: 15000 });
        nav.status = resp ? resp.status() : 0;
        nav.ok = resp ? resp.ok() : false;
      } catch (e) {
        nav.ok = false;
        nav.error = String(e.message).slice(0, 300);
      }

      // Give SPA a beat for client routing/render
      await page.waitForTimeout(800);

      // Layout/content probes
      const probe = await page.evaluate(() => {
        const body = document.body;
        const doc = document.documentElement;
        const scrollW = Math.max(doc.scrollWidth, body.scrollWidth);
        const clientW = doc.clientWidth;
        const text = (body.innerText || '').trim();
        const imgs = Array.from(document.images);
        const brokenImgs = imgs
          .filter((i) => i.complete && i.naturalWidth === 0)
          .map((i) => i.currentSrc || i.src);
        const hasNotFound = /404|not found|page not found/i.test(text);
        const hasErrorBoundary = /something went wrong|error boundary|unexpected error/i.test(text);
        const rootEmpty = !document.getElementById('root')?.children.length;
        const focusable = document.querySelectorAll('a, button, input, select, textarea, [tabindex]').length;

        // Detect wrapping in the top-level header nav. A link/button "wraps" when the
        // text node it owns is broken across multiple line boxes. We isolate the text
        // by walking to a descendant element whose only children are text nodes
        // (skipping wrappers that mix icons + text), then range-measure it.
        const headerWraps = [];
        const headerEl = document.querySelector('header');
        if (headerEl) {
          const links = headerEl.querySelectorAll('a, button');
          links.forEach((el) => {
            const txt = (el.textContent || '').trim();
            if (!txt || txt.length > 24) return;
            // Find a descendant that is text-only.
            let textOnly = null;
            const walk = (node) => {
              if (textOnly) return;
              const kids = Array.from(node.childNodes);
              const onlyText = kids.length > 0 && kids.every((k) => k.nodeType === 3);
              if (onlyText && (node.textContent || '').trim()) {
                textOnly = node;
                return;
              }
              for (const k of node.children) walk(k);
            };
            walk(el);
            const target = textOnly || el;
            const range = document.createRange();
            try {
              range.selectNodeContents(target);
              const rects = Array.from(range.getClientRects()).filter(
                (r) => r.height > 2 && r.width > 2
              );
              if (rects.length > 1) headerWraps.push(txt.slice(0, 24));
            } catch {}
            range.detach && range.detach();
          });
        }

        return {
          scrollW,
          clientW,
          horizOverflow: scrollW - clientW > 4,
          textLen: text.length,
          brokenImgs,
          hasNotFound,
          hasErrorBoundary,
          rootEmpty,
          focusable,
          headerWraps,
          title: document.title,
          url: location.pathname + location.search,
        };
      });

      // Focus-ring probe: tab to first focusable element, capture outline/box-shadow.
      let focusRing = { ok: false, has: '', tag: '' };
      try {
        await page.keyboard.press('Tab');
        focusRing = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return { ok: false, has: '', tag: '' };
          const cs = getComputedStyle(el);
          const ring =
            (cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px' && cs.outlineColor) ||
            (cs.boxShadow && cs.boxShadow !== 'none' && cs.boxShadow);
          return {
            ok: Boolean(ring),
            has: String(ring || '').slice(0, 80),
            tag: el.tagName + (el.getAttribute('href') ? `[href=${el.getAttribute('href')}]` : ''),
          };
        });
      } catch {}

      // Contrast probe on heading-like elements (h1/h2): WCAG AA needs >=4.5 for normal, >=3 for large.
      const contrast = await page.evaluate(() => {
        const srgbToLin = (c) => {
          c /= 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        const lum = (r, g, b) => 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
        const parse = (s) => {
          const m = s.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const [r, g, b, a] = m[1].split(',').map((v) => parseFloat(v));
          return { r, g, b, a: a == null ? 1 : a };
        };
        const bgOf = (el) => {
          let cur = el;
          while (cur && cur !== document.documentElement) {
            const cs = getComputedStyle(cur);
            const p = parse(cs.backgroundColor);
            if (p && p.a > 0.5 && !(p.r === 0 && p.g === 0 && p.b === 0 && p.a === 0)) return p;
            cur = cur.parentElement;
          }
          return { r: 255, g: 255, b: 255, a: 1 };
        };
        const headings = Array.from(document.querySelectorAll('h1, h2'));
        const ratios = [];
        for (const h of headings.slice(0, 6)) {
          if (!h.textContent || !h.textContent.trim()) continue;
          const cs = getComputedStyle(h);
          const fg = parse(cs.color);
          const bg = bgOf(h);
          if (!fg) continue;
          const l1 = lum(fg.r, fg.g, fg.b);
          const l2 = lum(bg.r, bg.g, bg.b);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          const fontSize = parseFloat(cs.fontSize);
          const bold = parseInt(cs.fontWeight) >= 600;
          const isLarge = fontSize >= 24 || (fontSize >= 18.66 && bold);
          const min = isLarge ? 3 : 4.5;
          ratios.push({
            tag: h.tagName,
            ratio: Math.round(ratio * 100) / 100,
            min,
            pass: ratio >= min,
            text: (h.textContent || '').trim().slice(0, 40),
          });
        }
        return ratios;
      });

      probe.focusRing = focusRing;
      probe.contrast = contrast;

      const shotPath = path.join(OUT, `${route.name}-${vp.name}.png`);
      try {
        await page.screenshot({ path: shotPath, fullPage: true });
      } catch (e) {
        nav.error = nav.error || `screenshot: ${e.message}`;
      }

      const issues = [];
      if (!nav.ok) issues.push(`nav-failed: status=${nav.status} err=${nav.error || ''}`);
      if (probe.rootEmpty) issues.push('blank-root');
      if (probe.textLen < 20 && !probe.rootEmpty) issues.push(`low-text(${probe.textLen})`);
      if (probe.horizOverflow) issues.push(`overflow(${probe.scrollW}>${probe.clientW})`);
      if (probe.brokenImgs.length) issues.push(`broken-imgs(${probe.brokenImgs.length})`);
      if (probe.hasNotFound) issues.push('404-text');
      if (probe.hasErrorBoundary) issues.push('error-boundary');
      if (probe.focusable === 0) issues.push('no-focusable');
      if (consoleErrors.length) issues.push(`console-errors(${consoleErrors.length})`);
      if (pageErrors.length) issues.push(`page-errors(${pageErrors.length})`);
      if (failedReqs.length) issues.push(`failed-reqs(${failedReqs.length})`);
      if (probe.headerWraps && probe.headerWraps.length) {
        issues.push(`header-wrap(${probe.headerWraps.join('|')})`);
      }
      if (probe.focusRing && !probe.focusRing.ok) issues.push('no-focus-ring');
      const failedContrast = (probe.contrast || []).filter((c) => !c.pass);
      if (failedContrast.length) {
        issues.push(`low-contrast(${failedContrast.map((c) => `${c.tag}:${c.ratio}`).join(',')})`);
      }

      routeResult.viewports.push({
        viewport: vp.name,
        width: vp.width,
        nav,
        probe,
        issues,
        consoleErrors: consoleErrors.slice(0, 5),
        pageErrors: pageErrors.slice(0, 5),
        failedReqs: failedReqs.slice(0, 5),
        screenshot: path.relative(process.cwd(), shotPath),
      });

      await ctx.close();
    }
    report.routes.push(routeResult);
  }

  await browser.close();
  const reportPath = path.join(OUT, 'report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  // Print a compact summary
  let total = 0;
  let issues = 0;
  for (const r of report.routes) {
    for (const v of r.viewports) {
      total++;
      if (v.issues.length) issues++;
    }
  }
  console.log(JSON.stringify({ iteration: report.iteration, total, withIssues: issues, reportPath }, null, 2));
}

run().catch((e) => {
  console.error('HEAL_RUNNER_FAILED', e);
  process.exit(2);
});
