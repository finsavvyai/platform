# SDLC Gateway vs. Alternatives

A frank breakdown of where this OSS gateway sits in the landscape. Updated 2026-04-20.

## TL;DR

| Need                                | Best fit                       |
|-------------------------------------|--------------------------------|
| Multi-tenant B2B SaaS gateway       | **sdlc-gateway** (this repo)   |
| LLM observability + caching         | Helicone, Portkey              |
| API gateway for monolith REST       | Kong, Tyk                      |
| Edge routing + WAF                  | Cloudflare, AWS API Gateway    |
| Mesh / service-to-service           | Istio, Linkerd                 |

If your gateway needs are "tiered rate limits + SCIM + tenant-scoped events at the front of an HTTP API", read on.

---

## Feature matrix

|                                    | sdlc-gateway | Kong (OSS) | Tyk (OSS) | Portkey (OSS) | Helicone (OSS) |
|------------------------------------|:------------:|:----------:|:---------:|:-------------:|:--------------:|
| **Tier-based rate limiting**       | ✅            | Plugin     | ✅         | ❌            | ❌              |
| **Per-tenant concurrent limits**   | ✅            | ❌         | ❌         | ❌            | ❌              |
| **Per-tenant payload size**        | ✅            | Plugin     | Plugin    | ❌            | ❌              |
| **Device fingerprinting**          | ✅            | ❌         | ❌         | ❌            | ❌              |
| **SCIM 2.0 (Okta, Azure AD)**      | ✅            | Enterprise | Enterprise| ❌            | ❌              |
| **Tenant-scoped pub/sub events**   | ✅            | ❌         | ❌         | ❌            | ❌              |
| **LLM provider routing**           | Hosted       | ❌         | ❌         | ✅            | ❌              |
| **Prompt logging / observability** | Hosted       | ❌         | ❌         | ✅            | ✅              |
| **Single binary, no plugins**      | ✅            | ❌         | ❌         | ✅            | ✅              |
| **Apache-2.0 (no AGPL trap)**      | ✅            | Apache-2.0 | MPL-2.0   | MIT           | Apache-2.0     |
| **Memory footprint (idle)**        | ~12 MB       | ~80 MB     | ~60 MB    | ~120 MB       | N/A (Node)     |
| **Cold-start latency**             | <50 ms       | ~2 s       | ~1.5 s    | ~3 s          | N/A            |

---

## Detailed comparisons

### vs. Kong OSS

**Kong wins** when you need a battle-tested L7 router with a huge plugin ecosystem (Okta SSO, Datadog, mTLS, etc.) and you don't mind the operational footprint of running a Cassandra/Postgres-backed control plane.

**sdlc-gateway wins** when:
- You want SCIM and tier rate limits *out of the box* without buying Kong Enterprise.
- You ship in a single Go binary (or a 12 MB container) with no plugin packaging.
- Your tenancy model is "tenant ID in a header" — no need for Kong's Workspace abstraction.

### vs. Tyk OSS

**Tyk wins** when you want a built-in developer portal, OpenAPI-driven management, and you're already on the Tyk dashboard.

**sdlc-gateway wins** when:
- You don't want a separate dashboard process.
- You want concurrent limits *and* per-tenant payload caps in one config.
- You want to embed the rate-limit middleware in your own Go service rather than running a sidecar.

### vs. Portkey OSS

**Portkey wins** for LLM-specific concerns: provider fallback, semantic caching, cost tracking across OpenAI/Anthropic/Bedrock, prompt versioning.

**sdlc-gateway wins** when:
- You're at the *transport* layer (HTTP), not the LLM layer.
- You need SCIM, fingerprinting, multi-tenant rate limits — Portkey doesn't ship these.
- You want to chain both: front Portkey with sdlc-gateway for tenancy, and let Portkey handle LLM provider routing behind it.

### vs. Helicone OSS

**Helicone wins** for prompt observability and cost dashboards layered onto OpenAI / Anthropic traffic.

**sdlc-gateway wins** when your traffic isn't all LLM, or when you need user provisioning and tenant isolation primitives that Helicone doesn't aim to provide.

### vs. Cloudflare API Gateway

**Cloudflare wins** for global edge presence, DDoS, WAF, zero-trust network access.

**sdlc-gateway wins** when you need:
- Stateful per-tenant rate counters (Cloudflare's free tier rate limit is per-IP, not per-tenant).
- SCIM with a custom user store.
- A tenant-scoped pub/sub channel feeding an in-app activity feed.
- Self-hosting for compliance reasons (HIPAA on-prem, air-gapped).

You can run sdlc-gateway *behind* Cloudflare. The `deployments/cloudflare-worker/` recipe shows the pattern.

---

## When NOT to use this

- **You're building a mesh.** Use Istio or Linkerd. This is north-south, not east-west.
- **You need WAF / bot management.** Use Cloudflare or AWS WAF. We don't do request inspection beyond fingerprint.
- **You need a developer portal with API key self-service UI.** Use Kong Konnect or Tyk Dashboard. The hosted enterprise [sdlc.cc](https://sdlc.cc) ships one; this OSS repo doesn't.
- **You want plugin-based extension.** This is a Go library + binary; you fork or vendor, you don't drop in Lua plugins.

---

## License notes

This repo is **Apache-2.0** — same family as Kong OSS, more permissive than Tyk's MPL-2.0. We deliberately avoid AGPL because B2B customers running on-prem cannot accept it. The [hosted enterprise platform](https://sdlc.cc) is a separate proprietary build that layers on the OSS modules without forking — the hosted product depends on this OSS, not the other way around.
