# Runner Communication Protocol

Runners are long-lived agents that poll the PushCI server for jobs.
All communication is HTTP/JSON over TLS. Runners authenticate via bearer tokens.

## Registration

```
POST /runners/register
Body: { "name": "my-runner", "labels": ["node","linux"], "os": "linux", "arch": "amd64" }
Response: { "token": "rtkn_abc123", "runner_id": "run_456" }
```

Token stored locally in `~/.pushci/runner.json`. Re-registration reuses `runner_id`.

## Authentication

All requests include: `Authorization: Bearer rtkn_abc123`.
Tokens are org-scoped, 24h TTL, auto-refreshed on heartbeat response.

## Heartbeat

```
POST /runners/:id/heartbeat  (every 30 seconds)
Body: { "status": "idle|busy", "cpu": 42.5, "memory": 68.1, "jobs_running": 2 }
Response: { "ok": true, "token_refresh": "rtkn_new..." }
```

No heartbeat for 60s marks runner offline. After 5min, jobs are re-queued.

## Job Claiming

```
GET /runners/:id/next-job
Response (job): { "job_id": "j_789", "repo": "org/app", "sha": "abc123",
                  "steps": [...], "secrets": {...}, "env": {...} }
Response (none): { "job_id": null }
Response (cancel): { "cancel": "j_789" }
```

Runners poll every 2s. Long-polling supported (30s timeout).

## Job Lifecycle

```
PATCH /jobs/:id
Body: { "status": "running" }   -- job started
Body: { "status": "passed" }    -- all steps succeeded
Body: { "status": "failed", "error": "step 3 exit code 1" }
```

Valid transitions: `queued -> running -> passed|failed|cancelled`.

## Log Streaming

```
POST /jobs/:id/logs
Body: chunked text, 4KB batches
Headers: X-Step-Index: 2, X-Stream-Offset: 8192
```

Logs are append-only. Server stores and streams to dashboard in real time.

## Artifact Upload

```
POST /jobs/:id/artifacts  (multipart/form-data)
Fields: file (binary), name (string), path (string)
Max: 100MB per artifact, 500MB per job.
```

## Cancellation

Runner detects cancellation via `next-job` poll returning `{ "cancel": "j_789" }`.
Runner sends SIGTERM, waits 10s, then SIGKILL. Reports `{ "status": "cancelled" }`.

## Crash Recovery

| Scenario | Recovery |
|----------|----------|
| Runner crashes mid-job | Job re-queued after 5min heartbeat timeout |
| Server unreachable | Runner retries with exponential backoff (2s-60s) |
| Runner restarts | Re-registers on startup, claims pending jobs |
| Network partition | Heartbeat failure triggers job re-queue |

## Error Codes

| Code | Meaning |
|------|---------|
| 401 | Invalid or expired token |
| 404 | Runner or job not found |
| 409 | Job already claimed by another runner |
| 429 | Rate limited (too many polls) |
| 503 | Server overloaded, retry later |