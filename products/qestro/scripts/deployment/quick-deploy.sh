#!/bin/bash

# Questro Quick Deploy - One-Command Cloud Deployment
# Simplified deployment script for rapid cloud deployment

set -e

echo "🚀 Questro Quick Deploy"
echo "======================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Quick platform detection and deployment
deploy_render() {
    log "Deploying to Render.com..."
    
    # Check if render.yaml exists
    if [[ ! -f "render.yaml" ]]; then
        error "render.yaml not found. Run scripts/generate-deploy-configs.sh first"
        exit 1
    fi
    
    # Build the project
    log "Building project..."
    npm install
    cd backend && npm install && npm run build && cd ..
    cd frontend && npm install && npm run build && cd ..
    
    # Push to git (Render deploys from git)
    log "Pushing to git repository..."
    git add .
    git commit -m "Quick deploy to Render" || true
    git push origin main
    
    success "Render deployment initiated! Check your Render dashboard."
    log "Frontend will be available at your Render static site URL"
    log "Backend will be available at your Render web service URL"
}

deploy_vercel() {
    log "Deploying to Vercel..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        log "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Deploy frontend to Vercel
    cd frontend
    log "Deploying frontend to Vercel..."
    vercel --prod
    cd ..
    
    success "Frontend deployed to Vercel!"
    warn "Note: You'll need to deploy the backend separately to a Node.js hosting service"
}

deploy_railway() {
    log "Deploying to Railway..."
    
    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
        log "Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    # Build project
    npm run build
    
    # Deploy to Railway
    railway login
    railway deploy
    
    success "Railway deployment completed!"
}

deploy_heroku() {
    log "Deploying to Heroku..."
    
    # Check if Heroku CLI is installed
    if ! command -v heroku &> /dev/null; then
        error "Heroku CLI not installed. Please install it first."
        exit 1
    fi
    
    # Build project
    npm run build
    
    # Deploy backend to Heroku
    cd backend
    
    # Initialize git if needed
    if [[ ! -d ".git" ]]; then
        git init
        git add .
        git commit -m "Initial Heroku deployment"
    fi
    
    # Create Heroku app (or use existing)
    read -p "Enter Heroku app name (or press Enter for random): " app_name
    if [[ -n "$app_name" ]]; then
        heroku create $app_name || heroku git:remote -a $app_name
    else
        heroku create
    fi
    
    # Set environment variables
    heroku config:set NODE_ENV=production
    heroku config:set USE_SUPABASE=true
    
    # Deploy
    git push heroku main
    cd ..
    
    success "Backend deployed to Heroku!"
}

# Main menu
main() {
    echo ""
    echo "Select quick deployment target:"
    echo "1. Render.com (Full-stack - Recommended)"
    echo "2. Vercel (Frontend only)"  
    echo "3. Railway (Full-stack)"
    echo "4. Heroku (Backend only)"
    echo "5. Exit"
    
    read -p "Enter your choice (1-5): " choice
    
    case $choice in
        1)
            deploy_render
            ;;
        2)
            deploy_vercel
            ;;
        3)
            deploy_railway
            ;;
        4)
            deploy_heroku
            ;;
        5)
            log "Deployment cancelled"
            exit 0
            ;;
        *)
            error "Invalid choice. Please run the script again."
            exit 1
            ;;
    esac
}

# Preflight checks
preflight() {
    log "Running preflight checks..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm not installed"
        exit 1
    fi
    
    # Check git
    if ! command -v git &> /dev/null; then
        error "Git not installed"
        exit 1
    fi
    
    # Check if in project root
    if [[ ! -f "package.json" ]] || [[ ! -d "frontend" ]] || [[ ! -d "backend" ]]; then
        error "Please run this script from the Questro project root directory"
        exit 1
    fi
    
    success "Preflight checks passed"
}

# Run script
log "Starting Questro Quick Deploy..."
preflight
main