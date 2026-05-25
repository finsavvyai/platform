# @amliq/investigate-decision

Unified AML Investigate Decision API — TypeScript service that orchestrates
the QuantumBeam and ml-fraud engines over HTTP and emits a tamper-evident
audit record per call.

This package is the executable expression of
[`products/amliq/api/decision.md`](../decision.md). It is the surface that
the analyst console and external clients call instead of either engine.

## Status

- Demoable: can be booted locally against in-process mock engine clients.
- Production wiring: depends on real engine URLs, a JWT signer for engine-
  to-engine auth, a JWT verifier for inbound calls, and a tamper-evident
  audit sink. All four are dependency-injected — no env reads inside the
  service.

## Install / run

This package lives **outside** the pnpm workspace (per round-4 rule for
migrated trees). Install standalone:

```bash
cd products/amliq/api/decision
pnpm install --ignore-workspace
pnpm test
pnpm test:cov
```

## Local demo (no real engines)

```ts
import {
  createApp,
  createDecisionService,
  type AuditEmitter,
  type EngineClient,
} from "@amliq/investigate-decision";

const mockClient = (name: "quantumbeam" | "ml-fraud"): EngineClient => ({
  engine: name,
  score: async (req) => ({
    engine: name,
    risk_score: name === "quantumbeam" ? 12 : 47,
    explanations: [`${name}.demo_rule`],
    latency_ms: 5,
  }),
});

const audit: AuditEmitter = { emit: async (e) => console.log(JSON.stringify(e)) };

const service = createDecisionService({
  engineClients: {
    quantumbeam: mockClient("quantumbeam"),
    "ml-fraud": mockClient("ml-fraud"),
  },
  audit,
  actorIdFor: () => "demo_user",
  newDecisionId: () => crypto.randomUUID(),
});

const app = createApp({
  service,
  verifyJwt: async (_token) => ({
    sub: "demo_user",
    tenant_id: "tenant_demo",
    roles: ["aml:decision:write"],
  }),
  version: "demo",
});

// Hono app — serve with @hono/node-server, bun, deno, or workers.
```

POST a request:

```bash
curl -s -X POST http://localhost:8787/v1/aml/decision \
  -H "authorization: Bearer demo" \
  -H "content-type: application/json" \
  -d '{
    "tenant_id": "tenant_demo",
    "subject": { "subject_id": "S1", "subject_hash": "h_S1" },
    "transaction": {
      "transaction_id": "T1",
      "amount_minor": 5000000,
      "currency": "USD",
      "channel": "wire",
      "cross_border": true
    }
  }'
```

## Production wiring

Production composes the same `createApp(...)` with real implementations:

| DI input        | Production impl                                               |
| --------------- | ------------------------------------------------------------- |
| `engineClients` | `createEngineClient({ config, signer })` per engine — real URLs from env |
| `verifyJwt`     | `@finsavvyai/auth` JWT verify (round-1 hardened module)       |
| `audit`         | Adapter over `@finsavvyai/telemetry` `TamperEvidentEmitter`   |
| `actorIdFor`    | `(req) => claims.sub` from the verified JWT                   |
| `newDecisionId` | `crypto.randomUUID()`                                         |

Engine URLs and audit-sink config follow the round-3 env convention
(`AMLIQ_ENGINE_QUANTUMBEAM_URL`, `AMLIQ_ENGINE_MLFRAUD_URL`,
`FINSAVVY_AUDIT_SINK`, `FINSAVVY_AUDIT_R2_BUCKET`,
`FINSAVVY_AUDIT_DD_API_KEY`).

Audit emit failure **MUST** block the response (`503`) — per
`products/amliq/CLAUDE.md` a decision that cannot be audited MUST NOT be
served.

## Contract reference

- Subject / Transaction / AmlDecision shape — `packages/shared-types/src/aml.ts`
  (structural-compatible; see `src/types.ts` for the local mirror and
  `@see` references).
- Audit shape — `packages/telemetry/src/audit-tamper/` (mesh §6).
- Routing rules — `src/router.ts`, derived from `decision.md` §4 with the
  INVESTIGATE-WIRE scope adjustments (large-txn at $10k, high-risk MCC,
  cross-border, prior SAR).
- Aggregation rules — `src/aggregator.ts`, 0..100 scoring with thresholds
  block ≥ 85, flag ≥ 40, allow < 40.

## Coverage targets

| Surface                              | Target            |
| ------------------------------------ | ----------------- |
| `router.ts`                          | 100 % line + branch |
| `aggregator.ts`                      | 100 % line + branch |
| `decision-service.ts` audit emit     | 100 %             |
| `server.ts` auth + tenant gates      | 100 %             |
| Everything else                      | 90 % line / 85 % branch (portfolio baseline) |

## File-size discipline

Every source file is ≤ 200 lines (portfolio rule). Each test file is also
≤ 200 lines. Split by responsibility when adding behaviour, never by
stacking concerns.
