# 🚀 Questro MCP Connectors - Quick Start Guide

## ✅ **Your Setup is Complete!**

I can see both your API keys are working:
- **Render API Key**: ✅ `rnd_YzjVrhPoRTDSvGlqngr6RQIzaur9`
- **Netlify Access Token**: ✅ `nfp_v6nLG2ZYN6woCeWiKRWUiURa7ydLJt2C26f1`

## 🎯 **How to Use Your MCP Connectors**

### **Method 1: Use the Easy Runner Script (Recommended)**

```bash
# Run Render MCP for backend management
./scripts/run-mcp.sh render

# Run Netlify MCP for frontend management
./scripts/run-mcp.sh netlify

# Run both connectors (opens in separate windows)
./scripts/run-mcp.sh both
```

### **Method 2: Manual Method**

```bash
# Load environment variables
source .env.local

# Go to MCP directory
cd mcp

# Run Render MCP
RENDER_API_KEY=rnd_YzjVrhPoRTDSvGlqngr6RQIzaur9 npm run render

# OR run Netlify MCP
NETLIFY_ACCESS_TOKEN=nfp_v6nLG2ZYN6woCeWiKRWUiURa7ydLJt2C26f1 npm run netlify
```

## 💬 **What You Can Say to the MCP Connectors**

### **Render MCP Commands (Backend Management):**
```
"List all Questro services"
"Check service health"
"Get service details for service-id"
"Trigger deployment for service-id"
"Get recent deployments for service-id"
"Get service logs for service-id"
"Restart service service-id"
"Update environment variable for service-id"
"Get service metrics for service-id"
```

### **Netlify MCP Commands (Frontend Management):**
```
"List all Netlify sites"
"Get site details for site-id"
"Trigger deployment for site-id"
"Get recent deployments for site-id"
"Get build logs for site-id"
"Rollback deployment for site-id"
"List functions for site-id"
"Get site analytics for site-id"
"Create new site"
"Update site settings for site-id"
```

## 🎮 **Example Conversations**

### **Managing Your Backend:**
```
You: List all Questro services

MCP: Found 1 Render services:

**questro-backend** (web)
ID: svc_1234567890
Status: live
URL: https://questro-backend.onrender.com
Created: 2025-01-17T10:30:00Z

You: Check service health

MCP: **Service Health Check** ✅

**Service ID:** svc_1234567890
**Status:** live
**Response Time:** 245ms
**Uptime:** 99.8%
**Last Deploy:** 2 hours ago
```

### **Managing Your Frontend:**
```
You: List all Netlify sites

MCP: Found 1 Netlify sites:

**questro-frontend**
ID: site_0987654321
URL: https://questro.netlify.app
State: ready
Created: 2025-01-15 14:20:00

You: Trigger deployment for site_0987654321

MCP: **Deployment Triggered** 🚀

**Site ID:** site_0987654321
**Deploy ID:** deploy_abcdef123456
**Status:** building
**Created:** 2025-01-17T15:45:00Z
```

## 🔧 **Quick Test Commands**

### **Test Backend Management:**
```bash
# Open Render MCP
./scripts/run-mcp.sh render

# Then try: "List all Questro services"
```

### **Test Frontend Management:**
```bash
# Open Netlify MCP
./scripts/run-mcp.sh netlify

# Then try: "List all Netlify sites"
```

## 🎉 **Success!**

Your Questro platform now has complete MCP-based deployment management:

✅ **Backend Control**: Render MCP connector for service management
✅ **Frontend Control**: Netlify MCP connector for site management
✅ **Easy Setup**: Runner script loads your API keys automatically
✅ **Conversational**: Natural language commands for all operations

**Start using it now:** `./scripts/run-mcp.sh render` or `./scripts/run-mcp.sh netlify`

Your deployment management is now as easy as having a conversation! 🚀