# LunaOS Product Hunt Demo Video Script

**Duration**: 2:00 | **Format**: 1920x1080 @ 60fps | **Audio**: Voiceover + background music

---

## Scene 1 — Hook (0:00 - 0:10)

**[SCREEN]** Dark background. Text fades in letter by letter:
*"What if you had 28 AI agents watching your code?"*
LunaOS logo animates in below. Subtle particle effect behind logo.

**[NARRATOR]**
> "What if you had twenty-eight AI agents watching your code,
> reviewing every pull request, catching every bug, writing every test?
> Meet LunaOS."

**[TRANSITION]** Logo scales down to top-left corner. Screen wipes to Scene 2.

---

## Scene 2 — The Problem (0:10 - 0:25)

**[SCREEN]** Split-screen montage (fast cuts, 2s each):
1. Developer tabbing between ChatGPT, GitHub, Jira, terminal
2. PR with 400+ lines, no reviewer assigned, 3 days old
3. Production alert at 2 AM — missed security vulnerability
4. Manual deployment checklist with unchecked items

**[NARRATOR]**
> "Developers waste hours switching between AI tools.
> Code reviews pile up. Security gaps slip through.
> Deployments break because someone skipped a step.
> There has to be a better way."

**[TRANSITION]** Screen shatters. Terminal window slides in from right.

---

## Scene 3 — CLI Demo (0:25 - 0:50)

**[SCREEN]** macOS terminal, dark theme. iTerm2, SF Mono 14pt, 120x30 chars.

**[NARRATOR + TERMINAL]**
> "Install LunaOS in one command."

```bash
$ npm i -g @luna-agents/cli
# Show install progress bar completing in ~2 seconds
```

> "Initialize it in any project."

```bash
$ cd my-app && luna init
# Output: Created .luna/config.yml
# Output: Detected: TypeScript, React, Node.js
# Output: 28 agents ready.
```

> "Run your first agent."

```bash
$ luna run code-review
# Scanning 47 files...
# Found 3 critical issues, 7 suggestions
# [CRITICAL] SQL injection risk in api/users.ts:42
# [CRITICAL] Missing auth check in api/admin.ts:18
# [SUGGEST] Extract duplicate logic in utils/helpers.ts
```

> "Three critical issues caught in twelve seconds.
> No context-switching. No copy-pasting code into a chatbox."

**[TRANSITION]** Terminal shrinks to bottom-right. Browser opens.

---

## Scene 4 — Dashboard Demo (0:50 - 1:15)

**[SCREEN]** Chrome (clean profile, no bookmarks bar) at `agents.lunaos.ai`.
Mouse movements smooth and deliberate. Highlight clicks with yellow ripple.

**[NARRATOR + BROWSER]**
> "Prefer a visual interface? The dashboard has you covered."

Show agent catalog grid (28 cards with icons). Hover over Code Review,
Test Generator, Security Audit, Docs Writer.

> "Twenty-eight agents, organized by category.
> Code quality, testing, security, deployment, documentation."

Click "Code Review" card. Config panel opens. Select repo, pick branch,
click "Run Agent".

> "Select your repo, pick a branch, hit run."

Results stream in live. Progress bar fills. Findings show severity badges
and inline code snippets linking to exact source lines.

> "Results stream in live. Every finding links back to the exact line."

**[TRANSITION]** Browser tab morphs into Studio tab.

---

## Scene 5 — Chains in Studio (1:15 - 1:30)

**[SCREEN]** Browser at `studio.lunaos.ai`. Empty canvas. Drag nodes from
left palette with smooth, deliberate movements. Connections animate on link.

**[NARRATOR + BROWSER]**
> "Now here is where it gets powerful. Agent Chains."

1. Drag "Code Review" node onto canvas from palette.
2. Drag "Test Generator" to the right. Connect output to input.
3. Drag "Security Audit" below. Connect in parallel.

> "Drag three agents onto the canvas. Connect them.
> Code review feeds into test generation.
> Security audit runs in parallel.
> One click executes the entire chain."

Click green "Execute Chain" button. All three nodes light up with
progress indicators, then show green checkmarks.

> "Your entire review pipeline, automated."

**[TRANSITION]** Zoom into the RAG badge on an agent node.

---

## Scene 6 — RAG Context (1:30 - 1:40)

**[SCREEN]** Dashboard settings, GitHub integration panel. Click "Connect
GitHub", show brief OAuth flow (simulated), repo list populates.

**[NARRATOR]**
> "Connect your GitHub repo, and every agent understands YOUR code."

Show: repo connected, indexing progress bar, "Indexed 1,247 files".

> "LunaOS indexes your entire codebase with RAG.
> Agents reference your actual architecture, your patterns, your conventions.
> Not generic advice. Your code, your context."

**[TRANSITION]** Soft fade to pricing slide.

---

## Scene 7 — Pricing (1:40 - 1:50)

**[SCREEN]** Clean pricing comparison. Two cards side by side:

| | Free | Pro |
|---|---|---|
| Agent runs | 100/month | Unlimited |
| Built-in agents | 28 | 28 + custom |
| RAG context | 1 repo | Unlimited repos |
| Chains | 3 active | Unlimited |
| Team members | 1 | Up to 25 |
| Price | $0 | $29/month |

**[NARRATOR]**
> "Start free with a hundred agent runs per month.
> Go Pro for unlimited runs, custom agents, and team workspaces.
> Twenty-nine dollars a month. No per-seat pricing."

**[TRANSITION]** Cards slide off. Final screen fades in.

---

## Scene 8 — Call to Action (1:50 - 2:00)

**[SCREEN]** Dark background. Centered: LunaOS logo (large),
"Start free at **lunaos.ai**" below, Product Hunt badge (animated) at bottom.
Subtle starfield animation in background.

**[NARRATOR]**
> "Twenty-eight agents. One platform. Zero context-switching.
> Start free at lunaos dot AI."

Hold 3 seconds on final frame. Music fades out.

---

## Production Notes

**Music**: Upbeat electronic, minimal (Apple keynote energy). Epidemic Sound
or Artlist. -18dB under narration, -12dB during transitions.

**Voiceover**: Confident, technical but approachable. 150 wpm with 0.5s
pauses between sections. ~320 total words fits 2:00 at natural pace.

**Screen recordings**: Capture at 3840x2160, downscale in post. ScreenFlow
or OBS with cursor highlight. Remove notifications. Use realistic demo data.

**Colors**: BG #0a0a0a | Text #fafafa | Accent #6366f1 | OK #22c55e | Warn #eab308 | Crit #ef4444

**Export**: MP4 H.264, 1920x1080, 60fps, 20 Mbps, AAC 320kbps stereo.
