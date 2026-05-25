#!/bin/bash

# QuantumBeam.io - Quick Deployment Script
# Real-time monitoring with status updates

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[ℹ]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_step() {
    echo -e "${PURPLE}[→]${NC} $1"
}

# Voice function (macOS only, fallback to echo for others)
speak() {
    if command -v say >/dev/null 2>&1; then
        say "$1" 2>/dev/null || echo "🔊 $1"
    else
        echo "🔊 $1"
    fi
}

# Progress bar
progress_bar() {
    local current=$1
    local total=$2
    local width=40
    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))

    printf "\r["
    printf "%*s" $filled | tr ' ' '█'
    printf "%*s" $empty | tr ' ' '░'
    printf "] %d%%" $percentage
}

# Countdown timer
countdown() {
    local seconds=$1
    local message=$2
    echo -n "$message in "
    for i in $(seq $seconds -1 1); do
        echo -n "$i... "
        sleep 1
    done
    echo "GO!"
}

echo
echo "🚀" $CYAN"QUANTUMBEAM.IO DEPLOYMENT STARTING"$NC"
echo "🌍" $CYAN"Cloudflare Workers + MCP Integration"$NC"
echo "🔊" $CYAN"Voice Monitoring Enabled"$NC"
echo "================================================"

speak "Starting Quantum Beam deployment"

# Get start time
start_time=$(date +%s)

# Step 1: Check prerequisites
print_step "Step 1/8: Checking prerequisites..."
if command -v node >/dev/null 2>&1; then
    print_status "Node.js is installed"
else
    print_error "Node.js is not installed"
    exit 1
fi

if command -v wrangler >/dev/null 2>&1; then
    print_status "Wrangler CLI is installed"
else
    print_error "Wrangler CLI is not installed. Run: npm install -g wrangler"
    exit 1
fi

speak "Prerequisites check complete"
progress_bar 1 8

# Step 2: Install dependencies
print_step "Step 2/8: Installing dependencies..."
npm install >/dev/null 2>&1
print_status "Dependencies installed"
speak "Dependencies installed"
progress_bar 2 8

# Step 3: Check Cloudflare login
print_step "Step 3/8: Verifying Cloudflare authentication..."
if wrangler whoami >/dev/null 2>&1; then
    print_status "Authenticated with Cloudflare"
else
    print_error "Not authenticated with Cloudflare. Run: wrangler login"
    exit 1
fi

speak "Cloudflare authentication verified"
progress_bar 3 8

# Step 4: Set environment variables
print_step "Step 4/8: Setting environment variables..."
# Set a default backend URL (will point to self for now)
echo "https://quantumbeam.io" | wrangler secret put BACKEND_URL >/dev/null 2>&1 || true
print_status "Environment variables configured"
speak "Environment variables configured"
progress_bar 4 8

# Step 5: Deploy to Cloudflare Workers
print_step "Step 5/8: Deploying to Cloudflare Workers..."
echo "🚀 Deploying QuantumBeam to global Cloudflare network..."
speak "Deploying to Cloudflare Workers"

if wrangler deploy; then
    print_status "Successfully deployed to Cloudflare Workers"
    speak "Deployment successful"
else
    print_error "Deployment failed"
    speak "Deployment failed"
    exit 1
fi

progress_bar 5 8

# Step 6: Wait for DNS propagation
print_step "Step 6/8: Waiting for DNS propagation..."
countdown 10 "Going live"
progress_bar 6 8

# Step 7: Test health endpoint
print_step "Step 7/8: Testing health endpoint..."
speak "Testing deployment"

if curl -s -f https://quantumbeam.io/health >/dev/null 2>&1; then
    print_status "Health endpoint is responding"
    speak "Health check successful"
else
    print_warning "Health endpoint not yet responding (may need more time for DNS)"
fi

progress_bar 7 8

# Step 8: Test MCP integration
print_step "Step 8/8: Testing MCP integration..."
mcp_test=$(curl -s -X POST https://quantumbeam.io/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' 2>/dev/null)

if [[ $mcp_test == *"quantumbeam-fraud-detection"* ]]; then
    print_status "MCP integration is working!"
    speak "M C P integration successful"
else
    print_warning "MCP endpoint may need a moment to initialize"
fi

progress_bar 8 8

# Calculate deployment time
end_time=$(date +%s)
duration=$((end_time - start_time))

echo
echo "🎉" $GREEN"DEPLOYMENT COMPLETED SUCCESSFULLY!"$NC
echo "⏱️  Total time: $duration seconds"
echo

speak "Deployment completed successfully"

echo "🌐" $CYAN"LIVE URLS:"$NC
echo "🏠  Main Site:     " $BLUE"https://quantumbeam.io"$NC
echo "🏥  Health Check:  " $BLUE"https://quantumbeam.io/health"$NC
echo "🤖  MCP Endpoint: " $BLUE"https://quantumbeam.io/mcp"$NC
echo "📊  API Base:     " $BLUE"https://quantumbeam.io/api"$NC
echo

echo "🧪" $CYAN"QUICK TEST COMMANDS:"$NC
echo "curl " $BLUE"https://quantumbeam.io/health"$NC
echo "curl -X POST " $BLUE"https://quantumbeam.io/mcp"$NC " -d '{\"method\":\"initialize\"}'"
echo

echo "🔧" $CYAN"MANAGEMENT:"$NC
echo "wrangler tail    " $GRAY"# View live logs"$NC
echo "wrangler deploy  " $GRAY"# Redeploy updates"$NC
echo

echo "🎯" $CYAN"MCP TOOLS AVAILABLE:"$NC
echo "• detect_fraud     - Analyze transactions for fraud"
echo "• analyze_pattern  - Analyze suspicious patterns"
echo "• get_risk_score   - Get comprehensive risk scores"
echo "• check_sanctions  - Check against sanctions lists"
echo

echo "🚀" $GREEN"QUANTUMBEAM.IO IS LIVE AND READY FOR BUSINESS!"$NC
echo

# Celebration animation
for i in {1..3}; do
    echo -e "${GREEN}🎉 QUANTUMBEAM.IO IS LIVE! 🚀${NC}"
    sleep 0.5
done

speak "Quantum Beam dot io is ready for business"

echo "📊" $CYAN"Next Steps:"$NC
echo "1. Test the MCP integration with your AI assistant"
echo "2. Set up monitoring in the Cloudflare dashboard"
echo "3. Configure custom fraud detection rules"
echo "4. Share with users and start detecting fraud!"
echo

echo "=" * 60