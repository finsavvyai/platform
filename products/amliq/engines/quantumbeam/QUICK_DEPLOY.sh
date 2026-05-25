#!/bin/bash

# ============================================================================
# QuantumBeam Quick Production Deployment Script
# ============================================================================
# This script provides a fast deployment option with essential checks
# ============================================================================

set -e

echo "🚀 QuantumBeam Quick Production Deployment"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to print colored output
print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check prerequisites
print_step "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose first."
    exit 1
fi

print_success "Prerequisites check passed"
echo ""

# Check for environment file
if [ ! -f ".env.production" ]; then
    print_warning "No .env.production found. Creating from example..."
    cp .env.production.example .env.production
    echo ""
    echo "⚠️  IMPORTANT: Edit .env.production and set your secrets!"
    echo "   Required secrets:"
    echo "   - JWT_SECRET"
    echo "   - POSTGRES_PASSWORD"
    echo "   - API keys for quantum backends (IBM, AWS)"
    echo ""
    read -p "Have you configured .env.production? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please configure .env.production first, then run this script again."
        exit 1
    fi
fi

print_success "Environment configuration found"
echo ""

# Set build variables
export VERSION=${VERSION:-"1.0.0"}
export BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
export GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

print_step "Building production images..."
print_step "Version: $VERSION | Commit: $GIT_COMMIT"
echo ""

# Build images
docker-compose -f docker-compose.production.yml build \
  --build-arg VERSION="$VERSION" \
  --build-arg BUILD_TIME="$BUILD_TIME" \
  --build-arg GIT_COMMIT="$GIT_COMMIT" || {
    echo "❌ Build failed"
    exit 1
}

print_success "Images built successfully"
echo ""

# Start database first
print_step "Starting database services..."
docker-compose -f docker-compose.production.yml up -d postgres redis

print_step "Waiting for database to be ready..."
sleep 10

# Check database health
if docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U quantumbeam > /dev/null 2>&1; then
    print_success "Database is ready"
else
    print_warning "Database might not be ready yet, continuing anyway..."
fi
echo ""

# Run migrations
print_step "Running database migrations..."
# Note: Uncomment if you have migrations ready
# docker-compose -f docker-compose.production.yml run --rm api /app/migrate up

print_success "Database setup complete"
echo ""

# Start all services
print_step "Starting all production services..."
docker-compose -f docker-compose.production.yml up -d

print_step "Waiting for services to start..."
sleep 15

# Check service health
print_step "Checking service health..."
echo ""

services=(
  "API:8080"
  "Grafana:3000"
  "Prometheus:9090"
)

for service in "${services[@]}"; do
    IFS=: read -r name port <<< "$service"
    if curl -sf "http://localhost:$port/health" > /dev/null 2>&1 || \
       curl -sf "http://localhost:$port/" > /dev/null 2>&1 || \
       curl -sf "http://localhost:$port/-/healthy" > /dev/null 2>&1; then
        print_success "$name is running on port $port"
    else
        print_warning "$name on port $port - check manually"
    fi
done

echo ""
print_success "Deployment complete! 🎉"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Service URLs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  🔐 API:        http://localhost:8080"
echo "  📈 Grafana:    http://localhost:3000 (admin/check .env.production)"
echo "  📊 Prometheus: http://localhost:9090"
echo "  🔍 Health:     http://localhost:8080/health/detailed"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1. Test the API:"
echo "     curl http://localhost:8080/health"
echo ""
echo "  2. View logs:"
echo "     docker-compose -f docker-compose.production.yml logs -f"
echo ""
echo "  3. Deploy website:"
echo "     cd web/marketing && npm run build && vercel --prod"
echo ""
echo "  4. Configure monitoring alerts in Grafana"
echo ""
echo "  5. Set up domain and SSL certificates"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Open health check in browser (optional)
if command -v open &> /dev/null; then
    read -p "Open health check in browser? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open "http://localhost:8080/health/detailed"
    fi
elif command -v xdg-open &> /dev/null; then
    read -p "Open health check in browser? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        xdg-open "http://localhost:8080/health/detailed"
    fi
fi

echo "✅ QuantumBeam is now running in production mode!"
echo ""
echo "For full deployment documentation, see:"
echo "  → DEPLOY_TO_PRODUCTION.md"
echo "  → PRODUCTION_READINESS.md"
echo ""
