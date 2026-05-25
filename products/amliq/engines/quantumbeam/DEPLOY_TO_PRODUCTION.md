# QuantumBeam Production Deployment Guide

## 🚀 Complete Production Deployment Checklist

### ✅ Pre-Deployment Status

Your QuantumBeam system is **production-ready** with:

- [x] Production-grade fraud detection service
- [x] Comprehensive integration tests
- [x] Health checks and monitoring
- [x] Rate limiting and circuit breakers
- [x] Secure Docker images
- [x] Automated deployment scripts
- [x] Modern Qodo-style website
- [x] Environment configuration templates

## 📋 Deployment Options

### Option 1: Cloud Platform Deployment (Recommended)

#### A. Deploy to Kubernetes (EKS/GKE/AKS)

```bash
# 1. Set up cluster credentials
export KUBECONFIG=~/.kube/config

# 2. Create namespace
kubectl create namespace quantumbeam-production

# 3. Create secrets
kubectl create secret generic quantumbeam-secrets \
  --from-env-file=.env.production \
  -n quantumbeam-production

# 4. Deploy with Helm (if using)
helm install quantumbeam ./helm/quantumbeam \
  --namespace quantumbeam-production \
  --values helm/values-production.yaml

# 5. Or deploy with kubectl
kubectl apply -f k8s/production/ -n quantumbeam-production

# 6. Monitor deployment
kubectl rollout status deployment/quantumbeam-api -n quantumbeam-production
```

#### B. Deploy to Railway (Simple)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Initialize project
railway init

# 4. Set environment variables
railway vars set $(cat .env.production | grep -v '^#' | xargs)

# 5. Deploy
railway up

# 6. Get deployment URL
railway domain
```

#### C. Deploy to Fly.io

```bash
# 1. Install Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Login
fly auth login

# 3. Launch app
fly launch --name quantumbeam-api

# 4. Set secrets
fly secrets import < .env.production

# 5. Deploy
fly deploy

# 6. Open in browser
fly open
```

### Option 2: Docker Compose Deployment

```bash
# 1. Configure environment
cp .env.production.example .env.production
# Edit .env.production with your secrets

# 2. Build and deploy
./scripts/deploy-production.sh

# 3. Verify deployment
curl http://localhost:8080/health/detailed

# 4. Access services
# API: http://localhost:8080
# Grafana: http://localhost:3000
# Prometheus: http://localhost:9090
```

### Option 3: Vercel (Website Only)

```bash
# Deploy marketing website to Vercel
cd web/marketing

# 1. Install Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod

# 4. Configure environment
vercel env add NEXT_PUBLIC_API_URL production
```

### Option 4: Cloudflare Pages (Website)

```bash
# Deploy website to Cloudflare Pages
cd web/marketing

# 1. Build site
npm run build

# 2. Deploy with Wrangler
npx wrangler pages deploy out --project-name=quantumbeam

# 3. Configure custom domain
wrangler pages domains add quantumbeam.io
```

## 🔧 Step-by-Step Production Deployment

### Step 1: Configure Production Environment

```bash
# 1. Copy environment template
cp .env.production.example .env.production

# 2. Generate strong secrets
export JWT_SECRET=$(openssl rand -hex 32)
export API_KEY_ENCRYPTION_KEY=$(openssl rand -hex 16)
export SESSION_SECRET=$(openssl rand -hex 32)

# 3. Edit .env.production and set:
# - Database credentials
# - Redis configuration
# - Quantum backend API keys (IBM Quantum, AWS Braket)
# - AI/ML API keys (OpenAI, Anthropic)
# - Payment provider credentials
# - Monitoring webhooks

# 4. Validate environment
./scripts/validate-env.sh .env.production
```

### Step 2: Set Up Database

```bash
# 1. Start database services
docker-compose -f docker-compose.database.yml up -d

# 2. Wait for database to be ready
make db-status

# 3. Run migrations
make db-migrate

# 4. Seed initial data
make db-seed

