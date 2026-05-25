# OpenSyber — Mission Reframe
> Claude Code Agent Prompts
> Run in parallel. Each agent owns one domain.
> Based on live audit of opensyber.cloud — March 28, 2026

---

## CONTEXT FOR ALL AGENTS

```
Stack: SvelteKit 2.15 + Svelte 5 → Cloudflare Pages
API: Hono 4 → Cloudflare Workers
DB: Cloudflare D1 + Drizzle ORM
Auth: Better Auth
Billing: LemonSqueezy
Email: Resend / Twilio

Design tokens (from app.css):
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
  --font-display: 'Syne'
  --font-body: 'DM Sans'
  --font-mono: 'DM Mono'

Mission reframe principle:
  OLD: "Secure Managed AI Agent Hosting" (product)
  NEW: "Runtime Security for AI Agents" (mission)
  OLD: features listed, prices shown
  NEW: consequences first, prices as obvious conclusion
  OLD: $49/$149/$399 (dev tool pricing)
  NEW: $0/$299/$799/$2499/$9999 (security platform pricing)
```

---

# ══════════════════════════════════════
# AGENT A — HOMEPAGE MISSION REFRAME
# File: src/routes/+page.svelte
# ══════════════════════════════════════

```prompt
You are updating opensyber.cloud. The site exists and works.
You are making targeted surgical changes to reframe it from
a SaaS product to a security mission. Do not rebuild — replace
specific sections with the exact copy below.

FILE: src/routes/+page.svelte

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 1 — PAGE TITLE + META
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the <svelte:head> block. Replace title and meta description:

FROM:
  <title>OpenSyber — Secure Managed AI Agent Hosting</title>
  [any existing meta description]

TO:
  <title>OpenSyber — Runtime Security for AI Agents</title>
  <meta name="description" content="The Trivy attack ran for 12 hours before anyone noticed. 45 organizations had their secrets stolen. OpenSyber exists so that doesn't happen to you." />
  <meta property="og:title" content="OpenSyber — Runtime Security for AI Agents" />
  <meta property="og:description" content="AI agents have no sheriff. We watch them. Runtime security for Claude Code, Cursor, Windsurf, and every MCP server you run." />


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 2 — EYEBROW LABEL ABOVE HERO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the small label above the hero headline.
Currently says: "Runtime Security Platform"

Replace with this component:

<div class="incident-badge">
  <span class="incident-dot"></span>
  Trivy attack: March 19, 2026 — 45 organizations compromised
  <a href="/blog/trivy-supply-chain-attack" class="incident-link">
    Are you protected? →
  </a>
</div>

Add these styles:
.incident-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 100px;
  background: rgba(255,75,75,0.08);
  border: 1px solid rgba(255,75,75,0.3);
  font-size: 12px;
  font-weight: 500;
  color: var(--red);
  margin-bottom: 24px;
  letter-spacing: 0.02em;
  animation: fadeUp 0.5s ease both;
}
.incident-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--red);
  box-shadow: 0 0 8px var(--red);
  animation: pulse 1.5s ease-in-out infinite;
  flex-shrink: 0;
}
.incident-link {
  color: var(--red);
  text-decoration: none;
  font-weight: 600;
  border-left: 1px solid rgba(255,75,75,0.3);
  padding-left: 8px;
  margin-left: 4px;
}
.incident-link:hover { text-decoration: underline; }


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 3 — HERO HEADLINE + SUBLINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the <h1> tag in the hero section.

FROM: (any variation of)
  "OPENSYBER"
  "Deploy on hardened infrastructure. Monitor every action. Stop threats in real time."

TO:
  <h1 class="hero-title">
    Your AI agents<br>have no sheriff.
    <em>We watch them.</em>
  </h1>
  <p class="hero-sub">
    AI agents run your code, access your credentials, and call the internet.
    The Trivy attack proved they can be weaponized — silently, for 12 hours,
    across 45 organizations — with no one noticing.
    OpenSyber is the runtime security layer that watches every action.
  </p>


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 4 — HERO CTAs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the CTA buttons below the hero headline.

FROM:
  [Start Free] [See Live Demo]
  "Free forever. No credit card. Deploy in 60 seconds."

TO:
  <div class="hero-actions">
    <a href="/sign-up" class="btn btn-primary btn-lg">
      Start free — takes 60 seconds
    </a>
    <a href="/blog/trivy-supply-chain-attack" class="btn btn-ghost btn-lg">
      See what Trivy would have done to you →
    </a>
  </div>
  <p class="hero-reassurance">
    Free forever. No credit card.
    <strong>The attack doesn't wait for procurement.</strong>
  </p>


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 5 — "THE PROBLEM" SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the section titled "ZERO VISIBILITY" or "The Problem".
Keep the before/after terminal demo — it is the best section.
Change only the surrounding copy.

Heading from:  "ZERO VISIBILITY"
Heading to:    "The attack is happening right now."

Subtext from:  "AI agents run code, access credentials, and talk
               to the internet. Without monitoring, you are blind."
Subtext to:    "TeamPCP stole secrets from 45 organizations in 12 hours.
               Every pipeline that ran Trivy between March 19–23 was
               compromised. None of them knew until after.
               The before/after isn't hypothetical. This is exactly
               what the Trivy attack looked like."


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 6 — "THREE LAYERS" SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the section titled "THREE LAYERS" or "Protection".

Heading from: "THREE LAYERS"
Heading to:   "Three reasons the next attack won't reach you."


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 7 — "HOW IT WORKS" SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the "60 SECONDS" / "How It Works" section with 3 steps.

Heading from: "60 SECONDS"
Heading to:   "From exposed to protected in 60 seconds."

Step 01:
  FROM: "SIGN UP — Create your account. Free forever, no credit card."
  TO:   "CONNECT — Link your GitHub repos and agent environments.
         OpenSyber immediately scans for Trivy-class vulnerabilities."

Step 02:
  FROM: "DEPLOY — Launch a hardened agent instance in under 60 seconds."
  TO:   "DETECT — Every skill activates. IOC feed loads.
         You see your actual attack surface for the first time."

Step 03:
  FROM: "MONITOR — Real-time security score, events, and alerts from day one."
  TO:   "PROTECT — Compromised actions blocked. Credential access logged.
         Exfiltration attempts stopped before they leave your network."


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 8 — REMOVE FAKE TESTIMONIALS
         REPLACE WITH REAL ATTACK CARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the "OPERATOR REPORTS" / "Field Reports" section.
It contains testimonials from Sarah Chen, Marcus Williams, Elena Rodriguez.
DELETE THE ENTIRE SECTION.

Replace it with this new section:

<section class="attacks-section">
  <div class="container">
    <div class="section-eyebrow">What OpenSyber would have caught</div>
    <h2 class="section-title">
      Three real attacks.<br>
      <em>Three things that would have been stopped.</em>
    </h2>
    <p class="section-sub">
      These happened. The CVEs are published. The post-mortems are live.
      Here is exactly what OpenSyber blocks at each stage.
    </p>

    <div class="attack-grid">

      <div class="attack-card">
        <div class="attack-card-header">
          <div class="attack-meta">
            <span class="attack-date">March 19, 2026</span>
            <span class="attack-name">Trivy / TeamPCP</span>
          </div>
          <span class="severity-badge critical">CRITICAL</span>
        </div>
        <p class="attack-desc">
          TeamPCP poisoned 76 GitHub Action tags. 45 organizations ran
          the compromised scanner. Secrets exfiltrated in 12 hours.
          Zero detection. Advisory: GHSA-69fq-xp46-6x23.
        </p>
        <div class="attack-prevention">
          <span class="prevention-icon">🛡</span>
          <div>
            <div class="prevention-label">OpenSyber blocks this at Stage 2</div>
            <div class="prevention-desc">
              CI/CD Guardian pins all actions to SHA digests.
              When TeamPCP poisoned the tag, the SHA changed.
              The push would have been blocked. The pipeline never ran.
            </div>
          </div>
        </div>
        <a href="/blog/trivy-supply-chain-attack" class="attack-read-more">
          Read the full breakdown →
        </a>
      </div>

      <div class="attack-card">
        <div class="attack-card-header">
          <div class="attack-meta">
            <span class="attack-date">February 9, 2026</span>
            <span class="attack-name">Clinejection</span>
          </div>
          <span class="severity-badge high">HIGH</span>
        </div>
        <p class="attack-desc">
          A GitHub issue hijacked an AI code reviewer via prompt injection.
          5 million developers at risk. A malicious package installed on
          every machine that updated Cline during an 8-hour window.
        </p>
        <div class="attack-prevention">
          <span class="prevention-icon">🛡</span>
          <div>
            <div class="prevention-label">OpenSyber blocks this at the PR</div>
            <div class="prevention-desc">
              AI Prompt Guard scans every PR for instruction file changes.
              The poisoned CLAUDE.md would have been flagged.
              PR merge blocked. Maintainer alerted.
            </div>
          </div>
        </div>
        <a href="/blog/ai-agent-kill-chain" class="attack-read-more">
          Read the full breakdown →
        </a>
      </div>

      <div class="attack-card">
        <div class="attack-card-header">
          <div class="attack-meta">
            <span class="attack-date">March 22, 2026</span>
            <span class="attack-name">CanisterWorm / TeamPCP</span>
          </div>
          <span class="severity-badge critical">CRITICAL</span>
        </div>
        <p class="attack-desc">
          Stolen npm publish tokens spread malware to 47 packages.
          Every developer who ran npm install during the window
          was silently affected. Credentials exfiltrated to a Slack webhook.
        </p>
        <div class="attack-prevention">
          <span class="prevention-icon">🛡</span>
          <div>
            <div class="prevention-label">OpenSyber blocks this at install</div>
            <div class="prevention-desc">
              Supply Chain Guard checks every postinstall script.
              New packages matched against Socket.dev threat feed.
              The malicious package blocked before a single file runs.
            </div>
          </div>
        </div>
        <a href="/blog/trivy-supply-chain-attack" class="attack-read-more">
          Read the full breakdown →
        </a>
      </div>

    </div>
  </div>
</section>

ADD THESE STYLES:

.attacks-section { padding: 96px 0; }
.attack-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 48px;
}
.attack-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: transform .22s ease, border-color .22s;
}
.attack-card:hover {
  transform: translateY(-3px);
  border-color: rgba(255,75,75,0.3);
}
.attack-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.attack-meta { display: flex; flex-direction: column; gap: 3px; }
.attack-date { font-size: 11px; color: var(--text3); font-family: var(--font-mono); }
.attack-name { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text); }
.severity-badge {
  font-size: 10px; font-weight: 700;
  padding: 3px 8px; border-radius: 4px;
  letter-spacing: .06em; flex-shrink: 0;
}
.severity-badge.critical { background: rgba(255,75,75,.12); color: var(--red); border: 1px solid rgba(255,75,75,.2); }
.severity-badge.high { background: rgba(245,166,35,.1); color: var(--amber); border: 1px solid rgba(245,166,35,.2); }
.attack-desc {
  font-size: 13px; color: var(--text2);
  line-height: 1.65; flex: 1;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.attack-prevention {
  display: flex; gap: 10px; align-items: flex-start;
}
.prevention-icon { font-size: 16px; flex-shrink: 0; margin-top: 2px; }
.prevention-label {
  font-size: 12px; font-weight: 600;
  color: var(--green); margin-bottom: 4px;
}
.prevention-desc { font-size: 12px; color: var(--text3); line-height: 1.55; }
.attack-read-more {
  font-size: 12px; color: var(--blue2);
  text-decoration: none; font-weight: 600;
  margin-top: auto;
}
.attack-read-more:hover { text-decoration: underline; }
@media (max-width: 800px) {
  .attack-grid { grid-template-columns: 1fr; }
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 9 — FIX STATS BAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the stats section with: 15+ | 7 | 39 | <60s

Change:
  "39 Integrations"  →  "847+" with label "IOCs in threat feed"
  "7 Compliance Frameworks"  →  "5 Compliance Frameworks"
  "<60s Deploy Time"  →  "<60s Time to protect"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 10 — BOTTOM CTA SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the bottom CTA section.
Currently: "STOP FLYING BLIND / Deploy a secured, monitored agent..."

Replace headline and body:

Headline:
  "The next attack won't announce itself."

Body:
  "The Trivy attack started on a Friday evening.
   By Saturday morning, 45 organizations had lost their secrets.
   By the time the advisory was published, the damage was done.
   OpenSyber is free to start. Takes 60 seconds.
   The attack doesn't wait for a better time."

CTA buttons:
  [Start Free Now →]
  [See what the Trivy attack would have done to you →]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 11 — FOOTER TAGLINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the footer tagline.
Currently: "Runtime security for AI agents. From IDE to cloud to SOC."
Replace with: "OpenSyber: the containment layer that MCP forgot to build."


WHEN DONE: Run the dev server, open the homepage, verify:
  ✓ Trivy incident badge shows under nav
  ✓ Hero headline says "Your AI agents have no sheriff"
  ✓ No testimonials from Sarah Chen / Marcus Williams / Elena Rodriguez
  ✓ Attack cards show 3 real incidents with prevention details
  ✓ Stats show 847+ IOCs, not 39 integrations
  ✓ Bottom CTA references the Trivy attack

Output: "AGENT A COMPLETE — homepage mission reframe done"
```

