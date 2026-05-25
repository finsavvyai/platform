# Architecture diagram (auto-generated)

> Generated: 2026-04-30T18:35:27.795Z
> Regenerate: `pnpm tsx scripts/gen-architecture-diagram.ts`
> Source of truth: `apps/api/wrangler.toml` + URL literals in `apps/api/src` + `packages/*`.

## Bindings

- D1: DB
- KV: KV
- R2: R2
- Queues (producers): SCAN_QUEUE, REMEDIATION_QUEUE, NOTIFICATION_QUEUE
- Durable Objects: TENANT_EVENTS, TENANT_EVENTS
- Service bindings: AI_ENGINE
- External vendors discovered in source: Microsoft Entra ID, Microsoft Graph, Resend, Anthropic, LemonSqueezy, Twilio

## Diagram

```mermaid
flowchart LR
    Browser["Customer browser"]
    Pages["Cloudflare Pages — tenantiq-web (SvelteKit)"]
    API["Cloudflare Workers — tenantiq-api (Hono)"]
    D1_DB[("D1 DB")]
    KV_KV[("KV KV")]
    R2_R2[("R2 R2")]
    Q_SCAN_QUEUE{{"Queue SCAN_QUEUE"}}
    Q_REMEDIATION_QUEUE{{"Queue REMEDIATION_QUEUE"}}
    Q_NOTIFICATION_QUEUE{{"Queue NOTIFICATION_QUEUE"}}
    DO_TENANT_EVENTS[/"DO TENANT_EVENTS"/]
    DO_TENANT_EVENTS[/"DO TENANT_EVENTS"/]
    S_AI_ENGINE[["Worker AI_ENGINE"]]
    V0["Microsoft Entra ID"]
    V1["Microsoft Graph"]
    V2["Resend"]
    V3["Anthropic"]
    V4["LemonSqueezy"]
    V5["Twilio"]

    Browser -->|TLS 1.3| Pages
    Pages -->|cookie + Bearer| API
    API --> D1_DB
    API --> KV_KV
    API --> R2_R2
    API --> Q_SCAN_QUEUE
    API --> Q_REMEDIATION_QUEUE
    API --> Q_NOTIFICATION_QUEUE
    API --> DO_TENANT_EVENTS
    API --> DO_TENANT_EVENTS
    API --> S_AI_ENGINE
    API --> V0
    API --> V1
    API --> V2
    API --> V3
    API --> V4
    API --> V5
```

## Drift check

Compare the External vendors list against `docs/SUB_PROCESSORS.md`. The drift script (`scripts/check-cert-drift.ts`) enforces this in CI.
