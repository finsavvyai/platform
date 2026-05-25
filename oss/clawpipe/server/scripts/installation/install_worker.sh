#!/bin/bash

echo "🚀 FinSavvyAI Worker Installer"
echo "=========================="

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "🐍 Found Python $PYTHON_VERSION"

# Check if virtual environment exists
if [ ! -d "finsavvyai-worker-env" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv finsavvyai-worker-env
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source finsavvyai-worker-env/bin/activate

# Install dependencies
echo "📚 Installing dependencies..."
pip install --upgrade pip
pip install aiohttp psutil

# Get master host
read -p "🌐 Enter master host address (default: 10.0.0.10): " MASTER_HOST
MASTER_HOST=${MASTER_HOST:-10.0.0.10}

# Get worker name
read -p "🏷️  Enter worker name (default: $(hostname)): " WORKER_NAME
WORKER_NAME=${WORKER_NAME:-$(hostname)}

# Get available models
echo "🤖 Available models:"
echo "  1. gpt-3.5-turbo-sim"
echo "  2. phi-2"
echo "  3. glm-4v-9b"
echo "  4. custom"

read -p "Select model (1-4): " MODEL_CHOICE

case $MODEL_CHOICE in
    1) MODELS="gpt-3.5-turbo-sim" ;;
    2) MODELS="phi-2" ;;
    3) MODELS="glm-4v-9b" ;;
    4)
        read -p "Enter custom model name: " MODELS
        ;;
    *) MODELS="gpt-3.5-turbo-sim" ;;
esac

# Create startup script
cat > start_worker.sh << EOF
#!/bin/bash

# FinSavvyAI Worker Startup Script
echo "🚀 Starting FinSavvyAI Worker..."
echo "   Name: $WORKER_NAME"
echo "   Master: $MASTER_HOST"
echo "   Model: $MODELS"

# Activate virtual environment
source finsavvyai-worker-env/bin/activate

# Start worker
python3 worker_node.py \\
    --master $MASTER_HOST \\
    --name "$WORKER_NAME" \\
    --models $MODELS

echo "🛑 Worker stopped"
EOF

chmod +x start_worker.sh

# Create service file (Linux/macOS)
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🔧 Creating service file..."

    SERVICE_NAME="finsavvyai-worker"
    CURRENT_DIR=$(pwd)

    cat > finsavvyai-worker.service << EOF
[Unit]
Description=FinSavvyAI Worker
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$CURRENT_DIR
Environment=PATH=$CURRENT_DIR/finsavvyai-worker-env/bin
ExecStart=$CURRENT_DIR/start_worker.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    echo "📋 Service file created: finsavvyai-worker.service"
    echo ""
    echo "🔧 To install as a service:"
    echo "   sudo cp finsavvyai-worker.service /etc/systemd/system/"
    echo "   sudo systemctl enable finsavvyai-worker"
    echo "   sudo systemctl start finsavvyai-worker"
    echo "   sudo systemctl status finsavvyai-worker"
fi

echo ""
echo "✅ Installation complete!"
echo "======================"
echo ""
echo "🚀 Start worker:"
echo "   ./start_worker.sh"
echo ""
echo "🌐 Check status:"
echo "   http://$(hostname -I | awk '{print $1}'):8001/health"
echo ""
echo "📱 Worker dashboard:"
echo "   http://$(hostname -I | awk '{print $1}'):8001/"
echo ""
echo "🔧 To stop worker: Ctrl+C"
echo ""
echo "💡 Make sure the cluster master is running on $MASTER_HOST:8000"
