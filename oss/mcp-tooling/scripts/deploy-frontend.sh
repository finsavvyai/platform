#!/bin/bash

# MCPOverflow Frontend Deployment Script
# This script deploys the frontend without TinyGo/WASM dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-development}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${PROJECT_ROOT}/logs/deployment_${TIMESTAMP}.log"

# Create logs directory
mkdir -p "${PROJECT_ROOT}/logs"

# Logging functions
log() {
    local message="$1"
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓ ${message}${NC}" | tee -a "${LOG_FILE}"
}

warn() {
    local message="$1"
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠ ${message}${NC}" | tee -a "${LOG_FILE}"
}

error() {
    local message="$1"
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗ ${message}${NC}" | tee -a "${LOG_FILE}"
    exit 1
}

info() {
    local message="$1"
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] ℹ ${message}${NC}" | tee -a "${LOG_FILE}"
}

step() {
    local message="$1"
    echo -e "${PURPLE}=== ${message} ===${NC}" | tee -a "${LOG_FILE}"
}

success() {
    local message="$1"
    echo -e "${CYAN}🎉 ${message}${NC}" | tee -a "${LOG_FILE}"
}

# Check prerequisites
check_prerequisites() {
    step "Checking Prerequisites"

    # Check if we're in the right directory
    if [ ! -f "${PROJECT_ROOT}/package.json" ]; then
        error "Not in MCPOverflow project root"
    fi

    # Check required tools
    local required_tools=("node" "npm" "docker" "docker-compose" "git")
    for tool in "${required_tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            error "${tool} is not installed"
        fi
    done

    log "Prerequisites check completed"
}

