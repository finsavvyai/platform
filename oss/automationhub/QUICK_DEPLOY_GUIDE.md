# 🚀 UPM.Plus Quick Deploy Guide

## Your Environment is Configured ✅

Your Cloudflare credentials are properly set up:
- **API Token**: ✅ Configured
- **Zone IDs**: ✅ All 4 domains ready
- **Domains**: upm.plus, upmplus.dev, upmplus.io, upmplus.ai

## Option 1: Manual Deployment (Recommended)

### Step 1: Get Your Server IP
You need the IP address of where UPM.Plus will be hosted:
```bash
# If using cloud provider, get your load balancer IP
# If self-hosting, get your public IP
curl ifconfig.me
```

### Step 2: Configure DNS Records
For each domain in Cloudflare Dashboard:

1. Go to https://dash.cloudflare.com
2. Click on domain (upm.plus, upmplus.dev, upmplus.io, upmplus.ai)
3. Go to **DNS** section
4. Add **A records** pointing to your server IP:

```
@           → YOUR_SERVER_IP
www         → YOUR_SERVER_IP
api         → YOUR_SERVER_IP
app         → YOUR_SERVER_IP
dashboard   → YOUR_SERVER_IP
admin       → YOUR_SERVER_IP
docs        → YOUR_SERVER_IP
cdn         → YOUR_SERVER_IP
static      → YOUR_SERVER_IP
assets      → YOUR_SERVER_IP
```

### Step 3: Configure SSL/TLS
For each domain:
1. Go to **SSL/TLS** → **Overview**
2. Select **Full (Strict)**
3. Go to **Edge Certificates**
4. Enable **Always Use HTTPS**
5. Enable **HTTP Strict Transport Security (HSTS)**

### Step 4: Security Settings
1. Go to **Security** → **Settings**
2. Enable **Bot Fight Mode**
3. Set **Security Level** to **Medium**
4. Enable **HSTS**

### Step 5: Performance Settings
1. Go to **Speed** → **Optimization**
2. Enable **Auto Minify** (HTML, CSS, JS)
3. Enable **Brotli** compression
4. Go to **Caching** → **Configuration**
5. Set **Caching Level** to **Standard**

## Option 2: Automated Script

If you prefer automation, you can install Cloudflare CLI:

```bash
# Install Cloudflare CLI
brew install cloudflare/cloudflare/cloudflare

# Login
cloudflare login

# Run deployment script
cd deployment/cloudflare
./multi-domain-deploy.sh
```

## Option 3: MCP Integration (Advanced)

Use the configured MCP server with Claude Desktop:

1. **Install dependencies**:
```bash
cd mcp-servers
pip install cloudflare aiohttp python-dotenv
```

2. **Update Claude Desktop config**:
```json
{
  "mcpServers": {
    "cloudflare-upm": {
      "command": "python3",
      "args": ["/Users/shaharsolomon/dev/projects/github/upm.plus/mcp-servers/cloudflare-mcp-server.py"]
    }
  }
}
```

3. **Use natural language commands**:
- "Create DNS records for all UPM.Plus domains"
- "Configure SSL for upm.plus"
- "Set up security rules for production domains"

## 🎯 **Next Steps After DNS Setup**

### 1. Deploy UPM.Plus Application
- Backend API servers
- Frontend React application
- Database and caching
- Load balancers

### 2. Test All Services
```bash
# Test each domain
curl https://upm.plus
curl https://api.upm.plus
curl https://app.upm.plus
curl https://dashboard.upm.plus

# Test other domains
curl https://upmplus.dev
curl https://upmplus.io
curl https://upmplus.ai
```

### 3. Configure Monitoring
- Set up uptime monitoring
- Configure SSL certificate alerts
- Monitor analytics and security

### 4. Production Checklist
- [ ] SSL certificates valid
- [ ] All domains resolving
- [ ] API endpoints accessible
- [ ] Security rules active
- [ ] Monitoring configured
- [ ] Backups configured

## 🌐 **Domain Structure After Setup**

### Primary Domain (upm.plus)
- **upm.plus** - Main landing page
- **www.upm.plus** - WWW redirect
- **api.upm.plus** - Backend API
- **app.upm.plus** - React application
- **dashboard.upm.plus** - Admin dashboard
- **admin.upm.plus** - Admin interface
- **docs.upm.plus** - Documentation
- **cdn.upm.plus** - Static assets CDN
- **static.upm.plus** - Static files
- **assets.upm.plus** - Media assets

### Environment Domains
- **upmplus.dev** - Development environment
- **upmplus.io** - Staging environment
- **upmplus.ai** - AI-focused production

Each environment has the same subdomain structure as the primary domain.

## 🔧 **Troubleshooting**

### DNS Propagation
```bash
# Check DNS propagation
dig upm.plus
nslookup api.upm.plus
```

### SSL Certificate Status
- Check Cloudflare SSL/TLS dashboard
- Verify certificate validity
- Check for mixed content issues

### API Connection Issues
- Verify server IP is correct
- Check firewall settings
- Validate API token permissions

## 📞 **Support Resources**

- **Cloudflare Documentation**: https://developers.cloudflare.com
- **UPM.Plus Documentation**: See project README.md
- **SSL Checker**: https://www.ssllabs.com/ssltest/
- **DNS Checker**: https://dnschecker.org/

---

**Your UPM.Plus multi-domain infrastructure is ready to deploy!** 🚀

The manual approach gives you full control and verification of each step, while the automated options provide convenience for ongoing management.