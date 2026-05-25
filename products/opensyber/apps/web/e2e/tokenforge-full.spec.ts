import { test, expect } from '@playwright/test';

const TF_WEB = 'https://tokenforge.opensyber.cloud';
const TF_API = 'https://tokenforge-api.opensyber.cloud';

// ---------------------------------------------------------------------------
// Landing Page — Hero Section
// ---------------------------------------------------------------------------
test.describe('TokenForge Landing — Hero', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TF_WEB);
  });

  test('headline renders with "Your auth stops at login"', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Your auth stops at login');
    await expect(h1).toContainText('We protect everything after');
  });

  test('"Get Started Free" links to /sign-in', async ({ page }) => {
    const cta = page.getByRole('link', { name: 'Get Started Free' }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/sign-in');
  });

  test('"Read the Docs" links to /docs', async ({ page }) => {
    const docs = page.getByRole('link', { name: 'Read the Docs' }).first();
    await expect(docs).toBeVisible();
    await expect(docs).toHaveAttribute('href', '/docs');
  });

  test('tagline "One script tag. Zero dependencies. Free forever." visible', async ({ page }) => {
    await expect(page.getByText('One script tag. Zero dependencies. Free forever.')).toBeVisible();
  });

  test('hero badge "Post-authentication session security" visible', async ({ page }) => {
    await expect(page.getByText('Post-authentication session security')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Landing Page — Problem Section (3 Threat Cards)
// ---------------------------------------------------------------------------
test.describe('TokenForge Landing — Problem Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TF_WEB);
  });

  test('section heading mentions "Vulnerable"', async ({ page }) => {
    await expect(page.getByText('Your Sessions Are')).toBeVisible();
    await expect(page.getByText('Vulnerable')).toBeVisible();
  });

  test('AiTM Phishing threat card renders', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'AiTM Phishing' })).toBeVisible();
    await expect(page.getByText('Adversary-in-the-middle attacks steal session cookies')).toBeVisible();
  });

  test('XSS Token Theft threat card renders', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'XSS Token Theft' })).toBeVisible();
    await expect(page.getByText('Cross-site scripting extracts tokens')).toBeVisible();
  });

  test('Session Hijacking threat card renders', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Session Hijacking' })).toBeVisible();
    await expect(page.getByText('Stolen cookies work from any device')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Landing Page — How It Works (3 Steps)
// ---------------------------------------------------------------------------
test.describe('TokenForge Landing — How It Works', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TF_WEB);
  });

  test('section heading "How TokenForge Works"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'How TokenForge Works' })).toBeVisible();
  });

  test('step 1 — Add Script Tag', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Add Script Tag' })).toBeVisible();
    await expect(page.getByText('Step 1')).toBeVisible();
  });

  test('step 2 — Add Server Middleware', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Add Server Middleware' })).toBeVisible();
    await expect(page.getByText('Step 2')).toBeVisible();
  });

  test('step 3 — Monitor', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Monitor' })).toBeVisible();
    await expect(page.getByText('Step 3')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Landing Page — Trust Score (7 Signals)
// ---------------------------------------------------------------------------
test.describe('TokenForge Landing — Trust Score', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TF_WEB);
  });

  test('section heading "7-Signal Trust Score"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '7-Signal Trust Score' })).toBeVisible();
  });

  test('all 7 signals displayed', async ({ page }) => {
    const signals = [
      'Signature valid',
      'IP consistency',
      'Geo consistency',
      'Device fingerprint',
      'Request velocity',
      'Time pattern',
      'Nonce freshness',
    ];
    for (const signal of signals) {
      await expect(page.getByText(signal).first()).toBeVisible();
    }
  });

  test('threshold labels (Allow, Step-Up, Block) visible', async ({ page }) => {
    await expect(page.getByText('Allow').first()).toBeVisible();
    await expect(page.getByText('Step-Up').first()).toBeVisible();
    await expect(page.getByText('Block').first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Landing Page — Code Example Section
// ---------------------------------------------------------------------------
test.describe('TokenForge Landing — Code Examples', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TF_WEB);
  });

  test('heading "Two Lines. That\'s It."', async ({ page }) => {
    await expect(page.getByRole('heading', { name: "Two Lines. That's It." })).toBeVisible();
  });

  test('client and server code blocks present', async ({ page }) => {
    await expect(page.getByText('Client').first()).toBeVisible();
    await expect(page.getByText('Server').first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Landing Page — Frameworks Section (4 Categories)
// ---------------------------------------------------------------------------
test.describe('TokenForge Landing — Frameworks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TF_WEB);
  });

  test('heading "Every Platform. One API Key."', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Every Platform. One API Key.' })).toBeVisible();
  });

  test('4 categories: Web, Mobile, AI Agents, Zero Code', async ({ page }) => {
    await expect(page.getByText('Web').first()).toBeVisible();
    await expect(page.getByText('Mobile').first()).toBeVisible();
    await expect(page.getByText('AI Agents').first()).toBeVisible();
    await expect(page.getByText('Zero Code').first()).toBeVisible();
  });

  test('platform items listed under categories', async ({ page }) => {
    await expect(page.getByText('Script Tag').first()).toBeVisible();
    await expect(page.getByText('Swift (iOS)').first()).toBeVisible();
    await expect(page.getByText('MCP Server').first()).toBeVisible();
    await expect(page.getByText('DNS Proxy').first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Landing Page — Comparison Table
// ---------------------------------------------------------------------------
test.describe('TokenForge Landing — Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TF_WEB);
  });

  test('heading "Why TokenForge?"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Why TokenForge?' })).toBeVisible();
  });

  test('comparison table columns present', async ({ page }) => {
    await expect(page.getByText('TokenForge').first()).toBeVisible();
    await expect(page.getByText('Google DBSC').first()).toBeVisible();
    await expect(page.getByText('Session Cookies').first()).toBeVisible();
    await expect(page.getByText('Device Fingerprinting').first()).toBeVisible();
  });

  test('feature rows present in comparison table', async ({ page }) => {
    await expect(page.getByText('Cross-browser').first()).toBeVisible();
    await expect(page.getByText('Cryptographic proof').first()).toBeVisible();
    await expect(page.getByText('Trust scoring').first()).toBeVisible();
    await expect(page.getByText('Step-up auth').first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Landing Page — Footer
// ---------------------------------------------------------------------------
test.describe('TokenForge Landing — Footer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TF_WEB);
  });

  test('copyright text visible', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('2026 TokenForge');
  });

  test('footer links: Pricing, Quick Start, SDKs, Blog', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'Pricing' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Quick Start' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'SDKs' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Blog' })).toBeVisible();
  });

  test('OpenSyber link in footer', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'OpenSyber' })).toHaveAttribute(
      'href',
      'https://opensyber.cloud',
    );
  });
});

