# PipeWarden Air-Gap Install Runbook

For regulated deployments (HIPAA, HITRUST, FedRAMP, DOD IL4+) with **no outbound internet** from the cluster running PipeWarden.

Target: Kubernetes 1.26+ in a VPC with only internal egress. Expected time: **half a day for infra team + half a day for pipewarden bring-up**.

---

## Prereqs

- [ ] Kubernetes 1.26+ cluster inside your VPC (EKS private, GKE private, self-managed, OpenShift)
- [ ] Internal container registry (ECR / GCR / Harbor / Nexus)
- [ ] HSM-backed or KMS-backed Secret store (AWS KMS, Azure Key Vault, HashiCorp Vault, or native K8s Secrets with etcd encryption)
- [ ] Internal PostgreSQL 15+ or managed equivalent (RDS in private subnet)
- [ ] Internal SIEM endpoint reachable from cluster (Splunk HEC, Elasticsearch, Datadog agent)
- [ ] Helm 3.14+ and `kubectl` with cluster-admin rights
- [ ] Offline LLM host: either in-cluster (Ollama pod, GPU node) or adjacent VM with http:// reachable from cluster

---

## Step 1 — Mirror images into your private registry

```bash
# From a jump host with both internet + registry access:

IMAGES=(
  "ghcr.io/finsavvyai/pipewarden:1.0.0"
  "ghcr.io/finsavvyai/pipewarden-cli:1.0.0"
  "ollama/ollama:0.3.12"                # if running Ollama in-cluster
  "ghcr.io/finsavvyai/pipewarden-llm-cache:llama3.1-8b"   # optional prebuilt model layer
)

for img in "${IMAGES[@]}"; do
  docker pull "$img"
  new="your-registry.internal/$(basename "$(dirname "$img")")/$(basename "$img")"
  docker tag "$img" "$new"
  docker push "$new"
done
```

**Verify cosign signatures before mirror** — do not transfer unsigned images:

```bash
cosign verify --certificate-identity-regexp 'https://github.com/finsavvyai/.*' \
              --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' \
              ghcr.io/finsavvyai/pipewarden:1.0.0
```

## Step 2 — Seed the offline LLM

Pick one:

### 2a. Ollama in-cluster on a GPU node

```bash
kubectl create namespace ollama
helm install ollama ollama-helm/ollama \
  --namespace ollama \
  --set image.repository=your-registry.internal/ollama \
  --set persistence.enabled=true \
  --set resources.limits."nvidia\.com/gpu"=1
# Preload model from a cached image or CSI-mounted volume:
kubectl exec -n ollama deploy/ollama -- ollama pull llama3.1:8b
```

### 2b. LLamaFile on adjacent VM

```bash
# On VM with 16GB+ RAM, airgapped
scp llama-3.1-8b.llamafile user@vm:/opt/
chmod +x /opt/llama-3.1-8b.llamafile
/opt/llama-3.1-8b.llamafile --server --port 8081 --host 0.0.0.0
# Ensure cluster can reach the VM on port 8081
```

## Step 3 — Create vault-key Secret

```bash
# Option A: auto-generate via Helm (simplest)
# — skip this step, let Helm generate in Step 5.

# Option B: external KMS (production recommended)
VAULT_KEY=$(aws kms generate-random --number-of-bytes 32 --query Plaintext --output text)
kubectl create secret generic pipewarden-vault \
  --from-literal=vault-key="$VAULT_KEY" \
  -n pipewarden
```

## Step 4 — Create provider secret bundles

```bash
kubectl create namespace pipewarden

# GitHub App (if used)
kubectl -n pipewarden create secret generic pipewarden-github-app \
  --from-literal=app-id=... \
  --from-literal=client-id=... \
  --from-literal=client-secret=... \
  --from-literal=webhook-secret=... \
  --from-file=private-key=./github-app.pem

# Postgres password
kubectl -n pipewarden create secret generic pipewarden-db \
  --from-literal=password=...
```

## Step 5 — Install PipeWarden Helm chart

