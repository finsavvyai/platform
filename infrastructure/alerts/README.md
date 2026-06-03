# `infrastructure/alerts/` — Alert rules + provider configs

Provider-agnostic alert definitions for FinsavvyAI, plus first-class
support for Datadog. Owned by the **ALERTING** agent per round-3
conventions (`/tmp/finsavvyai-prod-conventions.md`).

## Files

| File | Purpose |
|---|---|
| `rules.yaml` | **Source of truth.** Provider-agnostic alert definitions. |
| `datadog.json` | Generated mirror in Datadog Monitor JSON. Must match `rules.yaml`. |
| `README.md` | This file. |

Runbooks (one per alert) live in `docs/runbooks/`.

## Stable signals these alerts fire on

Three trigger types, all defined in `rules.yaml`:

1. **`synthetic`** — probe result emitted by SYNTHETICS agent
   (`infrastructure/synthetics/probes/`). Shape per contract §3:
   `{ probe, ok, latency_ms, ts, error? }`.
2. **`audit_code`** — stable error codes from packages:
   - `@finsavvyai/billing` (`packages/billing/src/errors.ts`):
     `billing.webhook.signature_invalid`, `billing.webhook.replay`,
     `billing.webhook.event_not_allowed`, `billing.entitlement.missing`,
     `billing.invoice.totals_mismatch`, `billing.invoice.line_item_invalid`,
     `billing.money.currency_mismatch`,
     `billing.orchestration.idempotency_key_required`,
     `billing.provider.error`.
   - `@finsavvyai/ai-gateway` (`packages/ai-gateway/src/errors.ts`):
     `AI_GATEWAY_NO_ROUTE`, `AI_GATEWAY_NON_RETRYABLE`,
     `AI_GATEWAY_RETRYABLE`, `AI_GATEWAY_EXHAUSTED`.
   - `@finsavvyai/policy-engine` (`packages/policy-engine/src/`):
     `policy.malformed`, `policy.missing_id`, `policy.rule.malformed`,
     `policy.statement.malformed`.
3. **`prom_expr`** — metrics emitted by OBSERVABILITY exporters
   (`infrastructure/observability/`). Metric naming follows
   `finsavvy.<service>.<signal>` and
   `finsavvy.audit.code.<dotted_code_with_underscores>`.

## Importing into Datadog

Prerequisites. Values come from the production secrets manager:

```bash
export DD_API_KEY=<from secrets manager>
export DD_APP_KEY=<from secrets manager>
export DD_SITE=datadoghq.com  # or datadoghq.eu
```

Bulk import via the Datadog Monitor API (one-shot):

```bash
jq -c '.monitors[]' infrastructure/alerts/datadog.json | while read -r mon; do
  curl -fsS -X POST "https://api.${DD_SITE}/api/v1/monitor" \
    -H "DD-API-KEY: ${DD_API_KEY}" \
    -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
    -H "Content-Type: application/json" \
    -d "${mon}" \
  | jq '{id, name}'
done
```

Subsequent runs should `PUT` to update existing monitors by name match —
prefer Terraform (`datadog_monitor` resource) once the foundation lands.

## Testing alerts without paging the on-call

Datadog supports per-monitor mute and "force-trigger via tag":

1. **Mute the monitor:** Datadog UI → Monitor → Mute → 30 min, reason
   "testing".
2. **Force the underlying metric** with a synthetic data point or a feature
   flag that emits the metric. Example for `GATEWAY_ERROR_RATE`:
   ```bash
   curl -X POST "https://api.${DD_SITE}/api/v1/series" \
     -H "DD-API-KEY: ${DD_API_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"series":[{"metric":"finsavvy.gateway.error_rate","points":[['"$(date +%s)"',0.02]],"tags":["env:production","testing:true"]}]}'
   ```
3. **Confirm the monitor evaluates to ALERT** in the Datadog UI history
   view (no actual pager fires because of the mute).
4. **Un-mute** when done.

For synthetic-based alerts, set `ok=false` in the probe via
`infrastructure/synthetics/run.mjs --probe <name> --inject-failure` (when
that flag lands) — same mute pattern.

## Adding a new alert

1. **Append to `rules.yaml`** following the field schema in the file
   header. ID must be `SCREAMING_SNAKE_CASE`.
2. **Create the runbook** at `docs/runbooks/<ID>.md` — copy structure of
   an existing one. Must include a rollback section.
3. **Add the Datadog mirror** to `datadog.json` with the same `id`,
   matching threshold, and a `message` field pointing at the runbook path.
4. **Wire metrics if needed:** if the trigger references a metric that
   OBSERVABILITY doesn't yet emit, file a handoff ticket; do not merge a
   rule with a metric that doesn't exist (it will silently never fire).
5. **PR review:** CODEOWNERS must include the on-call rotation lead.

## Sync guarantee

`rules.yaml` and `datadog.json` MUST stay in sync. CI check (owned by CI
agent) should fail if `id`, `severity`, or threshold differ between the
two files. Until that check lands, reviewer is responsible for parity.

## Channel Routing

`channels` values in `rules.yaml` are abstract. Mapping table:

| YAML channel | Datadog handle | Notes |
|---|---|---|
| `pagerduty` | Datadog PagerDuty integration service | PD service key is set in Datadog integration UI. |
| `slack-oncall` | On-call Slack channel | Slack workspace and channel are configured in Datadog. |
| `slack-security` | Private security Slack channel | Security incident channel. |
| `slack-status` | Internal status Slack channel | Customer-visible-impact updates. |
| `slack-finance` | Finance Slack channel | Cost/spend alerts. |

Do not commit real integration handles, service keys, or private channel
IDs. Configure them in the provider UI or secrets manager.
