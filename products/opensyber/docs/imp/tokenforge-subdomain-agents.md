# TokenForge — tokenforge.opensyber.cloud
> Subdomain of OpenSyber. Same Cloudflare account.
> Run agents TF-A, TF-B, TF-C in parallel.

---

## WHAT CHANGES FROM THE STANDALONE BUILD

```
URL:          tokenforge.opensyber.cloud (not tokenforge.dev)
Hosting:      Same Cloudflare Pages project as OpenSyber OR separate Pages app
Auth:         Share OpenSyber's Better Auth instance
DB:           Share OpenSyber's D1 instance (add TokenForge tables)
KV:           Share OpenSyber's KV namespace (prefix: tf:)
Design:       Identical dark theme — same CSS variables, same fonts
Nav:          "Part of OpenSyber" → links back to opensyber.cloud
Billing:      TokenForge Cloud tier flows through OpenSyber LemonSqueezy
```

---

# ═══════════════════════════════════
# AGENT TF-A — CLOUDFLARE SETUP
# DNS + routing + Cloudflare Pages
# ═══════════════════════════════════

```prompt
You are setting up tokenforge.opensyber.cloud on Cloudflare.
OpenSyber already runs on opensyber.cloud via Cloudflare Pages.

YOUR TASK: Route the tokenforge subdomain correctly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTION A — Separate Cloudflare Pages project
(Recommended: clean separation, independent deploys)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Create new Cloudflare Pages project: "tokenforge"
   Build command: npm run build
   Build output: .svelte-kit/cloudflare
   Root: packages/tokenforge-site/

2. Add custom domain in Cloudflare Pages:
   Custom domain: tokenforge.opensyber.cloud
   Cloudflare automatically adds the CNAME record

3. wrangler.toml for tokenforge site:
   name = "tokenforge"
   compatibility_date = "2026-01-01"

   [[d1_databases]]
   binding = "DB"
   database_name = "opensyber-db"    # SAME database as opensyber
   database_id = "[your-db-id]"

   [[kv_namespaces]]
   binding = "NONCES"
   id = "[your-kv-id]"              # SAME KV namespace

   [vars]
   OPENSYBER_URL = "https://opensyber.cloud"

4. Shared environment variables (copy from OpenSyber):
   BETTER_AUTH_SECRET (same — shared auth)
   BETTER_AUTH_URL = "https://tokenforge.opensyber.cloud"
   LEMONSQUEEZY_API_KEY (same billing)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTION B — Same Pages project, path-based
(Simpler but less clean)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add to opensyber.cloud's _redirects or Cloudflare routing:
  NOT recommended — subdomains should be separate deployments.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USE OPTION A. Now do the following:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: packages/tokenforge-site/
  This is a new SvelteKit project for tokenforge.opensyber.cloud
  Same stack as opensyber.cloud (SvelteKit 2, Svelte 5, Cloudflare adapter)

CREATE: packages/tokenforge-site/wrangler.toml
  [See config above — point to same D1 and KV as OpenSyber]

CREATE: packages/tokenforge-site/src/app.css
  Copy the design tokens from opensyber.cloud's app.css exactly:
    --bg: #05080F
    --surface: #0F1C32
    --blue: #1B6FFF
    --blue2: #4D94FF
    --cyan: #00D4FF
    --green: #00E5A0
    --amber: #F5A623
    --red: #FF4B4B
    --text: #EEF2FF
    --text2: #8B99B5
    --text3: #546070
    --border: rgba(255,255,255,0.07)
    --border2: rgba(255,255,255,0.13)
    --font-display: 'Syne', sans-serif
    --font-body: 'DM Sans', sans-serif
    --font-mono: 'DM Mono', monospace
  Import same Google Fonts as opensyber.cloud.

CREATE: packages/tokenforge-site/src/routes/+layout.svelte
  Include the TokenForge nav and footer.

  Nav:
    Left: TOKENFORGE (logo/wordmark)
    Center: How it works | Docs | Pricing
    Right: [opensyber.cloud ↗] [Sign in] [Start free]

    "Part of OpenSyber" chip (small, top-right of nav):
      Links to opensyber.cloud
      Style: subtle, --text3 color, border, hover highlight

  Footer:
    TOKENFORGE
    "Device-bound session security."
    "Part of the OpenSyber security ecosystem."
    [opensyber.cloud ↗]
    Links: Docs | GitHub | npm | Status
    "© 2026 OpenSyber. MIT License."


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CROSS-DOMAIN AUTH (shared Better Auth)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Since both sites share the same Better Auth instance:

In Better Auth config (shared):
  trustedOrigins: [
    'https://opensyber.cloud',
    'https://tokenforge.opensyber.cloud',
    'http://localhost:5173',
    'http://localhost:5174',
  ]

Cookies must be set with:
  domain: '.opensyber.cloud'  ← note the leading dot
  This allows the session cookie to work on both subdomains.

In tokenforge-site Better Auth client:
  baseURL: 'https://opensyber.cloud'  ← auth lives on main domain
  This means sign-in redirects to opensyber.cloud/sign-in,
  which is correct — one login for the whole ecosystem.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
D1 MIGRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TokenForge tables go into the SAME opensyber D1 database.
Run the migration against opensyber-db:

wrangler d1 execute opensyber-db \
  --file=packages/tokenforge/migrations/0001_init.sql \
  --remote

The tables (device_sessions, security_events, nonce_log,
step_up_challenges) join the existing OpenSyber tables.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KV NAMESPACE PREFIXING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TokenForge nonces share the OpenSyber KV namespace.
Use prefix: "tf:nonce:" to avoid collisions.

In the server middleware, all KV keys become:
  `tf:nonce:${nonce}` instead of `nonce:${nonce}`

Update src/server/middleware.ts:
  const nonceKey = `tf:nonce:${request.nonce}`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPLOY COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Development:
  cd packages/tokenforge-site
  npm run dev -- --port 5174  # opensyber runs on 5173

Deploy:
  cd packages/tokenforge-site
  npm run build
  wrangler pages deploy .svelte-kit/cloudflare \
    --project-name=tokenforge \
    --branch=main

Or push to GitHub and let Cloudflare Pages auto-deploy.

WHEN DONE: output "AGENT TF-A COMPLETE — subdomain configured"
```

