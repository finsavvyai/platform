# Microsoft Marketplace + Partner Center — Environment Variables

These secrets must be set in Cloudflare Wrangler before AppSource can transact and before GDAP Partner Center calls succeed.

## Required for AppSource transactable offer

| Variable | Where to find it | How to set |
|---|---|---|
| `MARKETPLACE_PUBLISHER_TENANT_ID` | Azure portal → Microsoft Entra ID → Overview → Tenant ID (the publisher's own tenant, not a customer's) | `wrangler secret put MARKETPLACE_PUBLISHER_TENANT_ID` |
| `MARKETPLACE_AAD_APP_ID` | Azure portal → App registrations → TenantIQ Marketplace App → Application (client) ID | `wrangler secret put MARKETPLACE_AAD_APP_ID` |
| `MARKETPLACE_AAD_APP_SECRET` | Azure portal → App registrations → TenantIQ Marketplace App → Certificates & secrets → New client secret | `wrangler secret put MARKETPLACE_AAD_APP_SECRET` |

The AAD app needs `Marketplace.SubscriptionsApi` scope (resource ID `20e940b3-4c77-4b0b-9a53-9e16a1b010a7`).

### How to set (from project root)

```bash
cd apps/api
wrangler secret put MARKETPLACE_PUBLISHER_TENANT_ID
# Paste the GUID when prompted.

wrangler secret put MARKETPLACE_AAD_APP_ID
# Paste the GUID.

wrangler secret put MARKETPLACE_AAD_APP_SECRET
# Paste the secret.

wrangler deploy  # Re-deploy to make secrets available.
```

### Behavior when unset

`/api/marketplace/resolve` returns 401 (`Token rejected by Microsoft`) for all tokens.
`/api/marketplace/webhook` returns 401 (`Operation not verified by Microsoft`) for any payload with `operationId`.
Webhooks without `operationId` proceed but will not be able to acknowledge back to Microsoft.

This is fail-closed by design. AppSource certification requires real validation; without these vars, the endpoints can't validate.

## Required for GDAP Partner Center API

The GDAP Partner Center integration at `apps/api/src/routes/gdap.ts:/relationships/:id/access-assignment` calls Microsoft Graph as the partner tenant. The graph token machinery is shared with regular customer-tenant calls — same `getToken` flow keyed by tenant ID. So the additional config is per-org, stored in the `partner_config` D1 table:

| Field | How customer fills | How TenantIQ uses |
|---|---|---|
| `partner_id` | MSP enters their MPN/Partner Center ID at `/gdap` | Stored for display only |
| `partner_tenant_id` | MSP enters the GUID of their own M365 tenant | Used as the `azureTenantId` for Partner Center Graph calls |

The MSP's own M365 tenant (their partner tenant) must have:
- A multi-tenant Entra app (TenantIQ's standard app works) with admin consent granted
- The `DelegatedAdminRelationship.ReadWrite.All` Graph permission consented

When the MSP first hits `POST /api/gdap/access-assignment`, TenantIQ:
1. Looks up their `partner_config` row
2. Calls `createPartnerCenterClient(env, partner_tenant_id)` — uses cached partner-tenant token
3. POSTs to `https://graph.microsoft.com/v1.0/tenantRelationships/delegatedAdminRelationships/{id}/accessAssignments`

If the partner-tenant access token cache is empty, the standard Graph token flow runs (`getToken` in `apps/api/src/lib/graph-client.ts`).

## Optional — for AppSource preview / sandbox testing

| Variable | Purpose |
|---|---|
| `MARKETPLACE_API_BASE` | Override the default `https://marketplaceapi.microsoft.com` for testing against Microsoft's sandbox. Default is production. |

Not currently consumed by code — placeholder for future sandbox testing.

## Verification after setting

```bash
# Should return non-empty AAD app token (proves MARKETPLACE_* vars work)
curl -X POST https://api.tenantiq.app/api/marketplace/resolve \
  -H "Content-Type: application/json" \
  -d '{"token":"valid-token-from-microsoft-sandbox"}'

# Without MARKETPLACE_* set: returns 401 "Token rejected by Microsoft"
# With MARKETPLACE_* set + valid token: returns 200 with subscription details
# With MARKETPLACE_* set + bogus token: returns 401 "Token rejected by Microsoft" (Microsoft rejects)
```

## Rotation policy

- AAD app secret expires every 12 months by default (Microsoft default).
- Rotate by creating a new secret in Azure portal, then `wrangler secret put MARKETPLACE_AAD_APP_SECRET` with the new value, then `wrangler deploy`.
- Old secret stays valid until its expiry; no downtime if rotation is done before expiry.

## Audit trail

Every marketplace operation records:
- `operationId` from Microsoft
- `subscriptionId`
- `action` (Activate, ChangePlan, Suspend, Reinstate, Unsubscribe, Renew)
- `orgId` (target TenantIQ org)
- timestamp

Stored in KV under `marketplace-event:{orgId}:{eventId}` with 90-day TTL. For longer retention, query and export to R2.