---

# ══════════════════════════════════════
# AGENT B — PRICING PAGE COMPLETE REWRITE
# File: src/routes/pricing/+page.svelte
# ══════════════════════════════════════

```prompt
You are rewriting the OpenSyber pricing page.
This is a mission reframe — not a SaaS pricing page.
The old prices ($49/$149/$399) undersell the value.
The new prices reflect what OpenSyber actually prevents.

FILE: src/routes/pricing/+page.svelte

The page needs:
  1. New mission-framed hero
  2. Consequence calculator (interactive)
  3. Annual/monthly billing toggle
  4. 5 completely rewritten pricing tiers
  5. New FAQ section at the bottom

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1 — PAGE HERO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Replace the entire hero section with:

<section class="pricing-hero">
  <div class="container">
    <div class="pricing-eyebrow">Pricing</div>
    <h1 class="pricing-title">
      The cost of a breach: <span class="stat-red">$4.88M.</span><br>
      The cost of OpenSyber: <span class="stat-green">from $299/month.</span>
    </h1>
    <p class="pricing-sub">
      The math is obvious. The Trivy attack cost 45 organizations their secrets.
      OpenSyber Professional costs less than one day of breach response.
    </p>

    <div class="billing-toggle" id="billingToggle">
      <button
        class="toggle-opt active"
        id="monthlyBtn"
        onclick="setBilling('monthly')"
      >Monthly</button>
      <button
        class="toggle-opt"
        id="annualBtn"
        onclick="setBilling('annual')"
      >Annual <span class="toggle-save">Save 20%</span></button>
    </div>
  </div>
</section>

Styles:
.pricing-hero { padding: 80px 0 40px; text-align: center; }
.pricing-eyebrow {
  font-size: 11px; font-weight: 600;
  letter-spacing: .1em; text-transform: uppercase;
  color: var(--blue2); margin-bottom: 16px;
}
.pricing-title {
  font-family: var(--font-display);
  font-size: clamp(28px, 4vw, 50px);
  font-weight: 800; letter-spacing: -.04em;
  line-height: 1.1; margin-bottom: 16px;
}
.stat-red { color: var(--red); }
.stat-green { color: var(--green); }
.pricing-sub {
  font-size: 17px; color: var(--text2);
  max-width: 580px; margin: 0 auto 32px;
  font-weight: 300; line-height: 1.7;
}
.billing-toggle {
  display: inline-flex;
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 10px; overflow: hidden;
  margin-bottom: 48px;
}
.toggle-opt {
  padding: 10px 24px; font-size: 14px;
  font-weight: 500; cursor: pointer;
  border: none; background: transparent;
  color: var(--text2); transition: all .2s;
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-body);
}
.toggle-opt.active { background: var(--surface2); color: var(--text); }
.toggle-save {
  background: rgba(0,229,160,.12);
  color: var(--green); font-size: 11px;
  font-weight: 700; padding: 2px 7px;
  border-radius: 4px;
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2 — CONSEQUENCE CALCULATOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add this section BEFORE the pricing tiers:

<section class="calc-section">
  <div class="container">
    <div class="calc-card">
      <div class="calc-left">
        <h3 class="calc-title">What's your exposure?</h3>
        <p class="calc-desc">
          Enter your team size. We'll show you the real math
          before you look at any pricing.
        </p>
        <div class="calc-input-group">
          <label>Developers using AI coding tools</label>
          <div class="slider-row">
            <input
              type="range" min="1" max="500" value="20"
              id="devSlider" oninput="updateCalc()"
              class="calc-slider"
            />
            <span class="slider-val" id="devDisplay">20</span>
          </div>
        </div>
        <div class="calc-tools">
          <label class="calc-tools-label">Tools in use</label>
          <div class="tool-checks">
            <label class="tool-check">
              <input type="checkbox" checked onchange="updateCalc()"> Claude Code
            </label>
            <label class="tool-check">
              <input type="checkbox" checked onchange="updateCalc()"> Cursor
            </label>
            <label class="tool-check">
              <input type="checkbox" onchange="updateCalc()"> GitHub Copilot
            </label>
            <label class="tool-check">
              <input type="checkbox" onchange="updateCalc()"> Windsurf
            </label>
          </div>
        </div>
      </div>
      <div class="calc-right">
        <div class="calc-result-row exposure">
          <span class="calc-label">Estimated breach exposure</span>
          <span class="calc-value red" id="breachAmt">$2,440,000</span>
        </div>
        <div class="calc-divider"></div>
        <div class="calc-result-row">
          <span class="calc-label">OpenSyber Team (annual)</span>
          <span class="calc-value" id="opensyberAmt">$3,588/yr</span>
        </div>
        <div class="calc-result-row highlight">
          <span class="calc-label">OpenSyber as % of breach exposure</span>
          <span class="calc-value green" id="ratioAmt">0.15%</span>
        </div>
        <p class="calc-source">
          Breach cost based on IBM Cost of a Data Breach Report 2025
          ($4.88M average), scaled by AI attack surface exposure.
        </p>
      </div>
    </div>
  </div>
</section>

Add the calculator JavaScript at the bottom of the file:

<script>
  function updateCalc() {
    const slider = document.getElementById('devSlider')
    const devs = parseInt(slider.value)
    document.getElementById('devDisplay').textContent = devs

    const tools = document.querySelectorAll('.tool-check input:checked').length
    const toolMultiplier = 1 + (tools * 0.15)
    const baseExposure = Math.max(500000, devs * 122000 * toolMultiplier)
    const opensyberAnnual = 299 * 12
    const ratio = ((opensyberAnnual / baseExposure) * 100).toFixed(2)

    document.getElementById('breachAmt').textContent =
      '$' + Math.round(baseExposure).toLocaleString()
    document.getElementById('opensyberAmt').textContent =
      '$' + opensyberAnnual.toLocaleString() + '/yr'
    document.getElementById('ratioAmt').textContent = ratio + '%'
  }

  function setBilling(type) {
    document.querySelectorAll('.toggle-opt')
      .forEach(b => b.classList.remove('active'))
    document.getElementById(type + 'Btn').classList.add('active')

    document.querySelectorAll('[data-monthly]').forEach(el => {
      const val = type === 'annual' ? el.dataset.annual : el.dataset.monthly
      el.textContent = val
    })

    document.querySelectorAll('.annual-note').forEach(el => {
      el.style.display = type === 'annual' ? 'block' : 'none'
    })
  }
</script>

Calculator styles:
.calc-section { padding: 0 0 60px; }
.calc-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 16px; padding: 40px;
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 48px; align-items: center;
}
.calc-title {
  font-family: var(--font-display);
  font-size: 22px; font-weight: 700;
  color: var(--text); margin-bottom: 8px;
}
.calc-desc { font-size: 14px; color: var(--text2); margin-bottom: 24px; line-height: 1.6; }
.calc-input-group { margin-bottom: 20px; }
.calc-input-group label {
  font-size: 13px; color: var(--text2);
  font-weight: 500; display: block; margin-bottom: 10px;
}
.slider-row { display: flex; align-items: center; gap: 14px; }
.calc-slider { flex: 1; height: 4px; }
.slider-val {
  font-family: var(--font-display);
  font-size: 22px; font-weight: 800;
  color: var(--text); min-width: 40px; text-align: right;
}
.calc-tools-label {
  font-size: 13px; color: var(--text2);
  font-weight: 500; display: block; margin-bottom: 10px;
}
.tool-checks { display: flex; gap: 16px; flex-wrap: wrap; }
.tool-check {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--text2); cursor: pointer;
}
.calc-result-row {
  display: flex; justify-content: space-between;
  align-items: center; padding: 14px 0;
  border-bottom: 1px solid var(--border);
}
.calc-result-row:last-of-type { border-bottom: none; }
.calc-result-row.highlight { background: rgba(0,229,160,0.04); margin: 0 -16px; padding: 14px 16px; border-radius: 8px; }
.calc-label { font-size: 14px; color: var(--text2); }
.calc-value {
  font-family: var(--font-display);
  font-size: 24px; font-weight: 800; color: var(--text);
}
.calc-value.red { color: var(--red); }
.calc-value.green { color: var(--green); }
.calc-divider { height: 1px; background: var(--border); margin: 4px 0; }
.calc-source { font-size: 11px; color: var(--text3); margin-top: 12px; line-height: 1.5; }
@media (max-width: 768px) {
  .calc-card { grid-template-columns: 1fr; gap: 32px; padding: 24px; }
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3 — PRICING TIERS (5 tiers)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Replace ALL existing pricing tiers with these 5.
The grid should be: 3 columns top row (tiers 1-3) + 2 columns bottom row (tiers 4-5)
OR a single scrollable row on mobile.

TIER 1 — STARTER SHIELD
  Plan label:  "Starter Shield"
  Price display:
    <span data-monthly="$0" data-annual="$0">$0</span>
    <span class="price-period">forever free</span>
  Description: "For developers who write code with AI tools
                and need to know if something goes wrong."
  Features:
    ✓ Know if any agent reads your SSH keys or tokens
    ✓ Block secrets from entering your git history
    ✓ Scan npm/pip dependencies for known CVEs
    ✓ 1 agent instance
    ✓ 3 verified skills (Secret Scanner + Git Guardian + Dependency Auditor)
    ✓ Basic security dashboard
    ✓ 3-day audit log retention
    ✓ Community support
  CTA: "Start free — 60 seconds" → /sign-up
  Style: standard card, no badge

TIER 2 — TEAM (featured)
  Plan label:  "Team"
  Badge: "Most popular"
  Price display:
    <span data-monthly="$299" data-annual="$239">$299</span>
    <span class="price-period">/month</span>
  Annual note (hidden by default, shown when annual selected):
    "Billed $2,870/year — save $718"
  Description: "For teams where one compromised agent
                could halt the company for a week."
  Features:
    ✓ Everything in Starter Shield
    ✓ All 15 verified security skills
    ✓ GitHub App: unlimited repos scanned
    ✓ Bundle activation (any 3 bundles)
    ✓ Slack + email alerts with severity routing
    ✓ Weekend Shield (attacks happen on Fridays)
    ✓ NHI Manager: register up to 20 agents
    ✓ Cost Bomb Protection: kill switches for API spend
    ✓ Trust page + security badge for README
    ✓ Up to 3 agent instances
    ✓ 30-day audit log retention
    ✓ Email support
  CTA: "Start free trial" → /sign-up
  Style: featured card with blue accent border

TIER 3 — PROFESSIONAL
  Plan label:  "Professional"
  Price display:
    <span data-monthly="$799" data-annual="$639">$799</span>
    <span class="price-period">/month</span>
  Annual note: "Billed $7,670/year — save $1,918"
  Description: "For organizations where a breach means
                regulatory action and a very bad board meeting."
  Features:
    ✓ Everything in Team
    ✓ OpenSyber AI — ask security questions in plain English
    ✓ MCP Guardian — full MCP server security scanning
    ✓ Memory & RAG Poisoning Guard
    ✓ PagerDuty + SIEM integration
    ✓ Compliance Reporter: SOC 2, HIPAA, GDPR, ISO 27001
    ✓ AI-BOM generation (EU AI Act compliance)
    ✓ Agent Red Team (automated pen testing)
    ✓ Up to 10 agent instances
    ✓ 1-year audit log retention
    ✓ Priority email support (8h SLA)
  CTA: "Start free trial" → /sign-up
  Style: standard card

TIER 4 — ENTERPRISE
  Plan label:  "Enterprise"
  Price display:
    <span data-monthly="$2,499" data-annual="$1,999">$2,499</span>
    <span class="price-period">/month</span>
  Annual note: "Billed $23,990/year — save $5,998"
  Description: "For companies where certainty is non-negotiable
                and the cost of being wrong is measured in millions."
  Features:
    ✓ Everything in Professional
    ✓ SAML & OIDC SSO
    ✓ Custom data residency (EU, US, Israel)
    ✓ Dedicated onboarding engineer
    ✓ Monthly security review call
    ✓ Custom SLA with financial backing (99.9% uptime)
    ✓ Immutable audit trail (legally defensible, WORM storage)
    ✓ Custom skill development (OpenSyber builds for you)
    ✓ White-label option for MSSPs
    ✓ Unlimited agent instances
    ✓ 5-year audit log retention
    ✓ Named account manager + 1h phone support SLA
  CTA: "Contact sales" → /enterprise
  Style: standard card with subtle gold/amber border

TIER 5 — MISSION DEFENDER
  Plan label:  "Mission Defender"
  Price display:
    <span data-monthly="$9,999" data-annual="$7,999">$9,999</span>
    <span class="price-period">/month</span>
  Annual note: "Billed $95,990/year — save $23,998"
  Description: "For organizations where a breach would be existential.
                Banks, healthcare, critical infrastructure.
                You pay for certainty. We deliver it."
  Pre-feature callout (amber box):
    "Includes a dedicated OpenSyber security engineer
     and 24/7 incident response on-call."
  Features:
    ✓ Everything in Enterprise
    ✓ Dedicated security engineer (10 hours/month)
    ✓ Weekly threat intelligence briefing (custom to your stack)
    ✓ Incident response on-call (30-min SLA, 24/7/365)
    ✓ Quarterly red team exercises targeting your agent stack
    ✓ Board-ready quarterly security report
    ✓ Direct Slack channel with OpenSyber security team
    ✓ First access to every new skill and feature
    ✓ Quarterly roadmap influence calls
  CTA: "Contact sales" → /enterprise
  Style: distinct card, amber/gold accent, "Maximum protection" sub-badge

PRICING CARD STYLES (apply to all tiers):
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 60px;
}
.pricing-grid-bottom {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
  margin-top: 18px;
}
.p-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 18px; padding: 30px 26px;
  position: relative;
  transition: transform .22s, box-shadow .22s;
}
.p-card:hover { transform: translateY(-3px); box-shadow: 0 20px 60px rgba(0,0,0,.35); }
.p-card.featured { border-color: rgba(27,111,255,.45); }
.p-card.enterprise { border-color: rgba(245,166,35,.25); }
.p-card.mission { border-color: rgba(245,166,35,.4); background: linear-gradient(160deg, rgba(245,166,35,.05) 0%, var(--surface) 40%); }
.p-badge {
  position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
  padding: 4px 14px; border-radius: 100px;
  font-size: 11px; font-weight: 700; white-space: nowrap;
}
.p-badge.popular { background: var(--blue); color: white; }
.p-badge.max { background: var(--amber); color: #000; }
.p-plan {
  font-family: var(--font-display); font-size: 12px;
  font-weight: 700; color: var(--text3);
  text-transform: uppercase; letter-spacing: .08em; margin-bottom: 10px;
}
.p-price {
  font-family: var(--font-display); font-size: 42px;
  font-weight: 800; color: var(--text);
  letter-spacing: -.04em; line-height: 1; margin-bottom: 3px;
}
.price-period { font-size: 13px; color: var(--text3); font-family: var(--font-body); font-weight: 300; }
.annual-note { font-size: 12px; color: var(--green); margin-top: 4px; display: none; }
.p-desc {
  font-size: 13px; color: var(--text3);
  margin: 14px 0 16px; padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
  line-height: 1.55;
}
.p-features { list-style: none; display: flex; flex-direction: column; gap: 9px; margin-bottom: 24px; }
.p-features li { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; color: var(--text2); }
.feat-check {
  width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
  margin-top: 2px; display: flex; align-items: center; justify-content: center;
  font-size: 9px; background: rgba(0,229,160,.1);
  border: 1px solid rgba(0,229,160,.25); color: var(--green);
}
.mission-callout {
  background: rgba(245,166,35,.08); border: 1px solid rgba(245,166,35,.2);
  border-radius: 8px; padding: 12px; margin-bottom: 16px;
  font-size: 13px; color: var(--amber); line-height: 1.5;
}
@media (max-width: 900px) {
  .pricing-grid { grid-template-columns: 1fr; }
  .pricing-grid-bottom { grid-template-columns: 1fr; }
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4 — FAQ AT BOTTOM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add this section after the pricing tiers:

<section class="pricing-faq">
  <div class="container">
    <h2 class="faq-title">Common questions</h2>
    <div class="faq-grid">

      <div class="faq-item">
        <div class="faq-q">Is OpenSyber expensive?</div>
        <div class="faq-a">
          Relative to a security consultant at $300/hour — no.
          Relative to a breach at $4.88M average — no.
          Relative to doing nothing — it's the cheapest decision you'll make.
          Our Team tier at $299/month costs less than one hour of
          breach response retainer.
        </div>
      </div>

      <div class="faq-item">
        <div class="faq-q">Why did prices increase from the old plans?</div>
        <div class="faq-a">
          Because we undervalued what we prevent. When the Trivy attack
          cost 45 organizations their secrets, and a supply chain breach
          averages $7.2M, the old $149/month was an insult to the problem.
          The new pricing reflects the actual value of what OpenSyber stops.
        </div>
      </div>

      <div class="faq-item">
        <div class="faq-q">What if we get breached while using OpenSyber?</div>
        <div class="faq-a">
          Tell us immediately. We will dig in with you.
          Mission Defender includes 24/7 incident response.
          But more importantly: if you connected your sources,
          kept monitoring active, and followed the alerts —
          the attack would have been stopped or contained.
          That is the entire point.
        </div>
      </div>

      <div class="faq-item">
        <div class="faq-q">Do you offer discounts for open source projects?</div>
        <div class="faq-a">
          Yes. Open source projects with public repositories get
          Team tier completely free. Email opensource@opensyber.cloud
          with your GitHub organization link. No strings attached.
          OpenSyber exists to protect developers — including the ones
          building the tools the rest of us depend on.
        </div>
      </div>

      <div class="faq-item">
        <div class="faq-q">How is OpenSyber different from Dependabot or Snyk?</div>
        <div class="faq-a">
          Dependabot and Snyk scan code before it runs.
          OpenSyber watches what agents do while they run.
          The Trivy attack didn't exploit a vulnerability in code —
          it exploited a CI/CD pipeline at runtime. Static scanners
          would have missed it entirely. OpenSyber wouldn't have.
        </div>
      </div>

      <div class="faq-item">
        <div class="faq-q">Is there a free trial on paid plans?</div>
        <div class="faq-a">
          Yes. Team and Professional come with a 14-day free trial.
          No credit card required. Cancel any time.
          Enterprise and Mission Defender include a guided 30-day pilot
          with full access and a dedicated onboarding call.
        </div>
      </div>

    </div>
  </div>
</section>

FAQ styles:
.pricing-faq { padding: 80px 0; border-top: 1px solid var(--border); }
.faq-title {
  font-family: var(--font-display); font-size: 32px;
  font-weight: 800; letter-spacing: -.03em;
  color: var(--text); margin-bottom: 40px;
}
.faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.faq-item {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 22px 24px;
  transition: border-color .2s;
}
.faq-item:hover { border-color: var(--border2); }
.faq-q { font-weight: 600; font-size: 14px; color: var(--text); margin-bottom: 10px; }
.faq-a { font-size: 13px; color: var(--text3); line-height: 1.65; }
@media (max-width: 700px) { .faq-grid { grid-template-columns: 1fr; } }


WHEN DONE: Run dev server, open /pricing, verify:
  ✓ Hero shows "$4.88M vs $299/month" framing
  ✓ Consequence calculator is interactive and updates live
  ✓ Annual/monthly toggle works and updates all prices
  ✓ 5 tiers visible: Starter Shield / Team / Professional / Enterprise / Mission Defender
  ✓ Tier descriptions lead with consequences not features
  ✓ FAQ section at bottom with 6 questions
  ✓ No mention of old tier names (Personal, Pro)

Output: "AGENT B COMPLETE — pricing page mission reframe done"
```