---

# ═══════════════════════════════════
# AGENT TF-B — FULL SITE BUILD
# packages/tokenforge-site/src/routes/
# ═══════════════════════════════════

```prompt
You are building the TokenForge product site at tokenforge.opensyber.cloud.
It is a SvelteKit 2 + Svelte 5 app. Same dark theme as opensyber.cloud.
Same CSS variables. Same fonts (Syne + DM Sans + DM Mono).

This is a subdomain of OpenSyber — position it as a sibling product,
not a separate company. "Part of the OpenSyber security ecosystem."

ALL URLS in this site use tokenforge.opensyber.cloud.
SDK API calls point to: https://tokenforge.opensyber.cloud/api/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE 1 — HOMEPAGE
src/routes/+page.svelte
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<svelte:head>
  <title>TokenForge — Device-Bound Session Security | OpenSyber</title>
  <meta name="description" content="MFA protects the login. TokenForge protects everything after. Cryptographically bind sessions to devices using ECDSA P-256. Part of the OpenSyber security ecosystem." />
</svelte:head>

SECTION 1 — INCIDENT BADGE + HERO:

  Incident badge (same red pill style as opensyber.cloud):
    "74% of 2025 breaches involved compromised identities — Expel Research"

  Eyebrow: "Session Security"

  Headline:
    "Stolen tokens are worthless."

  Subline:
    "MFA protects the login.
     TokenForge protects everything after.
     Cryptographically bind every session to the device that created it.
     A stolen cookie without the device key fails — instantly."

  CTAs:
    [npm install @tokenforge/client →]
    [See how it works →]

  Below CTAs:
    "MIT licensed. Free forever.
     Cloud monitoring from $49/mo."

  Visual — side-by-side attack comparison:

    Column A: WITHOUT TOKENFORGE
      Background: subtle red tint
      Steps (animated, appearing one by one):
        1. User logs in with MFA ✓
        2. Attacker runs AiTM proxy
        3. Session cookie captured
        4. Cookie used from attacker machine
        5. ✓ Valid session — system can't tell
        6. 🔓 BREACHED — MFA irrelevant

    Column B: WITH TOKENFORGE
      Background: subtle green tint
      Same steps:
        1. User logs in with MFA ✓
        2. Attacker runs AiTM proxy
        3. Session cookie captured
        4. Cookie used from attacker machine
        5. ✗ No device signature
        6. 🛡 Score: 0/100 — Revoked


SECTION 2 — THE PROBLEM:

  Headline: "MFA doesn't protect your sessions."

  The AiTM attack — numbered steps:
    01. Attacker registers phishing domain (e.g. secure-login-yourcompany.com)
    02. Victim clicks phishing link, sees real login page (reverse proxy)
    03. Victim enters credentials + completes MFA authenticator
    04. Everything forwarded to real site — login succeeds
    05. Attacker captures POST-MFA session cookie
    06. Cookie used from attacker's machine in another country
    07. Your system sees: valid session, valid cookie, correct scopes
    08. MFA was completed — but by the legitimate user, not the attacker

  Three real numbers (large, impactful):
    74%   of 2025 breaches involved compromised credentials
    $200  cost of AiTM phishing kit on dark web markets
    17min average time to abuse a stolen session token


SECTION 3 — HOW IT WORKS (3 steps):

  Step 1: User logs in (any auth provider)
    Better Auth, Clerk, Auth0, Supabase, custom — all work.
    TokenForge doesn't replace your auth.

  Step 2: Non-extractable keypair generated
    ECDSA P-256 via Web Crypto API.
    Private key: false = non-extractable.
    Cannot be read by JavaScript. Cannot be stolen by XSS.
    Public key sent to tokenforge.opensyber.cloud for registration.

  Step 3: Every request is signed
    Cookie + ECDSA signature over nonce + timestamp.
    Server verifies. Trust score calculated.
    Stolen cookie without device key → score 0 → revoked.


SECTION 4 — TRUST SCORE DEMO (interactive):

  Headline: "Seven signals. One score. No exceptions."

  Build TrustScoreDemo.svelte component:

    let signals = {
      signatureValid:  { label: 'Signature Valid', weight: 40, value: true },
      ipMatch:         { label: 'IP Consistent', weight: 15, value: true },
      geoMatch:        { label: 'Geo Consistent', weight: 15, value: true },
      userAgentMatch:  { label: 'Browser Match', weight: 10, value: true },
      velocityNormal:  { label: 'Velocity Normal', weight: 10, value: true },
      timeOfDay:       { label: 'Time of Day', weight: 5, value: true },
      nonceFresh:      { label: 'Nonce Fresh', weight: 5, value: true },
    }

    $: score = signals.signatureValid.value
      ? Object.values(signals).reduce((sum, s) => sum + (s.value ? s.weight : 0), 0)
      : 0

    $: action = score >= 80 ? 'ALLOW'
      : score >= 60 ? 'FLAG'
      : score >= 40 ? 'STEP-UP'
      : 'REVOKE'

    $: actionColor = action === 'ALLOW' ? 'var(--green)'
      : action === 'FLAG' ? 'var(--amber)'
      : 'var(--red)'

  UI layout:
    Left column: 7 toggle rows (signal name + weight + on/off switch)
    Right column: large score ring + action badge

  Score ring (SVG circle):
    Radius changes color green→amber→red as score changes
    Number in center: large, bold, animates on change
    Action badge below: ALLOW / FLAG / STEP-UP / REVOKE

  Toggle styling: ON = green, OFF = gray

  Note below demo:
    "Toggle 'Signature Valid' off to see what happens
     when a stolen cookie is used from another machine."

  Score ring component (SVG):
    <svg width="180" height="180" viewBox="0 0 180 180">
      <!-- Background circle -->
      <circle cx="90" cy="90" r="70"
        fill="none" stroke="var(--border2)" stroke-width="12" />
      <!-- Score arc — calculate stroke-dashoffset from score -->
      <circle cx="90" cy="90" r="70"
        fill="none"
        stroke={actionColor}
        stroke-width="12"
        stroke-linecap="round"
        stroke-dasharray="{2 * Math.PI * 70}"
        stroke-dashoffset="{2 * Math.PI * 70 * (1 - score/100)}"
        transform="rotate(-90 90 90)"
        style="transition: all 0.4s ease"
      />
      <!-- Score number -->
      <text x="90" y="85" text-anchor="middle"
        font-family="Syne" font-size="42" font-weight="800"
        fill={actionColor} style="transition: fill 0.4s">
        {score}
      </text>
      <text x="90" y="110" text-anchor="middle"
        font-family="DM Sans" font-size="14"
        fill="var(--text3)">
        / 100
      </text>
    </svg>

  Action badge below ring:
    <div class="action-badge" style="border-color: {actionColor}; color: {actionColor}">
      {action}
    </div>


SECTION 5 — WHAT IT STOPS:

  4 attack cards:

  Card 1: AiTM Session Hijacking
    Icon: 🎣
    Attack: Reverse proxy captures session cookie after MFA
    TokenForge: Stolen cookie fails signature check — score 0 — revoked
    Severity: CRITICAL

  Card 2: XSS Token Theft
    Icon: 💉
    Attack: Malicious script reads document.cookie
    TokenForge: Private key is non-extractable — JS cannot read it
    Result: Cookie stolen but requests can't be signed → useless

  Card 3: Infostealer Malware
    Icon: 🦠
    Attack: Malware exfiltrates browser cookies and localStorage
    TokenForge: IndexedDB keys are origin-bound and non-extractable
    Result: Stolen files contain no usable private key

  Card 4: Credential Stuffing
    Icon: 📋
    Attack: Breached credentials replayed from other services
    TokenForge: New login = new device binding required
    Result: Login succeeds but first request without device key → flagged


SECTION 6 — QUICK START:

  Headline: "Four lines of code. Zero new infrastructure."

  Tab 1: npm
  npm install @tokenforge/client

  Tab 2: Client (SvelteKit / React / Vanilla)
  import { createTokenForge } from '@tokenforge/client'

  const tf = createTokenForge({
    apiBase: 'https://tokenforge.opensyber.cloud',
    getSessionId: () => getCookie('better-auth.session_token'),
    onStepUpRequired: (reason) => showReauthModal(reason),
    onSessionRevoked: () => { signOut(); toast.error('Session security event') },
  })

  // Call once after user logs in
  await tf.init()

  // Done — all fetch() calls are now cryptographically signed

  Tab 3: Server (Hono / Cloudflare Workers)
  import { tokenForgeMiddleware } from '@tokenforge/server'

  app.use('/api/*', tokenForgeMiddleware({
    db: env.DB,
    nonces: env.NONCES,
    getSessionId: (c) => getCookie(c, 'better-auth.session_token'),
    sensitiveOps: ['/api/payments', '/api/admin'],
  }))

  Subtext: "Works with Better Auth, Clerk, Auth0, Supabase, and custom auth."


SECTION 7 — PRICING:

  Headline: "Protect every session."

  Three tiers:

  OPEN SOURCE ($0 forever)
    npm package — MIT license
    Self-hosted server middleware
    Unlimited users and requests
    Full source code on GitHub
    Community support
    [npm install @tokenforge/client]

  CLOUD ($49/month)
    Hosted TokenForge API (tokenforge.opensyber.cloud)
    Real-time dashboard: sessions, trust scores, events
    Slack + PagerDuty alerts on anomalies and revocations
    Compliance-ready audit logs (SOC 2 compatible)
    Geo-restriction policies
    99.9% SLA
    Email support (24h)
    [Start free trial — 14 days]

  ENTERPRISE (via OpenSyber Enterprise — $2,499/mo)
    All Cloud features
    Custom data residency
    SAML SSO
    Dedicated support + 1h SLA
    Custom trust policies per org
    WORM audit trail (legally defensible)
    [Contact sales]

  Note:
    "TokenForge Cloud is included in OpenSyber Professional and above.
     If you're already an OpenSyber customer, you're already covered."
    [See OpenSyber plans →]


SECTION 8 — ECOSYSTEM CALLOUT:

  "Part of the OpenSyber security ecosystem."

  Two product cards side by side:

    [OpenSyber]
    Runtime security for AI agents.
    Monitors what your AI agents do.
    opensyber.cloud

    [TokenForge] ← current
    Device-bound session security.
    Protects the sessions of the humans using AI agents.
    tokenforge.opensyber.cloud

  Tagline:
    "Together: complete protection from the session to the agent."


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE 2 — DOCS
src/routes/docs/+page.svelte
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Left sidebar navigation:
  Getting Started
  How It Works
  Client SDK
  Server Middleware
  Trust Score
  Step-Up Auth
  Browser Support
  Framework Examples
  FAQ

Main content: render from markdown files in src/lib/docs/

Key sections to build:

GETTING STARTED:
  5-minute quickstart
  Prerequisites: Cloudflare D1 + KV, any auth provider
  Full working example with every file shown

CLIENT SDK REFERENCE:
  createTokenForge(config) — all options with types and defaults
  tf.init() — what it does, when to call it
  tf.signRequest(request) — manual signing
  tf.getDeviceId() — returns current device ID
  tf.isBound() — check if session is bound
  tf.clearKeys() — call on logout
  tf.rebind() — force re-binding (after step-up)
  useTokenForge(config) — React hook

SERVER MIDDLEWARE REFERENCE:
  tokenForgeMiddleware(options) — all options
  Trust score thresholds — how to customize
  sensitiveOps — require score >= 90 for specific paths
  skipPaths — bypass signing for public endpoints
  getSessionId — how to extract session from cookie/header

TRUST SCORE:
  All 7 signals with weights
  Score → action table
  How to customize thresholds
  What triggers step-up vs revoke

STEP-UP AUTH FLOW:
  When it triggers
  What the client receives (challengeToken)
  How to show re-auth modal
  How to complete step-up (POST /api/tokenforge/step-up)
  Complete example with code


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE 3 — DASHBOARD
src/routes/dashboard/+page.svelte
(requires auth — redirect to opensyber.cloud/sign-in if not logged in)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Header cards:
  Active sessions: N
  Average trust score: 94/100
  Step-ups triggered today: N
  Sessions revoked this week: N

Sessions table:
  Device ID (truncated) | User | Last seen | Trust score | IP | Country | Status
  Row colors: green (active, score>80), amber (flagged, 60-80), red (revoked)
  Click row → session detail page

Session detail (/dashboard/sessions/[deviceId]):
  All security events for this session
  Trust score history sparkline
  IP/geo history
  [Revoke this session] button


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHARED STYLES (critical for consistency)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The TokenForge site must look like it belongs to the same
family as opensyber.cloud. Use the same:
  - CSS custom properties (listed in Agent TF-A)
  - Font imports (Syne + DM Sans + DM Mono from Google Fonts)
  - Grid background pattern (lines at rgba(27,111,255,0.03))
  - Card style (--surface bg, --border2 border, 14-18px radius)
  - Button style (--blue bg, white text, hover glow)
  - Severity badge colors (red/amber/green)
  - Section structure (eyebrow → headline → subline → CTA)
  - keyframe animations (fadeUp, pulse)

DO NOT use different fonts or colors.
A user moving between opensyber.cloud and tokenforge.opensyber.cloud
should feel they're in the same product family.

WHEN DONE: verify at localhost:5174:
  ✓ Homepage loads with dark theme matching opensyber.cloud
  ✓ "Part of OpenSyber" chip in nav
  ✓ Incident badge shows
  ✓ Side-by-side attack comparison animates
  ✓ Trust score demo is interactive — toggles update score
  ✓ Score ring SVG animates on change
  ✓ Quick start tabs switch between npm/client/server
  ✓ Pricing shows 3 tiers
  ✓ Ecosystem section links back to opensyber.cloud
  ✓ /docs page loads with sidebar nav

Output: "AGENT TF-B COMPLETE — tokenforge.opensyber.cloud site built"
```

