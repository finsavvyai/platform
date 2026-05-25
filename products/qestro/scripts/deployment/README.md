# Deployment Scripts

Scripts for deploying Questro to production environments.

## Available Scripts

### Production Deployment
- **`deploy-production.sh`** - Complete production deployment with all checks
- **`deploy.sh`** - General deployment script with configurable options
- **`deploy-now.sh`** - Quick deployment for urgent updates
- **`quick-deploy.sh`** - Streamlined deployment process

### Service-Specific Deployment
- **`backend-start-production.sh`** - Start backend services in production mode
- **`deploy-questro-io.sh`** - Deploy specifically to questro.io domain

### Deployment Verification
- **`check-deployment.sh`** - Comprehensive deployment status check
- **`check-status.sh`** - Overall system health check
- **`check-domains.sh`** - Verify domain configuration and SSL
- **`check-unique-domains.sh`** - Validate unique domain setup

## Usage Examples

### Full Production Deployment
```bash
# Complete production deployment
./scripts/deployment/deploy-production.sh

# Quick deployment for hotfixes
./scripts/deployment/deploy-now.sh
```

### Deployment Verification
```bash
# Check deployment status
./scripts/deployment/check-deployment.sh

# Verify domain configuration
./scripts/deployment/check-domains.sh
```

### Service Management
```bash
# Start backend in production mode
./scripts/deployment/backend-start-production.sh
```

## Prerequisites

Before running deployment scripts:
1. Configure environment variables in `.env`
2. Ensure all services are properly configured
3. Verify database migrations are up to date
4. Test the deployment in staging environment

## Environment Variables

Required environment variables for deployment:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
FRONTEND_URL=https://app.questro.com
JWT_SECRET=your-secret
OPENAI_API_KEY=your-key
```

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates valid
- [ ] Domain DNS configured
- [ ] Monitoring alerts configured
- [ ] Backup systems operational