---

# ══════════════════════════════════════
# AGENT C — DEMO PAGE FIXES
# File: src/routes/demo/+page.svelte
# ══════════════════════════════════════

```prompt
You are fixing the OpenSyber demo page.
The demo is the most important page for conversion.
Currently it shows a score of 0 and no events — it is broken.

FILE: src/routes/demo/+page.svelte

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 1 — ANIMATE SECURITY SCORE TO 87
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find where the score is displayed. Currently shows "0" indefinitely.

Add this to onMount (Svelte) or useEffect (if React):

  // Animate score from 0 → 87 over 2.5 seconds
  let score = 0
  let status = 'Scanning...'

  onMount(() => {
    const target = 87
    const duration = 2500
    const start = performance.now()

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

    const animate = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      score = Math.round(easeOutCubic(progress) * target)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        score = target
        status = 'Needs Attention'
        lastUpdated = 'Updated just now'
      }
    }

    requestAnimationFrame(animate)
  })

Bind score, status, and lastUpdated to the template:
  - Score number element: {score}
  - Status label: {status}  (was "Scanning...", becomes "Needs Attention")
  - Update time: {lastUpdated}  (was "Updated Scanning...", becomes "Updated just now")


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 2 — POPULATE SECURITY EVENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the "Recent Security Events" section. Currently empty.

Add this mock events data and render it with a stagger animation:

  const mockEvents = [
    {
      id: 1,
      severity: 'CRITICAL',
      message: 'Credential access blocked — SSH key read attempt',
      detail: 'demo-agent-01 tried: cat ~/.ssh/id_rsa',
      time: '2m ago',
      skill: 'Secret Vault Bridge',
      resolved: true
    },
    {
      id: 2,
      severity: 'ALERT',
      message: 'Exfiltration attempt detected → PagerDuty notified',
      detail: 'Outbound call to scan.aquasecurtiy[.]org (TeamPCP IOC)',
      time: '14m ago',
      skill: 'Network Sentinel',
      resolved: true
    },
    {
      id: 3,
      severity: 'WARN',
      message: 'Supply chain flag — suspicious postinstall script',
      detail: 'npm install totally-legit-pkg@latest → blocked',
      time: '31m ago',
      skill: 'Supply Chain Guard',
      resolved: true
    },
    {
      id: 4,
      severity: 'INFO',
      message: 'Skill audit passed — v1.2.0',
      detail: 'secret-scanner@1.2.0 passed 4-stage pipeline',
      time: '1h ago',
      skill: 'Secret Scanner',
      resolved: true
    },
    {
      id: 5,
      severity: 'OK',
      message: 'Agent heartbeat restored',
      detail: 'demo-agent-01 reconnected after 2s network gap',
      time: '1h ago',
      skill: 'System',
      resolved: true
    }
  ]

  // Stagger events appearing after score animates
  let visibleEvents = []

  onMount(() => {
    // After score animation (2.5s), add events one by one
    mockEvents.forEach((event, i) => {
      setTimeout(() => {
        visibleEvents = [...visibleEvents, event]
      }, 2800 + (i * 300))
    })
  })

Render each event with:
  - Severity badge (CRITICAL=red, ALERT=amber, WARN=amber, INFO=blue, OK=green)
  - Message text
  - Detail text (smaller, muted)
  - Time (right-aligned)
  - Skill name chip
  - Fade-in animation as each appears

Also update the "Events (24h): 0" counter to "Events (24h): 12"
(the mock shows 5, but the counter implies more happened earlier)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 3 — ADD TRIVY ATTACK CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Above the dashboard demo, add a context bar:

<div class="demo-context">
  <span class="demo-context-dot"></span>
  <span>
    This is a simulated dashboard. The events shown reflect real attack
    patterns from the Trivy incident (March 19, 2026).
  </span>
  <a href="/blog/trivy-supply-chain-attack">See the full breakdown →</a>
</div>

Styles:
.demo-context {
  display: flex; align-items: center; gap: 10px;
  background: rgba(27,111,255,.06);
  border: 1px solid rgba(27,111,255,.15);
  border-radius: 8px; padding: 10px 16px;
  font-size: 13px; color: var(--text2);
  margin-bottom: 20px;
}
.demo-context-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--blue2); flex-shrink: 0;
  animation: pulse 2s ease-in-out infinite;
}
.demo-context a { color: var(--blue2); text-decoration: none; font-weight: 600; margin-left: auto; }
.demo-context a:hover { text-decoration: underline; }


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 4 — UPDATE DEMO PAGE TITLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update the page title and any hero text:

FROM: "Live Demo — OpenSyber"
TO:   "Live Demo — See what the Trivy attack would have triggered"

FROM: "Sign up to monitor your own agents."
TO:   "This demo reflects real attack patterns from March 2026.
       Sign up to see your actual exposure."


WHEN DONE: Run dev server, open /demo, verify:
  ✓ Score animates from 0 → 87 over ~2.5 seconds
  ✓ Status changes from "Scanning..." to "Needs Attention"
  ✓ 5 events appear with stagger after score completes
  ✓ Events have correct severity colors
  ✓ Events (24h) counter shows 12
  ✓ Context bar explains this reflects Trivy attack patterns
  ✓ Page title references Trivy attack

Output: "AGENT C COMPLETE — demo page fixed"
```

