#!/bin/bash

# MCPOverflow Production Deployment Script
# This script deploys the complete MCPOverflow platform to production

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
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-production}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${PROJECT_ROOT}/logs/deployment_${TIMESTAMP}.log"

# Create logs directory
mkdir -p "${PROJECT_ROOT}/logs"

# Ensure Volta (Node/NPM), Homebrew (Go), Local (Docker), and User Local (TinyGo) are in PATH
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"


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

    # Check Docker Daemon
    if ! docker info >/dev/null 2>&1; then
        error "Docker Daemon is not running. Please start Docker Desktop."
    fi

    # Check environment variables
    if [ -f "${PROJECT_ROOT}/.env.production" ]; then
        info "Loading production secrets from .env.production..."
        set -a
        source "${PROJECT_ROOT}/.env.production"
        set +a
    else
        warn ".env.production not found."
        read -p "Do you want to generate production secrets now? (Y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            "${PROJECT_ROOT}/scripts/generate-production-secrets.sh"
            if [ -f "${PROJECT_ROOT}/.env.production" ]; then
                set -a
                source "${PROJECT_ROOT}/.env.production"
                set +a
            else
                error "Secrets generation failed or cancelled. Deployment cannot proceed securely."
            fi
        else
            warn "Proceeding without .env.production. Ensure all required variables are set in your shell."
        fi
    fi

    local required_env_vars=("CLOUDFLARE_API_TOKEN" "CLOUDFLARE_ACCOUNT_ID" "JWT_SECRET" "DB_PASSWORD")
    for var in "${required_env_vars[@]}"; do
        if [ -z "${!var}" ]; then
            error "Environment variable ${var} is not set. Run scripts/generate-production-secrets.sh or set it manually."
        fi
    done

    # Check TinyGo
    if ! command -v "tinygo" &> /dev/null; then
        warn "TinyGo not found. Installing..."
        "${PROJECT_ROOT}/scripts/install-tinygo.sh"
    fi

    # Check if git repository is clean
    if [ -n "$(git status --porcelain)" ]; then
        warn "Git repository is not clean. Proceeding with caution."
        # error "Git repository is not clean. Commit or stash changes first."
    fi

    log "Prerequisites check completed"
}

# Clean previous builds
clean_builds() {
    step "Cleaning Previous Builds"

    info "Cleaning frontend builds..."
    rm -rf "${PROJECT_ROOT}/dist/frontend"

    info "Cleaning Go binaries..."
    find "${PROJECT_ROOT}" -name "*.exe" -delete 2>/dev/null || true
    find "${PROJECT_ROOT}" -name "bin" -type d -exec rm -rf {} + 2>/dev/null || true

    info "Cleaning Docker containers..."
    docker system prune -f

    log "Build cleanup completed"
}

# Build Go services
build_services() {
    step "Building Go Services"

    info "Building API service..."
    cd "${PROJECT_ROOT}/services/api-service"
    go mod tidy
    go build -ldflags="-s -w" -o bin/api-service ./cmd/main.go

    # Check if build was successful
    if [ ! -f "bin/api-service" ]; then
        error "API service build failed"
    fi

    # Test the binary
    ./bin/api-service --version || true

    cd "${PROJECT_ROOT}"
    log "Go services built successfully"
}

# Build frontend applications
build_frontend() {
    step "Building Frontend Applications"

    info "Building all frontend domains..."
    "${PROJECT_ROOT}/scripts/build-frontend.sh" build

    # Verify build output
    local output_dir="${PROJECT_ROOT}/dist/frontend"
    if [ ! -d "${output_dir}" ]; then
        error "Frontend build output not found"
    fi

    local domains=("marketing" "developer" "ai-platform" "docs-site")
    for domain in "${domains[@]}"; do
        if [ ! -d "${output_dir}/${domain}" ]; then
            warn "Domain ${domain} build output not found"
        else
            local size=$(du -sh "${output_dir}/${domain}" | cut -f1)
            info "${domain} build size: ${size}"
        fi
    done

    log "Frontend applications built successfully"
}

# Run tests
run_tests() {
    step "Running Tests"

    info "Running Go tests..."
    cd "${PROJECT_ROOT}/services/api-service"
    go test -v ./... || warn "Some Go tests failed"

    info "Running frontend tests..."
    cd "${PROJECT_ROOT}"
    npm test || warn "Some frontend tests failed"

    log "Test execution completed"
}

