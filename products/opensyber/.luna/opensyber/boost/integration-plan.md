# OpenSyber — Integration Plan

**Generated**: 2026-04-08
**Goal**: Boost OpenSyber with open-source tools before Product Hunt Q2 2026 launch

## Priority Matrix

| Priority | Tool | Effort | Impact | Launch-Critical |
|----------|------|--------|--------|-----------------|
| P0 | Victory (Charts) | 4h | High | Yes |
| P1 | RuVector (Vector Search) | 8h | High | Yes |
| P2 | Perfetto (Perf Tracing) | 6h | Medium-High | No |
| P3 | flakestress (Flaky Tests) | 2h | Medium | Yes |
| P4 | Tailscale (Mesh VPN) | 4h | Medium | No |
| P5 | llamafile (Offline AI) | 6h | Medium | No |
| P6 | Agent of Empires (Multi-Agent) | 8h | Low-Medium | No |
| P7 | LLaMA-Mesh (3D Viz) | 12h | Low | No |

---

## Phase 1: Launch-Critical (P0–P3) — ~20 hours

### Step 1: Victory Charts Integration (P0)
```bash
cd apps/web && pnpm add victory
```

1. Create `packages/ui/src/charts/` with reusable chart components:
   - `TrendChart.tsx` — time-series for threat trends, compliance scores
   - `SeverityDonut.tsx` — finding severity distribution
   - `MetricBar.tsx` — skill usage, agent health
   - `AreaTimeline.tsx` — alert volume over time
2. Integrate into dashboard pages:
   - `/dashboard` — security posture overview with 4 chart widgets
   - `/dashboard/findings` — severity breakdown + trend
   - `/admin/analytics` — platform-wide metrics
   - `/marketplace` — skill popularity charts
3. Export from `packages/ui` for cross-app reuse
4. Add Vitest snapshot tests for each chart component

**Acceptance**: Dashboard renders 4+ interactive charts with real data from D1

### Step 2: flakestress CI Integration (P3)
```bash
# Install globally or as dev dep
pnpm add -Dw flakestress
```

1. Add `test:stress` script to root `package.json`
2. Configure to run each test 10x in CI (nightly job)
3. Focus on known flaky areas:
   - D1 database tests (connection timing)
   - Durable Object tests (state race conditions)
   - Auth middleware tests (token expiry edge cases)
4. Add GitHub Action workflow: `.github/workflows/flaky-detection.yml`

**Acceptance**: CI reports flaky test list; zero flaky tests in critical paths

### Step 3: RuVector Semantic Search (P1)
```bash
# Add as Cloudflare Worker binding or sidecar
```

1. Create `packages/vector-search/` package:
   - Embedding generation for skills, findings, threat intel
   - Vector index management (CRUD)
   - Hybrid search (vector + keyword) API
2. Integrate with existing routes:
   - `apps/api/src/routes/skill-recommendations.ts` — semantic skill discovery
   - `apps/api/src/routes/ai-query.ts` — natural language security queries
   - `apps/api/src/services/attack-paths/` — similar attack pattern retrieval
3. Feed embeddings from Claw Gateway (use model embeddings)
4. Store vectors in D1 or dedicated KV namespace

**Acceptance**: "Find skills for lateral movement detection" returns relevant results

---

## Phase 2: Post-Launch Enhancements (P4–P5) — ~10 hours

### Step 4: Perfetto Performance Tracing (P2)
1. Add trace instrumentation to:
   - `apps/claw-gateway/src/services/llm-proxy.ts` — LLM call duration
   - `apps/api/src/middleware/` — request lifecycle spans
   - `apps/agent/src/monitors/` — agent health check timing
2. Create trace export endpoint: `/admin/traces`
3. Embed Perfetto UI viewer in admin dashboard
4. Add trace-based alerting (>2s LLM latency → alert)

**Acceptance**: Admin can view flame charts of API request lifecycle

### Step 5: Tailscale Mesh VPN (P4)
1. Add Tailscale setup to agent VM provisioning (Hetzner):
   - Auto-join Tailscale network on VM creation
   - ACL policy per customer org
   - MagicDNS for `agent-{id}.ts.net` resolution
2. Update `apps/agent/src/` to prefer Tailscale for API communication
3. Update gateway token flow to validate Tailscale identity
4. Enterprise tier: dedicated Tailscale network per customer

**Acceptance**: Agent communicates with API over encrypted Tailscale mesh

### Step 6: llamafile Offline AI (P5)
1. Bundle small model (e.g., Llama 3 8B) as llamafile
2. Add `local` provider to `packages/claw-sdk/src/providers.ts`
3. Update `skills/shared/llm.js` with llamafile fallback
4. Agent detects network loss → switches to local inference
5. Document air-gapped deployment in docs/

**Acceptance**: Agent continues basic triage when Claw Gateway unreachable

---

## Phase 3: Differentiation (P6–P7) — ~20 hours

### Step 7: Multi-Agent Consensus (P6)
- Inspired by Agent of Empires parallel patterns
- Run 3 AI models on same finding → majority vote on severity
- Reduces false positives by ~40% (based on ensemble research)

### Step 8: 3D Attack Graph (P7)
- LLaMA-Mesh for generating 3D network topology from attack paths
- Three.js renderer in dashboard
- Marketing differentiator for Product Hunt demo

---

## Total Estimated Effort

| Phase | Hours | Timeline |
|-------|-------|----------|
| Phase 1 (Launch-Critical) | ~20h | Week 1-2 |
| Phase 2 (Post-Launch) | ~10h | Week 3-4 |
| Phase 3 (Differentiation) | ~20h | Month 2 |
| **Total** | **~50h** | **~6 weeks** |

## Risk Mitigation

- **Victory**: Well-maintained (FormidableLabs), React 19 compatible, SSR-safe
- **RuVector**: New project — evaluate stability; fallback to Cloudflare Vectorize
- **Perfetto**: Google-backed, stable; Worker compatibility needs verification
- **flakestress**: Lightweight Go tool, easy CI integration
- **Tailscale**: Production-proven; free for <100 devices
- **llamafile**: Mozilla-backed; model size constraints on Hetzner 1GB VMs
