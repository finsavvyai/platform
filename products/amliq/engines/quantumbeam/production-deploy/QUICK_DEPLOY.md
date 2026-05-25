# ⚡ Quick Deploy QuantumBeam.io

## 🎯 Fastest Deployment Options

### Option 1: Railway (15 minutes) 🏆
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login and deploy
railway login
railway init
railway up

# 3. Set environment variables in Railway dashboard
# 4. Get your URL: https://quantumbeam.up.railway.app
```

### Option 2: Render (20 minutes)
```bash
# 1. Create render.yaml file
cat > render.yaml << EOF
services:
  - type: web
    name: quantumbeam-api
    env: docker
    dockerfilePath: ./production-deploy/Dockerfile
    dockerContext: .
    ports:
      - 8080
    envVars:
      - key: ENVIRONMENT
        value: production
      - key: PORT
        value: 8080
EOF

# 2. Push to GitHub and connect Render
# 3. Deploy automatically from GitHub
```

### Option 3: DigitalOcean (30 minutes)
```bash
# 1. Create Droplet ($6/month)
# 2. Point DNS A record to Droplet IP
# 3. SSH into server
ssh root@your_server_ip

# 4. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 5. Clone and deploy
git clone https://github.com/your-username/quantumbeam.io.git
cd quantumbeam.io/production-deploy
cp .env.example .env
# Edit .env with your values
./deploy.sh
```

### Option 4: Vercel (10 minutes - Frontend only)
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel --prod

# API endpoints will need separate hosting
```

## 🌐 DNS Configuration

### For Your Domain Provider:
```
Type: A
Name: @ (root)
Value: YOUR_SERVER_IP
TTL: 300 (or lowest available)
```

### Subdomain Setup:
```
Type: CNAME
Name: api
Value: quantumbeam.io
TTL: 300
```

## 🔒 SSL Setup (5 minutes)

### Let's Encrypt (Free):
```bash
# Install Certbot
sudo apt update
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d quantumbeam.io -d www.quantumbeam.io

# Copy to project
sudo cp /etc/letsencrypt/live/quantumbeam.io/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/quantumbeam.io/privkey.pem ./ssl/key.pem
```

### Cloudflare (Free & Easy):
1. Sign up for Cloudflare
2. Add quantumbeam.io
3. Change nameservers at your registrar
4. Enable SSL/TLS in Cloudflare dashboard
5. Set to "Full" mode

## 🚀 One-Click Deploy Commands

### Ready to Go Right Now:

```bash
# Railway (easiest)
npm install -g @railway/cli && railway login && railway up

# Or Render + GitHub
# 1. Push to GitHub
# 2. Connect Render account
# 3. Auto-deploy

# Or DigitalOcean (more control)
# 1. Create $6 Droplet
# 2. Point DNS
# 3. Run deploy script
```

## 📊 What You Get

After deployment:
- **✅ API**: `https://quantumbeam.io/health`
- **✅ Metrics**: `https://quantumbeam.io/metrics`
- **✅ Monitoring**: Grafana dashboard
- **✅ Database**: PostgreSQL with backups
- **✅ Caching**: Redis for performance
- **✅ SSL**: HTTPS automatically
- **✅ Logs**: Structured logging
- **✅ Alerts**: Health monitoring

## 🎯 Choose Your Path:

| Platform | Time | Cost | Control | Recommended |
|----------|------|------|---------|-------------|
| Railway | 15m | $5-20/mo | Low | ⭐⭐⭐⭐⭐ |
| Render | 20m | $7-25/mo | Medium | ⭐⭐⭐⭐ |
| DigitalOcean | 30m | $6-20/mo | High | ⭐⭐⭐⭐ |
| AWS | 45m | $20-100/mo | Very High | ⭐⭐⭐ |

**Go with Railway for fastest deployment!** 🚀