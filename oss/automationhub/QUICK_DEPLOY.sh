#!/bin/bash
# Quick Production Deployment Script
# This script helps you deploy UPM.Plus to production

set -e

echo "🚀 UPM.Plus Production Deployment"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}⚠️  .env.production not found${NC}"
    echo ""
    echo "Creating .env.production from env.example..."
    if [ -f "env.example" ]; then
        cp env.example .env.production
        echo -e "${GREEN}✅ Created .env.production${NC}"
        echo ""
        echo -e "${RED}⚠️  IMPORTANT: Edit .env.production and set all required values!${NC}"
        echo "   - SECRET_KEY (generate with: openssl rand -hex 32)"
        echo "   - MFA_ENCRYPTION_KEY (generate with: openssl rand -hex 32)"
        echo "   - POSTGRES_PASSWORD"
        echo "   - REDIS_PASSWORD"
        echo "   - ALLOWED_ORIGINS"
        echo "   - ALLOWED_HOSTS"
        echo ""
        read -p "Press Enter after editing .env.production to continue..."
    else
        echo -e "${RED}❌ env.example not found!${NC}"
        exit 1
    fi
fi

# Generate secrets if not set
if ! grep -q "SECRET_KEY=.*[a-zA-Z0-9]" .env.production 2>/dev/null || grep -q "SECRET_KEY=$" .env.production 2>/dev/null; then
    echo -e "${YELLOW}⚠️  SECRET_KEY not set, generating...${NC}"
    SECRET_KEY=$(openssl rand -hex 32)
    if grep -q "^SECRET_KEY=" .env.production; then
        sed -i.bak "s|^SECRET_KEY=.*|SECRET_KEY=$SECRET_KEY|" .env.production
    else
        echo "SECRET_KEY=$SECRET_KEY" >> .env.production
    fi
    echo -e "${GREEN}✅ Generated SECRET_KEY${NC}"
fi

if ! grep -q "MFA_ENCRYPTION_KEY=.*[a-zA-Z0-9]" .env.production 2>/dev/null || grep -q "MFA_ENCRYPTION_KEY=$" .env.production 2>/dev/null; then
    echo -e "${YELLOW}⚠️  MFA_ENCRYPTION_KEY not set, generating...${NC}"
    MFA_KEY=$(openssl rand -hex 32)
    if grep -q "^MFA_ENCRYPTION_KEY=" .env.production; then
        sed -i.bak "s|^MFA_ENCRYPTION_KEY=.*|MFA_ENCRYPTION_KEY=$MFA_KEY|" .env.production
    else
        echo "MFA_ENCRYPTION_KEY=$MFA_KEY" >> .env.production
    fi
    echo -e "${GREEN}✅ Generated MFA_ENCRYPTION_KEY${NC}"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed!${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker found${NC}"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running!${NC}"
    echo "   Please start Docker and try again."
    exit 1
fi

echo -e "${GREEN}✅ Docker daemon is running${NC}"
echo ""

# Ask for deployment type
echo "Select deployment type:"
echo "1) Full production stack (PostgreSQL, Redis, Backend, Celery, Monitoring)"
echo "2) Backend only (assumes external database/redis)"
echo "3) Development/Testing"
read -p "Enter choice [1-3]: " DEPLOY_TYPE

case $DEPLOY_TYPE in
    1)
        echo ""
        echo -e "${BLUE}📦 Deploying full production stack...${NC}"
        echo ""
        
        # Load environment variables
        export $(grep -v '^#' .env.production | xargs)
        
        # Build and start services
        echo "Building Docker images..."
        docker-compose -f docker-compose.prod.yml build
        
        echo ""
        echo "Starting services..."
        docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
        
        echo ""
        echo -e "${GREEN}✅ Services started!${NC}"
        echo ""
        echo "Waiting for services to be healthy..."
        sleep 10
        
        # Check health
        echo ""
        echo "Checking service health..."
        if curl -f http://localhost:8000/health &> /dev/null; then
            echo -e "${GREEN}✅ Backend is healthy!${NC}"
        else
            echo -e "${YELLOW}⚠️  Backend health check failed (may still be starting)${NC}"
        fi
        
        echo ""
        echo -e "${GREEN}🎉 Deployment complete!${NC}"
        echo ""
        echo "Services:"
        echo "  - Backend API: http://localhost:8000"
        echo "  - Health Check: http://localhost:8000/health"
        echo "  - API Docs: http://localhost:8000/docs"
        echo "  - Prometheus: http://localhost:9090"
        echo "  - Grafana: http://localhost:3001"
        echo ""
        echo "View logs:"
        echo "  docker-compose -f docker-compose.prod.yml logs -f"
        echo ""
        echo "Stop services:"
        echo "  docker-compose -f docker-compose.prod.yml down"
        ;;
    2)
        echo ""
        echo -e "${BLUE}📦 Deploying backend only...${NC}"
        echo ""
        echo "Make sure PostgreSQL and Redis are accessible!"
        echo ""
        
        export $(grep -v '^#' .env.production | xargs)
        
        docker-compose -f docker-compose.prod.yml build backend
        docker-compose -f docker-compose.prod.yml --env-file .env.production up -d backend
        
        echo ""
        echo -e "${GREEN}✅ Backend started!${NC}"
        echo "  - API: http://localhost:8000"
        echo "  - Health: http://localhost:8000/health"
        ;;
    3)
        echo ""
        echo -e "${BLUE}📦 Starting development environment...${NC}"
        echo ""
        
        docker-compose --env-file .env.production up -d
        
        echo ""
        echo -e "${GREEN}✅ Development environment started!${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice!${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Deployment script completed!${NC}"
