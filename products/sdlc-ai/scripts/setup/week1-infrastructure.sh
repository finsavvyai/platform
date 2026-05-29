#!/bin/bash

echo "🏗️  WEEK 1: INFRASTRUCTURE SETUP"
echo "================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

echo "✅ Docker found!"

# Start infrastructure services
echo "🗄️  Starting PostgreSQL with pgvector..."
cd /Users/shaharsolomon/dev/projects/03_Enterprize_application/SDLC
docker-compose up -d postgres

echo "📦 Starting Redis for caching..."
docker-compose up -d redis

echo "📨 Starting Kafka for messaging..."
docker-compose up -d kafka zookeeper

echo "⏳ Waiting for services to be ready..."
sleep 10

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose exec postgres psql -U postgres -d sdlc_platform -f /docker-entrypoint-initdb.d/001_initial_schema.sql

echo ""
echo "✅ INFRASTRUCTURE SETUP COMPLETE!"
echo "================================="
echo "PostgreSQL: localhost:5432"
echo "Redis: localhost:6379"
echo "Kafka: localhost:9092"
echo ""
echo "Next: Implement Go Gateway service"