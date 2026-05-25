#!/bin/bash

# MCPOverflow Marketing Frontend Deployment Script
# Deploys only the marketing website to work around dependency issues

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
echo "║         MCPOverflow Marketing Frontend Deployment            ║"
echo "║                      Version 1.0.0                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/dist/marketing"
DOCKER_IMAGE="mcpoverflow-marketing"
DOCKER_TAG="latest"
CONTAINER_NAME="mcpoverflow-marketing"

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

# Build marketing app only
build_marketing_app() {
    print_info "Building marketing application..."

    cd "$PROJECT_ROOT"

    # Clean previous builds
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"

    # Try to build the marketing app, but fall back to static HTML if it fails
    cd apps/marketing

    print_info "Attempting to build marketing app..."
    local build_success=false

    # Install dependencies (skip optional dependencies)
    if npm install --no-optional 2>/dev/null; then
        # Build the app
        if npm run build 2>/dev/null; then
            # Copy built files to our dist directory
            if [ -d "out" ]; then
                cp -r out/* "$BUILD_DIR/" 2>/dev/null
                print_status "Marketing application built successfully"
                build_success=true
            elif [ -d ".next" ]; then
                cp -r .next/* "$BUILD_DIR/" 2>/dev/null
                print_status "Marketing application built successfully"
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
        print_status "Will use static HTML fallback for marketing site"
    fi
}

# Create Nginx configuration
create_nginx_config() {
    print_info "Creating Nginx configuration..."

    cat > "$BUILD_DIR/nginx.conf" << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

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
        try_files $uri =404;
    }

    # Handle Next.js routes
    location / {
        try_files $uri $uri.html $uri/ /index.html;
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

# Create static HTML for marketing site
create_static_html() {
    print_info "Creating static HTML marketing site..."

    # Create a simple but professional marketing page
    cat > "$BUILD_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCPOverflow - AI-Powered MCP Connector Platform</title>
    <meta name="description" content="Generate and deploy Model Context Protocol (MCP) connectors from any API specification. Powered by AI for seamless agent integration.">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        .gradient { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .glass { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Header -->
    <header class="fixed top-0 w-full z-50 glass">
        <nav class="container mx-auto px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <div class="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg"></div>
                    <span class="text-xl font-bold text-gray-800">MCPOverflow</span>
                </div>
                <div class="hidden md:flex space-x-6">
                    <a href="#features" class="text-gray-600 hover:text-gray-900">Features</a>
                    <a href="#how-it-works" class="text-gray-600 hover:text-gray-900">How It Works</a>
                    <a href="#pricing" class="text-gray-600 hover:text-gray-900">Pricing</a>
                    <a href="https://app.mcpoverflow.io" class="btn btn-primary">Get Started</a>
                </div>
            </div>
        </nav>
    </header>

    <!-- Hero -->
    <section class="pt-32 pb-20 px-6">
        <div class="container mx-auto text-center">
            <div class="inline-flex items-center bg-blue-100 text-blue-800 rounded-full px-4 py-2 mb-6">
                <span class="text-sm font-medium">🚀 Now in Public Beta</span>
            </div>
            <h1 class="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                Generate MCP Connectors<br>
                <span class="gradient bg-clip-text text-transparent">with AI Power</span>
            </h1>
            <p class="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Transform any API specification into fully functional Model Context Protocol connectors.
                Deploy to Cloudflare Workers, Vercel Edge Functions, and more. Enhanced with OpenAI AgentKit integration.
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="https://app.mcpoverflow.io" class="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    Start Building Free</a>
                <a href="#demo" class="px-8 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                    Watch Demo
                </a>
            </div>
        </div>
    </section>

    <!-- Features -->
    <section id="features" class="py-20 bg-white">
        <div class="container mx-auto px-6">
            <div class="text-center mb-16">
                <h2 class="text-3xl font-bold text-gray-900 mb-4">Powerful Features</h2>
                <p class="text-xl text-gray-600">Everything you need to build and deploy MCP connectors</p>
            </div>
            <div class="grid md:grid-cols-3 gap-8">
                <div class="card">
                    <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                        <span class="text-2xl">📋</span>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Multi-Format Support</h3>
                    <p class="text-gray-600">OpenAPI, GraphQL schemas, and Postman collections - convert any API spec to MCP format</p>
                </div>
                <div class="card">
                    <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                        <span class="text-2xl">🤖</span>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">AgentKit Integration</h3>
                    <p class="text-gray-600">Built-in OpenAI AgentKit support for autonomous AI agent deployment</p>
                </div>
                <div class="card">
                    <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                        <span class="text-2xl">⚡</span>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Edge Deployment</h3>
                    <p class="text-gray-600">Deploy to Cloudflare Workers, Vercel Edge, AWS Lambda with one click</p>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA -->
    <section class="py-20 gradient">
        <div class="container mx-auto px-6 text-center">
            <h2 class="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
            <p class="text-xl text-white/90 mb-8">Join thousands of developers building the next generation of AI agents</p>
            <a href="https://app.mcpoverflow.io" class="px-8 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition font-semibold">
                Start Building Free
            </a>
        </div>
    </section>

    <!-- Footer -->
    <footer class="py-12 bg-gray-900">
        <div class="container mx-auto px-6">
            <div class="flex flex-col md:flex-row justify-between items-center">
                <div class="flex items-center space-x-2 mb-4 md:mb-0">
                    <div class="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded"></div>
                    <span class="text-white font-semibold">MCPOverflow</span>
                </div>
                <p class="text-gray-400 text-sm">© 2024 MCPOverflow. All rights reserved.</p>
            </div>
        </div>
    </footer>

    <script>
        // Simple interactions
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            });
        });
    </script>
</body>
</html>
EOF

    print_status "Static HTML marketing site created"
}

# Create Dockerfile for marketing site
create_dockerfile() {
    print_info "Creating Dockerfile for marketing site..."

    cat > "$BUILD_DIR/Dockerfile" << 'EOF'
FROM nginx:alpine

# Copy built static files
COPY . /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

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
        -p 80:80 \
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
        if curl -f http://localhost/health &>/dev/null; then
            print_status "Marketing site is healthy and accessible"
            print_status "✅ Marketing site deployed successfully!"
            print_status "🌐 Available at: http://localhost"
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
    print_info "Starting MCPOverflow marketing frontend deployment..."

    # Set up cleanup trap
    trap cleanup EXIT

    # Run deployment steps
    check_prerequisites
    build_marketing_app
    create_static_html
    create_nginx_config
    create_dockerfile
    build_docker_image
    deploy_container
    health_check

    print_status "Marketing frontend deployment completed successfully! 🎉"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "build")
        check_prerequisites
        create_static_html
        create_nginx_config
        create_dockerfile
        build_docker_image
        print_status "Build completed. Run '$0 deploy' to deploy."
        ;;
    "stop")
        print_info "Stopping marketing site..."
        if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            docker stop "$CONTAINER_NAME"
            print_status "Marketing site stopped"
        else
            print_info "Marketing site is not running"
        fi
        ;;
    "restart")
        print_info "Restarting marketing site..."
        if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            docker restart "$CONTAINER_NAME"
            print_status "Marketing site restarted"
            health_check
        else
            print_info "Marketing site is not running. Deploying..."
            main
        fi
        ;;
    "status")
        if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            print_status "Marketing site is running"
            print_status "🌐 Available at: http://localhost"
        else
            print_warning "Marketing site is not running"
        fi
        ;;
    "logs")
        if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            docker logs -f "$CONTAINER_NAME"
        else
            print_error "Marketing site is not running"
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
        echo "  deploy   - Build and deploy the marketing site (default)"
        echo "  build    - Build Docker image without deploying"
        echo "  stop     - Stop the marketing site"
        echo "  restart  - Restart the marketing site"
        echo "  status   - Check if marketing site is running"
        echo "  logs     - Show container logs"
        echo "  cleanup  - Remove all deployment artifacts"
        exit 1
        ;;
esac