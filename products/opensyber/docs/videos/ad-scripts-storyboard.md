# OpenSyber Paid Acquisition — Ad Video Scripts

**Created**: 2026-03-30
**Brand Colors**: Primary #00E5C3 (teal), Alert #FF4D4D (red), Background #080B0F
**Tone**: Direct, urgent but not panicky. Problem, solution, proof, CTA.

---

## Ad 1: "Your Agents Are Running Unsecured" (DevSecOps Engineers)

### Audience Profile

| Attribute | Detail |
|-----------|--------|
| Title | DevSecOps Engineer, Platform Engineer, SRE, Security-minded Developer |
| Company | Startup to mid-market (50-500 employees) |
| Pain | Deploying AI agents with no runtime security, no audit trail, no supply chain verification |
| Motivation | Ship fast without security becoming a blocker |
| Channels | YouTube, Dev.to, Hacker News, GitHub, Reddit r/devops |
| Age range | 25-40 |

### Platform and Format

- **Platform**: YouTube Pre-Roll
- **Format**: 30-second skippable in-stream ad (TrueView)
- **Aspect ratio**: 16:9 (1920x1080)
- **Safe zone**: Key visuals and text within center 80% for mobile

### Scene-by-Scene Storyboard

#### Scene 1: Hook (0:00 - 0:03)

