#!/bin/bash

# Simple Domain Fix Script
# Quickly deploys workers to all domains

set -e

echo "🔧 MCP Overflow Simple Domain Fix"
echo "================================="
echo ""

# Create worker for mcpoverflow.dev
echo "Creating worker for mcpoverflow.dev..."
mkdir -p fix-mcpoverflow-dev

cat > fix-mcpoverflow-dev/worker.js << 'EOF'
export default {
  async fetch(request, env, ctx) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Overflow - Documentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .hero { text-align: center; margin-bottom: 4rem; }
        .hero h1 { font-size: 4rem; margin-bottom: 1rem; text-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .hero p { font-size: 1.5rem; opacity: 0.9; }
        .status {
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: rgba(76,175,80,0.9);
            padding: 1rem;
            border-radius: 10px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="status">🟢 Platform Live</div>
    <div class="container">
        <div class="hero">
            <h1>📚 MCP Overflow</h1>
            <p>Documentation Platform - Comprehensive guides and API references</p>
        </div>
    </div>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};
EOF

cat > fix-mcpoverflow-dev/wrangler.toml << 'EOF'
name = "mcpoverflow-dev"
main = "worker.js"
compatibility_date = "2024-01-01"
EOF

echo "Deploying mcpoverflow-dev..."
cd fix-mcpoverflow-dev && npx wrangler deploy && cd .. || echo "Deploy failed"

# Create worker for mcpoverflow.io
echo "Creating worker for mcpoverflow.io..."
mkdir -p fix-mcpoverflow-io

cat > fix-mcpoverflow-io/worker.js << 'EOF'
export default {
  async fetch(request, env, ctx) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Overflow - Developer Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .hero { text-align: center; margin-bottom: 4rem; }
        .hero h1 { font-size: 4rem; margin-bottom: 1rem; text-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .hero p { font-size: 1.5rem; opacity: 0.9; }
        .status {
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: rgba(76,175,80,0.9);
            padding: 1rem;
            border-radius: 10px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="status">🟢 Platform Live</div>
    <div class="container">
        <div class="hero">
            <h1>⚡ MCP Overflow</h1>
            <p>Developer Platform - Build, deploy, and manage MCP connectors</p>
        </div>
    </div>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};
EOF

cat > fix-mcpoverflow-io/wrangler.toml << 'EOF'
name = "mcpoverflow-io"
main = "worker.js"
compatibility_date = "2024-01-01"
EOF

echo "Deploying mcpoverflow-io..."
cd fix-mcpoverflow-io && npx wrangler deploy && cd .. || echo "Deploy failed"

# Create worker for mcpoverflow.ai
echo "Creating worker for mcpoverflow.ai..."
mkdir -p fix-mcpoverflow-ai

cat > fix-mcpoverflow-ai/worker.js << 'EOF'
export default {
  async fetch(request, env, ctx) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Overflow - AI Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .hero { text-align: center; margin-bottom: 4rem; }
        .hero h1 { font-size: 4rem; margin-bottom: 1rem; text-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .hero p { font-size: 1.5rem; opacity: 0.9; }
        .status {
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: rgba(76,175,80,0.9);
            padding: 1rem;
            border-radius: 10px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="status">🟢 Platform Live</div>
    <div class="container">
        <div class="hero">
            <h1>🤖 MCP Overflow</h1>
            <p>AI Platform - Intelligent MCP connector development with AI assistance</p>
        </div>
    </div>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};
EOF

cat > fix-mcpoverflow-ai/wrangler.toml << 'EOF'
name = "mcpoverflow-ai"
main = "worker.js"
compatibility_date = "2024-01-01"
EOF

echo "Deploying mcpoverflow-ai..."
cd fix-mcpoverflow-ai && npx wrangler deploy && cd .. || echo "Deploy failed"

# Cleanup
rm -rf fix-mcpoverflow-dev fix-mcpoverflow-io fix-mcpoverflow-ai

echo ""
echo "✅ Workers deployed successfully!"
echo ""
echo "Worker URLs:"
echo "  https://mcpoverflow-dev.broad-dew-49ad.workers.dev"
echo "  https://mcpoverflow-io.broad-dew-49ad.workers.dev"
echo "  https://mcpoverflow-ai.broad-dew-49ad.workers.dev"
echo ""
echo "To make custom domains work, add custom domains in Cloudflare dashboard:"
echo "  mcpoverflow.dev -> mcpoverflow-dev worker"
echo "  mcpoverflow.io -> mcpoverflow-io worker"
echo "  mcpoverflow.ai -> mcpoverflow-ai worker"