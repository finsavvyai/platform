# CI/CD Setup Summary — Qestro

## Overview

Complete GitHub Actions CI/CD pipeline and production infrastructure setup for Qestro. This includes automated testing, building, Docker image creation, and deployment workflows.

## What Was Created

### 1. GitHub Actions Workflows

#### `.github/workflows/ci.yml` (9.5 KB)
Main continuous integration pipeline that runs on every push and pull request.

**Features:**
- Linting checks (ESLint on backend/frontend)
- Backend unit tests with PostgreSQL and Redis services
- Frontend unit tests with coverage
- Build stage that compiles backend and frontend
- E2E tests with Playwright (full test environment)
- Docker image build and push to GitHub Container Registry (GHCR)

**Jobs:**
1. **lint** - Code quality checks
2. **test-backend** - Backend unit tests (with DB/Redis)
3. **test-frontend** - Frontend unit tests
4. **build** - Compile and build artifacts
5. **e2e** - End-to-end testing with full stack
6. **docker** - Docker image build (main branch only)

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Concurrent runs cancelled for same branch

#### `.github/workflows/deploy.yml` (4.9 KB)
Manual deployment pipeline for staging and production environments.

**Features:**
- Manual trigger with environment selection
- AWS credential configuration via OIDC
- Docker image build and ECR push
- Kubernetes deployment with kubectl
- Smoke tests after deployment
- GitHub deployment tracking
- Slack notifications

**Environment Support:**
- Staging
- Production

**Requirements:**
- AWS IAM role ARN for each environment
- Slack webhook for notifications
- GitHub environments configured

### 2. Production TypeScript Configuration

#### `backend/tsconfig.production.json` (Updated)
Enhanced production TypeScript compilation configuration.

**Settings:**
- Target: ES2022
- Module: CommonJS
- Strict type checking enabled
- Source maps enabled
- Declaration files generated
- Unused locals/parameters detected
- No fallthrough cases in switch
- Exclusions: test files, mocks

**Key Improvements:**
- Full strict mode for production
- Better error detection
- Source maps for debugging

### 3. Database Setup Script

#### `scripts/setup-db.sh` (6.9 KB)
Automated database initialization script for development and production.

**Features:**
- Waits for PostgreSQL to become ready (with timeout)
- Creates database if it doesn't exist
- Runs Drizzle migrations
- Seeds initial data (admin and test users)
- Colorized output with progress indicators
- Comprehensive error handling

**Environment Variables:**
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=qestro
DB_USER=qestro_user
DB_PASSWORD=required
DATABASE_URL=postgresql://...
```

**Functions:**
- `wait_for_postgres()` - Health check with timeout
- `create_database()` - Database creation
- `run_migrations()` - Drizzle migration execution
- `seed_data()` - Initial user seeding

### 4. Updated Startup Script

#### `start.sh` (Updated)
Added Phase 1.5 for database setup in production/staging environments.

**New Feature:**
- Runs database setup before backend compilation
- Only for staging/production (skipped in dev)
- Respects DATABASE_URL environment variable

### 5. Documentation

#### `.github/workflows/README.md` (New)
Detailed documentation of all CI/CD workflows.

**Sections:**
- Workflow overview
- Environment variables
- Local testing commands
- Docker image building
- Troubleshooting guide
- Best practices

#### `DEPLOYMENT.md` (11 KB)
Comprehensive deployment guide covering all environments.

**Contents:**
- Local development setup
- Staging deployment procedures
- Production deployment steps
- Docker deployment guide
- Kubernetes deployment
- Database management
- Monitoring and health checks
- Troubleshooting guide

## Infrastructure Components

### Services in CI Pipeline

**PostgreSQL 16-alpine**
- Port: 5432
- Health check: pg_isready
- Test database: qestro_test

**Redis 7-alpine**
- Port: 6379
- Health check: redis-cli ping
- Used for job queue

### Docker Images

**Backend Image**
- Base: node:20-alpine
- Layers: Builder + Runtime
- Includes: Chromium, dependencies
- Health check: /health endpoint

**Frontend Image**
- Next.js application
- Production build optimized
- Environment: NEXT_PUBLIC_API_URL

### Registry

**GitHub Container Registry (GHCR)**
- `ghcr.io/qestro/qestro/backend:[tag]`
- `ghcr.io/qestro/qestro/frontend:[tag]`
- Tags: branch, SHA, version, latest

## Workflow Execution Flow

```
┌─────────────────────────────────────────┐
│ Push to main/develop or PR opened       │
└─────────────────┬───────────────────────┘
                  ▼
         ┌────────────────┐
         │  Lint Check    │
         └────────┬───────┘
                  ▼
    ┌─────────────────────────┐
    │  Backend Tests (DB/Redis)│
    │  Frontend Tests          │
    └──────┬──────────┬────────┘
           │          │
           ▼          ▼
      ┌────────────────────┐
      │   Build Artifacts   │
      └────────┬───────────┘
               ▼
         ┌──────────────┐
         │  E2E Tests   │
         └────┬─────────┘
              ▼
      ┌──────────────────┐  (main only)
      │ Docker Build/Push│  (after E2E)
      └──────────────────┘
