#!/bin/bash
# Setup Cloudflare Tunnel for FinSavvyAI Cluster

echo "🌐 Cloudflare Tunnel Setup for FinSavvyAI"
echo "=========================================="
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared not found. Installing..."
    echo ""
    echo "macOS:"
    echo "  brew install cloudflared"
    echo ""
    echo "Linux:"
    echo "  Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/"
    echo ""
    exit 1
fi

echo "✅ cloudflared found"
echo ""

# Login to Cloudflare
echo "🔐 Logging in to Cloudflare..."
cloudflared tunnel login

echo ""
echo "📝 Creating tunnel..."
TUNNEL_NAME="finsavvyai-cluster"
cloudflared tunnel create $TUNNEL_NAME

echo ""
echo "📋 Configuring tunnel..."
cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_NAME
credentials-file: ~/.cloudflared/$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}').json

ingress:
  - hostname: cluster.finsavvyai.com
    service: http://localhost:8080
  - service: http_status:404
EOF

echo "✅ Tunnel configured!"
echo ""
echo "🚀 Starting tunnel..."
echo ""
echo "This will connect your local cluster (localhost:8080) to Cloudflare"
echo "Press Ctrl+C to stop"
echo ""

cloudflared tunnel run $TUNNEL_NAME

