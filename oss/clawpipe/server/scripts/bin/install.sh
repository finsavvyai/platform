#!/bin/bash
# FinSavvyAI Installation Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "🚀 FinSavvyAI Installation"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Python
echo "📦 Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required but not installed${NC}"
    echo "Please install Python 3.8 or higher"
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
echo -e "${GREEN}✅ $PYTHON_VERSION${NC}"

# Check pip
echo ""
echo "📦 Checking pip..."
if ! command -v pip3 &> /dev/null; then
    echo -e "${YELLOW}⚠️  pip3 not found, installing...${NC}"
    python3 -m ensurepip --upgrade
fi

echo -e "${GREEN}✅ pip3 available${NC}"

# Install dependencies
echo ""
echo "📦 Installing Python dependencies..."
pip3 install -q --upgrade pip
pip3 install -q -r requirements.txt

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Create directories
echo ""
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p ~/.finsavvyai
echo -e "${GREEN}✅ Directories created${NC}"

# Make scripts executable
echo ""
echo "🔧 Making scripts executable..."
chmod +x start_cluster.sh start_master.sh start_worker.sh start_gateway.sh test_basic.py verify_setup.sh 2>/dev/null || true
echo -e "${GREEN}✅ Scripts are executable${NC}"

# Create config file if it doesn't exist
echo ""
echo "⚙️  Setting up configuration..."
CONFIG_FILE="$HOME/.finsavvyai/cluster-config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    cat > "$CONFIG_FILE" <<EOF
{
  "master": {
    "host": null,
    "port": 8000,
    "cluster_id": "finsavvy-home-cluster"
  },
  "worker": {
    "default_port": 8001,
    "heartbeat_interval": 30,
    "max_load": 100,
    "default_models": ["gpt-3.5-turbo-sim"]
  },
  "logging": {
    "level": "INFO",
    "file": "logs/finsavvyai.log",
    "format": "json",
    "console": true
  },
  "api": {
    "timeout": 30,
    "max_retries": 3,
    "cors_enabled": true
  },
  "router": {
    "enabled": true,
    "default_speed_preference": "balanced"
  }
}
EOF
    echo -e "${GREEN}✅ Configuration file created at $CONFIG_FILE${NC}"
else
    echo -e "${YELLOW}⚠️  Configuration file already exists at $CONFIG_FILE${NC}"
fi

# Test imports
echo ""
echo "🧪 Testing installation..."
if python3 -c "from src.core.master_server import MasterServer; from src.workers.worker_node import WorkerNode; from src.cli.finsavvyai_cli import FinSavvyAICLI; print('✅ All imports successful')" 2>/dev/null; then
    echo -e "${GREEN}✅ Installation verified${NC}"
else
    echo -e "${RED}❌ Installation verification failed${NC}"
    exit 1
fi

echo ""
echo "============================================================"
echo -e "${GREEN}✅ FinSavvyAI installation complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Start cluster: ./start_cluster.sh"
echo "  2. Test: python3 test_basic.py"
echo "  3. Use CLI: python3 main.py help"
echo ""
echo "Configuration: $CONFIG_FILE"
echo "Logs: logs/finsavvyai.log"
echo "============================================================"
