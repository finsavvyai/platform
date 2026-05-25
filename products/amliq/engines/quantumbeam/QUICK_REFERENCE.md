# ⚡ QuantumBeam Quick Reference

One-page reference for common operations.

---

## 🚀 Deployment Commands

```bash
# Local deployment (fastest)
./QUICK_DEPLOY.sh

# Check production readiness
./check-production.sh

# Railway (cloud)
railway login && railway up

# Fly.io (edge)
fly launch && fly deploy

# Vercel (website only)
cd web/marketing && vercel --prod

# Kubernetes
kubectl apply -f k8s/production/
```

---

## 🔧 Environment Setup

```bash
# Create environment file
cp .env.production.example .env.production

# Generate secrets
openssl rand -hex 32  # JWT_SECRET (64 chars)
openssl rand -hex 16  # API_KEY_ENCRYPTION_KEY (32 chars)

# Edit configuration
nano .env.production
```

**Required Variables:**
- `JWT_SECRET` - 64-character random string
- `POSTGRES_PASSWORD` - Strong database password
- `DATABASE_URL` - PostgreSQL connection string
- `API_KEY_ENCRYPTION_KEY` - 32-character random string

---

## 🏥 Health Checks

```bash
# Basic health
curl http://localhost:8080/health

# Liveness probe
curl http://localhost:8080/health/live

# Readiness probe
curl http://localhost:8080/health/ready

# Detailed health
curl http://localhost:8080/health/detailed
```

---

## 📊 Monitoring

```bash
# Prometheus metrics
curl http://localhost:8080/metrics

# Grafana dashboard
open http://localhost:3000

# Prometheus UI
open http://localhost:9090
```

---

## 🧪 Testing

```bash
# Run all tests
go test ./...

# Run specific package tests
go test ./internal/fraud/...

# Run with coverage
go test -cover ./...

# Integration tests
go test ./tests/integration/... -v

# Production tests
go test ./internal/fraud/... -tags=production
```

---

## 🐳 Docker Commands

```bash
# Build production image
docker build -f Dockerfile.production -t quantumbeam:latest .

# Run production stack
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f api

# Check status
docker-compose -f docker-compose.production.yml ps

# Stop all services
docker-compose -f docker-compose.production.yml down

# Restart a service
docker-compose -f docker-compose.production.yml restart api
```

---

## 🌐 Website Commands

```bash
# Install dependencies
cd web/marketing && npm install

# Development server
npm run dev

# Production build
npm run build

# Deploy to Vercel
vercel --prod

# Run locally
npm start
```

---

## 💾 Database Commands

```bash
# Connect to database
docker-compose exec postgres psql -U quantumbeam

# Run migrations
docker-compose run --rm api /app/migrate up

# Rollback migration
docker-compose run --rm api /app/migrate down

# Check migration status
docker-compose run --rm api /app/migrate version

# Database backup
docker-compose exec postgres pg_dump -U quantumbeam quantumbeam > backup.sql

# Restore database
docker-compose exec -T postgres psql -U quantumbeam < backup.sql
```

---

## 🔍 Debugging

```bash
# View API logs
docker-compose logs -f api

# View database logs
docker-compose logs -f postgres

# View all logs
docker-compose logs -f

# Check resource usage
docker stats

# List running containers
docker ps

# Inspect container
docker inspect quantumbeam_api

# Execute command in container
docker-compose exec api sh
```

---

## 🛠️ Troubleshooting

### Port already in use
```bash
# Find process using port 8080
lsof -i :8080

# Kill process
pkill -f quantumbeam
```

### Database connection issues
```bash
# Check database health
docker-compose exec postgres pg_isready

# Restart database
docker-compose restart postgres

# Check connection string
echo $DATABASE_URL
```

### Out of memory
```bash
# Check memory usage
docker stats

# Increase Docker memory limit
# Edit docker-compose.yml and add:
# mem_limit: 2g
```

### Services won't start
```bash
# Check logs for errors
docker-compose logs

# Restart all services
docker-compose restart

# Full rebuild
docker-compose down -v
docker-compose up -d --build
```

---

## 📈 Performance Testing

```bash
# Apache Bench (100 requests, 10 concurrent)
ab -n 100 -c 10 http://localhost:8080/health

# Load test with curl
for i in {1..100}; do
  curl -s http://localhost:8080/health > /dev/null &
done
wait

# Benchmark Go code
go test -bench=. ./...
```

---

## 🔒 Security

```bash
# Rotate secrets
openssl rand -hex 32 > /tmp/new-jwt-secret
# Update .env.production with new secret

# Scan Docker image
docker scan quantumbeam:latest

# Check for vulnerabilities
go list -json -m all | docker run -i sonatypecommunity/nancy:latest sleuth
```

---

## 📦 Build & Deploy

```bash
# Build Go binary
go build -o bin/quantumbeam ./cmd/api-server

# Build with version info
VERSION=$(git describe --tags)
go build -ldflags="-X main.Version=$VERSION" -o bin/quantumbeam ./cmd/api-server

# Build Docker image with tags
docker build -f Dockerfile.production \
  --build-arg VERSION=1.0.0 \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  -t quantumbeam:latest \
  -t quantumbeam:1.0.0 \
  .

# Push to registry
docker tag quantumbeam:latest your-registry/quantumbeam:latest
docker push your-registry/quantumbeam:latest
```

---

## 🎯 API Testing

```bash
# Test fraud detection endpoint
curl -X POST http://localhost:8080/api/v1/fraud/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "test_123",
    "amount": 1500.00,
    "user_id": "user_123",
    "quantum_features": true
  }'

# Get fraud result
curl http://localhost:8080/api/v1/fraud/results/test_123 \
  -H "Authorization: Bearer YOUR_API_KEY"

# Health check
curl http://localhost:8080/health/detailed
```

---

## 📚 Documentation Links

| Quick Access | File |
|--------------|------|
| **Start Here** | [START_HERE.md](START_HERE.md) |
| **Production Status** | [PRODUCTION_STATUS.md](PRODUCTION_STATUS.md) |
| **Quick Deploy** | [DEPLOY_NOW.txt](DEPLOY_NOW.txt) |
| **Platform Guides** | [DEPLOY_TO_PRODUCTION.md](DEPLOY_TO_PRODUCTION.md) |
| **Full README** | [README_PRODUCTION.md](README_PRODUCTION.md) |

---

## ⚡ Emergency Commands

```bash
# Stop everything
docker-compose down && pkill -f quantumbeam

# Full reset
docker-compose down -v
docker system prune -f
rm -rf data/

# Quick recovery
git reset --hard HEAD
./QUICK_DEPLOY.sh

# Rollback deployment
git checkout previous-commit
docker-compose up -d
```

---

## 📞 Support

- **Quick Check**: `./check-production.sh`
- **Deploy**: `./QUICK_DEPLOY.sh`
- **Documentation**: [START_HERE.md](START_HERE.md)
- **Email**: support@quantumbeam.io

---

**Last Updated**: January 9, 2026
**Version**: 1.0.0
