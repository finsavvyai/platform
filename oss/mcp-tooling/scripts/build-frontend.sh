#!/bin/bash

# Multi-Domain Frontend Build Script
# This script builds all frontend applications for MCPOverflow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPS_DIR="${PROJECT_ROOT}/apps"
PACKAGES_DIR="${PROJECT_ROOT}/packages"
OUTPUT_DIR="${PROJECT_ROOT}/dist/frontend"
LOGS_DIR="${PROJECT_ROOT}/logs/build"

# Domain configurations
DOMAINS=(
    "marketing:3000"
    "developer:3001"
    "ai:3002"
    "docs:3003"
)

# Logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Create necessary directories
create_directories() {
    log "Creating build directories..."
    mkdir -p "${OUTPUT_DIR}"
    mkdir -p "${LOGS_DIR}"
    mkdir -p "${PROJECT_ROOT}/logs"
    mkdir -p "${APPS_DIR}/marketing/.next"
    mkdir -p "${APPS_DIR}/dev-platform/.next"
    mkdir -p "${APPS_DIR}/ai-platform/.next"
    mkdir -p "${APPS_DIR}/docs-site/.next"
}

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi

    # Check if in project root
    if [ ! -f "${PROJECT_ROOT}/package.json" ]; then
        error "Not in MCPOverflow project root"
    fi

    log "Dependencies check passed"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."

    cd "${PROJECT_ROOT}"

    # Install root dependencies
    info "Installing root dependencies..."
    npm install

    # Build packages first
    info "Building shared packages..."
    npm run build --workspaces --if-present

    # Install app dependencies
    for domain_config in "${DOMAINS[@]}"; do
        domain="${domain_config%%:*}"
        app_path="${APPS_DIR}/${domain}"

        if [ -d "${app_path}" ]; then
            info "Installing dependencies for ${domain}..."
            cd "${app_path}"
            npm install
            cd "${PROJECT_ROOT}"
        fi
    done
}

# Build shared packages
build_packages() {
    log "Building shared packages..."

    # Build frontend-config
    if [ -d "${PACKAGES_DIR}/frontend-config" ]; then
        info "Building frontend-config..."
        cd "${PACKAGES_DIR}/frontend-config"
        npm run build
        cd "${PROJECT_ROOT}"
    fi

    # Build frontend-hooks
    if [ -d "${PACKAGES_DIR}/frontend-hooks" ]; then
        info "Building frontend-hooks..."
        cd "${PACKAGES_DIR}/frontend-hooks"
        npm run build
        cd "${PROJECT_ROOT}"
    fi

    # Build UI components
    if [ -d "${PACKAGES_DIR}/ui" ]; then
        info "Building UI components..."
        cd "${PACKAGES_DIR}/ui"
        npm run build
        cd "${PROJECT_ROOT}"
    fi
}

