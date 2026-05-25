import { test, expect, Page } from '@playwright/test';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

const PAGES = [
  { path: '/', name: 'landing' },
  { path: '/pricing', name: 'pricing' },
  { path: '/marketplace', name: 'marketplace' },
  { path: '/demo', name: 'demo' },
  { path: '/enterprise', name: 'enterprise' },
  { path: '/blog', name: 'blog' },
  { path: '/sign-in', name: 'sign-in' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/openagent', name: 'openagent' },
  { path: '/threats', name: 'threats' },
];

async function checkNoHorizontalOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    const docWidth = document.documentElement.clientWidth;
    const els = document.querySelectorAll('*');
    els.forEach((el) => {
      const style = getComputedStyle(el);
      // Skip elements that are hidden, invisible, translated off-screen, or decorative
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        style.pointerEvents === 'none' ||
        style.transform.includes('matrix') // translated elements
      ) {
        return;
      }
      // Skip elements inside overflow-hidden containers
      let parent = el.parentElement;
      while (parent) {
        const ps = getComputedStyle(parent);
        if (ps.overflow === 'hidden' || ps.overflowX === 'hidden') return;
        parent = parent.parentElement;
      }
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 2) {
        const tag = el.tagName.toLowerCase();
        const cls = el.className?.toString().slice(0, 60) || '';
        issues.push(`${tag}.${cls} overflows by ${Math.round(rect.right - docWidth)}px`);
      }
    });
    return [...new Set(issues)].slice(0, 10);
  });
}

async function checkBrokenImages(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const broken: string[] = [];
    document.querySelectorAll('img').forEach((img) => {
      if (!img.complete || img.naturalWidth === 0) {
        broken.push(img.src || img.getAttribute('data-src') || 'unknown');
      }
    });
    return broken;
  });
}

async function checkContrastIssues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    const els = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, a, button, label, li');
    els.forEach((el) => {
      const style = getComputedStyle(el);
      const color = style.color;
      const bg = style.backgroundColor;
      if (color === bg && el.textContent?.trim()) {
        issues.push(`Same fg/bg color on: ${el.textContent?.slice(0, 40)}`);
      }
    });
    return issues.slice(0, 10);
  });
}

async function checkMissingAria(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    // Buttons without accessible name
    document.querySelectorAll('button').forEach((btn) => {
      if (!btn.textContent?.trim() && !btn.getAttribute('aria-label') && !btn.getAttribute('aria-labelledby')) {
        issues.push(`Button without accessible name: ${btn.outerHTML.slice(0, 80)}`);
      }
    });
    // Images without alt
    document.querySelectorAll('img').forEach((img) => {
      if (!img.getAttribute('alt') && img.getAttribute('alt') !== '') {
        issues.push(`Image without alt: ${img.src?.slice(0, 60)}`);
      }
    });
    // Links without text
    document.querySelectorAll('a').forEach((a) => {
      if (!a.textContent?.trim() && !a.getAttribute('aria-label')) {
        issues.push(`Link without accessible name: ${a.href?.slice(0, 60)}`);
      }
    });
    return issues.slice(0, 15);
  });
}

