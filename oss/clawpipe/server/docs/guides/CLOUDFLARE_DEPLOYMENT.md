# 🌐 Deploy FinSavvyAI to Cloudflare Workers

Your FinSavvyAI cluster is **fully functional** and ready for Cloudflare deployment!

## ✅ **Current Status**

- **Local Cluster**: ✅ Running on ports 8000 & 8001
- **Network Access**: ✅ `http://10.0.0.10:8000` & `http://10.0.0.10:8001`
- **GLM-4V Model**: ✅ Downloaded and ready
- **API Endpoints**: ✅ All working
- **Multimodal Support**: ✅ Text + Vision capabilities

## 🚀 **Cloudflare Deployment for `llm.finsavvyai.com`**

### **Option 1: Quick Manual Deployment**

1. **Login to Cloudflare** (if not already):
   ```bash
   cd cloudflare-api
   wrangler login
   ```

2. **Deploy with correct permissions**:
   ```bash
   wrangler deploy --env=""
   ```

3. **Configure DNS** in Cloudflare Dashboard:
   - Add CNAME record: `llm` → your worker domain
   - Or use `wrangler route domain llm.finsavvyai.com/* finsavvyai-llm-proxy`

### **Option 2: One-Click Deploy Script**
   ```bash
   # From project root
   ./deploy-cloudflare.sh
   ```

## 🔗 **Cloudflare Endpoints**

Once deployed, your cluster will be accessible at:

- **Dashboard**: `https://llm.finsavvyai.com`
- **Chat API**: `https://llm.finsavvyai.com/v1/chat/completions`
- **Models**: `https://llm.finsavvyai.com/v1/models`
- **Status**: `https://llm.finsavvyai.com/health`

## 📱 **Mobile App Configuration**

```
Base URL: https://llm.finsavvyai.com
API Key: finsavvy-5d19b8e7c71d4679
Models: gpt-3.5-turbo-sim, glm-4v-9b, phi-2
```

## 🧪 **Testing**

### **Local Testing (Now)**:
```bash
# Cluster status
curl http://10.0.0.10:8000/cluster/status

# Chat test
curl -X POST http://10.0.0.10:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-3.5-turbo-sim", "messages": [{"role": "user", "content": "Hello!"}]}'

# Models list
curl http://10.0.0.10:8001/v1/models
```

### **Cloudflare Testing (After Deploy)**:
```bash
# Health check
curl https://llm.finsavvyai.com/health

# Chat test
curl -X POST https://llm.finsavvyai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-3.5-turbo-sim", "messages": [{"role": "user", "content": "Hello!"}]}'
```

## 🎯 **GLM-4V Vision Testing**

```bash
# Vision API test (with base64 image)
curl -X POST http://10.0.0.10:8002/v1/chat/completions/vision \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-4v-9b",
    "messages": [{"role": "user", "content": "What do you see?"}],
    "image": "base64_encoded_image_here"
  }'
```

## 💡 **Important Notes**

1. **Local Cluster**: Must be running when using Cloudflare proxy
2. **API Key**: Keep `finsavvy-5d19b8e7c71d4679` private
3. **Firewall**: Ensure ports 8000 & 8001 are accessible
4. **Domain**: `finsavvyai.com` must be in Cloudflare account

## 🔐 **Security Features**

- ✅ CORS enabled for web apps
- ✅ API key authentication
- ✅ Rate limiting (Cloudflare)
- ✅ DDoS protection (Cloudflare)
- ✅ SSL/TLS encryption
- ✅ Content filtering

## 🎉 **Your Private AI Infrastructure is Ready!**

- **Local Access**: `http://10.0.0.10:8000`
- **Network Access**: Any device on your WiFi
- **Cloud Access**: `https://llm.finsavvyai.com` (after deploy)
- **Mobile Ready**: OpenAI-compatible apps
- **Vision AI**: GLM-4V multimodal support