// ---------------------------------------------------------------------------
// Pricing Page (Deep)
// ---------------------------------------------------------------------------
test.describe('TokenForge Pricing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TF_WEB}/pricing`);
  });

  test('page loads with pricing heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Simple, Transparent Pricing' })).toBeVisible();
  });

  test('4 plan names rendered', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pro', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Enterprise', exact: true })).toBeVisible();
  });

  test('plan prices displayed', async ({ page }) => {
    await expect(page.getByText('$0').first()).toBeVisible();
    await expect(page.getByText('$49').first()).toBeVisible();
    await expect(page.getByText('$199').first()).toBeVisible();
    await expect(page.getByText('Custom').first()).toBeVisible();
  });

  test('Pro plan has "Most Popular" badge', async ({ page }) => {
    await expect(page.getByText('Most Popular')).toBeVisible();
  });

  test('Free tier features listed', async ({ page }) => {
    await expect(page.getByText('1K verifications/mo')).toBeVisible();
    await expect(page.getByText('100 active sessions')).toBeVisible();
    await expect(page.getByText('Basic trust scoring')).toBeVisible();
    await expect(page.getByText('Single project')).toBeVisible();
  });

  test('Pro tier features listed', async ({ page }) => {
    await expect(page.getByText('Step-up authentication')).toBeVisible();
    await expect(page.getByText('Webhook alerts')).toBeVisible();
    await expect(page.getByText('Custom thresholds')).toBeVisible();
  });

  test('Team tier features listed', async ({ page }) => {
    await expect(page.getByText('SSO integration')).toBeVisible();
    await expect(page.getByText('Team management')).toBeVisible();
    await expect(page.getByText('Audit logs')).toBeVisible();
  });

  test('Enterprise tier features listed', async ({ page }) => {
    await expect(page.getByText('Unlimited verifications')).toBeVisible();
    await expect(page.getByText('SOC2 compliance reports')).toBeVisible();
    await expect(page.getByText('Data residency')).toBeVisible();
    await expect(page.getByText('Dedicated support + SLA')).toBeVisible();
  });

  test('all plans tagline at bottom', async ({ page }) => {
    await expect(
      page.getByText('All plans include cryptographic device binding'),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Docs — Quick Start
// ---------------------------------------------------------------------------
test.describe('TokenForge Docs — Quick Start', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TF_WEB}/docs`);
  });

  test('page loads with "Quick Start" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Quick Start', exact: true })).toBeVisible();
  });

  test('DNS Proxy integration path (Easiest)', async ({ page }) => {
    await expect(page.getByText('Easiest')).toBeVisible();
    await expect(page.getByRole('heading', { name: /DNS Proxy/ })).toBeVisible();
  });

  test('Script Tag integration path (Simple)', async ({ page }) => {
    await expect(page.getByText('Simple').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Script Tag/ })).toBeVisible();
  });

  test('npm Package integration path (Advanced)', async ({ page }) => {
    await expect(page.getByText('Advanced')).toBeVisible();
    await expect(page.getByRole('heading', { name: /npm Package/ })).toBeVisible();
  });

  test('Native SDKs section with Mobile & AI Agents', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Mobile & AI Agents' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Swift (iOS)' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'MCP Server' })).toBeVisible();
  });

  test('"Get your API key" CTA section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Get your API key' })).toBeVisible();
    await expect(page.getByText('1,000 verifications/month')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Docs — Integrations (7 Frameworks)
// ---------------------------------------------------------------------------
test.describe('TokenForge Docs — Integrations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TF_WEB}/docs/integrations`);
  });

  test('page loads with "Integration Guides" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Integration Guides' })).toBeVisible();
  });

  test('7 framework nav links rendered', async ({ page }) => {
    const frameworks = ['React', 'Angular', 'Vue', 'Clerk', 'Microsoft 365', 'Auth0', 'Firebase'];
    for (const fw of frameworks) {
      await expect(page.getByRole('link', { name: fw, exact: true })).toBeVisible();
    }
  });

  test('React / Next.js guide section exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'React / Next.js' })).toBeVisible();
  });

  test('Angular guide section exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Angular' })).toBeVisible();
  });

  test('Vue 3 guide section exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Vue 3' })).toBeVisible();
  });

  test('Clerk SSO guide section exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Clerk SSO' })).toBeVisible();
  });

  test('Microsoft 365 / Entra ID guide section exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Microsoft 365/ })).toBeVisible();
  });

  test('Auth0 guide section exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Auth0' })).toBeVisible();
  });

  test('Firebase Auth guide section exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Firebase Auth' })).toBeVisible();
  });

  test('Native SDKs banner links to /docs/integrations/native', async ({ page }) => {
    const link = page.getByRole('link', { name: /Native SDKs/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/docs/integrations/native');
  });
});

