# LEMONSQUEEZY_WEBHOOK_SIG_FAIL — LemonSqueezy webhook signature failures spike

**Severity:** SEV1 (critical). Same risk model as Stripe variant.

## Impact
`>5` `billing.webhook.signature_invalid` (provider=lemonsqueezy) audit events
in 5 minutes. LemonSqueezy events (subscriptions, refunds, invoices) are
being rejected — entitlement state may diverge from billing system.

Source: `WebhookSignatureError` (`billing.webhook.signature_invalid`).

## Symptoms
- Audit log entries with `provider: "lemonsqueezy"` and decision `deny`.
- LemonSqueezy Dashboard → Settings → Webhooks shows red deliveries.

## Quick diagnosis
```bash
# 1. Confirm via worker logs.
wrangler tail --env production --format pretty finsavvy-ai-gateway-production \
  | grep -E "lemonsqueezy.*signature_invalid"

# 2. LemonSqueezy Dashboard webhook signing secret — was it rotated?

# 3. Inspect failing payloads (LemonSqueezy stores them on the dashboard).
```

## Mitigation
1. **Secret rotation:** update worker secret.
   ```bash
   wrangler secret put FINSAVVY_BILLING_LEMONSQUEEZY_WEBHOOK_SECRET --env production \
     --name finsavvy-ai-gateway-production
   ```
2. **Attack pattern (single IP):** WAF block.
3. **Don't disable signature verification — ever.**

## Root cause investigation
- Diff LemonSqueezy signing-algorithm version against our verifier
  (`packages/billing/src/providers/lemonsqueezy/*`).
- Check if a recent deploy modified the verifier — roll back if so.

## Rollback procedure
```bash
wrangler rollback <VERSION_ID> --env production --name finsavvy-ai-gateway-production
```

## Verification
- Successful LemonSqueezy delivery in their dashboard.
- No new failures for 15 min.

## Post-incident
- SEV1 → postmortem.
- Reconcile entitlements: re-fetch subscription state for any customers
  whose webhooks were rejected in the window.