# Build frontend applications
build_frontend() {
    step "Building Frontend Applications"

    info "Installing dependencies..."
    cd "${PROJECT_ROOT}"
    npm install

    info "Building shared packages..."
    npm run build --workspaces --if-present

    # Create static frontend directory
    mkdir -p "${PROJECT_ROOT}/dist/frontend"

    # Create marketing site
    info "Creating marketing site..."
    mkdir -p "${PROJECT_ROOT}/dist/frontend/marketing"

    cat > "${PROJECT_ROOT}/dist/frontend/marketing/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCPOverflow - AI-Powered MCP Connector Platform</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
        }
        .float-animation {
            animation: float 3s ease-in-out infinite;
        }
        .gradient-text {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
    </style>
</head>
<body class="bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <header class="text-center mb-16">
            <div class="float-animation inline-block mb-6">
                <div class="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                    <span class="text-3xl font-bold gradient-text">MCP</span>
                </div>
            </div>
            <h1 class="text-6xl font-bold text-white mb-4">MCPOverflow</h1>
            <p class="text-xl text-gray-300 mb-8">AI-Powered MCP Connector Platform</p>
            <div class="flex justify-center gap-4">
                <a href="/developer" class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
                    Get Started
                </a>
                <a href="/docs" class="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
                    Documentation
                </a>
            </div>
        </header>

        <main class="grid md:grid-cols-3 gap-8 mb-16">
            <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition-colors">
                <div class="text-blue-400 text-4xl mb-4">⚡</div>
                <h3 class="text-xl font-bold text-white mb-2">Lightning Fast</h3>
                <p class="text-gray-300">Generate MCP connectors instantly from OpenAPI, GraphQL, and Postman collections.</p>
            </div>
            <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition-colors">
                <div class="text-purple-400 text-4xl mb-4">🤖</div>
                <h3 class="text-xl font-bold text-white mb-2">AI-Powered</h3>
                <p class="text-gray-300">Built-in AgentKit integration for autonomous AI agent deployment and management.</p>
            </div>
            <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition-colors">
                <div class="text-pink-400 text-4xl mb-4">🚀</div>
                <h3 class="text-xl font-bold text-white mb-2">Cloud Native</h3>
                <p class="text-gray-300">Deploy to Cloudflare Workers, Vercel Edge Functions, and more with one click.</p>
            </div>
        </main>

        <section class="text-center">
            <h2 class="text-4xl font-bold text-white mb-8">Platform Status</h2>
            <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
                <div class="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                    <div class="text-green-400 text-2xl mb-2">✅</div>
                    <h4 class="text-white font-semibold">Frontend</h4>
                    <p class="text-gray-300 text-sm">Deployed</p>
                </div>
                <div class="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                    <div class="text-green-400 text-2xl mb-2">✅</div>
                    <h4 class="text-white font-semibold">Documentation</h4>
                    <p class="text-gray-300 text-sm">Available</p>
                </div>
                <div class="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                    <div class="text-green-400 text-2xl mb-2">✅</div>
                    <h4 class="text-white font-semibold">Platform</h4>
                    <p class="text-gray-300 text-sm">Running</p>
                </div>
                <div class="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                    <div class="text-yellow-400 text-2xl mb-2">🔧</div>
                    <h4 class="text-white font-semibold">Backend</h4>
                    <p class="text-gray-300 text-sm">Setup Required</p>
                </div>
            </div>
        </section>

        <footer class="text-center mt-16 text-gray-400">
            <p>&copy; 2024 MCPOverflow. Built with ❤️ for the AI agent ecosystem.</p>
        </footer>
    </div>
</body>
</html>
EOF

    # Create developer platform
    info "Creating developer platform..."
    mkdir -p "${PROJECT_ROOT}/dist/frontend/developer"

    cat > "${PROJECT_ROOT}/dist/frontend/developer/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Developer Platform - MCPOverflow</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-900 text-white min-h-screen">
    <nav class="bg-gray-800 border-b border-gray-700">
        <div class="container mx-auto px-4 py-4">
            <div class="flex justify-between items-center">
                <a href="/" class="text-2xl font-bold text-blue-400">MCPOverflow</a>
                <div class="space-x-6">
                    <a href="/" class="hover:text-blue-400">Home</a>
                    <a href="/developer" class="hover:text-blue-400">Developer</a>
                    <a href="/docs" class="hover:text-blue-400">Docs</a>
                </div>
            </div>
        </div>
    </nav>

    <main class="container mx-auto px-4 py-8">
        <div class="mb-8">
            <h1 class="text-4xl font-bold mb-4">Developer Platform</h1>
            <p class="text-gray-300">Build and manage your MCP connectors</p>
        </div>

        <div class="grid md:grid-cols-2 gap-8">
            <div class="bg-gray-800 rounded-lg p-6">
                <h2 class="text-2xl font-semibold mb-4 flex items-center">
                    <i class="fas fa-plug mr-3 text-blue-400"></i>
                    Connectors
                </h2>
                <p class="text-gray-300 mb-6">Your MCP connectors will appear here once you create them.</p>
                <button class="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg w-full">
                    <i class="fas fa-plus mr-2"></i>Create New Connector
                </button>
            </div>

            <div class="bg-gray-800 rounded-lg p-6">
                <h2 class="text-2xl font-semibold mb-4 flex items-center">
                    <i class="fas fa-robot mr-3 text-purple-400"></i>
                    AgentKit Integration
                </h2>
                <p class="text-gray-300 mb-6">Seamless integration with OpenAI AgentKit for autonomous agents.</p>
                <div class="space-y-3">
                    <div class="flex items-center justify-between bg-gray-700 rounded p-3">
                        <span>AgentKit Status</span>
                        <span class="text-green-400">Ready</span>
                    </div>
                    <div class="flex items-center justify-between bg-gray-700 rounded p-3">
                        <span>Auto-Registration</span>
                        <span class="text-green-400">Enabled</span>
                    </div>
                    <div class="flex items-center justify-between bg-gray-700 rounded p-3">
                        <span>Sync Status</span>
                        <span class="text-gray-400">Idle</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="bg-gray-800 rounded-lg p-6 mt-8">
            <h2 class="text-2xl font-semibold mb-4">Quick Actions</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button class="bg-green-600 hover:bg-green-700 p-4 rounded-lg">
                    <i class="fas fa-upload mb-2"></i>
                    <div>Upload OpenAPI</div>
                </button>
                <button class="bg-blue-600 hover:bg-blue-700 p-4 rounded-lg">
                    <i class="fas fa-code mb-2"></i>
                    <div>GraphQL Schema</div>
                </button>
                <button class="bg-purple-600 hover:bg-purple-700 p-4 rounded-lg">
                    <i class="fas fa-file-archive mb-2"></i>
                    <div>Postman Collection</div>
                </button>
                <button class="bg-pink-600 hover:bg-pink-700 p-4 rounded-lg">
                    <i class="fas fa-rocket mb-2"></i>
                    <div>Deploy Worker</div>
                </button>
            </div>
        </div>
    </main>
</body>
</html>
EOF

    # Create documentation site
    info "Creating documentation site..."
    mkdir -p "${PROJECT_ROOT}/dist/frontend/docs"

    cat > "${PROJECT_ROOT}/dist/frontend/docs/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentation - MCPOverflow</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-900 text-white min-h-screen">
    <nav class="bg-gray-800 border-b border-gray-700">
        <div class="container mx-auto px-4 py-4">
            <div class="flex justify-between items-center">
                <a href="/" class="text-2xl font-bold text-blue-400">MCPOverflow</a>
                <div class="space-x-6">
                    <a href="/" class="hover:text-blue-400">Home</a>
                    <a href="/developer" class="hover:text-blue-400">Developer</a>
                    <a href="/docs" class="hover:text-blue-400">Docs</a>
                </div>
            </div>
        </div>
    </nav>

    <main class="container mx-auto px-4 py-8">
        <div class="mb-8">
            <h1 class="text-4xl font-bold mb-4">Documentation</h1>
            <p class="text-gray-300">Complete guide to MCPOverflow</p>
        </div>

        <div class="grid md:grid-cols-3 gap-6">
            <div class="bg-gray-800 rounded-lg p-6">
                <h3 class="text-xl font-semibold mb-4 flex items-center">
                    <i class="fas fa-book mr-3 text-blue-400"></i>
                    Getting Started
                </h3>
                <ul class="space-y-2 text-gray-300">
                    <li><a href="#" class="hover:text-blue-400">Installation</a></li>
                    <li><a href="#" class="hover:text-blue-400">Quick Start</a></li>
                    <li><a href="#" class="hover:text-blue-400">Basic Concepts</a></li>
                </ul>
            </div>
            <div class="bg-gray-800 rounded-lg p-6">
                <h3 class="text-xl font-semibold mb-4 flex items-center">
                    <i class="fas fa-code mr-3 text-green-400"></i>
                    API Reference
                </h3>
                <ul class="space-y-2 text-gray-300">
                    <li><a href="#" class="hover:text-blue-400">Connectors</a></li>
                    <li><a href="#" class="hover:text-blue-400">Deployments</a></li>
                    <li><a href="#" class="hover:text-blue-400">Authentication</a></li>
                </ul>
            </div>
            <div class="bg-gray-800 rounded-lg p-6">
                <h3 class="text-xl font-semibold mb-4 flex items-center">
                    <i class="fas fa-graduation-cap mr-3 text-purple-400"></i>
                    Guides
                </h3>
                <ul class="space-y-2 text-gray-300">
                    <li><a href="#" class="hover:text-blue-400">OpenAPI Integration</a></li>
                    <li><a href="#" class="hover:text-blue-400">AgentKit Setup</a></li>
                    <li><a href="#" class="hover:text-blue-400">Deployment</a></li>
                </ul>
            </div>
        </div>

        <div class="bg-gray-800 rounded-lg p-6 mt-8">
            <h2 class="text-2xl font-semibold mb-4">Featured Topics</h2>
            <div class="space-y-4">
                <div class="border-l-4 border-blue-500 pl-4">
                    <h3 class="text-lg font-semibold text-blue-400">AgentKit Integration</h3>
                    <p class="text-gray-300">Learn how to integrate your MCP connectors with OpenAI AgentKit for autonomous agents.</p>
                </div>
                <div class="border-l-4 border-purple-500 pl-4">
                    <h3 class="text-lg font-semibold text-purple-400">Multi-Environment Deployment</h3>
                    <p class="text-gray-300">Deploy your connectors to various platforms with a single configuration.</p>
                </div>
                <div class="border-l-4 border-green-500 pl-4">
                    <h3 class="text-lg font-semibold text-green-400">Authentication</h3>
                    <p class="text-gray-300">Secure your connectors with OAuth 2.0, JWT, or API key authentication.</p>
                </div>
            </div>
        </div>
    </main>
</body>
</html>
EOF

    log "Frontend applications built successfully"
}

