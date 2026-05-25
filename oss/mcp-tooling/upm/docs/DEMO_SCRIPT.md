# UPM Demo Video Script

## 2-Minute Product Demo

---

### [0:00-0:10] Hook

**Visual**: Dark screen, code scrolling rapidly. Sound of keyboard typing.

**Narrator (Sarah, CEO)**:
"In modern software, 97% of your code comes from dependencies you've never inspected."

**Visual**: Screen flashes red. "VULNERABILITY DETECTED" warning.

**Narrator**:
"But what if you could see everything? And fix it... instantly?"

---

### [0:10-0:30] Problem Introduction

**Visual**: Split screen. Left: Developer stressed, multiple terminal windows open. Right: Calendar showing "6 weeks to fix."

**Narrator**:
"Today's dependency security tools are fragmented. You use one scanner for Maven, another for npm, another for Python. They flood you with false positives. And when you actually find a vulnerability? It takes weeks to fix."

**Visual**: frustrated Developer throwing hands up.

**Narrator**:
"We built UPM to change that."

---

### [0:30-1:00] Platform Overview

**Visual**: UPM dashboard animation. Clean, modern interface. Metrics showing 100% coverage.

**Narrator**:
"UPM is the Universal Dependency Platform. One dashboard. All your ecosystems. Complete visibility."

**Visual**: Scanning animation. Maven logo → npm logo → PyPI logo → Cargo logo → Go logo. All green checkmarks.

**Narrator**:
"We scan everything. Direct dependencies. Transitive dependencies. Even the stuff you didn't know you had."

**Visual**: Dashboard shows a project with 847 dependencies discovered.

**Narrator**:
"Average enterprise app? 5,000 dependencies. UPM finds them all."

---

### [1:00-1:30] AI & Remediation

**Visual**: Vulnerability list. One highlighted with high risk score.

**Narrator**:
"But here's where UPM is different. We don't just dump 10,000 vulnerabilities on you. Our AI predicts which ones will actually be exploited."

**Visual**: AI animation. Vulnerability list reduces from 10,000 to 3 critical items.

**Narrator**:
"Stop noise. Start fixing what matters."

**Visual**: IntelliJ IDE showing red underline on a dependency. Hover tooltip appears. "One-click fix available" button.

**Narrator**:
"And when you need to fix? One click."

**Visual**: Pull request auto-generated. Tests passing. Merge button enabled.

**Narrator**:
"We handle breaking changes. We validate your tests. We even roll back if something goes wrong."

---

### [1:30-1:50] Developer Experience

**Visual**: Happy Developer. Coffee in hand. Calm music.

**Narrator**:
"UPM integrates into your workflow. Real-time alerts in your IDE. Automatic scans in your CI. Zero friction."

**Visual**: VS Code showing vulnerability warning, developer clicks "Fix", continues working.

**Narrator**:
"Your developers will actually like using it. Security that doesn't slow them down."

---

### [1:50-2:00] CTA

**Visual**: UPM logo. "Try UPM Free" button.

**Narrator**:
"UPM. Secure the software that runs the world."

**Visual**: URL: upm.io

**Narrator**:
"Try it free today."

---

## 5-Mute Feature Deep Dive

### [0:00-0:30] Introduction

**Visual**: Sarah (CEO) on camera. Modern office background.

**Sarah**:
"Hi, I'm Sarah Chen, CEO of UPM. Today, I want to show you how UPM is transforming software supply chain security. Let's dive in."

---

### [0:30-1:30] Multi-Ecosystem Scanning

**Visual**: Screen share. UPM dashboard.

**Sarah**:
"The first thing you'll notice: we support everything. Watch this."

**Visual**: She clicks "New Project." Selects "Java/Maven." Uploads pom.xml. Scanning animation completes in 3 seconds.

**Sarah**:
"1,247 dependencies found. Including 5 levels deep. Now watch this."

**Visual**: She clicks "Add Ecosystem." Adds "npm." Uploads package.json. Dashboard updates.

**Sarah**:
"Now we're seeing the full picture. Java and JavaScript dependencies together. Cross-component vulnerabilities. Complete visibility."

---

### [1:30-2:30] AI Risk Scoring

**Visual**: Vulnerabilities tab.

**Sarah**:
"Here's where the magic happens. See this vulnerability? CVSS 9.8. Critical. But see this risk score? It's only 15."

**Visual**: She clicks into the vulnerability.

**Sarah**:
"UPM's AI is telling us this vulnerable code isn't actually used in production. It's a test dependency. The exploit prediction is low. We can safely deprioritize."

**Visual**: She switches to another vulnerability. Risk score: 95.

**Sarah**:
"Now THIS one. CVSS 7.5. But risk score 95. Why?"

**Visual**: Panel shows reasoning: "Production dependency. High-value target. Exploit code available on GitHub."

**Sarah**:
"This is what gets fixed first."

---

### [2:30-3:30] Automated Remediation

**Visual**: She clicks "Generate Fix."

**Sarah**:
"One click. That's all it takes."

**Visual**: Side panel appears. Shows the fix: "Upgrade from 1.4.5 to 1.4.9". Breaking changes section: "None detected."

