# Multi-Tenant Data Isolation — Design

Week 7 Stream A. Owner: MULTI-TENANT agent. Binding for Brain Month 2.

## Tenant model

Each tenant is an opaque identifier (`tenant_id`, regex `^[a-z0-9_-]{3,64}$`)
mapped 1:1 to:

1. **pgvector schema** — `brain_t_<tenant_id>` (Postgres schema-per-tenant).
   The RAG indexer + querier (`oss/finsavvy-rag/services/rag`) routes every
   write/query through the tenant's schema. Schema names are validated against
   the regex before any DDL/DML.
2. **Worker secrets** — per-tenant secret namespace in Cloudflare Worker env
   (`TENANT_<tenant_id>_*`). No cross-tenant secret reuse. Rotation per tenant.
3. **Audit sink** — independent chain HEAD per tenant (see `audit-prod/`). One
   R2 prefix per tenant: `audit/<tenant_id>/yyyy/mm/dd/`.
4. **Analytics sink** — per-tenant prefix in Datadog tags (`tenant:<id>`) so
   metrics are dashboards-sliceable AND access-controllable.

## Why schema-per-tenant over row-tenant

| Criterion             | Schema-per-tenant       | Row-tenant (single table) |
| --------------------- | ----------------------- | ------------------------- |
| Isolation strength    | Hard (PG ACLs)          | Soft (every query filter) |
| RLS complexity        | None needed             | RLS on every table        |
| GDPR/jurisdictional   | `DROP SCHEMA` is exact  | `DELETE WHERE` is risky   |
| Perf locality         | Indexes per tenant      | Hot shared indexes        |
| Cross-tenant queries  | Forbidden by design     | One-line filter mistake   |
| Schema sprawl         | One per tenant          | One total                 |
| Migration cost        | N migrations            | 1 migration               |

We accept schema sprawl as the cost of strong isolation. AML data is
regulator-defensible only if isolation is structural, not policy-based.

## Trade-offs and mitigations

- **Schema sprawl at scale.** Mitigation: bounded count target **<10k tenants
  for v1**. Above that, shard by region (multiple Postgres clusters) before
  switching to row-tenant. Tenant lifecycle is automated (`provisionTenant`,
  `decommissionTenant`) so per-tenant ops cost is constant.
- **Migration fan-out.** Mitigation: migrations run via worker jobs
  parallelised by tenant; per-tenant retry; deploy gate waits for all
  schemas migrated before flipping traffic. Track schema_version per tenant
  in shared `tenant_state` table.
- **No-cross-tenant joins.** Mitigation: explicit architecture choice. Any
  cross-tenant analytic runs offline on the export pipeline, never online.

## JWT claims (required)

Brain refuses any request whose verified JWT lacks both:

- `tnt` — tenant_id (string, regex above).
- `roles` — string[] of role strings (Brain role grammar:
  `brain:<resource>:<action>`, e.g. `brain:search:read`, `brain:case:write`).

Failure mode (in order):

| Missing/invalid                    | HTTP | error code             |
| ---------------------------------- | ---- | ---------------------- |
| `tnt` absent                       | 403  | `tenant.missing`       |
| `tnt` malformed (regex fails)      | 403  | `tenant.unknown`       |
| Role gate fails downstream         | 403  | `tenant.scope_denied`  |

`tenant.missing` is a separate code from `auth.insufficient_role` because
the remediation differs: the issuer must add the claim, not grant a role.

## Audit log per tenant

- Each tenant has an independent `audit_chain_state` row keyed by `tenant_id`,
  holding `last_hash`, `last_sequence_id`, `updated_at_ms`.
- Genesis hash is `"0" * 64` for every tenant — chains are independent and
  do NOT share state. Cross-tenant chain verification requires `tenant_id`
  input — the verifier refuses ambiguous reads.
- Audit sink is wrapped in `TamperEvidentEmitter` with per-tenant state store
  (see `audit-prod/DESIGN.md`).
- Audit-emit failure still blocks the response (AMLIQ rule), per-tenant.

## Sanctions feed

The OFAC/EU/UN/UK sanctions list is **shared across tenants** (single source
of truth, signed URL pin). Cache is **per-tenant** so:

- Cache invalidation can be triggered per tenant (e.g. a tenant pinning an
  older list version for regulator-driven point-in-time queries).
- Cache poisoning attacks blast-radius is one tenant, not the platform.

## TenantContext shape (canonical)

```ts
type TenantContext = {
  tenant_id: string;   // validated against regex at boundary
  actor_id: string;    // JWT `sub`
  roles: string[];     // JWT `roles`, normalised to string[]
};
```

This shape is **the** mesh §2 contract. All Brain agents accept it as DI
input. The oss/finsavvy-rag package mirrors the shape structurally
(`oss/finsavvy-rag/src/types/tenant.ts`) so the indexer/querier can honor
it without importing `@amliq/brain` (OSS independence rule).

## Scope derivation

Roles → scope is a pure function:

- `brain:*:read`           → `{read: true}`
- `brain:*:write`          → `{read: true, write: true}`
- `brain:admin`            → `{read: true, write: true, admin: true}`

Handlers call `requireRead(ctx)` / `requireWrite(ctx)` / `requireAdmin(ctx)`
at the top of their body. These throw `TenantError` which the Hono error
handler maps to 403 with the stable code.

## Out of scope (future)

- Tenant provisioning UI (admin console; Month 3).
- Per-tenant rate limits (Worker layer; Month 3).
- Cross-tenant analytics export pipeline (Month 4 / billing milestone).
