#!/bin/bash

# Questro Main Deployment Script
# Interactive deployment with multiple options

set -e

echo "🚀 Questro Deployment Manager"
echo "============================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
step() { echo -e "${PURPLE}[STEP]${NC} $1"; }
option() { echo -e "${CYAN}[OPTION]${NC} $1"; }

# Configuration
DEPLOYMENT_ID=$(date +%Y%m%d_%H%M%S)
DEPLOYMENT_LOG="deployment-${DEPLOYMENT_ID}.log"

# Log function that also writes to file
log_to_file() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DEPLOYMENT_LOG"
}

# Preflight checks
preflight_checks() {
    step "Running preflight checks..."
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]]; then
        error "Please run this script from the Questro project root directory"
        exit 1
    fi
    
    # Check required directories
    local missing_dirs=()
    [[ ! -d "questro-io" ]] && missing_dirs+=("questro-io")
    [[ ! -d "questro-app" ]] && missing_dirs+=("questro-app")
    [[ ! -d "backend" ]] && missing_dirs+=("backend")
    
    if [[ ${#missing_dirs[@]} -gt 0 ]]; then
        error "Missing required directories: ${missing_dirs[*]}"
        exit 1
    fi
    
    # Check Node.js and npm
    if ! command -v node &> /dev/null; then
        error "Node.js not installed. Please install Node.js first."
        echo "Install with: brew install node (macOS) or download from nodejs.org"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        error "npm not installed"
        exit 1
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        error "Git not installed"
        exit 1
    fi
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "Not in a git repository"
        exit 1
    fi
    
    success "Preflight checks passed"
    log_to_file "Preflight checks completed successfully"
}

# Build component
build_component() {
    local component=$1
    local component_name=$2
    
    step "Building $component_name..."
    
    cd $component
    
    # Clean previous build
    if [[ -d "dist" ]]; then
        rm -rf dist
        log "Cleaned previous build"
    fi
    
    # Install dependencies
    log "Installing dependencies..."
    npm install
    
    # Build the component
    log "Building for production..."
    npm run build
    
    # Verify build
    if [[ ! -d "dist" ]]; then
        error "Build failed - dist directory not found"
        exit 1
    fi
    
    local build_size=$(du -sh dist | cut -f1)
    success "$component_name built successfully (${build_size})"
    
    cd ..
    log_to_file "$component_name build completed"
}

# Deploy to Render
deploy_to_render() {
    local component=$1
    local config_file=$2
    local service_name=$3
    
    step "Deploying $service_name to Render..."
    
    # Check if config file exists
    if [[ ! -f "$config_file" ]]; then
        error "Configuration file $config_file not found"
        exit 1
    fi
    
    # Copy the specific config to render.yaml for this deployment
    cp "$config_file" render.yaml
    
    # Commit and push changes
    git add .
    git commit -m "Deploy $service_name to Render

- Using configuration: $config_file
- Service: $service_name
- Component: $component

🚀 Render deployment $DEPLOYMENT_ID" || true
    
    git push origin main
    
    # Restore the original render.yaml if it exists
    if [[ -f "render.yaml.backup" ]]; then
        mv render.yaml.backup render.yaml
    fi
    
    success "Pushed to repository. Render will auto-deploy $service_name."
    log_to_file "Render deployment initiated for $service_name"
}

# Deploy to Netlify
deploy_to_netlify() {
    local component=$1
    local service_name=$2
    
    step "Deploying $service_name to Netlify..."
    
    # Check if Netlify CLI is installed
    if ! command -v netlify &> /dev/null; then
        log "Installing Netlify CLI..."
        npm install -g netlify-cli
    fi
    
    cd $component
    
    # Create netlify.toml if it doesn't exist
    if [[ ! -f "netlify.toml" ]]; then
        cat > netlify.toml << EOF
[build]
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
EOF
    fi
    
    # Deploy to Netlify
    log "Deploying to Netlify..."
    netlify deploy --prod --dir=dist --message="$service_name deployment $DEPLOYMENT_ID"
    
    success "Deployed $service_name to Netlify!"
    warn "Configure custom domain in Netlify dashboard"
    
    cd ..
    log_to_file "Netlify deployment completed for $service_name"
}

# Deploy to Vercel
deploy_to_vercel() {
    local component=$1
    local service_name=$2
    
    step "Deploying $service_name to Vercel..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        log "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    cd $component
    
    # Create vercel.json if it doesn't exist
    if [[ ! -f "vercel.json" ]]; then
        cat > vercel.json << EOF
{
  "name": "$service_name",
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/\$1"
    }
  ]
}
EOF
    fi
    
    # Deploy to Vercel
    vercel --prod --confirm
    
    success "Deployed $service_name to Vercel!"
    warn "Configure custom domain in Vercel dashboard"
    
    cd ..
    log_to_file "Vercel deployment completed for $service_name"
}

