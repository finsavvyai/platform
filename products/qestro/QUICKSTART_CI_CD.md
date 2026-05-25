# Quick Start — CI/CD Pipeline

Fast reference guide for working with Qestro's CI/CD infrastructure.

## Local Development

### Initial Setup

```bash
# Clone and install
git clone https://github.com/qestro/qestro.git
cd qestro
npm install

# Start database and cache
docker-compose up -d postgres redis

# Setup database
bash scripts/setup-db.sh

# Start development servers
./start.sh dev
```

### Running Tests Before Pushing

```bash
# Lint code
npm --prefix backend run lint --fix
npm --prefix frontend run lint --fix

# Unit tests
npm --prefix backend run test
npm --prefix frontend run test

# E2E tests
npx playwright test

# All tests at once
npm test
```

### Building Docker Images Locally

```bash
# Build images
docker build -t qestro-backend:local -f backend/Dockerfile .
docker build -t qestro-frontend:local ./frontend

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up
```

## CI/CD Workflows

### What Runs Automatically

**On every push to main/develop:**
1. Linting (ESLint)
2. Backend unit tests (PostgreSQL + Redis)
3. Frontend unit tests
4. Build artifacts
5. E2E tests (full stack)
6. Docker image build (main only)

**Status:** Check GitHub Actions tab in repository

### Manual Deployments

**Staging:**
1. Go to GitHub → Actions → Deploy
2. Click "Run workflow"
3. Select: staging
4. Confirm

**Production:**
1. Go to GitHub → Actions → Deploy
2. Click "Run workflow"
3. Select: production
4. Confirm (requires approval)

## Troubleshooting

### Linting Errors

```bash
# Auto-fix linting issues
npm --prefix backend run lint --fix
npm --prefix frontend run lint --fix

# Commit and push
git add . && git commit -m "fix: lint errors"
git push
```

### Test Failures

```bash
# Run failing test locally
npm --prefix backend run test -- --watch

# Debug with verbose output
npx playwright test --debug

# View test report
npx playwright show-report
```

### Build Failures

```bash
# Clean install
npm ci

# Rebuild
npm run build

# Check for TypeScript errors
npm --prefix backend run typecheck
npm --prefix frontend run typecheck
```

### Deployment Fails

```bash
# Check logs (Kubernetes)
kubectl logs deployment/qestro-backend -n staging

# Check pod status
kubectl get pods -n staging

# Describe pod for errors
kubectl describe pod/qestro-backend-xyz -n staging

# Rollback if needed
kubectl rollout undo deployment/qestro-backend -n staging
```

## Common Commands

```bash
# Development
./start.sh dev              # Start dev environment
docker-compose up -d        # Start database/cache
npm run dev                 # All dev servers

# Testing
npm test                    # All tests
npm --prefix backend run test
npm --prefix frontend run test
npx playwright test         # E2E tests

# Building
npm run build               # Build all
npm --prefix backend run build
npm --prefix frontend run build

# Database
bash scripts/setup-db.sh    # Initialize database
npm --prefix backend run db:migrate  # Run migrations

# Docker
docker build -t qestro-backend:local -f backend/Dockerfile .
docker-compose -f docker-compose.prod.yml up

# Git workflow
git checkout -b feature/xyz  # Feature branch
git push origin feature/xyz  # Push for review
# → GitHub Actions runs automatically
# → Create pull request
# → Wait for checks to pass
# → Merge when approved
```

## File References

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | CI pipeline (test, build, E2E) |
| `.github/workflows/deploy.yml` | Deployment pipeline (staging/prod) |
| `backend/Dockerfile` | Backend container image |
| `frontend/Dockerfile` | Frontend container image |
| `docker-compose.prod.yml` | Production services |
| `docker-compose.yml` | Development services |
| `scripts/setup-db.sh` | Database initialization |
| `start.sh` | Local dev startup |
| `DEPLOYMENT.md` | Full deployment guide |
| `.env.production.example` | Production environment vars |

## Environment Variables

### Development
```
DATABASE_URL=postgresql://user:pass@localhost:5432/qestro
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret
```

### CI/CD (automatic)
```
DATABASE_URL=postgresql://qestro_test:qestro_test_password@localhost:5432/qestro_test
REDIS_URL=redis://localhost:6379
```

### Production
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=***
CORS_ORIGINS=https://qestro.app
```

Set sensitive values in GitHub Secrets, not in code.

## Monitoring

### Health Endpoints

```bash
# Local
curl http://localhost:8000/health

# Staging
curl https://staging-api.qestro.app/health

# Production
curl https://api.qestro.app/health
```

### Watch Logs (Kubernetes)

```bash
# Staging
kubectl logs -f deployment/qestro-backend -n staging

# Production
kubectl logs -f deployment/qestro-backend -n production

# Follow in real-time with grep
kubectl logs -f deployment/qestro-backend -n staging | grep -i error
```

### Container Logs (Docker)

```bash
# Follow container logs
docker-compose logs -f backend

# View specific container
docker logs -f qestro-backend
```

## Key Workflows

### Feature Development

1. Create feature branch: `git checkout -b feature/cool-feature`
2. Make changes and test locally: `./start.sh dev`
3. Run tests: `npm test`
4. Commit: `git commit -m "feat: add cool feature"`
5. Push: `git push origin feature/cool-feature`
6. Create PR on GitHub
7. Wait for CI to pass
8. Request review
9. Merge when approved

### Bug Fix

1. Create branch: `git checkout -b fix/issue-123`
2. Fix and test locally
3. Run tests to verify fix
4. Commit: `git commit -m "fix: resolve issue #123"`
5. Push and create PR
6. Merge when CI passes

### Release to Staging

1. Ensure all tests pass on `main`
2. Go to GitHub Actions → Deploy
3. Select environment: staging
4. Monitor deployment notifications
5. Test in staging: https://staging.qestro.app

### Release to Production

1. Verify staging deployment works
2. Go to GitHub Actions → Deploy
3. Select environment: production
4. Confirm (requires approval)
5. Monitor Slack notifications
6. Verify health: https://api.qestro.app/health

## Support Resources

- **CI/CD Docs:** See `.github/workflows/README.md`
- **Deployment Guide:** See `DEPLOYMENT.md`
- **Setup Summary:** See `CI_CD_SETUP_SUMMARY.md`
- **GitHub Actions Docs:** https://docs.github.com/en/actions
- **Playwright Docs:** https://playwright.dev
- **Kubernetes Docs:** https://kubernetes.io/docs

## Emergency Procedures

### Rollback Deployment

```bash
# Check rollout history
kubectl rollout history deployment/qestro-backend -n production

# Rollback to previous version
kubectl rollout undo deployment/qestro-backend -n production

# Wait for completion
kubectl rollout status deployment/qestro-backend -n production
```

### Stop Deployment in Progress

```bash
# Cancel GitHub Actions workflow
# Go to Actions → Workflow run → Cancel workflow

# Or rollback immediately
kubectl rollout undo deployment/qestro-backend -n staging
```

### Database Emergency

```bash
# Backup database
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore database
gunzip < backup-$(date +%Y%m%d).sql.gz | psql $DATABASE_URL
```

---

**Need help?** Check `DEPLOYMENT.md` for detailed procedures or GitHub Issues for known issues.
