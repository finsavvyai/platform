# Disaster Recovery Runbook

## Recovery Objectives

| Metric | Target | Notes |
|--------|--------|-------|
| **RPO** (Recovery Point Objective) | 1 hour | Maximum data loss window |
| **RTO** (Recovery Time Objective) | 4 hours | Maximum downtime |
| **MTTR** (Mean Time to Recovery) | < 2 hours | Average recovery time |

## Backup Strategy

### PostgreSQL

**Automated backups:**
- Continuous WAL archiving to S3 (every 60s)
- Daily full backup at 02:00 UTC
- Retention: 30 days for daily, 90 days for weekly
- Cross-region replication to us-east-1

**Verify backups (run weekly):**
```bash
# List available backups
aws s3 ls s3://sdlc-backups/postgres/daily/ --recursive | tail -5

# Test restore to staging
pg_restore --dbname=sdlc_staging --clean --if-exists \
  <(aws s3 cp s3://sdlc-backups/postgres/daily/latest.dump -)

# Validate row counts
psql -U sdlc sdlc_staging -c "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 10;"
```

### Redis

- RDB snapshots every 15 minutes
- AOF persistence enabled (appendfsync everysec)
- Snapshots replicated to S3

### Application State

- All config stored in version control (Git)
- Secrets in HashiCorp Vault (auto-replicated)
- Terraform state in S3 with DynamoDB locking

---

## Recovery Procedures

### Scenario 1: Single Service Failure

**Impact:** One microservice is down, others functional.

```bash
# 1. Identify failed service
kubectl -n sdlc-platform get pods | grep -v Running

# 2. Check events
kubectl -n sdlc-platform describe pod <pod-name>

# 3. Restart the deployment
kubectl -n sdlc-platform rollout restart deployment/<service-name>

# 4. Verify recovery
kubectl -n sdlc-platform rollout status deployment/<service-name>
```

### Scenario 2: Database Corruption / Loss

**Impact:** Data unavailable or corrupted.

```bash
# 1. Stop all write traffic
kubectl -n sdlc-platform scale deployment/sdlc-gateway --replicas=0

# 2. Identify latest clean backup
aws s3 ls s3://sdlc-backups/postgres/daily/ | sort | tail -5

# 3. Restore from backup
kubectl -n sdlc-platform exec -it deploy/sdlc-postgres -- bash -c '
  pg_restore --dbname=sdlc --clean --if-exists /tmp/backup.dump
'

# 4. Apply WAL logs to minimize data loss
kubectl -n sdlc-platform exec -it deploy/sdlc-postgres -- bash -c '
  pg_wal_replay --target-time="2026-02-06T23:00:00Z"
'

# 5. Verify data integrity
kubectl -n sdlc-platform exec -it deploy/sdlc-postgres -- psql -U sdlc -c "
  SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;
"

# 6. Resume traffic
kubectl -n sdlc-platform scale deployment/sdlc-gateway --replicas=3
```

### Scenario 3: Complete Cluster Failure

**Impact:** Entire Kubernetes cluster is unavailable.

```bash
# 1. Provision new cluster via Terraform
cd infra/terraform
terraform workspace select production
terraform apply -target=module.eks

# 2. Restore cluster state
kubectl apply -f infra/k8s/namespaces/
kubectl apply -f infra/k8s/configmaps/
kubectl apply -f infra/k8s/policies/

# 3. Deploy via Helm
helm upgrade --install sdlc-platform infra/helm/sdlc-platform/ \
  -n sdlc-platform \
  -f infra/helm/sdlc-platform/values.yaml \
  --set global.environment=production

# 4. Restore database from backup (see Scenario 2)

# 5. Restore Redis from snapshot
kubectl -n sdlc-platform exec -it deploy/sdlc-redis -- redis-cli \
  --rdb /data/dump.rdb

# 6. Update DNS if cluster endpoint changed
# Update Cloudflare DNS via Terraform or API

# 7. Verify all services
kubectl -n sdlc-platform get pods
curl -s https://api.sdlc.cc/healthz
```

### Scenario 4: Region Failure (AWS us-west-1)

**Impact:** Entire region unavailable.

```bash
# 1. Activate DR region (us-east-1)
cd infra/terraform
terraform workspace select dr-us-east-1
terraform apply

# 2. Promote read replica to primary
aws rds promote-read-replica --db-instance-identifier sdlc-dr-replica

# 3. Update DNS failover
# Cloudflare automatically fails over if health checks are configured
# Manual override if needed:
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{record_id}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -d '{"content": "<dr-region-ip>"}'

# 4. Verify DR services
curl -s https://api.sdlc.cc/healthz
```

---

## DR Testing Schedule

| Test | Frequency | Last Tested | Owner |
|------|-----------|-------------|-------|
| Backup restore validation | Weekly | - | Platform team |
| Single service failover | Monthly | - | On-call engineer |
| Database failover | Quarterly | - | DBA + Platform team |
| Full DR failover | Semi-annually | - | All engineering |

## Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-call engineer | PagerDuty rotation | Auto-escalates after 10 min |
| Platform team lead | #platform-team Slack | During business hours |
| AWS support | Enterprise support case | SEV1: phone call |
| Cloudflare support | Enterprise dashboard | SEV1: phone + email |
