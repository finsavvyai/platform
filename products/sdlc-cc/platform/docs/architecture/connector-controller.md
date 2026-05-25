# Connector controller — design notes

Status: pre-design reference for BEAT-PLAN S2.3 (Google Workspace) and the rest of the connector marketplace (Days 39-48). Replace this file with a real ADR once the controller lands.

## Honest framing

The boost-project pass nominated [ruvnet/ruflo](https://github.com/ruvnet/ruflo) as a reference for our connector framework. Re-reading the upstream README (fetched 2026-04-27), ruflo is a **multi-agent Claude Code orchestrator** — not a SaaS-connector workflow engine. Its patterns are useful in *principle* (learning router, fault-tolerant consensus, swarm topologies) but they don't translate line-for-line to "OAuth into Google Workspace, list a Drive folder, ingest the docs."

What we actually want from prior art:

- A controller that owns connector lifecycle (install / authorize / sync / disable).
- A way to express "10 vendors, each with their own OAuth quirks" without 10× duplication.
- A retry/back-off and dead-letter strategy when a vendor returns 429/5xx.
- An audit trail for every fetch (we already have `audit_logs` from Day 12-13).

## What to copy from ruflo

1. **Hooks-as-extension-points**. ruflo's hook system (27 hooks per their README) is overkill for us, but the *pattern* — register named hooks like `before_oauth`, `after_resource_fetch`, `on_error` — gives third-party connector authors a stable contract. We've already got the `connectors.Connector` interface (`services/gateway/internal/connectors/connector.go`); add a small hook map per connector to let admins plug audit/DLP/spend tracking without forking the connector.

2. **Topology-aware coordination**. ruflo lets you pick mesh/hier/ring/star for agent swarms. We don't have agent swarms but we *do* have parallel sync workers. Borrow the explicit-topology idea: a connector declares whether its sync is "fan-out" (Drive: list folder → fetch many files in parallel) or "linear" (Slack: paginate one channel at a time). The controller respects the declaration when scheduling.

3. **Self-learning routing (lite version)**. ruflo's Q-learning router optimises across LLM providers. The same idea, far simpler, fits the BEAT-PLAN S1.2 multi-provider gateway: track success/cost per provider and prefer the cheapest viable one. Don't try to replicate the full RL stack; a moving-average + ε-greedy is enough.

## What to skip from ruflo

1. **The full RuVector intelligence layer** (SONA, EWC++, Flash Attention, HNSW, ReasoningBank, Poincaré embeddings, LoRA, Int8 quant). Beat-plan compete-report explicitly listed RuVector as "skip" — Postgres+pgvector with RLS is the wedge against Pinecone. Don't undermine it.

2. **27 hooks**. We probably need 4-6 (`before_install`, `after_install`, `before_fetch`, `after_fetch`, `on_error`, `on_sync_complete`). More hooks means more contract surface to maintain — that hurts when each connector author has to learn it.

3. **Consensus algorithms (Raft/BFT/Gossip)**. Our connector workers run on a single gateway node today. Distributed consensus is post-Sprint-3 territory.

4. **The MCP integration**. ruflo plugs into Claude Code via MCP. Our connectors plug into customer SaaS via OAuth. Different transport, different threat model.

## Concrete next step

When BEAT-PLAN S2.3 (Google Workspace) starts, write the controller in `services/gateway/internal/connectors/controller/`:

```go
type Controller struct {
    Registry    *Registry
    Hooks       map[string][]Hook       // before_fetch, after_fetch, on_error
    RateLimiter ratelimit.PerVendorLimiter
    Audit       audit.Appender
    DLQ         webhooks.DeadLetter      // reuse Day-38 work
}

func (c *Controller) Install(ctx, tenant, name) error {
    // dispatch via Registry.Get(name).Authenticate
}

func (c *Controller) Sync(ctx, tenant, name) error {
    // pre-hooks → vendor list/fetch (with rate-limit + retry)
    //   → audit per fetch → post-hooks
    // failure → DLQ with backoff schedule from Day 38 RetryDelays
}
```

That's ~250 LOC, no new dependencies, reuses primitives we already have committed (ratelimit, audit, webhook DLQ).

## What this is NOT

- Not an ADR. ADR-007 lands when the controller is implemented.
- Not a commitment to ruflo as a runtime dependency. Pure pattern study.
- Not a substitute for vendor-specific OAuth verification (Google's app-verification process is its own ~2-week calendar item, started independently).

## References

- ruflo README (fetched 2026-04-27 via `gh api repos/ruvnet/ruflo/contents/README.md`).
- Our connector primitive inventory: INTEGRATION-DEBT.md Days 39-48.
- BEAT-PLAN S2.3 (Google Workspace).
- BEAT-PLAN S2.4 (Slack + GitHub stretch).
- Connector framework code: `services/gateway/internal/connectors/{connector,registry}.go`.
- Existing 10 stubs: `services/gateway/internal/connectors/stubs/`.