---

# ══════════════════════════════════════
# AGENT D — THREATS PAGE FIX
# File: src/routes/threats/+page.svelte
# ══════════════════════════════════════

```prompt
You are fixing the OpenSyber threats page.
Currently it loads with just a header and no data.
A "LIVE" page with no data is worse than not having the page.

FILE: src/routes/threats/+page.svelte

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 1 — HEADLINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FROM: "# Threat Intelligence — LIVE"
TO:   "# Live Threat Feed"
Subline: "Real-time security events across the OpenSyber network.
          Data refreshes every 15 seconds."


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 2 — ADD LIVE THREAT COUNTER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Below the headline, add a counter that increments:

<div class="threat-counter">
  <div class="threat-count-main">
    <span class="threat-num" id="threatCount">847</span>
    <span class="threat-label">threats blocked in the last 24h</span>
  </div>
  <div class="threat-live-badge">
    <span class="live-dot"></span>
    LIVE
  </div>
</div>

JavaScript: increment threatCount by 1 every 8 seconds:
  setInterval(() => {
    const el = document.getElementById('threatCount')
    if (el) el.textContent = (parseInt(el.textContent) + 1).toLocaleString()
  }, 8000)

Styles:
.threat-counter {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: 14px; padding: 20px 28px; margin-bottom: 32px;
}
.threat-num {
  font-family: var(--font-display);
  font-size: 48px; font-weight: 800;
  color: var(--text); letter-spacing: -.04em;
  display: block;
}
.threat-label { font-size: 14px; color: var(--text2); margin-top: 4px; }
.threat-live-badge {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,75,75,.08);
  border: 1px solid rgba(255,75,75,.2);
  padding: 8px 16px; border-radius: 8px;
  font-size: 12px; font-weight: 700;
  color: var(--red); letter-spacing: .06em;
}
.live-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--red); box-shadow: 0 0 8px var(--red);
  animation: pulse 1.5s ease-in-out infinite;
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 3 — ADD ROTATING THREAT FEED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add this threat feed data and render as a live-updating table:

  const initialThreats = [
    { type:'SUPPLY_CHAIN', severity:'CRITICAL', region:'US-East',      age:12,  blocked:true  },
    { type:'CREDENTIAL',   severity:'HIGH',     region:'EU-West',      age:34,  blocked:true  },
    { type:'EXFILTRATION', severity:'HIGH',     region:'AP-Southeast', age:67,  blocked:true  },
    { type:'PROMPT_INJ',   severity:'MEDIUM',   region:'EU-Central',   age:112, blocked:false },
    { type:'TYPOSQUAT',    severity:'HIGH',     region:'US-West',      age:143, blocked:true  },
    { type:'CREDENTIAL',   severity:'CRITICAL', region:'SA-East',      age:298, blocked:true  },
    { type:'IOC_DOMAIN',   severity:'CRITICAL', region:'EU-West',      age:421, blocked:true  },
    { type:'SUPPLY_CHAIN', severity:'HIGH',     region:'US-East',      age:534, blocked:true  },
    { type:'BRUTE_FORCE',  severity:'MEDIUM',   region:'AP-North',     age:720, blocked:true  },
    { type:'EXFILTRATION', severity:'HIGH',     region:'EU-Central',   age:901, blocked:true  },
  ]

  // Rotate: every 15 seconds, move last item to top with fresh age
  onMount(() => {
    setInterval(() => {
      const newEntry = {
        type: ['SUPPLY_CHAIN','CREDENTIAL','EXFILTRATION','TYPOSQUAT','IOC_DOMAIN'][
          Math.floor(Math.random() * 5)
        ],
        severity: ['CRITICAL','HIGH','MEDIUM'][Math.floor(Math.random() * 3)],
        region: ['EU-West','US-East','AP-Southeast','EU-Central'][
          Math.floor(Math.random() * 4)
        ],
        age: Math.floor(Math.random() * 30),
        blocked: Math.random() > 0.15
      }
      threats = [newEntry, ...threats.slice(0, 9)]
    }, 15000)
  })

Render as a table:
  Columns: Type | Severity | Region | Age | Status
  
  Type labels:
    SUPPLY_CHAIN → "Supply Chain"
    CREDENTIAL   → "Credential Access"
    EXFILTRATION → "Exfiltration Attempt"
    PROMPT_INJ   → "Prompt Injection"
    TYPOSQUAT    → "Typosquatted Package"
    IOC_DOMAIN   → "IOC Domain Match"
    BRUTE_FORCE  → "Brute Force"

  Age display: convert seconds to "Xs ago", "Xm ago", "Xh ago"
  
  Status: 
    blocked=true  → green badge "BLOCKED"
    blocked=false → amber badge "MONITORING"
  
  Newest row (index 0): highlighted with subtle animation on entry
  Table scrollable on mobile


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 4 — ADD IOC FEED SECTION BELOW TABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Below the live table, add a static IOC feed section:

<section class="ioc-section">
  <h2>Recent IOC additions</h2>
  <p>Domains, IPs, and package names added to the threat feed this week.</p>

  <div class="ioc-list">
    <div class="ioc-item critical">
      <span class="ioc-type">Domain</span>
      <span class="ioc-value">scan.aquasecurtiy[.]org</span>
      <span class="ioc-actor">TeamPCP</span>
      <span class="ioc-ref">GHSA-69fq-xp46-6x23</span>
      <span class="ioc-date">Mar 19</span>
    </div>
    <div class="ioc-item critical">
      <span class="ioc-type">IP</span>
      <span class="ioc-value">45.148.10.212</span>
      <span class="ioc-actor">TeamPCP C2</span>
      <span class="ioc-ref">GHSA-69fq-xp46-6x23</span>
      <span class="ioc-date">Mar 19</span>
    </div>
    <div class="ioc-item critical">
      <span class="ioc-type">Domain</span>
      <span class="ioc-value">hackmoltrepeat[.]com</span>
      <span class="ioc-actor">hackerbot-claw</span>
      <span class="ioc-ref">hackerbot-2026</span>
      <span class="ioc-date">Mar 1</span>
    </div>
    <div class="ioc-item high">
      <span class="ioc-type">Package</span>
      <span class="ioc-value">openclaw@latest</span>
      <span class="ioc-actor">Clinejection</span>
      <span class="ioc-ref">CVE-2026-clinic</span>
      <span class="ioc-date">Feb 17</span>
    </div>
  </div>

  <p class="ioc-footer">
    IOC feed updated every 15 minutes from GitHub Security Advisories,
    StepSecurity, and Socket.dev.
    <a href="/sign-up">Get feed access →</a>
  </p>
</section>


WHEN DONE: verify in dev server:
  ✓ Threat counter shows and increments every 8s
  ✓ Live table shows 10 threat events
  ✓ New event rotates in every 15 seconds (newest at top)
  ✓ BLOCKED / MONITORING status badges shown
  ✓ IOC section shows 4 real IOCs from Trivy/Clinejection incidents
  ✓ Page no longer appears empty

Output: "AGENT D COMPLETE — threats page fixed"
```