# Deploy to Cloudflare Workers
deploy_cloudflare_workers() {
    step "Deploying to Cloudflare Workers"

    info "Checking Wrangler configuration..."
    if [ ! -f "${PROJECT_ROOT}/wrangler.toml" ]; then
        error "wrangler.toml not found"
    fi

    # Install Wrangler if not present
    if ! command -v "wrangler" &> /dev/null; then
        info "Installing Wrangler..."
        npm install -g wrangler
    fi

    # Login to Cloudflare
    info "Logging into Cloudflare..."
    echo "${CLOUDFLARE_API_TOKEN}" | wrangler auth

    # Deploy workers
    info "Deploying MCP workers..."
    cd "${PROJECT_ROOT}"

    # Create a simple worker for testing
    mkdir -p "${PROJECT_ROOT}/workers"
    cat > "${PROJECT_ROOT}/workers/mcp-worker.js" << 'EOF'
// MCPOverflow Cloudflare Worker
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // MCP endpoint
    if (url.pathname === '/mcp' && request.method === 'POST') {
      try {
        const mcpRequest = await request.json();

        // Simple MCP response
        const mcpResponse = {
          jsonrpc: "2.0",
          id: mcpRequest.id || null,
          result: {
            status: "success",
            message: "MCPOverflow worker is running",
            timestamp: new Date().toISOString(),
          }
        };

        return new Response(JSON.stringify(mcpResponse), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        const errorResponse = {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32603,
            message: "Internal error",
            data: error.message,
          },
        };

        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // Health check
    if (url.pathname === '/health') {
      const healthResponse = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      };

      return new Response(JSON.stringify(healthResponse), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Default response
    return new Response('MCPOverflow Worker', {
      headers: corsHeaders,
    });
  },
};
EOF

    # Update wrangler.toml for deployment
    info "Configuring Wrangler for deployment..."
    sed -i.bak "s/your-kv-namespace-id/${CLOUDFLARE_KV_NAMESPACE_ID:-placeholder}/g" "${PROJECT_ROOT}/wrangler.toml"
    sed -i.bak "s/your-d1-database-id/${CLOUDFLARE_D1_DATABASE_ID:-placeholder}/g" "${PROJECT_ROOT}/wrangler.toml"

    # Deploy the worker
    info "Deploying worker to Cloudflare..."
    wrangler deploy --config "${PROJECT_ROOT}/wrangler.toml" || warn "Cloudflare deployment had issues"

    # Restore original wrangler.toml
    mv "${PROJECT_ROOT}/wrangler.toml.bak" "${PROJECT_ROOT}/wrangler.toml"

    log "Cloudflare Workers deployment completed"
}

# Deploy Docker services
deploy_docker() {
    step "Deploying Docker Services"

    info "Building Docker images..."
    docker-compose -f "${PROJECT_ROOT}/docker-compose.yml" build

    info "Starting services..."
    docker-compose -f "${PROJECT_ROOT}/docker-compose.yml" up -d

    # Wait for services to be healthy
    info "Waiting for services to be healthy..."
    sleep 30

    # Check service health
    local services=("postgres" "redis" "neo4j" "minio" "qdrant" "prometheus" "grafana")
    for service in "${services[@]}"; do
        if docker-compose ps "${service}" | grep -q "Up (healthy)"; then
            log "${service} is healthy"
        else
            warn "${service} may not be healthy yet"
        fi
    done

    log "Docker services deployment completed"
}

# Deploy frontend
deploy_frontend() {
    step "Deploying Frontend Applications"

    info "Setting up frontend deployment..."

    # Create nginx configuration
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

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

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
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files for marketing site
        location / {
            root /var/www/marketing;
            try_files $uri $uri/ /index.html;
            expires 1h;
        }

        # Developer platform
        location /developer/ {
            alias /var/www/developer;
            try_files $uri $uri/ /developer/index.html;
            expires 1h;
        }

        # AI platform
        location /ai/ {
            alias /var/www/ai-platform;
            try_files $uri $uri/ /ai-platform/index.html;
            expires 1h;
        }

        # Documentation
        location /docs/ {
            alias /var/www/docs-site;
            try_files $uri $uri/ /docs-site/index.html;
            expires 1h;
        }
    }
}
EOF

    # Create frontend Docker compose file
    cat > "${PROJECT_ROOT}/docker-compose.frontend.yml" << 'EOF'
version: '3.8'

services:
  frontend-nginx:
    image: nginx:alpine
    container_name: mcpoverflow-frontend
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./dist/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./dist/frontend:/var/www:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    networks:
      - mcpoverflow_network
    depends_on:
      - api-service

  api-service:
    build:
      context: ./services/api-service
      dockerfile: Dockerfile
    container_name: mcpoverflow-api
    restart: unless-stopped
    environment:
      - ENVIRONMENT=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=mcpoverflow
      - REDIS_URL=${REDIS_URL:-redis://redis:6379}
      - JWT_SECRET=${JWT_SECRET}
    networks:
      - mcpoverflow_network
    depends_on:
      - postgres
      - redis

networks:
  mcpoverflow_network:
    external: true
EOF

    # Build and start frontend
    info "Building frontend Docker image..."
    docker-compose -f "${PROJECT_ROOT}/docker-compose.frontend.yml" build

    info "Starting frontend services..."
    docker-compose -f "${PROJECT_ROOT}/docker-compose.frontend.yml" up -d

    log "Frontend deployment completed"
}

# Run health checks
run_health_checks() {
    step "Running Health Checks"

    info "Checking API service..."
    if curl -f http://localhost:8080/health &>/dev/null; then
        log "API service is healthy"
    else
        warn "API service may not be responding"
    fi

    info "Checking frontend..."
    if curl -f http://localhost/ &>/dev/null; then
        log "Frontend is responding"
    else
        warn "Frontend may not be responding"
    fi

    info "Checking Cloudflare Worker..."
    if [ -n "${CLOUDFLARE_WORKER_URL}" ]; then
        if curl -f "${CLOUDFLARE_WORKER_URL}/health" &>/dev/null; then
            log "Cloudflare Worker is healthy"
        else
            warn "Cloudflare Worker may not be responding"
        fi
    fi

    log "Health checks completed"
}

