# @finsavvyai/aml-screen-skill

A **metered MCP skill** that exposes AMLIQ sanctions/PEP screening as a single
agent-callable tool, gated by a customer's billing entitlement. This is the
"buy-and-install" packaging of AMLIQ screening: drop it into any MCP-capable
agent stack and every call is checked against the caller's plan and counted
against their quota.

It composes existing platform packages — it adds no new screening or billing
logic:

- [`@finsavvyai/aml-screen-client`](../aml-screen-client) — the real call to the
  AMLIQ screening endpoint.
- [`@finsavvyai/billing`](../billing) — `resolveEntitlement` decides whether the
  customer may call, and what their period limit is.

## The tool

`aml_screen` — screen a name against OFAC / EU / UN / UK OFSI with multi-layer
matching. Input: `{ name, lists?, pep?, threshold? }`. Output: matches,
confidence, and a risk level, plus the remaining quota for the period.

## How metering works

```
call → resolveEntitlement(customer, "aml.screen")
         ├─ none ........................ deny: "payment required"
         ├─ used >= limit ............... deny: "quota exceeded"  (no quota burned)
         └─ allowed ..................... record 1 unit → call AMLIQ → return result
```

- **Identity is server-bound, not caller-supplied.** The customer is resolved
  from the skill's configuration (`AMLIQ_CUSTOMER_ID`), so a caller cannot spoof
  another customer's quota through tool arguments.
- **Denied calls never burn quota** — usage is recorded only on success.
- To grant access, add an entitlement to the customer's plan in billing:
  `{ key: "aml.screen", limit: 100 }` (or `"unlimited"`).

## Configuration (env)

| Var | Meaning | Default |
|-----|---------|---------|
| `AMLIQ_API_URL` | AMLIQ screening base URL | `https://api.amliq.finance` |
| `AMLIQ_CUSTOMER_ID` | Billing customer this instance serves | _(none → all calls denied)_ |
| `AMLIQ_BILLING_CONFIG` | Path to a JSON `{ plans, subscriptions }` snapshot | _(none → fail closed)_ |

Example `billing.json`:

```json
{
  "plans": [{
    "id": "plan_pilot", "name": "Fintech Pilot",
    "price": { "amountMinor": 250000, "currency": "USD" },
    "interval": "month",
    "entitlements": [{ "key": "aml.screen", "limit": 100 }]
  }],
  "subscriptions": [{
    "id": "sub_1", "customerId": "cust_acme", "planId": "plan_pilot",
    "status": "active", "currentPeriodEnd": 4102444800
  }]
}
```

Run as an MCP stdio server:

```bash
AMLIQ_CUSTOMER_ID=cust_acme AMLIQ_BILLING_CONFIG=./billing.json amliq-screen-skill
```

## Production notes (honest limitations)

- The bundled `InMemoryUsageMeter` is **process-local and resets on restart** —
  fine for dev/single-process demos. Production must inject a durable,
  period-scoped `UsageMeter` (KV/Postgres) via `createScreenSkillServer`.
- `SnapshotStore` reads a static billing snapshot. For multi-tenant scale,
  inject a `Store` backed by the live billing persistence instead.
- Core logic (gate, meter, store, tool handler) is unit-tested to **100%
  coverage** against the real platform packages; the `server`/`bin` transport
  layer is the only un-unit-tested glue (verified by typecheck + build).
