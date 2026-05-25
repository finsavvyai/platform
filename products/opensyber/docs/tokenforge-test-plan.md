# TokenForge — Complete Test Plan

**Updated:** March 24, 2026
**Site:** https://tokenforge.opensyber.cloud
**API:** https://tokenforge-api.opensyber.cloud

---

## Flow 1: First-Time Visitor → Landing Page

**URL:** https://tokenforge.opensyber.cloud

- [ ] Page loads without errors
- [ ] Hero: "Your auth stops at login. We protect everything after."
- [ ] Hero code preview shows obfuscated script tag (not readable source)
- [ ] "Get Started Free" button → /sign-in
- [ ] "Read the Docs" button → /docs
- [ ] Problem section: 3 threat cards (AiTM, XSS, Session Hijacking)
- [ ] How It Works: 3 steps (Add Script Tag, Add Server Middleware, Monitor)
- [ ] Trust Score: 7 signals, thresholds 80-100/40-79/0-39
- [ ] Code Examples: script tag + server middleware, title "Two Lines. That's It."
- [ ] Frameworks: 4 categories (Web, Mobile, AI Agents, Zero Code)
- [ ] Comparison table: TokenForge vs Google DBSC vs Cookies vs Fingerprinting
- [ ] Pricing: Free $0, Pro $49, Team $199, Enterprise Custom
- [ ] Pro/Team → LemonSqueezy checkout links
- [ ] Enterprise → mailto:sales@opensyber.cloud
- [ ] FAQ: 16 questions, all expand/collapse
- [ ] FAQ includes: "Does TokenForge block attacks or just alert?" → answer says BOTH
- [ ] FAQ includes: "Can I forward to SIEM?" → mentions CEF + 6 platforms
- [ ] FAQ includes: "Does it work with mobile?" → iOS/Android/RN SDKs
- [ ] FAQ includes: "Can AI agents use it?" → Python/Go/MCP
- [ ] FAQ includes: "Works behind VPN?" → yes
- [ ] Footer: copyright 2026, Pricing, Quick Start, SDKs, Blog links

---

## Flow 2: Sign Up → Onboarding → Dashboard

**Start:** Click "Get Started Free" on landing page

### Sign In Page
- [ ] URL: /sign-in
- [ ] Shows "Continue with Google" button with Google logo
- [ ] Shows "Continue with GitHub" button with GitHub logo
- [ ] Branded left panel with TokenForge messaging
- [ ] "No account? Sign in above — we'll create one automatically."

### OAuth Flow
- [ ] Click "Continue with Google" → Google OAuth consent screen
- [ ] After Google auth → redirects to /dashboard/onboarding (or /dashboard)
- [ ] Click "Continue with GitHub" → GitHub OAuth screen
- [ ] After GitHub auth → redirects to /dashboard/onboarding (or /dashboard)

### Onboarding Wizard
- [ ] URL: /dashboard (shows onboarding if no API key)
- [ ] Progress bar: ① Get Key → ② Copy Key → ③ Add Script
- [ ] Step labels visible under each circle
- [ ] Step 1: "Create your API key — One click. Free."
- [ ] Click "Generate API Key" → calls /public/provision
- [ ] Step 2: Shows API key with eye toggle (hidden by default)
- [ ] Click eye → reveals key (tf_xxx...)
- [ ] Click copy → copies to clipboard
- [ ] "Where will you use this key?" domain input (auto-suggests current hostname)
- [ ] Click "Next" → Step 3
- [ ] Step 3: Shows pre-filled script tag with the generated key
- [ ] "Done — Go to Dashboard" button → loads dashboard

### Dashboard (with data)
- [ ] Shows upgrade banner: "You're on the Free plan — Upgrade"
- [ ] 4 stat cards: Active Sessions, Verifications Today, Threats Blocked, Trust Score
- [ ] Usage chart (7-day trend)
- [ ] Plan usage progress bar with percentage
- [ ] Recent sessions list
- [ ] "View all" link to /dashboard/sessions

