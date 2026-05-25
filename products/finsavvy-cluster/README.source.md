# 🤖 FinSavvyAI - Professional AWS-Style Distributed AI Cluster

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Version](https://img.shields.io/badge/version-1.0.0-red.svg)]()

**🚀 Enterprise-grade distributed AI cluster with professional AWS-style CLI**

[📖 Full Documentation](docs/README.md) • [⚡ Quick Start](docs/QUICK_START.md) • [🛠️ Installation Guide](docs/guides/) • [📚 Examples](docs/examples/)

</div>

---

## 🌟 Overview

FinSavvyAI transforms your home computers into a powerful, professional AI development environment with intelligent model routing and AWS-style management.

### ✨ Key Features

- **🏠 Distributed Computing**: Multiple computers working as one AI cluster
- **🧠 Intelligent Routing**: Automatic task-to-model selection (coding → CodeLlama, vision → GLM-4V)
- **💻 Professional CLI**: AWS-style command interface you already know
- **⚡ Multi-Layer Models**: 12 specialized AI models across 5 capability layers
- **📊 Production Monitoring**: Real-time health checks and performance metrics
- **🌐 Network Ready**: Access from any device on your network

---

## 🚀 Quick Start

### One-Command Installation
```bash
curl -fsSL https://raw.githubusercontent.com/finsavvyai/finsavvyai-cluster/master/scripts/installation/quick_install.sh | bash
```

### Manual Setup
```bash
# 1. Clone the repository
git clone https://github.com/finsavvyai/finsavvyai-cluster.git
cd finsavvyai-cluster

# 2. Install dependencies
pip install -r requirements.txt

# 3. Install CLI
pip install -e .

# 4. Download essential models
python -m src.models.download_models download phi-2
python -m src.models.download_models download codellama-7b-instruct

# 5. Start your cluster
finsavvyai start service all
```

---

## 💻 Professional AWS-Style CLI

```bash
# Just like AWS CLI!
finsavvyai describe clusters
finsavvyai describe nodes --detailed
finsavvyai start service master
finsavvyai --output json describe services

# Your current status
finsavvyai describe services
```

---

## 🏗️ Project Structure

```
finsavvyai-cluster/
├── 📦 src/                    # Source code
│   ├── core/                  # Core AI components
│   ├── cli/                   # AWS-style CLI
│   ├── workers/               # Worker nodes
│   ├── models/                # Model management
│   └── api/                   # API components
├── 📚 docs/                   # Complete documentation
│   ├── guides/                # User guides
│   ├── examples/              # Usage examples
│   └── api/                   # API reference
├── 🛠️ scripts/                # Automation tools
├── ⚙️ config/                 # Configuration files
├── 🧪 tests/                  # Test suites
└── 🔧 tools/                  # Utilities
```

---

## 🎯 What You Get

### **🧠 Multi-Layer AI Intelligence**
- **Layer 1**: Fast models (phi-2, mistral-7b)
- **Layer 2**: Development specialized (CodeLlama, DeepSeek Coder)
- **Layer 3**: Complex reasoning (Llama-2, Llama-3)
- **Layer 4**: Multimodal vision (GLM-4V, LLaVA)
- **Layer 5**: Specialized (SQLCoder, MathCoder)

### **💻 Professional Management**
- AWS-style CLI with `describe`, `start`, `stop` commands
- JSON/YAML/Table output formats
- Profile-based configuration
- Real-time monitoring and health checks

### **🌐 Distributed Architecture**
- Auto-discovery and load balancing
- Fault-tolerant worker management
- Network-wide deployment
- Production-ready scaling

---

## 📖 Documentation

- **📖 [Complete Guide](docs/README.md)** - Full documentation
- **⚡ [Quick Start](docs/QUICK_START.md)** - 5-minute setup
- **🛠️ [Installation](docs/guides/)** - Detailed setup guides
- **📚 [Examples](docs/examples/)** - Usage examples and tutorials

---

## 🎊 Ready to Transform Your Home AI?

Your FinSavvyAI cluster is ready to turn your computers into a powerful, professionally managed AI development environment.

**🚀 Get started in minutes!**

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/finsavvyai/finsavvyai-cluster?style=social)](https://github.com/finsavvyai/finsavvyai-cluster)
[![GitHub forks](https://img.shields.io/github/forks/finsavvyai/finsavvyai-cluster?style=social)](https://github.com/finsavvyai/finsavvyai-cluster/fork)
[![GitHub issues](https://img.shields.io/github/issues/finsavvyai/finsavvyai-cluster)](https://github.com/finsavvyai/finsavvyai-cluster/issues)

**⭐ Star this repository if it helped you!**

</div>