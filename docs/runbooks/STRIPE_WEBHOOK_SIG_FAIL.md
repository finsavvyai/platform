# STRIPE_WEBHOOK_SIG_FAIL — Stripe webhook signature failures spike

**Severity:** SEV1 (critical). Possible forged events OR rotated secret OR
upstream Stripe regression.

## Impact
`>5` `billing.webhook.signature_invalid` (provider=stripe) audit events in 5
minutes. Either:
- Legitimate Stripe events are being rejected → entitlement drift, double
  charges, or missed cancellations.
- An attacker is probing the endpoint.

Source error: `WebhookSignatureError` in `@finsavvyai/billing`
(`packages/billing/src/errors.ts`, code `billing.webhook.signature_invalid`).

## Symptoms
- Audit log line: `{ event: "billing.webhook.received", decision: "deny", reason: "signature_invalid" }`.
- Stripe Dashboard → Developers → Webhooks shows delivery failures.

## Quick diagnosis
```bash
# 1. Confirm the spike in audit sink (R2).
# (Replace with actual audit query tool when available.)
wrangler tail --env production --format pretty finsavvy-ai-gateway-production \
  | grep "billing.webhook.signature_invalid"

# 2. Stripe Dashboard: any recent webhook secret rotation?
#    https://dashboard.stripe.com/webhooks

# 3. Compare counts: legit deliveries vs. failures.

# 4. Pull source IPs from CF Access logs for the /webhooks/stripe path.
#    If single IP → likely attack.
```

## Mitigation
1. **If secret was rotated upstream:** update worker secret.
   ```bash
   wrangler secret put FINSAVVY_BILLING_STRIPE_WEBHOOK_SECRET --env production \
     --name finsavvy-ai-gateway-production
   # paste new whsec_... value from Stripe Dashboard
   ```
2. **If attack pattern:** block source IPs at Cloudflare WAF; do NOT relax
   signature checks.
3. **If unknown:** keep rejecting (default deny holds). Open SEV1 channel.

## Root cause investigation
- Diff timestamps of failures vs. legit successes.
- Replay a known-good event through staging with the same secret to verify
  worker code is intact.
- Check audit log for `event_not_allowed` (different code) — that's a
  separate signal (event type allowlist drift).

## Rollback procedure
- If a deploy changed signature verification logic (`packages/billing/src/`),
  roll back the worker:
  ```bash
  wrangler rollback <VERSION_ID> --env production --name finsavvy-ai-gateway-production
  ```
- Webhook secret itself is forward-only: rotate, don't roll back.

## Verification
- Successful Stripe delivery in Stripe Dashboard within 5 min after fix.
- No new `billing.webhook.signature_invalid` for 15 min.

## Post-incident
- SEV1 → postmortem.
- Action: ensure Stripe webhook secret rotation is in the secrets-rotation
  calendar.