### Dashboard (no data yet)
- [ ] Shows "You're set up! Waiting for data..."
- [ ] "View Integration Guide" link

---

## Flow 3: Dashboard Navigation

### Sidebar
- [ ] TokenForge logo + name at top
- [ ] Nav items: Overview, Sessions, Events, Alerts, Zero-Code Proxy, Compliance, Settings, Quick Start
- [ ] User menu at bottom: profile picture, name, email
- [ ] Click user → shows "Sign out" button
- [ ] Sign out → redirects to landing page

### Sessions Page (/dashboard/sessions)
- [ ] Sortable table: Device ID, User ID, Trust Score, Status, Bound At, Actions
- [ ] Trust scores colored: green ≥80, amber ≥50, red <50
- [ ] Status badges: active (green), revoked (red), expired (amber)
- [ ] Sort by clicking column headers
- [ ] Pagination if >10 sessions
- [ ] Empty state: "No sessions yet"

### Events Page (/dashboard/events)
- [ ] Event feed with severity badges (info blue, warning amber, critical red)
- [ ] Country code badges visible on each event (US, RU, DE, etc.)
- [ ] Expand button shows details: IP, country, device, metadata
- [ ] Type filter dropdown
- [ ] Severity filter dropdown
- [ ] Event count shown

### Alerts Page (/dashboard/alerts)
- [ ] Create alert rule form
- [ ] Condition dropdown: hijack_attempt, trust_drop, ip_change, geo_anomaly, session_revoked
- [ ] Channel: Email or Webhook radio
- [ ] Destination input
- [ ] Threshold field appears for trust_drop
- [ ] Create rule → appears in list
- [ ] Delete rule works

### Zero-Code Proxy Page (/dashboard/proxy)
- [ ] "Available on Team and Enterprise plans" label
- [ ] How it works: 3 steps
- [ ] "Your domain (what users visit)" input with placeholder
- [ ] "Your server URL (where your app actually runs)" input with helper text
- [ ] "Add Domain" button
- [ ] Active domains list with delete button
- [ ] Free/Pro users see plan restriction message

### Compliance Page (/dashboard/compliance)
- [ ] Monthly report: verifications, threats blocked, trust score
- [ ] Threat breakdown by type
- [ ] "Download PDF" button (window.print())

### Settings Page (/dashboard/settings)
- [ ] API Keys section:
  - [ ] Keys listed with name, hidden prefix (dots), eye toggle, copy button
  - [ ] Click eye → shows prefix (tf_xxx...)
  - [ ] Click copy → copies prefix to clipboard
  - [ ] Delete button → browser confirm dialog → key deleted
  - [ ] Domain badges under each key ("All domains allowed" or specific domains)
  - [ ] Pencil icon to edit domains
  - [ ] "Generate New Key" → modal with name + allowed domains input
- [ ] Webhooks section with URL + event checkboxes
- [ ] Trust Badge section with auto-filled embed code + copy button

### Quick Start Page (/dashboard/docs)
- [ ] Step 1: Script tag with user's actual API key pre-filled (one line)
- [ ] Step 2: Server middleware code examples
- [ ] Step 3: Verify it works

---

## Flow 4: Public Pages (No Auth Required)

### Docs (/docs)
- [ ] 3 integration options ranked by ease: DNS Proxy → Script Tag → npm
- [ ] DNS Proxy shows CNAME example (Team plan badge)
- [ ] Script Tag shows code block
- [ ] Server middleware shows Express/Next.js/Fastify
- [ ] "Sign Up Free" CTA
- [ ] Mobile & AI Agents section with SDK links

### Integration Guides (/docs/integrations)
- [ ] 7 web frameworks: React, Angular, Vue, Clerk, M365, Auth0, Firebase
- [ ] Jump nav links work
- [ ] Banner linking to Native SDKs page

