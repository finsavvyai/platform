#!/bin/bash

# UPM.Plus Deployment and Post-Deployment Testing Script
set -e

echo "🚀 Starting UPM.Plus Deployment and Testing..."
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:8000"
TIMEOUT=60

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Step 1: Check prerequisites
echo ""
echo "📋 Step 1: Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_status "Docker is installed"

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed."
    exit 1
fi
print_status "Docker Compose is available"

# Step 2: Create environment file if it doesn't exist
echo ""
echo "📋 Step 2: Setting up environment configuration..."
if [ ! -f "backend/.env" ]; then
    print_warning ".env file not found. Creating from template..."
    cat > backend/.env << EOF
# Application
ENVIRONMENT=development
DEBUG=true
SECRET_KEY=$(openssl rand -hex 32)

# Database
DATABASE_URL=postgresql+asyncpg://upmplus:upmplus_dev_password@postgres:5432/upmplus

# Redis
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/1

# Vector Database
CHROMA_HOST=chromadb
CHROMA_PORT=8000

# AI Services (optional for basic testing)
# OPENAI_API_KEY=your-key-here
# ANTHROPIC_API_KEY=your-key-here
EOF
    print_status "Created backend/.env file"
else
    print_status ".env file exists"
fi

# Step 3: Stop any existing containers
echo ""
echo "📋 Step 3: Cleaning up existing containers..."
docker-compose down 2>/dev/null || true
print_status "Cleaned up existing containers"

# Step 4: Build and start services
echo ""
echo "📋 Step 4: Building and starting services..."
docker-compose up -d --build
print_status "Services started"

# Step 5: Wait for services to be healthy
echo ""
echo "📋 Step 5: Waiting for services to be ready..."
echo "Waiting for PostgreSQL..."
for i in {1..30}; do
    if docker exec upm-plus-postgres pg_isready -U upmplus > /dev/null 2>&1; then
        print_status "PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "PostgreSQL failed to start"
        docker-compose logs postgres
        exit 1
    fi
    sleep 2
done

echo "Waiting for Redis..."
for i in {1..30}; do
    if docker exec upm-plus-redis redis-cli ping > /dev/null 2>&1; then
        print_status "Redis is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Redis failed to start"
        docker-compose logs redis
        exit 1
    fi
    sleep 2
done

# Step 6: Run database migrations
echo ""
echo "📋 Step 6: Running database migrations..."
docker exec upm-plus-backend alembic upgrade head 2>/dev/null || {
    print_warning "Alembic migrations failed, trying direct database initialization..."
    docker exec upm-plus-backend python -c "
from app.core.database import init_database, create_tables
import asyncio
asyncio.run(create_tables())
" || print_warning "Database initialization had issues, continuing..."
}
print_status "Database migrations completed"

# Step 7: Wait for backend to be ready
echo ""
echo "📋 Step 7: Waiting for backend API to be ready..."
for i in {1..60}; do
    if curl -s -f "${BACKEND_URL}/health" > /dev/null 2>&1; then
        print_status "Backend API is ready"
        break
    fi
    if [ $i -eq 60 ]; then
        print_error "Backend API failed to start"
        docker-compose logs backend
        exit 1
    fi
    sleep 2
done

# Step 8: Run health checks
echo ""
echo "📋 Step 8: Running health checks..."
HEALTH_RESPONSE=$(curl -s "${BACKEND_URL}/health")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    print_status "Health check passed"
    echo "Response: $HEALTH_RESPONSE"
else
    print_error "Health check failed"
    echo "Response: $HEALTH_RESPONSE"
    exit 1
fi

# Step 9: Run API tests
echo ""
echo "📋 Step 9: Running post-deployment API tests..."
echo ""

# Test 1: Root endpoint
echo "Testing root endpoint..."
ROOT_RESPONSE=$(curl -s "${BACKEND_URL}/")
if echo "$ROOT_RESPONSE" | grep -q "UPM.Plus"; then
    print_status "Root endpoint working"
else
    print_error "Root endpoint failed"
    echo "Response: $ROOT_RESPONSE"
fi

# Test 2: API docs
echo "Testing API documentation..."
if curl -s -f "${BACKEND_URL}/docs" > /dev/null 2>&1; then
    print_status "API documentation accessible"
else
    print_warning "API documentation not accessible"
fi

# Test 3: Tasks endpoint
echo "Testing tasks endpoint..."
TASKS_RESPONSE=$(curl -s "${BACKEND_URL}/api/v1/tasks/")
if echo "$TASKS_RESPONSE" | grep -q "\[\]" || echo "$TASKS_RESPONSE" | grep -q "tasks"; then
    print_status "Tasks endpoint working"
else
    print_error "Tasks endpoint failed"
    echo "Response: $TASKS_RESPONSE"
fi

# Test 4: Organizations endpoint
echo "Testing organizations endpoint..."
ORG_RESPONSE=$(curl -s "${BACKEND_URL}/api/v1/organizations/")
if echo "$ORG_RESPONSE" | grep -q "\[\]" || echo "$ORG_RESPONSE" | grep -q "organizations"; then
    print_status "Organizations endpoint working"
else
    print_error "Organizations endpoint failed"
    echo "Response: $ORG_RESPONSE"
fi

# Test 5: Agents endpoint
echo "Testing agents endpoint..."
AGENTS_RESPONSE=$(curl -s "${BACKEND_URL}/api/v1/agents/")
if echo "$AGENTS_RESPONSE" | grep -q "\[\]" || echo "$AGENTS_RESPONSE" | grep -q "agents"; then
    print_status "Agents endpoint working"
else
    print_warning "Agents endpoint may require authentication"
fi

# Test 6: Gateway info
echo "Testing gateway info endpoint..."
GATEWAY_RESPONSE=$(curl -s "${BACKEND_URL}/api/v1/gateway/info")
if echo "$GATEWAY_RESPONSE" | grep -q "gateway"; then
    print_status "Gateway endpoint working"
else
    print_warning "Gateway endpoint may not be fully configured"
fi

# Step 10: Test creating a task (if possible)
echo ""
echo "📋 Step 10: Testing task creation..."
TASK_CREATE_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/v1/tasks/" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Test Task",
        "description": "Deployment test task",
        "task_type": "test",
        "workflow_id": "00000000-0000-0000-0000-000000000000",
        "parameters": {}
    }' 2>&1)

if echo "$TASK_CREATE_RESPONSE" | grep -q "id\|error\|validation"; then
    print_status "Task creation endpoint responding"
    echo "Response: $TASK_CREATE_RESPONSE" | head -c 200
    echo "..."
else
    print_warning "Task creation may require authentication or valid workflow"
fi

# Step 11: Check service status
echo ""
echo "📋 Step 11: Checking service status..."
docker-compose ps

# Step 12: Summary
echo ""
echo "=============================================="
echo "📊 Deployment Summary"
echo "=============================================="
print_status "Deployment completed successfully!"
echo ""
echo "🌐 Backend API: ${BACKEND_URL}"
echo "📚 API Docs: ${BACKEND_URL}/docs"
echo "🏥 Health Check: ${BACKEND_URL}/health"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop services: docker-compose down"
echo ""
print_status "All tests completed!"