// ---------------------------------------------------------------------------
// Docs — Native SDKs (6 Platforms)
// ---------------------------------------------------------------------------
test.describe('TokenForge Docs — Native SDKs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TF_WEB}/docs/integrations/native`);
  });

  test('page loads with "Mobile & AI Agent SDKs" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Mobile & AI Agent SDKs' })).toBeVisible();
  });

  test('6 SDK nav links rendered', async ({ page }) => {
    const sdks = ['Python', 'Go', 'MCP Server', 'Swift (iOS)', 'Kotlin (Android)', 'React Native'];
    for (const sdk of sdks) {
      await expect(page.getByRole('link', { name: sdk, exact: true })).toBeVisible();
    }
  });

  test('Python (AI Agents) guide section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Python (AI Agents)' })).toBeVisible();
  });

  test('Go (Microservices) guide section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Go (Microservices)' })).toBeVisible();
  });

  test('MCP Server guide section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /MCP Server/ })).toBeVisible();
  });

  test('Swift (iOS) guide section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Swift (iOS)' })).toBeVisible();
  });

  test('Kotlin (Android) guide section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Kotlin (Android)' })).toBeVisible();
  });

  test('React Native guide section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'React Native' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Docs — SIEM Integration
// ---------------------------------------------------------------------------
test.describe('TokenForge Docs — SIEM', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TF_WEB}/docs/siem`);
  });

  test('page loads with "SIEM Integration" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'SIEM Integration' })).toBeVisible();
  });

  test('Event Payload Format section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Event Payload Format' })).toBeVisible();
  });

  test('Platform Guides heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Platform Guides' })).toBeVisible();
  });

  test('Splunk guide exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Splunk' })).toBeVisible();
  });

  test('Microsoft Sentinel guide exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Microsoft Sentinel' })).toBeVisible();
  });

  test('Elastic / Kibana guide exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Elastic/ })).toBeVisible();
  });

  test('Datadog guide exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Datadog' })).toBeVisible();
  });

  test('Trellix guide exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Trellix/ })).toBeVisible();
  });

  test('Cyrebro SOC guide exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Cyrebro/ })).toBeVisible();
  });

  test('"Any other SIEM" fallback section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Any other SIEM' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------
test.describe('TokenForge Blog', () => {
  test('blog index loads with heading and posts', async ({ page }) => {
    await page.goto(`${TF_WEB}/blog`);
    await expect(page.getByRole('heading', { name: 'Blog', exact: true })).toBeVisible();
    await expect(
      page.getByText("Session Hijacking After MFA: Why Cookies Aren't Enough"),
    ).toBeVisible();
    await expect(
      page.getByText('Protecting Microsoft 365 SSO Sessions with Device Binding'),
    ).toBeVisible();
  });

  test('session hijacking article loads with CTA', async ({ page }) => {
    await page.goto(`${TF_WEB}/blog/session-hijacking-after-mfa`);
    await expect(
      page.getByRole('heading', { name: /Session Hijacking After MFA/ }),
    ).toBeVisible();
    await expect(page.getByText('The AiTM Attack')).toBeVisible();
    await expect(page.getByText('The Fix: Device-Bound Sessions')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get Started Free' })).toBeVisible();
  });

  test('microsoft 365 article loads with CTA', async ({ page }) => {
    await page.goto(`${TF_WEB}/blog/microsoft-365-session-security`);
    await expect(
      page.getByRole('heading', { name: /Protecting Microsoft 365 SSO Sessions/ }),
    ).toBeVisible();
    await expect(page.getByText('How TokenForge Fits In')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get Started Free' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Auth Pages
// ---------------------------------------------------------------------------
test.describe('TokenForge Auth Pages', () => {
  test('sign-in page shows Google and GitHub buttons', async ({ page }) => {
    await page.goto(`${TF_WEB}/sign-in`);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with GitHub/ })).toBeVisible();
  });

  test('sign-in page has branded left panel content', async ({ page }) => {
    await page.goto(`${TF_WEB}/sign-in`);
    await expect(page.getByText('Device-bound session security')).toBeVisible();
    await expect(page.getByText('7-signal trust scoring in real time')).toBeVisible();
    await expect(page.getByText('ECDSA P-256 cryptographic binding')).toBeVisible();
  });

  test('sign-in page has "Welcome Back" heading', async ({ page }) => {
    await page.goto(`${TF_WEB}/sign-in`);
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  });

  test('sign-up redirects to sign-in', async ({ page }) => {
    await page.goto(`${TF_WEB}/sign-up`);
    await page.waitForURL(/\/sign-in/);
    expect(page.url()).toContain('/sign-in');
  });
});

// ---------------------------------------------------------------------------
// API — Public Endpoints
// ---------------------------------------------------------------------------
test.describe('TokenForge API — Public Endpoints', () => {
  test('GET / returns API info with name and version', async ({ request }) => {
    const res = await request.get(`${TF_API}/`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('TokenForge API');
    expect(body.version).toBeDefined();
  });

  test('GET /health returns healthy status', async ({ request }) => {
    const res = await request.get(`${TF_API}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });

  test('GET /sdk.js returns JavaScript (>1KB)', async ({ request }) => {
    const res = await request.get(`${TF_API}/sdk.js`);
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'] ?? '';
    expect(contentType).toContain('javascript');
    const body = await res.text();
    expect(body.length).toBeGreaterThan(1024);
  });

  test('GET /badge.js contains "Protected by TokenForge"', async ({ request }) => {
    const res = await request.get(`${TF_API}/badge.js`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('Protected by TokenForge');
  });
});