---

# ══════════════════════════════════════
# AGENT E — NAVIGATION + LAYOUT UPDATES
# File: src/lib/components/Nav.svelte
#       src/app.html or +layout.svelte
# ══════════════════════════════════════

```prompt
You are updating the OpenSyber navigation and global layout
to reflect the mission reframe.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 1 — PAGE TITLE (all pages)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find src/app.html or the default <title> in +layout.svelte.

FROM: "OpenSyber — Secure Managed AI Agent Hosting"
TO:   "OpenSyber — Runtime Security for AI Agents"

All sub-pages should follow the pattern:
  "[Page Name] | OpenSyber"
  e.g. "Pricing | OpenSyber", "Skills | OpenSyber", "Blog | OpenSyber"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 2 — NAV LINKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the navigation component.
Current links: Pricing | Skills | Docs | Blog | Demo | Threats

Replace with:
  Pricing     → stays (link: /pricing)
  Skills      → stays (link: /marketplace)
  Bundles     → ADD NEW (link: /marketplace/bundles)
  Blog        → stays (link: /blog)
  Demo        → stays but rename to "Live Demo" (link: /demo)
  Threats     → REMOVE (page is broken, will add back as Threat Atlas later)
  Docs        → stays (link: /docs)

On mobile (< 768px): collapse to hamburger menu showing all links.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 3 — NAV SIGN IN BUTTON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Currently just "Sign In". Change to:
  [Sign In]  [Start Free →]  ← add second button

The "Start Free" button should match the primary CTA style
(blue background, white text).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 4 — ADD GLOBAL INCIDENT BANNER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add a slim banner ABOVE the nav (not inside it).
Show only on homepage and pricing page.
Dismissible with an X button.

<div class="incident-banner" id="incidentBanner">
  <span class="incident-banner-dot"></span>
  <strong>Active threat:</strong>
  TeamPCP supply chain campaign — March 2026.
  <a href="/blog/trivy-supply-chain-attack">
    Check if your repos are affected →
  </a>
  <button class="dismiss-btn" onclick="dismissBanner()">✕</button>
</div>

JavaScript:
  function dismissBanner() {
    document.getElementById('incidentBanner').style.display = 'none'
    try { localStorage.setItem('banner-dismissed-trivy', '1') } catch(e){}
  }
  // On load: check if dismissed
  if (localStorage.getItem('banner-dismissed-trivy')) {
    const b = document.getElementById('incidentBanner')
    if (b) b.style.display = 'none'
  }

Styles:
.incident-banner {
  background: rgba(255,75,75,.09);
  border-bottom: 1px solid rgba(255,75,75,.2);
  padding: 8px 20px;
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; color: var(--text2);
  position: relative; z-index: 201;
}
.incident-banner strong { color: var(--red); }
.incident-banner a { color: var(--red); font-weight: 600; text-decoration: none; }
.incident-banner a:hover { text-decoration: underline; }
.incident-banner-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--red); flex-shrink: 0;
  animation: pulse 1.5s ease-in-out infinite;
}
.dismiss-btn {
  margin-left: auto; background: none; border: none;
  color: var(--text3); cursor: pointer; font-size: 14px;
  padding: 2px 6px;
}
.dismiss-btn:hover { color: var(--text2); }


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 5 — FOOTER UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the footer.

Change the tagline:
  FROM: "Runtime security for AI agents. From IDE to cloud to SOC."
  TO:   "OpenSyber: the containment layer that MCP forgot to build."

Add to footer links (Community section or new section):
  Open Source: github.com/opensyber/ai-agent-security-rules
  Threat Atlas: opensyber.cloud/threats/atlas (link to /threats for now)
  Developer Grants: /builder (link to builder landing page)

Change copyright:
  FROM: "© 2026 OpenSyber. All rights reserved."
  TO:   "© 2026 OpenSyber. Built to protect. Deployed on Cloudflare Edge."

Add below copyright:
  "10% of marketplace revenue funds security researchers worldwide."

SOC2 badge:
  FROM: "SOC2 in progress"
  TO:   "SOC2 Type I — expected Q3 2026"


WHEN DONE: verify in dev server:
  ✓ Page title is "OpenSyber — Runtime Security for AI Agents"
  ✓ Nav shows: Pricing | Skills | Bundles | Blog | Live Demo | Docs
  ✓ Nav has "Sign In" and "Start Free →" buttons
  ✓ Incident banner shows on homepage and pricing page
  ✓ Incident banner dismisses when X clicked and stays dismissed
  ✓ Footer tagline is updated
  ✓ SOC2 shows "Q3 2026" timeline

Output: "AGENT E COMPLETE — nav and layout updated"
```

