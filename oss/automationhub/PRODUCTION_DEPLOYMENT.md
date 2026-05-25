# UPM.Plus Production Deployment Guide

## Overview

This guide covers deploying UPM.Plus to production environments. The system consists of:
- **Backend API** (FastAPI/Python)
- **Frontend Web App** (React/TypeScript)
- **Desktop App** (Vue/Tauri)
- **Cloudflare Workers** (Edge computing)
- **Infrastructure** (AWS EKS, RDS, Redis, S3)

## Prerequisites

### Required Services
- **Python 3.10+**
- **Node.js 18+**
- **Redis 7+**
- **PostgreSQL 14+** (or SQLite for development)
- **Docker** (optional, for containerized deployment)

### Required API Keys
- OpenAI API Key (for LLM features)
- Anthropic API Key (optional, for Claude)
- Cloudflare API Token (for edge deployment)
- AWS Credentials (for infrastructure deployment)

## Quick Start (Development)

```bash
# 1. Clone repository
git clone <repository-url>
cd automationhub

# 2. Setup backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# 4. Initialize database
python -c "from app.core.database import init_database, create_tables; import asyncio; asyncio.run(create_tables())"

# 5. Start Redis (if not running)
redis-server

# 6. Start backend
uvicorn app.main:app --reload --port 8000

# 7. Setup frontend (in another terminal)
cd frontend
npm install
npm start
```

## Production Deployment

### Option 1: Docker Compose (Recommended for Single Server)

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down
```

### Option 2: Kubernetes (AWS EKS)

```bash
# 1. Setup Terraform variables
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars

# 2. Initialize Terraform
terraform init

# 3. Plan deployment
terraform plan

# 4. Apply infrastructure
terraform apply

# 5. Deploy application
kubectl apply -f deployments/production/
```

### Option 3: Cloudflare Workers (Edge Deployment)

```bash
# 1. Setup Cloudflare credentials
export CLOUDFLARE_API_TOKEN="your-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"

# 2. Deploy workers
cd cloudflare-workers
npm install
npm run deploy:production

# 3. Setup D1 database
npm run db:migrate:production
```

## Environment Configuration

### Backend Environment Variables

Create `.env` file in `backend/` directory:

```env
# Application
ENVIRONMENT=production
DEBUG=False
SECRET_KEY=your-secret-key-here

# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/upmplus

# Redis
REDIS_URL=redis://localhost:6379/0

# AI Services
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Vector Database
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Cloudflare D1 (if using)
CLOUDFLARE_D1_DATABASE_URL=your-d1-url
CLOUDFLARE_D1_ACCOUNT_ID=your-account-id
CLOUDFLARE_D1_API_TOKEN=your-token

# Security
BCRYPT_ROUNDS=12
MFA_ENCRYPTION_KEY=your-mfa-key
```

### Frontend Environment Variables

Create `.env` file in `frontend/` directory:

```env
REACT_APP_API_URL=http://localhost:8000/api/v1
REACT_APP_WS_URL=ws://localhost:8000/ws
```

## Database Migrations

```bash
cd backend

# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

## Monitoring & Health Checks

### Health Endpoints

- **Backend Health**: `GET /health`
- **API Gateway Health**: `GET /api/v1/gateway/health`
- **Agent Status**: `GET /api/v1/agents/{id}/status`

### Monitoring Setup

1. **Prometheus Metrics**: Available at `/metrics`
2. **Sentry Error Tracking**: Configure `SENTRY_DSN` in environment
3. **Logging**: Structured logs to stdout (JSON format)

## Security Checklist

- [ ] Change default `SECRET_KEY`
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable MFA for admin users
- [ ] Configure firewall rules
- [ ] Set up backup strategy
- [ ] Enable audit logging
- [ ] Review API key permissions
- [ ] Set up intrusion detection

## Scaling Considerations

### Horizontal Scaling

- **Backend**: Use load balancer with multiple FastAPI instances
- **Redis**: Use Redis Cluster for high availability
- **Database**: Use read replicas for read-heavy workloads
- **Workers**: Cloudflare Workers auto-scale globally

### Vertical Scaling

- **Database**: Increase instance size for larger datasets
- **Redis**: Increase memory allocation
- **Backend**: Increase CPU/memory for compute-intensive tasks

## Backup & Recovery

### Database Backups

```bash
# PostgreSQL backup
pg_dump -h localhost -U user -d upmplus > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U user -d upmplus < backup_YYYYMMDD.sql
```

### Redis Backup

```bash
# Create snapshot
redis-cli BGSAVE

# Copy RDB file
cp /var/lib/redis/dump.rdb /backup/redis_$(date +%Y%m%d).rdb
```

## Troubleshooting

### Common Issues

1. **Backend won't start**
   - Check Redis connection
   - Verify database credentials
   - Check port 8000 is available

2. **Agents not registering**
   - Verify task executor initialization
   - Check agent registry logs
   - Ensure database tables exist

3. **Frontend can't connect**
   - Verify API_URL environment variable
   - Check CORS configuration
   - Verify backend is running

4. **Workflow execution fails**
   - Check agent availability
   - Verify task executor is running
   - Review execution logs

### Log Locations

- **Backend**: stdout/stderr (container logs)
- **Frontend**: Browser console
- **Workers**: Cloudflare Dashboard > Workers > Logs

## Support & Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Review error logs, check disk space
2. **Monthly**: Update dependencies, review security patches
3. **Quarterly**: Performance optimization, capacity planning

### Getting Help

- **Documentation**: See `/docs` directory
- **API Docs**: http://your-domain/docs
- **Issues**: GitHub Issues
- **Support**: support@upm.plus

## Performance Optimization

### Backend Optimization

- Enable connection pooling
- Use Redis caching for frequently accessed data
- Optimize database queries with indexes
- Use async/await for I/O operations

### Frontend Optimization

- Enable code splitting
- Use React Query caching
- Optimize bundle size
- Enable CDN for static assets

## Next Steps

1. Set up CI/CD pipeline
2. Configure monitoring alerts
3. Set up backup automation
4. Plan for disaster recovery
5. Document runbooks for common operations


