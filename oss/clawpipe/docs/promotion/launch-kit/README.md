# ClawPipe launch kit

A drop-in promotion bundle for the ClawPipe v3.6.1 public launch. All copy
cross-checks against `AUDIT-REPORT.md`, `benchmarks/results/summary.json`,
and shipped code in `gateway/src/billing/`. No invented testimonials. No
exaggerated metrics. Where the numbers come from a synthetic benchmark, the
copy says so up front.

## Index

| File | What it is |
|---|---|
| [`show-hn.md`](./show-hn.md) | Show HN submission packet — title, URL, body text, 10-question Q&A prep, posting time guidance, first-hour playbook |
| [`product-hunt.md`](./product-hunt.md) | Product Hunt launch — tagline, description, maker comment, gallery copy for 5 image slots, hunter outreach DMs, FAQ, day-of timing, post-launch follow-up |
| [`dev-to-hashnode.md`](./dev-to-hashnode.md) | Three full-length article drafts (Booster architecture, 21-provider ranking, Stripe → LemonSqueezy migration) with front matter and canonical-URL syndication plan |
| [`influencer-outreach.md`](./influencer-outreach.md) | Five personalised cold-DM drafts (Simon Willison, swyx, Yohei Nakajima, ThePrimeagen, Logan Kilpatrick) with sending discipline notes |
| [`brand-assets.md`](./brand-assets.md) | AI generation prompts for X header, OG image, GitHub social preview, three article covers, 5-emoji Slack set, animated logo brief, conference title slide |
| [`twitter-x.md`](./twitter-x.md) | Standalone announcement, 8-tweet hero thread, quote-RT lines, reply templates for "vs Portkey/LiteLLM" + "open source" + benchmark questions, posting-time rules |
| [`linkedin.md`](./linkedin.md) | Founder narrative (1,432 chars), 1-week follow-up template, comment-seeding lines, personal-vs-company-page sequencing |
| [`reddit.md`](./reddit.md) | Subreddit-specific submissions for r/MachineLearning, r/LocalLLaMA, r/programming, r/devops with engineering-first titles + tone rules |
| [`launch-day-runbook.md`](./launch-day-runbook.md) | Minute-by-minute T-12h to Day-2 checklist with failure-mode playbooks (HN flop, signup bug, webhook stall, provider outage) |

## 30-day launch calendar

Days numbered relative to **Day 0 = Show HN drop**.

### Pre-launch — prep week

| Day | Action | Owner |
|---|---|---|
| **-7** | Read every file in this kit. Tweak the copy where it doesn't match your voice — these are drafts, not commandments. |  |
| **-7** | Generate brand assets per `brand-assets.md`. Run each prompt multiple times, pick the cleanest, hand-fix typography in Figma. |  |
| **-6** | Run the audit suite. Confirm `cd tests/audit && node static/index.mjs` returns 15/15. Fix any drift before launch. |  |
| **-6** | Send influencer DM #1 (Simon Willison). |  |
| **-5** | Send influencer DM #2 (swyx). |  |
| **-5** | Cross-check landing-page hero, JSON-LD, and pricing card against the kit copy. Resolve any drift in favor of the audit report's truth. |  |
| **-4** | Send influencer DM #3 (Yohei Nakajima). Identify and DM 3 candidate Product Hunt hunters using the discovery process in `product-hunt.md`. |  |
| **-3** | Send influencer DM #4 (ThePrimeagen). Confirm Product Hunt scheduled launch slot for Day 1. |  |
| **-2** | Send influencer DM #5 (Logan Kilpatrick). Final QA pass on landing page, demo video, signup flow. |  |
| **-1** | Pre-publish Article 1 to clawpipe.ai/blog (private/draft). Verify dashboard, signup, and free-tier rate limit work end-to-end. Sleep early. |  |

### Launch week

