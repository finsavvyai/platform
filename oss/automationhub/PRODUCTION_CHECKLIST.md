# Production Readiness Checklist

Use this checklist to ensure your UPM.Plus deployment is production-ready.

**Single source of status:** See [PRODUCTION_STATUS.md](PRODUCTION_STATUS.md).

---

## Quick path to production (must-dos)

Before first production deploy:

1. **Run verification script:** `./scripts/verify-production-ready.sh`  
   For production env: `PRODUCTION=1 ./scripts/verify-production-ready.sh`
2. **Set required env:** `SECRET_KEY` (≥32 chars, no "dev"/"test"), `DEBUG=false`, `ENVIRONMENT=production`, `PRODUCTION=true`, `DATABASE_URL` (PostgreSQL).
3. **Migrations:** `cd backend && alembic upgrade head`
4. **Health:** Ensure `/health` or `/api/v1/health` returns 200 behind SSL.
5. **Optional:** `./scripts/test-cloudflare-production.sh https://upm.plus` for gateway smoke.

Then work through the sections below as needed.

---

## Security ✅

- [ ] **SECRET_KEY** is set and at least 32 characters long
- [ ] **SECRET_KEY** does not contain "dev" or "test"
- [ ] **MFA_ENCRYPTION_KEY** is set
- [ ] **DEBUG=false** in production
- [ ] **ENVIRONMENT=production** is set
- [ ] **PRODUCTION=true** is set
- [ ] Database uses strong password
- [ ] Redis uses password authentication
- [ ] **ALLOWED_ORIGINS** is configured (no wildcards)
- [ ] **ALLOWED_HOSTS** is configured
- [ ] SSL/TLS certificates are configured
- [ ] HTTPS is enforced
- [ ] Security headers are enabled
- [ ] Rate limiting is configured
- [ ] CORS is properly restricted
- [ ] No default credentials in code
- [ ] Secrets are stored securely (not in code)
- [ ] API keys are rotated regularly

## Configuration ✅

- [ ] All required environment variables are set
- [ ] Database connection string is correct
- [ ] Redis connection string is correct
- [ ] Celery broker URL is correct
- [ ] Vector database (ChromaDB) is accessible
- [ ] File upload directory has proper permissions
- [ ] Log directory has proper permissions
- [ ] Timezone is configured correctly
- [ ] Locale settings are correct

## Database ✅

- [ ] PostgreSQL 15+ is running
- [ ] Database migrations are up to date
- [ ] Database backups are configured
- [ ] Connection pooling is configured
- [ ] Database indexes are optimized
- [ ] Foreign key constraints are in place
- [ ] Database user has minimal required permissions

## Infrastructure ✅

- [ ] Docker images are built and tagged
- [ ] Docker Compose production file is configured
- [ ] Health checks are configured for all services
- [ ] Resource limits are set (CPU, memory)
- [ ] Restart policies are configured
- [ ] Network isolation is configured
- [ ] Volumes are properly mounted
- [ ] Log rotation is configured

## Monitoring & Observability ✅

- [ ] Prometheus is configured and scraping metrics
- [ ] Grafana dashboards are set up
- [ ] Health check endpoint is accessible
- [ ] Logging is configured (structured logs)
- [ ] Error tracking (Sentry) is configured
- [ ] Alerting rules are configured
- [ ] Uptime monitoring is set up
- [ ] Performance metrics are being collected

## Application ✅

- [ ] All services start successfully
- [ ] Health checks pass
- [ ] API endpoints are accessible
- [ ] Authentication works
- [ ] Authorization (RBAC) works
- [ ] Task queue (Celery) is processing jobs
- [ ] Scheduled tasks (Celery Beat) are running
- [ ] WebSocket connections work
- [ ] File uploads work
- [ ] Database queries are optimized

## Testing ✅

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] End-to-end tests pass
- [ ] Load tests are performed
- [ ] Security tests are performed
- [ ] Backup/restore tests are performed
- [ ] Disaster recovery plan is tested

## Documentation ✅

- [ ] API documentation is up to date
- [ ] Deployment guide is complete
- [ ] Runbook is available
- [ ] Troubleshooting guide exists
- [ ] Architecture diagram is available
- [ ] Incident response plan exists

## Backup & Recovery ✅

- [ ] Database backup strategy is implemented
- [ ] Backup restoration is tested
- [ ] Backup retention policy is defined
- [ ] Disaster recovery plan exists
- [ ] Recovery time objective (RTO) is defined
- [ ] Recovery point objective (RPO) is defined

## Performance ✅

- [ ] Response times meet SLA requirements
- [ ] Database queries are optimized
- [ ] Caching strategy is implemented
- [ ] CDN is configured (if applicable)
- [ ] Load balancing is configured (if applicable)
- [ ] Auto-scaling is configured (if applicable)

## Compliance ✅

- [ ] GDPR compliance (if applicable)
- [ ] Data retention policies are defined
- [ ] Audit logging is enabled
- [ ] Data encryption at rest
- [ ] Data encryption in transit
- [ ] Access controls are enforced
- [ ] Privacy policy is available

## Deployment ✅

- [ ] CI/CD pipeline is configured
- [ ] Automated testing in CI/CD
- [ ] Deployment process is documented
- [ ] Rollback procedure is documented
- [ ] Blue-green deployment is configured (optional)
- [ ] Canary deployment is configured (optional)

## Post-Deployment ✅

- [ ] Smoke tests pass after deployment
- [ ] Monitoring shows healthy status
- [ ] No errors in logs
- [ ] Performance metrics are normal
- [ ] All services are running
- [ ] Database connections are stable
- [ ] Redis connections are stable

## Maintenance ✅

- [ ] Update procedure is documented
- [ ] Maintenance window is scheduled
- [ ] Dependency update process exists
- [ ] Security patch process exists
- [ ] Performance tuning process exists

---

## Quick Verification Commands

```bash
# Check all services are running
docker-compose -f docker-compose.prod.yml ps

# Check health
curl http://localhost:8000/health

# Check logs for errors
docker-compose -f docker-compose.prod.yml logs --tail=100 | grep ERROR

# Verify database connectivity
docker-compose -f docker-compose.prod.yml exec backend python -c "from app.core.database import get_db_session; import asyncio; asyncio.run(get_db_session())"

# Check Redis connectivity
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping

# Verify migrations are up to date
docker-compose -f docker-compose.prod.yml exec backend alembic current

# Check resource usage
docker stats
```

---

**Last Updated:** 2025-01-27  
**Version:** 1.0.0

