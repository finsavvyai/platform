# RAG System Deployment Guide

## 🏗️ Current Architecture Overview

Your RAG system is designed to run with Docker Compose and includes:

- **Qdrant**: Vector database for embeddings (port 6333)
- **PostgreSQL**: Main application database (port 5432) 
- **Redis**: Cache and session storage (port 6379)
- **Elasticsearch**: Additional search capabilities (port 9200)
- **RabbitMQ**: Message queue for async processing (port 5672)
- **MinIO**: S3-compatible file storage (port 9000)
- **Monitoring**: Grafana (3001), Prometheus (9090), Jaeger (16686)

## 🚀 Quick Start - Local Deployment

### 1. Start the Infrastructure
```bash
# From your project root
cd /Users/shaharsolomon/dev/projects/claude-agent

# Start all services
docker-compose up -d

# Check if services are running
docker-compose ps
```

### 2. Start the RAG API Server
```bash
# Navigate to API package
cd packages/api

# Install dependencies
npm install

# Start the API server (in development mode)
npm run start:dev

# Or build and run in production mode
npm run build
npm run start:prod
```

### 3. Configure Environment Variables
```bash
# Create .env file in packages/api/
cp packages/api/.env.example packages/api/.env

# Edit with your API keys:
OPENAI_API_KEY=your_openai_api_key_here
QDRANT_HOST=localhost
QDRANT_PORT=6333
DATABASE_URL=postgresql://claude_user:claude_password@localhost:5432/claude_agent
REDIS_URL=redis://:redis_password@localhost:6379
JWT_SECRET=your_jwt_secret_here
```

### 4. Update Luna Plugin Configuration
```bash
# Edit luna-agents/.claude-plugin/lib/api-client.js
# Update the baseURL to point to your local API:
baseURL: 'http://localhost:3000/api/v1'
```

## 🌐 Production Deployment Options

### Option A: Railway (Recommended for Easy Deployment)
```bash
# 1. Deploy API to Railway
cd packages/api
# Connect to Railway and deploy from GitHub

# 2. Update environment variables in Railway dashboard
# 3. Use managed Qdrant or deploy to Railway

# 4. Update plugin to point to Railway URL
```

### Option B: Vercel + External Services
```bash
# 1. Deploy API to Vercel
cd packages/api
vercel --prod

# 2. Use external services:
# - Qdrant Cloud (https://cloud.qdrant.io/)
# - Railway/Render for PostgreSQL
# - Upstash for Redis

# 3. Update environment variables in Vercel
```

### Option C: Full Docker Cloud Deployment
```bash
# 1. Deploy to cloud provider (AWS, GCP, Azure)
# 2. Use docker-compose.prod.yml
# 3. Configure cloud databases and services
# 4. Set up load balancer and SSL
```

## 🔧 Service URLs and Ports

### Local Development
```bash
RAG API:          http://localhost:3000
Qdrant Dashboard: http://localhost:6333/dashboard
PostgreSQL:       localhost:5432
Redis:            localhost:6379
Elasticsearch:    http://localhost:9200
RabbitMQ UI:      http://localhost:15672
MinIO Console:   http://localhost:9001
Grafana:         http://localhost:3001
Prometheus:      http://localhost:9090
Jaeger UI:       http://localhost:16686
```

### Environment Variables Required
```bash
# Core RAG Services
OPENAI_API_KEY=sk-...
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=your_qdrant_key

# Database & Cache
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Authentication
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Optional: Alternative Vector DBs
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...
WEAVIATE_URL=...
```

## 🔍 Verification Steps

### 1. Check Infrastructure Health
```bash
# Check Docker services
docker-compose ps

# Check individual service logs
docker-compose logs qdrant
docker-compose logs postgres
```

### 2. Test API Endpoints
```bash
# Test API health
curl http://localhost:3000/api/v1/health

# Test RAG status
curl http://localhost:3000/api/v1/rag/status

# Test vector database
curl http://localhost:6333/collections
```

### 3. Test Plugin Integration
```bash
# In Claude Code, test RAG capabilities:
"Check RAG system status"
"What's the current indexing status?"
```

## 📊 Monitoring and Observability

### Grafana Dashboards
- URL: http://localhost:3001
- Default login: admin/claude_password
- Pre-configured dashboards for:
  - System metrics
  - RAG performance
  - Vector database stats

### Jaeger Tracing
- URL: http://localhost:16686
- Trace RAG operations and API calls
- Debug performance issues

## 🚨 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using ports
   lsof -i :3000
   lsof -i :6333
   
   # Kill conflicting processes
   kill -9 <PID>
   ```

2. **Qdrant Connection Issues**
   ```bash
   # Check Qdrant logs
   docker-compose logs qdrant
   
   # Test Qdrant directly
   curl http://localhost:6333/health
   ```

3. **API Server Issues**
   ```bash
   # Check API logs
   cd packages/api
   npm run start:dev
   
   # Check environment variables
   printenv | grep -E "(OPENAI|QDRANT|DATABASE)"
   ```

4. **Plugin Connection Issues**
   ```bash
   # Test API from plugin
   cd luna-agents/.claude-plugin
   node -e "
   const client = require('./lib/api-client');
   console.log('Testing connection...');
   "
   ```

## 🔄 Development Workflow

### 1. Make Changes to RAG System
```bash
# Edit code in packages/rag/ or packages/api/src/modules/rag/

# Restart API server
cd packages/api
npm run start:dev
```

### 2. Test Changes
```bash
# Test in Claude Code
"Re-index the project with latest changes"

# Or test API directly
curl -X POST http://localhost:3000/api/v1/rag/repository/index \
  -H "Content-Type: application/json" \
  -d '{"repositoryPath": "/path/to/test"}'
```

### 3. Deploy Changes
```bash
# For local changes, just restart the API
# For production, commit and push to trigger deployment
git add .
git commit -m "feat: Update RAG system"
git push origin main
```

## 📈 Scaling Considerations

### Local Development
- Use Docker Compose for full stack
- Limit vector database size for performance
- Use file-based storage for simplicity

### Production
- Use managed vector databases (Qdrant Cloud, Pinecone)
- Implement proper authentication and rate limiting
- Set up monitoring and alerting
- Use load balancers for high availability
- Implement proper backup strategies

## 🎯 Next Steps

1. **Start Local Development**
   ```bash
   docker-compose up -d
   cd packages/api && npm run start:dev
   ```

2. **Configure Claude Code Plugin**
   ```bash
   # Edit plugin to point to local API
   # Test integration
   ```

3. **Deploy to Production**
   ```bash
   # Choose deployment option (Railway/Vercel/Cloud)
   # Configure production environment
   # Deploy and monitor
   ```

Your RAG system is ready to deploy! 🚀