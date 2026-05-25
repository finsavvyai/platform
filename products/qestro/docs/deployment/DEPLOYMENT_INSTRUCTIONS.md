# Questro Production Deployment Instructions

## 🎯 **Objective**: Fix your failing `questro-backend` service on Render

### **The Problem**
Your backend service is failing with:
```
ERR_MODULE_NOT_FOUND: Cannot find module '/opt/render/project/src/backend/dist/lib/logger.js'
```

### **The Solution**
We've fixed all logger imports from `lib/logger.js` → `utils/logger.js` in 10+ service files.

---

## 🚀 **Deployment Options**

### **Option A: Quick Manual Deploy (Fastest)**
1. **Set your Render API Key:**
   ```bash
   export RENDER_API_KEY=your_render_api_key_here
   ```

2. **Run the deployment script:**
   ```bash
   ./scripts/deploy-with-mcp.sh
   ```

### **Option B: Git-based Deploy**
1. **Configure your correct repository:**
   ```bash
   git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   ```

2. **Push to trigger Render deployment:**
   ```bash
   git push origin production-deploy
   ```

### **Option C: Direct Render API**
```bash
# Replace with your actual service ID and API key
curl -X POST \
  -H "Authorization: Bearer YOUR_RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://api.render.com/v1/services/YOUR_SERVICE_ID/deploys"
```

---

## 🔧 **Get Your Render API Key**

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on your avatar → **Account Settings**
3. Scroll to **API Keys** section
4. Click **Create API Key**
5. Copy the key and set it:
   ```bash
   export RENDER_API_KEY=rnd_your_api_key_here
   ```

---

## 📊 **Verify Your Service**

After deployment, check:
```bash
# Replace with your actual service URL
curl https://your-service-name.onrender.com/health
curl https://your-service-name.onrender.com/api/status
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-17T...",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "redis": "connected",
    "logger": "operational"
  }
}
```

---

## 🆘 **Troubleshooting**

### **If deployment fails:**
1. Check Render dashboard for build logs
2. Verify environment variables are set
3. Run: `npm run build` locally to test

### **If service still fails:**
1. Check the Render service logs
2. Look for remaining import errors
3. Contact support with error details

---

## 📱 **Mobile MCP Management**

Once deployed, use MCP connectors:

```bash
cd mcp
npm install
export RENDER_API_KEY=your_key
npm run render
```

**Available MCP commands:**
- "List all Questro services"
- "Check service health"
- "Get recent deployments"
- "Restart backend service"
- "View service logs"

---

## 🎯 **Next Steps After Fix**

1. ✅ **Deploy logger fixes**
2. ✅ **Verify backend health**
3. 🔄 **Update frontend environment variables**
4. 📊 **Set up monitoring**
5. 🚀 **Deploy additional features**

---

## 📞 **Need Help?**

The deployment script includes comprehensive error handling and monitoring. If you encounter issues:

1. Check the script output
2. Review Render dashboard logs
3. Run health checks manually
4. Use MCP connectors for diagnostics

**Your Questro backend should be back online within 5-10 minutes of deployment!** 🚀