# UPM.Plus Enterprise Quick Start Guide

Get your enterprise automation platform running in under 10 minutes.

## Prerequisites

- **Docker** 20.10+ with Docker Compose
- **8GB RAM** minimum (16GB recommended)
- **20GB disk space**
- **Ports**: 3000, 8001, 5432, 6379 available

## Quick Deploy (3 Steps)

### Step 1: Clone and Navigate

```bash
git clone https://github.com/your-org/upm-plus.git
cd upm-plus
```

### Step 2: Deploy

```bash
./deploy.sh
```

This will:
- Build all Docker images
- Start all services (PostgreSQL, Redis, ChromaDB, Backend, Frontend, Celery workers)
- Run database migrations
- Configure monitoring (Prometheus, Grafana)

### Step 3: Access

Open your browser to:
- **Application**: http://localhost:3000
- **API Documentation**: http://localhost:8001/docs

## First-Time Setup

### 1. Create Admin Account

1. Navigate to http://localhost:3000/register
2. Fill in your details
3. The first registered user automatically becomes a Super Admin

### 2. Configure AI Services (Optional)

For AI-powered features, add your API keys:

1. Go to **Settings** → **Integrations**
2. Add your OpenAI or Anthropic API key
3. Save and test the connection

### 3. Create Your First Workflow

1. Click **Workflows** in the sidebar
2. Click **New Workflow**
3. Use the visual designer to create your automation
4. Click **Execute** to run it

## Production Configuration

### Environment Variables

Edit `.env` file for production settings:

```bash
# Required for production
ENVIRONMENT=production
SECRET_KEY=your-secure-secret-key-min-64-chars

# Database (use strong password)
POSTGRES_PASSWORD=your-strong-database-password

# Optional: AI Services
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Optional: Billing (Stripe)
STRIPE_SECRET_KEY=sk_live_your-stripe-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Optional: Email Notifications
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
```

### SSL/HTTPS Setup

For production, configure SSL:

1. Update `deployment/kubernetes/ingress.yaml` with your domain
2. Install cert-manager for automatic SSL certificates
3. Apply the ingress configuration

## Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Main web application |
| Backend API | http://localhost:8001 | REST API |
| API Docs | http://localhost:8001/docs | Swagger documentation |
| Flower | http://localhost:5555 | Celery task monitoring |
| Prometheus | http://localhost:9090 | Metrics collection |
| Grafana | http://localhost:3001 | Monitoring dashboards |

## Common Commands

```bash
# Start services
./deploy.sh start

# Stop services
./deploy.sh stop

# View logs
./deploy.sh logs

# View specific service logs
./deploy.sh logs backend

# Restart services
./deploy.sh restart

# Check service status
./deploy.sh status

# Full cleanup (removes all data)
./deploy.sh clean
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
        ┌─────▼─────┐                   ┌─────▼─────┐
        │  Frontend │                   │  Backend  │
        │  (React)  │                   │ (FastAPI) │
        └───────────┘                   └─────┬─────┘
                                              │
        ┌──────────────────┬──────────────────┼──────────────────┐
        │                  │                  │                  │
  ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
  │ PostgreSQL│     │   Redis   │     │  ChromaDB │     │  Celery   │
  │ (Database)│     │  (Cache)  │     │ (Vectors) │     │ (Workers) │
  └───────────┘     └───────────┘     └───────────┘     └───────────┘
```

## Feature Highlights

### Workflow Automation
- Visual drag-and-drop workflow designer
- 50+ pre-built workflow templates
- Conditional logic and branching
- Scheduled and event-triggered execution

### AI Agents
- Pre-configured AI agents for common tasks
- Custom agent creation with natural language
- Multi-agent collaboration
- Self-healing automation

### Browser Automation
- Playwright-powered browser control
- Multi-browser session management
- Visual element selection
- AI-powered selector healing

### Enterprise Features
- SSO/SAML integration
- Role-based access control
- Audit logging
- Multi-tenant support
- Usage-based billing

## Scaling for Production

### Kubernetes Deployment

For high-availability deployments:

```bash
# Apply Kubernetes configurations
kubectl apply -f deployment/kubernetes/

# Scale backend replicas
kubectl scale deployment/backend --replicas=3

# Scale Celery workers
kubectl scale deployment/celery-worker --replicas=5
```

### Resource Recommendations

| Component | CPU | Memory | Replicas |
|-----------|-----|--------|----------|
| Backend | 1 core | 2GB | 2-4 |
| Frontend | 0.5 core | 512MB | 2 |
| Celery Worker | 2 cores | 4GB | 3-10 |
| PostgreSQL | 2 cores | 4GB | 1 (with replicas) |
| Redis | 1 core | 1GB | 1 (with sentinel) |
| ChromaDB | 2 cores | 4GB | 1-3 |

## Troubleshooting

### Services Won't Start

```bash
# Check Docker status
docker info

# Check service logs
./deploy.sh logs

# Restart Docker
sudo systemctl restart docker
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Access database shell
docker-compose exec postgres psql -U upmplus -d upmplus
```

### API Not Responding

```bash
# Check backend logs
./deploy.sh logs backend

# Test health endpoint
curl http://localhost:8001/health
```

### Frontend Not Loading

```bash
# Check frontend logs
./deploy.sh logs frontend

# Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend
```

## Support

- **Documentation**: https://docs.upm.plus
- **API Reference**: http://localhost:8001/docs
- **Email Support**: support@upm.plus
- **Enterprise Support**: enterprise@upm.plus

## License

UPM.Plus Enterprise Edition - All rights reserved.

---

**Ready to automate?** Start creating workflows at http://localhost:3000

