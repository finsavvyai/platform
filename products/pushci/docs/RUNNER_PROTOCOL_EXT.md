# Runner Protocol — Advanced Features

## Label Matching

Jobs declare required labels. The scheduler finds a runner whose labels are a superset.

```yaml
jobs:
  test:
    runs-on: [node, linux, gpu]  # runner must have ALL three labels
```

Exact set intersection. No wildcards. No match within 10min fails the job.

## Concurrency Control

Runners report `max_concurrent` during registration.

```json
POST /runners/register
{ "name": "build-01", "labels": ["linux"], "max_concurrent": 4 }
```

The `heartbeat.jobs_running` field lets the server reconcile actual vs expected.

## Secure Job Payload

Every job payload is signed with HMAC-SHA256 using the runner token as key.

```
X-Job-Signature: sha256=abc123def456...
```

Runner flow: receive raw bytes, compute HMAC, constant-time compare with header.
Reject and report to server on mismatch.

## Secret Injection

Secrets are delivered per-job inside the encrypted payload:
- Decrypted in-memory only, injected as environment variables
- Never written to disk, scrubbed after job completes
- Masked in log output (replaced with `***`)

```json
"secrets": { "NPM_TOKEN": "encrypted:base64...", "AWS_KEY": "encrypted:base64..." }
```

Encryption: AES-256-GCM with per-job ephemeral key, wrapped by runner public key.

## Runner Groups

Organizations create named runner pools for workload isolation.

```
POST /orgs/:id/runner-groups
{ "name": "production", "runner_ids": ["run_1", "run_2"] }
```

Jobs target a group: `runs-on: { group: production, labels: [linux] }`.

| Role | Capabilities |
|------|-------------|
| Admin | Create/delete groups, assign runners |
| Maintainer | Add/remove runners from groups |
| Developer | View group status |

## Auto-Scaling (Future)

Webhook-based scaling for cloud runners:

```
POST /webhooks/scale
{ "event": "queue_depth", "depth": 15, "labels": ["linux"] }
```

Planned integrations: AWS ASG, GCP MIG, Kubernetes HPA, custom webhook.
Scale-down: no jobs for 10min triggers termination candidacy.
Drain mode: runner finishes current jobs, then shuts down gracefully.

## Runner Diagnostics

```
GET /runners/:id/diagnostics
Response: { "uptime": 86400, "jobs_completed": 142, "jobs_failed": 3,
            "avg_job_duration": 45.2, "disk_free": "12GB" }
```

Diagnostics collected from heartbeats. Stored for 30 days.