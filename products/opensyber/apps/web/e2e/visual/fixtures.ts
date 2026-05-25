import { test as base, expect, type Page } from '@playwright/test';

/**
 * Visual regression fixtures.
 *
 * Auth strategy:
 *   Auth.js session cookies are HMAC-signed JWTs, so we cannot mint them
 *   from a test without the AUTH_SECRET. Instead, we expect a pre-captured
 *   storage state file at e2e/.auth/user.json (produced by auth-setup.spec.ts)
 *   OR an explicit test storage state baked by the local dev server.
 *
 *   For local runs against `next dev`, set E2E_BASE_URL=http://localhost:3000
 *   and run `pnpm test:visual:setup` first to mint an auth cookie.
 *
 * Stabilization:
 *   Visual tests are notoriously flaky because of animations, carousels,
 *   fonts, and live data. `stabilizePage` freezes all of these before we
 *   take the screenshot so diffs only reflect real UI regressions.
 */

export type VisualFixtures = {
  stabilizedPage: Page;
};

export const SCREENSHOT_TOLERANCE = {
  maxDiffPixelRatio: 0.02,
  animations: 'disabled' as const,
  caret: 'hide' as const,
  fullPage: false,
};

const DISABLE_MOTION_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
  [data-testid="relative-time"],
  [data-dynamic="true"],
  .skeleton,
  .animate-pulse,
  .animate-spin {
    visibility: hidden !important;
  }
`;

/**
 * Remove volatile UI (timestamps, live counters) and freeze animations so
 * the rendered frame is deterministic across CI runs.
 */
export async function stabilizePage(page: Page): Promise<void> {
  await page.addStyleTag({ content: DISABLE_MOTION_CSS });
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('[data-dynamic="true"]').forEach((node) => {
      node.textContent = '--';
    });
  });
  await page.waitForLoadState('networkidle');
  // settle fonts + any post-load animations
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(250);
}

export const visualTest = base.extend<VisualFixtures>({
  stabilizedPage: async ({ page }, use) => {
    await use(page);
  },
});

export { expect };
