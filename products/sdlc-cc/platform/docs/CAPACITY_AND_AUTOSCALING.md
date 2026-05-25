# Capacity and Autoscaling

Reference for load test baselines, capacity thresholds, and HPA triggers. See [PRODUCTION_READINESS_DAYS_5-10.md](./PRODUCTION_READINESS_DAYS_5-10.md) Day 8.

---

## Load test baseline

- **Workflow:** [.github/workflows/load-test.yml](../.github/workflows/load-test.yml) runs k6 (manual + weekly).
- **Script:** [tests/load/k6-gateway.js](../tests/load/k6-gateway.js) — steady-state, spike, soak scenarios.
- **SLA in script:** p95 &lt; 500ms, p99 &lt; 1s, error rate &lt; 1%.

**How to capture a baseline:**

1. Run "Load Test (k6)" workflow with target URL (e.g. staging or production).
2. Download artifact `k6-load-results.json` and/or read the job summary.
3. Record in this section (or in a spreadsheet): date, target URL, RPS, p95/p99 latency, error rate, any threshold breaches.

### Capacity thresholds (fill from k6 runs)

| Service   | Max RPS (before degradation) | p95 at max | Notes |
|-----------|------------------------------|------------|--------|
| Gateway   | _TBD from k6_                | _TBD_      |  |
| RAG       | _TBD_                        | _TBD_      |  |

---

## Autoscaling triggers

HPA is defined in:

- [infra/k8s/hpa/gateway-hpa.yaml](../infra/k8s/hpa/gateway-hpa.yaml) — raw K8s
- [infra/helm/sdlc-platform/templates/hpa.yaml](../infra/helm/sdlc-platform/templates/hpa.yaml) — Helm (values in [values.yaml](../infra/helm/sdlc-platform/values.yaml))

### Gateway

| Setting     | Value  | Notes |
|------------|--------|--------|
| Min replicas | 3   |  |
| Max replicas | 20  |  |
| Scale-up trigger | CPU 70%, memory 80%, or 1000 RPS/pod (if custom metric present) |  |
| Scale-down     | 300s stabilization, 1 pod / 120s |  |

### RAG

| Setting     | Value  | Notes |
|------------|--------|--------|
| Min replicas | 2   |  |
| Max replicas | 15  |  |
| Scale-up trigger | CPU 65%, memory 75% |  |
| Scale-down     | 300s stabilization, 1 pod / 180s |  |

**Tuning from load test:** If k6 shows latency rising at a given RPS, lower the CPU/memory target (e.g. 60%) so HPA scales earlier, or increase min replicas.

---

*Last updated: 2026-03-06. Update capacity thresholds after each k6 baseline run.*
