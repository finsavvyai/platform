#!/bin/bash

# UPM.Plus Production Startup Script
# Ensures all services are properly initialized and started

set -e

echo "🚀 Starting UPM.Plus Production Environment..."

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python version: $python_version"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
cd backend
pip install --upgrade pip
pip install -r requirements.txt
cd ..

# Check Redis connection
echo "🔍 Checking Redis connection..."
if ! redis-cli ping > /dev/null 2>&1; then
    echo "⚠️  Warning: Redis is not running. Starting Redis..."
    # Try to start Redis (adjust based on your system)
    if command -v redis-server > /dev/null; then
        redis-server --daemonize yes || echo "Could not start Redis automatically"
    fi
fi

# Check database
echo "🗄️  Checking database..."
cd backend
python -c "
from app.core.database import init_database, create_tables
import asyncio

async def check_db():
    init_database()
    await create_tables()
    print('✅ Database initialized')

asyncio.run(check_db())
" || echo "⚠️  Database check failed - will continue"

cd ..

# Start backend server
echo "🌐 Starting backend server..."
cd backend
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Backend is ready!"
        break
    fi
    sleep 1
done

# Start frontend (if needed)
if [ "$1" == "--with-frontend" ]; then
    echo "🎨 Starting frontend..."
    cd frontend
    npm install
    npm start &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
    cd ..
fi

echo ""
echo "✅ UPM.Plus is running!"
echo "📊 Backend API: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
if [ "$1" == "--with-frontend" ]; then
    echo "🎨 Frontend: http://localhost:3000"
fi
echo ""
echo "To stop services, use: pkill -f 'uvicorn app.main:app'"
echo ""

# Keep script running
wait


