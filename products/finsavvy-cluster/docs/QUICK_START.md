# Quick Start Guide

Get your FinSavvyAI cluster running in under 5 minutes!

## 🚀 One-Command Setup

```bash
# Clone and setup in one command
curl -fsSL https://raw.githubusercontent.com/finsavvyai/finsavvyai-cluster/master/quick_start.sh | bash
```

## 📋 Manual Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Setup CLI
```bash
chmod +x finsavvyai_aws
ln -sf "$(pwd)/finsavvyai_aws" ~/.local/bin/finsavvyai
```

### 3. Download Essential Models
```bash
python3 download_models.py download phi-2
python3 download_models.py download codellama-7b-instruct
```

### 4. Start Your Cluster
```bash
finsavvyai start service all
finsavvyai describe services
```

## ✅ Verify Installation

```bash
# Check cluster status
finsavvyai describe clusters

# Test intelligent routing
python3 multi_layer_router.py

# All systems should show "AVAILABLE" status
```

## 🎯 Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Install workers on other computers with `./install_worker.sh`
- Try the [examples](README.md#examples) to see the power of intelligent routing

Your professional AI cluster is ready! 🎉