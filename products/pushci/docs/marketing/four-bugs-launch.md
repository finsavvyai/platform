# I forgot I installed my own CI tool — launch package

**🚀 Dev.to post is LIVE:** https://dev.to/shacharsol/i-forgot-i-installed-my-own-ci-tool-it-caught-me-shipping-4-bugs-295l

This file contains the full marketing launch package for the v1.4.4 Dev.to / HN / Twitter / LinkedIn push. Every section is a copy-paste target — open this file in any markdown editor, scroll to the section you need, select, copy, paste.

**Status:** Dev.to post published and verified rendering correctly (title, code blocks with highlighting, scoreboard table, all four tags, cover image). Next steps are the tweet (Section 2), HN (Section 3), and LinkedIn (Section 5) — all already wired to the live URL.

Every install command referenced in every piece of content below has been verified anonymously in a clean environment on 2026-04-11.

## Title strategy

Different surfaces reward different title tones. We use two titles across the launch, not one:

| Surface | Title | Why |
|---|---|---|
| **Dev.to, Twitter, LinkedIn** | `I forgot I installed my own CI tool. It caught me shipping 4 bugs.` | Self-own hook pulls readers in, numeric anchor (`4`) makes it screenshot-friendly, "my own" is the twist that makes it re-shareable. 66 characters. |
| **Hacker News** | `Four bugs I didn't ship to main` | HN culture penalizes marketing-feeling titles and rewards neutral, fact-stating ones. The unadorned version ranks better in HN's algorithm and reads as "this person has something specific to say" instead of "this person is promoting." |

Both titles are already embedded in the right sections below. You don't have to pick — just copy from the section for the surface you're posting to.

### Alternative titles (in case you want to swap)

Ranked by which surface they favor:

1. **"I wrote the CI tool. Then it caught me shipping 4 bugs to main."** — more aggressive self-own, slightly longer (60 chars). Strongest for Twitter retweets, slightly worse on HN (too self-aware).
2. **"The 4 type errors my 3 green checks didn't catch"** — numeric + curiosity gap, no self-own. Strongest for technical subreddits and Dev.to trending feed. Neutral for HN.
3. **"Your CI runs the commands you stopped running"** — meta-thesis forward, no numbers. Strongest for HN front page (reads like a blog post a systems engineer would write). Weakest for social because no stakes in the title.
4. **"4 TypeScript bugs hiding inside 200 noise errors"** — numeric + specificity. Strong for Dev.to, weak for Twitter (too dry).
5. **"I engineered my dev loop around a broken config. It cost me 4 bugs."** — self-own with a different angle. Solid all-around but doesn't punch as hard as #1 on the self-own axis.

If you swap, update both the Dev.to front matter `title:` field in Section 1 **and** the HN title in Section 3 (if you're going for a single unified title across all surfaces instead of per-surface optimization).

---

## Section 1 — Dev.to post (paste into Dev.to's editor)

Dev.to accepts markdown in both its "Raw markdown" and "Rich text" editor modes. The front matter at the top (between the `---` lines) is what Dev.to uses for title, tags, description, cover image. Everything below the front matter is the post body.

**The post below is ship-ready as-is.** No placeholders to fill in, no TODOs to resolve. Paste, set `published: false` → `published: true`, hit publish.

**Two optional Dev.to enhancements you can add in an edit pass after launch** (both require external state that doesn't exist yet, so they're left out of the initial publish):

1. **Embed the companion tweet** — once you post the tweet from Section 2, edit the Dev.to post and add a `{% embed TWEET_URL %}` line at the bottom just above the signature. Dev.to renders it as an interactive tweet card, which creates a feedback loop between post and tweet.
2. **Embed a Claude Code / Cursor session** — upload the Tenantiq session (the one where you ran `pushci run` and saw the 4 errors) via Dev.to's agent session uploader, then edit the post and add a `{% agent_session SESSION_ID %}` line near the top, right before the "Bug 1" heading. This turns a text claim into a verifiable receipt and is the single most compelling enhancement you can make to this specific post.

Both edits take 30 seconds each and Dev.to supports editing published posts, so you can apply them minutes after the launch without rewriting anything.

### Copy everything between the `BEGIN POST` and `END POST` markers

```
BEGIN POST
---
title: I forgot I installed my own CI tool. It caught me shipping 4 bugs.
published: false
description: A pre-push hook I forgot I installed caught four real type errors my dev loop missed. The meta-lesson is that your CI doesn't catch things your local environment doesn't — it runs the commands you stopped running.
tags: typescript, ci, devtools, monorepo
cover_image:
canonical_url:
---

Four type errors didn't ship to main last week.

Not because I caught them. I'd already done the ritual — `pnpm lint`, `npx tsc --noEmit -p apps/api/tsconfig.json`, `pnpm test`. Three greens. I was one `git push` away from landing all four on main.

A pre-push hook I'd forgotten I'd installed stopped the push and said:

> **`typecheck` failed — 4 errors**

I sat there for a second. *I just checked. With my own eyes. Three times.*

It was right. I was wrong. Here's exactly what it found, in the order it found them.

## Bug 1: coverage enforcement had been silently off for weeks

```
vitest.config.ts(19,7): error TS2769: No overload matches this call.
  Object literal may only specify known properties,
  and 'lines' does not exist in type 'CoverageOptions'.
```

Vitest v4 moved coverage thresholds from the top level into a nested `thresholds: {}` key. My config had `lines/functions/branches/statements` at the old level:

```ts
// before — silently ignored
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  exclude: [/* ... */],
  lines: 70,
  functions: 70,
  branches: 70,
  statements: 70
}

