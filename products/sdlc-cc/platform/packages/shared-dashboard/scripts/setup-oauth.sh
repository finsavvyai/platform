#!/bin/bash

# OAuth Setup Helper Script for AutoBoot
# This script guides you through setting up Google and GitHub OAuth

set -e

echo "🔐 AutoBoot OAuth Setup Wizard"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI not found!"
    echo "Please install it: npm install -g wrangler"
    exit 1
fi

print_success "Wrangler CLI found"
echo ""

# Check wrangler authentication
print_info "Checking Wrangler authentication..."
if wrangler whoami &> /dev/null; then
    print_success "Wrangler is authenticated"
else
    print_warning "Wrangler is not authenticated"
    echo "Please run: wrangler login"
    exit 1
fi

echo ""
echo "================================================"
echo "📋 STEP 1: Google OAuth Setup"
echo "================================================"
echo ""

print_info "To set up Google OAuth, you need to:"
echo "  1. Go to https://console.cloud.google.com/"
echo "  2. Create a new project or select existing one"
echo "  3. Navigate to 'APIs & Services' > 'Credentials'"
echo "  4. Click 'Create Credentials' > 'OAuth client ID'"
echo "  5. Select 'Web application'"
echo "  6. Add authorized redirect URI:"
echo "     • https://sdlc.cc/auth/google/callback"
echo "     • http://localhost:9999/auth/google/callback (for dev)"
echo ""

read -p "Have you completed these steps? (y/n): " google_ready

if [[ $google_ready == "y" || $google_ready == "Y" ]]; then
    echo ""
    print_info "Great! Now let's add your Google OAuth credentials..."
    echo ""

    # Get environment choice
    echo "Select environment:"
    echo "  1) Production"
    echo "  2) Development"
    echo "  3) Both"
    read -p "Choice (1-3): " env_choice

    # Set environment flags
    declare -a envs
    case $env_choice in
        1)
            envs=("production")
            ;;
        2)
            envs=("development")
            ;;
        3)
            envs=("production" "development")
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac

    # Add Google Client ID
    echo ""
    print_info "Adding GOOGLE_CLIENT_ID..."
    for env in "${envs[@]}"; do
        print_info "Setting GOOGLE_CLIENT_ID for $env environment..."
        wrangler secret put GOOGLE_CLIENT_ID --env "$env"
    done
    print_success "GOOGLE_CLIENT_ID added"

    # Add Google Client Secret
    echo ""
    print_info "Adding GOOGLE_CLIENT_SECRET..."
    for env in "${envs[@]}"; do
        print_info "Setting GOOGLE_CLIENT_SECRET for $env environment..."
        wrangler secret put GOOGLE_CLIENT_SECRET --env "$env"
    done
    print_success "GOOGLE_CLIENT_SECRET added"

else
    print_warning "Skipping Google OAuth setup"
    echo "You can run this script again later when ready"
fi

echo ""
echo "================================================"
echo "📋 STEP 2: GitHub OAuth Setup"
echo "================================================"
echo ""

print_info "To set up GitHub OAuth, you need to:"
echo "  1. Go to https://github.com/settings/developers"
echo "  2. Click 'New OAuth App'"
echo "  3. Fill in the details:"
echo "     • Application name: AutoBoot"
echo "     • Homepage URL: https://sdlc.cc"
echo "     • Authorization callback URL: https://sdlc.cc/auth/github/callback"
echo "  4. Click 'Register application'"
echo "  5. Generate a client secret"
echo ""

read -p "Have you completed these steps? (y/n): " github_ready

if [[ $github_ready == "y" || $github_ready == "Y" ]]; then
    echo ""
    print_info "Great! Now let's add your GitHub OAuth credentials..."
    echo ""

    # Use same environments as before if Google was configured
    if [[ $google_ready == "y" || $google_ready == "Y" ]]; then
        print_info "Using same environments as Google OAuth: ${envs[*]}"
    else
        echo "Select environment:"
        echo "  1) Production"
        echo "  2) Development"
        echo "  3) Both"
        read -p "Choice (1-3): " env_choice

        declare -a envs
        case $env_choice in
            1)
                envs=("production")
                ;;
            2)
                envs=("development")
                ;;
            3)
                envs=("production" "development")
                ;;
            *)
                print_error "Invalid choice"
                exit 1
                ;;
        esac
    fi

    # Add GitHub Client ID
    echo ""
    print_info "Adding GITHUB_CLIENT_ID..."
    for env in "${envs[@]}"; do
        print_info "Setting GITHUB_CLIENT_ID for $env environment..."
        wrangler secret put GITHUB_CLIENT_ID --env "$env"
    done
    print_success "GITHUB_CLIENT_ID added"

    # Add GitHub Client Secret
    echo ""
    print_info "Adding GITHUB_CLIENT_SECRET..."
    for env in "${envs[@]}"; do
        print_info "Setting GITHUB_CLIENT_SECRET for $env environment..."
        wrangler secret put GITHUB_CLIENT_SECRET --env "$env"
    done
    print_success "GITHUB_CLIENT_SECRET added"

else
    print_warning "Skipping GitHub OAuth setup"
fi

echo ""
echo "================================================"
echo "🚀 Next Steps"
echo "================================================"
echo ""

if [[ $google_ready == "y" || $github_ready == "y" ]]; then
    print_success "OAuth credentials configured!"
    echo ""
    print_info "To deploy the updated worker:"
    echo "  cd $(pwd)"
    echo "  npm run build:worker"
    echo "  npm run deploy:worker"
    echo ""
    print_info "To test OAuth locally:"
    echo "  npm run dev:worker"
    echo "  # Visit http://localhost:9999/auth/register"
    echo ""
    print_info "To run Playwright tests:"
    echo "  npm run test:e2e -- oauth-setup.spec.ts"
    echo ""
else
    print_warning "No OAuth providers were configured"
    echo "You can run this script again when you're ready to set up OAuth"
fi

echo ""
print_success "Setup complete! 🎉"
echo ""

# List configured secrets
print_info "Current secrets for production:"
wrangler secret list --env production 2>/dev/null || print_warning "Could not list secrets"

echo ""