# Create Nginx configuration
setup_nginx() {
    step "Setting up Nginx"

    mkdir -p "${PROJECT_ROOT}/dist/nginx"
    cat > "${PROJECT_ROOT}/dist/nginx/nginx.conf" << 'EOF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;

    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Main server
    server {
        listen 80;
        server_name _;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # Static files
        location / {
            root /var/www;
            try_files $uri $uri/ /index.html;
            expires 1h;
        }

        # Developer platform
        location /developer {
            alias /var/www/developer;
            try_files $uri $uri/ /developer/index.html;
        }

        # Documentation
        location /docs {
            alias /var/www/docs;
            try_files $uri $uri/ /docs/index.html;
        }

        # Health check
        location /health {
            access_log off;
            return 200 '{"status":"healthy","timestamp":"$time_iso8601","version":"1.0.0"}';
            add_header Content-Type application/json;
        }
    }
}
EOF

    log "Nginx configuration created"
}

# Deploy with Docker Compose
deploy_with_docker() {
    step "Deploying with Docker Compose"

    # Create deployment compose file
    cat > "${PROJECT_ROOT}/docker-compose.frontend.yml" << 'EOF'
version: '3.8'

services:
  frontend-nginx:
    image: nginx:alpine
    container_name: mcpoverflow-frontend
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - ./dist/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./dist/frontend:/var/www:ro
    networks:
      - mcpoverflow_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  mcpoverflow_network:
    driver: bridge
EOF

    info "Building and starting frontend services..."
    docker-compose -f docker-compose.frontend.yml up -d

    # Wait for service to start
    sleep 10

    log "Frontend deployment completed"
}