---

# ══════════════════════════════════════
# AGENT F — MARKETPLACE MISSION REFRAME
# File: src/routes/marketplace/+page.svelte
# ══════════════════════════════════════

```prompt
You are updating the OpenSyber marketplace page.

FILE: src/routes/marketplace/+page.svelte

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 1 — PAGE HERO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FROM: "Skill Marketplace — Browse verified skills to enhance your AI agent"
TO:
  <div class="mp-hero">
    <div class="section-eyebrow">Skill Marketplace</div>
    <h1>15 skills.<br><em>Zero attack surfaces left unguarded.</em></h1>
    <p>
      Every skill targets a specific attack vector documented in a real 2025-2026 incident.
      Each one verified through a 4-stage security audit before it reaches your agent.
    </p>
  </div>


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 2 — ADD BUNDLES TAB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add tabs above the skill grid:
  [All Skills]  [Bundles — save up to 47%]  [Security]  [Developer Tools]  [Compliance]  [Alerts]

"Bundles" tab links to /marketplace/bundles


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 3 — REMOVE FAKE REVIEW COUNTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the skill card component.
Currently shows: (312) reviews, 4,824 installs

REMOVE completely:
  - Review count number
  - Install count number
  - Star rating if present

KEEP:
  - Skill name
  - Description
  - Category badge
  - Version number (e.g. "v1.2.0")
  - "Verified" badge ✓
  - Install button

ADD instead of review counts:
  - "Beta" chip (small, muted color)
  - The incident it protects against (if applicable):
    e.g. "Protects against: Trivy-class attacks"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 4 — SKILL CARDS INCIDENT TAGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add incident reference tags to specific skill cards:

  CI/CD Supply Chain Guardian:
    tag: "Blocks Trivy-class attacks"  (red)

  Supply Chain Guard:
    tag: "Blocks CanisterWorm pattern"  (red)

  AI Prompt Guard:
    tag: "Blocks Clinejection pattern"  (amber)

  Network Sentinel:
    tag: "Blocks TeamPCP exfiltration"  (red)

  Secret Scanner:
    tag: "Prevents credential exposure"  (amber)

  Dependency Auditor:
    tag: "CVE detection on every push"  (blue)

  Git Guardian:
    tag: "Protects protected branches"  (blue)

  MCP Guardian (if exists):
    tag: "8,000 MCP servers at risk"  (red)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 5 — ADD BUNDLES PROMO BANNER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add a banner above the skill grid (below tabs):

<div class="bundles-promo">
  <div class="bundles-promo-text">
    <strong>Save up to 47%</strong> with skill bundles.
    Pre-packaged sets that activate with one source connection.
  </div>
  <a href="/marketplace/bundles" class="bundles-promo-cta">
    View bundles →
  </a>
</div>

Styles:
.bundles-promo {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(27,111,255,.06);
  border: 1px solid rgba(27,111,255,.2);
  border-radius: 10px; padding: 14px 20px;
  margin-bottom: 28px; font-size: 14px;
}
.bundles-promo strong { color: var(--blue2); }
.bundles-promo-cta {
  color: var(--blue2); text-decoration: none;
  font-weight: 600; font-size: 13px; white-space: nowrap;
}


WHEN DONE: verify:
  ✓ Page hero has new mission-framed headline
  ✓ Bundles tab added and links to /marketplace/bundles
  ✓ NO review counts or install numbers on any skill card
  ✓ "Beta" chip on all skills
  ✓ Incident reference tags on relevant skills
  ✓ Bundles promo banner above grid

Output: "AGENT F COMPLETE — marketplace mission reframe done"
```