# 5. Create backup
make db-backup NAME=pre-production-$(date +%Y%m%d)
```

### Step 3: Build Production Images

```bash
# Set build arguments
export VERSION=1.0.0
export BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
export GIT_COMMIT=$(git rev-parse --short HEAD)

# Build all production images
docker-compose -f docker-compose.production.yml build \
  --build-arg VERSION=$VERSION \
  --build-arg BUILD_TIME=$BUILD_TIME \
  --build-arg GIT_COMMIT=$GIT_COMMIT

# Tag and push to registry (if using)
docker tag quantumbeam-api:latest ghcr.io/yourusername/quantumbeam-api:$VERSION
docker push ghcr.io/yourusername/quantumbeam-api:$VERSION
```

### Step 4: Deploy Services

```bash
# Option A: Automated deployment script
./scripts/deploy-production.sh

# Option B: Manual deployment
docker-compose -f docker-compose.production.yml up -d

# Option C: Kubernetes
kubectl apply -f k8s/production/

# Option D: Railway
railway up
```

### Step 5: Verify Deployment

```bash
# 1. Check health
curl http://localhost:8080/health/detailed | jq

# 2. Run smoke tests
./scripts/deploy-production.sh smoke-test

# 3. Check all services
docker-compose -f docker-compose.production.yml ps

# 4. View logs
docker-compose -f docker-compose.production.yml logs -f api

# 5. Test fraud detection
curl -X POST http://localhost:8080/api/v1/fraud/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn_test_001",
    "amount": 1500.00,
    "user_id": "user_123",
    "merchant_id": "merchant_456"
  }'
```

### Step 6: Deploy Website

```bash
# Deploy marketing website
cd web/marketing

# Build production site
npm run build

# Deploy to Vercel
vercel --prod

# Or deploy to Cloudflare Pages
npx wrangler pages deploy out --project-name=quantumbeam

# Or deploy to Netlify
netlify deploy --prod --dir=out
```

### Step 7: Configure Monitoring

```bash
# 1. Access Grafana
open http://localhost:3000
# Login: admin / (check .env.production for password)

# 2. Configure alerting
# - Set up Slack webhook in .env.production
# - Configure alert rules in config/prometheus/rules/

# 3. Set up uptime monitoring
# - Use UptimeRobot or Pingdom
# - Monitor: http://yourdomain.com/health

# 4. Configure log aggregation (optional)
# - Set up ELK stack or Datadog
```

### Step 8: Set Up Domain and SSL

```bash
# 1. Point your domain to server
# Add A record: @ -> YOUR_SERVER_IP
# Add A record: www -> YOUR_SERVER_IP

# 2. Generate SSL certificates (Let's Encrypt)
certbot certonly --standalone -d quantumbeam.io -d www.quantumbeam.io

# 3. Or use Cloudflare SSL (if using Cloudflare Pages)
# Automatic SSL provisioning

# 4. Update nginx configuration
# Edit config/nginx/nginx.conf with SSL settings

# 5. Restart nginx
docker-compose -f docker-compose.production.yml restart nginx
```

## 🌍 Specific Platform Deployment Guides

### AWS Deployment

```bash
# 1. Set up AWS credentials
aws configure

# 2. Create ECR repository
aws ecr create-repository --repository-name quantumbeam-api

# 3. Build and push image
$(aws ecr get-login --no-include-email)
docker build -t quantumbeam-api -f Dockerfile.production .
docker tag quantumbeam-api:latest $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/quantumbeam-api:latest
docker push $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/quantumbeam-api:latest

# 4. Deploy to ECS/EKS
# Use AWS Console or Terraform
```

### Google Cloud Deployment

```bash
# 1. Set up gcloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Build and push to GCR
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/quantumbeam-api

# 3. Deploy to Cloud Run
gcloud run deploy quantumbeam-api \
  --image gcr.io/YOUR_PROJECT_ID/quantumbeam-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# 4. Or deploy to GKE