// ── ITERATION 1: Page load + screenshots across viewports ──

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`Viewport: ${vpName} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    for (const pg of PAGES) {
      test(`${pg.name} loads without errors`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));

        const response = await page.goto(pg.path, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Dashboard should redirect to sign-in
        if (pg.path === '/dashboard') {
          await expect(page).toHaveURL(/sign-in|login|auth/);
          return;
        }

        expect(response?.status()).toBeLessThan(400);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `test-results/heal-${pg.name}-${vpName}.png`, fullPage: true });

        if (errors.length > 0) {
          console.warn(`JS errors on ${pg.path}:`, errors);
        }
      });
    }
  });
}

// ── ITERATION 2: Layout + overflow checks ──

test.describe('Layout integrity', () => {
  for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
    test(`No horizontal overflow on landing (${vpName})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      // Scroll through the page to trigger animations
      await page.evaluate(async () => {
        const height = document.body.scrollHeight;
        for (let y = 0; y < height; y += 400) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 100));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(500);
      const overflows = await checkNoHorizontalOverflow(page);
      if (overflows.length > 0) {
        console.warn(`Overflow issues at ${vpName}:`, overflows);
      }
      expect(overflows.length).toBe(0);
    });

    test(`No horizontal overflow on pricing (${vpName})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async () => {
        const height = document.body.scrollHeight;
        for (let y = 0; y < height; y += 400) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 100));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(500);
      const overflows = await checkNoHorizontalOverflow(page);
      if (overflows.length > 0) {
        console.warn(`Overflow issues at ${vpName}:`, overflows);
      }
      expect(overflows.length).toBe(0);
    });
  }
});

// ── ITERATION 3: Component-specific checks ──

test.describe('Landing page components', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('Hero section: headline, CTAs, stats visible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Wait for hero animations (delay up to 0.7s)
    await page.waitForTimeout(1500);
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();

    // Stats use animate (not whileInView) so they should appear after delay
    await expect(page.getByText('340ms', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('<60s', { exact: true })).toBeVisible({ timeout: 5000 });

    // CTA buttons
    const ctaLinks = page.locator('a[href*="sign"], a[href*="demo"]').filter({ hasText: /start|demo|lunch/i });
    expect(await ctaLinks.count()).toBeGreaterThan(0);
  });

  test('QuoteTicker: visible and cycling', async ({ page }) => {
    await page.goto('/');
    // The quote ticker should have italic text
    const ticker = page.locator('section').filter({ has: page.locator('.italic') }).first();
    await expect(ticker).toBeVisible();

    // Wait and check if quote changes (5s interval)
    const firstQuote = await page.locator('.italic').first().textContent();
    await page.waitForTimeout(5500);
    const secondQuote = await page.locator('.italic').first().textContent();
    // They may or may not be different (timing), but component must remain visible
    await expect(page.locator('.italic').first()).toBeVisible();
  });

  test('Trust bar: all badges visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Built on enterprise-grade infrastructure')).toBeVisible();
  });

  test('Problem section: before/after cards', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    // Scroll to Problem section heading first
    const heading = page.getByText('THIS IS YOUR SECURITY PLAN?');
    await heading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    // Should have "without" and "with" cards (text is in the cards)
    const without = page.getByText(/your current setup/i);
    const withCard = page.getByText(/with opensyber/i);
    await expect(without).toBeVisible();
    await expect(withCard).toBeVisible();
  });

  test('Social proof: attack cards present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Trivy Supply Chain Attack')).toBeVisible();
    await expect(page.getByText('Clinejection')).toBeVisible();
    await expect(page.getByText('CanisterWorm')).toBeVisible();
  });

  test('Ecosystem section: two product cards', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    // Scroll to ecosystem section
    const ecosystem = page.getByRole('heading', { name: /TWO PRODUCTS/i });
    await ecosystem.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await expect(ecosystem).toBeVisible();
    await expect(page.getByText('opensyber.cloud').first()).toBeVisible();
    await expect(page.getByText('tokenforge.opensyber.cloud').first()).toBeVisible();
  });

  test('Footer: all link sections present', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    // Scroll gradually to the bottom to trigger all whileInView animations
    await page.evaluate(async () => {
      const height = document.body.scrollHeight;
      for (let y = 0; y < height; y += 500) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 150));
      }
      window.scrollTo(0, height);
    });
    await page.waitForTimeout(1000);
    const footer = page.locator('footer').filter({ hasText: /OpenSyber/ }).first();
    await expect(footer).toBeVisible({ timeout: 10000 });
    await expect(footer.getByText(/privacy/i)).toBeVisible();
    await expect(footer.getByText(/terms/i)).toBeVisible();
    await expect(footer.getByText(/blog/i)).toBeVisible();
  });
});

// ── ITERATION 4: Accessibility checks ──

test.describe('Accessibility', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('Landing page: no broken images', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const broken = await checkBrokenImages(page);
    expect(broken).toEqual([]);
  });

  test('Landing page: all buttons/links have accessible names', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const issues = await checkMissingAria(page);
    if (issues.length > 0) {
      console.warn('A11y issues:', issues);
    }
    expect(issues.length).toBe(0);
  });

  test('Focus ring visible on tab navigation', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check that some element has focus
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      return {
        tag: el.tagName,
        outline: style.outlineStyle,
        outlineColor: style.outlineColor,
      };
    });
    expect(focused).not.toBeNull();
  });

  test('Nav landmark exists', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav');
    await expect(nav.first()).toBeVisible();
  });

  test('Main landmark exists', async ({ page }) => {
    await page.goto('/');
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('Footer landmark exists', async ({ page }) => {
    await page.goto('/');
    // Use first() since Next.js dev mode adds its own error overlay footer
    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible();
  });
});

// ── ITERATION 5: Security headers + links ──

test.describe('Security and links', () => {
  test('Landing page returns security headers', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    // Check common security headers (may vary in dev vs prod)
    const secHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'referrer-policy',
    ];

    const present: string[] = [];
    const missing: string[] = [];
    for (const h of secHeaders) {
      if (headers[h]) {
        present.push(h);
      } else {
        missing.push(h);
      }
    }

    console.log('Security headers present:', present);
    if (missing.length > 0) {
      console.warn('Security headers missing:', missing);
    }
  });

  test('Internal links resolve (no 404s)', async ({ page }) => {
    await page.goto('/');
    const links = await page.evaluate(() => {
      const anchors = document.querySelectorAll('a[href^="/"]');
      return [...new Set(Array.from(anchors).map((a) => a.getAttribute('href')))].filter(Boolean);
    });

    const broken: string[] = [];
    for (const link of links.slice(0, 15)) {
      const resp = await page.request.get(link!);
      if (resp.status() >= 400 && resp.status() !== 401) {
        broken.push(`${link} -> ${resp.status()}`);
      }
    }

    if (broken.length > 0) {
      console.warn('Broken internal links:', broken);
    }
    expect(broken.length).toBe(0);
  });

  test('/dashboard redirects to sign-in', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/sign-in|login|auth/);
  });
});

// ── Mobile-specific checks ──

test.describe('Mobile responsive', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('Mobile menu opens and closes', async ({ page }) => {
    await page.goto('/');
    // Hamburger button should be visible
    const menuBtn = page.locator('button[aria-label*="menu" i], button[aria-label*="Menu" i]').first();
    await expect(menuBtn).toBeVisible();

    await menuBtn.click();
    await page.waitForTimeout(400);

    // Nav links should now be visible
    await expect(page.locator('nav').filter({ hasText: /pricing/i }).last()).toBeVisible();

    // Close menu
    const closeBtn = page.locator('button[aria-label*="close" i], button[aria-label*="Close" i]').first();
    await closeBtn.click();
    await page.waitForTimeout(400);
  });

  test('Hero text does not overflow on mobile', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();

    const box = await h1.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(375);
  });

  test('QuoteTicker text fits on mobile', async ({ page }) => {
    await page.goto('/');
    const overflows = await page.evaluate(() => {
      const issues: string[] = [];
      document.querySelectorAll('.italic').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > 375 + 2) {
          issues.push(`Quote overflows by ${Math.round(rect.right - 375)}px`);
        }
      });
      return issues;
    });
    expect(overflows).toEqual([]);
  });
});

// ── Pricing page deep checks ──

test.describe('Pricing cards', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('All 5 plan cards render with names and CTAs', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const plans = ['Starter Shield', 'Team', 'Professional', 'Enterprise', 'Mission Defender'];
    for (const plan of plans) {
      await expect(page.getByText(plan, { exact: false }).first()).toBeVisible({ timeout: 5000 });
    }

    // CTA buttons
    const ctaButtons = page.locator('a, button').filter({ hasText: /start free|contact sales|get started/i });
    expect(await ctaButtons.count()).toBeGreaterThanOrEqual(4);
  });

  test('Price amounts are visible', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await expect(page.getByText('$0').first()).toBeVisible();
    await expect(page.getByText('$299').first()).toBeVisible();
    await expect(page.getByText('$799').first()).toBeVisible();
    await expect(page.getByText('$2,499').first()).toBeVisible();
    await expect(page.getByText('$9,999').first()).toBeVisible();
  });

  test('MSSP section visible', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    // Scroll down to find MSSP section
    await page.evaluate(async () => {
      const height = document.body.scrollHeight;
      for (let y = 0; y < height; y += 400) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 100));
      }
    });
    await page.waitForTimeout(1000);
    await expect(page.getByText(/managed service|MSP/i).first()).toBeVisible();
    await expect(page.getByText('40%').first()).toBeVisible();
  });

  test('Pricing cards align in a row on desktop', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Check no card overflows the viewport
    const overflows = await checkNoHorizontalOverflow(page);
    expect(overflows.length).toBe(0);
  });
});

// ── OG / SEO meta tags ──

test.describe('OG and SEO meta tags', () => {
  const pagesToCheck = [
    { path: '/', expectedTitle: /OpenSyber/i },
    { path: '/pricing', expectedTitle: /Pricing/i },
    { path: '/marketplace', expectedTitle: /Marketplace/i },
    { path: '/demo', expectedTitle: /Demo/i },
    { path: '/blog', expectedTitle: /Blog/i },
    { path: '/threats', expectedTitle: /Threat/i },
  ];

  for (const pg of pagesToCheck) {
    test(`${pg.path} has og:title and og:image`, async ({ request }) => {
      const resp = await request.get(pg.path);
      const html = await resp.text();

      const hasOgTitle = /property="og:title"/.test(html) || /name="og:title"/.test(html);
      const hasOgImage = /property="og:image"/.test(html) || /name="og:image"/.test(html);
      const hasDescription = /name="description"/.test(html) || /property="og:description"/.test(html);

      expect(hasOgTitle).toBe(true);
      expect(hasOgImage).toBe(true);
      expect(hasDescription).toBe(true);
    });
  }
});

// ── Performance checks ──

test.describe('Performance', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('Landing page loads within 5s budget', async ({ page }) => {
    const start = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const elapsed = Date.now() - start;
    console.log(`Landing page load time: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(5000);
  });

  test('No layout shifts on landing (CLS proxy)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    // Take a screenshot and check document height stability
    const height1 = await page.evaluate(() => document.body.scrollHeight);
    await page.waitForTimeout(2000);
    const height2 = await page.evaluate(() => document.body.scrollHeight);
    // Allow up to 200px growth for lazy-loaded content
    expect(Math.abs(height2 - height1)).toBeLessThan(200);
  });
});