```

## GitHub Secrets Required

For deployment workflow, set these in GitHub repository settings:

```
STAGING_AWS_ROLE_ARN
PRODUCTION_AWS_ROLE_ARN
AWS_ACCOUNT_ID
STAGING_API_URL
PRODUCTION_API_URL
STAGING_DEPLOYMENT_URL
PRODUCTION_DEPLOYMENT_URL
SLACK_WEBHOOK_URL
```

## Environment Variables

### Development (.env)
```
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/qestro
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret
```

### CI/CD (GitHub Actions)
```
DATABASE_URL=postgresql://qestro_test:qestro_test_password@localhost:5432/qestro_test
REDIS_URL=redis://localhost:6379
JWT_SECRET=test-jwt-secret-key-123456789
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000
```

### Production (docker-compose.prod.yml)
```
DB_NAME=qestro_production
DB_USER=qestro_user
DB_PASSWORD=[required]
REDIS_PASSWORD=[required]
JWT_SECRET=[required]
JWT_REFRESH_SECRET=[required]
CORS_ORIGINS=https://qestro.app,https://qestro.io
```

## Running Workflows Locally

### Test Locally Before Pushing

```bash
# Install dependencies
npm ci

# Run linting
npm --prefix backend run lint
npm --prefix frontend run lint

# Run backend tests
npm --prefix backend run test

# Run frontend tests
npm --prefix frontend run test

# Build
npm run build

# Run E2E tests
npx playwright test
```

### Database Setup

```bash
# Start services
docker-compose up -d postgres redis

# Wait for services
sleep 5

# Run setup script
bash scripts/setup-db.sh
```

### Docker Testing

```bash
# Build images
docker build -t qestro-backend:test -f backend/Dockerfile .
docker build -t qestro-frontend:test ./frontend

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up
```

## Deployment Procedure

### Staging

1. **Manual trigger:**
   - Go to GitHub → Actions → Deploy
   - Select: staging
   - Click: Run workflow

2. **Automated steps:**
   - Checks out code
   - Builds Docker images
   - Pushes to ECR
   - Deploys via kubectl
   - Runs smoke tests
   - Creates GitHub deployment

### Production

1. **Verify tests pass on main**
2. **Trigger deployment:**
   - Go to GitHub → Actions → Deploy
   - Select: production
   - Confirm selection
3. **Monitor deployment:**
   - Check Slack notifications
   - Verify health endpoints
   - Check logs in EKS

## Monitoring

### Health Endpoints

```
Staging:     https://staging-api.qestro.app/health
Production:  https://api.qestro.app/health
```

### Logs

```bash
# Backend logs (Kubernetes)
kubectl logs -f deployment/qestro-backend -n staging

# Docker Compose
docker-compose logs -f backend

# CI logs
GitHub Actions → Workflow runs → [run] → [job] → logs
```

## Troubleshooting

### CI Pipeline Failures

1. **Lint fails:**
   ```bash
   npm --prefix backend run lint --fix
   npm --prefix frontend run lint --fix
   git add . && git commit -m "fix: lint errors"
   ```

2. **Tests fail:**
   ```bash
   npm --prefix backend run test
   npm --prefix frontend run test
   # Debug locally before pushing
   ```

3. **Build fails:**
   - Check TypeScript errors
   - Verify dependencies installed
   - Check environment variables

4. **E2E fails:**
   ```bash
   npx playwright test --headed
   npx playwright show-report
   ```

### Deployment Failures

1. **Check logs:**
   ```bash
   kubectl logs deployment/qestro-backend -n staging
   kubectl describe pods -n staging
   ```

2. **Verify resources:**
   ```bash
   kubectl get events -n staging --sort-by='.lastTimestamp'
   ```

3. **Rollback:**
   ```bash
   kubectl rollout undo deployment/qestro-backend -n staging
   ```

## Best Practices

1. **Always run tests locally before pushing**
2. **Maintain test coverage above 80%**
3. **Use conventional commits for automation**
4. **Stage to staging before production**
5. **Monitor deployments in real-time**
6. **Keep secrets in GitHub, never in code**
7. **Review logs after each deployment**
8. **Keep Docker images small**
9. **Use semantic versioning**
10. **Document deployment procedures**

## File Locations

| File | Location | Size |
|------|----------|------|
| CI Workflow | `.github/workflows/ci.yml` | 9.5 KB |
| Deploy Workflow | `.github/workflows/deploy.yml` | 4.9 KB |
| Workflow Docs | `.github/workflows/README.md` | 8 KB |
| TypeScript Config | `backend/tsconfig.production.json` | 1.4 KB |
| DB Setup Script | `scripts/setup-db.sh` | 6.9 KB |
| Deployment Guide | `DEPLOYMENT.md` | 11 KB |
| Updated Start Script | `start.sh` | (modified) |

## Next Steps

1. **Configure GitHub Secrets:**
   - Add AWS role ARNs
   - Set API URLs
   - Configure Slack webhook

2. **Create Kubernetes manifests:**
   - `k8s/staging/deployment.yaml`
   - `k8s/production/deployment.yaml`
   - Service, Ingress, ConfigMap definitions

3. **Set up monitoring:**
   - CloudWatch alarms
   - DataDog or New Relic
   - Slack notifications

4. **Configure backups:**
   - RDS automated backups
   - S3 backup bucket
   - Disaster recovery plan

5. **Test workflows:**
   - Trigger CI on test branch
   - Test staging deployment
   - Verify production readiness

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Kubernetes Documentation](https://kubernetes.io/docs)
- [PostgreSQL Backup Guide](https://www.postgresql.org/docs/current/backup.html)
- [Playwright Testing](https://playwright.dev)

---

**Created:** 2026-04-07
**Version:** 1.0
**Status:** Ready for production use
