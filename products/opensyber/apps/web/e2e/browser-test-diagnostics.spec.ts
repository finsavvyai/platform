import { test, expect } from '@playwright/test';

/**
 * Browser diagnostics — captures console errors, failed network
 * requests, and HTTP status per public page. Companion to
 * browser-test-screenshots.spec.ts which owns visual capture.
 */

const PUBLIC_ROUTES = [
  '/', '/pricing', '/enterprise', '/demo', '/security', '/compliance',
  '/threats', '/openagent', '/marketplace', '/skills', '/marketplace/bundles',
  '/docs', '/docs/getting-started', '/docs/api', '/docs/security',
  '/docs/skills', '/blog', '/tokenforge', '/privacy', '/terms',
  '/sign-in', '/sign-up',
];

interface PageDiagnostic {
  route: string;
  httpStatus: number;
  consoleErrors: string[];
  failedRequests: string[];
  loadTimeMs: number;
}

const diagnostics: PageDiagnostic[] = [];

for (const route of PUBLIC_ROUTES) {
  test(`diagnostics: ${route}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`[pageerror] ${err.message.slice(0, 200)}`);
    });
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (url.includes('opensyber.cloud') || url.includes('api.opensyber.cloud')) {
        failedRequests.push(`${req.failure()?.errorText ?? 'unknown'} ${url.slice(0, 150)}`);
      }
    });
    page.on('response', (res) => {
      const url = res.url();
      const status = res.status();
      if (status >= 500 && (url.includes('opensyber.cloud') || url.includes('api.opensyber.cloud'))) {
        failedRequests.push(`HTTP ${status} ${url.slice(0, 150)}`);
      }
    });

    const start = Date.now();
    const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForTimeout(1500);
    const loadTimeMs = Date.now() - start;

    diagnostics.push({
      route,
      httpStatus: response?.status() ?? 0,
      consoleErrors: [...new Set(consoleErrors)],
      failedRequests: [...new Set(failedRequests)],
      loadTimeMs,
    });

    expect(response?.status(), `HTTP ${response?.status()} on ${route}`).toBeLessThan(500);
  });
}

test.afterAll(async () => {
  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.resolve(
    __dirname,
    '../../../.luna/opensyber/browser-test/diagnostics.json',
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(diagnostics, null, 2));
  console.log(`Wrote diagnostics for ${diagnostics.length} routes → ${outPath}`);
});
