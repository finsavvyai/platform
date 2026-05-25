#!/bin/bash

# UPM.Plus Development Startup Script

echo "🚀 Starting UPM.Plus development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your configuration before continuing."
    echo "   Especially set SECRET_KEY and any API keys you want to use."
    read -p "Press Enter to continue..."
fi

# Start services
echo "🐳 Starting Docker services..."
docker-compose up -d postgres redis chromadb

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Run database migrations
echo "🗄️  Running database migrations..."
docker-compose run --rm backend alembic upgrade head

# Seed database with initial data
echo "🌱 Seeding database with initial data..."
docker-compose run --rm backend python -c "import asyncio; from app.core.seed import seed_database; asyncio.run(seed_database())"

# Start backend and frontend
echo "🖥️  Starting backend and frontend services..."
docker-compose up -d backend frontend

# Show status
echo "✅ UPM.Plus development environment is starting up!"
echo ""
echo "📊 Service URLs:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo "   Flower:    http://localhost:5555"
echo "   Grafana:   http://localhost:3001 (admin/admin)"
echo ""
echo "📝 To view logs: docker-compose logs -f"
echo "🛑 To stop:      docker-compose down"
echo ""
echo "🎉 Happy coding!"