### Native SDKs (/docs/integrations/native)
- [ ] 6 SDKs: Python, Go, MCP Server, Swift, Kotlin, React Native
- [ ] Each with install + code example
- [ ] MCP shows Claude Desktop, Cursor, Claude Code configs

### SIEM Guide (/docs/siem)
- [ ] Event payload format with CEF string example
- [ ] Guides: Splunk, Sentinel, Elastic, Datadog, Trellix, Cyrebro
- [ ] "Any other SIEM" section

### Blog (/blog)
- [ ] Blog index with 2 posts
- [ ] /blog/session-hijacking-after-mfa — article with CTA
- [ ] /blog/microsoft-365-session-security — article with code examples + comparison table

### Trust Page (/trust/test_user_123)
- [ ] No auth required
- [ ] "Protected by TokenForge" banner
- [ ] Stat cards: verifications, threats blocked, trust score, sessions
- [ ] "Powered by TokenForge" footer

---

## Flow 5: Payment

### Checkout
- [ ] Pro button on pricing → LemonSqueezy checkout loads
- [ ] Team button → different LemonSqueezy checkout
- [ ] Test card: 4242 4242 4242 4242, exp 12/29, CVC 123
- [ ] Discount code A3OTE0NW (if still active)

### Webhook
- [ ] POST /webhooks/lemonsqueezy with no signature → returns "missing_signature"
- [ ] After payment → webhook fires → tenant plan updated in D1

---

## Flow 6: API Health & Security

### Endpoints
- [ ] GET /health → {"status":"healthy"}
- [ ] GET / → API info with version
- [ ] GET /sdk.js → obfuscated JavaScript (charCode arrays, not readable)
- [ ] GET /badge.js → ~1.4KB JavaScript with "Protected by TokenForge"
- [ ] GET /public/trust/test_user_123 → trust stats JSON
- [ ] POST /webhooks/lemonsqueezy → "missing_signature"
- [ ] GET /v1/sessions (no auth) → "unauthorized"

### Security Headers
- [ ] x-content-type-options: nosniff
- [ ] x-frame-options: DENY
- [ ] strict-transport-security: max-age=31536000
- [ ] vary: Origin
- [ ] ratelimit-limit, ratelimit-remaining, ratelimit-reset present

### CORS
- [ ] Origin: https://tokenforge.opensyber.cloud → access-control-allow-origin set
- [ ] Origin: https://evil.com → NO access-control-allow-origin
- [ ] NO access-control-allow-credentials (disabled)
- [ ] X-TF-* headers in access-control-allow-headers

### Error Messages
- [ ] Invalid API key → "Invalid API key" (no schema details)
- [ ] Invalid request body → generic message (no Zod schema leak)
- [ ] 404 → "Not found" (no path leak)

---

## Flow 7: SDK Integration Test

### Script Tag on opensyber.cloud
- [ ] Open opensyber.cloud
- [ ] DevTools → Network → check for sdk.js request
- [ ] sdk.js loads successfully (200)
- [ ] DevTools → Application → IndexedDB → tokenforge_keys → device entry created
- [ ] Subsequent fetch() requests include X-TF-Signature header

### Script Tag on tokenforge.opensyber.cloud
- [ ] Same checks as above

---

## Flow 8: Sign Out & Re-Sign In

- [ ] Click user menu → "Sign out"
- [ ] Redirected to landing page
- [ ] Visit /dashboard → redirected to /sign-in
- [ ] Sign in again → onboarding shows (or dashboard if key persists in cookie)
- [ ] Generate new key or existing key loads
- [ ] Dashboard fully functional

---

## Cross-Browser
- [ ] Landing page renders in Chrome
- [ ] Landing page renders in Safari
- [ ] Landing page renders in Firefox
- [ ] Sign-in works in incognito mode
- [ ] FAQ accordion works across browsers
