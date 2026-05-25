# 🚀 FINSAVVYAI PROFESSIONAL CLI

**Complete AWS-style CLI for managing your private AI cluster**

---

## 🎯 **INSTALLATION**

### **System-Wide Installation**
```bash
./install_professional_cli.sh
```

### **Manual Installation**
```bash
sudo cp finsavvyai /usr/local/bin/finsavvyai
chmod +x /usr/local/bin/finsavvyai
```

---

## 🛠️ **PROFESSIONAL COMMANDS**

### **📊 Cluster Status**
```bash
# Show cluster overview
finsavvyai status

# Detailed status
finsavvyai status --verbose
```

### **🖥️ Node Management**
```bash
# List all nodes
finsavvyai nodes

# Detailed node information
finsavvy nodes --detailed

# Add worker node
finsavvy add 192.168.1.50

# Add worker on specific port
finsavvy add 192.168.1.50 --port 8002

# Remove node
finsavvy remove laptop-worker
```

### **🚀 Service Management**
```bash
# Start all services
finsavvy start

# Start specific service
finsavvy start --service master
finsavvy start --service worker

# Run in foreground
finsavvy start --foreground

# Stop all services
finsavvy stop

# Stop specific service
finsavvy stop --service master
```

### **🌐 Global Access**
```bash
# Deploy to Cloudflare
finsavvyai deploy
```

### **🧪 Testing**
```bash
# Test with 5 requests
finsavvyai test

# Test with 20 requests
finsavvy test --requests 20
```

### **📱 Monitoring**
```bash
# Monitor every 10 seconds
finsavvy monitor

# Monitor every 5 seconds
finsavvy monitor --interval 5

# Monitor once
finsavvy monitor --interval 5
```

### **ℹ️ System Information**
```bash
# Show system configuration
finsavvy system
```

### **📚 Help**
```bash
# Show help
finsavvyai help
```

---

## 🎯 **OUTPUT FORMATTING**

### **Professional Headers**
```
FinSavvyAI Cluster Status
===================
```

### **Color-Coded Results**
- ✅ Success (Green)
- ❌ Error (Red)
- ⚠️ Warning (Yellow)
- ℹ️ Info (Cyan)

### **Tabular Data**
```
Node Name              Host            Status   Load   Models
-------------------- --------------- ------ ---- -------------------------
Desktop Computer     192.168.1.100  ●     2/10   gpt-3.5-turbo-sim
Laptop Computer      192.168.1.101  ●     1/10   gpt-3.5-turbo-sim
```

---

## 🌐 **CURRENT STATUS**

### **🖥️ Clustered Computers: 1**
- **Worker**: Running
- **Master**: Not running
- **API**: Functional

### **🔗 Access Points**
- **Local**: `http://10.0.0.10:8000`
- **API**: `http://10.0.0.10:8001`
- **Global**: `https://llm.finsavvyai.com` (ready)

---

## 🚀 **AWS-STYLE EXAMPLES**

### **1. Quick Start**
```bash
# Start cluster
finsavvyai start

# Check status
finsavvyai status
```

### **2. Add Workers**
```bash
# Add first worker
finsavvy add 192.168.1.50

# Add vision worker
finsavvy add 192.168.1.51 --port 8002

# Add desktop
finsavvy add 192.168.1.52 --name "Desktop"
```

### **3. Monitor**
```bash
# Real-time monitoring
finsavvy monitor

# Detailed node list
finsavvy nodes --detailed
```

### **4. Global Access**
```bash
# Deploy globally
finsavvy deploy
```

### **5. Testing**
```bash
# Performance test
finsavvy test --requests 100
```

---

## 🔧 **ADVANCED FEATURES**

### **Service Control**
```bash
# Start only master
finsavvy start --service master

# Start only worker
finsavvy start --service worker

# Stop specific service
finsavvy stop --service worker
```

### **Node Control**
```bash
# Add on port 8001 (default)
finsavvy add 192.168.1.50

# Add on port 8002
finsavvy add 192.168.1.51 --port 8002

# Add with name
finsavvy add 192.168.1.52 --name "Vision Worker"
```

### **Monitoring**
```bash
# Monitor every 5 seconds
finsavvy monitor --interval 5

# Monitor once
finsavvy monitor --interval 5

# Verbose output
finsavvy status --verbose
```

---

## 📱 **MOBILE APPS**

### **Configuration**
```
Base URL: http://10.0.0.10:8001
API Key: finsavvy-5d19b8e7c71d4679
```

### **Testing**
```bash
# Simple test
curl -X POST http://10.0.0.10:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-3.5-turbo-sim", "messages": [{"role": "user", "content": "Hello!"}]}'
```

---

## 🎉 **PROFESSIONAL FEATURES**

### **✅ AWS-Style CLI**
- Color-coded output
- Professional formatting
- Tabular data
- Complete cluster management
- System-wide installation

### **✅ Complete Control**
- Start/stop services
- Add/remove nodes
- Monitor performance
- Global deployment

### **✅ Mobile Ready**
- OpenAI compatible
- Any device
- Cloudflare proxy

### **✅ Production Ready**
- Distributed processing
- Load balancing
- Fault tolerance

**🚀 Your professional AWS-style CLI is ready!**