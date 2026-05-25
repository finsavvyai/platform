#!/bin/bash

# Questro.app Product Site Deployment Script
# Developer-focused product website deployment

set -e

echo "🚀 Deploying Questro.app Product Site"
echo "===================================="

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

# Configuration
SITE_NAME="questro-app-product"
BUILD_DIR="questro-app"
DOMAIN="questro.app"

# Preflight checks
preflight_checks() {
    log "Running preflight checks..."
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]] || [[ ! -d "questro-app" ]]; then
        error "Please run this script from the Questro project root directory"
        exit 1
    fi
    
    # Check Node.js and npm
    if ! command -v node &> /dev/null; then
        error "Node.js not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        error "npm not installed"
        exit 1
    fi
    
    success "Preflight checks passed"
}

# Build the product site
build_site() {
    log "Building Questro.app product site..."
    
    cd questro-app
    
    # Clean previous build
    if [[ -d "dist" ]]; then
        rm -rf dist
        log "Cleaned previous build"
    fi
    
    # Install dependencies
    log "Installing dependencies..."
    npm install
    
    # Build the site
    log "Building for production..."
    npm run build
    
    # Verify build
    if [[ ! -d "dist" ]] || [[ ! -f "dist/index.html" ]]; then
        error "Build failed - dist directory or index.html not found"
        exit 1
    fi
    
    local build_size=$(du -sh dist | cut -f1)
    success "Build completed successfully (${build_size})"
    
    cd ..
}

# Deploy to Render
deploy_to_render() {
    log "Deploying to Render..."
    
    # Use the dedicated render configuration for questro.app
    log "Using render-questro-app.yaml for deployment..."
    if [[ ! -f "render-questro-app.yaml" ]]; then
        error "render-questro-app.yaml not found. Please ensure it exists in the project root."
        exit 1
    fi
    
    # Commit and push changes
    git add .
    git commit -m "Deploy questro.app product site

- Built production-ready product site
- Developer-focused features and demos
- Optimized for signup conversions
- Custom domain configuration for questro.app

🚀 Product site deployment" || true
    
    git push origin main
    
    success "Pushed to repository. Render will auto-deploy."
    log "Configure custom domain in Render dashboard:"
    log "  1. Go to your Render service"
    log "  2. Settings → Custom Domains"
    log "  3. Add: questro.app and www.questro.app"
}

# Deploy to Netlify
deploy_to_netlify() {
    log "Deploying to Netlify..."
    
    # Check if Netlify CLI is installed
    if ! command -v netlify &> /dev/null; then
        log "Installing Netlify CLI..."
        npm install -g netlify-cli
    fi
    
    cd questro-app
    
    # Create netlify.toml if it doesn't exist
    if [[ ! -f "netlify.toml" ]]; then
        cat > netlify.toml << EOF
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_ENV = "production"
  SITE_TYPE = "product"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
EOF
    fi
    
    # Deploy to Netlify
    log "Deploying to Netlify..."
    netlify deploy --prod --dir=dist --message="Questro.app product site deployment"
    
    success "Deployed to Netlify!"
    warn "Configure custom domain in Netlify dashboard:"
    warn "  1. Site settings → Domain management"
    warn "  2. Add custom domain: questro.app"
    warn "  3. Configure DNS in Namecheap to point to Netlify"
    
    cd ..
}

# Deploy to Vercel
deploy_to_vercel() {
    log "Deploying to Vercel..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        log "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    cd questro-app
    
    # Create vercel.json if it doesn't exist
    if [[ ! -f "vercel.json" ]]; then
        cat > vercel.json << EOF
{
  "name": "questro-app-product",
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
  ],
  "env": {
    "NODE_ENV": "production",
    "SITE_TYPE": "product"
  }
}
EOF
    fi
    
    # Deploy to Vercel
    vercel --prod --confirm
    
    success "Deployed to Vercel!"
    warn "Configure custom domain in Vercel dashboard"
    
    cd ..
}

# Deploy to AWS S3 + CloudFront
deploy_to_aws() {
    log "Deploying to AWS S3 + CloudFront..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        error "AWS CLI not installed. Please install it first."
        exit 1
    fi
    
    # Configuration
    BUCKET_NAME="questro-app-product-site"
    REGION="us-east-1"
    
    cd questro-app
    
    # Create S3 bucket if it doesn't exist
    log "Setting up S3 bucket..."
    aws s3 mb s3://$BUCKET_NAME --region $REGION 2>/dev/null || true
    
    # Configure bucket for static website hosting
    aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document index.html
    
    # Upload files
    log "Uploading files to S3..."
    aws s3 sync dist/ s3://$BUCKET_NAME --delete --cache-control "public, max-age=31536000"
    
    # Upload index.html without cache
    aws s3 cp dist/index.html s3://$BUCKET_NAME/index.html --cache-control "public, max-age=0, must-revalidate"
    
    success "Deployed to AWS S3!"
    log "Website URL: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
    warn "Configure CloudFront and custom domain for production use"
    
    cd ..
}

# Generate deployment report
generate_report() {
    log "Generating deployment report..."
    
    cat > questro-app-deployment-report.md << EOF
# Questro.app Product Site Deployment Report

**Deployment Date:** $(date)
**Site Type:** Product & Developer
**Domain:** questro.app
**Build Directory:** questro-app/dist

## Deployment Summary

✅ **Build Status:** Successful
✅ **Assets Generated:** $(find questro-app/dist -type f | wc -l) files
✅ **Build Size:** $(du -sh questro-app/dist | cut -f1)
✅ **Git Status:** Committed and pushed

## Site Features

- 🚀 Developer-focused features
- 💻 Interactive demos and playgrounds
- 📱 Mobile-optimized experience
- 🔧 API documentation and examples
- 🎯 Conversion-optimized signup flows

## DNS Configuration Needed

Add these records in Namecheap for questro.app:

\`\`\`
Type: A Record
Host: @
Value: [Your hosting provider IP]

Type: CNAME Record  
Host: www
Value: [Your hosting provider URL]
\`\`\`

## Analytics Setup

- Set up Google Analytics for product tracking
- Configure conversion goals for signups
- Track feature usage and engagement

## Next Steps

1. Configure custom domain in hosting provider
2. Set up SSL certificate
3. Configure DNS in Namecheap
4. Test domain propagation
5. Set up monitoring and analytics
6. Connect to backend API

---
Generated by Questro deployment automation
EOF

    success "Deployment report generated: questro-app-deployment-report.md"
}

# Main deployment menu
main() {
    echo ""
    echo "Select deployment target for Questro.app:"
    echo "1. Render (Recommended for full-stack)"
    echo "2. Netlify (Great for static sites)"
    echo "3. Vercel (Fast global CDN)"
    echo "4. AWS S3 + CloudFront (Enterprise)"
    echo "5. All platforms (sequential)"
    echo "6. Exit"
    
    read -p "Enter your choice (1-6): " choice
    
    case $choice in
        1)
            deploy_to_render
            ;;
        2)
            deploy_to_netlify
            ;;
        3)
            deploy_to_vercel
            ;;
        4)
            deploy_to_aws
            ;;
        5)
            deploy_to_render
            deploy_to_netlify
            deploy_to_vercel
            ;;
        6)
            log "Deployment cancelled"
            exit 0
            ;;
        *)
            error "Invalid choice. Please run the script again."
            exit 1
            ;;
    esac
}

# Run the deployment
log "Starting Questro.app product site deployment..."
preflight_checks
build_site
main
generate_report

success "🎉 Questro.app deployment completed!"
log "Check the deployment report for next steps."
