#!/bin/bash
# Install critical dependencies for UPM.Plus backend

set -e

echo "📦 Installing critical dependencies for UPM.Plus backend..."
echo "============================================================"

cd "$(dirname "$0")"
source venv/bin/activate

# Core dependencies
echo "Installing core dependencies..."
pip install -q fastapi uvicorn[standard] python-multipart pydantic pydantic-settings python-dotenv

# Database
echo "Installing database dependencies..."
pip install -q sqlalchemy[asyncio] aiosqlite greenlet alembic

# Authentication & Security
echo "Installing auth & security dependencies..."
pip install -q python-jose[cryptography] passlib[bcrypt] bcrypt pyotp qrcode[pil] twilio hvac

# Logging & Monitoring
echo "Installing logging dependencies..."
pip install -q rich structlog

# API & HTTP
echo "Installing HTTP/API dependencies..."
pip install -q httpx aiohttp websockets requests

# Task Queue
echo "Installing task queue dependencies..."
pip install -q celery redis

# LLM & AI
echo "Installing LLM dependencies..."
pip install -q openai anthropic jinja2

# Vector Database
echo "Installing vector database dependencies..."
pip install -q chromadb pinecone-client

# Workflow & Graph
echo "Installing workflow dependencies..."
pip install -q networkx

# Email
echo "Installing email dependencies..."
pip install -q email-validator

# Other utilities
echo "Installing utility dependencies..."
pip install -q python-dateutil pytz psutil aiofiles playwright beautifulsoup4 lxml pdfplumber pypdf2 ansible-core pyyaml

echo ""
echo "✅ Critical dependencies installed!"
echo "============================================================"

