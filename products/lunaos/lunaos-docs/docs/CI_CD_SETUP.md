# CI/CD Pipeline Setup Guide

This guide provides comprehensive instructions for setting up and maintaining the Claude Agent Platform CI/CD pipeline.

## Overview

The Claude Agent Platform uses GitHub Actions for automated testing, building, security scanning, and deployment. The pipeline is designed to ensure code quality, security, and reliable deployments across multiple environments.

## Pipeline Components

### 1. CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Manual workflow dispatch

**Stages:**
1. **Code Quality & Security**
   - ESLint and Prettier checks
   - TypeScript type checking
   - Security vulnerability scanning with Snyk
   - npm audit

2. **Testing**
   - Unit tests across multiple Node.js versions
   - Integration tests with PostgreSQL, Redis, Qdrant
   - End-to-end tests
   - Performance tests

3. **Building**
   - Build applications for different platforms
   - Docker image building and pushing
   - Artifact generation

4. **Notification**
   - Slack notifications for build status

### 2. Deployment Pipeline (`.github/workflows/deploy.yml`)

**Triggers:**
- Push to `main` branch
- Tags starting with `v*`
- Manual workflow dispatch with environment selection

**Environments:**
- **Staging**: Automated deployment on every push to `main`
- **Production**: Triggered by tags or manual dispatch

**Features:**
- Blue-green deployment strategy for production
- Health checks and smoke tests
- Automatic rollback on failure
- Database backup before production deployment

### 3. Security Scanning (`.github/workflows/security.yml`)

**Tools:**
- Snyk vulnerability scanning
- CodeQL security analysis
- OWASP ZAP baseline scan
- Trivy Docker security scanning
- npm audit
- Semgrep security analysis
- Secret scanning with TruffleHog and Gitleaks

**Schedule:**
- Daily scans at 2 AM UTC
- Runs on every push and PR

### 4. Performance Testing (`.github/workflows/performance.yml`)

**Tests:**
- Lighthouse performance audit
- Load testing with k6
- Bundle size analysis
- Memory profiling
- API performance testing
- Performance regression detection

**Schedule:**
- Weekly on Sundays at 1 AM UTC
- Runs on every PR

### 5. Release Pipeline (`.github/workflows/release.yml`)

**Triggers:**
- Git tags starting with `v*`
- Manual workflow dispatch

**Tasks:**
- Create GitHub release
- Build and upload release assets
- Publish to npm
- Update Docker Hub images
- Deploy documentation
- Social media notifications

### 6. CodeQL Analysis (`.github/workflows/codeql.yml`)

**Schedule:**
- Weekly on Mondays at 2:30 AM UTC
- Runs on every push and PR

**Languages:**
- JavaScript
- TypeScript

### 7. Dependabot Configuration (`.github/dependabot.yml`)

**Features:**
- Automated dependency updates for npm, GitHub Actions, and Docker
- Weekly checks on Sundays
- Pull request creation with proper labels and reviewers

## Required Secrets

Configure these secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

### Core Secrets
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions
- `NPM_TOKEN`: npm authentication token for publishing packages
- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password or access token

### Cloud Infrastructure
- `AWS_ACCESS_KEY_ID`: AWS access key for infrastructure management
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for infrastructure management
- `AWS_ACCESS_KEY_ID_PROD`: Production AWS access key (separate from dev)
- `AWS_SECRET_ACCESS_KEY_PROD`: Production AWS secret key

### Security & Monitoring
- `SNYK_TOKEN`: Snyk API token for vulnerability scanning
- `SLACK_WEBHOOK_URL`: Slack webhook for build notifications
- `SEMGREP_APP_TOKEN`: Semgrep app token for security analysis
- `GITLEAKS_LICENSE`: Gitleaks license for enhanced secret scanning

### Database & Services
- `STAGING_DB_HOST`: Staging database host
- `STAGING_DB_PASSWORD`: Staging database password
- `STAGING_REDIS_HOST`: Staging Redis host
- `STAGING_REDIS_PASSWORD`: Staging Redis password
- `STAGING_QDRANT_HOST`: Staging Qdrant host
- `STAGING_QDRANT_API_KEY`: Staging Qdrant API key

- `PROD_DB_HOST`: Production database host
- `PROD_DB_PASSWORD`: Production database password
- `PROD_REDIS_HOST`: Production Redis host
- `PROD_REDIS_PASSWORD`: Production Redis password
- `PROD_QDRANT_HOST`: Production Qdrant host
- `PROD_QDRANT_API_KEY`: Production Qdrant API key

### Social Media (Optional)
- `TWITTER_API_KEY`: Twitter API key for release announcements
- `TWITTER_API_SECRET_KEY`: Twitter API secret key
- `TWITTER_ACCESS_TOKEN`: Twitter access token
- `TWITTER_ACCESS_TOKEN_SECRET`: Twitter access token secret

## Environment Setup