---

# ═══════════════════════════════════
# AGENT TF-C — CROSS-SITE INTEGRATION
# Link OpenSyber ↔ TokenForge properly
# ═══════════════════════════════════

```prompt
You are connecting opensyber.cloud and tokenforge.opensyber.cloud.
The two sites need to feel like one ecosystem. Users on either site
should be aware of — and able to navigate to — the other.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 1 — opensyber.cloud homepage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: opensyber.cloud/src/routes/+page.svelte

Add an "Ecosystem" section near the bottom (before the final CTA):

<section class="ecosystem-section">
  <div class="container">
    <div class="section-eyebrow">The OpenSyber Ecosystem</div>
    <h2 class="section-title">
      Two products.<br>
      <em>Full stack protection.</em>
    </h2>
    <p class="section-sub">
      AI agents create two new attack surfaces.
      What the agents do. And the sessions of the humans commanding them.
      OpenSyber and TokenForge close both.
    </p>

    <div class="ecosystem-grid">

      <div class="ecosystem-card active">
        <div class="eco-badge">You are here</div>
        <div class="eco-icon">🛡</div>
        <div class="eco-name">OpenSyber</div>
        <div class="eco-url">opensyber.cloud</div>
        <div class="eco-desc">
          Runtime security for AI agents.
          Monitors what Claude Code, Cursor, and Windsurf actually do —
          every file access, every network call, every secret read.
        </div>
        <div class="eco-coverage">
          Protects: AI agent actions
        </div>
      </div>

      <a href="https://tokenforge.opensyber.cloud" class="ecosystem-card link">
        <div class="eco-icon">🔑</div>
        <div class="eco-name">TokenForge</div>
        <div class="eco-url">tokenforge.opensyber.cloud</div>
        <div class="eco-desc">
          Device-bound session security.
          Makes stolen session tokens worthless by binding them
          to the device that created them via ECDSA P-256.
        </div>
        <div class="eco-coverage">
          Protects: Developer sessions
        </div>
        <div class="eco-link-indicator">Visit TokenForge →</div>
      </a>

    </div>

    <div class="ecosystem-tagline">
      "Together: from the moment your developer logs in
       to the last request their AI agent makes."
    </div>
  </div>
</section>

Styles:
.ecosystem-section { padding: 80px 0; border-top: 1px solid var(--border); }
.ecosystem-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 20px; margin-top: 48px; margin-bottom: 32px;
}
.ecosystem-card {
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: 18px; padding: 28px; position: relative;
  display: flex; flex-direction: column; gap: 10px;
}
.ecosystem-card.link {
  text-decoration: none; cursor: pointer;
  transition: transform .2s, border-color .2s, box-shadow .2s;
}
.ecosystem-card.link:hover {
  transform: translateY(-3px);
  border-color: rgba(27,111,255,.35);
  box-shadow: 0 16px 48px rgba(0,0,0,.3);
}
.ecosystem-card.active { border-color: rgba(0,229,160,.25); }
.eco-badge {
  position: absolute; top: 16px; right: 16px;
  font-size: 10px; font-weight: 700; padding: 3px 8px;
  border-radius: 4px; background: rgba(0,229,160,.1);
  border: 1px solid rgba(0,229,160,.2); color: var(--green);
  letter-spacing: .06em;
}
.eco-icon { font-size: 28px; }
.eco-name {
  font-family: var(--font-display); font-size: 22px;
  font-weight: 800; color: var(--text); letter-spacing: -.03em;
}
.eco-url { font-size: 12px; color: var(--text3); font-family: var(--font-mono); }
.eco-desc { font-size: 14px; color: var(--text2); line-height: 1.6; flex: 1; }
.eco-coverage {
  font-size: 12px; font-weight: 600; color: var(--blue2);
  padding-top: 10px; border-top: 1px solid var(--border);
}
.eco-link-indicator { font-size: 13px; color: var(--blue2); font-weight: 600; }
.ecosystem-tagline {
  text-align: center; font-size: 15px; color: var(--text3);
  font-style: italic; padding: 20px 0;
}
@media (max-width: 700px) {
  .ecosystem-grid { grid-template-columns: 1fr; }
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 2 — opensyber.cloud nav
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: opensyber.cloud/src/lib/components/Nav.svelte

Add a subtle "ecosystem" indicator in the nav:

After the main nav links, before Sign In:
  <a href="https://tokenforge.opensyber.cloud" class="nav-ecosystem-link">
    TokenForge ↗
  </a>

Style:
.nav-ecosystem-link {
  font-size: 12px; color: var(--text3); text-decoration: none;
  border: 1px solid var(--border); border-radius: 6px;
  padding: 4px 10px; transition: all .2s;
}
.nav-ecosystem-link:hover {
  color: var(--blue2); border-color: rgba(27,111,255,.3);
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 3 — opensyber.cloud marketplace skill
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update the "Session Integrity (TokenForge)" skill card
to link to tokenforge.opensyber.cloud correctly.

FILE: opensyber.cloud/src/lib/data/skills.ts

  {
    slug: 'session-integrity',
    name: 'Session Integrity',
    icon: '🔑',
    category: 'security',
    version: '1.0.0',
    missionLine: 'Makes stolen session tokens worthless.',
    description: 'Powered by TokenForge. Cryptographically binds every developer session to their device using ECDSA P-256 keypairs. A stolen authentication cookie cannot make a single request without the device-bound private key.',
    incidentTag: 'AiTM session hijacking',
    incidentSeverity: 'critical',
    sourceLabel: 'SDK integration (npm install)',
    sourceType: 'sdk',
    planRequired: 'professional',
    externalUrl: 'https://tokenforge.opensyber.cloud',  // ← add this field
    externalLabel: 'Powered by TokenForge',             // ← add this field
  }

On the skill card: show "Powered by TokenForge →" link
On the detail page (/marketplace/session-integrity):
  Add a prominent callout:
  "This skill is powered by TokenForge, the OpenSyber session security product.
   Full docs and dashboard at tokenforge.opensyber.cloud"
  [Visit TokenForge ↗]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 4 — opensyber.cloud pricing page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: opensyber.cloud/src/routes/pricing/+page.svelte

In the Professional tier feature list, add:
  ✓ TokenForge Cloud included
    (session integrity monitoring at tokenforge.opensyber.cloud)

In the Enterprise tier feature list:
  ✓ TokenForge Enterprise included
    (custom trust policies, dedicated audit trail)

Below the pricing tiers, add a note:
  <div class="tokenforge-note">
    <span class="tf-icon">🔑</span>
    <div>
      <strong>TokenForge is included from Professional tier.</strong>
      Device-bound session security for your developers.
      <a href="https://tokenforge.opensyber.cloud">
        Learn about TokenForge →
      </a>
    </div>
  </div>

Styles:
.tokenforge-note {
  display: flex; gap: 12px; align-items: flex-start;
  background: rgba(27,111,255,.06); border: 1px solid rgba(27,111,255,.15);
  border-radius: 10px; padding: 16px 20px; margin-top: 24px;
  font-size: 14px; color: var(--text2);
}
.tokenforge-note strong { color: var(--text); }
.tokenforge-note a { color: var(--blue2); text-decoration: none; font-weight: 600; }


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 5 — shared meta tags
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add to tokenforge.opensyber.cloud app.html:
  <meta property="og:site_name" content="OpenSyber" />
  This tells social platforms it's part of the OpenSyber family.

Add canonical links to avoid duplicate content:
  tokenforge.opensyber.cloud canonical = itself (not opensyber.cloud)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 6 — opensyber.cloud footer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add to the OpenSyber footer under a "Ecosystem" section:
  TokenForge → tokenforge.opensyber.cloud
  "Device-bound session security"


WHEN DONE: verify:
  ✓ opensyber.cloud shows ecosystem section with 2 product cards
  ✓ opensyber.cloud nav has "TokenForge ↗" link
  ✓ opensyber.cloud marketplace shows Session Integrity skill
  ✓ opensyber.cloud pricing mentions TokenForge on Pro+ tiers
  ✓ tokenforge.opensyber.cloud links back to opensyber.cloud
  ✓ tokenforge.opensyber.cloud ecosystem section shows both products
  ✓ nav on tokenforge has "Part of OpenSyber" chip

Output: "AGENT TF-C COMPLETE — cross-site integration done"
```