// ---------------------------------------------------------------------------
// API — Authenticated Endpoints (401 without auth)
// ---------------------------------------------------------------------------
test.describe('TokenForge API — Auth Required (401)', () => {
  test('GET /v1/sessions without auth returns 401', async ({ request }) => {
    const res = await request.get(`${TF_API}/v1/sessions`);
    expect(res.status()).toBe(401);
  });

  test('GET /v1/tenant without auth returns 401', async ({ request }) => {
    const res = await request.get(`${TF_API}/v1/tenant`);
    expect(res.status()).toBe(401);
  });

  test('GET /v1/events without auth returns 401', async ({ request }) => {
    const res = await request.get(`${TF_API}/v1/events`);
    expect(res.status()).toBe(401);
  });

  test('GET /v1/usage without auth returns 401', async ({ request }) => {
    const res = await request.get(`${TF_API}/v1/usage`);
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// API — Webhook Endpoints
// ---------------------------------------------------------------------------
test.describe('TokenForge API — Webhooks', () => {
  test('POST /webhooks/lemonsqueezy without signature returns 400 "missing_signature"', async ({
    request,
  }) => {
    const res = await request.post(`${TF_API}/webhooks/lemonsqueezy`, {
      data: { meta: { event_name: 'test' } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing_signature');
  });

  test('POST /webhooks/lemonsqueezy with bad signature returns 401', async ({ request }) => {
    const res = await request.post(`${TF_API}/webhooks/lemonsqueezy`, {
      headers: { 'X-Signature': 'badsignature' },
      data: { meta: { event_name: 'test' } },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('invalid_signature');
  });
});

// ---------------------------------------------------------------------------
// API — 404 Handler
// ---------------------------------------------------------------------------
test.describe('TokenForge API — 404', () => {
  test('GET /nonexistent returns 404 with error body', async ({ request }) => {
    const res = await request.get(`${TF_API}/nonexistent`);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });
});

// ---------------------------------------------------------------------------
// API — Security Headers
// ---------------------------------------------------------------------------
test.describe('TokenForge API — Security Headers', () => {
  test('X-Content-Type-Options: nosniff on all responses', async ({ request }) => {
    const res = await request.get(`${TF_API}/`);
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('X-Frame-Options: DENY on all responses', async ({ request }) => {
    const res = await request.get(`${TF_API}/`);
    expect(res.headers()['x-frame-options']).toBe('DENY');
  });

  test('Strict-Transport-Security header present', async ({ request }) => {
    const res = await request.get(`${TF_API}/`);
    const hsts = res.headers()['strict-transport-security'];
    expect(hsts).toBeDefined();
    expect(hsts).toContain('max-age=');
  });

  test('security headers present on /health endpoint', async ({ request }) => {
    const res = await request.get(`${TF_API}/health`);
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['x-frame-options']).toBe('DENY');
  });

  test('security headers present on /v1 endpoints (even 401)', async ({ request }) => {
    const res = await request.get(`${TF_API}/v1/sessions`);
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['x-frame-options']).toBe('DENY');
  });
});

// ---------------------------------------------------------------------------
// API — Rate Limit Headers
// ---------------------------------------------------------------------------
test.describe('TokenForge API — Rate Limit Headers', () => {
  test('rate limit headers present on /v1 endpoints', async ({ request }) => {
    const res = await request.get(`${TF_API}/v1/sessions`);
    const headers = res.headers();
    // Rate limit headers should be present (even on 401)
    const hasRateLimit =
      headers['ratelimit-limit'] !== undefined ||
      headers['x-ratelimit-limit'] !== undefined;
    expect(hasRateLimit).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// API — CORS
// ---------------------------------------------------------------------------
test.describe('TokenForge API — CORS', () => {
  test('OPTIONS from tokenforge.opensyber.cloud origin returns CORS headers', async ({
    request,
  }) => {
    const res = await request.fetch(`${TF_API}/v1/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://tokenforge.opensyber.cloud',
        'Access-Control-Request-Method': 'GET',
      },
    });
    const headers = res.headers();
    expect(headers['access-control-allow-origin']).toBe('https://tokenforge.opensyber.cloud');
  });

  test('OPTIONS from evil.com origin does not return CORS allow headers', async ({ request }) => {
    const res = await request.fetch(`${TF_API}/v1/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.com',
        'Access-Control-Request-Method': 'GET',
      },
    });
    const headers = res.headers();
    const origin = headers['access-control-allow-origin'];
    // Should either be absent or not match evil.com
    expect(origin).not.toBe('https://evil.com');
    expect(origin).not.toBe('*');
  });

  test('OPTIONS from opensyber.cloud origin is also allowed', async ({ request }) => {
    const res = await request.fetch(`${TF_API}/v1/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://opensyber.cloud',
        'Access-Control-Request-Method': 'GET',
      },
    });
    const headers = res.headers();
    expect(headers['access-control-allow-origin']).toBe('https://opensyber.cloud');
  });
});
