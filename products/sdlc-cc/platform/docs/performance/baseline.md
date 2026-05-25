# Performance Baseline

Day 19 of the production-ready roadmap. This file gets updated by CI on
every nightly run; the table below is overwritten with fresh
measurements so downstream alerts always compare against the most
recent number.

## SLO targets

| Metric | Target | Budget |
| --- | --- | --- |
| RAG query p95 | <2s | 2.0 |
| RAG query p99 | <5s | 5.0 |
| Document upload p95 (50MB) | <30s | 30.0 |
| Document upload p99 (50MB) | <60s | 60.0 |
| Error rate (any path) | <0.1% | 0.001 |

If a CI run breaches any of these, the workflow fails and a
`perf-regression` issue is opened automatically.

## Most recent run

> **Status:** initial baseline pending. CI nightly run starts after this
> commit lands; the table below will be filled in at the next run.

| Scenario | VUs | Duration | p50 | p95 | p99 | err% | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RAG query | 100 | 5m | TBD | TBD | TBD | TBD | pending |
| RAG query | 1k | 5m | TBD | TBD | TBD | TBD | pending |
| RAG query | 10k | 5m | TBD | TBD | TBD | TBD | pending |
| Doc upload (1MB) | 50 | 5m | TBD | TBD | TBD | TBD | pending |
| Doc upload (50MB) | 25 | 5m | TBD | TBD | TBD | TBD | pending |

## How to run locally

```bash
# Install k6 once: brew install k6 (or grafana/k6 release)

# Single-scenario run against staging:
k6 run tests/load/rag-query.js \
  -e GATEWAY_URL=https://staging.sdlc.cc \
  -e API_KEY=$E2E_API_KEY \
  -e VUS=100 \
  -e DURATION=5m

# Full nightly sweep (all 5 scenarios, sequential):
bash tests/load/scale.sh staging
```

## How CI runs it

`.github/workflows/load-test.yml` runs the smaller `VUS=100, DURATION=2m`
profile on every PR that touches gateway/rag/document-processor code,
and the full sweep nightly.

The smaller PR profile is intended to catch a 10x regression
quickly; the full sweep is what we publish in this file.

## Interpreting results

- **p95 over budget**: the change being tested likely added a
  per-request work item; profile it.
- **Error rate >0.1%**: the gateway is dropping requests under load;
  check the rate-limiter config + Redis health.
- **p99 / p50 ratio > 5x**: long-tail problem; look at GC pauses
  or a single slow downstream.