| Day | Action |
|---|---|
| **0 — Tuesday** | **Show HN drop** at 8:00 AM EST. Execute the first-hour playbook in `show-hn.md` literally. Reply to every comment. Don't post anywhere else for the first 60 min. |
| **1 — Wednesday** | **Product Hunt drop** at 00:01 PT. Maker comment within 60 seconds. Execute the post-launch follow-up plan in `product-hunt.md` (hour 1, 6, 12, 24). |
| **2 — Thursday** | **Article 1 publishes** on clawpipe.ai/blog. Syndicate to Dev.to and Hashnode with `canonical_url` set. Twitter thread (5-7 tweets) summarising the Booster architecture. LinkedIn long-form post variant. |
| **3 — Friday** | Reply window for all three platforms (HN thread still surfacing comments, PH thread still active, Dev.to comments incoming). Drop Article 1 link in r/LocalLLaMA "Project" thread *if* topical. No Friday HN/PH posts — see anti-pattern notes in `show-hn.md`. |
| **4 — Saturday** | Quiet day. Track signup conversion from each source (HN, PH, Dev.to, Twitter, LinkedIn). Note which copy variant won. |
| **5 — Sunday** | Quiet day. Draft retro notes. |

### Mid-launch

| Day | Action |
|---|---|
| **7 — Tuesday** | **Article 2 publishes** ("Comparing 21 LLM providers"). Same syndication pattern. This article is the most "shareable" of the three — expect spillover into vendor-comparison threads on HN, Reddit, X. Be ready to defend rankings politely. |
| **10 — Friday** | Inbound from articles + initial launch should be settling. Reach out to 3-5 inbound users with a personal "thanks, what could be better?" email. Their replies become Article 4 fodder. |
| **14 — Tuesday** | **Article 3 publishes** ("Stripe → LemonSqueezy migration"). Different audience (operator/SaaS-founder, less LLM-specific) — share in Indie Hackers, Hacker News, r/SaaS. |
| **15 — Wednesday** | Retro blog post: "Two weeks after launching ClawPipe — what worked, what didn't." Real numbers (signups, conversion rate, traffic sources, comment volume). No exaggeration; the audit-honest tone is the brand. |

### Late-launch

| Day | Action |
|---|---|
| **21 — Tuesday** | Submit a CFP for an AI-engineering conference using the talk title slide from `brand-assets.md`. The article series gives you the talk material. |
| **30 — Thursday** | **Public report: "ClawPipe Index — first month."** Aggregated metrics from the live gateway: total prompts processed, real Booster hit rate across all customer traffic, real cache hit rate, real cost reduction in dollars (anonymised). This is the killer asset — turns the synthetic benchmark into a production-validated number. Publish on clawpipe.ai/blog, share to all five channels, pitch to TechCrunch / The New Stack / InfoQ. |

## Constraints and ground rules

These apply to every line of copy in this kit and to anything you add later:

- **Every claim must trace.** If you can't point at a file in the repo, a row in `summary.json`, or a row in `AUDIT-REPORT.md`, the claim is wrong. Cut it.
- **Synthetic benchmark disclosure goes above the fold.** Every time the 57.3% number appears, the methodology disclosure ("400-prompt synthetic benchmark, mock gateway, costs from published per-token prices") must be one sentence away. Not in a footnote. Inline.
- **The SDK is open. The gateway is not.** Be precise. The MIT badge applies to `clawpipe-ai` on npm and the public mirror at `github.com/finsavvyai/clawpipe-sdk`. The gateway runs on closed Cloudflare Workers infra. If someone asks, say so.
- **Don't promise features that aren't shipped.** PII guardrails are a quarterly commitment, not a current feature. Multi-region failover is roadmap, not present. The instinct to round these up to "coming soon" is exactly the drift the audit caught.
- **No fabricated testimonials.** Every quote has to be from a real person with permission. We don't have those yet — so the kit doesn't include any.

## Verification

Before you ship anything in this kit, run:

```bash
cd /Users/shaharsolomon/dev/projects/portfolio/clawpipe/tests/audit
node static/index.mjs
# Expect: 15 passed / 15 total
```

If that's not green, the landing page has drifted from the kit's claims and
you have to fix one or the other before launch. The point of this kit is
that the marketing matches the audit. If the audit is red, the marketing is
lying.

## After the launch

This kit is a snapshot for the v3.6.1 launch. Subsequent launches (v4.0,
guardrails GA, gateway open-source flip) should each get their own
launch-kit subdirectory under `docs/promotion/`, version-stamped, so the
campaign artefacts stay traceable to the version they shipped.