# Deploy to Railway
deploy_to_railway() {
    local component=$1
    local service_name=$2
    
    step "Deploying $service_name to Railway..."
    
    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
        log "Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    cd $component
    
    # Create railway.json if it doesn't exist
    if [[ ! -f "railway.json" ]]; then
        cat > railway.json << EOF
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF
    fi
    
    # Login to Railway
    log "Logging into Railway..."
    railway login
    
    # Deploy to Railway
    log "Deploying to Railway..."
    railway up --service $service_name
    
    success "Deployed $service_name to Railway!"
    warn "Configure environment variables in Railway dashboard"
    
    cd ..
    log_to_file "Railway deployment completed for $service_name"
}

# Deploy component with platform choice
deploy_component() {
    local component=$1
    local component_name=$2
    local service_name=$3
    local config_file=$4
    
    echo ""
    option "Deploying $component_name"
    echo "1. Render (Recommended)"
    echo "2. Netlify"
    echo "3. Vercel"
    echo "4. Railway (Backend only)"
    echo "5. Skip this component"
    
    read -p "Choose platform for $component_name (1-5): " platform_choice
    
    case $platform_choice in
        1)
            build_component $component $component_name
            deploy_to_render $component $config_file $service_name
            ;;
        2)
            build_component $component $component_name
            deploy_to_netlify $component $service_name
            ;;
        3)
            build_component $component $component_name
            deploy_to_vercel $component $service_name
            ;;
        4)
            if [[ "$component" == "backend" ]]; then
                build_component $component $component_name
                deploy_to_railway $component $service_name
            else
                error "Railway is only available for backend deployment"
                deploy_component $component $component_name $service_name $config_file
            fi
            ;;
        5)
            log "Skipping $component_name deployment"
            ;;
        *)
            error "Invalid choice. Please run the script again."
            exit 1
            ;;
    esac
}

# Deploy all components together
deploy_all_together() {
    step "Deploying all components together..."
    
    # Build all components
    build_component "questro-io" "Questro.io Marketing Site"
    build_component "questro-app" "Questro.app Product Site"
    build_component "backend" "Backend API"
    
    # Use the main render.yaml for full-stack deployment
    if [[ ! -f "render.yaml" ]]; then
        error "render.yaml not found for full-stack deployment"
        exit 1
    fi
    
    # Commit and push changes
    git add .
    git commit -m "Full-stack Questro deployment

- Questro.io marketing site
- Questro.app product site  
- Backend API with database
- Complete infrastructure

🚀 Full-stack deployment $DEPLOYMENT_ID" || true
    
    git push origin main
    
    success "Pushed to repository. Render will auto-deploy all services."
    log_to_file "Full-stack deployment initiated"
}

# Generate deployment report
generate_report() {
    step "Generating deployment report..."
    
    cat > questro-deployment-report-${DEPLOYMENT_ID}.md << EOF
# Questro Deployment Report

**Deployment ID:** ${DEPLOYMENT_ID}
**Deployment Date:** $(date)
**Deployment Type:** Interactive

## Components Deployed

### 🏢 Questro.io (Marketing Site)
- **Status:** $(if [[ -d "questro-io/dist" ]]; then echo "✅ Built"; else echo "❌ Not built"; fi)
- **Build Size:** $(if [[ -d "questro-io/dist" ]]; then du -sh questro-io/dist | cut -f1; else echo "N/A"; fi)
- **Configuration:** render-questro-io.yaml

### 🚀 Questro.app (Product Site)
- **Status:** $(if [[ -d "questro-app/dist" ]]; then echo "✅ Built"; else echo "❌ Not built"; fi)
- **Build Size:** $(if [[ -d "questro-app/dist" ]]; then du -sh questro-app/dist | cut -f1; else echo "N/A"; fi)
- **Configuration:** render-questro-app.yaml

### 🔧 Backend API
- **Status:** $(if [[ -d "backend/dist" ]]; then echo "✅ Built"; else echo "❌ Not built"; fi)
- **Build Size:** $(if [[ -d "backend/dist" ]]; then du -sh backend/dist | cut -f1; else echo "N/A"; fi)
- **Configuration:** render-backend.yaml

## Deployment Summary

✅ **Preflight Checks:** Completed
✅ **Git Status:** Committed and pushed
✅ **Deployment Log:** ${DEPLOYMENT_LOG}

## Next Steps

1. **Configure DNS** in Namecheap for all domains
2. **Set up SSL certificates** for HTTPS
3. **Configure environment variables** in hosting platforms
4. **Set up monitoring and logging**
5. **Test all endpoints and functionality**

## Configuration Files

- **Full-stack:** render.yaml
- **Marketing site:** render-questro-io.yaml
- **Product site:** render-questro-app.yaml
- **Backend API:** render-backend.yaml

## Support

- **Deployment Log:** ${DEPLOYMENT_LOG}
- **Documentation:** docs/SEPARATE_DEPLOYMENT_GUIDE.md
- **Configuration Guide:** docs/WEBSITE_CONFIGURATION_GUIDE.md

---
Generated by Questro deployment automation
EOF

    success "Deployment report generated: questro-deployment-report-${DEPLOYMENT_ID}.md"
    log_to_file "Deployment report generated"
}

