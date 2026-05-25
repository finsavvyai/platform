# FinSavvy Cluster

**Distributed AI cluster for power users: home computers + AWS-style CLI + intelligent model routing.**

> Upstream README preserved as `README.source.md`.

## Position in the ecosystem

9th CORE product (promoted post-May-2026-ranking, alongside QueryFlux as 8th). Brand-aligned with the FinSavvyAI infra thesis.

Sits at the **inference layer** of the stack:

| Layer | Product |
|---|---|
| Code validation | PushCI |
| Data tier | QueryFlux |
| Runtime QA | Qestro |
| Orchestration | LunaOS |
| **Local LLM inference** | **FinSavvy Cluster** |
| Runtime AI security | OpenSyber |
| Governance | SDLC.cc |
| AML investigations | AMLIQ |
| M365 governance | TenantIQ |

LunaOS orchestrates agents; FinSavvy Cluster runs the models those agents call.

## Differentiator

Crowded market (Ollama, vLLM, llama.cpp, MLX). Niche:
- **AWS-CLI ergonomics** — ops/SRE persona, not ML researchers
- **Multi-machine home cluster** — distribute inference across N home boxes, not single-node, not cloud-managed
- **Intelligent model routing** — smallest capable model picked per prompt

## Surface

- CLI (`finsavvyai`)
- Menubar app (macOS)
- Desktop app (cross-platform)
- iOS app
- Cloudflare Worker control plane

## Status

Active. Last commit 2026-05-13. Promotion is structural — actual GTM is **defer or sharpen first** per ranking memo (market crowded, need clear positioning).

## Build / test

Source tree carries its own toolchain. NOT in canonical pnpm workspace yet. Run from `products/finsavvy-cluster/` directly.

## Integration opportunities

- `@finsavvyai/auth` — gate cluster admin API
- `@finsavvyai/telemetry` — emit audit on every inference (privacy-respecting; on-device by default)
- `@finsavvyai/ai-gateway` — route between cluster and cloud providers (cluster as one provider)
- LunaOS direct integration — cluster as default local-LLM provider

See `CONSOLIDATION_TODO.md`.

## License

See `LICENSE`.
