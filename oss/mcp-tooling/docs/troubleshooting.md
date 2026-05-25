# MCPOverflow Troubleshooting Guide

**Version**: 1.0

## 🚨 Emergency Contacts
- **DevOps On-Call**: devops@mcpoverflow.io
- **Security Team**: security@mcpoverflow.io

## 🔍 Initial Diagnosis

### 1. Check Service Status
```bash
docker-compose ps
```
If any state is `Exit` or `Restarting`, check logs immediately.

### 2. Check Logs
**API Service**:
```bash
docker-compose logs -f api --tail=100
```
**Worker Service**:
```bash
docker-compose logs -f worker --tail=100
```
**Database**:
```bash
docker-compose logs -f db --tail=100
```

### 3. Sentry Dashboard
Visit [sentry.io/mcpoverflow](https://sentry.io) to see real-time error aggregation. Look for:
- Spikes in `5xx` errors.
- New issues introduced in the latest release.

## 🛠 Common Issues & Fixes

### A. Database Connection Failures
**Symptoms**: API returns 500s, logs show "connection refused" or "password authentication failed".
**Fixes**:
1.  Ensure Postgres is running: `docker-compose up -d db`
2.  Verify credentials in `.env` match `POSTGRES_PASSWORD` in `docker-compose.yml`.
3.  Check connectivity:
    ```bash
    docker-compose exec api nc -zv db 5432
    ```

### B. Redis Rate Limiting Issues
**Symptoms**: Valid requests getting `429 Too Many Requests`.
**Fixes**:
1.  Check Redis health:
    ```bash
    docker-compose exec redis redis-cli ping
    # Should return PONG
    ```
2.  Clear Rate Limit Keys (Emergency Only):
    ```bash
    docker-compose exec redis redis-cli KEYS "ratelimit:*" | xargs redis-cli DEL
    ```

### C. Worker Failing to Process Jobs
**Symptoms**: Connectors stuck in "Generating" state.
**Fixes**:
1.  Restart the worker:
    ```bash
    docker-compose restart worker
    ```
2.  Check for poison messages (malformed jobs caused crash).

### D. "Panic" in Logs
**Symptoms**: Go application crashes with stack trace.
**Fixes**:
1.  Capture the stack trace.
2.  If critical loop, revert deployment.
3.  File high-priority bug with stack trace attached.

## 📊 Monitoring Dashboards

- **Grafana**: `http://localhost:3000` (default admin/admin)
  - **API Metrics Dashboard**: Latency, Request Rate, Error Rate.
  - **Infrastructure Dashboard**: CPU, RAM, Disk Usage.

## 🔄 Routine Maintenance

- **Disk Space**: Check `docker system df` regularly. Prune unused images: `docker system prune -a`.
- **Backups**: Verify backups exist in `postgres_backups` volume daily.
