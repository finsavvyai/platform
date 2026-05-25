# GitHub Actions CI/CD Pipelines

This directory contains GitHub Actions workflows for Qestro's continuous integration and deployment.

## Workflows

### ci.yml - Continuous Integration Pipeline

Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**

1. **lint** - Code linting and formatting checks
   - Runs ESLint on backend and frontend
   - Checks code formatting

2. **test-backend** - Backend unit tests
   - Requires PostgreSQL 16 and Redis 7 services
   - Runs Jest with coverage reporting
   - Uploads coverage to Codecov

3. **test-frontend** - Frontend unit tests
   - Runs frontend tests with coverage
   - Uploads coverage to Codecov

4. **build** - Build artifacts
   - Requires lint and test jobs to pass
   - Builds backend and frontend
   - Uploads artifacts for E2E testing

5. **e2e** - End-to-end tests
   - Requires build job to pass
   - Starts backend and frontend servers
   - Runs Playwright E2E tests
   - Uploads test reports

6. **docker** - Docker image build and push
   - Only runs on `main` branch after successful build and E2E tests
   - Builds and pushes Docker images to GitHub Container Registry (ghcr.io)
   - Tags with commit SHA and branch name

### deploy.yml - Deployment Pipeline

Manual workflow for deploying to staging or production environments.

**Trigger:** Workflow dispatch with environment selection

**Jobs:**

1. **deploy** - Deploy to target environment
   - Configures AWS credentials via OIDC
   - Builds Docker images and pushes to ECR
   - Deploys via Kubernetes using kubectl
   - Runs smoke tests
   - Creates GitHub deployment
   - Notifies Slack on completion

## Environment Variables

### CI Workflow

**Backend Tests:**
```
DATABASE_URL=postgresql://qestro_test:qestro_test_password@localhost:5432/qestro_test
REDIS_URL=redis://localhost:6379
JWT_SECRET=test-jwt-secret-key-123456789
JWT_REFRESH_SECRET=test-refresh-secret-key-123456789
```

**E2E Tests:**
```
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000
```

### Deploy Workflow

Required GitHub Secrets:

- `AWS_ACCOUNT_ID` - AWS account ID
- `STAGING_AWS_ROLE_ARN` - IAM role ARN for staging deployment
- `PRODUCTION_AWS_ROLE_ARN` - IAM role ARN for production deployment
- `STAGING_API_URL` - Staging API URL
- `PRODUCTION_API_URL` - Production API URL
- `STAGING_DEPLOYMENT_URL` - Staging deployment health check URL
- `PRODUCTION_DEPLOYMENT_URL` - Production deployment health check URL
- `SLACK_WEBHOOK_URL` - Slack webhook for notifications

## GitHub Container Registry (GHCR)

Docker images are automatically built and pushed to GHCR after successful E2E tests on `main` branch.

**Image naming:**
```
ghcr.io/qestro/qestro/backend:[tag]
ghcr.io/qestro/qestro/frontend:[tag]
```

**Tags applied:**
- `branch-[branch-name]` - Branch name
- `sha-[short-sha]` - Commit SHA (short)
- `latest` - Latest on main branch
- `v[version]` - Semantic version tags

## Local Development

### Running Tests Locally

```bash
# Backend tests
npm --prefix backend run test

# Frontend tests
npm --prefix frontend run test

# E2E tests
npx playwright test

# Coverage report
npm run test:coverage
```

### Building Docker Images Locally

```bash
# Build backend image
docker build -t qestro-backend:local -f backend/Dockerfile .

# Build frontend image
docker build -t qestro-frontend:local ./frontend

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up
```

## Troubleshooting

### CI Pipeline Failures

1. **Lint failures:**
   - Fix ESLint errors: `npm --prefix [backend|frontend] run lint --fix`

2. **Test failures:**
   - Check test output in GitHub Actions logs
   - Run locally to reproduce: `npm --prefix [backend|frontend] run test`

3. **Build failures:**
   - Verify dependencies: `npm ci`
   - Check TypeScript errors: `npm --prefix [backend|frontend] run build`

4. **E2E test failures:**
   - Run Playwright in headed mode: `npx playwright test --headed`
   - Generate HTML report: `npx playwright show-report`

### Docker Build Failures

1. **Base image not found:**
   - Ensure Docker daemon is running
   - Pull base images: `docker pull node:20-alpine`

2. **Layer caching issues:**
   - Clear build cache: `docker buildx prune`

## Best Practices

1. **Commit Messages:**
   - Use conventional commits for automated versioning
   - Example: `feat: add new feature` or `fix: resolve issue #123`

2. **Pull Requests:**
   - Wait for CI to pass before merging
   - Address all linting and test failures
   - Maintain test coverage above 80%

3. **Deployments:**
   - Always deploy to staging first
   - Verify in staging before production
   - Keep deployment artifacts for rollback

4. **Secrets Management:**
   - Use GitHub Secrets for sensitive data
   - Rotate credentials regularly
   - Never commit .env files

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Kubernetes Documentation](https://kubernetes.io/docs)
- [Playwright Testing Documentation](https://playwright.dev)