### Development Environment

1. **Install required tools:**
   ```bash
   # Node.js 20+
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # pnpm
   npm install -g pnpm@8
   
   # Docker & Docker Compose
   sudo apt-get install docker.io docker-compose
   ```

2. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd claude-agent-platform
   pnpm install
   cp .env.example .env
   ```

3. **Start development environment:**
   ```bash
   pnpm docker:up
   pnpm migrate
   pnpm seed
   pnpm dev
   ```

### Test Environment

The test environment uses `docker-compose.test.yml` with isolated containers:

```bash
# Start test services
docker-compose -f docker-compose.test.yml up -d

# Run tests
pnpm test

# Stop test services
docker-compose -f docker-compose.test.yml down -v
```

## Local Pipeline Testing

### CI/CD Validation Script

Run the validation script to ensure your pipeline is properly configured:

```bash
node scripts/test-ci-cd.js
```

This script checks:
- ✅ Workflow file configuration
- ✅ Package.json scripts
- ✅ Environment files
- ✅ Required tools availability
- ✅ Monitoring configuration
- ✅ Issue/PR templates
- ✅ Secrets configuration guide
- ✅ Validation tests

### Manual Workflow Testing

Test individual workflows locally:

```bash
# Test CI pipeline
act -j test

# Test build process
docker build -t claude-agent-platform:test .

# Test security scanning
npm audit
snyk test
```

## Deployment Process

### Staging Deployment

1. **Trigger**: Push to `main` branch
2. **Process**:
   - Run full CI pipeline
   - Build and push Docker images
   - Deploy to staging environment
   - Run health checks and smoke tests
   - Notify team of deployment status

### Production Deployment

1. **Trigger**: Create git tag or manual dispatch
2. **Process**:
   - Create database backup
   - Deploy to green environment (blue-green strategy)
   - Run comprehensive health checks
   - Switch traffic to green environment
   - Run final verification tests
   - Keep blue environment for rollback (7 days)
   - Create GitHub release
   - Update documentation

### Rollback Procedure

Automatic rollback occurs if:
- Health checks fail
- Smoke tests fail
- Production verification fails

Manual rollback:
1. Go to GitHub Actions > Deploy Pipeline
2. Click "Rollback Production" workflow
3. Confirm rollback initiation
4. Monitor rollback progress

## Monitoring and Observability

### Build Metrics

- Build success rate
- Build duration trends
- Test coverage metrics
- Security scan results

### Performance Metrics

- Lighthouse scores
- Load test results
- Bundle size tracking
- API performance benchmarks

### Security Metrics

- Vulnerability counts
- Security scan results
- Secret detection results
- Code quality metrics

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check logs in GitHub Actions
   - Verify all dependencies are installed
   - Ensure all required scripts exist in package.json

2. **Test Failures**
   - Check test environment is properly configured
   - Verify all test services are running
   - Review test logs for specific errors

3. **Deployment Failures**
   - Check infrastructure configuration
   - Verify all secrets are properly configured
   - Review deployment logs for specific errors

4. **Security Scan Failures**
   - Review vulnerability reports
   - Update affected dependencies
   - Implement security fixes

### Debugging Steps

1. **Check Workflow Logs**
   - Go to Actions > Select workflow run
   - Review individual job logs
   - Check for error messages and warnings

2. **Local Reproduction**
   - Run failed tests locally
   - Reproduce build steps
   - Debug with local environment

3. **Environment Validation**
   - Verify all environment variables
   - Check service connectivity
   - Validate configuration files

## Best Practices

### Code Quality

- Ensure all tests pass before committing
- Follow ESLint and Prettier rules
- Maintain high test coverage (>90%)
- Write meaningful commit messages

### Security

- Regularly update dependencies
- Review security scan results
- Never commit secrets or credentials
- Use security headers and best practices

### Performance

- Monitor bundle sizes
- Optimize images and assets
- Implement caching strategies
- Regular performance audits

### Deployment

- Use semantic versioning
- Create meaningful release notes
- Test in staging before production
- Monitor post-deployment metrics

## Maintenance

### Regular Tasks

- **Weekly**: Review Dependabot PRs and merge safe updates
- **Monthly**: Review security scan results and address vulnerabilities
- **Quarterly**: Audit pipeline configurations and update as needed
- **Annually**: Review entire CI/CD strategy and optimize

### Updates

- Update GitHub Actions versions regularly
- Review and update dependency versions
- Optimize pipeline performance
- Update documentation

## Support

For help with CI/CD pipeline issues:

1. **Documentation**: Check this guide and workflow file comments
2. **GitHub Issues**: Create an issue with detailed error logs
3. **Team Communication**: Use Slack for urgent issues
4. **Community**: Check discussions and community resources

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [AWS Deployment Guide](https://docs.aws.amazon.com/)
- [Security Best Practices](https://owasp.org/)

---

Last updated: November 1, 2025