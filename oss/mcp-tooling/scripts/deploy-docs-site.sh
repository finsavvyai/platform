#!/bin/bash

# MCPOverflow Documentation Site Frontend Deployment Script
# Deploys the documentation site with static HTML fallback

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Header
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       MCPOverflow Documentation Site Deployment            ║"
echo "║                      Version 1.0.0                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/dist/docs-site"
DOCKER_IMAGE="mcpoverflow-docs-site"
DOCKER_TAG="latest"
CONTAINER_NAME="mcpoverflow-docs-site"
PORT=3003

# Function to print colored output
print_status() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] ℹ $1${NC}"
}

print_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    # Check Node.js and npm
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        exit 1
    fi

    print_status "Prerequisites check completed"
}

# Build docs site app only
build_docs_site_app() {
    print_info "Building documentation site application..."

    cd "$PROJECT_ROOT"

    # Clean previous builds
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"

    # Try to build the docs site app, but fall back to static HTML if it fails
    cd apps/docs-site

    print_info "Attempting to build docs site app..."
    local build_success=false

    # Install dependencies (skip optional dependencies)
    if npm install --no-optional 2>/dev/null; then
        # Build the app
        if npm run build 2>/dev/null; then
            # Copy built files to our dist directory
            if [ -d "out" ]; then
                cp -r out/* "$BUILD_DIR/" 2>/dev/null
                print_status "Documentation site application built successfully"
                build_success=true
            elif [ -d ".next" ]; then
                cp -r .next/* "$BUILD_DIR/" 2>/dev/null
                print_status "Documentation site application built successfully"
                build_success=true
            else
                print_warning "Could not find build output, will use static HTML fallback"
            fi
        else
            print_warning "Build failed, will use static HTML fallback"
        fi
    else
        print_warning "Dependency installation failed, will use static HTML fallback"
    fi

    cd "$PROJECT_ROOT"

    if [ "$build_success" = false ]; then
        print_status "Will use static HTML fallback for documentation site"
    fi
}

# Create Nginx configuration
create_nginx_config() {
    print_info "Creating Nginx configuration..."

    cat > "$BUILD_DIR/nginx.conf" << EOF
server {
    listen ${PORT};
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-Domain-Purpose "documentation-site" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # Handle documentation routes
    location / {
        try_files \$uri \$uri.html \$uri/ /index.html;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Error pages
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

    print_status "Nginx configuration created"
}

# Create static HTML for documentation site
create_static_html() {
    print_info "Creating static HTML documentation site..."

    # Create a comprehensive documentation site
    cat > "$BUILD_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCPOverflow Documentation - Complete Guide</title>
    <meta name="description" content="Complete documentation for MCPOverflow - AI-powered MCP connector generation platform. Learn how to build, deploy, and manage Model Context Protocol connectors.">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .gradient { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .code-block { background: #1e293b; color: #e2e8f0; }
        .prose pre { background: #1e293b; color: #e2e8f0; }
        .prose code { background: #f3f4f6; color: #1f2937; padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-size: 0.875em; }
        .prose pre code { background: transparent; color: inherit; padding: 0; }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Header -->
    <header class="fixed top-0 w-full z-50 bg-white border-b border-gray-200">
        <nav class="container mx-auto px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <div class="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg"></div>
                    <span class="text-xl font-bold text-gray-800">MCPOverflow</span>
                    <span class="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">Docs</span>
                </div>
                <div class="hidden md:flex items-center space-x-6">
                    <a href="https://mcpoverflow.com" class="text-gray-600 hover:text-gray-900">Marketing</a>
                    <a href="https://app.mcpoverflow.io" class="text-gray-600 hover:text-gray-900">Dev Platform</a>
                    <a href="https://mcpoverflow.ai" class="text-gray-600 hover:text-gray-900">AI Platform</a>
                    <a href="#github" class="text-gray-600 hover:text-gray-900">GitHub</a>
                </div>
            </div>
        </nav>
    </header>

    <!-- Hero Section -->
    <section class="pt-32 pb-20 px-6 bg-gradient-to-br from-green-50 to-emerald-50">
        <div class="container mx-auto text-center">
            <h1 class="text-5xl font-bold text-gray-900 mb-6">
                MCPOverflow<br>
                <span class="gradient bg-clip-text text-transparent">Documentation</span>
            </h1>
            <p class="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Complete guide to building, deploying, and managing Model Context Protocol connectors with AI-powered tools.
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="#quick-start" class="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                    Quick Start
                </a>
                <a href="#api-reference" class="px-8 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                    API Reference
                </a>
            </div>
        </div>
    </section>

    <!-- Quick Navigation -->
    <section class="py-12 bg-white border-b">
        <div class="container mx-auto px-6">
            <div class="grid md:grid-cols-4 gap-6">
                <a href="#getting-started" class="block p-6 rounded-lg border hover:shadow-lg transition">
                    <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                        <span class="text-xl">🚀</span>
                    </div>
                    <h3 class="font-semibold text-gray-900 mb-1">Getting Started</h3>
                    <p class="text-sm text-gray-600">Setup and basics</p>
                </a>
                <a href="#guides" class="block p-6 rounded-lg border hover:shadow-lg transition">
                    <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                        <span class="text-xl">📚</span>
                    </div>
                    <h3 class="font-semibold text-gray-900 mb-1">Guides</h3>
                    <p class="text-sm text-gray-600">Step-by-step tutorials</p>
                </a>
                <a href="#api-reference" class="block p-6 rounded-lg border hover:shadow-lg transition">
                    <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                        <span class="text-xl">🔧</span>
                    </div>
                    <h3 class="font-semibold text-gray-900 mb-1">API Reference</h3>
                    <p class="text-sm text-gray-600">Complete API docs</p>
                </a>
                <a href="#examples" class="block p-6 rounded-lg border hover:shadow-lg transition">
                    <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-3">
                        <span class="text-xl">💡</span>
                    </div>
                    <h3 class="font-semibold text-gray-900 mb-1">Examples</h3>
                    <p class="text-sm text-gray-600">Code examples</p>
                </a>
            </div>
        </div>
    </section>

    <!-- Quick Start Section -->
    <section id="quick-start" class="py-20 bg-white">
        <div class="container mx-auto px-6">
            <h2 class="text-3xl font-bold text-gray-900 mb-8">Quick Start</h2>

            <div class="grid md:grid-cols-2 gap-12">
                <div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-4">1. Install MCPOverflow CLI</h3>
                    <div class="code-block rounded-lg p-4 font-mono text-sm mb-8">
                        <pre><code># Using npm
npm install -g @mcpoverflow/cli

# Using yarn
yarn global add @mcpoverflow/cli

# Verify installation
mcpoverflow --version</code></pre>
                    </div>

                    <h3 class="text-xl font-semibold text-gray-900 mb-4">2. Generate your first connector</h3>
                    <div class="code-block rounded-lg p-4 font-mono text-sm mb-8">
                        <pre><code># Create a new connector from OpenAPI spec
mcpoverflow generate stripe-openapi.json \
  --name stripe-payments \
  --runtime worker-ts \
  --output ./stripe-connector

# Navigate to your connector
cd stripe-connector</code></pre>
                    </div>
                </div>

                <div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-4">3. Deploy to Cloudflare Workers</h3>
                    <div class="code-block rounded-lg p-4 font-mono text-sm mb-8">
                        <pre><code># Login to Cloudflare
mcpoverflow auth login cloudflare

# Deploy your connector
mcpoverflow deploy \
  --platform cloudflare \
  --runtime worker-ts

# Your connector is now live!</code></pre>
                    </div>

                    <h3 class="text-xl font-semibold text-gray-900 mb-4">4. Use in your AI agent</h3>
                    <div class="code-block rounded-lg p-4 font-mono text-sm mb-8">
                        <pre><code># Install in your agent project
npm install @mcpoverflow/stripe-payments

# Configure in your agent
import { StripeConnector } from '@mcpoverflow/stripe-payments';

const connector = new StripeConnector({
  apiKey: process.env.STRIPE_API_KEY
});</code></pre>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- API Reference Section -->
    <section id="api-reference" class="py-20 bg-gray-50">
        <div class="container mx-auto px-6">
            <h2 class="text-3xl font-bold text-gray-900 mb-8">API Reference</h2>

            <div class="bg-white rounded-lg shadow-lg p-8">
                <h3 class="text-2xl font-semibold text-gray-900 mb-6">MCP Server API</h3>

                <div class="space-y-8">
                    <div>
                        <h4 class="text-lg font-semibold text-gray-900 mb-3">List Tools</h4>
                        <div class="code-block rounded-lg p-4 font-mono text-sm">
                            <pre><code>GET /tools

Response:
{
  "tools": [
    {
      "name": "create_payment_intent",
      "description": "Create a Stripe payment intent",
      "inputSchema": {
        "type": "object",
        "properties": {
          "amount": { "type": "number" },
          "currency": { "type": "string" }
        },
        "required": ["amount", "currency"]
      }
    }
  ]
}</code></pre>
                        </div>
                    </div>

                    <div>
                        <h4 class="text-lg font-semibold text-gray-900 mb-3">Call Tool</h4>
                        <div class="code-block rounded-lg p-4 font-mono text-sm">
                            <pre><code>POST /tools/{tool_name}/call

Request:
{
  "arguments": {
    "amount": 2000,
    "currency": "usd"
  }
}

Response:
{
  "content": [
    {
      "type": "text",
      "text": "Payment intent created for $20.00 USD"
    }
  ]
}</code></pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Guides Section -->
    <section id="guides" class="py-20 bg-white">
        <div class="container mx-auto px-6">
            <h2 class="text-3xl font-bold text-gray-900 mb-8">Guides</h2>

            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div class="bg-gray-50 rounded-lg p-6">
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">Authentication</h3>
                    <p class="text-gray-600 mb-4">Learn how to configure API keys, OAuth, and JWT authentication for your connectors.</p>
                    <a href="#auth-guide" class="text-blue-600 hover:text-blue-700 font-medium">Read Guide →</a>
                </div>
                <div class="bg-gray-50 rounded-lg p-6">
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">AgentKit Integration</h3>
                    <p class="text-gray-600 mb-4">Integrate your MCP connectors with OpenAI AgentKit for autonomous AI agents.</p>
                    <a href="#agentkit-guide" class="text-blue-600 hover:text-blue-700 font-medium">Read Guide →</a>
                </div>
                <div class="bg-gray-50 rounded-lg p-6">
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">Deployment</h3>
                    <p class="text-gray-600 mb-4">Deploy your connectors to Cloudflare Workers, Vercel, AWS Lambda, and more.</p>
                    <a href="#deployment-guide" class="text-blue-600 hover:text-blue-700 font-medium">Read Guide →</a>
                </div>
                <div class="bg-gray-50 rounded-lg p-6">
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">Error Handling</h3>
                    <p class="text-gray-600 mb-4">Best practices for handling errors and retries in MCP connectors.</p>
                    <a href="#error-handling-guide" class="text-blue-600 hover:text-blue-700 font-medium">Read Guide →</a>
                </div>
                <div class="bg-gray-50 rounded-lg p-6">
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">Testing</h3>
                    <p class="text-gray-600 mb-4">Write comprehensive tests for your MCP connectors.</p>
                    <a href="#testing-guide" class="text-blue-600 hover:text-blue-700 font-medium">Read Guide →</a>
                </div>
                <div class="bg-gray-50 rounded-lg p-6">
                    <h3 class="text-xl font-semibold text-gray-900 mb-3">Monitoring</h3>
                    <p class="text-gray-600 mb-4">Monitor usage and performance of your deployed connectors.</p>
                    <a href="#monitoring-guide" class="text-blue-600 hover:text-blue-700 font-medium">Read Guide →</a>
                </div>
            </div>
        </div>
    </section>

    <!-- Examples Section -->
    <section id="examples" class="py-20 bg-gray-50">
        <div class="container mx-auto px-6">
            <h2 class="text-3xl font-bold text-gray-900 mb-8">Code Examples</h2>

            <div class="space-y-8">
                <div class="bg-white rounded-lg shadow-lg p-8">
                    <h3 class="text-xl font-semibold text-gray-900 mb-4">TypeScript MCP Server</h3>
                    <div class="code-block rounded-lg p-4 font-mono text-sm overflow-x-auto">
                        <pre><code>import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'my-api-connector',
  version: '1.0.0',
}, {
  capabilities: { tools: {} }
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_user',
      description: 'Get user information',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID' }
        },
        required: ['userId']
      }
    }
  ]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_user') {
    const user = await fetchUser(args.userId);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(user, null, 2)
      }]
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server running on stdio');
}

main().catch(console.error);</code></pre>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="py-12 bg-gray-900">
        <div class="container mx-auto px-6">
            <div class="flex flex-col md:flex-row justify-between items-center">
                <div class="flex items-center space-x-2 mb-4 md:mb-0">
                    <div class="w-6 h-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded"></div>
                    <span class="text-white font-semibold">MCPOverflow</span>
                    <span class="text-gray-400">Documentation</span>
                </div>
                <div class="flex space-x-6">
                    <a href="https://mcpoverflow.com" class="text-gray-400 hover:text-white">Marketing</a>
                    <a href="https://app.mcpoverflow.io" class="text-gray-400 hover:text-white">Dev Platform</a>
                    <a href="https://mcpoverflow.ai" class="text-gray-400 hover:text-white">AI Platform</a>
                    <a href="https://github.com/mcpoverflow/mcpoverflow" class="text-gray-400 hover:text-white">GitHub</a>
                </div>
            </div>
        </div>
    </footer>

    <script>
        // Interactive elements
        document.addEventListener('DOMContentLoaded', function() {
            // Smooth scrolling
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            });

            // Code copy functionality
            document.querySelectorAll('.code-block').forEach(block => {
                const button = document.createElement('button');
                button.className = 'absolute top-2 right-2 px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600 transition';
                button.textContent = 'Copy';
                block.style.position = 'relative';
                block.appendChild(button);

                button.addEventListener('click', () => {
                    const code = block.querySelector('code').textContent;
                    navigator.clipboard.writeText(code);
                    button.textContent = 'Copied!';
                    setTimeout(() => {
                        button.textContent = 'Copy';
                    }, 2000);
                });
            });
        });
    </script>
</body>
</html>
EOF

    print_status "Static HTML documentation site created"
}

# Create Dockerfile for docs site
create_dockerfile() {
    print_info "Creating Dockerfile for documentation site..."

    cat > "$BUILD_DIR/Dockerfile" << 'EOF'
FROM nginx:alpine

# Copy built static files
COPY . /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3003

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
EOF

    print_status "Dockerfile created"
}

# Build Docker image
build_docker_image() {
    print_info "Building Docker image..."

    cd "$BUILD_DIR"

    docker build -t "$DOCKER_IMAGE:$DOCKER_TAG" . || {
        print_error "Failed to build Docker image"
        exit 1
    }

    print_status "Docker image built successfully"
}

# Deploy container
deploy_container() {
    print_info "Deploying container..."

    # Stop and remove existing container if it exists
    if docker ps -a --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_info "Removing existing container..."
        docker stop "$CONTAINER_NAME" || true
        docker rm "$CONTAINER_NAME" || true
    fi

    # Run new container
    docker run -d \
        --name "$CONTAINER_NAME" \
        -p "${PORT}:3003" \
        --restart unless-stopped \
        "$DOCKER_IMAGE:$DOCKER_TAG" || {
        print_error "Failed to start container"
        exit 1
    }

    print_status "Container deployed successfully"
}

# Health check
health_check() {
    print_info "Performing health check..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f "http://localhost:${PORT}/health" &>/dev/null; then
            print_status "Documentation site is healthy and accessible"
            print_status "✅ Documentation site deployed successfully!"
            print_status "🌐 Available at: http://localhost:${PORT}"
            return 0
        fi

        print_info "Health check attempt $attempt/$max_attempts - waiting..."
        sleep 2
        ((attempt++))
    done

    print_error "Health check failed after $max_attempts attempts"
    return 1
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        print_error "Deployment failed. Cleaning up..."
        # Stop and remove container if it exists
        if docker ps -a --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            docker stop "$CONTAINER_NAME" || true
            docker rm "$CONTAINER_NAME" || true
        fi
        # Remove Docker image
        docker rmi "$DOCKER_IMAGE:$DOCKER_TAG" || true
    fi
}

# Main function
main() {
    print_info "Starting MCPOverflow documentation site deployment..."

    # Set up cleanup trap
    trap cleanup EXIT

    # Run deployment steps
    check_prerequisites
    build_docs_site_app
    create_static_html
    create_nginx_config
    create_dockerfile
    build_docker_image
    deploy_container
    health_check

    print_status "Documentation site deployment completed successfully! 🎉"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "build")
        check_prerequisites
        build_docs_site_app
        create_static_html
        create_nginx_config
        create_dockerfile
        build_docker_image
        print_status "Build completed. Run '$0 deploy' to deploy."
        ;;
    "stop")
        print_info "Stopping documentation site..."
        if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            docker stop "$CONTAINER_NAME"
            print_status "Documentation site stopped"
        else
            print_info "Documentation site is not running"
        fi
        ;;
    "restart")
        print_info "Restarting documentation site..."
        if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            docker restart "$CONTAINER_NAME"
            print_status "Documentation site restarted"
            health_check
        else
            print_info "Documentation site is not running. Deploying..."
            main
        fi
        ;;
    "status")
        if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            print_status "Documentation site is running"
            print_status "🌐 Available at: http://localhost:${PORT}"
        else
            print_warning "Documentation site is not running"
        fi
        ;;
    "logs")
        if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            docker logs -f "$CONTAINER_NAME"
        else
            print_error "Documentation site is not running"
        fi
        ;;
    "cleanup")
        print_info "Cleaning up deployment..."
        if docker ps -a --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            docker stop "$CONTAINER_NAME" || true
            docker rm "$CONTAINER_NAME" || true
            print_status "Container stopped and removed"
        fi
        docker rmi "$DOCKER_IMAGE:$DOCKER_TAG" || true
        rm -rf "$BUILD_DIR"
        print_status "Cleanup completed"
        ;;
    *)
        echo "Usage: $0 {deploy|build|stop|restart|status|logs|cleanup}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Build and deploy the documentation site (default)"
        echo "  build    - Build Docker image without deploying"
        echo "  stop     - Stop the documentation site"
        echo "  restart  - Restart the documentation site"
        echo "  status   - Check if documentation site is running"
        echo "  logs     - Show container logs"
        echo "  cleanup  - Remove all deployment artifacts"
        exit 1
        ;;
esac