---

# ══════════════════════════════════════
# AGENT G — EMAIL TEMPLATES
# Resend transactional emails
# ══════════════════════════════════════

```prompt
You are updating OpenSyber's transactional email templates.
These are sent via Resend. The current templates use generic
SaaS language. Update them to mission language.

Find the email templates in src/lib/email/ or similar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPLATE 1 — WELCOME EMAIL (on sign-up)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subject:
  FROM: "Welcome to OpenSyber"
  TO:   "You just made your agents harder to compromise"

Body (update the key sections):

  Opening paragraph:
    FROM: "Welcome to OpenSyber. Your account is ready."
    TO:   "Your OpenSyber account is live. In the time it took
           you to sign up, approximately 3 supply chain attacks
           were attempted against developer environments worldwide.
           Here's how to protect yours in the next 5 minutes."

  First action (was "Deploy your agent"):
    TO:   "Connect your GitHub repos.
           OpenSyber scans for Trivy-class vulnerabilities immediately.
           If you're using aquasecurity/trivy-action with a mutable tag,
           you'll see it in under 60 seconds.
           [Connect GitHub →]"

  Second action (was "Install skills"):
    TO:   "Activate the Supply Chain Defense bundle.
           One connection. Four skills. Everything the Trivy attack
           would have needed to fail.
           [Activate bundle →]"

  Closing:
    FROM: "Let us know if you have questions."
    TO:   "The Trivy attack started on a Friday evening.
           The best time to be protected was before it happened.
           The second best time is right now.
           — The OpenSyber team"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPLATE 2 — CRITICAL ALERT EMAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subject (dynamic):
  FROM: "OpenSyber Alert: [event type]"
  TO:   "🔴 CRITICAL: [event message] — action required now"

Body:
  Header: Large red CRITICAL badge

  What happened:
    [Skill name] detected: [event message]
    Time: [timestamp]
    Agent: [agent name]
    Detail: [event detail]

  Why this matters:
    [Context sentence — different per event type]
    Example for credential access:
    "SSH key access by an AI agent is a common exfiltration vector.
     The Trivy attack used exactly this pattern to steal credentials."

  What to do right now:
    1. [Primary remediation action]
    2. [Secondary action]
    3. [View in dashboard link]

  Footer: "OpenSyber blocked this. Rotate any credentials that may
           have been accessed to be safe."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEMPLATE 3 — WEEKLY SECURITY DIGEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subject:
  FROM: "Your weekly OpenSyber report"
  TO:   "Your agents: [N] attacks blocked this week"
        (if 0: "Your agents: quiet week — here's what we watched for")

Body structure:
  "This week for [org name]:"
  - N events detected
  - N threats blocked
  - Security score: X/100 ([up/down] from last week)
  - [If any] Actions needed: [list]

  "What OpenSyber blocked for others this week:"
  - Brief summary of top 2-3 new IOCs added to the feed
  - "These patterns are now in your agent's protection scope."

  CTA: "View full report in dashboard →"

  Footer: "OpenSyber protects AI agents from supply chain attacks,
           credential theft, and prompt injection.
           The attacks don't stop on weekends. Neither do we."


WHEN DONE: verify templates exist and contain updated copy.
Output: "AGENT G COMPLETE — email templates updated"
```

