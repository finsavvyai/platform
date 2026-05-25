# Quick Start Guide

Get SDLC.ai running locally in under 5 minutes. This guide will walk you through setting up the complete development environment with all services.

## 🚋 Prerequisites

### Required Software
- **Docker** 20.10+ and **Docker Compose** v2.0+
- **Git** for cloning the repository
- **Node.js** 18+ (for Admin UI development)
- **Make** (optional, for convenience commands)

### System Requirements
- **RAM**: 8GB+ recommended
- **Disk**: 10GB+ free space
- **CPU**: 4+ cores recommended

### API Keys (Optional)
- OpenAI API key (for embeddings)
- Anthropic API key (for LLM)

## ⚡ Quick Setup

### 1. Clone the Repository

```bash
git clone https://github.com/finsavvyai/sdlc-platform.git
cd platform
```

### 2. Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your configuration
nano .env
```

**Minimal `.env` for development:**
```bash
# Core Configuration
ENVIRONMENT=development
DEBUG=true

# Database (PostgreSQL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/sdlc_dev
POSTGRES_PASSWORD=password

# Cache (Redis)
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SIGNING_KEY=dev-jwt-signing-key-change-in-production
OIDC_CLIENT_ID=dev-client-id

# AI Services (Optional but recommended)
OPENAI_API_KEY=your-openai-key-here
ANTHROPIC_API_KEY=your-anthropic-key-here

# Storage
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
```

### 3. Start All Services

```bash
# Using Docker Compose (recommended)
npm run docker:dev

# Or directly with Docker Compose
docker-compose -f docker-compose.dev.yml up --build
```

**What happens:**
- All 4 core services are built and started
- PostgreSQL, Redis, MinIO, and supporting services start automatically
- Health checks verify each service is running
- Logs stream to your terminal

### 4. Verify Installation

Once all services are running, verify they're accessible:

| Service | URL | Description |
|---------|-----|-------------|
| Gateway API | http://localhost:8080 | Main API gateway |
| RAG Service | http://localhost:8001 | Document processing |
| Vector Core | http://localhost:8002 | Embedding & search |
| Admin UI | http://localhost:3000 | Management dashboard |
| Grafana | http://localhost:3001 | Monitoring dashboard |
| MinIO Console | http://localhost:9001 | Object storage UI |

**Quick health check:**
```bash
# Test all services
curl http://localhost:8080/health    # Gateway
curl http://localhost:8001/health    # RAG
curl http://localhost:8002/health    # Vector Core
curl http://localhost:3000/api/health # Admin UI
```

## 🎯 First Steps

### 1. Create a Test Tenant

```bash
# Using the Gateway API
curl -X POST http://localhost:8080/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Organization",
    "domain": "test.example.com",
    "settings": {
      "max_documents": 1000,
      "max_tokens_per_month": 100000
    }
  }'
```

### 2. Upload and Process a Document

```bash
# Create a test document
echo "This is a test document for SDLC.ai platform." > test.txt

# Upload via RAG service
curl -X POST http://localhost:8001/api/v1/documents \
  -F "file=@test.txt" \
  -F "metadata={\"title\": \"Test Document\"}"
```

### 3. Query Your Documents

```bash
# Ask a question about your document
curl -X POST http://localhost:8001/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is this document about?",
    "model": "gpt-3.5-turbo",
    "max_context_documents": 3
  }'
```

### 4. Explore the Admin UI

1. Open http://localhost:3000 in your browser
2. Sign in with default credentials (admin/admin)
3. Navigate through:
   - Dashboard: Overview of system metrics
   - Documents: View uploaded documents
   - Policies: Configure access rules
   - Users: Manage user accounts

## 🛠 Development Mode

### Individual Service Development

For focused development on a specific service:

```bash
# Start only dependencies (databases, etc.)
docker-compose -f docker-compose.dev.yml up postgres redis minio -d

# Start individual services
npm run dev:gateway    # Go Gateway
npm run dev:rag        # Python RAG Service
npm run dev:vector     # Rust Vector Core
npm run dev:admin      # Next.js Admin UI
```

### Code Examples

**Gateway (Go)**
```bash
cd services/gateway
go run cmd/main.go
```

**RAG Service (Python)**
```bash
cd services/rag
uvicorn app.main:app --reload --port 8001
```

**Vector Core (Rust)**
```bash
cd services/vector-core
cargo run
```

**Admin UI (TypeScript)**
```bash
cd services/admin-ui
npm run dev
```

## 🧪 Testing Your Setup

### Run Integration Tests

```bash
# Run the full test suite
npm run test

# Run integration tests specifically
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

### Load Testing (Optional)

```bash
# Install k6
curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz

# Run a simple load test
cd tests/performance
../../k6 run basic-load-test.js
```

## 🔍 Monitoring & Debugging

### View Logs

```bash
# View all service logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific service logs
docker-compose -f docker-compose.dev.yml logs -f gateway
docker-compose -f docker-compose.dev.yml logs -f rag
```

### Access Monitoring Tools

- **Grafana Dashboard**: http://localhost:3001 (admin/admin)
  - System metrics and alerts
  - Service performance graphs
  - Custom dashboards

- **Jaeger Tracing**: http://localhost:16686
  - Distributed request tracing
  - Service dependency mapping
  - Performance bottleneck identification

### Database Access

```bash
# Connect to PostgreSQL
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d sdlc_dev

# Connect to Redis
docker-compose -f docker-compose.dev.yml exec redis redis-cli
```

## 🆘 Common Issues

### Port Conflicts
If ports are already in use:
```bash
# Check what's using the ports
lsof -i :8080
lsof -i :3000

# Kill conflicting processes or change ports in .env
```

### Docker Issues
```bash
# Clean up Docker if needed
docker system prune -a
docker volume prune

# Rebuild from scratch
docker-compose -f docker-compose.dev.yml down --volumes
docker-compose -f docker-compose.dev.yml up --build --force-recreate
```

### Memory Issues
If you run out of RAM:
1. Reduce Docker memory limits in `docker-compose.dev.yml`
2. Close unnecessary applications
3. Add swap space if needed

### Permission Issues
```bash
# Fix Docker permissions (Linux/Mac)
sudo chown -R $USER:$USER .

# Fix permission denied errors
docker-compose -f docker-compose.dev.yml down
sudo rm -rf postgres_data/ redis_data/
docker-compose -f docker-compose.dev.yml up
```

## 📚 Next Steps

### Learn More
- [Development Guide](./development/development-setup.md) - Detailed development setup
- [API Documentation](./api/overview.md) - Complete API reference
- [Architecture Guide](./architecture/system-overview.md) - System design
- [Security Guide](./security/overview.md) - Security features

### Common Development Tasks
- [Adding a New Service](./development/service-development.md)
- [Writing Tests](./development/testing.md)
- [Debugging](./development/debugging.md)
- [Performance Tuning](./development/performance-tuning.md)

### Production Deployment
- [Deployment Guide](./deployment/deployment.md) - Production setup
- [Configuration](./configuration.md) - All configuration options
- [Monitoring](./operations/monitoring.md) - Production monitoring

## 🤝 Getting Help

- **Documentation**: [docs.sdlc.cc](https://docs.sdlc.cc)
- **Issues**: [GitHub Issues](https://github.com/finsavvyai/sdlc-platform/issues)
- **Discussions**: [GitHub Discussions](https://github.com/finsavvyai/sdlc-platform/discussions)
- **Discord**: [SDLC.ai Discord](https://discord.gg/sdlc)

---

**Installation Time**: ~5 minutes  
**Default Credentials**: admin/admin  
**Support**: support@sdlc.cc