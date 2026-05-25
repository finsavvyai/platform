# 🚀 QuantumBeam.io Cloudflare Deployment with MCP

## Current Setup ✅
- **Domain**: quantumbeam.io (registered at NameCheap)
- **DNS**: Hosted at Cloudflare
- **Solution**: Cloudflare Workers + MCP integration

## 🎯 What You Get

### **Cloudflare Workers (Free Tier)**
- ✅ 100,000 requests/day
- ✅ Global CDN
- ✅ SSL/TLS included
- ✅ DDoS protection
- ✅ Edge computing
- ✅ MCP protocol support

### **MCP Integration Features**
- 🔍 `detect_fraud` - Real-time fraud detection
- 📊 `analyze_pattern` - Transaction pattern analysis
- 🎯 `get_risk_score` - Comprehensive risk scoring
- 🤖 Full MCP protocol support

## 🚀 5-Minute Deployment

### **Step 1: Install Wrangler CLI**
```bash
npm install -g wrangler
```

### **Step 2: Login to Cloudflare**
```bash
wrangler login
# This will open your browser to authenticate
```

### **Step 3: Configure Worker**
```bash
cd production-deploy
npm install
```

### **Step 4: Set Environment Variables**
```bash
# Set your backend API URL (your Railway/Render deployment)
wrangler secret put BACKEND_URL
# Enter: https://your-backend-app.railway.app

# Set API key for your backend
wrangler secret put API_KEY
# Enter your backend API key
```

### **Step 5: Deploy!**
```bash
# Deploy to production
wrangler deploy

# Or deploy to staging first
wrangler deploy --env staging
```

### **Step 6: Update Cloudflare Routes**
```bash
# This is automatically configured by wrangler.toml
# Routes: quantumbeam.io/* and api.quantumbeam.io/*
```

## 🌐 DNS Configuration (Already Done!)

Since your domain is already on Cloudflare:
1. ✅ **Nameservers**: Pointing to Cloudflare
2. ✅ **Domain**: quantumbeam.io
3. ✅ **SSL**: Free SSL certificate
4. ✅ **CDN**: Global distribution

## 🧪 Test Your Deployment

### **Health Check**
```bash
curl https://quantumbeam.io/health
```

### **MCP Test**
```bash
# Test MCP protocol
curl -X POST https://quantumbeam.io/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### **Fraud Detection Test**
```bash
# Test fraud detection via MCP
curl -X POST https://quantumbeam.io/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "detect_fraud",
      "arguments": {
        "transaction_id": "test_123",
        "amount": 1500.00,
        "currency": "USD",
        "merchant_id": "merchant_001"
      }
    }
  }'
```

## 📊 Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Landing page |
| `/health` | GET | Health check |
| `/api/*` | ALL | Proxied to backend |
| `/mcp` | POST | MCP protocol endpoint |

## 🔧 MCP Tools Available

### **detect_fraud**
```json
{
  "transaction_id": "txn_12345",
  "amount": 1500.00,
  "currency": "USD",
  "merchant_id": "merchant_001",
  "card_number": "****1234",
  "timestamp": "2024-01-15T10:30:00Z",
  "ip_address": "192.168.1.1"
}
```

### **analyze_pattern**
```json
{
  "customer_id": "cust_123",
  "time_window": "24h",
  "pattern_type": "velocity"
}
```

### **get_risk_score**
```json
{
  "entity_id": "cust_123",
  "entity_type": "customer",
  "include_history": true
}
```

## 🎛️ Management Commands

```bash
# View logs
wrangler tail

# Deploy new version
wrangler deploy

# Set/update secrets
wrangler secret put API_KEY

# View worker info
wrangler whoami

# Check usage stats
wrangler analytics
```

## 📈 Free Tier Limits

- ✅ **100,000 requests/day**
- ✅ **10ms CPU time per request**
- ✅ **Unlimited bandwidth**
- ✅ **Global CDN**
- ✅ **SSL certificates**

## 🔒 Security Features

- **HTTPS only** (enforced by Cloudflare)
- **CORS protection**
- **Rate limiting** (configured in Cloudflare)
- **DDoS protection**
- **WAF rules** (optional)

## 🚀 Next Steps

1. **✅ Deploy Cloudflare Worker** (done above)
2. **📱 Test MCP integration** with your favorite AI assistant
3. **📊 Set up monitoring** with Cloudflare Analytics
4. **🔧 Configure custom rules** in your backend
5. **📈 Scale up** when needed (paid plans available)

## 🆘 Troubleshooting

### **Common Issues:**

**Error: "No such account"**
```bash
# Make sure you're logged into the right Cloudflare account
wrangler whoami
wrangler login
```

**Error: "Zone not found"**
```bash
# Check that quantumbeam.io is in your Cloudflare account
# Go to dash.cloudflare.com to verify
```

**502 Bad Gateway**
```bash
# Check your BACKEND_URL is correct and accessible
curl https://your-backend-app.railway.app/health
```

**MCP Not Working**
```bash
# Test the MCP endpoint directly
curl -X POST https://quantumbeam.io/mcp -d '{"method":"initialize"}'
```

## 🎉 Success!

Once deployed, your QuantumBeam API will be available at:
- **Main Site**: https://quantumbeam.io
- **API**: https://quantumbeam.io/api/*
- **MCP**: https://quantumbeam.io/mcp
- **Health**: https://quantumbeam.io/health

**Your fraud detection API with MCP integration is now live on Cloudflare's global network!** 🌍✨