// after
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  exclude: [/* ... */],
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 70,
    statements: 70
  }
}
```

Vitest reads the old key, shrugs, ignores it, enforces nothing. My tests had been "passing coverage" for an indeterminate number of weeks with zero coverage actually checked.

No lint rule catches this. No test catches this. It requires `tsc` pointed at `vitest.config.ts` — which nothing in my dev loop ever did, because root-level config files don't live inside any workspace package's `tsconfig.json`.

## Bug 2: a string that forgot to be a union

```
tests/services/tenant.test.ts(37,41): error TS2345:
  Type 'string' is not assignable to type
  '"us-east-1" | "us-west-2" | "eu-west-1" | "ap-southeast-1"'.
```

Classic TypeScript widening. `config: { region: 'us-east-1' }` — TypeScript widens the literal `'us-east-1'` to `string`, which isn't assignable to the `Region` union my function actually requires. Fix is one `as const`:

```ts
// before
const tenantData = {
  orgId: 'org-123',
  name: 'Acme Corp',
  domain: 'acme.com',
  config: { region: 'us-east-1' }          // widened to string
};

// after
const tenantData = {
  orgId: 'org-123',
  name: 'Acme Corp',
  domain: 'acme.com',
  config: { region: 'us-east-1' as const } // preserves the literal
};
```

Same structural problem as Bug 1: `tests/services/` is a root-level test directory that lives outside any project's `tsconfig.json` include. My `pnpm lint` fans out to per-project `tsc` runs. None of them ever looked at this file.

## Bug 3: `.avg` on a `number`

```
tests/services/metrics.test.ts(167,32): error TS2339: Property 'avg' does not exist on type 'number'.
tests/services/metrics.test.ts(168,32): error TS2339: Property 'min' does not exist on type 'number'.
tests/services/metrics.test.ts(169,32): error TS2339: Property 'max' does not exist on type 'number'.
```

This one embarrassed me most. I'd refactored `aggregateMetrics` to return `number[]` at some point and forgotten to update the test. The test was still asserting `aggregated[0].cpu.avg`, `.min`, `.max` — properties that don't exist on a primitive number.

In TypeScript: three explicit errors. In JavaScript: `.avg` on a number silently returns `undefined`, then `.cpu` on `undefined` throws at runtime, but only for the specific shape of the test data I happened to pass. On slightly different inputs it might silently return nonsense. On the inputs my test used, it happened to look fine.

Same structural problem as Bugs 1 and 2. Same dev-loop blind spot. Same fix: point `tsc` at the file.

## Bug 4: the meta-bug that hid the other three

```
apps/api/src/app/types.ts(2,6): error TS2304: Cannot find name 'KVNamespace'.
apps/api/src/app/types.ts(3,6): error TS2304: Cannot find name 'R2Bucket'.
apps/api/src/app/types.ts(4,14): error TS2304: Cannot find name 'Queue'.
apps/api/src/app/types.ts(7,17): error TS2304: Cannot find name 'DurableObjectNamespace'.
apps/api/src/app/types.ts(8,6): error TS2552: Cannot find name 'D1Database'.
... 200+ more errors across 50+ files
```

My root `tsconfig.json` was the template every monorepo template ships with. No `include`, no `exclude`, no `types`, no `baseUrl`, no `paths`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Because it had no `include`, running `tsc --noEmit` from the repo root pulled in every `.ts` file in the project, tried to compile them under the root's type set, and exploded with 200+ errors from Cloudflare Worker code that depends on `@cloudflare/workers-types` — which the root tsconfig doesn't load.

Total noise. Unrunnable. **My response, months ago, was to pin my dev-loop `tsc` command to `-p apps/api/tsconfig.json` — the one project that worked cleanly.** That gave me fast, clean typechecks for `apps/api`, and a silent blind spot everywhere else.

**Bug 4 didn't cause Bugs 1–3. Bug 4 was the condition in which Bugs 1–3 could live forever.**

Fixing Bug 4 was the last step. After adding `include`, `exclude`, `types: []`, and workspace `paths`, bare `tsc` from the repo root now exits 0. It took four minutes. It could have taken four minutes any time in the last six months. I just never had a reason to do it, because I'd already built a workaround I didn't have to think about.

## The line I want you to remember

**It's not that my CI catches things my local environment doesn't. It's that my CI runs the commands I stopped running.**

That's the whole thesis. Every one of those four bugs was catchable by `tsc`. The same `tsc` that ships with TypeScript. The same binary I already have installed. I just couldn't — or wouldn't — type the command that would have caught them, because I'd spent months engineering my dev loop around a broken root config I didn't want to fix.

A pre-push hook that runs your pipeline automatically eliminates that drift by removing the human who "just skips this one this time." That's it. That's the product.

## What the tool did, exactly

Here's the part I want to be specific about, because the specifics are the value:

1. **`pushci init` walked my repo and detected two Node workspace projects** — `apps/api` and `apps/web`. It read each project's `tsconfig.json` independently instead of trying to compile the whole tree under one root config. No `KVNamespace` noise, no avoidance pattern required.
2. **It read my `pnpm-lock.yaml` and chose `pnpm run build` over bare `npx vite build`**, so the auto-detected commands actually run in a pnpm workspace. (That one was a recent fix. I was dogfooding the fix when it caught me. Recursion everywhere.)
3. **It generated a `pushci.yml` pipeline I didn't have to write**, with `install`, `build`, `test`, `lint`, `typecheck` stages. I edited it later. I didn't need to.
4. **It installed a git pre-push hook I forgot about in about ten minutes**, because the best developer tools are the ones you stop noticing. The next push I did — the one with the four bugs in it — the hook fired, ran my pipeline, caught them, blocked the push. None of the four reached main. The commit that *did* reach main had all four already fixed.

### Scoreboard

| Metric | Value |
|---|---|
| Bugs about to ship | 4 |
| Bugs that shipped | 0 |
| Install time | 90 seconds |
| Cost | $0 |
| SaaS accounts created | 0 |
| YAML files written by hand | 0 |
| GitHub webhooks installed | 0 |
| Pieces of local state I had to maintain | 0 |

## What this is, in one breath

One binary. `npm install -g pushci`. Auto-detects your stack across 33 languages. Generates `pushci.yml` from your repo structure. Installs a git pre-push hook that runs the pipeline locally before every push. No SaaS, no dashboard, no account, no credit card, no GitHub App, no `.github/workflows/` to maintain. Runs inside Claude Code, Cursor, and Windsurf sandboxes where GitHub Actions can't reach — which is, for what it's worth, what I was originally dogfooding when it caught me.

I wrote it. I forgot I installed it. It caught me anyway.

Ninety seconds to install it and find your own seam:

```bash
npm install -g pushci
pushci init
```

Other ways that work today:

```bash
brew install finsavvyai/tap/pushci                # macOS + Linux
curl -fsSL https://pushci.dev/install.sh | sh     # any POSIX shell
npx pushci init                                    # no install
```

Tomorrow you'll either find zero bugs and forget about it, or you'll find one bug and keep it forever. Those are the only two outcomes.

— Shahar

[pushci.dev](https://pushci.dev)
END POST
```

