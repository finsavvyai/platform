# WEBHOOK_REPLAY_DETECTED — Webhook replay attempt detected

**Severity:** SEV1 (critical). Fires on any single occurrence.

## Impact
A webhook arrived with a valid signature but a timestamp outside the
acceptable replay window. Either:
- Legitimate retry storm from provider (rare — both Stripe and LS retry
  with fresh timestamps).
- Active replay attack: leaked signed payload being re-submitted.

Source: `WebhookReplayError` in `@finsavvyai/billing`
(`packages/billing/src/errors.ts`, code `billing.webhook.replay`).

## Symptoms
- Single audit line: `code: "billing.webhook.replay"` → alert fires immediately.
- May correlate with credential leakage incident.

## Quick diagnosis
```bash
# 1. Pull the event_id and provider from the audit line.
wrangler tail --env production --format pretty finsavvy-ai-gateway-production \
  | grep "billing.webhook.replay"

# 2. Source IP from CF logs for /webhooks/<provider>.

# 3. Check if event_id was previously processed (idempotency table in D1).
wrangler d1 execute finsavvy-ai-gateway-production \
  --command "SELECT * FROM webhook_events WHERE event_id='<EVENT_ID>'" --remote
```

## Mitigation
1. **Confirm legit-retry vs. attack:**
   - If event_id was already processed → benign duplicate, no action beyond
     monitoring.
   - If event_id is unknown AND timestamp is hours old → attack. Escalate
     to security on-call.
2. **Block source IP** at Cloudflare WAF if attack.
3. **Engage Security on-call** (`@slack-<SLACK_SECURITY>`).

## Root cause investigation
- Search for the same payload in audit log over the last 30 days.
- Check whether webhook endpoint URL was ever logged externally (e.g.,
  pasted into a chat, committed to a repo). Run secret-scan over recent
  commits.

## Rollback procedure
- No code rollback unless the replay-window check itself was recently
  changed:
  ```bash
  wrangler rollback <VERSION_ID> --env production --name finsavvy-ai-gateway-production
  ```
- Forward fix: if window was too generous, tighten via env:
  ```bash
  wrangler secret put FINSAVVY_BILLING_WEBHOOK_REPLAY_WINDOW_SECONDS --env production \
    --name finsavvy-ai-gateway-production
  # set to e.g. 300 (5 min)
  ```

## Verification
- No new `billing.webhook.replay` events for 1h.
- WAF block confirmed (curl from blocked IP returns 403).

## Post-incident
- SEV1 → postmortem mandatory.
- Open security ticket: rotate the webhook secret as precaution.
- Add IOC to threat intel doc.