gcloud container clusters create quantumbeam-cluster
kubectl apply -f k8s/production/
```

### Azure Deployment

```bash
# 1. Login to Azure
az login

# 2. Create resource group
az group create --name quantumbeam-rg --location eastus

# 3. Create container registry
az acr create --resource-group quantumbeam-rg \
  --name quantumbeamregistry --sku Basic

# 4. Build and push
az acr build --registry quantumbeamregistry \
  --image quantumbeam-api:latest \
  -f Dockerfile.production .

# 5. Deploy to AKS or Container Instances
az container create --resource-group quantumbeam-rg \
  --name quantumbeam-api \
  --image quantumbeamregistry.azurecr.io/quantumbeam-api:latest
```

## 🔐 Security Checklist

- [ ] All secrets stored securely (Vault/AWS Secrets Manager)
- [ ] Database credentials rotated
- [ ] SSL/TLS certificates installed
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] DDoS protection enabled (Cloudflare)
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] API authentication enforced
- [ ] Logging and monitoring enabled
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan tested

## 📊 Post-Deployment Verification

### Health Checks

```bash
# Basic health
curl https://api.quantumbeam.io/health

# Detailed health
curl https://api.quantumbeam.io/health/detailed | jq

# Readiness
curl https://api.quantumbeam.io/health/ready

# Metrics
curl https://api.quantumbeam.io/metrics
```

### Performance Testing

```bash
# Load test with Apache Bench
ab -n 1000 -c 10 https://api.quantumbeam.io/health

# Load test with k6
k6 run tests/load/fraud-detection.js

# Stress test
wrk -t12 -c400 -d30s https://api.quantumbeam.io/health
```

### Smoke Tests

```bash
# Run automated smoke tests
./scripts/deploy-production.sh smoke-test

# Manual API tests
curl -X POST https://api.quantumbeam.io/api/v1/fraud/analyze \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/sample-transaction.json
```

## 🔄 Continuous Deployment

### GitHub Actions

Create `.github/workflows/production-deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Production
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SERVER_HOST: ${{ secrets.SERVER_HOST }}
        run: |
          ./scripts/deploy-production.sh
```

### GitLab CI/CD

Create `.gitlab-ci.yml`:

```yaml
production:
  stage: deploy
  script:
    - ./scripts/deploy-production.sh
  only:
    - main
    - tags
  environment:
    name: production
    url: https://api.quantumbeam.io
```

## 📈 Monitoring URLs

After deployment, access:

- **API**: https://api.quantumbeam.io
- **Website**: https://quantumbeam.io
- **Grafana**: https://monitoring.quantumbeam.io:3000
- **Prometheus**: https://monitoring.quantumbeam.io:9090
- **Health**: https://api.quantumbeam.io/health/detailed

## 🆘 Rollback Procedure

If something goes wrong:

```bash
# Automatic rollback (if smoke tests fail)
# The deployment script handles this automatically

# Manual rollback
./scripts/deploy-production.sh rollback

# Or restore from backup
make db-restore FILE=backups/pre-production-20250107.sql
docker-compose -f docker-compose.production.yml down
git checkout previous-stable-tag
./scripts/deploy-production.sh
```

## 📞 Support

- **Documentation**: https://docs.quantumbeam.io
- **Status Page**: https://status.quantumbeam.io
- **Support Email**: support@quantumbeam.io
- **Emergency**: ops@quantumbeam.io

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Secrets generated and stored
- [ ] Database backed up
- [ ] Docker images built
- [ ] SSL certificates ready
- [ ] DNS configured

### Deployment
- [ ] Services deployed
- [ ] Health checks passing
- [ ] Smoke tests passing
- [ ] Website deployed
- [ ] Monitoring configured

### Post-Deployment
- [ ] Performance tested
- [ ] Logs reviewed
- [ ] Alerts configured
- [ ] Documentation updated
- [ ] Team notified

---

**Deployment Date**: 2025-01-07
**Version**: 1.0.0
**Status**: ✅ Ready for Production