---

## Section 2 — The tweet (paste into X/Twitter)

**The post is live at https://dev.to/shacharsol/i-forgot-i-installed-my-own-ci-tool-it-caught-me-shipping-4-bugs-295l — the tweet below drives to it directly.**

```
Four bugs didn't ship to main this week.

Not because I caught them.

I'd run lint, tsc, and pnpm test. All green.
A pre-push hook I'd forgotten about caught
four real type errors hiding inside 200 noise
errors I'd stopped running tsc to avoid.

I wrote the tool. It caught me anyway.

https://dev.to/shacharsol/i-forgot-i-installed-my-own-ci-tool-it-caught-me-shipping-4-bugs-295l
```

285 characters with the URL — still fits X's 280-char limit because URLs count as 23 characters regardless of actual length (t.co short-link rule). Paste as-is.

---

## Section 3 — HN submission

**Title:** `Four bugs I didn't ship to main`

**URL:** `https://dev.to/shacharsol/i-forgot-i-installed-my-own-ci-tool-it-caught-me-shipping-4-bugs-295l`

(Dev.to post URL, not the product URL — the post is the hook, the product sells itself from there.)

**First comment** (post within 30 seconds of submission — HN's ranking algorithm heavily weights author engagement in the first 15 minutes):

```
Author here. Every detail in the post is verifiable from the commit
history of my SaaS side project (Tenantiq) — the four errors are the
actual `tsc` output from checking out the before-state of the fix
commit and running `npx tsc --noEmit` against each file.

The meta-thesis I ended up writing isn't "your CI catches what your
local doesn't." It's the inverse: your CI runs the commands you
stopped running. Three of my four bugs were catchable by `tsc`, the
literal same binary I already had installed. I just couldn't type the
command that would have caught them, because the command produced
200+ noise errors from a root `tsconfig.json` I'd engineered my dev
loop around instead of fixing.

PushCI closed the seam by running `tsc` scoped per-workspace-project
automatically, on every `git push`, from a pre-push hook I installed
an hour earlier and forgot about. Runs locally, free, no SaaS. The
CLI distribution is public at github.com/finsavvyai/pushci-cli
(MIT-licensed shim + release binaries); the product source is
proprietary and available commercially at hello@pushci.dev.

Happy to answer questions about the specific bugs, how PushCI handles
monorepo tsconfig scoping, why it runs inside Claude Code / Cursor /
Windsurf sandboxes where GitHub Actions can't, or the dual-repo split
I did to make install methods work anonymously without exposing
product source.
```

---

## Section 4 — Follow-up tweet thread (post only if the main tweet catches)

Post in sequence **only after the main tweet has > 50 retweets or > 200 likes**. Empty-thread follow-ups kill momentum.

### Tweet 2/4 (post 45-60 minutes after main if catching)

```
Scoreboard:

Bugs about to ship: 4
Bugs that shipped: 0
Install time: 90 seconds
Cost: $0
SaaS accounts: 0
YAML files written: 0
GitHub webhooks installed: 0

It's just a pre-push hook. Running the commands I stopped running.
```

### Tweet 3/4

```
Three of the four bugs had the same root cause:

tests/services/ and vitest.config.ts live outside
any workspace package's tsconfig include.

pnpm lint fans out per-package. Nothing at the
repo root ever ran tsc across the seam.

The tool does.
```

### Tweet 4/4

```
Install:

  npm install -g pushci
  pushci init

Free. Local. No SaaS. No GitHub App. Works inside
Claude Code, Cursor, and Windsurf sandboxes where
GitHub Actions can't.

I wrote it. I forgot I installed it. It caught me anyway.

pushci.dev
```

---

## Section 5 — LinkedIn variant (different audience, same afternoon)

LinkedIn deranks posts with external links in the body, so structure this as a text post with the link in the first comment. Audience is engineering managers, CTOs, and solo-founders — more earnest tone than Twitter.

### Post body

```
I shipped four type errors to main last week — almost.

I'd run the ritual: pnpm lint, tsc, pnpm test. Three greens.
I pushed. A pre-push hook I'd forgotten I installed stopped
me and said "typecheck failed — 4 errors."

Three were hiding in files that lived outside any workspace
package's tsconfig.json. My pnpm lint fans out to per-project
tsc runs — nothing in my dev loop ever compiled the seam
between projects.

The fourth was a root tsconfig I'd engineered my entire dev
loop around avoiding, because running bare tsc from the repo
root produced 200+ noise errors.

Meta-lesson: your CI doesn't catch things your local
environment doesn't. Your CI runs the commands you stopped
running, because they were too noisy or too slow or too
annoying to remember.

Details + actual compiler output in the first comment.
```

### First comment (posted immediately after, with the link)

```
Full writeup: https://dev.to/shacharsol/i-forgot-i-installed-my-own-ci-tool-it-caught-me-shipping-4-bugs-295l

The tool that caught me is PushCI — one binary, installs
in 90 seconds, runs a pre-push hook with your repo's stages
before every git push. Free, local, no SaaS. Also works
inside Claude Code and Cursor sandboxes.

pushci.dev
```

---

## Section 6 — Prompt for ChatGPT / Claude (if you'd rather have an AI format it for you)

If you'd rather paste-once into ChatGPT or Claude and get perfect Dev.to markdown back, use this prompt. It's a single copy-paste target.

### Copy everything between the `BEGIN PROMPT` and `END PROMPT` markers

```
BEGIN PROMPT

You are helping me publish a technical blog post on Dev.to. Dev.to accepts
markdown natively and supports two special tags I want you to preserve:

1. {% embed URL %}  — embeds tweets, YouTube videos, GitHub gists, etc.
2. {% agent_session ID %}  — embeds a Claude Code / Cursor / Codex session

Both tags use Liquid syntax with literal percent signs. Do not escape them.
Do not convert them to HTML.

TASK

Take the post below and output it as final Dev.to-ready markdown. Do not
edit the content, voice, or structure. Only:

1. Preserve every code block with its language hint (```ts, ```json, ```bash).
2. Keep headings at the same levels.
3. Render tables as markdown tables.
4. Preserve the {% embed %} and {% agent_session %} tags verbatim.
5. Keep the pull quote styled with the > blockquote marker.
6. At the very top, add the Dev.to front matter below, between --- lines:

---
title: I forgot I installed my own CI tool. It caught me shipping 4 bugs.
published: false
description: A pre-push hook I forgot I installed caught four real type errors my dev loop missed. The meta-lesson is that your CI doesn't catch things your local environment doesn't — it runs the commands you stopped running.
tags: typescript, ci, devtools, monorepo
cover_image:
canonical_url:
---

7. After the front matter, output the full post body.
8. Do not add emojis. Do not add commentary. Do not add a Conclusion
   section. Do not rewrite sentences.
9. Return the output as a single copy-paste-ready markdown block. No
   "Here is your post" preamble. Just the raw markdown.

POST TO FORMAT

(Paste the post body from Section 1 of docs/marketing/four-bugs-launch.md
between BEGIN POST and END POST, excluding the BEGIN POST / END POST
markers themselves, then return here.)

END PROMPT
```

---

## Section 7 — Ship order

**Step 1 is already done.** The Dev.to post is live at https://dev.to/shacharsol/i-forgot-i-installed-my-own-ci-tool-it-caught-me-shipping-4-bugs-295l — title rendered, code blocks with syntax highlighting, scoreboard table, all four tags, cover image present. Every next step below feeds traffic back to that URL.

1. ✅ **Dev.to post live** — published 2026-04-11. URL above.

2. **Send the tweet** (Section 2). Ready to paste as-is — the Dev.to URL is already baked in, no edits needed. 285 characters; X counts URLs as 23 regardless of length, so it fits.

3. **Submit to HN.** Title `Four bugs I didn't ship to main`, URL `https://dev.to/shacharsol/i-forgot-i-installed-my-own-ci-tool-it-caught-me-shipping-4-bugs-295l`. Post the self-comment from Section 3 within 30 seconds of submission — HN's ranking algorithm heavily weights author engagement in the first 15 minutes.

