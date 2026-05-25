# FinSavvyAI Deployment Runbook

## Pre-Deployment Checklist

- [ ] All tests pass: `pytest --maxfail=1 --cov=src --cov-fail-under=95`
- [ ] Security scan clean: `python3 scripts/security_scan.py`
- [ ] Dependency audit: `pip-audit` and `npm audit --audit-level=high`
- [ ] No files exceed 200 lines: `find src -name '*.py' -print0 | xargs -0 wc -l | sort -nr`
- [ ] CHANGELOG.md updated with version entry
- [ ] `.env.example` reflects any new environment variables
- [ ] Database/state backup taken (if applicable)
- [ ] Rollback plan confirmed with on-call engineer

---

## Docker Compose Deployment

### 1. Prepare Environment

```bash
cp .env.example .env
# Edit .env with production values:
#   API_KEY, CORS_ORIGIN, GRAFANA_PASSWORD, CHANNELS_WEBHOOK_SECRET
chmod 600 .env
```

### 2. Pull and Deploy

```bash
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
```

### 3. Verify

```bash
curl -s http://localhost:8080/health | jq .
curl -s http://localhost:8000/health | jq .
curl -s http://localhost:8001/health | jq .
```

### 4. Scale Workers

```bash
docker compose -f docker-compose.production.yml up -d --scale worker=3
```

---

## Kubernetes / Helm Deployment

### 1. Create Namespace and Secrets

```bash
kubectl create namespace finsavvyai
kubectl create secret generic finsavvyai-secrets \
  --namespace finsavvyai \
  --from-literal=openai-api-key="$OPENAI_API_KEY" \
  --from-literal=anthropic-api-key="$ANTHROPIC_API_KEY" \
  --from-literal=finsavvyai-api-key="$FINSAVVYAI_API_KEY"
```

### 2. Install with Production Values

```bash
helm install finsavvyai ./helm/finsavvyai \
  -n finsavvyai \
  -f helm/finsavvyai/values-production.yaml \
  --set secrets.openaiApiKey="$OPENAI_API_KEY" \
  --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY"
```

### 3. Verify Rollout

```bash
kubectl rollout status deployment/finsavvyai-gateway -n finsavvyai
kubectl rollout status deployment/finsavvyai-worker -n finsavvyai
kubectl get pods -n finsavvyai
```

### 4. Upgrade Existing Deployment

```bash
helm upgrade finsavvyai ./helm/finsavvyai \
  -n finsavvyai \
  -f helm/finsavvyai/values-production.yaml \
  --set image.tag="v1.2.3"
```

---

## Railway Deployment

### 1. Link Project

```bash
railway link
railway env set API_KEY="$API_KEY"
railway env set FINSAVVYAI_AUTH_ENABLED=true
```

### 2. Deploy

```bash
railway up --detach
```

### 3. Verify

```bash
railway logs --tail 50
curl -s "$(railway domain)/health" | jq .
```

---

## Rollback Procedures

### Docker Compose Rollback

```bash
# Roll back to previous image
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml pull  # with previous tag in .env
docker compose -f docker-compose.production.yml up -d
```

### Helm Rollback

```bash
# List release history
helm history finsavvyai -n finsavvyai

# Rollback to previous revision
helm rollback finsavvyai <REVISION> -n finsavvyai

# Verify rollback
kubectl rollout status deployment/finsavvyai-gateway -n finsavvyai
```

### Railway Rollback

```bash
railway rollback
```

---

## Post-Deployment Verification

Run these checks after every deployment:

```bash
# 1. Health endpoints
curl -sf http://localhost:8080/health | jq '.status'
curl -sf http://localhost:8000/health | jq '.status'

# 2. API smoke test
curl -sf http://localhost:8080/v1/models \
  -H "Authorization: Bearer $API_KEY" | jq '.data | length'

# 3. Chat completions smoke test
curl -sf http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"default","messages":[{"role":"user","content":"ping"}]}' \
  | jq '.choices[0].message.content'

# 4. Grafana dashboards loading
curl -sf http://localhost:3000/api/health | jq .

# 5. Prometheus targets up
curl -sf http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'
```

---

## Troubleshooting

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| Gateway 502/503 | `docker logs finsavvyai-gateway --tail 100` | Restart: `docker compose restart gateway` |
| High latency P95>2s | Check Grafana SLO dashboard, `docker stats` | Scale: `docker compose up -d --scale worker=3` |
| Worker not joining | `docker logs finsavvyai-worker --tail 100` | Check master reachable, restart worker |
| Alerts not sending | `amtool check-config /etc/alertmanager/alertmanager.yml` | Check `curl localhost:9093/api/v2/alerts` |
| OOMKilled pods | `kubectl describe pod <name> -n finsavvyai` | Increase memory in `values-production.yaml`, redeploy |

---

## Related Documentation

- SLOs/SLAs: `docs/SLOS_SLAS.md`
- Incident response: `docs/INCIDENT_RESPONSE.md`
- Alert rules: `observability/alertmanager/alert-rules.yaml`
- SLO dashboard: `observability/grafana/slo-dashboard.json`
- Helm values: `helm/finsavvyai/values-production.yaml`