---

# ══════════════════════════════════════
# MERGE AGENT — RUN LAST
# After all A-G agents confirm complete
# ══════════════════════════════════════

```prompt
All agents A through G have completed. Run the final verification.

VISUAL CHECK (open each URL in browser):

  opensyber.cloud
    ✓ Page title: "OpenSyber — Runtime Security for AI Agents"
    ✓ Incident banner (red): Trivy attack March 2026
    ✓ Hero: "Your AI agents have no sheriff. We watch them."
    ✓ CTAs: "Start free" + "See what Trivy would have done"
    ✓ "The attack is happening right now." section
    ✓ Attack cards: Trivy / Clinejection / CanisterWorm (no fake names)
    ✓ Stats: 15+ Skills | 5 Frameworks | 847+ IOCs | <60s
    ✓ Bottom CTA: "The next attack won't announce itself."
    ✓ Footer: "containment layer MCP forgot to build"
    ✗ NO Sarah Chen / Marcus Williams / Elena Rodriguez anywhere

  opensyber.cloud/pricing
    ✓ Hero: "$4.88M vs $299/month"
    ✓ Consequence calculator works and updates live
    ✓ Annual/monthly toggle switches all prices
    ✓ 5 tiers: Starter Shield / Team / Professional / Enterprise / Mission Defender
    ✓ Team = $299, Professional = $799, Enterprise = $2,499, Mission Defender = $9,999
    ✓ Tier descriptions lead with consequences
    ✓ FAQ section at bottom (6 questions)
    ✗ NO "Personal" or "Pro" tier names

  opensyber.cloud/demo
    ✓ Score animates 0 → 87 on page load
    ✓ Status: "Needs Attention" (not "Scanning...")
    ✓ 5 events appear with stagger after score
    ✓ Events (24h): 12
    ✓ Context bar explains Trivy attack connection
    ✗ No "0" score static display

  opensyber.cloud/threats
    ✓ Threat counter shows ~847 and increments
    ✓ Live table shows 10 events
    ✓ New event rotates in every 15s
    ✓ IOC section with real Trivy/TeamPCP IOCs
    ✗ No empty page

  opensyber.cloud/marketplace
    ✓ Mission-framed headline
    ✓ Bundles tab added
    ✓ No review counts or install numbers
    ✓ Beta chips on skills
    ✓ Incident reference tags on relevant skills

MOBILE CHECK (375px viewport):
  ✓ Homepage: attack cards stack to 1 column
  ✓ Pricing: calculator stacks vertically, tiers stack to 1 column
  ✓ Nav: collapses properly, both buttons visible
  ✓ Demo: events readable without scroll

COPY CHECK — search entire codebase for these strings, they must not exist:
  ✗ "Sarah Chen"
  ✗ "Marcus Williams"
  ✗ "Elena Rodriguez"
  ✗ "TechCorp"
  ✗ "FinanceHub"
  ✗ "DevOps Plus"
  ✗ "39 Integrations"
  ✗ "Secure Managed AI Agent Hosting"

If any check fails: output the specific file + line number.

If all checks pass, output exactly:

════════════════════════════════════════
🎯 OPENSYBER MISSION REFRAME COMPLETE
════════════════════════════════════════

HOMEPAGE:
  ✓ Consequences-first hero
  ✓ Real attack cards (Trivy/Clinejection/CanisterWorm)
  ✓ No fake social proof
  ✓ Mission tagline in footer

PRICING:
  ✓ $4.88M vs $299/month framing
  ✓ Consequence calculator live
  ✓ Annual/monthly toggle
  ✓ 5 mission-named tiers ($0/$299/$799/$2,499/$9,999)

DEMO + THREATS:
  ✓ Score animates, events populate
  ✓ Live threat feed with real IOCs

SITE-WIDE:
  ✓ Page title updated
  ✓ Incident banner active
  ✓ Nav updated with Bundles

NEXT ACTIONS:
  1. Publish Trivy blog post to Hacker News TODAY
     Title: "We built a GitHub Actions SHA pinner after the Trivy attack"
  2. Tweet: "OpenSyber is the containment layer MCP forgot to build"
  3. Email the 5 security researchers who covered Trivy:
     offer exclusive access + ask for honest feedback
  4. Submit to Product Hunt next Monday
  5. DM r/netsec and r/devops with the Trivy analysis post
════════════════════════════════════════
```

---

## PARALLEL EXECUTION MAP

```
Run simultaneously (all independent):
  Agent A — Homepage
  Agent B — Pricing page
  Agent C — Demo page
  Agent D — Threats page
  Agent E — Nav + Layout
  Agent F — Marketplace
  Agent G — Email templates

Run last (after all confirm complete):
  Merge Agent — Full verification
```

## ESTIMATED TIME

```
Parallel wall clock: 45-60 minutes
Sequential: ~4 hours
```

## THE SINGLE MOST IMPORTANT CHANGE

If you can only run one agent right now, run **Agent B** (pricing page).

The consequence calculator — "your breach exposure vs OpenSyber cost" —
changes every pricing conversation permanently.
A prospect who has seen that calculator doesn't ask "is this expensive?"
They ask "how fast can I get started?"