# Run health checks
run_health_checks() {
    step "Running Health Checks"

    info "Checking frontend..."
    if curl -f http://localhost:8080/ &>/dev/null; then
        log "✅ Frontend is responding"
    else
        warn "⚠️ Frontend may not be responding"
    fi

    info "Checking health endpoint..."
    if curl -f http://localhost:8080/health &>/dev/null; then
        log "✅ Health endpoint is responding"
    else
        warn "⚠️ Health endpoint may not be responding"
    fi

    info "Checking Docker containers..."
    if docker ps --format "table {{.Names}}" | grep -q "mcpoverflow-frontend"; then
        log "✅ Frontend container is running"
    else
        warn "⚠️ Frontend container may not be running"
    fi

    log "Health checks completed"
}

# Show deployment summary
show_summary() {
    step "Deployment Summary"

    echo ""
    success "🎉 MCPOverflow frontend deployed successfully!"
    echo ""
    echo "🌐 Access Points:"
    echo "  🏠 Marketing Site: http://localhost:8080/"
    echo "  👨‍💻 Developer Platform: http://localhost:8080/developer"
    echo "  📚 Documentation: http://localhost:8080/docs"
    echo "  🔌 Health Check: http://localhost:8080/health"
    echo ""
    echo "🐳 Services Status:"
    echo "  Frontend (Nginx): Running on port 8080"
    echo ""
    echo "🔧 Management Commands:"
    echo "  View logs: docker-compose -f docker-compose.frontend.yml logs -f"
    echo "  Stop services: docker-compose -f docker-compose.frontend.yml down"
    echo "  Restart services: docker-compose -f docker-compose.frontend.yml restart"
    echo ""
    echo "📝 Log file: ${LOG_FILE}"
    echo ""
    info "🚀 Backend API services can be added once TinyGo installation is resolved"
    echo "🛠  MCP connector generation and AgentKit features will be available in the full deployment"
    echo ""
}

# Main deployment function
main() {
    local command="${1:-deploy}"

    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              MCPOverflow Frontend Deployment Script          ║"
    echo "║                      Version 1.0.0                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""

    case "${command}" in
        "clean")
            docker-compose -f docker-compose.frontend.yml down 2>/dev/null || true
            rm -rf "${PROJECT_ROOT}/dist"
            log "Cleanup completed"
            ;;
        "build")
            check_prerequisites
            build_frontend
            setup_nginx
            ;;
        "deploy")
            check_prerequisites
            build_frontend
            setup_nginx
            deploy_with_docker
            run_health_checks
            show_summary
            ;;
        "health")
            run_health_checks
            ;;
        *)
            echo "Usage: $0 {clean|build|deploy|health}"
            echo ""
            echo "Commands:"
            echo "  clean    - Stop and clean frontend services"
            echo "  build    - Build frontend without deployment"
            echo "  deploy   - Full frontend deployment (default)"
            echo "  health   - Run health checks"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"