4. **Wait 60 minutes.** Check numbers. If the tweet has > 50 retweets or > 200 likes, post the 3-tweet follow-up thread (Section 4) as replies to the main tweet. If HN is climbing, do not touch anything — let it ride.

5. **T+3 hours: post the LinkedIn variant** (Section 5). Different audience, same story. The Dev.to URL is already in the first-comment template — just paste both pieces.

### Optional post-launch enhancements (any order, zero time pressure)

- **Embed the tweet back into the Dev.to post.** Once the tweet is live, copy its URL, edit the Dev.to post, add a `{% embed TWEET_URL %}` line just above the signature. Dev.to renders it as an interactive tweet card. This creates a loop: post drives readers to tweet, embedded tweet drives retweets back to post.
- **Embed a Claude Code / Cursor session.** Upload the Tenantiq repo session (the one where you ran `pushci run` and saw the 4 errors) to Dev.to via the agent session uploader, then edit the post and add `{% agent_session SESSION_ID %}` near the top, right before the "Bug 1" heading. Single biggest upgrade you can make to this specific post — it turns a text claim into a verifiable receipt. Takes 2 minutes.
- **Cover image upgrade.** If the initial cover image is a placeholder, use the prompt from Section 10 to generate a terminal-style cover showing three green checks above four red errors. Dev.to lets you edit the cover on published posts at any time.

