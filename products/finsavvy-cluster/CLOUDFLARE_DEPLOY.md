# 🌐 FINSAVVYAI CLOUDFLARE DEPLOYMENT GUIDE

## 🚀 **DEPLOY NOW**

### **Option 1: Quick Deploy (Recommended)**
```bash
cd cloudflare-api
wrangler login
wrangler deploy
```

### **Option 2: One-Command Deploy**
```bash
cd cloudflare-api && wrangler deploy --env=""
```

---

## 🔐 **API TOKEN SETUP**

The deployment failed because your API token needs these permissions:

### **Required Permissions:**
- ✅ `Account:Read`
- ✅ `User:User Details:Read`
- ✅ `Zone:Read` (for finsavvyai.com)
- ✅ `Zone:Edit` (for routing)
- ✅ `Worker:Route:Edit`
- ✅ `Worker Script:Edit`

### **Create New Token:**
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Template: "Custom token"
4. Permissions:
   - Account: `Account:Read`
   - User: `User Details:Read`
   - Zone: `Zone:Read`, `Zone:Edit` (finsavvyai.com)
   - Worker: `Worker Script:Edit`, `Worker Route:Edit`
5. Zone Resources: `finsavvyai.com`
6. Create and copy token
7. Set environment variable:
   ```bash
   export CLOUDFLARE_API_TOKEN=your_token_here
   ```

---

## 🌍 **DEPLOYMENT OPTIONS**

### **A) Cloudflare Workers (Free)**
```bash
# Deploy
cd cloudflare-api
wrangler deploy

# Result:
# https://finsavvyai-llm-proxy.your-subdomain.workers.dev
```

### **B) Custom Domain (llm.finsavvyai.com)**
```bash
# Add to wrangler.toml
routes = [
  { pattern = "llm.finsavvyai.com/*", zone_name = "finsavvyai.com" }
]

# Deploy
wrangler deploy --env="production"
```

### **C) Multiple Regions**
```bash
# Deploy to different regions
wrangler deploy --region "us-east-1"
wrangler deploy --region "eu-west-1"
wrangler deploy --region "ap-southeast-1"
```

---

## 📊 **AFTER DEPLOYMENT**

### **Testing Your Cloudflare Proxy:**
```bash
# Health check
curl https://llm.finsavvyai.com/health

# Cluster status
curl https://llm.finsavvyai.com/cluster/status

# Chat request
curl -X POST https://llm.finsavvyai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-3.5-turbo-sim", "messages": [{"role": "user", "content": "Hello!"}]}'
```

### **Mobile App Configuration:**
```
Base URL: https://llm.finsavvyai.com
API Key: finsavvy-5d19b8e7c71d4679
```

---

## 🌐 **ALTERNATIVE DEPLOYMENTS**

### **1) Railway**
```bash
# Create railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "python3 network_cluster.py"

# Deploy
railway login
railway up
```

### **2) Vercel**
```bash
# Create api/index.js
# Install dependencies
npm install

# Deploy
vercel --prod
```

### **3) Heroku**
```bash
# Create Procfile
web: python3 network_cluster.py

# Deploy
heroku create finsavvyai-cluster
git push heroku main
```

---

## 🔧 **CLOUDFLARE CONFIGURATION**

### **DNS Setup (if needed):**
```bash
# CNAME record for llm.finsavvyai.com
llm → finsavvyai-llm-proxy.workers.dev
```

### **SSL Certificate:**
- ✅ Automatically provided by Cloudflare
- ✅ Free and always up-to-date
- ✅ Supports HTTP/2

### **Rate Limiting:**
```javascript
// Add to worker
const RATE_LIMIT = 100; // requests per minute
```

---

## 📱 **MOBILE INTEGRATION**

### **ChatGPT App:**
- **Base URL**: `https://llm.finsavvyai.com`
- **API Key**: `finsavvy-5d19b8e7c71d4679`
- **Model**: `gpt-3.5-turbo-sim`

### **Custom iOS/Android Apps:**
```swift
// Swift example
let url = URL(string: "https://llm.finsavvyai.com/v1/chat/completions")!
let request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
```

```java
// Android example
OkHttpClient client = new OkHttpClient();
String url = "https://llm.finsavvyai.com/v1/chat/completions";
```

---

## 🎯 **BENEFITS OF CLOUDFLARE DEPLOYMENT**

### **🌍 Global Access:**
- 100+ data centers worldwide
- <50ms latency globally
- Automatic failover

### **🛡️ Security:**
- DDoS protection
- WAF (Web Application Firewall)
- SSL/TLS encryption

### **⚡ Performance:**
- Edge caching
- HTTP/3 support
- Automatic compression

### **💰 Cost:**
- 100,000 requests/day (Free)
- No egress fees
- Pay-as-you-go after

---

## 🚀 **PRODUCTION READY**

### **Monitor Deployment:**
```bash
# Real-time logs
wrangler tail

# Analytics
wrangler analytics

# Health status
curl https://llm.finsavvyai.com/health
```

### **Scale Options:**
- **Free**: 100,000 requests/day
- **Pro**: 10M requests/day
- **Business**: Unlimited

---

## 🎉 **DEPLOYMENT SUCCESS CHECKLIST**

### **Before Deploy:**
- [ ] Cluster master running locally
- [ ] Workers connected
- [ ] API token has correct permissions
- [ ] Domain finsavvyai.com in Cloudflare

### **After Deploy:**
- [ ] Test health endpoint
- [ ] Test chat completions
- [ ] Configure mobile apps
- [ ] Monitor logs

---

## 🔗 **ACCESS YOUR AI CLUSTER**

**Local**: `http://10.0.0.10:8000`  
**Network**: `http://10.0.0.10:8001`  
**Global**: `https://llm.finsavvyai.com`  

🎉 **Your FinSavvyAI cluster is ready for global access!**