# Main menu
main_menu() {
    echo ""
    echo "🎯 Questro Deployment Options:"
    echo "1. Deploy All Components Together (Full-stack)"
    echo "2. Deploy Components Separately (Choose each)"
    echo "3. Deploy questro.io only (Marketing site)"
    echo "4. Deploy questro.app only (Product site)"
    echo "5. Deploy backend only (API)"
    echo "6. Build All Components (No deployment)"
    echo "7. Exit"
    
    read -p "Enter your choice (1-7): " choice
    
    case $choice in
        1)
            deploy_all_together
            ;;
        2)
            deploy_component "questro-io" "Questro.io Marketing Site" "questro-io-marketing" "render-questro-io.yaml"
            deploy_component "questro-app" "Questro.app Product Site" "questro-app-product" "render-questro-app.yaml"
            deploy_component "backend" "Backend API" "questro-backend-api" "render-backend.yaml"
            ;;
        3)
            deploy_component "questro-io" "Questro.io Marketing Site" "questro-io-marketing" "render-questro-io.yaml"
            ;;
        4)
            deploy_component "questro-app" "Questro.app Product Site" "questro-app-product" "render-questro-app.yaml"
            ;;
        5)
            deploy_component "backend" "Backend API" "questro-backend-api" "render-backend.yaml"
            ;;
        6)
            step "Building all components..."
            build_component "questro-io" "Questro.io Marketing Site"
            build_component "questro-app" "Questro.app Product Site"
            build_component "backend" "Backend API"
            success "All components built successfully!"
            ;;
        7)
            log "Deployment cancelled"
            exit 0
            ;;
        *)
            error "Invalid choice. Please run the script again."
            exit 1
            ;;
    esac
}

# Show deployment status
show_status() {
    echo ""
    step "Current Deployment Status:"
    echo ""
    
    # Check questro-io
    if [[ -d "questro-io/dist" ]]; then
        echo "✅ Questro.io: Built ($(du -sh questro-io/dist | cut -f1))"
    else
        echo "❌ Questro.io: Not built"
    fi
    
    # Check questro-app
    if [[ -d "questro-app/dist" ]]; then
        echo "✅ Questro.app: Built ($(du -sh questro-app/dist | cut -f1))"
    else
        echo "❌ Questro.app: Not built"
    fi
    
    # Check backend
    if [[ -d "backend/dist" ]]; then
        echo "✅ Backend: Built ($(du -sh backend/dist | cut -f1))"
    else
        echo "❌ Backend: Not built"
    fi
    
    # Check configuration files
    echo ""
    step "Configuration Files:"
    if [[ -f "render.yaml" ]]; then
        echo "✅ render.yaml (Full-stack)"
    else
        echo "❌ render.yaml (Full-stack)"
    fi
    
    if [[ -f "render-questro-io.yaml" ]]; then
        echo "✅ render-questro-io.yaml (Marketing)"
    else
        echo "❌ render-questro-io.yaml (Marketing)"
    fi
    
    if [[ -f "render-questro-app.yaml" ]]; then
        echo "✅ render-questro-app.yaml (Product)"
    else
        echo "❌ render-questro-app.yaml (Product)"
    fi
    
    if [[ -f "render-backend.yaml" ]]; then
        echo "✅ render-backend.yaml (Backend)"
    else
        echo "❌ render-backend.yaml (Backend)"
    fi
}

# Run the deployment
log_to_file "Starting Questro deployment ${DEPLOYMENT_ID}"
step "Starting Questro deployment..."

# Show current status
show_status

# Run preflight checks
preflight_checks

# Show main menu
main_menu

# Generate report
generate_report

success "🎉 Questro deployment completed!"
log "Check the deployment report for next steps."
log_to_file "Deployment completed successfully"