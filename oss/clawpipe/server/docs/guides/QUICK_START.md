# 🚀 FinSavvyAI Quick Start Guide

## Installation

### Prerequisites
- Python 3.8+
- Node.js 16+ (for desktop app)
- Go 1.19+ (for desktop app backend)

### Install FinSavvyAI
```bash
# Clone or navigate to project
cd /path/to/finsavvyai

# Install Python dependencies
pip3 install -r requirements.txt

# Install Node.js dependencies (for desktop app)
npm install

# Install Playwright browsers (for testing)
npx playwright install
```

---

## Quick Start (5 Minutes)

### 1. Deploy Services
```bash
# Deploy all services
./deploy_production.sh

# Or deploy individually
./start_master.sh
./start_worker.sh
./start_gateway.sh
```

### 2. Verify Deployment
```bash
# Check status
./status.sh

# Or use CLI
python3 main.py describe clusters
```

### 3. Test the API
```bash
# List models
curl http://localhost:8080/v1/models

# Send chat request
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo-sim",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### 4. Access Desktop App
```bash
# Open in browser
open http://localhost:3000

# Or build native app
cd desktop-app
./build_macos_app.sh
```

---

## Common Commands

### Service Management
```bash
# Start all services
./deploy_production.sh

# Stop all services
./stop.sh

# Check status
./status.sh

# View logs
tail -f logs/master.log
tail -f logs/worker.log
tail -f logs/gateway.log
```

### CLI Commands
```bash
# Cluster information
python3 main.py describe clusters
python3 main.py describe nodes
python3 main.py describe services

# Service management
python3 main.py start service all
python3 main.py stop service all

# Help
python3 main.py help
python3 main.py --version
```

### Testing
```bash
# Run all tests
npm test

# Run specific test suite
npx playwright test functional/cluster-api.spec.js
npx playwright test functional/cli.spec.js
npx playwright test functional/desktop-app.spec.js
```

---

## Service Endpoints

### Master Server (Port 8000)
- Health: `http://localhost:8000/health`
- Cluster Status: `http://localhost:8000/cluster/status`
- List Nodes: `http://localhost:8000/cluster/nodes`

### Worker Node (Port 8001)
- Health: `http://localhost:8001/health`
- Models: `http://localhost:8001/v1/models`
- Chat: `http://localhost:8001/v1/chat/completions`

### API Gateway (Port 8080)
- Health: `http://localhost:8080/health`
- Models: `http://localhost:8080/v1/models`
- Chat: `http://localhost:8080/v1/chat/completions`

---

## Adding More Workers

### On Same Machine
```bash
# Start additional worker on different port
python3 src/workers/worker_node.py --master localhost --port 8002
```

### On Different Machine
```bash
# Replace <master-ip> with your master server IP
python3 src/workers/worker_node.py --master <master-ip> --port 8001
```

---

## Troubleshooting

### Services Not Starting
```bash
# Check if ports are in use
lsof -i :8000,8001,8080

# Check logs
tail -f logs/master.log
tail -f logs/worker.log
tail -f logs/gateway.log

# Restart services
./stop.sh
./deploy_production.sh
```

### Tests Failing
```bash
# Ensure services are running
./status.sh

# Wait a few seconds for services to initialize
sleep 5

# Run tests
npm test
```

### API Not Responding
```bash
# Check service health
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:8080/health

# Restart if needed
./stop.sh && ./deploy_production.sh
```

---

## Next Steps

1. **Integrate Real Models**: Connect to actual LLM inference engines
2. **Add More Workers**: Scale horizontally across machines
3. **Build macOS App**: Create distributable application
4. **Deploy to Cloud**: Set up for external access
5. **Add Security**: Implement authentication and API keys

---

## Documentation

- **Full Documentation**: `docs/README.md`
- **CLI Guide**: `docs/guides/CLI_GUIDE.md`
- **Deployment Guide**: `DEPLOYMENT_COMPLETE.md`
- **Test Results**: `TEST_RESULTS_COMPLETE.md`
- **Next Steps**: `NEXT_STEPS.md`

---

**Ready to go!** 🚀
