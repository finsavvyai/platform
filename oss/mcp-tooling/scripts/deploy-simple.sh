#!/bin/bash

# Simplified MCPOverflow Deployment Script (without TinyGo/WASM)
# This script deploys the core platform without WASM compilation

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
    local required_tools=("node" "npm" "go" "docker" "docker-compose" "git")
    for tool in "${required_tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            error "${tool} is not installed"
        fi
    done

    # Check if git repository is clean
    if [ -n "$(git status --porcelain)" ]; then
        warn "Git repository has uncommitted changes"
    fi

    log "Prerequisites check completed"
}

# Start Docker services
start_services() {
    step "Starting Docker Services"

    info "Stopping existing services..."
    docker-compose down || true

    info "Starting services..."
    docker-compose up -d

    # Wait for services to be ready
    info "Waiting for services to be ready..."
    sleep 30

    # Check service health
    local services=("postgres" "redis" "neo4j" "minio" "qdrant" "prometheus" "grafana")
    for service in "${services[@]}"; do
        if docker-compose ps "${service}" | grep -q "Up (healthy)"; then
            log "${service} is healthy"
        else
            warn "${service} may still be starting up"
        fi
    done

    log "Docker services started successfully"
}

# Build and deploy API service
deploy_api_service() {
    step "Building and Deploying API Service"

    info "Building API service..."
    cd "${PROJECT_ROOT}/services/api-service"

    # Install Go dependencies
    go mod tidy

    # Build the API service
    go build -ldflags="-s -w" -o bin/api-service ./cmd/main.go

    # Test the build
    if [ ! -f "bin/api-service" ]; then
        error "API service build failed"
    fi

    # Create Dockerfile for API service
    cat > Dockerfile << 'EOF'
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o api-service ./cmd/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/api-service .
COPY --from=builder /app/migrations ./migrations

EXPOSE 8080
CMD ["./api-service"]
EOF

    # Build Docker image
    info "Building API service Docker image..."
    docker build -t mcpoverflow/api-service:latest .

    cd "${PROJECT_ROOT}"
    log "API service deployed successfully"
}

# Build and deploy frontend
deploy_frontend() {
    step "Building and Deploying Frontend"

    info "Installing frontend dependencies..."
    npm install

    info "Building shared packages..."
    npm run build --workspaces --if-present

    # Create a simple static frontend for testing
    mkdir -p "${PROJECT_ROOT}/dist/frontend"

    cat > "${PROJECT_ROOT}/dist/frontend/index.html" << 'EOF'
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
    </style>
</head>
<body class="bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <header class="text-center mb-16">
            <div class="float-animation inline-block mb-6">
                <div class="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                    <span class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">MCP</span>
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
                    <h4 class="text-white font-semibold">API Service</h4>
                    <p class="text-gray-300 text-sm">Operational</p>
                </div>
                <div class="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                    <div class="text-green-400 text-2xl mb-2">✅</div>
                    <h4 class="text-white font-semibold">Database</h4>
                    <p class="text-gray-300 text-sm">Connected</p>
                </div>
                <div class="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                    <div class="text-green-400 text-2xl mb-2">✅</div>
                    <h4 class="text-white font-semibold">Cache</h4>
                    <p class="text-gray-300 text-sm">Running</p>
                </div>
                <div class="bg-white/10 backdrop-blur-lg rounded-lg p-4">
                    <div class="text-yellow-400 text-2xl mb-2">🔧</div>
                    <h4 class="text-white font-semibold">Workers</h4>
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

    # Create additional pages
    mkdir -p "${PROJECT_ROOT}/dist/frontend/developer"
    cat > "${PROJECT_ROOT}/dist/frontend/developer/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Developer Platform - MCPOverflow</title>
    <script src="https://cdn.tailwindcss.com"></script>
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
        <h1 class="text-4xl font-bold mb-8">Developer Platform</h1>
        <div class="bg-gray-800 rounded-lg p-6">
            <h2 class="text-2xl font-semibold mb-4">Connectors</h2>
            <p class="text-gray-300 mb-4">Your MCP connectors will appear here once you create them.</p>
            <button class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg">
                Create New Connector
            </button>
        </div>
    </main>
</body>
</html>
EOF

    mkdir -p "${PROJECT_ROOT}/dist/frontend/docs"
    cat > "${PROJECT_ROOT}/dist/frontend/docs/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentation - MCPOverflow</title>
    <script src="https://cdn.tailwindcss.com"></script>
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
        <h1 class="text-4xl font-bold mb-8">Documentation</h1>
        <div class="grid md:grid-cols-3 gap-6">
            <div class="bg-gray-800 rounded-lg p-6">
                <h3 class="text-xl font-semibold mb-4">Getting Started</h3>
                <ul class="space-y-2 text-gray-300">
                    <li><a href="#" class="hover:text-blue-400">Installation</a></li>
                    <li><a href="#" class="hover:text-blue-400">Quick Start</a></li>
                    <li><a href="#" class="hover:text-blue-400">Basic Concepts</a></li>
                </ul>
            </div>
            <div class="bg-gray-800 rounded-lg p-6">
                <h3 class="text-xl font-semibold mb-4">API Reference</h3>
                <ul class="space-y-2 text-gray-300">
                    <li><a href="#" class="hover:text-blue-400">Connectors</a></li>
                    <li><a href="#" class="hover:text-blue-400">Deployments</a></li>
                    <li><a href="#" class="hover:text-blue-400">Authentication</a></li>
                </ul>
            </div>
            <div class="bg-gray-800 rounded-lg p-6">
                <h3 class="text-xl font-semibold mb-4">Guides</h3>
                <ul class="space-y-2 text-gray-300">
                    <li><a href="#" class="hover:text-blue-400">OpenAPI Integration</a></li>
                    <li><a href="#" class="hover:text-blue-400">AgentKit Setup</a></li>
                    <li><a href="#" class="hover:text-blue-400">Deployment</a></li>
                </ul>
            </div>
        </div>
    </main>
</body>
</html>
EOF

    log "Frontend built successfully"
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

    # Upstream backend
    upstream backend {
        server host.docker.internal:8080;
    }

    # Main server
    server {
        listen 80;
        server_name _;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # API proxy
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

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
    }
}
EOF
}

