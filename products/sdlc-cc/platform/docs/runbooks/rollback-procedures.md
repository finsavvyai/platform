# Rollback Procedures

See also: [production-runbook.md](./production-runbook.md) (overview), [rto-rpo-drill-log.md](./rto-rpo-drill-log.md) (record drill results).

## Decision Framework

**Roll back if any of the following are true:**
- Error rate > 1% for 5+ minutes after deploy
- P95 latency > 2x baseline for 5+ minutes
- Any data integrity issue detected
- Security vulnerability introduced
- Customer-facing functionality broken

**Do NOT roll back if:**
- Only internal/non-critical features affected
- Issue is config-only (fix forward with config change)
- Rollback would cause more disruption than the issue

---

## Kubernetes Deployment Rollback

### Quick Rollback (< 2 min)

```bash
# View rollout history
kubectl -n sdlc-platform rollout history deployment/<service>

# Rollback to previous version
kubectl -n sdlc-platform rollout undo deployment/<service>

# Rollback to specific revision
kubectl -n sdlc-platform rollout undo deployment/<service> --to-revision=<N>

# Verify rollback
kubectl -n sdlc-platform rollout status deployment/<service>
kubectl -n sdlc-platform get pods -l component=<service>
```

### Services to roll back:

| Service | Deployment Name | Typical Rollback Time |
|---------|----------------|----------------------|
| Gateway | sdlc-gateway | ~30s |
| RAG | sdlc-rag | ~60s |
| API | sdlc-platform-api | ~30s |

---

## Helm Release Rollback

```bash
# List release history
helm -n sdlc-platform history sdlc-platform

# Rollback to previous release
helm -n sdlc-platform rollback sdlc-platform

# Rollback to specific revision
helm -n sdlc-platform rollback sdlc-platform <REVISION>

# Verify
helm -n sdlc-platform status sdlc-platform
kubectl -n sdlc-platform get pods
```

---

## Database Migration Rollback

**CRITICAL: Always test migration rollback in staging first.**

```bash
# Check current migration version
kubectl -n sdlc-platform exec -it deploy/sdlc-platform-api -- ./migrate version

# Roll back last migration
kubectl -n sdlc-platform exec -it deploy/sdlc-platform-api -- ./migrate down 1

# Roll back to specific version
kubectl -n sdlc-platform exec -it deploy/sdlc-platform-api -- ./migrate goto <VERSION>

# Verify schema
kubectl -n sdlc-platform exec -it deploy/sdlc-postgres -- psql -U sdlc -c "\dt"
```

**If migration is irreversible (data destructive):**
1. Restore database from backup (see disaster-recovery.md)
2. Apply migrations up to the target version
3. Redeploy application at matching code version

---

## Feature Flag Rollback

For issues isolated to a specific feature:

```bash
# Disable feature flag via Redis
kubectl -n sdlc-platform exec -it deploy/sdlc-redis -- redis-cli SET "ff:<flag-name>" '{"name":"<flag-name>","enabled":false}'

# Or via the admin API
curl -X PUT https://api.sdlc.cc/admin/feature-flags/<flag-name> \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": false}'
```

---

## Terraform / Infrastructure Rollback

```bash
# Check state
cd infra/terraform
terraform workspace select production
terraform plan

# Rollback to previous state (use with caution)
git log --oneline infra/terraform/ | head -5
git checkout <commit-hash> -- infra/terraform/
terraform plan
terraform apply
```

---

## Post-Rollback Checklist

- [ ] Verify all health checks pass
- [ ] Confirm error rate returned to baseline
- [ ] Confirm latency returned to baseline
- [ ] Check for data consistency issues
- [ ] Notify stakeholders via #incidents Slack channel
- [ ] Update status page
- [ ] Create post-mortem ticket with root cause analysis
- [ ] Tag the bad release in Git: `git tag -a bad-v<VERSION> -m "Rolled back: <reason>"`
