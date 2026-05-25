# Qestro — Email Sequences

> All bodies under 250 words. Subject lines: 3 variants per email, A/B test the top two. Preview text pairs with best-performing subject. Voice: direct, technical, no-apology, no stacked superlatives.

---

## 1. Pre-launch teaser (2 emails, 7 days apart)

### Email 1 — T-14 days

**Subject line variants**:
- A: "I built the thing I wanted"
- B: "Three months, 40 features, one dead test suite"
- C: "Qestro: testing copilot for teams shipping with AI"

**Preview text**: "Why I built Qestro — and what's launching in two weeks."

**Body**:

> Hey —
>
> You signed up for the Qestro waitlist, so I owe you the story.
>
> For the past year I've been shipping everything with Cursor and Claude Code. Features that used to take a week now take an afternoon. But within three months, my Playwright test suite was dead. The AI had quietly refactored every component I'd written tests against, and I couldn't tell what was broken vs. what was just stale.
>
> The tooling options were bad:
>
> - Hand-updating every selector — slow.
> - Testim / Mabl — good, but built for QA directors, not devs. Enterprise-sales, proprietary output, you don't own the tests.
> - Vanilla Playwright — free and great, but the 40 lines of boilerplate per test is the exact friction AI coding was supposed to kill.
>
> So I built **Qestro**. Paste a URL, describe the test in English, get real Playwright code you commit to your repo. Browser + mobile + API in one tool. Self-healing when selectors drift.
>
> **Launching on Product Hunt on [DATE]**. You'll get the link at 12:05 AM PST the morning of. If you want early access before then, reply to this email and I'll turn on your account.
>
> — Shachar

---

### Email 2 — T-7 days

**Subject line variants**:
- A: "One week out. Here's the demo."
- B: "Qestro launches in 7 days — 60-second screencast inside"
- C: "You're on the Qestro waitlist. Here's what it actually does."

**Preview text**: "60-second screencast of Qestro in action. Launch in 7 days."

**Body**:

> One week until launch.
>
> Instead of more explanation, here's 60 seconds of the product working: [SCREENCAST LINK]
>
> What you'll see:
>
> 1. Paste a URL (0:05)
> 2. Describe a test in English: "Log in, create a project, assert the dashboard shows the project name." (0:12)
> 3. Watch Qestro generate real Playwright TypeScript in the editor (0:25)
> 4. Click Run. Browser opens, test passes, screenshots captured. (0:40)
> 5. Deliberately break the UI. Test fails. Qestro proposes the selector fix. One click, test passes again. (0:55)
>
> That last part — the self-heal — is the feature I'd have quit the project without. It's live on every paid tier.
>
> **Product Hunt goes live [DATE]**. I'll send the link at 00:05 PST that morning.
>
> If you want early access before then, reply "early" and I'll flip your account on.
>
> — Shachar

---

## 2. Launch-day email (fires 00:05 PST)

**Subject line variants**:
- A: "We're live on Product Hunt — one minute of your time"
- B: "Qestro is live. If you've got 10 seconds."
- C: "Launch day. Here's the link."

**Preview text**: "Qestro is live on Product Hunt as of midnight. Here's the link."

**Body**:

> Qestro is live on Product Hunt: [PH LINK]
>
> If you have 10 seconds, an upvote helps us land on the front page.
>
> If you have 30 seconds, a short comment (what you're using it for, what's working, what's missing) helps more — PH ranks by comment volume, not just upvotes.
>
> If you have 2 minutes, there's a 60-second demo on the page and a full first-comment writeup of why I built this.
>
> **Launch-day offer** for waitlist members only: sign up today and use code **PHLAUNCH50** to get 50% off Starter or Pro for life. Not "first year" — lifetime. This expires at 23:59 PST tonight.
>
> Thank you for being early. This product wouldn't ship without people like you.
>
> — Shachar
>
> P.S. If Qestro isn't useful to you, I'd genuinely value knowing why. Reply to this email — I read every response and it shapes the roadmap.

---

## 3. Post-launch follow-up (day 3, to signups who haven't tried the product)

**Subject line variants**:
- A: "You signed up for Qestro — haven't tried it yet?"
- B: "30 seconds to your first test"
- C: "Anything stopping you from shipping your first Qestro test?"

**Preview text**: "If something's blocking you, reply and I'll help personally."

**Body**:

> Hey —
>
> You signed up for Qestro three days ago but haven't created a test yet. Totally fine — I know the inbox is full.
>
> But I'd like to help unblock you if there's a specific reason, because the first test is the one that proves whether Qestro is useful for your stack.
>
> **Three things that unblock most people**:
>
> 1. **You don't know what to test.** Easiest starting point: your login flow. Paste your app URL, type "log in as test user, assert I land on the dashboard." Done in 60 seconds.
>
> 2. **Your app needs auth and you don't want to share creds.** Use a dedicated test user with limited permissions. Qestro encrypts credentials at rest and never logs them. Or point Qestro at a staging environment with synthetic data.
>
> 3. **Something in the UI is confusing.** Reply to this email with what you're stuck on and I'll send a 30-second loom explaining it. Zero sales — just help.
>
> The free tier is 5 projects and 100 runs/month. Most of our users never leave it. That's fine by us — free is the marketing.
>
> [LINK: log in to Qestro]
>
> — Shachar

---

## 4. Cold outreach to indie developers (3 variants)

Each variant targets a different persona. Do not cross-send.

### Variant A — Solo developer / indie hacker

**Subject line variants**:
- A: "how are you testing your Cursor-shipped code?"
- B: "quick q about your test setup"
- C: "[Product] + Qestro?"

**Preview text**: "Built a testing tool for indie devs shipping with AI. Free forever."

**Body**:

> Hi [NAME] —
>
> Saw [SPECIFIC PRODUCT/PROJECT, e.g., "your Show HN for X last week" or "you mentioned using Claude Code on Twitter"]. Nice work.
>
> Quick question: how are you handling tests? I ask because I've talked to ~50 solo devs shipping with Cursor / Claude Code / Copilot, and the pattern is the same — the AI writes features faster than you can write Playwright, and within 3 months the test suite is dead.
>
> I built Qestro specifically for this. Paste a URL, describe the test in English, get real Playwright code you can commit to your repo. Free forever for 5 projects. No credit card.
>
> Worth 2 minutes? qestro.app
>
> If it's not useful, hit delete and no hard feelings.
>
> — Shachar

---

### Variant B — Technical founder / CTO at seed-stage startup

**Subject line variants**:
- A: "QA at [Company] — 2-minute idea"
- B: "how is [Company]'s test suite holding up?"
- C: "the testing tool for teams shipping with Cursor"

**Preview text**: "Specifically built for teams below 20 engineers."

**Body**:

> Hi [NAME] —
>
> You're running [COMPANY]. If you're like most Series A teams I talk to, testing is one of: (a) not happening, (b) flaky Cypress suite nobody wants to maintain, (c) "we'll hire a QA person next quarter."
>
> Qestro is a fourth option. AI-generated Playwright / mobile / API tests, self-healing when selectors break, $99/mo Starter tier that expenses without procurement.
>
> Specific fit for [COMPANY]:
>
> - If your team uses Cursor / Copilot / Claude Code, generation speed matches your dev speed.
> - If you have browser + mobile or browser + API, Qestro covers both (vs. Cypress + Postman + Maestro).
> - If you have 3–20 engineers, the Starter tier covers you.
>
> Free tier to sanity-check: qestro.app
>
> Or I can send you a 20-minute demo tailored to [COMPANY]'s stack if that's more useful.
>
> — Shachar

---

### Variant C — Senior engineer who writes about dev tools

**Subject line variants**:
- A: "saw your [ARTICLE/TWEET] on testing — quick ask"
- B: "tool you might want to test-drive"
- C: "Qestro — would love your take"

**Preview text**: "Specifically wrote this because you've thought hard about the problem."

**Body**:

> Hi [NAME] —
>
> I read [SPECIFIC ARTICLE / TWEET / TALK] on [TOPIC — testing flakiness, AI coding, Playwright, etc]. You've thought harder about this than most people and it showed.
>
> I built Qestro because I hit the same wall you described: shipping with AI outpaced testing, and nothing in the existing market fit.
>
> I'd love your brutal read on the product. Not asking for a writeup, not asking for a tweet — just 10 minutes of "this is useful" or "this is BS and here's why."
>
> Free account with elevated limits ready whenever you want it. qestro.app/review — uses code **REVIEW** for Pro access, no expiration.
>
> Even a one-line reply with the critical feedback would be valuable. I'd rather hear "this doesn't solve the problem" now than in 12 months.
>
> — Shachar

---

## 5. Enterprise cold outreach — QA lead at Series B–D company

**Subject line variants**:
- A: "QA at [Company] — consolidating testing tools"
- B: "[Company] + one testing platform instead of three"
- C: "Cypress + Postman + Maestro → one tool"

**Preview text**: "Self-serve pricing up to Pro. Enterprise SSO/SCIM available."

**Body**:

> Hi [NAME] —
>
> You're running QA at [COMPANY]. If your team is like the Series B/C teams I've spoken to, you're probably running three testing tools: something for browser (Cypress, Playwright), something for API (Postman, Insomnia), something for mobile (Maestro, Appium). Three dashboards, three bills, three auth systems.
>
> Qestro is one tool that covers all three surfaces:
>
> - Browser: Playwright on Chromium / Firefox / WebKit
> - Mobile: Maestro on iOS + Android
> - API: REST + GraphQL with response assertions and auth chaining
>
> Plus the things that matter at your company stage:
>
> - SSO/SAML/OIDC (Azure AD, Okta, Auth0, Google Workspace, Keycloak)
> - SCIM provisioning *(shipping April 2026)*
> - On-prem / self-hosted deployment option
> - Real Playwright code output — your team owns the test suite, not Qestro
> - Visual regression + load testing + scheduled runs in the same dashboard
>
> Pricing: self-serve to $499/mo Pro. Enterprise available with dedicated support and SLA.
>
> Interested in a 20-minute technical demo with your team? [CALENDAR LINK]. Or start on the free tier: qestro.app.
>
> Happy to send a full feature comparison vs. your current stack if helpful.
>
> — Shachar