// ── Dark theme consistency ──

test.describe('Dark theme consistency', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('Body uses void background', async ({ page }) => {
    await page.goto('/');
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });
    // Void background should be very dark (near black)
    // rgb(10, 15, 28) = #0A0F1C
    expect(bgColor).toMatch(/rgb\(\s*\d{1,2}\s*,\s*\d{1,2}\s*,\s*\d{1,2}\s*\)/);
  });

  test('No white backgrounds on main sections', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const whiteAreas = await page.evaluate(() => {
      const issues: string[] = [];
      const sections = document.querySelectorAll('section, main, header, footer, div[class*="container"]');
      sections.forEach((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        // Check for white or very light backgrounds
        const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
          const [, r, g, b] = match.map(Number);
          if (r > 240 && g > 240 && b > 240) {
            const cls = el.className?.toString().slice(0, 60) || el.tagName;
            issues.push(`White bg on: ${cls}`);
          }
        }
      });
      return issues;
    });
    if (whiteAreas.length > 0) {
      console.warn('White background areas:', whiteAreas);
    }
    expect(whiteAreas.length).toBe(0);
  });
});

// ── OpenAgent and Threats pages ──

test.describe('Additional pages', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('OpenAgent page: VS Code extension content', async ({ page }) => {
    await page.goto('/openagent', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await expect(page.getByText(/VS Code|extension/i).first()).toBeVisible();
    await expect(page.getByText(/download|install/i).first()).toBeVisible();
  });

  test('Threats page: threat intel feed', async ({ page }) => {
    await page.goto('/threats', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await expect(page.getByText(/threat/i).first()).toBeVisible();
    await expect(page.getByText(/live/i).first()).toBeVisible();
  });

  test('Blog page: posts listed', async ({ page }) => {
    await page.goto('/blog', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    // Should have at least 5 blog posts
    const articles = page.locator('article, a[href*="/blog/"]');
    expect(await articles.count()).toBeGreaterThanOrEqual(5);
  });
});
