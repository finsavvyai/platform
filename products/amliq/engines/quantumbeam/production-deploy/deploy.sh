#!/bin/bash

# QuantumBeam.io Production Deployment Script
# This script deploys QuantumBeam to production

set -e

echo "🚀 QuantumBeam.io Production Deployment"
echo "======================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create one from .env.example"
    exit 1
fi

# Load environment variables
source .env

echo "📋 Deployment Configuration:"
echo "- Environment: ${ENVIRONMENT:-production}"
echo "- Domain: quantumbeam.io"
echo "- API Port: ${PORT:-8080}"
echo ""

# Build and push Docker image (if needed)
echo "🔨 Building Docker image..."
docker build -t quantumbeam/api:latest ../
echo "✅ Docker image built"

# Deploy with Docker Compose
echo "🚢 Deploying services..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to start..."
sleep 30

# Health checks
echo "🏥 Running health checks..."

# Check API health
if curl -f -s http://localhost/health > /dev/null; then
    echo "✅ API health check passed"
else
    echo "❌ API health check failed"
    docker-compose -f docker-compose.prod.yml logs quantumbeam-api
    exit 1
fi

# Check database
if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U $POSTGRES_USER > /dev/null; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

# Check Redis
if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping > /dev/null; then
    echo "✅ Redis connection successful"
else
    echo "❌ Redis connection failed"
    exit 1
fi

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Service URLs:"
echo "- API: http://localhost (or https://quantumbeam.io)"
echo "- Health: http://localhost/health"
echo "- Grafana: http://localhost:3001"
echo "- Prometheus: http://localhost:9090"
echo ""
echo "🔧 Next Steps:"
echo "1. Update DNS A record to point to this server's IP"
echo "2. Set up SSL certificates (Let's Encrypt recommended)"
echo "3. Configure monitoring alerts"
echo "4. Set up backup schedules"
echo ""
echo "📝 To check logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "🛑 To stop: docker-compose -f docker-compose.prod.yml down"