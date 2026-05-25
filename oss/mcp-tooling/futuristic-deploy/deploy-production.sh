#!/bin/bash

# MCPOverflow Futuristic Design Production Deployment Script

echo "🚀 Deploying MCPOverflow Futuristic Design to Production..."

# Check if we're in the right directory
if [ ! -f "mcp-overflow-worker.js" ]; then
    echo "❌ Error: mcp-overflow-worker.js not found. Please run from the futuristic-deploy directory."
    exit 1
fi

# Backup current wrangler.toml
if [ -f "wrangler.toml" ]; then
    cp wrangler.toml wrangler.toml.backup
    echo "✅ Backed up current wrangler.toml"
fi

# Use production configuration
cp wrangler-production.toml wrangler.toml
echo "✅ Loaded production configuration"

# Check Cloudflare authentication
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami > /dev/null 2>&1; then
    echo "🔑 Please authenticate with Cloudflare:"
    wrangler auth login
fi

# Deploy to production domains
echo "🌍 Deploying to production domains..."
if wrangler deploy; then
    echo ""
    echo "✅ Successfully deployed MCPOverflow Futuristic Design!"
    echo ""
    echo "🎨 Live URLs:"
    echo "   • https://mcpoverflow.com"
    echo "   • https://app.mcpoverflow.io"
    echo "   • https://mcpoverflow.ai"
    echo ""
    echo "✨ Features deployed:"
    echo "   • Ultra-futuristic design with cyan accent colors"
    echo "   • Space Grotesk typography with extreme font weights"
    echo "   • Advanced animations and gradient effects"
    echo "   • Voice-activated API interface"
    echo "   • Real-time connector generation"
    echo "   • Global edge deployment"
    echo ""

    # Test the deployment
    echo "🧪 Testing deployment..."
    sleep 5
    if curl -s -f "https://mcpoverflow.com" > /dev/null; then
        echo "✅ Production deployment test passed!"
    else
        echo "⚠️  Production deployment may need DNS propagation time"
    fi
else
    echo "❌ Deployment failed"
    # Restore backup
    if [ -f "wrangler.toml.backup" ]; then
        cp wrangler.toml.backup wrangler.toml
        echo "🔄 Restored backup configuration"
    fi
    exit 1
fi

# Cleanup
if [ -f "wrangler.toml.backup" ]; then
    rm wrangler.toml.backup
fi

echo ""
echo "🎉 MCPOverflow Futuristic Design deployment complete!"
echo "📊 Monitor: https://dash.cloudflare.com"
echo "📖 Documentation: https://docs.mcpoverflow.com"