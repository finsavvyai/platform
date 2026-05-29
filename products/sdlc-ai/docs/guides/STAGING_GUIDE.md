# SDLC Staging Environment - Quick Start Guide

## 🚀 What is This?

This staging environment is a complete, production-like setup of the SDLC platform running locally via Docker. It includes all services and infrastructure needed for comprehensive E2E testing.

## 📋 Prerequisites

- Docker Desktop installed and running
- At least 8GB RAM available for Docker
- Ports 3000, 5434, 6381, 8080, 8181, 9000, 9090, 9092, 16686 available

## 🎯 Quick Start

### 1. Start the Staging Environment

```bash
cd /Users/shaharsolomon/dev/projects/03_Enterprize_application/SDLC

# Start all services
docker-compose -f docker-compose.staging.yml up -d

# Check status
docker-compose -f docker-compose.staging.yml ps

# View logs
docker-compose -f docker-compose.staging.yml logs -f
```

### 2. Wait for Services to be Healthy

```bash
# Check health (wait until all services show "healthy")
docker-compose -f docker-compose.staging.yml ps

# Expected output:
# - postgres: Up (healthy)
# - redis: Up (healthy)
# - kafka: Up
# - gateway: Up (healthy)
# - rag: Up (healthy)
# - vector: Up (healthy)
# - admin: Up
```

### 3. Run E2E Tests

```bash
cd tests

# Run all tests against staging
npx playwright test --reporter=list

# Run only smoke tests
npx playwright test tests/smoke/basic.spec.ts --reporter=list

# Run with UI
npx playwright test --ui
```

## 🔧 Available Services

| Service | URL | Purpose |
|---------|-----|---------|
| **Admin UI** | http://localhost:3000 | Frontend application |
| **Gateway API** | http://localhost:8080 | Main API gateway |
| **PostgreSQL** | localhost:5434 | Database with pgvector |
| **Redis** | localhost:6381 | Cache and sessions |
| **Kafka** | localhost:9092 | Message queue |
| **MinIO** | http://localhost:9000 | S3-compatible storage |
| **Prometheus** | http://localhost:9090 | Metrics |
| **Grafana** | http://localhost:3010 | Dashboards |
| **Jaeger** | http://localhost:16686 | Distributed tracing |

## 🧪 Testing Against Staging

### Run Full Test Suite
```bash
cd tests
npx playwright test
```

### Run Specific Test Categories
```bash
# Smoke tests
npx playwright test tests/smoke/

# E2E workflows
npx playwright test tests/e2e/

# Auth tests
npx playwright test tests/e2e/auth.spec.ts

# Dashboard tests
npx playwright test tests/e2e/dashboard.spec.ts
```

### Debug Tests
```bash
# Run with headed browser
npx playwright test --headed

# Run specific browser
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug
```

## 🛠️ Common Commands

### Start/Stop
```bash
# Start
docker-compose -f docker-compose.staging.yml up -d

# Stop
docker-compose -f docker-compose.staging.yml down

# Stop and remove volumes (clean slate)
docker-compose -f docker-compose.staging.yml down -v
```

### Logs
```bash
# All services
docker-compose -f docker-compose.staging.yml logs -f

# Specific service
docker-compose -f docker-compose.staging.yml logs -f gateway
docker-compose -f docker-compose.staging.yml logs -f postgres
docker-compose -f docker-compose.staging.yml logs -f kafka
```

### Rebuild Services
```bash
# Rebuild all
docker-compose -f docker-compose.staging.yml build

# Rebuild specific service
docker-compose -f docker-compose.staging.yml build gateway

# Rebuild and restart
docker-compose -f docker-compose.staging.yml up -d --build
```

## 🔍 Troubleshooting

### Services Won't Start
```bash
# Check Docker is running
docker ps

# Check port conflicts
lsof -i :3000
lsof -i :5434
lsof -i :8080

# View service logs
docker-compose -f docker-compose.staging.yml logs gateway
```

### Database Connection Issues
```bash
# Connect to database
docker-compose -f docker-compose.staging.yml exec postgres psql -U postgres -d sdlc_staging

# Check database exists
docker-compose -f docker-compose.staging.yml exec postgres psql -U postgres -c "\l"
```

### Tests Failing
```bash
# Ensure all services are healthy
docker-compose -f docker-compose.staging.yml ps

# Restart failing service
docker-compose -f docker-compose.staging.yml restart gateway

# Check test configuration
cat tests/test.env
```

### Clean & Reset
```bash
# Stop everything and remove volumes
docker-compose -f docker-compose.staging.yml down -v

# Remove orphaned containers
docker-compose -f docker-compose.staging.yml down --remove-orphans

# Rebuild from scratch
docker-compose -f docker-compose.staging.yml build --no-cache
docker-compose -f docker-compose.staging.yml up -d
```

## 📊 Monitoring & Observability

### Grafana Dashboards
1. Open http://localhost:3010
2. Login: `admin` / `staging-grafana-admin`
3. View pre-configured dashboards

### Prometheus Metrics
1. Open http://localhost:9090
2. Query metrics (e.g., `http_requests_total`)

### Jaeger Tracing
1. Open http://localhost:16686
2. Search for traces by service

## 🎓 Best Practices

1. **Always start staging before running tests**
   ```bash
   docker-compose -f docker-compose.staging.yml up -d
   sleep 30  # Wait for services to be ready
   cd tests && npx playwright test
   ```

2. **Use staging for local development**
   - Much closer to production than dev environment
   - Full infrastructure stack available
   - Test real integrations

3. **Reset between test runs if needed**
   ```bash
   docker-compose -f docker-compose.staging.yml down -v
   docker-compose -f docker-compose.staging.yml up -d
   ```

4. **Monitor resource usage**
   ```bash
   docker stats
   ```

## 🚨 Important Notes

- Staging uses **different ports** than dev to avoid conflicts
- Passwords are **not production-grade** (fine for local testing)
- Data is **persisted in Docker volumes** (survives restarts)
- Use `down -v` to **completely wipe** staging data

## ✅ Success Checklist

- [ ] All services show "Up (healthy)" in `docker ps`
- [ ] Admin UI loads at http://localhost:3000
- [ ] API health check passes: `curl http://localhost:8080/health`
- [ ] Smoke tests pass: `npx playwright test tests/smoke/basic.spec.ts`
- [ ] Full test suite pass rate > 80%

## 🆘 Need Help?

If services won't start or tests keep failing:

1. Check Docker Desktop has enough resources (8GB+ RAM)
2. Ensure ports are not in use by other applications
3. View logs: `docker-compose -f docker-compose.staging.yml logs`
4. Try a clean rebuild: `docker-compose -f docker-compose.staging.yml down -v && docker-compose -f docker-compose.staging.yml up -d --build`