| Element | Detail |
|---------|--------|
| Visual | Black screen (#080B0F). White monospace text types in character by character: "Your AI agents are running unsecured right now." Red (#FF4D4D) underline pulses under "unsecured." |
| Text overlay | "Your AI agents are running unsecured right now." |
| Narration | (Calm, direct male/female VO) "Your AI agents are running unsecured right now." |
| SFX | Single low-frequency terminal beep on text appear. |

#### Scene 2: Pain (0:03 - 0:10)

| Element | Detail |
|---------|--------|
| Visual | Fast-cut montage (1.5s each): (1) Terminal showing `SECRET_KEY=sk-live-...` in a log output with red highlight box. (2) `htop`-style process list with unknown processes running, red warning badges. (3) Empty audit log page with "No events recorded" and a shrug icon. (4) Supply chain dependency tree with red nodes pulsing "CVE-2026-XXXX". |
| Text overlay | Quick flash text: "Leaked secrets" / "Unmonitored processes" / "No audit trail" / "Supply chain blind spots" |
| Narration | "Leaked secrets. Unmonitored runtimes. No audit trail. Supply chain attacks you can't see coming." |
| SFX | Rapid keystrokes. Subtle alarm tone rising in pitch across the 7 seconds. |

#### Scene 3: Solution (0:10 - 0:20)

| Element | Detail |
|---------|--------|
| Visual | Smooth transition (teal #00E5C3 wipe from left). OpenSyber dashboard fades in on dark background. Camera slowly zooms into: (1) Security Score gauge showing 87/100 in teal arc (2s). (2) Real-time alert feed — new alert slides in: "Suspicious outbound connection blocked" with teal checkmark (2s). (3) Skill Marketplace grid — verified skill cards with green shields and install counts (2s). (4) Quick flash: deploy terminal showing `opensyber deploy --agent my-agent` completing in under 60 seconds (2s). (5) Dashboard overview with 8 security category cards, all green (2s). |
| Text overlay | "Security score. Real-time alerts. Verified skill marketplace. 60-second deploy." |
| Narration | "OpenSyber gives every AI agent a security score, real-time threat alerts, and a verified skill marketplace. Deploy in 60 seconds." |
| SFX | Gentle UI interaction sounds (clicks, swooshes). Calm ambient pad in background. |

#### Scene 4: Proof (0:20 - 0:27)

| Element | Detail |
|---------|--------|
| Visual | Dark background with large animated counters rolling up: "847+ threats tracked" (teal). "8 security categories" (white). "60-second deploy" (teal). Counters appear one after another, left to right, with subtle particle effects in #00E5C3. |
| Text overlay | Same as the counter values. |
| Narration | "847 threats tracked. 8 security categories. Deploy in 60 seconds." |
| SFX | Counter tick sounds (mechanical, satisfying). Brief musical sting at "60 seconds." |

#### Scene 5: CTA (0:27 - 0:30)

| Element | Detail |
|---------|--------|
| Visual | OpenSyber logo (crosshair mark) center screen on #080B0F. Below: "Start free" in Space Mono, white. Below that: "opensyber.cloud" in Bebas Neue, #00E5C3, large. Subtle teal glow pulse behind the logo. |
| Text overlay | "Start free — opensyber.cloud" |
| Narration | "Start free. opensyber.cloud." |
| SFX | Clean resolve tone (single chord). |

### A/B Test Variants — Hooks

| Variant | Hook Text (0-3s) | Hypothesis |
|---------|-------------------|------------|
| A (Control) | "Your AI agents are running unsecured right now." | Direct fear appeal, personal ("your"). |
| B | "One leaked API key. Your entire agent fleet, compromised." | Specific scenario, escalation. |
| C | "Your AI agent just made 47 API calls. Do you know to where?" | Curiosity gap, specificity. |
| D | "93% of AI agents have zero runtime security. Including yours." | Stat-based authority, social proof of problem. |

### Music and SFX

| Element | Recommendation |
|---------|---------------|
| Music | Dark ambient electronic, 90-110 BPM. Build tension in scenes 1-2, resolve to calm confidence in scenes 3-5. Reference: Trent Reznor-style minimal synth. |
| SFX library | Artlist or Epidemic Sound — search "cyber", "terminal", "UI notification" |
| VO style | Calm authority. Not robotic, not excited. Think podcast host, not car commercial. Male or female — test both. |

### Landing Page

- **URL**: `https://opensyber.cloud?utm_source=youtube&utm_medium=preroll&utm_campaign=devsecops_agents_q2_2026`
- **Page**: Homepage with hero focused on "Secure your AI agents in 60 seconds"
- **Above fold**: Security score demo, "Start Free" CTA, no-credit-card badge

### Key Metrics to Track

| Metric | Target | Tool |
|--------|--------|------|
| View-through rate (VTR) | > 25% (skippable benchmark ~15-20%) | Google Ads |
| Click-through rate (CTR) | > 1.2% | Google Ads |
| Cost per view (CPV) | < $0.04 | Google Ads |
| Signup conversion (from landing) | > 8% | PostHog / Plausible |
| Hook retention (watched past 5s) | > 60% | YouTube Analytics |
| A/B hook winner | Highest VTR variant | Google Ads Experiment |

---

## Ad 2: "The Trivy Attack" (Enterprise CISOs)

### Audience Profile

| Attribute | Detail |
|-----------|--------|
| Title | CISO, VP Security, Head of InfoSec, Director of Cloud Security |
| Company | Mid-market to enterprise (500-10,000+ employees) |
| Pain | No visibility into AI agent attack surface, compliance gaps, supply chain risk from open-source tooling |
| Motivation | Reduce organizational risk, pass audits, maintain control as teams adopt AI agents |
| Channels | LinkedIn, RSA Conference content, Dark Reading, CSO Online |
| Age range | 35-55 |

### Platform and Format

- **Platform**: LinkedIn Sponsored Video
- **Format**: 30-second non-skippable in-feed video
- **Aspect ratio**: 1:1 (1080x1080) primary, 16:9 (1920x1080) secondary
- **Note**: LinkedIn auto-plays muted. All key info must work with captions/text only.

### Scene-by-Scene Storyboard

#### Scene 1: Hook (0:00 - 0:03)

| Element | Detail |
|---------|--------|
| Visual | Breaking-news style red banner (#FF4D4D) at top. Dark background. Large white text: "The Trivy attack exposed 45 organizations in 12 hours." Source attribution in small text: "opensyber.cloud/blog" |
| Text overlay | "The Trivy attack exposed 45 organizations in 12 hours." |
| Narration | "The Trivy attack exposed 45 organizations in just 12 hours." |
| SFX | News alert tone. Brief, sharp. |

#### Scene 2: Pain (0:03 - 0:10)

| Element | Detail |
|---------|--------|
| Visual | Three panel split (each ~2.3s): (1) Compliance checklist with red X marks: "AI Agent Inventory [X]", "Runtime Monitoring [X]", "Supply Chain Audit [X]". (2) Dark map visualization showing lateral movement arrows between services — "No visibility" label. (3) Dependency graph with red highlighted nodes — "github-actions v3.2.1 — COMPROMISED" badge pulsing. |
| Text overlay | "Compliance gaps." / "Zero visibility." / "Supply chain risk." |
| Narration | "Compliance gaps in your AI fleet. Zero runtime visibility. Supply chain dependencies you haven't audited." |
| SFX | Low tension drone. Subtle digital interference/glitch on transitions. |

#### Scene 3: Solution (0:10 - 0:20)

| Element | Detail |
|---------|--------|
| Visual | Clean teal wipe transition. OpenSyber enterprise dashboard: (1) RBAC panel showing role hierarchy: Org Admin > Team Lead > Developer with permission matrix (2s). (2) Audit log feed with timestamped entries: "user.role.updated", "agent.deployed", "policy.enforced" with export button (2s). (3) SAML SSO configuration page with Okta/Azure AD logos (2s). (4) Data residency selector showing EU/US/APAC region pins on a minimal map (2s). (5) TokenForge panel: "Device-bound sessions — ECDSA P-256" with green lock icon (2s). |
| Text overlay | "RBAC" / "Audit logs" / "SAML SSO" / "Data residency" / "TokenForge device binding" |
| Narration | "OpenSyber gives your security team full control. Role-based access. Immutable audit logs. SAML SSO. Data residency. And TokenForge device-bound sessions." |
| SFX | Confident, clean UI sounds. Subtle tonal shift to major key. |

#### Scene 4: Proof (0:20 - 0:27)

| Element | Detail |
|---------|--------|
| Visual | Three trust badges appear sequentially on dark background: (1) Shield icon + "SOC 2 Roadmap" (teal). (2) EU flag icon + "GDPR Data Export" (white). (3) Handshake icon + "Enterprise SLA" (teal). Each badge has a subtle glow effect on appear. |
| Text overlay | "SOC 2 roadmap. GDPR export. Enterprise SLA." |
| Narration | "SOC 2 roadmap. GDPR export built in. Enterprise SLA." |
| SFX | Three confident tonal pings, ascending pitch. |

#### Scene 5: CTA (0:27 - 0:30)

| Element | Detail |
|---------|--------|
| Visual | OpenSyber logo (crosshair) center on #080B0F. Below: "Talk to sales" in Space Mono, white. Below that: "opensyber.cloud/enterprise" in Bebas Neue, #00E5C3. Small text below: "or start free — no credit card required" |
| Text overlay | "Talk to sales — opensyber.cloud/enterprise" |
| Narration | "Talk to sales. opensyber.cloud/enterprise." |
| SFX | Single confident resolve chord. |

### A/B Test Variants — Hooks

| Variant | Hook Text (0-3s) | Hypothesis |
|---------|-------------------|------------|
| A (Control) | "The Trivy attack exposed 45 organizations in 12 hours." | Real incident, urgency, quantified impact. |
| B | "Your board just asked about AI agent security. What's your answer?" | Board pressure angle, personal accountability. |
| C | "3 AI agents. 200 unaudited dependencies. 0 visibility." | Specificity, highlights blind spot directly. |
| D | "The EU AI Act takes effect in 6 months. Are your agents compliant?" | Regulatory deadline pressure. |

### Music and SFX

| Element | Recommendation |
|---------|---------------|
| Music | Corporate tension — deep strings or pads, resolving to confident. No beats. Think documentary score, not trailer. 70-90 BPM. |
| SFX library | Artlist — search "corporate tension", "news alert", "UI enterprise" |
| VO style | Authoritative, measured. Senior. Think keynote speaker, not salesperson. Slightly slower pacing than Ad 1 (CISO audience processes differently). Male or female — test both. |
| Captions | Required. LinkedIn plays muted by default. White text on semi-transparent dark bar. Bebas Neue for emphasis words, DM Sans for body. |

### Landing Page

- **URL**: `https://opensyber.cloud/enterprise?utm_source=linkedin&utm_medium=sponsored_video&utm_campaign=ciso_trivy_q2_2026`
- **Page**: Enterprise landing page with compliance badges, architecture diagram, "Talk to Sales" form
- **Above fold**: Trust badges (SOC 2, GDPR, SAML), "Book a demo" CTA, customer logos (when available)

### Key Metrics to Track

| Metric | Target | Tool |
|--------|--------|------|
| View-through rate (VTR) | > 40% (non-skippable, but completion) | LinkedIn Campaign Manager |
| Click-through rate (CTR) | > 0.8% (LinkedIn benchmark ~0.4-0.6%) | LinkedIn Campaign Manager |
| Cost per lead (CPL) | < $85 | LinkedIn Campaign Manager |
| Demo request conversion | > 3% of clicks | PostHog / HubSpot |
| Engagement rate | > 2% (likes, comments, shares) | LinkedIn Campaign Manager |
| A/B hook winner | Highest CTR variant | LinkedIn A/B test |

---

## Production Notes

### Shared Assets Needed

| Asset | Status | Owner |
|-------|--------|-------|
| OpenSyber logo (crosshair) SVG + animation | Exists | Brand |
| Dashboard screen recordings (security score, alerts, marketplace) | Needs capture | Product |
| Teal wipe transition template (After Effects / Motion) | Needs creation | Motion design |
| VO recording (2 scripts x 2 genders = 4 recordings) | Needs production | Audio |
| Background music (2 tracks, licensed) | Needs licensing | Audio |
| Captions file (.srt) for LinkedIn version | Needs creation | Post-production |
| 1:1 crop of Ad 2 for LinkedIn feed | Needs creation | Post-production |

### Typography in Video

| Use | Font | Weight |
|-----|------|--------|
| Headlines / counters | Bebas Neue | Regular |
| Code / terminal text | Space Mono | Regular |
| Body / captions | DM Sans | Regular / Medium |

### Color Reference

| Name | Hex | Usage |
|------|-----|-------|
| Background | #080B0F | All backgrounds |
| Primary teal | #00E5C3 | CTAs, counters, highlights, logo glow |
| Alert red | #FF4D4D | Hook underlines, warning badges, CVE highlights |
| White | #FFFFFF | Body text, secondary info |
| Muted gray | #6B7280 | Attribution, fine print |

### Estimated Budget Per Ad

| Line Item | Cost Range |
|-----------|-----------|
| VO talent (per gender) | $200-500 |
| Motion design (30s) | $800-2,000 |
| Music license | $50-200 |
| SFX license | $30-100 |
| Screen recordings + editing | $300-600 |
| **Total per ad** | **$1,380-3,400** |
| **Total both ads (4 VO variants)** | **$3,500-8,000** |
