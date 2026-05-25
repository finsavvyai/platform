# FinSavvy Cluster — CLAUDE.md

Extends `/Users/shaharsolomon/dev/projects/CLAUDE.md`. All portfolio rules apply.

## Mission

Distributed local LLM inference for power users. Multi-machine home cluster + AWS-CLI ergonomics + intelligent model routing.

## Target user

Ops/SRE engineers running LLMs locally for privacy, latency, or cost reasons; small teams with multiple workstations who want to pool inference capacity.

## Architecture constraints

- Inference happens locally (or in a user-controlled cluster). No prompts to vendor APIs unless user explicitly opts in.
- Multi-node coordination is leader-elected; no SPOF in steady state.
- Model routing is policy-driven: smallest capable model wins per prompt; user can override.
- Auth boundary: cluster admin API requires `@finsavvyai/auth` JWT once integrated.

## Test matrix

- **100% coverage** on critical paths: model routing decision, node leader election, prompt-to-node dispatch.
- **>=90% line / >=85% branch** elsewhere.
- Integration: cluster of 3 mock nodes, leader failover, model swap mid-stream.
- E2E: CLI install → cluster init → inference round-trip; menubar app launch.

## Security controls

- No model weights or prompts logged to disk unless user enables debug mode (explicit consent).
- Audit log (when enabled) follows platform convention `{ts, actor_id, event, resource, decision, reason}` via `@finsavvyai/telemetry`.
- Network: cluster nodes communicate over WireGuard or mTLS; no plaintext.
- Web Worker admin endpoints rate-limited.

## Release checklist

- Gates green (typecheck, test, coverage, audit, secret-scan).
- No telemetry-by-default; opt-in only.
- LICENSE present (already done).
- Apple HIG for desktop + menubar surfaces.
- Cross-platform tested: macOS, Linux, Windows (CLI minimum).

## Consolidation TODOs

1. Un-nest `finsavvy-cluster/finsavvy-cluster/` subdir.
2. Decide single-package vs multi-package layout (CLI + desktop + menubar + iOS).
3. Sharpen positioning vs Ollama/vLLM — concrete 5-min "first multi-node inference" demo.
4. Wire `@finsavvyai/auth` for cluster admin.
5. Document the model-routing policy DSL.