# Build individual domain
build_domain() {
    local domain="$1"
    local port="$2"
    local app_path="${APPS_DIR}/${domain}"
    local build_log="${LOGS_DIR}/${domain}-build.log"
    local export_flag=""

    log "Building ${domain} (port ${port})..."

    if [ ! -d "${app_path}" ]; then
        warn "Domain ${domain} not found at ${app_path}"
        return 1
    fi

    cd "${app_path}"

    # Check if domain supports export (marketing)
    if [ "${domain}" = "marketing" ] || [ "${domain}" = "docs-site" ]; then
        export_flag=":export"
    fi

    # Run build with logging
    info "Running: npm run build${export_flag}"
    npm run build${export_flag} > "${build_log}" 2>&1 || {
        error "Failed to build ${domain}. Check ${build_log}"
    }

    # Copy build output to distribution directory
    local dist_dir="${OUTPUT_DIR}/${domain}"
    mkdir -p "${dist_dir}"

    if [ -d "out" ]; then
        info "Copying build output for ${domain}..."
        cp -r "out"/* "${dist_dir}/"
    elif [ -d ".next" ]; then
        info "Copying .next for ${domain}..."
        cp -r ".next" "${dist_dir}/"
    fi

    # Copy public files
    if [ -d "public" ]; then
        cp -r "public" "${dist_dir}/"
    fi

    # Copy package.json for standalone builds
    if [ -f "package.json" ]; then
        cp "package.json" "${dist_dir}/"
    fi

    info "${domain} built successfully"
    cd "${PROJECT_ROOT}"
}

# Build all domains
build_all_domains() {
    log "Building all domains..."

    local failed_builds=()

    for domain_config in "${DOMAINS[@]}"; do
        domain="${domain_config%%:*}"
        port="${domain_config##*:}"

        if build_domain "${domain}" "${port}"; then
            info "✓ ${domain} built successfully"
        else
            error "✗ ${domain} build failed"
            failed_builds+=("${domain}")
        fi
    done

    if [ ${#failed_builds[@]} -gt 0 ]; then
        error "Failed to build domains: ${failed_builds[*]}"
    fi
}

# Generate build manifest
generate_manifest() {
    log "Generating build manifest..."

    local manifest_file="${OUTPUT_DIR}/build-manifest.json"

    cat > "${manifest_file}" << EOF
{
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "version": "$(node -p "require('./package.json').version")",
  "domains": {
EOF

    for domain_config in "${DOMAINS[@]}"; do
        domain="${domain_config%%:*}"
        port="${domain_config##*:}"

        if [ -d "${OUTPUT_DIR}/${domain}" ]; then
            local build_size=$(du -sh "${OUTPUT_DIR}/${domain}" | cut -f1)
            cat >> "${manifest_file}" << EOF
    "${domain}": {
      "port": ${port},
      "buildSize": "${build_size}",
      "buildPath": "${OUTPUT_DIR}/${domain}",
      "built": true
    }
EOF

            # Add comma if not last domain
            if [ "${domain}" != "docs-site" ]; then
                echo "," >> "${manifest_file}"
            else
                echo "" >> "${manifest_file}"
            fi
        else
            cat >> "${manifest_file}" << EOF
    "${domain}": {
      "port": ${port},
      "built": false
    }
EOF

            # Add comma if not last domain
            if [ "${domain}" != "docs-site" ]; then
                echo "," >> "${manifest_file}"
            else
                echo "" >> "${manifest_file}"
            fi
        fi
    done

    cat >> "${manifest_file}" << EOF
  },
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)"
}
EOF

    info "Build manifest generated at ${manifest_file}"
}

# Generate deployment configuration
generate_deployment_config() {
    log "Generating deployment configuration..."

    local deploy_config="${OUTPUT_DIR}/deployment.json"

    cat > "${deploy_config}" << EOF
{
  "deployment": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "${NODE_ENV:-production}",
    "domains": [
EOF

    for domain_config in "${DOMAINS[@]}"; do
        domain="${domain_config%%:*}"
        port="${domain_config##*:}"

        cat >> "${deploy_config}" << EOF
      {
        "name": "${domain}",
        "domain": "${domain}.mcpoverflow.com",
        "port": ${port},
        "buildPath": "${OUTPUT_DIR}/${domain}",
        "static": $([ "${domain}" = "marketing" ] && echo "true" || echo "false")
      }
EOF

        # Add comma if not last domain
        if [ "${domain}" != "docs-site" ]; then
            echo "," >> "${deploy_config}"
        else
            echo "" >> "${deploy_config}"
        fi
    done

    cat >> "${deploy_config}" << EOF
    ]
  },
  "nginx": {
    "configPath": "${OUTPUT_DIR}/nginx",
    "sslPath": "/etc/ssl/certs",
    "staticPath": "/var/www"
  },
  "docker": {
    "composeFile": "${PROJECT_ROOT}/docker-compose.frontend.yml",
    "imageName": "mcpoverflow/frontend"
  }
}
EOF

    info "Deployment configuration generated at ${deploy_config}"
}

# Create Docker Compose file for frontend
create_docker_compose() {
    log "Creating Docker Compose configuration..."

    local compose_file="${PROJECT_ROOT}/docker-compose.frontend.yml"

    cat > "${compose_file}" << EOF
version: '3.8'

services:
EOF

    for domain_config in "${DOMAINS[@]}"; do
        domain="${domain_config%%:*}"
        port="${domain_config##*:}"

        cat >> "${compose_file}" << EOF
  ${domain}-frontend:
    build:
      context: ./apps/${domain}
      dockerfile: Dockerfile
    container_name: mcpoverflow-${domain}
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_DOMAIN_TYPE=${domain}
      - NEXT_PUBLIC_API_URL=\${API_URL:-https://api.mcpoverflow.com}
      - NEXT_PUBLIC_ANALYTICS_ID=\${ANALYTICS_ID}
    volumes:
      - ${OUTPUT_DIR}/${domain}:/app/.next
      - ${OUTPUT_DIR}/${domain}/public:/app/public
    networks:
      - mcpoverflow-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${domain}.rule=Host(\`${domain}.mcpoverflow.com\`) || Host(\`www.${domain}.mcpoverflow.com\`) || Host(\`mcpoverflow.com\`) && PathPrefix(\`/${domain}\`)"
      - "traefik.http.routers.${domain}.entrypoints=websecure"
      - "traefik.http.routers.${domain}.tls.certresolver=letsencrypt"
      - "traefik.http.services.${domain}.loadbalancer.server.port=3000"
      - "traefik.http.middlewares.${domain}.compress=true"

EOF
    done

    cat >> "${compose_file}" << EOF
  nginx-frontend:
    image: nginx:alpine
    container_name: mcpoverflow-frontend-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx-frontend.conf:/etc/nginx/nginx.conf:ro
      - ${OUTPUT_DIR}:/var/www:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
EOF

    for domain_config in "${DOMAINS[@]}"; do
        domain="${domain_config%%:*}"
        cat >> "${compose_file}" << EOF
      - ${domain}-frontend
EOF
    done

    cat >> "${compose_file}" << EOF
    networks:
      - mcpoverflow-network

networks:
  mcpoverflow-network:
    external: true
EOF

    info "Docker Compose file created at ${compose_file}"
}

# Clean build artifacts
clean() {
    log "Cleaning build artifacts..."

    # Remove output directory
    rm -rf "${OUTPUT_DIR}"

    # Remove build logs
    rm -f "${LOGS_DIR}"/*-build.log

    # Clean .next directories
    for domain_config in "${DOMAINS[@]}"; do
        domain="${domain_config%%:*}"
        app_path="${APPS_DIR}/${domain}"

        if [ -d "${app_path}/.next" ]; then
            rm -rf "${app_path}/.next"
        fi

        if [ -d "${app_path}/out" ]; then
            rm -rf "${app_path}/out"
        fi
    done

    # Clean package build outputs
    for package_dir in "${PACKAGES_DIR}"/*; do
        if [ -d "${package_dir}/dist" ]; then
            rm -rf "${package_dir}/dist"
        fi
    done

    log "Clean completed"
}

# Show build summary
show_summary() {
    log "Build Summary"
    echo "================================"
    echo "Build Time: $(date)"
    echo "Output Directory: ${OUTPUT_DIR}"
    echo ""

    echo "Domains Built:"
    for domain_config in "${DOMAINS[@]}"; do
        domain="${domain_config%%:*}"
        port="${domain_config##*:}"

        if [ -d "${OUTPUT_DIR}/${domain}" ]; then
            local build_size=$(du -sh "${OUTPUT_DIR}/${domain}" | cut -f1)
            echo "  ✓ ${domain} (port ${port}) - ${build_size}"
        else
            echo "  ✗ ${domain} (port ${port}) - Build failed"
        fi
    done

    echo ""
    echo "Next Steps:"
    echo "1. Review build artifacts in ${OUTPUT_DIR}"
    echo "2. Check deployment configuration"
    echo "3. Run deployment: docker-compose -f docker-compose.frontend.yml up -d"
    echo "4. Monitor logs: docker-compose -f docker-compose.frontend.yml logs -f"
}

# Main build function
main() {
    local mode="${1:-build}"

    case "${mode}" in
        "clean")
            clean
            ;;
        "deps")
            check_dependencies
            install_dependencies
            ;;
        "packages")
            build_packages
            ;;
        "domain")
            if [ -z "$2" ]; then
                error "Domain name required for domain build"
            fi
            create_directories
            check_dependencies
            build_domain "$2" "$3"
            ;;
        "build")
            create_directories
            check_dependencies
            install_dependencies
            build_packages
            build_all_domains
            generate_manifest
            generate_deployment_config
            create_docker_compose
            show_summary
            ;;
        "dev")
            info "Starting development servers..."
            # Start development servers for all domains
            for domain_config in "${DOMAINS[@]}"; do
                domain="${domain_config%%:*}"
                port="${domain_config##*:}"
                app_path="${APPS_DIR}/${domain}"

                if [ -d "${app_path}" ]; then
                    info "Starting ${domain} development server on port ${port}..."
                    cd "${app_path}"
                    npm run dev -- --port ${port} &
                    cd "${PROJECT_ROOT}"
                fi
            done
            info "All development servers started. Use Ctrl+C to stop."
            wait
            ;;
        *)
            echo "Usage: $0 {clean|deps|packages|domain <name> <port>|build|dev}"
            echo ""
            echo "Commands:"
            echo "  clean      - Clean all build artifacts"
            echo "  deps       - Install all dependencies"
            echo "  packages   - Build shared packages only"
            echo "  domain     - Build specific domain"
            echo "  build      - Build all domains (default)"
            echo "  dev        - Start development servers"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"