```bash
cat > airgap-values.yaml <<'EOF'
image:
  repository: your-registry.internal/finsavvyai/pipewarden
  tag: "1.0.0"

airGap:
  enabled: true
  offlineLLM:
    provider: ollama
    endpoint: "http://ollama.ollama:11434"
    model: "llama3.1:8b"

vault:
  existingSecret: "pipewarden-vault"

database:
  driver: postgres
  postgres:
    host: "pg-primary.rds.internal"
    port: 5432
    database: pipewarden
    user: pipewarden
    existingSecret: "pipewarden-db"

github:
  appEnabled: true
  existingSecret: "pipewarden-github-app"

networkPolicy:
  enabled: true
  allowedNamespaces:
    - "ci"
    - "ollama"

resources:
  limits:
    cpu: 2000m
    memory: 2Gi

persistence:
  enabled: true
  size: 50Gi
  storageClass: "gp3-encrypted"

claude:
  enabled: false         # AIR-GAP: no Anthropic API call
EOF

helm install pipewarden ./deploy/helm/pipewarden \
  --namespace pipewarden \
  --values airgap-values.yaml
```

## Step 6 — Verify air-gap enforcement

```bash
# 1. Confirm pod cannot reach claude.ai (should timeout)
kubectl exec -n pipewarden deploy/pipewarden -- \
  wget --timeout=5 -qO- https://api.anthropic.com/v1/messages || echo "air-gap: OK, egress blocked"

# 2. Confirm offline LLM reachable
kubectl exec -n pipewarden deploy/pipewarden -- \
  wget --timeout=5 -qO- http://ollama.ollama:11434/api/tags | head -c 200

# 3. Confirm health + readiness
kubectl port-forward -n pipewarden svc/pipewarden 8080:8080 &
curl http://localhost:8080/health
curl http://localhost:8080/readiness
```

## Step 7 — Smoke test: scan one repo

```bash
curl -X POST http://localhost:8080/api/v1/analysis/quick \
  -H 'Content-Type: application/json' \
  -d '{"platform":"github","repo":"org/test-repo","use_ai":true}'

# Check audit log emitted an event
curl http://localhost:8080/api/v1/audit?limit=5
```

## Step 8 — Wire SIEM

```bash
# Configure audit webhook → Splunk HEC
curl -X POST http://localhost:8080/api/v1/webhooks/configure \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://splunk.internal:8088/services/collector",
    "secret": "hmac-secret-here",
    "format": "cef"
  }'
```

## Step 9 — Enable scheduled scans

```bash
# Create a CronJob that calls PipeWarden's scan API daily
# See deploy/kubernetes/cronjob-daily-scan.yaml (example)
```

---

## Verification checklist (for your auditor)

- [ ] Container images cosign-verified before mirror (Step 1)
- [ ] SBOM downloaded + archived alongside image (release asset)
- [ ] No outbound internet from `pipewarden` namespace (NetworkPolicy enforces)
- [ ] Vault key is KMS-derived (not static, not in Git)
- [ ] Database uses TLS + at-rest encryption
- [ ] Audit events flowing to SIEM (Step 8)
- [ ] Offline LLM benchmark run against your finding corpus (`docs/benchmarks/offline-llm.md`)
- [ ] Quarterly review cadence established

## Incident playbook

### Offline LLM down
- Fallback: scans continue with heuristic + DLP + OPA (no AI severity boost)
- No data leaves cluster
- Page the ML/platform on-call per your runbook

### Vault key lost
- All encrypted provider credentials become unreadable
- Recover from KMS backup if available; otherwise re-onboard each connection
- This is why the Helm Secret has `helm.sh/resource-policy: keep`

### PipeWarden CVE disclosed
- Subscribe to `github.com/finsavvyai/pipewarden/security/advisories`
- Patch via Helm upgrade: `helm upgrade pipewarden ./deploy/helm/pipewarden -n pipewarden --values airgap-values.yaml`
- Verify signature of new image before upgrade
