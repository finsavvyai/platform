# Page Override: `/dashboard/sessions`

> Inherits from `design-system/tokenforge-web/MASTER.md`. Only deviations are listed.

**Route:** `apps/tokenforge-web/src/app/dashboard/sessions/`
**Role:** Live view of all device-bound sessions for the current project. Core operator surface.

---

## Layout

Live table — same structure as `opensyber-web/pages/agents.md` but session-shaped.

### Columns

| Column | Format |
|--------|--------|
| Status dot | Active (`--ok`) / Step-up required (`--warn`) / Revoked (`--alert`) / Idle (`--text-muted`) |
| Subject | DM Sans, with email + Space Mono `sub:` claim on hover |
| Device | Browser + OS, plus a 12px crosshair icon if device-bound |
| Key fingerprint | **Space Mono**, last 8 chars of SHA-256, monospace tabular |
| TLS exporter match | Single char ✓ in `--ok` if RFC 9266 matched, ✗ in `--alert` if not |
| Last refresh | Relative time, Space Mono |
| Risk score | 0–100 number colored by band: 0–30 ok, 31–70 warn, 71+ alert |
| Actions | `REVOKE` · `STEP-UP` · `INSPECT` |

### Real-time wiring

- WebSocket to `/v1/sessions/stream` (project-scoped)
- New session animates in with single-frame `--signal` flash on the status dot, then settles. **No row movement.**
- Revoked rows stay visible for 60s grayed out with strikethrough on subject, then collapse out

## Step-up prompt indicator

If a session has triggered step-up policy (per `tf_tenants.step_up_actions`), display a small Space Mono pill `STEP-UP: <action>` on the right of the row. Click expands an inline panel with the policy that matched.

## Inspect drawer (right-side)

Three tabs:

- **Trace** — full event timeline for the session (register → refresh → step-up → revoke), each entry with ISO timestamp and JWS claim diff
- **Device** — UA parsed, OS, browser, IP geo, ASN, key creation timestamp, key origin (Web Crypto / native)
- **Risk** — heuristic breakdown: AitM score components, location anomaly, key-binding strength

## Empty state

`[NO ACTIVE SESSIONS]` Space Mono header + the install snippet:

```
npm i @tokenforge/browser
```

```ts
import { TokenForge } from '@tokenforge/browser';
const tf = new TokenForge({ project: 'pk_test_…' });
await tf.bind();
```

(Space Mono code block, copyable.)

## Anti-patterns

- Auto-refresh that re-renders entire table (must diff and only update changed rows)
- Hiding revoked sessions immediately (operators need to confirm the revoke landed)
- Using emoji for device type (use Lucide / Heroicons SVG)
