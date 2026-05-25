#!/bin/bash

# Questro MCP Runner Script
# This script loads environment variables and runs MCP connectors

set -e

echo "🚀 Questro MCP Runner"
echo "===================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load environment variables from .env.local
ENV_FILE=".env.local"

if [ -f "$ENV_FILE" ]; then
    echo -e "${BLUE}Loading environment variables from .env.local...${NC}"
    set -a
    source "$ENV_FILE"
    set +a
    echo -e "${GREEN}✅ Environment variables loaded${NC}"
else
    echo -e "${YELLOW}⚠️  .env.local file not found at $ENV_FILE${NC}"
    echo "Please ensure your API keys are in the .env.local file"
    exit 1
fi

# Check if API keys are available
if [ -z "$RENDER_API_KEY" ] && [ -z "$NETLIFY_ACCESS_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  No API keys found in environment${NC}"
    echo "Please add your API keys to .env.local:"
    echo "  RENDER_API_KEY=rnd_your_render_key"
    echo "  NETLIFY_ACCESS_TOKEN=netlify_your_netlify_key"
    exit 1
fi

echo ""
echo -e "${BLUE}Available API Keys:${NC}"
echo "- Render API Key: ${RENDER_API_KEY:+✅ Set} ${RENDER_API_KEY:-❌ Not set}"
echo "- Netlify Access Token: ${NETLIFY_ACCESS_TOKEN:+✅ Set} ${NETLIFY_ACCESS_TOKEN:-❌ Not set}"
echo ""

# Function to show usage
show_usage() {
    echo "Usage: $0 [connector]"
    echo ""
    echo "Available connectors:"
    echo "  render     - Run Render MCP connector (backend management)"
    echo "  netlify    - Run Netlify MCP connector (frontend management)"
    echo "  both        - Run both connectors in separate terminals"
    echo ""
    echo "Examples:"
    echo "  $0 render"
    echo "  $0 netlify"
    echo "  $0 both"
}

# Function to run Render MCP
run_render() {
    if [ -z "$RENDER_API_KEY" ]; then
        echo -e "${YELLOW}⚠️  RENDER_API_KEY not found${NC}"
        echo "Please add it to .env.local"
        return 1
    fi

    echo -e "${BLUE}🔧 Starting Render MCP Connector...${NC}"
    echo "This will allow you to manage your Questro backend service"
    echo ""
    echo "Available commands:"
    echo "- 'List all Questro services'"
    echo "- 'Check service health'"
    echo "- 'Trigger deployment'"
    echo "- 'Get service logs'"
    echo "- 'Restart service'"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop the connector${NC}"
    echo ""

    export RENDER_API_KEY="$RENDER_API_KEY"
    cd mcp && npm run render
}

# Function to run Netlify MCP
run_netlify() {
    if [ -z "$NETLIFY_ACCESS_TOKEN" ]; then
        echo -e "${YELLOW}⚠️  NETLIFY_ACCESS_TOKEN not found${NC}"
        echo "Please add it to .env.local"
        return 1
    fi

    echo -e "${BLUE}🌐 Starting Netlify MCP Connector...${NC}"
    echo "This will allow you to manage your Questro frontend sites"
    echo ""
    echo "Available commands:"
    echo "- 'List frontend sites'"
    echo "- 'Trigger deployment'"
    echo "- 'Get build logs'"
    echo "- 'View site analytics'"
    echo "- 'Update site settings'"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop the connector${NC}"
    echo ""

    export NETLIFY_ACCESS_TOKEN="$NETLIFY_ACCESS_TOKEN"
    cd mcp && npm run netlify
}

# Function to run both connectors
run_both() {
    echo -e "${BLUE}🚀 Starting both MCP connectors...${NC}"
    echo "Opening two terminal windows..."
    echo ""

    # Check if both API keys are available
    if [ -z "$RENDER_API_KEY" ] || [ -z "$NETLIFY_ACCESS_TOKEN" ]; then
        echo -e "${YELLOW}⚠️  Both API keys are required for 'both' option${NC}"
        echo "Please add missing keys to .env.local"
        return 1
    fi

    # Run in separate terminals using osascript (macOS)
    if command -v osascript >/dev/null 2>&1; then
        # Open new terminal windows for macOS
        osascript -e "tell application \"Terminal\" to do script \"cd '$PWD' && export RENDER_API_KEY='$RENDER_API_KEY' && npm run render\"" &
        sleep 1
        osascript -e "tell application \"Terminal\" to do script \"cd '$PWD' && export NETLIFY_ACCESS_TOKEN='$NETLIFY_ACCESS_TOKEN' && npm run netlify\"" &

        echo -e "${GREEN}✅ Both connectors started in separate terminal windows${NC}"
    else
        # Fallback for other systems
        echo -e "${YELLOW}⚠️  Cannot open multiple terminals automatically${NC}"
        echo "Please run manually in separate terminals:"
        echo ""
        echo "Terminal 1 (Render):"
        echo "  cd $PWD"
        echo "  export RENDER_API_KEY=\"$RENDER_API_KEY\""
        echo "  npm run render"
        echo ""
        echo "Terminal 2 (Netlify):"
        echo "  cd $PWD"
        echo "  export NETLIFY_ACCESS_TOKEN=\"$NETLIFY_ACCESS_TOKEN\""
        echo "  npm run netlify"
    fi
}

# Main script logic
case "${1:-}" in
    "render")
        run_render
        ;;
    "netlify")
        run_netlify
        ;;
    "both")
        run_both
        ;;
    "help"|"-h"|"--help")
        show_usage
        ;;
    "")
        echo -e "${YELLOW}No connector specified${NC}"
        echo ""
        show_usage
        exit 1
        ;;
    *)
        echo -e "${YELLOW}Unknown connector: $1${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac