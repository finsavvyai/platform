# 🚀 FINSAVVYAI CLI - COMPLETE CLUSTER MANAGEMENT

## 🎯 **Your Cluster Status**
Currently: **NO COMPUTERS CLUSTERED**

The cluster is ready but not running. Here's how to use the CLI to manage everything:

---

## 🛠️ **CLI COMMANDS**

### **Installation**
```bash
# Install globally (optional)
./install_cli.sh

# Or run directly
python3 finsavvyai.py
```

### **Show Help**
```bash
python3 finsavvyai.py --help
```

---

## 📊 **CLUSTER STATUS COMMANDS**

### **Check Cluster Status**
```bash
# Basic status
python3 finsavvyai.py status

# Verbose with more details
python3 finsavvyai.py status --verbose

# Shows:
# - Master IP: 10.0.0.10:8000
# - Total nodes: 0
# - Online nodes: 0
# - Models: 0
```

### **List Connected Hosts**
```bash
# Basic host list
python3 finsavvyai.py hosts

# Detailed host information
python3 finsavvyai.py hosts --detailed

# Shows:
# - Worker name
# - Host IP and port
# - Models available
# - System resources
# - Current load
```

---

## 🚀 **SERVICE MANAGEMENT**

### **Start Services**
```bash
# Start all services in background
python3 finsavvyai.py start --background

# Start only master
python3 finsavvyai.py start master --background

# Start only worker
python3 finsavvyai.py start worker --background
```

### **Stop Services**
```bash
# Stop all services
python3 finsavvyai.py stop

# Stop only master
python3 finsavvyai.py stop master

# Stop only worker
python3 finsavvyai.py stop worker
```

---

## 🖥️ **HOST MANAGEMENT**

### **Add Worker Host**
```bash
# Add worker by IP
python3 finsavvyai.py add --host 192.168.1.50

# Add worker with specific port
python3 finsavvyai.py add --host 192.168.1.50 --port 8002

# Add worker with name
python3 finsavvyai.py add --host 192.168.1.50 --name "Laptop Worker"
```

### **Remove Worker Host**
```bash
python3 finsavvyai.py remove --host 192.168.1.50
```

---

## 🌐 **NETWORK COMMANDS**

### **Scan Network for Workers**
```bash
# Scan default network
python3 finsavvyai.py scan

# Scan specific network range
python3 finsavvyai.py scan --network 192.168.1.0/24

# Scan different subnet
python3 finsavvyai.py scan --network 10.0.0.0/24
```

### **Monitor Cluster**
```bash
# Continuous monitoring
python3 finsavvyai.py monitor

# Monitor once
python3 finsavvyai.py monitor --once

# Custom refresh interval
python3 finsavvyai.py monitor --interval 5
```

---

## 🧪 **TESTING COMMANDS**

### **Test Cluster Performance**
```bash
# Test with 5 requests (default)
python3 finsavvyai.py test

# Test with 20 concurrent requests
python3 finsavvyai.py test --requests 20

# Test with 100 requests
python3 finsavvyai.py test --requests 100
```

---

## 🎯 **QUICK START SEQUENCE**

### **1. Start Your Cluster**
```bash
# Start master + worker
python3 finsavvyai.py start --background

# Wait 5 seconds
sleep 5

# Check status
python3 finsavvyai.py status
```

### **2. Add Workers**
```bash
# On other computers:
curl -s https://raw.githubusercontent.com/your-repo/worker_node.py | python3 - \
    --master 10.0.0.10 --name "My Worker"

# Or add manually:
python3 finsavvyai.py add --host 192.168.1.50
```

### **3. Monitor**
```bash
# Real-time monitoring
python3 finsavvyai.py monitor

# Check load balancer
python3 finsavvyai.py status --verbose
```

### **4. Test**
```bash
# Test with 10 requests
python3 finsavvyai.py test --requests 10
```

---

## 📱 **CURRENTLY CLUSTERED COMPUTERS: 0**

### **Example After Adding Workers:**
```
🖥️ Connected Worker Hosts
==================================================
📊 Total Workers: 3

1. 🟢 Desktop Computer
   🏠 Host: 192.168.1.100:8001
   🆔 ID: desktop-01
   🤖 Models: gpt-3.5-turbo-sim, phi-2
   ⚖️ Load: 2/10
   💻 Platform: macOS
   🖥️ CPU: 8 cores
   💾 Memory: 16 GB

2. 🟢 Laptop Computer
   🏠 Host: 192.168.1.101:8001
   🆔 ID: laptop-01
   🤖 Models: gpt-3.5-turbo-sim
   ⚖️ Load: 1/10
   💻 Platform: Windows
   🖥️ CPU: 4 cores
   💾 Memory: 8 GB

3. 🟢 Server
   🏠 Host: 192.168.1.102:8002
   🆔 ID: server-01
   🤖 Models: glm-4v-9b, gpt-3.5-turbo-sim
   ⚖️ Load: 5/10
   💻 Platform: Linux
   🖥️ CPU: 16 cores
   💾 Memory: 32 GB
```

---

## 🌐 **GLOBAL ACCESS**

### **Deploy to Cloudflare**
```bash
./deploy-cloudflare.sh

# Test global access
curl https://llm.finsavvyai.com/health
```

---

## 🔧 **ADVANCED COMMANDS**

### **Detailed Host Information**
```bash
python3 finsavvyai.py hosts --detailed
```

### **Load Balancer Status**
```bash
python3 finsavvyai.py status --verbose
```

### **Network Scan**
```bash
python3 finsavvyai.py scan --network 192.168.1.0/24
```

### **Performance Testing**
```bash
python3 finsavvyai.py test --requests 50
```

---

## 🎯 **NEXT STEPS**

1. **Start the cluster**: `python3 finsavvyai.py start --background`
2. **Add workers**: `python3 finsavvyai.py add --host IP`
3. **Monitor**: `python3 finsavvyai.py monitor`
4. **Test**: `python3 finsavvyai.py test --requests 10`
5. **Deploy**: `./deploy-cloudflare.sh`

**🚀 Your CLI is ready to manage your entire distributed AI cluster!**