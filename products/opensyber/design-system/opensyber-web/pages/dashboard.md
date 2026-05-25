# Page Override: `/dashboard`

> Inherits from `design-system/opensyber-web/MASTER.md`. Only deviations are listed.

**Route:** `apps/web/src/app/dashboard/`
**Role:** Post-login shell + landing for product. Many sub-routes mount under here.
**Last verified:** 2026-05-06

---

## Layout deviations

- **Persistent left sidebar** — 240px, `--panel` background, contains primary nav (Agents, AI-SPM, Compliance, Marketplace, etc.) — sidebar lives here, not in MASTER chrome.
- **Top nav** stays compact (56px) but adds an environment / org switcher slot on the right.
- **Main grid**: 4-column on ≥1280px, 2-column 768–1279px, 1-column <768px. Each tile = `.card` from MASTER.

## Required tiles (top of page)

| Tile | Source | Format |
|------|--------|--------|
| Agents online / total | `/v1/agents/health` | Bebas Neue large numerator + Space Mono `/N` denominator |
| Findings — last 24h | `/v1/findings/recent?window=24h` | Big number + sparkline (signal teal) |
| Open critical alerts | `/v1/alerts?severity=critical&status=open` | Number in `--alert` red |
| Skills installed | `/v1/skills/installed/count` | Number + small "+N this week" Space Mono delta |

## Activity feed

- Right-side rail (or below tiles on narrow), real timestamps (ISO + relative)
- Each row: severity dot, agent name, event Space Mono summary, timestamp
- Auto-update via existing SSE/WebSocket; if disconnected show `[OFFLINE]` Space Mono indicator
- Max 50 rows, virtualized

## Empty states

- New account: replace tiles with single onboarding card — `INSTALL YOUR FIRST AGENT →` (Space Mono, `--signal`)
- No data yet: do **not** show fake numbers or "Coming soon" — show real empty state with the install command in a code block

## Performance budget

- LCP ≤ 1.8s on slow 4G after auth
- TTI ≤ 2.5s
- Live feed must not re-render entire page (use stable keys + `React.memo` on rows)

## Anti-patterns

- Welcome carousel
- "Tip of the day" cards
- Confetti on first-agent install
- Full-page loading spinner — use skeleton tiles instead
