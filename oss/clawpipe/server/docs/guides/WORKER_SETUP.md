# 🌐 FinSavvyAI Distributed Worker Setup

Add other computers to your FinSavvyAI cluster and distribute AI processing across your network!

## 🚀 Quick Start

### **Option 1: Automatic Setup (Recommended)**

1. **Copy the worker files** to the other computer:
   ```bash
   # On your main computer (where FinSavvyAI is running)
   scp worker_node.py user@other-computer:~/
   scp install_worker.sh user@other-computer:~/
   
   # Or create a ZIP file:
   zip worker_package.zip worker_node.py install_worker.sh install_worker.bat README.md
   ```

2. **Run the installer** on the other computer:
   ```bash
   # Linux/macOS
   chmod +x install_worker.sh
   ./install_worker.sh
   
   # Windows
   install_worker.bat
   ```

3. **Enter details** when prompted:
   - Master host: `10.0.0.10` (your main computer's IP)
   - Worker name: `Laptop-Worker` (any name)
   - Model: `gpt-3.5-turbo-sim`

4. **Start the worker**:
   ```bash
   ./start_worker.sh
   ```

### **Option 2: Manual Setup**

1. **Install Python 3.8+** on the other computer

2. **Install dependencies**:
   ```bash
   pip install aiohttp psutil
   ```

3. **Download worker script** and run:
   ```bash
   python3 worker_node.py --master 10.0.0.10 --name "My Worker"
   ```

## 🔍 Network Discovery

### **Automatic Discovery**
```bash
# On your main computer
python3 network_scanner.py --scan --monitor

# Scan specific network
python3 network_scanner.py --network 192.168.1.0/24
```

### **Manual Addition**
```python
# In your cluster master
# Workers will auto-register when they start
```

## 🏠 Example Setup

### **Computer 1 (Master)**: `10.0.0.10`
- **Running**: Cluster Master + Worker
- **Port**: 8000 (master), 8001 (worker)
- **Purpose**: Coordination + Processing

### **Computer 2 (Laptop)**: `10.0.0.15`
- **Install**: Worker node
- **Port**: 8001
- **Purpose**: Processing
- **Command**:
  ```bash
  python3 worker_node.py --master 10.0.0.10 --name "Laptop-Worker"
  ```

### **Computer 3 (Desktop)**: `10.0.0.20`
- **Install**: Worker node
- **Port**: 8001
- **Purpose**: Processing
- **Command**:
  ```bash
  python3 worker_node.py --master 10.0.0.10 --name "Desktop-Worker" --models phi-2
  ```

### **Computer 4 (Server)**: `10.0.0.25`
- **Install**: Worker node + GLM-4V
- **Port**: 8002
- **Purpose**: Vision processing
- **Command**:
  ```bash
  python3 worker_node.py --master 10.0.0.10 --name "Vision-Worker" --models glm-4v-9b --port 8002
  ```

## 📊 Managing Workers

### **Check Cluster Status**
```bash
# Master status
curl http://10.0.0.10:8000/cluster/status

# List all nodes
curl http://10.0.0.10:8000/cluster/nodes

# Individual worker health
curl http://10.0.0.15:8001/health
```

### **Worker Dashboard**
Visit any worker's dashboard:
- **Laptop**: `http://10.0.0.15:8001/`
- **Desktop**: `http://10.0.0.20:8001/`
- **Vision**: `http://10.0.0.25:8002/`

### **Load Balancing**
The master automatically:
- ✅ Routes requests to least busy workers
- ✅ Handles worker failures
- ✅ Monitors worker health
- ✅ Distributes by model capabilities

## 🔧 Advanced Configuration

### **Different Models per Worker**
```bash
# Text-only worker
python3 worker_node.py --models gpt-3.5-turbo-sim

# Vision worker
python3 worker_node.py --models glm-4v-9b

# Multiple models
python3 worker_node.py --models gpt-3.5-turbo-sim phi-2 glm-4v-9b
```

### **Worker Priority**
```bash
# High-capacity worker
python3 worker_node.py --name "High-Performance-Server" --models gpt-3.5-turbo-sim

# Specialized worker
python3 worker_node.py --name "Vision-Only" --models glm-4v-9b
```

## 🌐 Cross-Platform

### **macOS**
```bash
# Install
./install_worker.sh

# Start as service
sudo cp finsavvyai-worker.service /Library/LaunchDaemons/
launchctl load -w /Library/LaunchDaemons/finsavvyai-worker.service
```

### **Linux**
```bash
# Install
./install_worker.sh

# Start as service
sudo systemctl enable finsavvyai-worker
sudo systemctl start finsavvyai-worker
```

### **Windows**
```bash
# Install
install_worker.bat

# Start as service (optional)
nssm install FinSavvyAIWorker start_worker.bat
```

## 🧪 Testing Distributed Processing

### **Load Test**
```bash
# Send 10 concurrent requests
for i in {1..10}; do
  curl -X POST http://10.0.0.10:8000/cluster/completions \
    -H "Content-Type: application/json" \
    -d '{"model": "gpt-3.5-turbo-sim", "messages": [{"role": "user", "content": "Request '$i'"}]}' &
done
wait
```

### **Check Distribution**
```bash
# See which worker processed each request
curl http://10.0.0.10:8000/cluster/nodes
```

## 🔍 Troubleshooting

### **Worker Not Connecting**
```bash
# Check network connectivity
ping 10.0.0.10

# Check master status
curl http://10.0.0.10:8000/health

# Check worker logs
tail -f worker.log
```

### **Performance Issues**
```bash
# Monitor worker load
curl http://10.0.0.15:8001/status

# Check cluster distribution
curl http://10.0.0.10:8000/cluster/nodes
```

### **Firewall Issues**
Make sure ports are open:
- **Master**: 8000
- **Workers**: 8001-8005

## 🎯 Benefits

### **With Multiple Workers:**
- ✅ **10x+ processing power**
- ✅ **Load distribution**
- ✅ **Fault tolerance**
- ✅ **Resource optimization**
- ✅ **Specialized models**

### **Example Performance:**
- **1 Worker**: 5 requests/second
- **3 Workers**: 15 requests/second
- **5 Workers**: 25+ requests/second

## 🚀 Next Steps

1. **Add workers** to all available computers
2. **Monitor** via network scanner
3. **Test** with load
4. **Deploy** specialized workers (vision, different models)
5. **Scale** as needed

Your private AI cluster is now distributed across your entire network! 🌐