#!/bin/bash

# Questro SaaS - Deployment Configuration Generator
# Generates deployment configs for multiple cloud providers

set -e

SCRIPT_VERSION="1.0.0"
echo "🛠️  Questro Deployment Config Generator v$SCRIPT_VERSION"
echo "================================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Create deployment configs directory
mkdir -p deployment-configs
cd deployment-configs

print_status "Generating deployment configurations..."

# 1. Render.com Blueprint
cat > render.yaml << 'EOF'
# Render.com Blueprint for Questro SaaS
services:
  # Backend API Service
  - type: web
    name: questro-api
    env: node
    region: oregon
    plan: starter
    buildCommand: cd backend && npm ci && npm run build
    startCommand: cd backend && npm start
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: USE_SUPABASE
        value: true
      - key: RUN_MIGRATIONS
        value: true
      - key: JWT_SECRET
        generateValue: true
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: SUPABASE_DB_HOST
        sync: false
      - key: SUPABASE_DB_PASSWORD
        sync: false
      - key: FRONTEND_URL
        fromService:
          type: web
          name: questro-frontend
          property: host
      - key: ENABLE_RECORDING
        value: true
      - key: ENABLE_MOBILE_TESTING
        value: true
      - key: ENABLE_WEB_TESTING
        value: true
      - key: LOG_LEVEL
        value: info
    
  # Frontend Static Site
  - type: web
    name: questro-frontend
    env: static
    buildCommand: cd frontend && npm ci && npm run build
    staticPublishPath: frontend/dist
    pullRequestPreviewsEnabled: true
    headers:
      - path: /*
        name: X-Frame-Options
        value: DENY
      - path: /*
        name: X-Content-Type-Options
        value: nosniff
    envVars:
      - key: VITE_APP_ENV
        value: production
      - key: VITE_API_BASE_URL
        fromService:
          type: web
          name: questro-api
          property: host
      - key: VITE_ENABLE_RECORDING
        value: true
      - key: VITE_ENABLE_MOBILE_TESTING
        value: true
      - key: VITE_ENABLE_WEB_TESTING
        value: true
      - key: VITE_ENABLE_ANALYTICS
        value: true
EOF

# 2. Vercel Configuration
cat > vercel.json << 'EOF'
{
  "version": 2,
  "name": "questro-saas",
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    },
    {
      "src": "backend/index.js",
      "use": "@vercel/node",
      "config": {
        "includeFiles": ["backend/**"]
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/backend/index.js"
    },
    {
      "handle": "filesystem"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/index.html"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "backend/index.js": {
      "maxDuration": 30
    }
  }
}
EOF

# 3. Netlify Configuration
cat > netlify.toml << 'EOF'
[build]
  command = "cd frontend && npm ci && npm run build"
  publish = "frontend/dist"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "18"
  NPM_FLAGS = "--production=false"

[[redirects]]
  from = "/api/*"
  to = "https://questro-api.railway.app/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[dev]
  command = "cd frontend && npm run dev"
  port = 3000
  targetPort = 3000

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
EOF

# 4. Railway Configuration
cat > railway.toml << 'EOF'
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[environments.production.variables]
NODE_ENV = "production"

[[services]]
name = "questro-backend"
source = "backend/"

[services.questro-backend.variables]
PORT = "8080"

[[services]]
name = "questro-frontend"
source = "frontend/"
EOF

# 5. Docker Compose for Production
cat > docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: questro_prod
      POSTGRES_USER: questro
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/sql:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U questro -d questro_prod"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: production
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=postgresql://questro:${DB_PASSWORD}@postgres:5432/questro_prod
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=https://questro.your-domain.com
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: production
      args:
        - VITE_API_BASE_URL=https://api.questro.your-domain.com
        - VITE_APP_ENV=production
    ports:
      - "3000:80"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  nginx_logs:

networks:
  default:
    driver: bridge
EOF

# 6. Kubernetes Manifests
mkdir -p kubernetes

cat > kubernetes/namespace.yaml << 'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: questro-prod
  labels:
    name: questro-prod
EOF

cat > kubernetes/backend-deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: questro-backend
  namespace: questro-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: questro-backend
  template:
    metadata:
      labels:
        app: questro-backend
    spec:
      containers:
      - name: backend
        image: questro/backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: questro-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: questro-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: questro-backend-service
  namespace: questro-prod
spec:
  selector:
    app: questro-backend
  ports:
  - port: 80
    targetPort: 3001
  type: ClusterIP
EOF

# 7. Heroku Configuration
cat > Procfile << 'EOF'
web: cd backend && npm start
EOF

cat > app.json << 'EOF'
{
  "name": "Questro SaaS",
  "description": "AI-Powered Testing Platform",
  "repository": "https://github.com/your-username/questro",
  "logo": "https://questro.io/logo.png",
  "keywords": ["testing", "automation", "saas", "ai"],
  "stack": "heroku-22",
  "buildpacks": [
    {
      "url": "heroku/nodejs"
    }
  ],
  "env": {
    "NODE_ENV": {
      "description": "Environment",
      "value": "production"
    },
    "JWT_SECRET": {
      "description": "JWT Secret Key",
      "generator": "secret"
    },
    "SUPABASE_URL": {
      "description": "Supabase Project URL"
    },
    "SUPABASE_ANON_KEY": {
      "description": "Supabase Anonymous Key"
    }
  },
  "addons": [
    "heroku-postgresql:essential-0",
    "heroku-redis:mini"
  ],
  "scripts": {
    "postdeploy": "cd backend && npm run db:migrate"
  }
}
EOF

# 8. DigitalOcean App Platform Spec
cat > digitalocean-app.yaml << 'EOF'
name: questro-saas
services:
- name: questro-api
  source_dir: /backend
  github:
    repo: your-username/questro
    branch: main
  run_command: npm start
  build_command: npm ci && npm run build
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  http_port: 3001
  health_check:
    http_path: /api/health
  envs:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: "3001"
  - key: USE_SUPABASE
    value: "true"

- name: questro-frontend
  source_dir: /frontend
  github:
    repo: your-username/questro
    branch: main
  build_command: npm ci && npm run build
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  http_port: 80
  routes:
  - path: /
  envs:
  - key: VITE_APP_ENV
    value: production
  - key: VITE_API_BASE_URL
    value: ${questro-api.PUBLIC_URL}

databases:
- name: questro-db
  engine: PG
  version: "13"
  size: db-s-1vcpu-1gb
EOF

# 9. Terraform Configuration
cat > main.tf << 'EOF'
# Terraform configuration for cloud deployment
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.0"
}

provider "aws" {
  region = var.aws_region
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "questro-saas"
}

# ECS Cluster
resource "aws_ecs_cluster" "questro_cluster" {
  name = "${var.app_name}-cluster"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "questro_backend" {
  family                   = "${var.app_name}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([
    {
      name  = "backend"
      image = "${aws_ecr_repository.questro_backend.repository_url}:latest"
      
      portMappings = [
        {
          containerPort = 3001
          protocol      = "tcp"
        }
      ]
      
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.questro.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
}
EOF

# 10. GitHub Actions Workflow
mkdir -p .github/workflows

cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy to Cloud

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd backend && npm ci
          cd ../frontend && npm ci
      
      - name: Run tests
        run: |
          cd backend && npm test
          cd ../frontend && npm test
      
      - name: Build application
        run: |
          cd backend && npm run build
          cd ../frontend && npm run build

  deploy-render:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Render
        uses: johnbeynon/render-deploy-action@v0.0.8
        with:
          service-id: ${{ secrets.RENDER_SERVICE_ID }}
          api-key: ${{ secrets.RENDER_API_KEY }}

  deploy-vercel:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
EOF

# Create deployment guide
cat > DEPLOYMENT_GUIDE.md << 'EOF'
# Questro SaaS Deployment Guide

This directory contains deployment configurations for multiple cloud providers.

## Quick Deploy Options

### 1. Render.com (Recommended for beginners)
```bash
# 1. Push code to GitHub
git add . && git commit -m "Deploy to Render" && git push

# 2. Go to https://render.com
# 3. Create new Blueprint
# 4. Connect your repository
# 5. Use render.yaml configuration
```

### 2. Vercel (Great for full-stack)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 3. Railway (Simple all-in-one)
```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Deploy
railway login
railway link
railway up
```

### 4. Docker (Self-hosted)
```bash
# Copy docker-compose.prod.yml to root
cp deployment-configs/docker-compose.prod.yml ../

# Set environment variables
export DB_PASSWORD=your_secure_password
export JWT_SECRET=your_jwt_secret

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## Configuration Files

- `render.yaml` - Render.com Blueprint
- `vercel.json` - Vercel configuration
- `netlify.toml` - Netlify configuration
- `railway.toml` - Railway configuration
- `docker-compose.prod.yml` - Docker production setup
- `kubernetes/` - Kubernetes manifests
- `digitalocean-app.yaml` - DigitalOcean App Platform
- `main.tf` - Terraform (AWS)

## Environment Variables Required

### Backend
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `FRONTEND_URL` - Frontend domain for CORS

### Frontend
- `VITE_API_BASE_URL` - Backend API URL
- `VITE_APP_ENV` - Environment (production)

## Database Setup

1. **Supabase** (Recommended)
   - Free tier: 500MB, 2 projects
   - Go to https://supabase.com
   - Create project and get connection details

2. **Railway PostgreSQL**
   - railway add postgresql
   - Free tier: 1GB

3. **Heroku Postgres**
   - Basic plan: $5/month

## Post-Deployment Checklist

- [ ] Database connected and migrations run
- [ ] Environment variables configured
- [ ] CORS origins updated
- [ ] SSL certificates configured
- [ ] Domain names pointed correctly
- [ ] Health checks passing
- [ ] Monitoring set up
- [ ] Backup strategy in place

## Troubleshooting

### Build Failures
- Check Node.js version (18+ required)
- Verify all dependencies in package.json
- Check environment variables

### Database Connection Issues
- Verify DATABASE_URL format
- Check network connectivity
- Ensure database exists

### CORS Errors
- Update CORS_ORIGIN environment variable
- Check frontend URL configuration

## Support

- Check logs in your deployment platform
- Review environment variable configuration
- Verify database connectivity
- Test API endpoints manually
EOF

cd ..
print_success "Deployment configurations generated!"

echo ""
echo "📁 Generated files in deployment-configs/:"
echo "   ├── render.yaml (Render.com)"
echo "   ├── vercel.json (Vercel)"
echo "   ├── netlify.toml (Netlify)"
echo "   ├── railway.toml (Railway)"
echo "   ├── docker-compose.prod.yml (Docker)"
echo "   ├── digitalocean-app.yaml (DigitalOcean)"
echo "   ├── main.tf (Terraform/AWS)"
echo "   ├── kubernetes/ (K8s manifests)"
echo "   ├── .github/workflows/deploy.yml (CI/CD)"
echo "   └── DEPLOYMENT_GUIDE.md (Instructions)"
echo ""
print_status "Copy the appropriate config to your project root and deploy!"