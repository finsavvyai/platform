#!/bin/bash

# Setup Python virtual environment for ML Service
# This script creates and configures a virtual environment for the ML service

set -e

echo "🤖 Setting up ML Service Virtual Environment"

# Check if Python 3.11+ is installed
python_version=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
required_version="3.11"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Python 3.11+ is required. Found: $python_version"
    exit 1
fi

echo "✅ Python version $python_version meets requirements"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️ Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "📚 Installing dependencies..."
pip install -r requirements.txt

# Install development dependencies
echo "🛠️ Installing development dependencies..."
pip install -r requirements-dev.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# ML Service Environment Configuration
SERVICE_NAME=ml-service
SERVICE_VERSION=1.0.0
DEBUG=true
LOG_LEVEL=debug

# Database Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=
INFLUXDB_ORG=quantumbeam
INFLUXDB_BUCKET=ml-metrics
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=

# Model Configuration
MODEL_REGISTRY_PATH=./models
MODEL_CACHE_TTL=3600
DEFAULT_MODEL_VERSION=latest
ENABLE_AUTO_RETRAINING=false
RETRAINING_INTERVAL_HOURS=24

# Feature Store Configuration
FEATURE_STORE_TYPE=redis
FEATURE_STORE_TTL=86400
PRECOMPUTE_FEATURES=true

# API Configuration
API_HOST=0.0.0.0
API_PORT=8001
API_WORKERS=1
CORS_ORIGINS=*
MAX_BATCH_SIZE=1000

# ML Configuration
TRAINING_DATA_PATH=./data
MODEL_ARTIFACTS_PATH=./artifacts
EXPERIMENT_TRACKING_URL=
MLFLOW_TRACKING_URI=http://localhost:5000

# GPU Configuration
CUDA_VISIBLE_DEVICES=0
TORCH_CUDA_ARCH_LIST="6.0;6.1;7.0;7.5;8.0;8.6"

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9091
JAEGER_ENDPOINT=http://localhost:14268/api/traces
METRICS_ENABLED=true

# Security
SECRET_KEY=your-secret-key-here-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=30
API_KEY_HEADER=X-API-Key
EOF
    echo "✅ .env file created. Please update with your actual configuration."
fi

# Create activation script for convenience
echo "📜 Creating activation script..."
cat > activate.sh << 'EOF'
#!/bin/bash
# Activation script for ML Service
echo "🤖 Activating ML Service Environment"
source venv/bin/activate
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"
echo "✅ ML Service environment activated"
echo "🚀 To start the service: uvicorn src.quantumbeam.ml.main:app --reload --host 0.0.0.0 --port 8001"
EOF
chmod +x activate.sh

# Create run script
echo "🏃 Creating run script..."
cat > run.sh << 'EOF'
#!/bin/bash
# Run script for ML Service
set -e

# Activate virtual environment
source venv/bin/activate
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"

# Set environment variables
export SERVICE_NAME=ml-service
export SERVICE_VERSION=1.0.0

echo "🚀 Starting ML Service..."
echo "📍 Service will be available at: http://localhost:8001"
echo "📊 API Documentation: http://localhost:8001/docs"
echo "🔍 Health Check: http://localhost:8001/health"

# Run the service
if [ "$1" = "prod" ]; then
    uvicorn src.quantumbeam.ml.main:app --host 0.0.0.0 --port 8001 --workers 4
else
    uvicorn src.quantumbeam.ml.main:app --reload --host 0.0.0.0 --port 8001 --log-level debug
fi
EOF
chmod +x run.sh

# Create test script
echo "🧪 Creating test script..."
cat > test.sh << 'EOF'
#!/bin/bash
# Test script for ML Service
set -e

# Activate virtual environment
source venv/bin/activate
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"

echo "🧪 Running ML Service Tests..."

# Run linting
echo "🔍 Running linting..."
if command -v ruff &> /dev/null; then
    ruff check src/ tests/
else
    echo "⚠️ Ruff not installed. Install with: pip install ruff"
fi

# Run type checking
echo "📝 Running type checking..."
if command -v mypy &> /dev/null; then
    mypy src/
else
    echo "⚠️ MyPy not installed. Install with: pip install mypy"
fi

# Run unit tests
echo "🧪 Running unit tests..."
python -m pytest tests/ -v --cov=src --cov-report=html --cov-report=term-missing

echo "✅ All tests completed!"
EOF
chmod +x test.sh

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data/raw data/processed data/validation models artifacts logs

echo ""
echo "🎉 ML Service setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Activate the environment: source activate.sh"
echo "   2. Or run the service directly: ./run.sh"
echo "   3. Update .env with your configuration"
echo "   4. Run tests: ./test.sh"
echo "   5. Place your models in the models/ directory"
echo ""
echo "🔗 Useful URLs:"
echo "   - API: http://localhost:8001"
echo "   - Docs: http://localhost:8001/docs"
echo "   - Health: http://localhost:8001/health"
