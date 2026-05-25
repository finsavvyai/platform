# Page Override: `/dashboard`

> Inherits from `design-system/tokenforge-web/MASTER.md`. Only deviations are listed.

**Route:** `apps/tokenforge-web/src/app/dashboard/`
**Role:** TokenForge console landing — first thing customers see after login. Sets tone of "Stripe for device-bound auth".

---

## Layout

```
┌──────────────────────────────────────────────────┐
│  ENV [TEST | LIVE]            [project switch]  │
├──────────────────────────────────────────────────┤
│  [INSTALL SNIPPET — full-width Space Mono block] │
├──────────────────────────────────────────────────┤
│  ┌─Sessions live─┐ ┌─Refresh rate─┐ ┌─Risk avg─┐│
│  │  Bebas Neue   │ │              │ │          ││
│  └───────────────┘ └──────────────┘ └──────────┘│
├──────────────────────────────────────────────────┤
│  Recent sessions (last 10) → link to /sessions   │
├──────────────────────────────────────────────────┤
│  Recent webhook deliveries → link to /events     │
└──────────────────────────────────────────────────┘
```

## Required tiles

| Tile | Source | Format |
|------|--------|--------|
| Sessions live | `/v1/sessions?status=active&count=true` | Bebas Neue 48px + Space Mono delta `+N today` |
| Refresh rate (per min) | rolling 1-min from `/v1/metrics/refreshes` | Big number + sparkline |
| Risk avg | mean trust-score `/v1/metrics/risk` | Number + colored band indicator |
| AitM hits 24h | `/v1/aitm/heuristics?count=true` | Number in `--alert` if >0 |

## Quick install panel

If the project has zero sessions ever, replace tiles with the quick-install panel:

- Tab row: `JS` · `TS` · `Go` · `Python` · `Swift` · `Kotlin` · `RN`
- Code block: actual snippet for selected language with the project's real `pk_test_*` key prefilled
- Below: `Once installed, your first session will appear here within seconds.`

## Recent activity sections

Two side-by-side panels (stack on mobile):

- **Sessions** — last 10 rows (subset of full table from `pages/sessions.md`), with `View all →` link
- **Webhook deliveries** — endpoint + status code + latency + retry count, monospace

## Onboarding nudges

If onboarding incomplete (no webhook configured / no production env / no live key):

- Display single Space Mono header strip at top: `[ SETUP // 3 OF 5 STEPS REMAIN ]`
- Click expands inline panel with the missing steps as a checklist (no modal)
- Never use celebratory animations or progress confetti

## Anti-patterns

- Welcome video
- "Get started in 60 seconds" countdown timer
- Multiple CTAs competing for attention — single primary action visible at a time
- Marketing-y dashboard cards ("Did you know?")