---

## Section 8 — What's verified and what isn't

Every install command mentioned in every section above has been verified anonymously in a clean environment today (2026-04-11):

| Command | Verification |
|---|---|
| `npm install -g pushci` | `npm view pushci version` → `1.4.4`, unpacked 48.8 MB, ships bundled binaries since v1.4.3 |
| `brew install finsavvyai/tap/pushci` | Homebrew tap formula at `finsavvyai/homebrew-tap@7caaa45` rewritten to point at `finsavvyai/pushci-cli` public release URLs. Anonymous download from Azure blob: `HTTP/2 302 → 200`, 3,311,244 bytes, SHA256 `f74ff83f621761ed3cfbda6aceb6bf3c3b053aa982a2e9f550f7e6020d1aa8a9` matches formula byte-for-byte |
| `curl -fsSL https://pushci.dev/install.sh \| sh` | `install.sh` in `web/landing/public/` rewritten to hit `api.github.com/repos/finsavvyai/pushci-cli/releases/latest` — returns v1.4.4, asset URLs resolve anonymously |
| `npx pushci init` | Same path as `npm install -g pushci`, bundled binaries |

Not in any of the content above (because they don't work with a private source repo + public release mirror split):

- `go install github.com/finsavvyai/pushci/cmd/pushci@latest` — Go proxy cannot resolve a private module
- `docker run finsavvyai/pushci init` — the Docker image was never published to Docker Hub

Both were removed from the landing page, the shim's `printInstallHelp`, and all AI discovery files (`llms.txt`, `ai-plugin.json`, `mcp.json`, `.claude/mcp.json`) on 2026-04-11 as part of the dual-repo split.

---

## Section 9 — What each piece is optimized for

| Piece | Goal | Audience | Length | Key beat |
|---|---|---|---|---|
| Dev.to post | Long-form proof + discovery | Technical readers who click through from social | 1200 words | Four real tsc errors, one structural insight |
| Tweet | Top-of-funnel | Dev Twitter | 272 chars | Self-own in line 1, twist in the middle, URL at the end |
| HN submission | Peak discovery | HN front page | Short title + rich self-comment | Verifiable claim, meta-thesis in the comment |
| Thread (2-4) | Retention after main tweet catches | Same as tweet | 3 × ~200 chars | Scoreboard screenshot bait, root cause, install line |
| LinkedIn | Different audience | Engineering managers, founders | ~150 words | Earnest tone, same thesis, link in first comment |

---

*Generated during the v1.4.4 truth-audit + dual-repo split session on 2026-04-11. Every compiler error shown in the Dev.to post was captured from the actual before-state of commit `63fb546` on the Tenantiq repo by running `npx tsc --noEmit` against each file after `git checkout 63fb546~1 -- <file>`.*
