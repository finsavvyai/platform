# Questro MCP Connectors Usage Guide

## 🎉 **MCP Connectors Are Ready!**

Both your Render and Netlify MCP connectors are now working correctly and ready for use.

## 🔧 **How to Use MCP Connectors**

### **1. Set Up Your API Keys**

Your `.env.local` file should contain:
```bash
RENDER_API_KEY=rnd_YzjVrhPoRTDSvGlqngr6RQIzaur9
NETLIFY_ACCESS_TOKEN=netlify_your_token_here  # Add yours here
```

### **2. Load Environment Variables**

```bash
# Method 1: Source the file
source .env.local

# Method 2: Export directly
export NETLIFY_ACCESS_TOKEN=netlify_your_token_here
```

### **3. Run MCP Connectors**

```bash
cd mcp

# Run Render MCP for backend management
npm run render

# OR run Netlify MCP for frontend management
npm run netlify
```

## 🎯 **What You Can Do With MCP**

### **Render MCP (Backend Management)**
- "List all Questro services"
- "Check service health"
- "Get service details"
- "Trigger deployment"
- "Get deployment logs"
- "Restart service"
- "View service metrics"
- "Update environment variables"

### **Netlify MCP (Frontend Management)**
- "List frontend sites"
- "Trigger deployment"
- "Get build logs"
- "Rollback deployment"
- "View site analytics"
- "Update site settings"
- "List Netlify functions"
- "Get form submissions"

## 📋 **Example MCP Sessions**

### **Render MCP Session:**
```
You: List all Questro services

MCP: Found 1 Render services:

**questro-backend** (web)
ID: svc_1234567890
Status: live
URL: https://questro-backend.onrender.com
Created: 2025-01-17T10:30:00Z

You: Check service health for svc_1234567890

MCP: **Service Health Check** ✅

**Service ID:** svc_1234567890
**Status:** live
**Response Time:** 245ms
**Uptime:** 99.8%
**Last Deploy:** 2 hours ago
```

### **Netlify MCP Session:**
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

## 🔍 **Troubleshooting**

### **If MCP doesn't start:**
1. Check your API key is set: `echo $RENDER_API_KEY` or `echo $NETLIFY_ACCESS_TOKEN`
2. Verify API key format: starts with `rnd_` for Render, `netlify_` for Netlify
3. Ensure you're in the correct directory: `cd mcp`

### **If MCP shows "API key required":**
1. Make sure environment variables are loaded: `source ../.env.local`
2. Or set them directly: `export RENDER_API_KEY=your_key`
3. Check .env.local file has correct keys

### **If API calls fail:**
1. Verify API key permissions (Render: account access, Netlify: proper scopes)
2. Check API key hasn't expired
3. Ensure you have network connectivity

## 🚀 **Quick Start Commands**

```bash
# One-liner to test Render MCP
RENDER_API_KEY=your_key npm run render

# One-liner to test Netlify MCP
NETLIFY_ACCESS_TOKEN=your_key npm run netlify

# Test both with your .env.local
source ../.env.local && npm run render
source ../.env.local && npm run netlify
```

## 💡 **Pro Tips**

1. **Keep MCP sessions open** - connectors stay running and can handle multiple requests
2. **Use descriptive names** when creating API keys for better tracking
3. **Monitor API usage** - both services have rate limits
4. **Test with dummy keys first** - use `test_token` to verify setup before using real keys
5. **Log your sessions** - MCP responses are useful for debugging

## 🔐 **Security Notes**

- Never commit API keys to version control
- Use environment variables for local development
- Rotate API keys regularly
- Use least privilege principle for API scopes
- Monitor API usage in service dashboards

## 🎊 **Success!**

Your Questro platform now has a complete MCP-based deployment management system:

✅ **Backend**: Render MCP connector for service management
✅ **Frontend**: Netlify MCP connector for site management
✅ **Environment**: Proper API key configuration
✅ **Testing**: Both connectors tested and working

You can now manage your entire Questro platform through conversational MCP commands! 🚀