---

# ═══════════════════════════════════
# MERGE — TOKENFORGE SUBDOMAIN
# Run after TF-A, TF-B, TF-C complete
# ═══════════════════════════════════

```prompt
All TF agents complete. Verify the subdomain setup.

DNS + ROUTING:
  ✓ tokenforge.opensyber.cloud resolves in browser
  ✓ Cloudflare Pages project "tokenforge" exists
  ✓ Custom domain configured in Pages settings
  ✓ SSL certificate provisioned (automatic via Cloudflare)

SITE:
  ✓ tokenforge.opensyber.cloud loads homepage
  ✓ Dark theme matches opensyber.cloud exactly
  ✓ Same fonts (Syne + DM Sans + DM Mono)
  ✓ "Part of OpenSyber" chip visible in nav
  ✓ Trust score demo interactive — toggles work
  ✓ Score ring SVG animates smoothly
  ✓ /docs loads with sidebar nav
  ✓ /dashboard redirects to sign-in if not authenticated

AUTH:
  ✓ Signing in via opensyber.cloud works on tokenforge.opensyber.cloud
  ✓ Cookie domain is .opensyber.cloud (shared)
  ✓ Better Auth trustedOrigins includes both domains

DATABASE:
  ✓ TokenForge tables exist in opensyber D1
  ✓ device_sessions table has data after test binding
  ✓ security_events table logs entries
  ✓ KV nonce keys use tf:nonce: prefix

SDK:
  ✓ @tokenforge/client npm package builds without errors
  ✓ generateKeyPair() uses false (non-extractable) — CRITICAL
  ✓ signChallenge() produces valid base64url signature
  ✓ @tokenforge/server middleware verifies signatures correctly

CROSS-SITE:
  ✓ opensyber.cloud shows ecosystem section (2 product cards)
  ✓ opensyber.cloud nav has "TokenForge ↗" link
  ✓ opensyber.cloud pricing mentions TokenForge on Pro+ tiers
  ✓ Session Integrity skill links to tokenforge.opensyber.cloud
  ✓ tokenforge.opensyber.cloud ecosystem section links to opensyber.cloud

If all pass, output:

════════════════════════════════════════
🔑 TOKENFORGE LIVE AT
   tokenforge.opensyber.cloud
════════════════════════════════════════

SUBDOMAIN:
  ✓ tokenforge.opensyber.cloud — live on Cloudflare
  ✓ SSL provisioned automatically
  ✓ Same D1 database as OpenSyber
  ✓ Shared auth (.opensyber.cloud cookie)
  ✓ KV nonces with tf: prefix

PRODUCT:
  ✓ Homepage with interactive trust score demo
  ✓ AiTM attack explanation
  ✓ 4-line quick start
  ✓ Free / Cloud ($49/mo) / Enterprise pricing
  ✓ Docs page with full SDK reference

SDK:
  ✓ @tokenforge/client — MIT, npm-ready
  ✓ @tokenforge/server — Hono middleware
  ✓ Non-extractable ECDSA P-256 confirmed

ECOSYSTEM:
  ✓ opensyber.cloud ↔ tokenforge.opensyber.cloud linked
  ✓ Shared auth, shared billing, shared DB
  ✓ Consistent design language
  ✓ TokenForge Cloud included in OpenSyber Pro+

NEXT ACTIONS:
  1. npm publish @tokenforge/client (MIT)
  2. npm publish @tokenforge/server (MIT)
  3. HN: "Show HN: tokenforge.opensyber.cloud —
         stolen session cookies made worthless
         with a non-extractable browser key"
  4. Add TokenForge Cloud to OpenSyber LemonSqueezy
     as a product add-on for Professional tier
  5. Tweet: "We just shipped tokenforge.opensyber.cloud.
             MFA protects the login.
             TokenForge protects everything after."
════════════════════════════════════════
```

