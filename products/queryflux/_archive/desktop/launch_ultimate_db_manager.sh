#!/bin/bash

# Ultimate Database Manager - Glass Interface Launcher
# Consolidated launcher for the single desktop application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}🚀 Ultimate Database Manager - Glass Interface${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not found. Creating one...${NC}"
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
fi

# Activate virtual environment
echo -e "${BLUE}🔧 Activating virtual environment...${NC}"
source venv/bin/activate

# Check if dependencies are installed
if [ ! -f "venv/.dependencies_installed" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    pip install --upgrade pip
    pip install -r requirements-desktop.txt
    touch venv/.dependencies_installed
    echo -e "${GREEN}✅ Dependencies installed${NC}"
fi

# Check for required directories
if [ ! -d "src/ultimate_db_manager" ]; then
    echo -e "${RED}❌ Error: src/ultimate_db_manager directory not found${NC}"
    echo -e "${RED}   Please ensure you're running this from the project root${NC}"
    exit 1
fi

# Launch the glass interface
echo -e "${GREEN}🎯 Launching Ultimate Database Manager...${NC}"
echo ""

python launch_glass_db_manager.py

echo ""
echo -e "${GREEN}👋 Ultimate Database Manager closed. Goodbye!${NC}"