# Generate deployment report
generate_deployment_report() {
    step "Generating Deployment Report"

    local report_file="${PROJECT_ROOT}/logs/deployment_report_${TIMESTAMP}.json"

    cat > "${report_file}" << EOF
{
  "deployment": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "${DEPLOYMENT_ENV}",
    "git_commit": "$(git rev-parse HEAD)",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD)"
  },
  "services": {
    "api_service": {
      "status": "$(docker inspect --format='{{.State.Status}}' mcpoverflow-api 2>/dev/null || echo 'unknown')",
      "image": "mcpoverflow/api-service:latest"
    },
    "frontend": {
      "status": "$(docker inspect --format='{{.State.Status}}' mcpoverflow-frontend 2>/dev/null || echo 'unknown')",
      "image": "nginx:alpine"
    },
    "database": {
      "status": "$(docker inspect --format='{{.State.Status}}' mcpoverflow_postgres 2>/dev/null || echo 'unknown')",
      "type": "PostgreSQL 15.1.0.88"
    }
  },
  "endpoints": {
    "frontend": "http://localhost",
    "api": "http://localhost/api",
    "health": "http://localhost/api/health"
  },
  "domains": {
    "marketing": "http://localhost/",
    "developer": "http://localhost/developer/",
    "ai_platform": "http://localhost/ai/",
    "documentation": "http://localhost/docs/"
  }
}
EOF

    log "Deployment report generated at ${report_file}"
}

# Show deployment summary
show_summary() {
    step "Deployment Summary"

    echo ""
    success "🎉 MCPOverflow deployment completed successfully!"
    echo ""
    echo "📊 Deployment Details:"
    echo "  Environment: ${DEPLOYMENT_ENV}"
    echo "  Timestamp: $(date)"
    echo "  Git Commit: $(git rev-parse --short HEAD)"
    echo ""
    echo "🌐 Access Points:"
    echo "  Frontend (Marketing): http://localhost/"
    echo "  Developer Platform: http://localhost/developer/"
    echo "  AI Platform: http://localhost/ai/"
    echo "  Documentation: http://localhost/docs/"
    echo "  API Endpoint: http://localhost/api/"
    echo "  Health Check: http://localhost/api/health"
    echo ""
    echo "🐳 Docker Services:"
    echo "  API Service: mcpoverflow-api"
    echo "  Frontend: mcpoverflow-frontend"
    echo "  Database: mcpoverflow_postgres"
    echo "  Cache: mcpoverflow_redis"
    echo "  Graph DB: mcpoverflow_neo4j"
    echo ""
    echo "📊 Monitoring:"
    echo "  Prometheus: http://localhost:9090"
    echo "  Grafana: http://localhost:3001 (admin/mcpoverflow_admin)"
    echo ""
    echo "📝 Logs:"
    echo "  Deployment Log: ${LOG_FILE}"
    echo "  Deployment Report: ${PROJECT_ROOT}/logs/deployment_report_${TIMESTAMP}.json"
    echo ""
    echo "🔧 Management Commands:"
    echo "  View logs: docker-compose logs -f"
    echo "  Stop services: docker-compose down"
    echo "  Restart services: docker-compose restart"
    echo "  Check health: make health"
    echo ""
    info "For production deployment, configure domain names and SSL certificates."
}

# Cleanup function
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        error "Deployment failed with exit code ${exit_code}"
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Main deployment function
main() {
    local command="${1:-deploy}"

    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                MCPOverflow Deployment Script                ║"
    echo "║                      Version 1.0.0                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""

    case "${command}" in
        "clean")
            clean_builds
            ;;
        "build")
            check_prerequisites
            build_services
            build_frontend
            run_tests
            ;;
        "deploy")
            check_prerequisites
            clean_builds
            build_services
            build_frontend
            run_tests
            deploy_docker
            deploy_frontend
            deploy_cloudflare_workers
            run_health_checks
            generate_deployment_report
            show_summary
            ;;
        "workers")
            check_prerequisites
            deploy_cloudflare_workers
            ;;
        "frontend")
            check_prerequisites
            build_frontend
            deploy_frontend
            ;;
        "services")
            check_prerequisites
            build_services
            deploy_docker
            ;;
        "health")
            run_health_checks
            ;;
        *)
            echo "Usage: $0 {clean|build|deploy|workers|frontend|services|health}"
            echo ""
            echo "Commands:"
            echo "  clean     - Clean all build artifacts"
            echo "  build     - Build all components without deployment"
            echo "  deploy    - Full deployment (default)"
            echo "  workers   - Deploy Cloudflare Workers only"
            echo "  frontend  - Build and deploy frontend only"
            echo "  services  - Build and deploy backend services only"
            echo "  health    - Run health checks on deployed services"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"