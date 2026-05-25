# Page Override: `/dashboard/agents`

> Inherits from `design-system/opensyber-web/MASTER.md`. Only deviations are listed.

**Route:** `apps/web/src/app/dashboard/agents/`
**Role:** Agent fleet management — list, status, drill-in, deploy.

---

## Layout: Status Table + Detail Drawer

Primary view = full-width table. Clicking a row opens a right-side drawer (45% width on ≥1280px, full-screen sheet on mobile).

### Table columns

| Column | Format | Notes |
|--------|--------|-------|
| Status | Dot + label | `OK` (`--ok`), `DEGRADED` (`--warn`), `DOWN` (`--alert`), `BUILDING` (`--info`) — Space Mono uppercase |
| Name | DM Sans medium | clickable, opens drawer |
| Hostname / IP | Space Mono | tabular-nums |
| Region | Space Mono uppercase | e.g., `EU-CENTRAL` |
| Skills | Number badge | hover shows skill list popover |
| Last heartbeat | Relative time | `3s ago` if green, `12m ago` in `--warn` if amber-window, real timestamp if down |
| CPU / Mem | Inline sparkline | last 5min, signal teal |
| Actions | Icon row | restart / shell / logs / delete |

Row hover: `--surface` background, no scale or movement.

### Bulk actions

Multi-select via checkbox. When ≥1 selected, sticky action bar slides up from bottom (no shift in table content):

- `RESTART (N)` · `UPGRADE (N)` · `DELETE (N)`

### Filters

Top row of pills (Space Mono uppercase): `ALL` · `OK` · `DEGRADED` · `DOWN` · `BUILDING`. Counts in parens. Clicking sets URL query.

## Detail drawer

- Header: agent name (Bebas Neue 32px) + status pill + close X
- Tabs: Overview · Logs · Skills · Metrics · Shell · Audit
- Logs tab: Space Mono terminal, virtualized, follow-tail toggle, level filter
- Shell tab: xterm.js mounted to `/v1/agents/{id}/shell` — websocket, with `[FAIL]` Space Mono prefix on disconnect
- Audit tab: every config change with diff, real timestamps, who-did-it

## Empty states

- No agents: hero card centered with single CTA `DEPLOY YOUR FIRST AGENT →`
- All filters return zero: `[NO MATCH]` Space Mono + clear-filters button

## Real-time

- WebSocket subscription per visible row updates status + heartbeat without re-rendering table chrome
- Disconnect: `[OFFLINE]` Space Mono banner above table, retry exponential

## Anti-patterns

- Faking heartbeat data while WebSocket disconnected
- Dropping rows from table when status changes (always show, change badge instead)
- Animations on numeric updates (no count-up — just snap to new value, no distraction)
- "Are you sure?" modal for non-destructive actions
