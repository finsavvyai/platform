#!/bin/bash

# MCPOverflow Dev Platform Frontend Deployment Script
# Deploys the developer platform with static HTML fallback

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
echo "║       MCPOverflow Dev Platform Frontend Deployment          ║"
echo "║                      Version 1.0.0                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/dist/dev-platform"
DOCKER_IMAGE="mcpoverflow-dev-platform"
DOCKER_TAG="latest"
CONTAINER_NAME="mcpoverflow-dev-platform"
PORT=3001

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

# Build dev platform app only
build_dev_platform_app() {
    print_info "Building dev platform application..."

    cd "$PROJECT_ROOT"

    # Clean previous builds
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"

    # Try to build the dev platform app, but fall back to static HTML if it fails
    cd apps/dev-platform

    print_info "Attempting to build dev platform app..."
    local build_success=false

    # Install dependencies (skip optional dependencies)
    if npm install --no-optional 2>/dev/null; then
        # Build the app
        if npm run build 2>/dev/null; then
            # Copy built files to our dist directory
            if [ -d "out" ]; then
                cp -r out/* "$BUILD_DIR/" 2>/dev/null
                print_status "Dev platform application built successfully"
                build_success=true
            elif [ -d ".next" ]; then
                cp -r .next/* "$BUILD_DIR/" 2>/dev/null
                print_status "Dev platform application built successfully"
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
        print_status "Will use static HTML fallback for dev platform"
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
    add_header X-Domain-Purpose "developer-platform" always;

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

    # API proxy (for future backend integration)
    location /api/ {
        proxy_pass http://host.docker.internal:8080/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Handle Next.js routes
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

# Create static HTML for dev platform
create_static_html() {
    print_info "Creating static HTML dev platform..."

    # Create a comprehensive developer platform page
    cat > "$BUILD_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCPOverflow Developer Platform - Build MCP Connectors</title>
    <meta name="description" content="Developer platform for building, testing, and deploying Model Context Protocol (MCP) connectors with AI-powered tools.">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .gradient { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); }
        .glass { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); }
        .code-block { background: #1e293b; color: #e2e8f0; }
        .terminal { background: #0f172a; color: #22d3ee; }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Header -->
    <header class="fixed top-0 w-full z-50 glass border-b border-gray-200">
        <nav class="container mx-auto px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <div class="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg"></div>
                    <span class="text-xl font-bold text-gray-800">MCPOverflow</span>
                    <span class="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Dev Platform</span>
                </div>
                <div class="hidden md:flex items-center space-x-6">
                    <a href="#dashboard" class="text-gray-600 hover:text-gray-900">Dashboard</a>
                    <a href="#connectors" class="text-gray-600 hover:text-gray-900">Connectors</a>
                    <a href="#generate" class="text-gray-600 hover:text-gray-900">Generate</a>
                    <a href="#deploy" class="text-gray-600 hover:text-gray-900">Deploy</a>
                    <button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                        Connect Wallet
                    </button>
                </div>
            </div>
        </nav>
    </header>

    <!-- Hero Section -->
    <section class="pt-32 pb-20 px-6 bg-gradient-to-br from-blue-50 to-purple-50">
        <div class="container mx-auto">
            <div class="text-center mb-12">
                <h1 class="text-5xl font-bold text-gray-900 mb-6">
                    Developer Platform
                </h1>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Build, test, and deploy Model Context Protocol connectors with AI-powered tools and seamless AgentKit integration.
                </p>
            </div>

            <!-- Quick Stats -->
            <div class="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
                <div class="bg-white rounded-lg p-6 text-center shadow-sm">
                    <div class="text-3xl font-bold text-blue-600">12</div>
                    <div class="text-gray-600 text-sm">Active Connectors</div>
                </div>
                <div class="bg-white rounded-lg p-6 text-center shadow-sm">
                    <div class="text-3xl font-bold text-green-600">8.5K</div>
                    <div class="text-gray-600 text-sm">API Calls Today</div>
                </div>
                <div class="bg-white rounded-lg p-6 text-center shadow-sm">
                    <div class="text-3xl font-bold text-purple-600">99.9%</div>
                    <div class="text-gray-600 text-sm">Uptime</div>
                </div>
                <div class="bg-white rounded-lg p-6 text-center shadow-sm">
                    <div class="text-3xl font-bold text-orange-600">3</div>
                    <div class="text-gray-600 text-sm">Deployments</div>
                </div>
            </div>
        </div>
    </section>

    <!-- Dashboard Section -->
    <section id="dashboard" class="py-20 bg-white">
        <div class="container mx-auto px-6">
            <div class="flex items-center justify-between mb-8">
                <h2 class="text-3xl font-bold text-gray-900">Dashboard</h2>
                <button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    + New Connector
                </button>
            </div>

            <!-- Recent Connectors -->
            <div class="bg-gray-50 rounded-lg p-6 mb-8">
                <h3 class="text-xl font-semibold text-gray-900 mb-4">Recent Connectors</h3>
                <div class="space-y-4">
                    <div class="bg-white rounded-lg p-4 flex items-center justify-between shadow-sm">
                        <div class="flex items-center space-x-4">
                            <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <span class="text-green-600">✓</span>
                            </div>
                            <div>
                                <div class="font-medium text-gray-900">Stripe Payments API</div>
                                <div class="text-sm text-gray-500">Last deployed 2 hours ago</div>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Active</span>
                            <button class="text-gray-400 hover:text-gray-600">⋮</button>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg p-4 flex items-center justify-between shadow-sm">
                        <div class="flex items-center space-x-4">
                            <div class="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <span class="text-yellow-600">⚡</span>
                            </div>
                            <div>
                                <div class="font-medium text-gray-900">OpenAI GPT-4 API</div>
                                <div class="text-sm text-gray-500">Building deployment...</div>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Building</span>
                            <button class="text-gray-400 hover:text-gray-600">⋮</button>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg p-4 flex items-center justify-between shadow-sm">
                        <div class="flex items-center space-x-4">
                            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span class="text-blue-600">☁</span>
                            </div>
                            <div>
                                <div class="font-medium text-gray-900">AWS S3 Storage</div>
                                <div class="text-sm text-gray-500">Ready to deploy</div>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Ready</span>
                            <button class="text-gray-400 hover:text-gray-600">⋮</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Code Generation Section -->
    <section id="generate" class="py-20 bg-gray-50">
        <div class="container mx-auto px-6">
            <div class="text-center mb-12">
                <h2 class="text-3xl font-bold text-gray-900 mb-4">Generate MCP Connectors</h2>
                <p class="text-xl text-gray-600">Upload your API specification and generate production-ready MCP code</p>
            </div>

            <div class="max-w-4xl mx-auto">
                <div class="bg-white rounded-lg shadow-lg p-8">
                    <!-- Upload Area -->
                    <div class="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition cursor-pointer">
                        <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">Drop your OpenAPI spec here</h3>
                        <p class="text-gray-500 mb-4">or click to browse</p>
                        <p class="text-sm text-gray-400">Supports JSON, YAML, and Postman collections</p>
                    </div>

                    <!-- Generated Code Preview -->
                    <div class="mt-8">
                        <div class="flex items-center justify-between mb-4">
                            <h4 class="font-semibold text-gray-900">Generated MCP Code</h4>
                            <button class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition">
                                Copy Code
                            </button>
                        </div>
                        <div class="code-block rounded-lg p-4 font-mono text-sm overflow-x-auto">
                            <pre><code>// Generated MCP Server with AgentKit Integration
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { AgentKitManager } from './agentkit.js';

const server = new Server(
  {
    name: 'stripe-payments-api',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize AgentKit
const agentKit = new AgentKitManager(server);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_payment_intent',
        description: 'Create a Stripe payment intent',
        inputSchema: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Amount in cents' },
            currency: { type: 'string', description: 'Currency code' }
          },
          required: ['amount', 'currency']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'create_payment_intent') {
    // Implementation here
    return {
      content: [{
        type: 'text',
        text: `Payment intent created for ${args.amount} ${args.currency}`
      }]
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  await agentKit.initialize();
  console.error('Stripe MCP Server running on stdio');
}

main().catch(console.error);</code></pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Deployment Section -->
    <section id="deploy" class="py-20 bg-white">
        <div class="container mx-auto px-6">
            <div class="text-center mb-12">
                <h2 class="text-3xl font-bold text-gray-900 mb-4">Deploy Anywhere</h2>
                <p class="text-xl text-gray-600">One-click deployment to your preferred platform</p>
            </div>

            <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                <div class="border rounded-lg p-6 hover:shadow-lg transition cursor-pointer">
                    <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                        <span class="text-2xl">⚡</span>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Cloudflare Workers</h3>
                    <p class="text-gray-600 mb-4">Global edge network with sub-second cold starts</p>
                    <button class="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition">
                        Deploy to Workers
                    </button>
                </div>
                <div class="border rounded-lg p-6 hover:shadow-lg transition cursor-pointer">
                    <div class="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-4">
                        <span class="text-2xl">▲</span>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Vercel Edge</h3>
                    <p class="text-gray-600 mb-4">Serverless functions with automatic scaling</p>
                    <button class="w-full px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition">
                        Deploy to Vercel
                    </button>
                </div>
                <div class="border rounded-lg p-6 hover:shadow-lg transition cursor-pointer">
                    <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                        <span class="text-2xl">🔧</span>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Docker</h3>
                    <p class="text-gray-600 mb-4">Containerized deployment for any infrastructure</p>
                    <button class="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                        Deploy Docker
                    </button>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="py-12 bg-gray-900">
        <div class="container mx-auto px-6">
            <div class="flex flex-col md:flex-row justify-between items-center">
                <div class="flex items-center space-x-2 mb-4 md:mb-0">
                    <div class="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded"></div>
                    <span class="text-white font-semibold">MCPOverflow</span>
                    <span class="text-gray-400">Developer Platform</span>
                </div>
                <div class="flex space-x-6">
                    <a href="https://mcpoverflow.com" class="text-gray-400 hover:text-white">Marketing</a>
                    <a href="https://mcpoverflow.dev" class="text-gray-400 hover:text-white">Docs</a>
                    <a href="https://mcpoverflow.ai" class="text-gray-400 hover:text-white">AI Platform</a>
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
                    document.querySelector(this.getAttribute('href')).scrollIntoView({
                        behavior: 'smooth'
                    });
                });
            });

            // Upload area interaction
            const uploadArea = document.querySelector('.border-dashed');
            if (uploadArea) {
                uploadArea.addEventListener('click', () => {
                    alert('File upload will be implemented with backend integration');
                });

                uploadArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    uploadArea.classList.add('border-blue-400', 'bg-blue-50');
                });

                uploadArea.addEventListener('dragleave', () => {
                    uploadArea.classList.remove('border-blue-400', 'bg-blue-50');
                });
            }

            // Copy code functionality
            const copyButton = document.querySelector('button:has-text("Copy Code")');
            if (copyButton) {
                copyButton.addEventListener('click', () => {
                    navigator.clipboard.writeText(document.querySelector('.code-block pre').textContent);
                    copyButton.textContent = 'Copied!';
                    setTimeout(() => {
                        copyButton.textContent = 'Copy Code';
                    }, 2000);
                });
            }
        });
    </script>
</body>
</html>
EOF

    print_status "Static HTML dev platform created"
}

# Create Dockerfile for dev platform
create_dockerfile() {
    print_info "Creating Dockerfile for dev platform..."

    cat > "$BUILD_DIR/Dockerfile" << 'EOF'
FROM nginx:alpine

# Copy built static files
COPY . /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3001

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
        -p "${PORT}:3001" \
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
            print_status "Dev platform is healthy and accessible"
            print_status "✅ Dev platform deployed successfully!"
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
    print_info "Starting MCPOverflow dev platform deployment..."

    # Set up cleanup trap
    trap cleanup EXIT

    # Run deployment steps
    check_prerequisites
    build_dev_platform_app
    create_static_html
    create_nginx_config
    create_dockerfile
    build_docker_image
    deploy_container
    health_check

    print_status "Dev platform deployment completed successfully! 🎉"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "build")
        check_prerequisites
        build_dev_platform_app
        create_static_html
        create_nginx_config
        create_dockerfile
        build_docker_image
        print_status "Build completed. Run '$0 deploy' to deploy."
        ;;
    "stop")
        print_info "Stopping dev platform..."
        if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            docker stop "$CONTAINER_NAME"
            print_status "Dev platform stopped"
        else
            print_info "Dev platform is not running"
        fi
        ;;
    "restart")
        print_info "Restarting dev platform..."
        if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            docker restart "$CONTAINER_NAME"
            print_status "Dev platform restarted"
            health_check
        else
            print_info "Dev platform is not running. Deploying..."
            main
        fi
        ;;
    "status")
        if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            print_status "Dev platform is running"
            print_status "🌐 Available at: http://localhost:${PORT}"
        else
            print_warning "Dev platform is not running"
        fi
        ;;
    "logs")
        if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            docker logs -f "$CONTAINER_NAME"
        else
            print_error "Dev platform is not running"
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
        echo "  deploy   - Build and deploy the dev platform (default)"
        echo "  build    - Build Docker image without deploying"
        echo "  stop     - Stop the dev platform"
        echo "  restart  - Restart the dev platform"
        echo "  status   - Check if dev platform is running"
        echo "  logs     - Show container logs"
        echo "  cleanup  - Remove all deployment artifacts"
        exit 1
        ;;
esac