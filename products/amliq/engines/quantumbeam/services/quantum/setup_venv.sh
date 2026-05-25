#!/bin/bash

# Setup Python virtual environment for Quantum Service
# This script creates and configures a virtual environment for the quantum service

set -e

echo "🔬 Setting up Quantum Service Virtual Environment"

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
# Quantum Service Environment Configuration
SERVICE_NAME=quantum-service
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
INFLUXDB_BUCKET=quantum-metrics

# Quantum Configuration
IBM_QUANTUM_TOKEN=
AWS_BRAKET_ACCESS_KEY_ID=
AWS_BRAKET_SECRET_ACCESS_KEY=
AWS_BRAKET_REGION=us-east-1
QUANTUM_SIMULATOR=true
QUANTUM_DEVICE=ibmq_qasm_simulator

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=1
CORS_ORIGINS=*

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
JAEGER_ENDPOINT=http://localhost:14268/api/traces
METRICS_ENABLED=true

# Security
SECRET_KEY=your-secret-key-here-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=30
EOF
    echo "✅ .env file created. Please update with your actual configuration."
fi

# Create activation script for convenience
echo "📜 Creating activation script..."
cat > activate.sh << 'EOF'
#!/bin/bash
# Activation script for Quantum Service
echo "🔬 Activating Quantum Service Environment"
source venv/bin/activate
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"
echo "✅ Quantum Service environment activated"
echo "🚀 To start the service: uvicorn src.quantumbeam.quantum.main:app --reload --host 0.0.0.0 --port 8000"
EOF
chmod +x activate.sh

# Create run script
echo "🏃 Creating run script..."
cat > run.sh << 'EOF'
#!/bin/bash
# Run script for Quantum Service
set -e

# Activate virtual environment
source venv/bin/activate
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"

# Set environment variables
export SERVICE_NAME=quantum-service
export SERVICE_VERSION=1.0.0

echo "🚀 Starting Quantum Service..."
echo "📍 Service will be available at: http://localhost:8000"
echo "📊 API Documentation: http://localhost:8000/docs"
echo "🔍 Health Check: http://localhost:8000/health"

# Run the service
if [ "$1" = "prod" ]; then
    uvicorn src.quantumbeam.quantum.main:app --host 0.0.0.0 --port 8000 --workers 4
else
    uvicorn src.quantumbeam.quantum.main:app --reload --host 0.0.0.0 --port 8000 --log-level debug
fi
EOF
chmod +x run.sh

# Create test script
echo "🧪 Creating test script..."
cat > test.sh << 'EOF'
#!/bin/bash
# Test script for Quantum Service
set -e

# Activate virtual environment
source venv/bin/activate
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"

echo "🧪 Running Quantum Service Tests..."

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

echo ""
echo "🎉 Quantum Service setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Activate the environment: source activate.sh"
echo "   2. Or run the service directly: ./run.sh"
echo "   3. Update .env with your configuration"
echo "   4. Run tests: ./test.sh"
echo ""
echo "🔗 Useful URLs:"
echo "   - API: http://localhost:8000"
echo "   - Docs: http://localhost:8000/docs"
echo "   - Health: http://localhost:8000/health"
