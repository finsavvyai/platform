#!/bin/bash
# Local Development Deployment (No Docker Required)

set -e

echo "🚀 Starting UPM.Plus Local Development Environment..."
echo "=================================================="

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi
echo "✅ Python 3 found: $(python3 --version)"

if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis CLI not found. Redis may not be installed."
    echo "   Install with: brew install redis (macOS) or apt-get install redis (Linux)"
fi

# Setup backend
echo ""
echo "📋 Setting up backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << EOF
ENVIRONMENT=development
DEBUG=true
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
DATABASE_URL=sqlite+aiosqlite:///./test.db
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/1
CHROMA_HOST=localhost
CHROMA_PORT=8000
EOF
    echo "✅ Created .env file"
fi

# Initialize database
echo "Initializing database..."
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
python -c "
from app.core.database import init_database, create_tables
import asyncio

async def init():
    init_database()
    await create_tables()
    print('✅ Database initialized')

asyncio.run(init())
" || echo "⚠️  Database initialization had issues"

# Check Redis
echo ""
echo "📋 Checking Redis..."
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "⚠️  Redis is not running. Please start Redis:"
    echo "   redis-server"
    echo ""
    read -p "Start Redis now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        redis-server --daemonize yes
        sleep 2
        if redis-cli ping > /dev/null 2>&1; then
            echo "✅ Redis started"
        else
            echo "❌ Failed to start Redis"
            exit 1
        fi
    fi
fi

# Start backend
echo ""
echo "📋 Starting backend server..."
echo "Backend will be available at: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"
echo ""

export PYTHONPATH="${PYTHONPATH}:$(pwd)"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


