# Qestro — Product Hunt Launch Assets

> **Launch date**: TBD (aim for a Tuesday or Wednesday, 00:01 PST posting).
> **Maker**: Shachar Solomon (@shacharsol).
> **Category**: Developer Tools / Artificial Intelligence / Productivity.

---

## 1. Tagline (60 chars max)

Five variants, ranked. The first is the recommended primary.

1. **The testing copilot for teams shipping with AI** *(49 chars — RECOMMENDED)*
2. Tests that write themselves. And heal themselves. *(49 chars)*
3. Browser, mobile, API — tested in plain English *(47 chars)*
4. Your AI writes the code. Qestro writes the tests. *(49 chars)*
5. Self-healing Playwright tests for vibe coders *(46 chars)*

**Why #1**: Names the user (teams shipping with AI), names the product category (testing copilot), avoids jargon, fits the PH audience. Alternate #2 is punchier for social but #1 converts better for the PH page itself.

---

## 2. Description (260 chars max)

Three variants, ranked.

1. **Paste a URL, describe the test in plain English, get production-ready Playwright code. Browser + mobile + API in one tool. When your UI changes, Qestro's self-healing engine fixes the tests itself. Free forever for 5 projects. Built for Cursor/Copilot/Claude Code devs.** *(259 chars — RECOMMENDED)*

2. The copilot for AI-era testing. Generate Playwright, Maestro, and API tests from a sentence. Self-healing when selectors rot. Browser + mobile + API in one dashboard. Free tier. Starter $99/mo. No "contact sales" until you want it. *(235 chars)*

3. Developers ship fast with AI. Qestro makes sure nothing breaks. Describe a flow, get real Playwright code you can commit. Mobile and API tests too. Tests fix themselves when your UI drifts. Starts free. *(207 chars)*

**Why #1**: Leads with the action ("paste a URL"), covers all three surfaces, name-drops Cursor/Copilot/Claude Code (key for AI-coding community upvotes), and tells the free-tier story in the last beat.

---

## 3. First comment (founder voice, under 500 words)

