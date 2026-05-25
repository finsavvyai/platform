#!/bin/bash

# 📊 Qestro Status Script
# Shows the status of all Qestro services

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
DESKTOP_DIR="$PROJECT_ROOT/QestroDesktop"

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}  📊 Qestro Platform Status${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Helper function to check URL
check_url() {
    if curl -s --max-time 3 "$1" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check Backend
echo -e "${PURPLE}🔧 Backend Service${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

if [ -f "$BACKEND_DIR/.backend.pid" ]; then
    BACKEND_PID=$(cat "$BACKEND_DIR/.backend.pid")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Process: Running (PID: $BACKEND_PID)${NC}"

        # Check if backend is responding
        if check_url "http://localhost:8000/api/health"; then
            echo -e "${GREEN}✅ Health: Responding on http://localhost:8000${NC}"

            # Get backend info if available
            BACKEND_INFO=$(curl -s http://localhost:8000/api/health 2>/dev/null)
            if [ ! -z "$BACKEND_INFO" ]; then
                echo -e "${BLUE}ℹ️  Info: $BACKEND_INFO${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Health: Process running but not responding${NC}"
        fi
    else
        echo -e "${RED}❌ Process: PID file exists but process not running${NC}"
        rm -f "$BACKEND_DIR/.backend.pid"
    fi
else
    # Check if something is running on port 8000
    if lsof -ti:8000 > /dev/null 2>&1; then
        BACKEND_PID=$(lsof -ti:8000)
        echo -e "${YELLOW}⚠️  Process: Running on port 8000 (PID: $BACKEND_PID) but not managed by this script${NC}"

        if check_url "http://localhost:8000/api/health"; then
            echo -e "${GREEN}✅ Health: Responding on http://localhost:8000${NC}"
        else
            echo -e "${YELLOW}⚠️  Health: Port occupied but not responding to health check${NC}"
        fi
    else
        echo -e "${RED}❌ Process: Not running${NC}"
        echo -e "${RED}❌ Health: Not available${NC}"
    fi
fi

echo ""

# Check Frontend
echo -e "${PURPLE}🌐 Frontend Service${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

if [ -f "$FRONTEND_DIR/.frontend.pid" ]; then
    FRONTEND_PID=$(cat "$FRONTEND_DIR/.frontend.pid")
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Process: Running (PID: $FRONTEND_PID)${NC}"

        # Check if frontend is responding
        if check_url "http://localhost:3000"; then
            echo -e "${GREEN}✅ Health: Responding on http://localhost:3000${NC}"
        else
            echo -e "${YELLOW}⚠️  Health: Process running but not responding${NC}"
        fi
    else
        echo -e "${RED}❌ Process: PID file exists but process not running${NC}"
        rm -f "$FRONTEND_DIR/.frontend.pid"
    fi
else
    # Check if something is running on port 3000
    if lsof -ti:3000 > /dev/null 2>&1; then
        FRONTEND_PID=$(lsof -ti:3000)
        echo -e "${YELLOW}⚠️  Process: Running on port 3000 (PID: $FRONTEND_PID) but not managed by this script${NC}"

        if check_url "http://localhost:3000"; then
            echo -e "${GREEN}✅ Health: Responding on http://localhost:3000${NC}"
        else
            echo -e "${YELLOW}⚠️  Health: Port occupied but not responding${NC}"
        fi
    else
        echo -e "${RED}❌ Process: Not running${NC}"
        echo -e "${RED}❌ Health: Not available${NC}"
    fi
fi

echo ""

# Check Desktop App
echo -e "${PURPLE}🖥️  Desktop Application${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

# Check for Swift CLI desktop app
if pgrep -f "qestro-desktop" > /dev/null 2>&1; then
    DESKTOP_PID=$(pgrep -f "qestro-desktop")
    echo -e "${GREEN}✅ Process: Running (PID: $DESKTOP_PID)${NC}"
    echo -e "${GREEN}✅ Status: Qestro Desktop CLI is active${NC}"
else
    echo -e "${RED}❌ Process: Not running${NC}"
    echo -e "${RED}❌ Status: Desktop app is not active${NC}"
fi

# Check if desktop CLI app is built
if [ -f "$PROJECT_ROOT/qestro-desktop" ]; then
    APP_SIZE=$(du -sh "$PROJECT_ROOT/qestro-desktop" 2>/dev/null | cut -f1)
    echo -e "${GREEN}✅ Build: Available (Size: $APP_SIZE)${NC}"
    echo -e "${BLUE}ℹ️  Type: Swift CLI Application${NC}"
    echo -e "${BLUE}ℹ️  Usage: ./qestro-desktop --help${NC}"
else
    echo -e "${YELLOW}⚠️  Build: Not found, may need to build first${NC}"
fi

echo ""

# Check Database
echo -e "${PURPLE}🗄️  Database${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

if command -v pg_isready &> /dev/null; then
    if pg_isready -h localhost -p 5432 &> /dev/null; then
        echo -e "${GREEN}✅ PostgreSQL: Running on localhost:5432${NC}"

        # Try to get PostgreSQL version
        if command -v psql &> /dev/null; then
            PG_VERSION=$(psql --version 2>/dev/null | head -n 1)
            echo -e "${BLUE}ℹ️  Version: $PG_VERSION${NC}"
        fi
    else
        echo -e "${RED}❌ PostgreSQL: Not responding on localhost:5432${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PostgreSQL: pg_isready not found, cannot check status${NC}"
fi

# Check Redis (if available)
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✅ Redis: Running and responding${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis: Not responding${NC}"
    fi
else
    echo -e "${BLUE}ℹ️  Redis: redis-cli not found, skipping check${NC}"
fi

echo ""

# System Information
echo -e "${PURPLE}💻 System Information${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

# Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js: Not found${NC}"
fi

# npm version
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm: v$NPM_VERSION${NC}"
else
    echo -e "${RED}❌ npm: Not found${NC}"
fi

# Xcode version
if command -v xcodebuild &> /dev/null; then
    XCODE_VERSION=$(xcodebuild -version 2>/dev/null | head -n 1)
    echo -e "${GREEN}✅ Xcode: $XCODE_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  Xcode: Not found${NC}"
fi

# macOS version
if command -v sw_vers &> /dev/null; then
    MACOS_VERSION=$(sw_vers -productVersion)
    echo -e "${GREEN}✅ macOS: $MACOS_VERSION${NC}"
fi

# Project info
echo -e "${BLUE}ℹ️  Project: $(pwd)${NC}"

echo ""

# Summary
echo -e "${PURPLE}📋 Quick Summary${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

SERVICES_RUNNING=0
TOTAL_SERVICES=3

# Count running services
if ([ -f "$BACKEND_DIR/.backend.pid" ] && ps -p $(cat "$BACKEND_DIR/.backend.pid") > /dev/null 2>&1) || lsof -ti:8000 > /dev/null 2>&1; then
    ((SERVICES_RUNNING++))
fi

if ([ -f "$FRONTEND_DIR/.frontend.pid" ] && ps -p $(cat "$FRONTEND_DIR/.frontend.pid") > /dev/null 2>&1) || lsof -ti:3000 > /dev/null 2>&1; then
    ((SERVICES_RUNNING++))
fi

if pgrep -f "QestroDesktop.app" > /dev/null 2>&1; then
    ((SERVICES_RUNNING++))
fi

if [ $SERVICES_RUNNING -eq $TOTAL_SERVICES ]; then
    echo -e "${GREEN}🎉 All services are running ($SERVICES_RUNNING/$TOTAL_SERVICES)${NC}"
elif [ $SERVICES_RUNNING -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Some services are running ($SERVICES_RUNNING/$TOTAL_SERVICES)${NC}"
else
    echo -e "${RED}❌ No services are running ($SERVICES_RUNNING/$TOTAL_SERVICES)${NC}"
fi

# Quick action suggestions
echo ""
echo -e "${CYAN}💡 Quick Actions:${NC}"
if [ $SERVICES_RUNNING -eq 0 ]; then
    echo -e "${BLUE}   • Start all services: ./build-and-run.sh${NC}"
    echo -e "${BLUE}   • Start backend only: ./build-and-run.sh --backend-only${NC}"
    echo -e "${BLUE}   • Start desktop only: ./build-and-run.sh --desktop-only${NC}"
elif [ $SERVICES_RUNNING -lt $TOTAL_SERVICES ]; then
    echo -e "${BLUE}   • Start missing services: ./start.sh${NC}"
    echo -e "${BLUE}   • Stop all services: ./stop.sh${NC}"
else
    echo -e "${BLUE}   • Stop all services: ./stop.sh${NC}"
    echo -e "${BLUE}   • Restart all services: ./stop.sh && ./start.sh${NC}"
fi

echo -e "${BLUE}   • Check logs: tail -f backend/server.log${NC}"
echo -e "${BLUE}   • Clean build: ./build-and-run.sh --clean${NC}"

echo ""