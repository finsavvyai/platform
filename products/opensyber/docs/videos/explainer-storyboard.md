# Explainer Video Storyboard: "Deploy a Secure AI Agent in 60 Seconds"

**Duration**: 2 minutes (120 seconds)
**Format**: 1920x1080 / 16:9 / 30fps
**Style**: Dark UI product walkthrough with motion graphics overlays
**Brand palette**: #00E5C3 (teal/signal), #080B0F (void/background), #4D9EFF (info blue), #2ECC7B (ok green)
**Fonts**: Bebas Neue (display), Space Mono (mono/labels), DM Sans (body)

---

## AI Narration Settings (ElevenLabs)

- **Voice**: Male, calm, mid-range, American English
- **Style**: Technical authority. Think "senior engineer explaining to a peer" not "salesman pitching"
- **Stability**: 0.55 (natural variation)
- **Clarity + Similarity Enhancement**: 0.78
- **Pacing**: Measured, deliberate. No rush. Pauses between sections.
- **Recommended voice**: "Adam" or "Josh" from ElevenLabs library

---

## Scene 1 — HOOK

**Timestamp**: 0:00 - 0:10

**Visual description**:
Black screen (#080B0F). A single teal crosshair cursor blinks into frame center. The question fades in using Bebas Neue, word by word, tracking-wide. Subtle particle field drifts in background (low opacity teal dots). The crosshair logo resolves into the OpenSyber wordmark at 0:08.

**Text overlay**:
```
WHAT IF DEPLOYING A SECURE AI AGENT
TOOK 60 SECONDS?
```
(Bebas Neue, 64px, white, centered. "60 SECONDS" in #00E5C3.)

**Narration script**:
"What if deploying a secure AI agent took sixty seconds? Not hours of server hardening. Not weeks of compliance paperwork. Sixty seconds."

**Music/SFX**:
- Low ambient drone begins (dark, electronic, minimal)
- Subtle digital "lock" click on "60 seconds"

**Transition**: Crosshair logo pulses once, then cuts to Scene 2.

**Screen recording**: None (pure motion graphics).

---

## Scene 2 — PROBLEM

**Timestamp**: 0:10 - 0:25

**Visual description**:
Split screen showing three real-world failure scenarios as stylized terminal windows on #080B0F background. Each appears with a stagger (0.15s delay, matching the app's StaggerChildren pattern). Terminal 1: leaked credentials scrolling. Terminal 2: unmonitored agent running root. Terminal 3: CVE alert ignored for 204 days. A red pulse radiates behind each terminal.

**Text overlay**:
```
THE PROBLEM
```
(Space Mono, 10px, uppercase, tracking-wider, #00E5C3, top-left label with horizontal line accents)

Then stat callouts appear bottom-right:
```
$4.88M avg breach cost — IBM
204 days detection without monitoring
```
(Space Mono, 11px, #7A8899 secondary text)

**Narration script**:
"Self-hosted AI agents are a security risk. No isolation, no monitoring, no audit trail. The average breach costs four point eight million dollars. Detection without monitoring takes two hundred and four days. Your AI agents deserve better."

**Music/SFX**:
- Tension builds slightly (low frequency pulse)
- Terminal typing SFX (soft mechanical keyboard)
- Alert chime on "204 days"

**Transition**: Terminals dissolve into particles that reform into the OpenSyber dashboard.

**Screen recording**: None (animated terminals with fictional data).

---

## Scene 3 — STEP 1: Sign Up and Deploy

**Timestamp**: 0:25 - 0:45

**Visual description**:
Actual screen recording of the OpenSyber dashboard at `/dashboard`. Show the empty state first: the centered card with the Server icon, "No instances yet" heading, and "Deploy your first secure AI agent instance" description. Mouse clicks "Deploy Instance" button. The instance card appears with status indicators (InstanceStatusCard component). Overlay a step counter in top-right corner.

**Text overlay**:
```
STEP 01
```
(Space Mono, 11px, #7A8899, top-right, matching HowItWorksSection styling)

Lower third:
```
SIGN UP. DEPLOY. DONE.
```
(Bebas Neue, 36px, white. "DONE." in #00E5C3.)

At 0:38, a teal highlight outline appears around the instance status card showing the agent is online.

**Narration script**:
"Step one. Sign up and deploy your first agent. One click. Your instance launches pre-configured with security hardening, an encrypted credential vault, and real-time monitoring. No YAML files. No Docker configs. Just click deploy."

**Music/SFX**:
- Ambient drone shifts to slightly warmer tone
- Satisfying "deploy" confirmation sound (soft chime)
- Subtle UI interaction sounds on button clicks

**Transition**: Smooth scroll-pan downward within the dashboard, camera zooms into the StatsGrid area.

**Screen recording instructions**:
1. Navigate to `opensyber.cloud/dashboard` (logged in, no instances)
2. Record the empty state with "No instances yet" card
3. Click "Deploy Instance" button
4. Wait for instance to appear with "running" status
5. Capture at 1920x1080, browser chrome hidden, dark mode

---

## Scene 4 — STEP 2: Install Skills from the Marketplace

**Timestamp**: 0:45 - 1:05

**Visual description**:
Screen recording of the marketplace at `/dashboard/marketplace`. Show the SkillCard grid with skill tiles (Secret Scanner, Git Guardian, Dependency Auditor visible). Mouse hovers over a skill card (hover:-translate-y-1 animation triggers). Click to open the InstallModal. Show the install confirmation. Then cut to `/dashboard/skills` showing installed skills with status badges.

**Text overlay**:
```
STEP 02
```
(Space Mono, 11px, #7A8899, top-right)

Lower third:
```
AUDITED SKILL MARKETPLACE
```
(Bebas Neue, 36px, white. "AUDITED" in #4D9EFF info blue.)

Feature callout bubbles appear near marketplace cards:
```
Every skill security-reviewed
70/30 creator revenue split
```
(Space Mono, 10px, in small brand-card styled tooltips)

**Narration script**:
"Step two. Browse the audited skill marketplace. Every skill is security-reviewed before publishing. Install Secret Scanner, Git Guardian, Dependency Auditor, or any of the growing catalog. One click to install. Skills run sandboxed inside your agent with least-privilege access."

**Music/SFX**:
- Light percussive element enters (subtle, rhythmic)
- Card hover: soft "lift" sound
- Install click: confirmation chime (same family as deploy sound)

**Transition**: Wipe-left to dashboard overview.

**Screen recording instructions**:
1. Navigate to `opensyber.cloud/dashboard/marketplace`
2. Record the skill grid (ensure 3+ skills visible)
3. Hover over "Secret Scanner" card (capture the elevation animation)
4. Click to open install modal
5. Click install, wait for success state
6. Navigate to `/dashboard/skills` to show installed list
7. Capture at 1920x1080, browser chrome hidden

---

## Scene 5 — STEP 3: Monitor in Real-Time

**Timestamp**: 1:05 - 1:25

**Visual description**:
Screen recording of the dashboard at `/dashboard`. Show the full StatsGrid: Security Score gauge (large Bebas Neue number), CPU/Memory/Disk progress bars with animated fills, and the Recent Security Events list with severity badges (CRITICAL in red, HIGH in amber, INFO in default). Hover over the Security Score card to reveal the recommendation tooltip. Then quick cut to `/dashboard/security` for the full security view, and `/dashboard/agents/alert-channels` showing Slack/PagerDuty integrations.

**Text overlay**:
```
STEP 03
```
(Space Mono, 11px, #7A8899, top-right)

Lower third:
```
REAL-TIME SECURITY MONITORING
```
(Bebas Neue, 36px, white. "REAL-TIME" in #2ECC7B ok green.)

Stat callout:
```
< 12 hrs detection with OpenSyber
```
(Space Mono, 11px, #00E5C3)

**Narration script**:
"Step three. Monitor everything in real time. Your security score updates continuously. CPU, memory, disk usage at a glance. Every security event is logged with severity, timestamp, and recommended action. Connect Slack, PagerDuty, or any of your existing tools. Detection time drops from two hundred and four days to under twelve hours."

**Music/SFX**:
- Full ambient track now (still calm, but confident)
- Soft data-tick sounds as metrics animate
- Alert badge appearance: subtle notification tone

**Transition**: Dashboard elements shrink and arrange into a grid pattern, revealing Scene 6 behind.

**Screen recording instructions**:
1. Navigate to `opensyber.cloud/dashboard` (with running instance and security data)
2. Ensure Security Score, CPU, Memory, Disk metrics are populated
3. Ensure Recent Security Events has 3+ events with mixed severities
4. Hover over Security Score card to trigger the recommendation tooltip
5. Quick cut to `/dashboard/security` overview
6. Quick cut to `/dashboard/agents/alert-channels` showing integrations
7. Capture at 1920x1080, browser chrome hidden

---

## Scene 6 — DIFFERENTIATORS

**Timestamp**: 1:25 - 1:40

**Visual description**:
Motion graphics on #080B0F. Three pillars appear in a row (matching the PillarsSection layout from the homepage). Each pillar is a brand-card with its icon, title, and three feature bullets. They stagger in with the same 0.15s delay pattern. Pillar 1: Shield icon, "Secure Infrastructure" (#00E5C3). Pillar 2: Package icon, "Skill Marketplace" (#4D9EFF). Pillar 3: MonitorDot icon, "Real-Time Monitoring" (#2ECC7B).

Below the pillars, a single highlight bar appears:

**Text overlay**:
```
TOKENFORGE DEVICE BINDING
ECDSA P-256 session security
```
(Bebas Neue 28px + Space Mono 11px, centered, #00E5C3 accent)

Then:
```
SOC 2 + ISO 27001 COMPLIANCE REPORTS
SAML / OIDC SSO FOR ENTERPRISE
```
(Space Mono, 11px, uppercase, white, centered)

**Narration script**:
"What makes OpenSyber different? Three pillars. Secure infrastructure with container isolation and auto-patching. An audited skill marketplace where creators earn seventy percent of revenue. And real-time monitoring with actionable alerts. Plus TokenForge device-bound sessions, compliance reporting, and enterprise SSO. Security that does not slow you down."

**Music/SFX**:
- Confident build (still ambient, slightly more energy)
- Each pillar appearance: subtle "card place" sound
- TokenForge mention: distinctive crystalline tone

**Transition**: Pillars compress horizontally, pricing cards expand from center.

**Screen recording**: None (motion graphics recreating homepage pillar design).

---

## Scene 7 — PRICING

**Timestamp**: 1:40 - 1:55

**Visual description**:
Motion graphics showing three pricing cards on #080B0F. Starter Shield (free), Team ($299/mo, "POPULAR" badge in teal), Professional ($799/mo). Cards use brand-card styling. The Team card is slightly elevated and has a teal border glow to indicate popularity. Key features fade in below each card. Enterprise and Mission Defender are mentioned as text below: "Enterprise from $2,499/mo. Custom plans available."

**Text overlay**:
Card headers (Bebas Neue):
```
STARTER SHIELD     TEAM              PROFESSIONAL
$0/mo              $299/mo           $799/mo
```
("POPULAR" badge on Team card in Space Mono 10px, teal background)

Bottom line (DM Sans, 14px, #7A8899):
```
Start free forever. No credit card required.
```

**Narration script**:
"Start free with Starter Shield. One agent, three security skills, encrypted vault, auto-patching. Upgrade to Team at two ninety-nine a month for three agents and full skill access. Professional at seven ninety-nine adds compliance reports, RBAC, and TokenForge. Enterprise plans start at twenty-four ninety-nine. No credit card to start. Upgrade when you are ready."

**Music/SFX**:
- Calm, steady beat
- Price card appearances: soft "card deal" sounds
- "POPULAR" badge: subtle highlight chime

**Transition**: Cards fade to center, CTA text scales up.

**Screen recording**: None (animated pricing cards).

---

## Scene 8 — CALL TO ACTION

**Timestamp**: 1:55 - 2:00

**Visual description**:
Black screen (#080B0F). OpenSyber crosshair logo animates in at center (same as opening, but now fully resolved). Below it, the URL appears in Space Mono. A teal button-styled CTA pulses gently. Particle field returns, slightly brighter than opening. The crosshair cursor from Scene 1 returns, clicks the CTA, triggering a satisfying ripple effect.

**Text overlay**:
```
OPENSYBER
```
(Bebas Neue, 72px, white, centered)

```
Deploy a secure AI agent in 60 seconds.
```
(DM Sans, 18px, #C0C8D4, centered below logo)

```
START FREE AT OPENSYBER.CLOUD
```
(Space Mono, 14px, #00E5C3, uppercase, tracking-wider, inside a rounded border button outline)

**Narration script**:
"Deploy a secure AI agent in sixty seconds. Start free at opensyber dot cloud."

**Music/SFX**:
- Track resolves to a clean, satisfying finish
- Final "lock" click sound (callback to opening)
- 1 second of silence at the end

**Transition**: Hold for 3 seconds on final frame (thumbnail-friendly).

**Screen recording**: None (motion graphics).

---

## Production Notes

### Music
- **Style**: Dark ambient electronic, minimal percussion, no vocals
- **Reference tracks**: Tycho "Awake" intro energy, or Rival Consoles "Articulation"
- **License**: Use Artlist, Epidemic Sound, or commission original
- **BPM**: 80-90 (deliberate, not frantic)
- **Volume**: Music at -18dB under narration, -12dB during non-narration moments

### Screen Recording Setup
- Browser: Chrome, maximized, no extensions visible
- URL bar: Hidden (use Presentation mode or crop in post)
- Resolution: 1920x1080 native (no scaling artifacts)
- Dark mode: Ensure system and browser are in dark mode
- Demo data: Populate dashboard with realistic security events, metrics, and skills before recording
- Mouse cursor: Use a custom teal cursor (#00E5C3) matching brand
- Recording tool: OBS Studio at 60fps, downscale to 30fps in edit

### Motion Graphics
- Tool: After Effects or Motion (Apple)
- Easing: ease-out for entries (matching Tailwind `transition-all duration-300 ease-out` in codebase)
- Card animations: Match the `hover:-translate-y-1 transition-all duration-300` from SkillCard/PillarsSection
- Stagger timing: 150ms between card appearances (matching `staggerDelay={0.15}` from FadeIn components)
- Text fade-in: 400ms opacity transition per line
- Color accuracy: Use exact hex values from brand system, not approximations

### Thumbnail
- Frame from Scene 8 (logo + CTA)
- Add "60 SECONDS" in Bebas Neue at top
- Add a small dashboard screenshot composite in lower-right

### Distribution Formats
- YouTube: 1920x1080, H.264, AAC audio
- Twitter/X: 1280x720, 2:20 max (we are at 2:00)
- LinkedIn: 1920x1080, add captions baked in
- Product Hunt: 1920x1080, autoplay-ready (first 3 seconds must hook)
- Website embed: WebM + MP4 fallback, lazy-loaded

### Captions/Subtitles
- Generate SRT from narration script
- Font: DM Sans Bold, 24px, white with #080B0F 80% opacity background
- Position: Bottom center, 60px from edge
- Timing: Word-level sync for accessibility

### Total Asset List
| Asset | Source | Notes |
|-------|--------|-------|
| Screen recording: empty dashboard | Live app | Scene 3 |
| Screen recording: deploy flow | Live app | Scene 3 |
| Screen recording: marketplace browse + install | Live app | Scene 4 |
| Screen recording: dashboard with metrics | Live app | Scene 5 |
| Screen recording: security events | Live app | Scene 5 |
| Screen recording: alert channels | Live app | Scene 5 |
| OpenSyber logo (crosshair) SVG | Brand assets | Scenes 1, 8 |
| Pricing card designs | Recreate from plans.ts | Scene 7 |
| Pillar icons (Shield, Package, MonitorDot) | Lucide icon set | Scene 6 |
| AI narration audio | ElevenLabs | All scenes |
| Background music track | Licensed | All scenes |
| SFX library | Licensed | UI sounds, chimes, clicks |