> Hey Product Hunt — Shachar here, maker of Qestro.
>
> Short story on why this exists.
>
> Last year I started shipping everything with Cursor and Claude Code. The code velocity was unreal — features that used to take a week shipped in an afternoon. But within two months my test suite was a graveyard. Playwright specs I'd written in January were failing in March because the AI had quietly refactored half the components. I'd look at a broken test and have no idea whether the test was wrong or the code was wrong.
>
> The honest answer was usually "both, and I don't have time to figure out which."
>
> I tried the enterprise tools. Testim and Mabl are good, but they're built for QA directors, not devs. Record-and-replay produces tests I don't trust and can't read. The output lives inside their dashboard — I can't commit it to my repo. And the pricing starts at "schedule a call."
>
> I tried staying on vanilla Playwright. It's the best testing framework ever built, but writing 40 lines of boilerplate every time I want to test a login flow is the exact friction that made me reach for Cursor in the first place. My Playwright suite kept getting skipped because writing it was slower than shipping the feature.
>
> So I built the thing I wanted. Qestro does three things:
>
> **1. You describe the test in English, it writes real Playwright code.** Not JSON, not a proprietary DSL — actual TypeScript you can commit to your repo. If you leave Qestro tomorrow, the tests come with you.
>
> **2. It covers browser, mobile, and API in one tool.** I was paying for Cypress + Postman + Maestro and maintaining three sets of credentials. Qestro runs all three from one dashboard with one billing line.
>
> **3. When your UI changes, the tests fix themselves.** A button moves, a selector rots, a class name gets refactored — the self-healing engine analyzes the failure, proposes a fix, shows you the diff, you approve it in one click. This is the feature that kept me from abandoning the project halfway through.
>
> **What it's not**: a QA team replacement. Not a record-and-replay tool. Not a Cypress killer — Cypress is great, use Qestro alongside it if you want. And it's not magic; self-healing handles every common selector-churn pattern (benchmarked), but not 100% of all possible failures.
>
> **Pricing**: free forever for 5 projects and 100 runs/month (that's enough for most side projects). $99/mo Starter, $499/mo Pro with mobile + API + CI. Enterprise exists but you don't need it.
>
> Would genuinely love feedback — especially from anyone currently fighting a flaky Cypress suite, or anyone whose AI-written code has out-paced their test coverage. I read everything. AMA.

---

## 4. Follow-up comments (pre-drafted for common PH questions)

### A. "How does this compare to Playwright?"

> Playwright is the framework we build on — and it's excellent. Qestro is the layer on top: natural-language generation, self-healing when selectors break, managed runners for CI, a dashboard for results, and mobile + API under the same roof.
>
> Think of it this way: Playwright is the engine, Qestro is the car. If you want to write every test by hand, maintain your own grid, and set up your own dashboards, stick with vanilla Playwright — it's free and it's great. If you want the AI layer and you don't want to maintain the infra, Qestro is that.
>
> The output is real Playwright code, so you can always eject.

### B. "What's the pricing?"

> Four tiers, all public:
> - **Free**: 5 projects, 100 runs/month. Forever. No credit card.
> - **Starter** $99/mo: 50 projects, 5K runs, browser testing.
> - **Pro** $499/mo: 500 projects, 50K runs, mobile + API + CI/CD + self-healing on every test.
> - **Enterprise**: SSO, SCIM, on-prem, unlimited — priced by usage, contact us.
>
> Deliberately chose self-serve pricing to the $499 tier. If you need procurement, you're Enterprise. If you can expense $99, you're Starter. No sales call required for the first two tiers.

### C. "Is there a free tier?"

> Yes — free forever. 5 projects, 100 runs/month, Playwright browser tests, dashboard, CI integration. No credit card to sign up. No trial timer. Most side projects and indie launches never leave the free tier and that's fine by us — the free tier is the marketing.

### D. "Why should I switch from Cypress?"

> Honestly, you probably shouldn't switch. You should add Qestro where Cypress is weakest: mobile and API. Point Qestro at your Cypress suite and use it to heal flaky selectors, or run it in parallel on new features while keeping Cypress for the existing suite.
>
> The only reason to fully migrate is if you want the natural-language generation and you want the output in Playwright format (committable to your repo). Cypress Studio is good; Qestro's LLM generation is a step beyond it and the output is TypeScript you own.
>
> If you're starting a new project today with no existing test suite, I'd pick Qestro over Cypress — but I'm biased.

### E. "When will [X feature] ship?"

> Depends on the feature — drop the specific one and I'll give you a real date. Current roadmap, highest confidence first:
>
> - **Visual regression dashboard integration**: shipping this week (already built, wiring the UI).
> - **SCIM provisioning + SSO group sync**: ~2 weeks.
> - **Mobile visual regression (Maestro screenshot diff)**: ~4 weeks.
> - **Cross-browser matrix (Safari + Firefox parallel runs)**: ~6 weeks.
> - **Desktop agent (Electron local runner)**: Q3 2026.
> - **Plugin marketplace**: Q4 2026, tentative.
>
> If it's a feature I haven't listed, ask and I'll tell you honestly whether it's on the roadmap, in research, or not happening.

---

## 5. Gallery asset briefs (5–6 slots)

Each slot is 1270×760 min resolution for PH. Deliver PNGs on a dark #0A0B0E background with brand accent (use the teal/cyan from `brand/color-tokens.css`).

### Slot 1 — Hero shot
Product screenshot: the test-creation UI with a URL pasted into the input, a plain-English description ("log in, create a project, assert the dashboard shows the project name"), and the generated Playwright code visible below. Split-view. The code panel should have obviously readable, real TypeScript — no lorem ipsum. Include the Qestro logo subtly in the top-left of the mock UI. This is the one screenshot that sells the product in two seconds.

### Slot 2 — Self-healing in action
Before/after diff: a test failing on a broken selector (`button.submit-old`), then the same test with the selector auto-updated to `button[data-testid="submit"]` and a green pass badge. Include a small "Approve fix" button in the UI mockup. Caption overlay: "Your UI moved. Your test moved with it."

### Slot 3 — Three surfaces, one dashboard
Split into three columns: **Browser** (Playwright Chromium screenshot), **Mobile** (Maestro iOS simulator), **API** (REST response assertion panel). All three panels share a single Qestro nav bar at the top. Caption: "One tool. Three surfaces. One bill."

### Slot 4 — Pricing table
Four-column pricing tiers (Free / Starter $99 / Pro $499 / Enterprise) with the single most-important-feature callout per tier. Clean, Linear/Vercel-style type. No stock checkmark icons — use the Qestro-brand accent color for included features. Include "Self-healing on every paid tier" as a bold cross-column band.

### Slot 5 — The vibe-coding flow
A diagram/illustration (not a screenshot): Cursor or Claude Code on the left generating a feature, Qestro in the middle generating tests from the same spec, CI/CD on the right deploying. Three clean icons, one arrow flow. Caption: "Your AI writes the code. Qestro writes the tests. CI ships it."

### Slot 6 — Roadmap teaser
A minimal roadmap card: "Shipped, Shipping, Next". Under Shipped: Browser, Mobile, API, Self-healing, CI/CD, Visual Regression. Under Shipping: SCIM, Group sync. Under Next: Desktop agent, Plugin marketplace. Understated — conveys momentum without over-promising.

---

## 6. Video script (60–90 seconds, shot-by-shot)

**Format**: screen recording with voice-over. No face cam. No intro logo card. Cut immediately into the product.

| # | Duration | Screen | Voice-over |
|---|----|----|----|
| 1 | 0:00–0:05 | Terminal showing `claude code` generating a new login feature. Code flying. | "Your AI writes code faster than you can test it." |
| 2 | 0:05–0:10 | Switch to browser. Qestro homepage. Hero input field visible. Cursor types a URL. | "So paste the URL into Qestro." |
| 3 | 0:10–0:18 | Text input: "Log in as test user, create a project called 'launch', assert the dashboard shows 'launch'". Enter pressed. | "Describe what you want tested, in English." |
| 4 | 0:18–0:28 | LLM generating. Playwright TypeScript code streams into the editor pane. Real test, readable. | "Get real Playwright code. Not a DSL, not JSON — code you can commit to your repo." |
| 5 | 0:28–0:38 | Click Run. Browser opens, executes steps in real time. Green check marks appear. Screenshots captured. | "Run it. Watch it work. Save it." |
| 6 | 0:38–0:48 | Zoom out to dashboard: three tabs visible — Browser, Mobile, API. Click Mobile, show iOS simulator running the same kind of test. Click API, show a REST assertion. | "Browser, mobile, API. Same tool. Same language." |
| 7 | 0:48–0:60 | Cut to test run failing. Red bar. Self-heal modal pops up: "Selector changed from `.submit` to `[data-testid='submit']`. Approve fix?" One click. Test re-runs, passes. | "When your UI changes, your tests fix themselves. You just approve." |
| 8 | 0:60–0:75 | Dashboard: 56 green tests passing. Scroll past analytics panel showing pass rate trending up. | "Ship fast. Break less. No QA bottleneck." |
| 9 | 0:75–0:85 | Pricing card: "Free forever. 5 projects. 100 runs/month." Cursor hovers "Sign up" button. | "Free forever for five projects. Upgrade when you need more." |
| 10 | 0:85–0:90 | Qestro wordmark fades in. URL: `qestro.app`. | "Qestro. The copilot for testing AI." |

**Audio**: minimal, low BPM synth bed. No stock "epic build" music.

---

## 7. Launch day timeline (hour-by-hour, 00:01 PST anchor)

All times in PST. Assumes a Tuesday or Wednesday launch.

| Time | Action | Channel |
|---|---|---|
| **Mon 23:00** | Pre-flight: confirm PH draft, gallery assets, first comment ready in clipboard, notify-me email queued | Internal |
| **00:01** | PH post goes live. Paste first comment within 60 seconds. | Product Hunt |
| **00:05** | Pre-launch email fires to notify-me waitlist with launch-day PH link | Email |
| **00:10** | LinkedIn personal post goes live | LinkedIn |
| **00:15** | Twitter/X thread starts posting (tweet 1/12, thread scheduled at 1-min intervals) | Twitter/X |
| **00:30** | LinkedIn Qestro company page post | LinkedIn |
| **01:00** | Post Show HN submission | Hacker News |
| **02:00** | Reddit r/programming post | Reddit |
| **03:00** | Reddit r/webdev post (different angle, not copy-paste) | Reddit |
| **05:00** | Check PH comment volume. Respond to every comment within 10 min of it posting. | Product Hunt |
| **07:00** | Reddit r/ExperiencedDevs post (senior-engineer framing) | Reddit |
| **09:00** | Discord announcements: Playwright Discord, Cursor Discord, Claude Code community | Discord |
| **10:00** | Slack: post in 3 relevant communities (MLOps Community, Bootstrapped Founders) | Slack |
| **11:00** | Check HN ranking. If on front page, post update tweet. If not, do nothing — don't beg. | Internal |
| **12:00** | Reddit r/QualityAssurance post (QA-engineer framing, self-healing angle) | Reddit |
| **14:00** | Quote-tweet 3 early upvoters who commented something interesting | Twitter/X |
| **16:00** | LinkedIn follow-up post: "4 hours in — 200 upvotes, here's what people are asking" | LinkedIn |
| **18:00** | Answer every unanswered PH comment | Product Hunt |
| **20:00** | Cross-post to Indie Hackers and Dev.to | Multiple |
| **22:00** | Wrap-up tweet: top X / comment count / genuine thanks | Twitter/X |
| **23:59** | Final comment check. Close laptop. | Internal |

**Rule**: never let a PH comment sit more than 10 minutes without a reply on launch day. Comment volume is the #1 ranking signal.

---

## 8. Pre-launch email (to notify-me waitlist)

**Subject line variants** (A/B test):
- A: "We're launching on Product Hunt tomorrow"
- B: "Tomorrow is Qestro's Product Hunt day — here's what we need from you"
- C: "Qestro is live on Product Hunt in 6 hours"

**Preview text**: "One click to upvote. Or zero clicks to ignore this email — your call."

**Body** (under 250 words):

> Hey —
>
> Tomorrow at 12:01 AM PST, Qestro goes live on Product Hunt.
>
> You signed up for this waitlist, so I want to tell you first and thank you for the patience.
>
> **Here's the Product Hunt link**: [LINK — add on launch day]
>
> If you have 10 seconds and think Qestro is useful, an upvote genuinely helps us land on the front page. If you have 30 seconds, a short comment (what you're using it for, what's working, what's missing) helps more than an upvote.
>
> If you think Qestro isn't useful, please tell me why — reply to this email. I read every reply.
>
> **What's shipping for launch**:
> - Browser testing (Playwright, all three engines)
> - Mobile testing (iOS + Android via Maestro)
> - API testing (REST + GraphQL)
> - Self-healing selectors on every paid tier
> - 56 / 56 E2E tests green as of yesterday
> - Free tier live: 5 projects, 100 runs/month
>
> **What's not yet shipping** (so you're not surprised): SCIM provisioning is 2 weeks out, desktop agent is Q3, plugin marketplace is later.
>
> That's it. Short email on purpose.
>
> Thanks for being early,
> Shachar
>
> P.S. If you have a team that could use Qestro, the Starter tier at $99/mo is live tomorrow — and anyone who signs up on launch day gets a 50% lifetime discount with code **PHLAUNCH50**.

---

## 9. Hunter outreach (3 short DMs)

Send these 5–7 days before launch. Short, specific, no ask without value.

### DM #1 — Chris Messina

> Hi Chris — Shachar, built Qestro (the testing copilot for teams shipping with AI coding tools).
>
> We're launching on PH on [DATE] and I'd love your read on the positioning before it goes live. The wedge is "Playwright tests that write themselves and heal themselves, for devs using Cursor/Copilot/Claude Code." Free tier, self-serve to $499/mo.
>
> Happy to send you a test account and the draft gallery if you have 10 minutes. No pressure to hunt — I know you're selective and I respect that.
>
> Either way, thanks for the work you do on PH. Big fan of the format.

### DM #2 — Kevin William David

> Hey Kevin — Shachar from Qestro.
>
> I noticed you hunt a lot of dev-tools launches (Autify, Testim etc) so wanted to give you a heads-up we're launching [DATE]. Qestro is the self-serve testing copilot for AI coding — think "the testing layer for Cursor users." Playwright code output, browser + mobile + API in one tool, self-healing selectors on every paid tier.
>
> If you want to see it before launch: [DEMO URL / screencast link].
>
> No ask beyond the heads-up — happy to catch up on the QA-tools space either way.

### DM #3 — Ryan Hoover

> Ryan — long shot message, but here goes.
>
> Shachar, building Qestro — testing copilot for AI-assisted dev. Launching PH [DATE].
>
> Not writing to ask you to hunt. Writing because you wrote years ago that PH works best when makers have a clear, stated wedge — and ours is unusually clear: "the first testing tool purpose-built for Cursor/Copilot/Claude Code users, at self-serve pricing." I'd value 2 minutes of feedback on whether that wedge reads as differentiated to you, since you've seen every QA-tools launch of the last decade.
>
> Here's a 60-second screencast if you want: [LINK].
>
> Thanks for what you built. Wouldn't be launching here without it.