**Sarah**:
"UPM analyzed the changelog. Checked for API changes. Compared the git history. We're confident this fix is safe."

**Visual**: She clicks "Create PR." GitHub opens. Pull request created. All checks passing.

**Sarah**:
"The PR is ready. Tests are passing. Your team just reviews and merges."

---

### [3:30-4:15] IDE Integration

**Visual**: Switches to IntelliJ.

**Sarah**:
"But my favorite part? You don't even need the dashboard."

**Visual**: She opens a Java file. Red underline on an import.

**Sarah**:
"See this? UPM found a vulnerable dependency. Right in my IDE. Hover for details."

**Visual**: Hover tooltip shows CVE, severity, risk score. Quick Action: "Fix this vulnerability."

**Sarah**:
"One click. The fix is applied. My tests run. I commit. All before I even push to GitHub."

---

### [4:15-5:00] Enterprise Features

**Visual**: Back to dashboard. Settings page.

**Sarah**:
"For enterprises, we've got you covered. SSO with Okta, Azure AD, Google. Fine-grained RBAC. Immutable audit logs for compliance. Self-hosted deployment if you need it."

**Visual**: Compliance report generating. SBOM downloading.

**Sarah**:
"Audit ready? One click. SBOM for your regulators? One click. We handle the paperwork so you can focus on shipping."

---

### [5:00-5:30] Closing

**Visual**: Sarah back on camera.

**Sarah**:
"Look, software supply chain security isn't getting easier. The threats are increasing. But with UPM, you're ready. We scan everything. We prioritize intelligently. We fix automatically. And your developers? They'll love using it."

**Visual**: UPM logo, tagline, URL.

**Sarah**:
"I'm Sarah Chen, CEO of UPM. Try UPM free at upm.io. Let's secure the software that runs the world. Together."

---

## Screen-by-Screen Storyboard

### Scene 1: The Problem (15 seconds)

| Frame | Visual | Audio |
|-------|--------|-------|
| 1 | Dark room, monitor glow | Typing sounds |
| 2 | Code scrolling fast | Music builds |
| 3 | Suddenly: RED SCREEN | Alarm sound |
| 4 | "VULNERABILITY DETECTED" | Narrator: "Your dependencies have 500+ vulnerabilities" |
| 5 | Stressed developer | Narrator: "And you don't even know it" |

### Scene 2: The Solution (15 seconds)

| Frame | Visual | Audio |
|-------|--------|-------|
| 1 | UPM logo fades in | Upbeat music |
| 2 | Dashboard overview | Narrator: "Meet UPM" |
| 3 | Ecosystem logos flying in | Narrator: "One platform for all your dependencies" |
| 4 | Scanning animation | Narrator: "Scan in seconds, not hours" |
| 5 | Green checkmarks | Narrator: "Fix in minutes, not weeks" |

### Scene 3: Key Features (30 seconds)

| Frame | Visual | Audio |
|-------|--------|-------|
| 1 | AI brain animation | Narrator: "AI that knows what matters" |
| 2 | Risk score in action | Narrator: "Prioritize by real risk" |
| 3 | One-click fix | Narrator: "Automated remediation" |
| 4 | IDE plugin demo | Narrator: "Real-time in your workflow" |
| 5 | Compliance report | Narrator: "Audit-ready anytime" |

### Scene 4: Call to Action (15 seconds)

| Frame | Visual | Audio |
|-------|--------|-------|
| 1 | Happy team | Narrator: "Join 5,000+ teams" |
| 2 | Testimonials scrolling | Narrator: "They love UPM" |
| 3 | Pricing: FREE | Narrator: "Start free today" |
| 4 | UPM logo + URL | Narrator: "upm.io" |

---

## Production Notes

### Style Guidelines
- **Tone**: Confident, technical, approachable
- **Pace**: Fast but not rushed
- **Music**: Electronic, modern, builds energy
- **Visuals**: Clean, animated, data-driven

### Color Palette
- Primary: #6366f1 (Indigo)
- Accent: #22d3ee (Cyan)
- Success: #10b981 (Green)
- Danger: #ef4444 (Red)
- Dark: #0f172a (Slate)

### Voice Guidelines
- **Sarah (CEO)**: Warm, confident, visionary
- **Marcus (CTO)**: Technical, precise, enthusiastic
- **Narrator**: Clear, energetic, professional

### Key Animations
1. Scanning pulse (radar effect)
2. Vulnerability countdown (10,000 → 3)
3. One-click fix (sparkle effect)
4. Ecosystem convergence (logos merging)
5. Dashboard data visualization

---

## Equipment Needed

- Camera: 4K quality (Sony/Canon)
- Lighting: Studio setup (3-point)
- Microphone: Lavalier (Sennheiser)
- Screen recording: Clean setup (Cursor)
- Editing: Final Cut Pro / Premiere

---

## Distribution

- Website homepage (autoplay, muted)
- YouTube (UPM channel)
- Product Hunt (video gallery)
- Social media (Twitter, LinkedIn)
- Sales demos (feature walkthrough)

---

*Script Version: 1.0*
*Total Duration: 2 minutes (short), 5 minutes (long)*
*Production Budget: $15,000 - $25,000*
