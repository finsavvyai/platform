# AMLIQ Brain

**SKU:** `AMLIQ Brain` — the agent-driven AML/CFT intelligence layer.
Sibling of `AMLIQ Investigate` (the analyst console under `../api/`,
`../web/`, `../engines/`). Both SKUs live under the AMLIQ umbrella
(locked decision #1 of `decisive_plan_90day.md`).

## Where this sits

```
products/amliq/
├── api/         ← AMLIQ Investigate: Go decision API (existing)
├── web/         ← AMLIQ Investigate: React analyst console (existing)
├── engines/     ← QuantumBeam + ml-fraud (existing)
├── internal/    ← shared Go internals
└── brain/       ← THIS PACKAGE — AMLIQ Brain SKU
    ├── services/
    │   ├── api/          ← TS Hono service (auth + audit emit + routing)   [BRAIN-SCAFFOLD]
    │   ├── agents/       ← Python placeholder (SAR Draft / Reg Change / Alert Triage; M2 W6)
    │   ├── retrieval/    ← TS adapter for oss/finsavvy-rag (RAG; W4)
    │   └── sanctions/    ← TS 3-tier screening (OFAC / CompA / DJR)
    ├── corpus/           ← CORPUS-PIPELINE subtree (FinCEN RSS + FFIEC PDF crawler)
    └── inference/        ← CLUSTER-BRIDGE subtree (InferenceProvider → products/finsavvy-cluster/)
```

`corpus/` and `inference/` are sibling subtrees owned by other Week-2
swarm agents (CORPUS-PIPELINE and CLUSTER-BRIDGE respectively). They
have their own package metadata and build/test configuration. The root
`@finsavvyai/amliq-brain` package defined here compiles only the
`services/api`, `services/retrieval`, and `services/sanctions` subtrees;
the sibling subtrees are excluded from this tsconfig/vitest scope.

## What this package is at W2 (today)

The **TS API skeleton** for AMLIQ Brain. Specifically:

- `services/api/src/server.ts` — Hono app factory wiring health + auth + audit
- `services/api/src/auth.ts` — JWT middleware (DI-based; 100% covered)
- `services/api/src/audit.ts` — audit emitter with tamper-chain hook + sink fallback (100% covered)
- `services/api/src/health.ts` — round-3 mesh health snapshot builder
- `services/api/src/types.ts` — all DI contracts (AuthVerifier, AuditSink, AuditChain, etc.)
- `services/retrieval/src/types.ts` — `ComplianceDoc` cross-agent contract (RAG corpus shape)
- `services/sanctions/src/types.ts` — 3-tier sanctions screening contract (locked decision #8)
- `services/agents/README.md` — Python placeholder for M2 W6 agent runtime
- `inference/` (owned by CLUSTER-BRIDGE) — `InferenceProvider` contract + cluster HTTP provider
- `corpus/` (owned by CORPUS-PIPELINE) — FinCEN RSS + FFIEC PDF crawler skeleton

## What this package is NOT (yet)

- Not a runnable service binary. The host-process boot (`node services/api/dist/index.js`) and concrete wiring of `AuthVerifier` / `AuditSink` / `AuditChain` live in a future deploy ticket.
- Not in `pnpm-workspace.yaml`. Per round-4 rule, `products/*` packages with no `@finsavvyai/*` imports stay out of the workspace glob to avoid vitest version conflicts.
- Not yet calling `oss/finsavvy-rag/`. That package is cut in W4; until then `RetrievalAdapter` is type-only.
- Not yet running Python agents. M2 W6.

## Cross-agent contracts honoured (Brain Week 2 mesh)

| Contract | This package's role |
|---|---|
| Audit-tamper API (`chainAppend`) | Brain consumes via `AuditChain` DI; AUDIT-TAMPER provides impl in `packages/telemetry/src/audit-tamper/` |
| Cluster bridge (`InferenceProvider`) | CLUSTER-BRIDGE owns `inference/` subtree and exports the interface from `inference/src/index.ts`; Brain agents import it via the package boundary |
| ComplianceDoc shape | Brain defines in `services/retrieval/src/types.ts`; CORPUS-PIPELINE produces, RAG-OSS-PREP indexes |
| Health endpoint shape | Brain `/health` returns round-3 mesh shape `{status, version, uptime_s, checks}` |
| Round-2 rule (no `@finsavvyai/*` direct imports) | All cross-package surfaces are local interfaces; no Brain code imports `@finsavvyai/auth` or `@finsavvyai/telemetry` |

## Tests

`pnpm --filter @finsavvyai/amliq-brain test` (once wired) or `vitest run` from this directory.

Coverage targets:

- 100% line + branch on `services/api/src/auth.ts`
- 100% line + branch on `services/api/src/audit.ts`
- ≥90/85/90 on everything else (portfolio baseline)

## Quick start (developer)

```bash
cd products/amliq/brain
pnpm install        # (if/when added to workspace OR run npm/yarn locally)
pnpm test
pnpm typecheck
pnpm build
```

## SOC 2 / audit traceability

Every `POST /v1/brain/*` endpoint emits exactly one audit record. If the
audit sink hard-fails (primary + fallback both throw), the request returns
`503 audit_emit_failed` — Brain does **not** serve a successful response
without a written audit record. This mirrors the AMLIQ Investigate rule in
`../api/decision.md` §7.