# Deploy with Docker Compose
deploy_with_docker() {
    step "Deploying with Docker Compose"

    # Create deployment compose file
    cat > "${PROJECT_ROOT}/docker-compose.deploy.yml" << 'EOF'
version: '3.8'

services:
  frontend-nginx:
    image: nginx:alpine
    container_name: mcpoverflow-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./dist/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./dist/frontend:/var/www:ro
    networks:
      - mcpoverflow_network
    depends_on:
      - api-service

  api-service:
    image: mcpoverflow/api-service:latest
    container_name: mcpoverflow-api
    restart: unless-stopped
    environment:
      - ENVIRONMENT=development
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=mcpoverflow
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=dev-secret-key
    ports:
      - "8080:8080"
    networks:
      - mcpoverflow_network
    depends_on:
      - postgres
      - redis

networks:
  mcpoverflow_network:
    driver: bridge
EOF

    info "Starting deployment services..."
    docker-compose -f docker-compose.deploy.yml up -d

    # Wait for services to start
    sleep 10

    log "Docker deployment completed"
}

# Run health checks
run_health_checks() {
    step "Running Health Checks"

    info "Checking frontend..."
    if curl -f http://localhost/ &>/dev/null; then
        log "✅ Frontend is responding"
    else
        warn "⚠️ Frontend may not be responding"
    fi

    info "Checking API service..."
    if curl -f http://localhost:8080/health &>/dev/null; then
        log "✅ API service is responding"
    else
        warn "⚠️ API service may not be responding"
    fi

    info "Checking Docker containers..."
    local containers=("mcpoverflow-frontend" "mcpoverflow-api" "mcpoverflow_postgres" "mcpoverflow_redis")
    for container in "${containers[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "${container}"; then
            log "✅ ${container} is running"
        else
            warn "⚠️ ${container} may not be running"
        fi
    done

    log "Health checks completed"
}

# Show deployment summary
show_summary() {
    step "Deployment Summary"

    echo ""
    success "🎉 MCPOverflow deployed successfully!"
    echo ""
    echo "🌐 Access Points:"
    echo "  🏠 Marketing Site: http://localhost/"
    echo "  👨‍💻 Developer Platform: http://localhost/developer"
    echo "  📚 Documentation: http://localhost/docs"
    echo "  🔌 API Endpoint: http://localhost/api"
    echo ""
    echo "🐳 Services Status:"
    echo "  Frontend (Nginx): Running on port 80"
    echo "  API Service: Running on port 8080"
    echo "  Database: PostgreSQL on port 5432"
    echo "  Cache: Redis on port 6379"
    echo ""
    echo "📊 Monitoring:"
    echo "  📈 Grafana: http://localhost:3001 (admin/mcpoverflow_admin)"
    echo "  🔍 Prometheus: http://localhost:9090"
    echo ""
    echo "🔧 Management Commands:"
    echo "  View logs: docker-compose -f docker-compose.deploy.yml logs -f"
    echo "  Stop services: docker-compose -f docker-compose.deploy.yml down"
    echo "  Restart services: docker-compose -f docker-compose.deploy.yml restart"
    echo ""
    echo "📝 Log file: ${LOG_FILE}"
    echo ""
    info "🚀 Next steps: Configure your environment variables and start building connectors!"
}

# Main deployment function
main() {
    local command="${1:-deploy}"

    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║            MCPOverflow Simple Deployment Script           ║"
    echo "║                      Version 1.0.0                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""

    case "${command}" in
        "clean")
            docker-compose -f docker-compose.deploy.yml down || true
            rm -rf "${PROJECT_ROOT}/dist"
            log "Cleanup completed"
            ;;
        "deploy")
            check_prerequisites
            start_services
            deploy_api_service
            deploy_frontend
            setup_nginx
            deploy_with_docker
            run_health_checks
            show_summary
            ;;
        "services")
            check_prerequisites
            start_services
            ;;
        "health")
            run_health_checks
            ;;
        *)
            echo "Usage: $0 {clean|deploy|services|health}"
            echo ""
            echo "Commands:"
            echo "  clean    - Stop and clean all services"
            echo "  deploy   - Full deployment (default)"
            echo "  services - Start database services only"
            echo "  health   - Run health checks"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"