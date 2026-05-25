#!/bin/bash

# 🚀 Qestro Quick Start - Simple Version
# Starts services without TypeScript compilation

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
DESKTOP_DIR="$PROJECT_ROOT/QestroDesktop"

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}  🚀 Qestro Quick Start${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Start backend with tsx (no compilation)
echo -e "${YELLOW}📋 Starting backend with tsx...${NC}"
cd "$BACKEND_DIR"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Backend package.json not found${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install --silent
fi

echo -e "${BLUE}🚀 Starting backend on http://localhost:3020${NC}"

# Start backend in background
npm run start:tsx > server.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > .backend.pid

# Wait for backend to start
echo -e "${BLUE}⏳ Waiting for backend to start...${NC}"
sleep 5

# Check if backend is running
if curl -s http://localhost:3020/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running (PID: $BACKEND_PID)${NC}"
else
    echo -e "${YELLOW}⚠️  Backend may still be starting...${NC}"
fi

echo ""

# Build Professional CLI
echo -e "${YELLOW}📋 Building Professional CLI...${NC}"
cd "$DESKTOP_DIR"

if command -v swift &> /dev/null; then
    echo -e "${BLUE}🔨 Building Qestro CLI with Swift...${NC}"
    swift build --configuration release > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Professional CLI built successfully${NC}"
        # Install CLI to user bin
        mkdir -p "$HOME/.local/bin"
        cp ".build/release/qestro" "$HOME/.local/bin/qestro-pro" 2>/dev/null || true
        echo -e "${GREEN}✅ CLI installed as 'qestro-pro'${NC}"
    else
        echo -e "${YELLOW}⚠️  CLI build in progress...${NC}"
    fi
fi

# Try to build and start desktop app
echo -e "${YELLOW}📋 Building desktop app...${NC}"
cd "$DESKTOP_DIR"

if [ ! -f "QestroDesktop.xcodeproj/project.pbxproj" ]; then
    echo -e "${YELLOW}⚠️  Desktop Xcode project not found, using Swift CLI${NC}"
    echo -e "${BLUE}ℹ️  Backend is running at http://localhost:3020${NC}"
    # Don't exit, continue with CLI setup
fi

# Check if Xcode is available (optional for GUI)
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${YELLOW}⚠️  Xcode not found - GUI app unavailable${NC}"
    echo -e "${BLUE}ℹ️  Using Professional CLI instead${NC}"
else

echo -e "${BLUE}🔨 Building desktop app...${NC}"
xcodebuild \
    -project QestroDesktop.xcodeproj \
    -scheme QestroDesktop \
    -configuration Debug \
    -derivedDataPath build/DerivedData \
    build > build.log 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Desktop app built successfully${NC}"

    # Launch the app
    APP_PATH="build/DerivedData/Build/Products/Debug/QestroDesktop.app"
    if [ -d "$APP_PATH" ]; then
        echo -e "${BLUE}🚀 Launching desktop app...${NC}"
        open "$APP_PATH"
        echo -e "${GREEN}✅ Desktop app launched${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Desktop app build failed (check build.log)${NC}"
fi
fi # Close the Xcode check

echo ""
echo -e "${CYAN}🎉 Qestro Platform Started!${NC}"
echo ""
echo -e "${GREEN}Services running:${NC}"
echo -e "${BLUE}  • Backend API: http://localhost:3020${NC}"
if [ -f "$HOME/.local/bin/qestro-pro" ]; then
    echo -e "${BLUE}  • Professional CLI: qestro-pro${NC}"
fi
if [ -d "$DESKTOP_DIR/build/DerivedData/Build/Products/Debug/QestroDesktop.app" ]; then
    echo -e "${BLUE}  • Desktop GUI App: Launched${NC}"
fi

echo ""
echo -e "${YELLOW}💡 To stop services: ./stop.sh${NC}"
echo -e "${YELLOW}💡 To check status: ./status.sh${NC}"

# Show CLI examples if installed
if [ -f "$HOME/.local/bin/qestro-pro" ]; then
    echo ""
    echo -e "${GREEN}📝 Quick CLI Examples:${NC}"
    echo -e "${WHITE}  qestro-pro record web --url http://localhost:3000${NC}"
    echo -e "${WHITE}  qestro-pro voice providers${NC}"
    echo -e "${WHITE}  qestro-pro api test https://api.github.com${NC}"
    echo -e "${WHITE}  qestro-pro health${NC}"
fi

# Keep script running
echo ""
echo -e "${BLUE}Press Ctrl+C to stop all services...${NC}"

# Wait for interrupt
trap 'echo -e "\n${YELLOW}Stopping services...${NC}"; kill $BACKEND_PID 2>/dev/null; echo -e "${GREEN}Services stopped${NC}"; exit 0' INT
while true; do
    sleep 1
done