---

## THE THREE-AGENT PARALLEL MAP

```
TF-A  Cloudflare setup, DNS, shared auth, D1 migration
TF-B  Full product site (tokenforge.opensyber.cloud)
TF-C  Cross-site integration (opensyber.cloud ↔ tokenforge)

All three run in parallel.
Merge agent runs after all three confirm complete.

Estimated time: 45 minutes parallel
```

## WHY SUBDOMAIN IS THE RIGHT CALL

```
tokenforge.opensyber.cloud tells the world:

  1. This is part of the OpenSyber family
     (credibility transfer from the main product)

  2. It's a distinct product with its own URL
     (can be marketed, linked, and referenced independently)

  3. Shared infrastructure = zero extra cost
     (same Cloudflare account, same D1, same KV, same billing)

  4. One login for both products
     (.opensyber.cloud cookie domain)

  5. SEO authority flows from opensyber.cloud
     (subdomain inherits some of the domain's reputation)

Compare to tokenforge.dev:
  - New domain = zero authority
  - Separate Cloudflare account = separate billing
  - Separate auth = users need two logins
  - No connection to OpenSyber brand
  - More expensive, less coherent

tokenforge.opensyber.cloud is the right call.
```

## THE HN POST (ready to paste)

```
Title:
  Show HN: We made stolen session cookies worthless
  (tokenforge.opensyber.cloud)

Body:
  AiTM phishing bypasses MFA in under 2 minutes by capturing
  the session cookie after authentication completes. The attacker
  uses your cookie from their machine. Your system sees a valid
  authenticated session and can't tell the difference.

  TokenForge fixes this with one Web Crypto API trick:

    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,  // NON-EXTRACTABLE — the entire security model
      ['sign', 'verify']
    )

  That `false` means the private key can never be read by
  JavaScript. XSS can't steal it. Browser extensions can't
  steal it. Infostealer malware can't steal it. It can only
  be used for signing operations within the browser's
  crypto engine.

  Every request includes an ECDSA signature over a nonce.
  A stolen cookie without the device key fails with score 0.
  Session revoked in the same request.

  npm install @tokenforge/client
  (MIT license, 4 lines of code)

  tokenforge.opensyber.cloud — part of the OpenSyber
  AI agent security ecosystem.

  Happy to go deep on the Web Crypto non-extractable
  key mechanics if anyone's interested.
```
