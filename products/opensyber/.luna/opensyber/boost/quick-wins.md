# OpenSyber — Quick Wins (< 1 hour each)

**Generated**: 2026-04-08

## Quick Win 1: Add Victory Charts to Dashboard (~45 min)

**What**: Install Victory and add a single security posture trend chart to the main dashboard.

```bash
cd apps/web && pnpm add victory
```

Create a reusable `ThreatTrendChart` component:
```tsx
// packages/ui/src/charts/ThreatTrendChart.tsx
import { VictoryChart, VictoryLine, VictoryAxis, VictoryTheme } from 'victory';

export function ThreatTrendChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <VictoryChart theme={VictoryTheme.clean} height={200}>
      <VictoryAxis tickFormat={(t) => new Date(t).toLocaleDateString()} />
      <VictoryAxis dependentAxis />
      <VictoryLine data={data} x="date" y="count" style={{ data: { stroke: '#00E5C3' } }} />
    </VictoryChart>
  );
}
```

**Impact**: Immediate visual upgrade to dashboard — charts are the #1 expected feature for a security platform.

---

## Quick Win 2: flakestress One-Liner (~15 min)

**What**: Run all tests 5x to find flaky tests before launch.

```bash
# Install
go install github.com/bradfitz/flakestress@latest

# Run on critical test suites
flakestress -n 5 -run "pnpm --filter @opensyber/api test"
flakestress -n 5 -run "pnpm --filter @opensyber/db test"
```

**Impact**: Discover hidden flaky tests before they block CI during launch week.

---

## Quick Win 3: Add llamafile Provider Alias (~30 min)

**What**: Add `local` as a provider option in Claw SDK without full integration.

In `packages/claw-sdk/src/providers.ts`, add:
```typescript
export const LOCAL_MODELS = {
  'local-small': { provider: 'llamafile', model: 'llama-3-8b' },
  'local-medium': { provider: 'llamafile', model: 'llama-3-70b' },
} as const;
```

**Impact**: Future-proofs the SDK for offline AI without requiring full llamafile integration now.

---

## Quick Win 4: Tailscale Agent Discovery DNS (~20 min)

**What**: Add Tailscale MagicDNS hostname to agent provisioning config.

In agent provisioning (Hetzner VM setup), add:
```bash
# cloud-init snippet
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --authkey=$TAILSCALE_AUTHKEY --hostname=agent-${INSTANCE_ID}
```

**Impact**: Every new agent gets a stable `agent-{id}.ts.net` hostname — foundation for mesh networking.

---

## Quick Win 5: Victory Severity Donut (~30 min)

**What**: Add a severity distribution donut chart to the findings page.

```tsx
// packages/ui/src/charts/SeverityDonut.tsx
import { VictoryPie } from 'victory';

const SEVERITY_COLORS = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#22C55E',
  info: '#6B7280',
};

export function SeverityDonut({ data }: { data: { severity: string; count: number }[] }) {
  return (
    <VictoryPie
      data={data}
      x="severity"
      y="count"
      colorScale={data.map(d => SEVERITY_COLORS[d.severity] || '#6B7280')}
      innerRadius={60}
      labelRadius={80}
      style={{ labels: { fontSize: 12, fill: '#fff' } }}
    />
  );
}
```

**Impact**: Visual severity breakdown — expected by every security buyer.

---

## Summary

| Quick Win | Time | Tool | Impact |
|-----------|------|------|--------|
| Threat Trend Chart | 45m | Victory | Dashboard visual upgrade |
| Flaky Test Scan | 15m | flakestress | CI reliability check |
| Local Provider Alias | 30m | llamafile | SDK future-proofing |
| Agent DNS Setup | 20m | Tailscale | Network foundation |
| Severity Donut | 30m | Victory | Findings page UX |
| **Total** | **~2.5h** | | |

All quick wins are independent — do them in any order. Start with **Victory charts** for the biggest visual impact before Product Hunt launch.
