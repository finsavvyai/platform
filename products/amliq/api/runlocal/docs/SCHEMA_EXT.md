# PushCI Extended Database Schema (PostgreSQL)

All PKs are `UUID DEFAULT gen_random_uuid()`. All timestamps are `TIMESTAMPTZ DEFAULT now()`.

## environments
`id` PK, `repo_id` UUID NOT NULL FK repositories CASCADE,
`name` VARCHAR(50) NOT NULL, `protection_rules` JSONB DEFAULT '{}',
`created_at` ts. UNIQUE(repo_id, name).

### protection_rules JSONB structure
```json
{ "required_reviewers": ["user-uuid-1"], "auto_deploy_branch": "main",
  "wait_timer_minutes": 15, "restrict_to_branches": ["main", "release/*"] }
```

## deployments
`id` PK, `env_id` UUID NOT NULL FK environments CASCADE,
`run_id` UUID NOT NULL FK pipeline_runs CASCADE,
`status` VARCHAR(20) NOT NULL DEFAULT 'pending',
`deployed_by` UUID NOT NULL FK users, `created_at` ts.
INDEX(env_id, created_at DESC).
Statuses: pending, in_progress, success, failure, rolled_back.

## notifications
`id` PK, `org_id` UUID NOT NULL FK organizations CASCADE,
`channel` VARCHAR(20) NOT NULL, `config_json` JSONB NOT NULL, `created_at` ts.
Channels: slack, discord, email, webhook.

### config_json examples
```json
{ "webhook_url": "https://hooks.slack.com/...", "channel": "#deploys",
  "events": ["run.failed", "deploy.success"] }
{ "recipients": ["team@co.dev"], "events": ["run.failed"] }
{ "url": "https://example.com/hook", "secret": "hmac-secret", "events": ["*"] }
```

## usage_events
`id` PK, `org_id` UUID NOT NULL FK organizations CASCADE,
`event_type` VARCHAR(30) NOT NULL, `runner_id` UUID FK runners SET NULL,
`duration_ms` INT, `created_at` ts. INDEX(org_id, created_at).
Event types: build_minute, artifact_storage, api_call.

## billing
`id` PK, `org_id` UUID NOT NULL UNIQUE FK organizations CASCADE,
`stripe_customer_id` VARCHAR(100) NOT NULL UNIQUE,
`plan` VARCHAR(20) NOT NULL DEFAULT 'free',
`status` VARCHAR(20) NOT NULL DEFAULT 'active',
`current_period_end` TIMESTAMPTZ NOT NULL.
Statuses: active, past_due, cancelled, trialing.

## Indexes

| Table | Index | Columns |
|-------|-------|---------|
| pipeline_runs | idx_runs_repo_status | (repo_id, status) |
| pipeline_runs | idx_runs_started | (started_at DESC) |
| jobs | idx_jobs_run | (run_id) |
| jobs | idx_jobs_runner | (runner_id) WHERE status = 'running' |
| steps | idx_steps_job | (job_id) |
| runners | idx_runners_org_status | (org_id, status) |
| usage_events | idx_usage_org_month | (org_id, date_trunc('month', created_at)) |
| audit_logs | idx_audit_action | (action, created_at DESC) |
| deployments | idx_deploy_env | (env_id, created_at DESC) |
| artifacts | idx_artifacts_run | (run_id) |
| secrets | idx_secrets_org | (org_id) |

## Partitioning

`usage_events` and `audit_logs`: range-partitioned by `created_at` (monthly).

## Notes
- JSONB columns get GIN indexes when queried by key.
- `encrypted_value` uses AES-256-GCM; key from env var.
- `billing.plan` must match `organizations.plan` (app-layer enforced).
- No soft deletes; audit_logs provide history.
