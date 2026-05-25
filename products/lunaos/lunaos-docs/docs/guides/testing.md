# 🧪 Luna Vision RAG™ Testing Guide

Complete guide for testing your Luna Vision RAG™ API at **https://rag.lunaos.ai**

---

## 🚀 Quick Start

### **1. Automated Test Suite** (Recommended)

Run the complete test suite:

```bash
cd mcp-servers/luna-rag-glm-integration
./test-domain.sh
```

This tests:
- ✅ DNS resolution
- ✅ Health endpoint
- ✅ API info endpoint
- ✅ Response time
- ✅ SSL certificate
- ✅ CORS headers
- ✅ RAG query endpoint

---

## 📋 Manual Testing Methods

### **Method 1: Browser Testing**

Simply open these URLs in your browser:

1. **Health Check**:
   ```
   https://rag.lunaos.ai/health
   ```

2. **API Info**:
   ```
   https://rag.lunaos.ai/api
   ```

You should see JSON responses!

---

### **Method 2: Command Line (curl)**

#### **A. Health Check**
```bash
curl https://rag.lunaos.ai/health | jq .
```

**Expected Response**:
```json
{
  "status": "healthy",
  "service": "Luna Vision RAG",
  "version": "1.0.0",
  "environment": "production",
  "timestamp": "2025-11-06T14:00:00.000Z",
  "features": {
    "rag": true,
    "glmVision": true,
    "contextAware": true,
    "autoGenerate": true
  }
}
```

#### **B. API Endpoints List**
```bash
curl https://rag.lunaos.ai/api | jq .
```

**Expected Response**:
```json
{
  "health": "/health",
  "rag": {
    "setup": "/api/rag/setup",
    "query": "/api/rag/query",
    "index": "/api/rag/index"
  },
  "glm": {
    "capture": "/api/glm/capture",
    "analyze": "/api/glm/analyze",
    "test": "/api/glm/test"
  },
  "integration": {
    "validate": "/api/integration/validate",
    "generate": "/api/integration/generate",
    "report": "/api/integration/report"
  }
}
```

#### **C. RAG Setup**
```bash
curl -X POST https://rag.lunaos.ai/api/rag/setup \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/your/project",
    "collectionName": "my-project",
    "vectorDB": "pinecone"
  }' | jq .
```

**Expected Response**:
```json
{
  "success": true,
  "message": "RAG system configured successfully",
  "projectPath": "/path/to/your/project",
  "collectionName": "my-project"
}
```

#### **D. RAG Query**
```bash
curl -X POST https://rag.lunaos.ai/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I authenticate users?",
    "collectionName": "my-project",
    "topK": 5
  }' | jq .
```

**Expected Response**:
```json
{
  "success": true,
  "query": "How do I authenticate users?",
  "results": [
    {
      "id": "ctx_1",
      "content": "Sample context from codebase",
      "score": 0.95,
      "metadata": {
        "file": "src/components/Auth.tsx",
        "type": "component"
      }
    }
  ],
  "cached": false
}
```

#### **E. GLM Vision Analyze**
```bash
curl -X POST https://rag.lunaos.ai/api/glm/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "screenshotUrl": "https://example.com/screenshot.png",
    "analysisType": "ui-elements"
  }' | jq .
```

#### **F. Integration Validate**
```bash
curl -X POST https://rag.lunaos.ai/api/integration/validate \
  -H "Content-Type: application/json" \
  -d '{
    "component": "LoginForm",
    "expectedBehavior": "Should validate email format",
    "context": "User authentication flow"
  }' | jq .
```

---

### **Method 3: JavaScript/Node.js**

Create a test file `test-api.js`:

```javascript
// test-api.js
const API_BASE = 'https://rag.lunaos.ai';

async function testAPI() {
  console.log('🧪 Testing Luna Vision RAG™ API...\n');

  // 1. Health Check
  console.log('1️⃣ Health Check:');
  const health = await fetch(`${API_BASE}/health`);
  const healthData = await health.json();
  console.log(healthData);
  console.log('');

  // 2. API Info
  console.log('2️⃣ API Info:');
  const api = await fetch(`${API_BASE}/api`);
  const apiData = await api.json();
  console.log(apiData);
  console.log('');

  // 3. RAG Setup
  console.log('3️⃣ RAG Setup:');
  const setup = await fetch(`${API_BASE}/api/rag/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectPath: '/my/project',
      collectionName: 'test-collection',
      vectorDB: 'pinecone'
    })
  });
  const setupData = await setup.json();
  console.log(setupData);
  console.log('');

  // 4. RAG Query
  console.log('4️⃣ RAG Query:');
  const query = await fetch(`${API_BASE}/api/rag/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'How do I test my app?',
      collectionName: 'test-collection',
      topK: 3
    })
  });
  const queryData = await query.json();
  console.log(queryData);
  console.log('');

  console.log('✅ All tests complete!');
}

testAPI().catch(console.error);
```

Run it:
```bash
node test-api.js
```

---

### **Method 4: Python**

Create a test file `test_api.py`:

```python
# test_api.py
import requests
import json

API_BASE = 'https://rag.lunaos.ai'

def test_api():
    print('🧪 Testing Luna Vision RAG™ API...\n')
    
    # 1. Health Check
    print('1️⃣ Health Check:')
    response = requests.get(f'{API_BASE}/health')
    print(json.dumps(response.json(), indent=2))
    print()
    
    # 2. API Info
    print('2️⃣ API Info:')
    response = requests.get(f'{API_BASE}/api')
    print(json.dumps(response.json(), indent=2))
    print()
    
    # 3. RAG Setup
    print('3️⃣ RAG Setup:')
    response = requests.post(
        f'{API_BASE}/api/rag/setup',
        json={
            'projectPath': '/my/project',
            'collectionName': 'test-collection',
            'vectorDB': 'pinecone'
        }
    )
    print(json.dumps(response.json(), indent=2))
    print()
    
    # 4. RAG Query
    print('4️⃣ RAG Query:')
    response = requests.post(
        f'{API_BASE}/api/rag/query',
        json={
            'query': 'How do I test my app?',
            'collectionName': 'test-collection',
            'topK': 3
        }
    )
    print(json.dumps(response.json(), indent=2))
    print()
    
    print('✅ All tests complete!')

if __name__ == '__main__':
    test_api()
```

Run it:
```bash
python test_api.py
```

---

### **Method 5: Postman/Insomnia**

Import this collection:

```json
{
  "name": "Luna Vision RAG",
  "requests": [
    {
      "name": "Health Check",
      "method": "GET",
      "url": "https://rag.lunaos.ai/health"
    },
    {
      "name": "API Info",
      "method": "GET",
      "url": "https://rag.lunaos.ai/api"
    },
    {
      "name": "RAG Setup",
      "method": "POST",
      "url": "https://rag.lunaos.ai/api/rag/setup",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": {
        "projectPath": "/my/project",
        "collectionName": "test-collection",
        "vectorDB": "pinecone"
      }
    },
    {
      "name": "RAG Query",
      "method": "POST",
      "url": "https://rag.lunaos.ai/api/rag/query",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": {
        "query": "How do I test my app?",
        "collectionName": "test-collection",
        "topK": 5
      }
    }
  ]
}
```

---

## ⚡ Performance Testing

### **Test Response Time**

```bash
# Single request
curl -w "\nTime: %{time_total}s\n" -s -o /dev/null https://rag.lunaos.ai/health

# Multiple requests
for i in {1..10}; do
  echo "Request $i:"
  curl -w "Time: %{time_total}s\n" -s -o /dev/null https://rag.lunaos.ai/health
done
```

### **Load Testing with Apache Bench**

```bash
# 100 requests, 10 concurrent
ab -n 100 -c 10 https://rag.lunaos.ai/health

# 1000 requests, 50 concurrent
ab -n 1000 -c 50 https://rag.lunaos.ai/health
```

### **Load Testing with wrk**

```bash
# 30 seconds, 10 threads, 100 connections
wrk -t10 -c100 -d30s https://rag.lunaos.ai/health
```

---

## 🔍 Advanced Testing

### **Test CORS**

```bash
curl -X OPTIONS https://rag.lunaos.ai/api/rag/query \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -I
```

**Expected Headers**:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### **Test SSL Certificate**

```bash
# Check SSL details
openssl s_client -connect rag.lunaos.ai:443 -servername rag.lunaos.ai

# Check SSL grade
curl -I https://rag.lunaos.ai/health | grep -i "server\|http"
```

### **Test DNS Resolution**

```bash
# Check DNS
dig rag.lunaos.ai

# Check with specific DNS server
dig @8.8.8.8 rag.lunaos.ai

# Check DNS propagation globally
curl https://www.whatsmydns.net/api/details?server=all&type=A&query=rag.lunaos.ai
```

---

## 📊 Monitoring & Debugging

### **Check Cloudflare Analytics**

1. Go to: https://dash.cloudflare.com
2. Select: **lunaos.ai**
3. Click: **Analytics & Logs**
4. View: Request metrics, bandwidth, errors

### **Check Worker Logs**

```bash
# Tail logs in real-time
wrangler tail luna-vision-rag

# Filter by status
wrangler tail luna-vision-rag --status error

# Filter by method
wrangler tail luna-vision-rag --method POST
```

### **Check Deployment Status**

```bash
cd mcp-servers/luna-rag-glm-integration

# List deployments
wrangler deployments list

# View specific deployment
wrangler deployments view <deployment-id>
```

---

## 🐛 Troubleshooting

### **Issue: DNS not resolving**

```bash
# Clear DNS cache (Mac)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Clear DNS cache (Linux)
sudo systemd-resolve --flush-caches

# Clear DNS cache (Windows)
ipconfig /flushdns
```

### **Issue: Slow response time**

```bash
# Test from different locations
curl -w "\nTime: %{time_total}s\n" https://rag.lunaos.ai/health

# Check Cloudflare status
curl https://www.cloudflarestatus.com/api/v2/status.json
```

### **Issue: CORS errors**

Check that preflight requests work:
```bash
curl -X OPTIONS https://rag.lunaos.ai/api/rag/query \
  -H "Origin: https://your-app.com" \
  -I
```

---

## ✅ Test Checklist

Use this checklist to verify everything works:

- [ ] Health endpoint responds (GET /health)
- [ ] API info endpoint responds (GET /api)
- [ ] RAG setup endpoint responds (POST /api/rag/setup)
- [ ] RAG query endpoint responds (POST /api/rag/query)
- [ ] RAG index endpoint responds (POST /api/rag/index)
- [ ] GLM capture endpoint responds (POST /api/glm/capture)
- [ ] GLM analyze endpoint responds (POST /api/glm/analyze)
- [ ] GLM test endpoint responds (POST /api/glm/test)
- [ ] Integration validate responds (POST /api/integration/validate)
- [ ] Integration generate responds (POST /api/integration/generate)
- [ ] Integration report responds (POST /api/integration/report)
- [ ] Response time < 100ms
- [ ] SSL certificate valid
- [ ] CORS headers present
- [ ] DNS resolves correctly
- [ ] Works from different locations
- [ ] Works in browser
- [ ] Works via curl
- [ ] Works via JavaScript fetch
- [ ] Works via Python requests

---

## 🎯 Quick Test Commands

Copy and paste these for quick testing:

```bash
# Health check
curl https://rag.lunaos.ai/health | jq .

# API info
curl https://rag.lunaos.ai/api | jq .

# RAG query
curl -X POST https://rag.lunaos.ai/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query":"test","collectionName":"demo","topK":5}' | jq .

# Response time
curl -w "\nTime: %{time_total}s\n" -s -o /dev/null https://rag.lunaos.ai/health

# Full test suite
cd mcp-servers/luna-rag-glm-integration && ./test-domain.sh
```

---

## 📞 Support

If you encounter issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review [CUSTOM_DOMAIN_SUCCESS.md](./CUSTOM_DOMAIN_SUCCESS.md)
3. Check Cloudflare Dashboard for errors
4. Review Worker logs: `wrangler tail luna-vision-rag`

---

**Your Luna Vision RAG™ is live at: https://rag.lunaos.ai** 🚀

Happy testing! 🧪
