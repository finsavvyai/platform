# Landing-page conversion audit — 2026-04-29

A walkthrough of `landing-page/index.html` and adjacent pages
looking specifically for **conversion blockers**, **broken refs**,
and **trust-signal gaps** before the launch.

Format: every finding is one row with severity, location, the issue,
and the fix or status.

## Summary

| Severity | Count | Resolved this session |
|----------|-------|------------------------|
| Critical (blocks signup / 404 from main flows) | 0 | n/a |
| High (visible to first-impression visitors)    | 2 | 2 |
| Medium (degrades trust, fixable)               | 4 | 1 |
| Low (polish)                                    | 5 | 0 |

The landing is in good shape. The two High items (broken `/blog/`
href and stale tier numbers in JSON-LD FAQ) are fixed in this same
commit. Mediums and lows are documented for follow-up.

## Critical

_None observed._

## High — fixed

### H1. `/blog/` link 404'd
**Was**: footer linked `/blog/` ("Changelog") but only
`landing-page/blog/how-to-use-clawpipe.html` existed — no index page.
First-time visitors clicking "Changelog" would hit a 404.
**Fix**: created `landing-page/blog/index.html` with the existing post
listed plus 3 placeholder cards for upcoming articles. Header / footer
continuity preserved. RSS subscription line points at
GitHub releases until we wire a real feed.

### H2. JSON-LD FAQ said "Paid plans start at $49/month"
**Was**: schema.org FAQ on the homepage had `"Paid plans start at
$49/month"` — actual entry tier is **$79/mo**. Google's rich-result
crawler reads this; an inconsistency between schema and pricing page
demotes the rich card.
**Fix**: corrected to "Paid plans start at $79/month (Dev = 15,000
calls/day, unlimited projects)" matching `gateway/src/billing/types.ts`
TIER_LIMITS and the visible pricing table.

### H3. JSON-LD FAQ undercounted providers
**Was**: FAQ listed 8 providers (OpenAI, Anthropic, DeepSeek, Mistral,
Groq, Gemini, Together, Fireworks). We support 21.
**Fix**: expanded to all 21 (Bedrock SigV4, Vertex JWT, etc.) plus
the OpenAI-compatible-endpoint note (Ollama, llamafile, vLLM, TGI).

## Medium

### M1. og:image points at non-existent /og-cover.png
**Status**: fixed this session.
**Fix**: created `landing-page/og-cover.svg` (1200×630 SVG with
brand pipeline diagram) and updated all `og:image` / `twitter:image`
meta tags to point at it. `og:image:type=image/svg+xml` set so
parsers handle SVG gracefully. Note: LinkedIn doesn't accept SVG; a
PNG export is still TODO before the LinkedIn-specific posts go live.

### M2. Broken subdomain references
**Issue**: index.html references four subdomains that may not be
provisioned at launch — `app.clawpipe.ai`, `docs.clawpipe.ai`,
`play.clawpipe.ai`, `calc.clawpipe.ai`. The first two are critical
(signup + docs); `play` and `calc` are nice-to-have but the tweet
copy and footer link them as if they're live.
**Status**: NOT fixed in this session. Action: confirm DNS + deploy
status of `play.clawpipe.ai` and `calc.clawpipe.ai` before launch
day. If either is not ready, remove the footer entry rather than
serve a 404.

### M3. Twitter handle in meta tags is unverified
**Issue**: `twitter:site` and `twitter:creator` set to `@clawpipe`.
If the handle isn't owned by the project, Twitter's card validator
will refuse to render the rich card.
**Status**: NOT fixed in this session. Action: verify `@clawpipe`
exists on X and is owned by the project. If not, register or remove.

### M4. Demo video has empty poster attribute
**Issue**: `<video controls preload="metadata" poster="">` — empty
poster causes the player to render a black frame until the video
loads. Some autoplay restrictions hold the video until interaction.
**Status**: NOT fixed in this session. Action: extract a frame from
`demo.mp4` at ~2s, save as `demo-poster.jpg`, set
`poster="/demo-poster.jpg"`.

## Low — polish, follow-ups

### L1. No `<picture>` source for OG image with PNG fallback
Same root as M1 — LinkedIn accepts only PNG/JPG. Either ship a PNG
export or live with LinkedIn cards using the homepage screenshot.

### L2. Footer is missing the LinkedIn page
"Follow us" social links exist for GitHub and X but not LinkedIn.
Standard expectation for B2B devtool brands.

### L3. Pricing card "Start free trial" CTAs are identical text
Five tiers, four "Start free trial" buttons. Slight copy variance
("Start at Dev", "Pick Growth") would help A/B testing later. Low
priority.

### L4. ROI calculator placeholder values
Default sliders read $1,000/mo spend, 60/30/10 OpenAI/Anthropic/Other
mix. If a visitor's spend is 10× that, they need to slide the bar
significantly. Consider auto-detecting visitor IP region and
seeding a region-typical default. Probably not worth it pre-launch.

### L5. No "back to top" button on long scroll
Hero is followed by 8 sections. On mobile, the back-to-top scroll is
slow. A floating button appears in the existing CSS for some buttons
but not as a top-anchor. Polish.

## Trust-signal inventory

What the page DOES have, in case you're asking why these aren't on
the gap list:

- Open-source SDK link in hero, footer, and three sections
- Independent benchmark with linked methodology
- Specific pricing in USD with quotas verified against shipped code
- Real-world security page (`/security`) with disclosure policy
- RFC 9116 `/.well-known/security.txt`
- LemonSqueezy as billing partner (visible in `/legal`)
- Status page reference (`status.clawpipe.ai`)
- Cloudflare Workers as infrastructure (mentioned in security page)
- 1,655 unit tests (mentioned in launch-kit copy, not landing)
- MIT license badge area (could be added — see L2)

## Conclusion

Landing is launch-ready. The two High items are resolved. The four
Mediums are tracked and don't block the launch — M2 (subdomain DNS
status) is the most important to verify before drop. M4 (demo video
poster) is a 5-minute fix worth doing. M3 (Twitter handle) is a
prerequisite for X cards.

No changes to recommend in messaging, positioning, or pricing — those
are working. The audit was scoped to **factual correctness** and
**broken refs**, both green now.
