# 🤖 FinSavvyAI - Professional AWS-Style Distributed AI Cluster

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Version](https://img.shields.io/badge/version-1.0.0-red.svg)]()

**🚀 Enterprise-grade distributed AI cluster with professional AWS-style CLI**

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Examples](#-examples) • [Contributing](#-contributing)

</div>

---

## 🌟 Overview

FinSavvyAI is a production-ready distributed AI cluster system that brings the power of multiple specialized LLMs together with a professional AWS-style command-line interface. Transform your home computers into a powerful AI development environment with intelligent model routing, professional monitoring, and enterprise-grade management.

### 🎯 What Makes FinSavvyAI Special

- **🏠 Home Cluster Computing**: Turn multiple computers into one powerful AI system
- **🧠 Multi-Layer Intelligence**: Automatically routes tasks to specialized models (coding, vision, math, etc.)
- **💻 Professional AWS-Style CLI**: Industry-standard command interface you already know
- **⚡ Smart Model Selection**: Development tasks go to code models, vision tasks to multimodal models
- **📊 Production Monitoring**: Real-time cluster health, node status, and performance metrics
- **🌐 Network Ready**: Access your AI cluster from any device on your network

---

## ✨ Key Features

### 🏗️ **Distributed Cluster Architecture**
- **Auto-Discovery**: Workers automatically find and register with the master
- **Load Balancing**: Intelligent distribution of requests across nodes
- **Health Monitoring**: Real-time heartbeat and system metrics
- **Fault Tolerance**: Automatic failover and recovery

### 🧠 **Multi-Layer Model System**

#### **Layer 1 - Fast Models (Quick Tasks)**
- `phi-2` (2.8GB) - Ultra-fast responses for simple queries
- `mistral-7b-instruct` (4.1GB) - Quick reasoning and instructions

#### **Layer 2 - Development Specialized**
- `codellama-7b-instruct` (7.4GB) - Professional coding and debugging
- `deepseek-coder-6.7b` (6.5GB) - Advanced algorithms and architecture
- `starcoder2-7b` (7.1GB) - Code generation and refactoring

#### **Layer 3 - Complex Reasoning**
- `llama-2-7b-chat` (6.7GB) - Complex problem solving
- `llama-3-8b-instruct` (8.2GB) - Advanced reasoning and strategy

#### **Layer 4 - Multimodal Vision**
- `glm-4v-9b` (18GB) - Image analysis and UI understanding
- `llava-1.5-7b` (13GB) - Visual reasoning and diagram analysis

#### **Layer 5 - Specialized Models**
- `sqlcoder-7b` (6.8GB) - Database query optimization
- `mathcoder-7b` (6.4GB) - Mathematical reasoning

### 💻 **Professional AWS-Style CLI**

```bash
# Just like AWS CLI!
aws finsavvyai describe clusters
aws finsavvyai describe nodes --detailed
aws finsavvyai start service master
aws finsavvyai --output json describe services
```

**Features:**
- Multiple output formats (JSON, YAML, Table, Text)
- Profile-based configuration
- Verbose logging and debugging
- Tab completion support
- Professional error handling

---

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- 8GB+ RAM (16GB+ recommended for larger models)
- 50GB+ free disk space for models
- Multiple computers on same network (optional)

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/finsavvyai.git
   cd finsavvyai
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Setup CLI**
   ```bash
   chmod +x finsavvyai_aws
   ln -sf "$(pwd)/finsavvyai_aws" ~/.local/bin/finsavvyai
   ```

4. **Download Models**
   ```bash
   # Start with essential models
   python3 download_models.py download phi-2
   python3 download_models.py download codellama-7b-instruct
   
   # Add vision capabilities
   python3 download_models.py download glm-4v-9b
   ```

5. **Start Your Cluster**
   ```bash
   # Start all services
   finsavvyai start service all
   
   # Check cluster status
   finsavvyai describe services
   ```

### First Usage

```bash
# Check your cluster status
finsavvyai describe clusters

# View all nodes
finsavvyai describe nodes --detailed

# Test model routing
python3 multi_layer_router.py
```

---

## 📖 Documentation

### CLI Commands

#### **Cluster Management**
```bash
# Describe resources
finsavvyai describe clusters          # List all clusters
finsavvyai describe nodes             # List cluster nodes
finsavvyai describe nodes --detailed # Detailed node information
finsavvyai describe services          # Service status

# Service management
finsavvyai start service all          # Start all services
finsavvyai start service master       # Start master only
finsavvyai stop service worker        # Stop worker service
```

#### **Output Formats**
```bash
# Table format (default)
finsavvyai describe clusters

# JSON output
finsavvyai --output json describe clusters

# YAML output
finsavvyai --output yaml describe nodes

# Plain text (no colors)
finsavvyai --no-color describe services
```

#### **Advanced Options**
```bash
# Verbose logging
finsavvyai --verbose describe clusters

# Custom profile
finsavvyai --profile production describe services

# AWS-style region
finsavvyai --region home-cluster-1 describe nodes
```

### Model Management

#### **Available Models**
```bash
# List all available models
python3 download_models.py list

# Show downloaded models
python3 download_models.py downloaded

# Download specific models
python3 download_models.py download codellama-7b-instruct
python3 download_models.py download deepseek-coder-6.7b
python3 download_models.py download glm-4v-9b
```

#### **Model Categories**
- **Chat Models**: General conversation and reasoning
- **Code Models**: Programming, debugging, and development
- **Vision Models**: Image analysis and visual understanding
- **Specialized Models**: SQL, mathematics, specific domains

### Multi-Computer Setup

#### **Master Node (Main Computer)**
```bash
# Start master service
finsavvyai start service master

# Master will be accessible at: http://YOUR_IP:8000
```

#### **Worker Nodes (Additional Computers)**

1. **Install Workers**
   ```bash
   # On each additional computer
   curl -sSL https://your-repo/install_worker.sh | bash
   ```

2. **Manual Worker Installation**
   ```bash
   # Copy files to worker computer
   scp worker_node.py user@worker-computer:~/
   scp install_worker.sh user@worker-computer:~/
   
   # Install on worker
   chmod +x install_worker.sh
   ./install_worker.sh
   ```

3. **Verify Cluster**
   ```bash
   # On master node
   finsavvyai describe nodes --detailed
   ```

---

## 🎯 Examples

### Development Workflows

#### **Code Development**
```bash
# The router automatically selects CodeLlama for coding tasks
echo "Write a Python function to implement binary search" | python3 multi_layer_router.py

# Selected: codellama-7b-instruct (Layer 2 - Development)
# Reason: coding, debugging, code-review, documentation
```

#### **Debugging**
```bash
# Debug tasks go to specialized development models
echo "Debug this TypeError in my React component" | python3 multi_layer_router.py

# Selected: codellama-7b-instruct (Layer 2 - Development)
# Reason: coding, debugging, code-review, documentation
```

#### **Vision Analysis**
```bash
# Tasks with images go to multimodal models
echo "Analyze this screenshot of my application UI" | python3 multi_layer_router.py

# Selected: glm-4v-9b (Layer 4 - Multimodal)
# Reason: vision, ui-analysis, multimodal, diagrams
```

#### **Database Queries**
```bash
# SQL tasks go to specialized database model
echo "Write a SQL query to find duplicate users" | python3 multi_layer_router.py

# Selected: sqlcoder-7b (Layer 5 - Specialized)
# Reason: sql, database, query-optimization
```

### Cluster Monitoring

#### **Real-time Status**
```bash
# Overall cluster health
finsavvyai describe services

# Detailed node information
finsavvyai describe nodes --detailed

# JSON output for automation
finsavvyai --output json describe clusters | jq .
```

#### **Service Management**
```bash
# Start specific services
finsavvyai start service master
finsavvyai start service worker

# Stop all services
finsavvyai stop service all

# Restart cluster
finsavvyai stop service all && finsavvyai start service all
```

### Advanced Usage

#### **Profile-based Configuration**
```bash
# Development profile
finsavvyai --profile development --output json describe clusters

# Production profile with verbose logging
finsavvyai --profile production --verbose describe services
```

#### **Automation Scripting**
```bash
#!/bin/bash
# Cluster health check script

# Check cluster status
STATUS=$(finsavvyai --output json describe clusters | jq -r '.[0].Status')

if [ "$STATUS" = "AVAILABLE" ]; then
    echo "✅ Cluster is healthy"
    finsavvyai describe nodes --output json | jq '.[] | {Name, Status, Load}'
else
    echo "❌ Cluster is unavailable"
    finsavvyai start service all
fi
```

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    FINSAVVYAI CLUSTER                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   MASTER    │────│  WORKER 1   │────│  WORKER 2   │     │
│  │   SERVER    │    │   NODE      │    │   NODE      │     │
│  │   :8000     │    │   :8001     │    │   :8002     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            MULTI-LAYER MODEL ROUTER                 │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │   │
│  │  │ Layer 1 │ │ Layer 2 │ │ Layer 3 │ │ Layer 4 │ │   │
│  │  │  Fast   │ │  Dev    │ │ Complex │ │ Vision  │ │   │
│  │  │ Models  │ │ Models  │ │ Models  │ │ Models  │ │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            AWS-STYLE CLI INTERFACE                   │   │
│  │         finsavvyai describe clusters                 │   │
│  │         finsavvyai start service master              │   │
│  │         finsavvyai --output json describe nodes     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Request** → AWS-style CLI
2. **CLI Parser** → Command routing
3. **Master Server** → Load balancing
4. **Intelligent Router** → Model selection
5. **Worker Node** → Model execution
6. **Response** → Formatted output

### Network Architecture

```
                      Internet
                         │
                    ┌─────────┐
                    │ Router  │
                    └─────────┘
                         │
              ┌────────────┼────────────┐
              │                         │
    ┌─────────────────┐        ┌─────────────────┐
    │   Master Node   │        │   Worker Node    │
    │ 10.0.0.10:8000  │◄──────►│ 10.0.0.11:8001  │
    │                 │        │                 │
    │ • Master Server │        │ • LLM Models    │
    │ • Load Balancer │        │ • Worker Service │
    │ • API Gateway   │        │ • Health Monitor│
    └─────────────────┘        └─────────────────┘
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Cluster configuration
export FINSAVVYAI_MASTER_HOST=10.0.0.10
export FINSAVVYAI_MASTER_PORT=8000
export FINSAVVYAI_WORKER_PORT=8001

# Model configuration
export FINSAVVYAI_MODELS_DIR=$HOME/finsavvyai-models

# CLI configuration
export FINSAVVYAI_DEFAULT_REGION=home-cluster-1
export FINSAVVYAI_DEFAULT_PROFILE=default
```

### Configuration Files

#### **~/.finsavvyai/config**
```ini
[default]
region = home-cluster-1
output = table
profile = default

[development]
region = dev-cluster-1
output = json
verbose = true

[production]
region = prod-cluster-1
output = table
verbose = false
```

#### **~/.finsavvyai/models.json**
```json
{
  "phi-2": {
    "downloaded": true,
    "path": "/Users/user/finsavvyai-models/phi-2",
    "size": "2.8GB",
    "layer": 1,
    "specializations": ["quick-tasks", "code-assist"]
  }
}
```

---

## 🌐 Deployment

### Home Network Setup

#### **Master Node**
```bash
# Set static IP (optional but recommended)
sudo ifconfig en0 10.0.0.10 netmask 255.255.255.0

# Configure firewall
sudo ufw allow 8000/tcp
sudo ufw allow 8001/tcp

# Start master service
finsavvyai start service master
```

#### **Worker Node Installation**
```bash
# Automated installation (on each worker computer)
curl -sSL https://your-repo.com/install_worker.sh | bash

# Manual installation
git clone https://github.com/yourusername/finsavvyai.git
cd finsavvyai
chmod +x install_worker.sh
./install_worker.sh
```

#### **Network Discovery**
```bash
# Scan for worker nodes on your network
python3 network_scanner.py

# Auto-configuration
python3 network_scanner.py --auto-configure
```

### Cloud Deployment

#### **DigitalOcean Deployment**
```bash
# Create droplets
doctl compute droplet create finsavvyai-master \
  --region nyc3 --size s-4vcpu-8gb --image ubuntu-22-04

doctl compute droplet create finsavvyai-worker \
  --region nyc3 --size s-2vcpu-4gb --image ubuntu-22-04

# Deploy to cloud
./deploy_cloudflare.sh
```

#### **Docker Deployment**
```bash
# Build containers
docker build -t finsavvyai-master .
docker build -t finsavvyai-worker .

# Run master
docker run -d -p 8000:8000 --name finsavvyai-master \
  -v $(pwd)/models:/app/models finsavvyai-master

# Run worker
docker run -d -p 8001:8001 --name finsavvyai-worker \
  -v $(pwd)/models:/app/models \
  -e MASTER_HOST=10.0.0.10 finsavvyai-worker
```

---

## 📊 Monitoring & Maintenance

### Health Monitoring

```bash
# Real-time cluster monitoring
watch -n 5 'finsavvyai describe services'

# Detailed node monitoring
finsavvyai describe nodes --detailed --output json | jq .

# Resource usage
python3 monitor_cluster.py --real-time
```

### Performance Testing

```bash
# Load testing
python3 test_cluster_performance.py --requests 100 --concurrent 10

# Latency testing
python3 test_cluster_performance.py --latency-test

# Model routing test
python3 multi_layer_router.py --test-all
```

### Maintenance Tasks

```bash
# Update models
python3 download_models.py update

# Clean up old models
python3 download_models.py cleanup --older-than 30d

# Backup configuration
cp -r ~/.finsavvyai ~/.finsavvyai.backup.$(date +%Y%m%d)

# Restart cluster
finsavvyai stop service all && sleep 5 && finsavvyai start service all
```

---

## 🔌 API Integration

### REST API Endpoints

```bash
# Cluster status
curl http://10.0.0.10:8000/cluster/status

# List nodes
curl http://10.0.0.10:8000/cluster/nodes

# Health check
curl http://10.0.0.10:8000/health

# Worker health
curl http://10.0.0.10:8001/health
```

### OpenAI-Compatible API

```python
import requests

# Chat completion (routed to best model)
response = requests.post("http://10.0.0.10:8000/v1/chat/completions", json={
    "model": "auto",  # Auto-select best model
    "messages": [{"role": "user", "content": "Write Python code for a web server"}]
})

print(response.json())
```

### Python Client

```python
from finsavvyai_client import FinSavvyAIClient

# Initialize client
client = FinSavvyAIClient(
    master_host="10.0.0.10",
    master_port=8000
)

# Get cluster status
status = client.get_cluster_status()
print(f"Cluster: {status['status']}")

# Chat with auto-routing
response = client.chat("Debug this Python code")
print(f"Model used: {response['model_used']}")
print(f"Response: {response['content']}")
```

---

## 🛠️ Development

### Setting Up Development Environment

```bash
# Clone repository
git clone https://github.com/yourusername/finsavvyai.git
cd finsavvyai

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install development dependencies
pip install -r requirements-dev.txt

# Run tests
python -m pytest tests/

# Run with coverage
python -m pytest --cov=finsavvyai tests/
```

### Code Structure

```
finsavvyai/
├── 📁 Core Components
│   ├── start_master.py          # Master server
│   ├── worker_node.py           # Worker service
│   ├── multi_layer_router.py    # Intelligent routing
│   └── download_models.py       # Model management
├── 📁 CLI Interface  
│   ├── finsavvyai_aws           # Professional AWS-style CLI
│   └── finsavvyai_completion.bash # Tab completion
├── 📁 Installation
│   ├── install_worker.sh        # Worker installer (Unix)
│   ├── install_worker.bat       # Worker installer (Windows)
│   └── network_scanner.py       # Auto-discovery
├── 📁 Deployment
│   ├── deploy_cloudflare.sh     # Cloud deployment
│   └── Dockerfile               # Container deployment
├── 📁 Testing
│   ├── test_cluster_performance.py
│   └── monitor_cluster.py
├── 📁 Configuration
│   ├── finsavvyai_config        # Default config
│   └── .env.example             # Environment variables
└── 📁 Documentation
    ├── README.md                 # This file
    ├── API.md                   # API documentation
    └── DEPLOYMENT.md            # Deployment guide
```

### Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Development Guidelines

- Follow PEP 8 style guidelines
- Write comprehensive tests
- Update documentation for new features
- Use semantic versioning
- Ensure AWS CLI compatibility

---

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
python -m pytest

# Run specific test
python -m pytest tests/test_router.py

# Run with coverage
python -m pytest --cov=finsavvyai tests/
```

### Integration Tests

```bash
# Test cluster functionality
python -m pytest tests/integration/test_cluster.py

# Test CLI interface
python -m pytest tests/integration/test_cli.py

# Test model routing
python -m pytest tests/integration/test_routing.py
```

### Performance Tests

```bash
# Load test cluster
python test_cluster_performance.py --requests 1000

# Test model routing performance
python multi_layer_router.py --benchmark

# Memory usage test
python monitor_cluster.py --memory-test
```

---

## 📚 Reference

### CLI Command Reference

| Command | Description | Example |
|---------|-------------|---------|
| `describe clusters` | List all clusters | `finsavvyai describe clusters` |
| `describe nodes` | List cluster nodes | `finsavvyai describe nodes --detailed` |
| `describe services` | Service status | `finsavvyai describe services` |
| `start service` | Start services | `finsavvyai start service all` |
| `stop service` | Stop services | `finsavvyai stop service worker` |
| `--output json` | JSON output | `finsavvyai --output json describe clusters` |
| `--verbose` | Verbose logging | `finsavvyai --verbose describe services` |
| `--profile prod` | Use profile | `finsavyai --profile prod describe nodes` |

### Model Reference

| Model | Size | Layer | Specializations | Status |
|-------|------|-------|-----------------|--------|
| `phi-2` | 2.8GB | 1 | Quick tasks, basic code | ✅ Downloaded |
| `mistral-7b-instruct` | 4.1GB | 1 | Instructions, reasoning | ⬇️ Available |
| `codellama-7b-instruct` | 7.4GB | 2 | Development, debugging | ✅ Downloaded |
| `deepseek-coder-6.7b` | 6.5GB | 2 | Algorithms, architecture | ⬇️ Available |
| `glm-4v-9b` | 18GB | 4 | Vision, multimodal | ✅ Downloaded |

### API Reference

#### REST Endpoints

- `GET /cluster/status` - Cluster information
- `GET /cluster/nodes` - List all nodes
- `POST /cluster/join` - Register new node
- `POST /cluster/heartbeat` - Node heartbeat
- `POST /v1/chat/completions` - OpenAI-compatible chat

#### Response Formats

**Cluster Status Response:**
```json
{
  "cluster_id": "finsavvy-home-cluster",
  "master": "10.0.0.10:8000",
  "total_nodes": 2,
  "online_nodes": 2,
  "status": "available"
}
```

**Node Information Response:**
```json
{
  "nodes": [{
    "id": "worker-desktop-01",
    "name": "Development Desktop",
    "host": "10.0.0.11",
    "port": 8001,
    "status": "online",
    "models": ["phi-2", "codellama-7b-instruct"],
    "load": 25,
    "max_load": 100
  }]
}
```

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### 🎯 Areas for Contribution

- **🔧 Core Features**: New routing algorithms, load balancing strategies
- **🤖 Model Support**: Additional model integrations, fine-tuning guides
- **💻 CLI Enhancements**: New commands, output formats, shell integrations
- **🌐 Deployment**: Docker, Kubernetes, cloud deployment scripts
- **📊 Monitoring**: Metrics, dashboards, alerting systems
- **🧪 Testing**: Unit tests, integration tests, performance benchmarks
- **📚 Documentation**: Guides, examples, API reference

### 🛠️ Development Setup

```bash
# Clone and setup
git clone https://github.com/yourusername/finsavvyai.git
cd finsavvyai
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt

# Run tests
python -m pytest

# Code formatting
black .
flake8 .

# Type checking
mypy finsavvyai/
```

### 📝 Submitting Changes

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Ensure all tests pass
5. Update documentation
6. Submit a pull request

---

## 🐛 Troubleshooting

### Common Issues

#### **Service Won't Start**
```bash
# Check port availability
lsof -i :8000
lsof -i :8001

# Kill existing processes
pkill -f start_master.py
pkill -f worker_node.py

# Check logs
tail -f logs/master.log
tail -f logs/worker.log
```

#### **Worker Not Registering**
```bash
# Check network connectivity
ping 10.0.0.10
telnet 10.0.0.10 8000

# Verify master is running
curl http://10.0.0.10:8000/cluster/status

# Check worker logs
python3 worker_node.py --master 10.0.0.10 --verbose
```

#### **Model Loading Issues**
```bash
# Check model directory
ls -la ~/finsavvyai-models/

# Verify model integrity
python3 download_models.py info phi-2

# Re-download corrupted models
python3 download_models.py delete phi-2
python3 download_models.py download phi-2
```

#### **CLI Connection Issues**
```bash
# Check configuration
finsavvyai --verbose describe clusters

# Test direct API access
curl http://localhost:8000/health

# Reset configuration
rm -rf ~/.finsavvyai/
```

### Debug Mode

```bash
# Enable verbose logging
export FINSAVVYAI_DEBUG=1

# Run with debug output
python3 start_master.py --debug
python3 worker_node.py --debug --master 10.0.0.10

# CLI debug mode
finsavvyai --verbose --profile debug describe clusters
```

### Performance Issues

```bash
# Monitor resource usage
htop
iotop

# Check cluster performance
python3 test_cluster_performance.py --benchmark

# Model routing performance
python3 multi_layer_router.py --benchmark
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 FinSavvyAI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## �� Acknowledgments

- **[Hugging Face](https://huggingface.co)** - For the amazing model repository and transformers library
- **[Meta AI](https://ai.meta.com)** - For Llama models and research
- **[Mistral AI](https://mistral.ai)** - For the excellent Mistral models
- **[Microsoft](https://microsoft.com)** - For Phi models and research support
- **[AWS CLI](https://aws.amazon.com/cli/)** - For the command-line interface inspiration
- **[OpenAI](https://openai.com)** - For the API standards and compatibility

---

## 📞 Support & Community

- **📧 Email**: support@finsavvyai.com
- **💬 Discord**: [Join our Discord](https://discord.gg/finsavvyai)
- **🐛 Issues**: [GitHub Issues](https://github.com/yourusername/finsavvyai/issues)
- **📖 Wiki**: [Documentation Wiki](https://github.com/yourusername/finsavvyai/wiki)
- **🐦 Twitter**: [@FinSavvyAI](https://twitter.com/FinSavvyAI)

---

<div align="center">

**⭐ Star this repository if it helped you!**

**🚀 Transform your home computers into a powerful AI development environment**

**💝 Made with ❤️ for the developer community**

</div>