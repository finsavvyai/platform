#!/bin/bash

# Ultimate Database Manager Launcher Script
# This script launches the desktop application with proper environment setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"
APP_FILE="$SCRIPT_DIR/apps/ultimate_apple_db_manager.py"

echo -e "${BLUE}🚀 Ultimate Database Manager Launcher${NC}"
echo -e "${BLUE}======================================${NC}"

# Check if virtual environment exists
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not found. Setting up...${NC}"
    
    # Create virtual environment
    python3 -m venv "$VENV_DIR"
    
    # Activate and install dependencies
    source "$VENV_DIR/bin/activate"
    
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    pip install --upgrade pip
    pip install PySide6 psycopg2-binary pymongo redis docker
    
    echo -e "${GREEN}✅ Virtual environment setup complete!${NC}"
else
    echo -e "${GREEN}✅ Virtual environment found${NC}"
fi

# Check if main app exists
if [ ! -f "$APP_FILE" ]; then
    echo -e "${RED}❌ Main application not found at: $APP_FILE${NC}"
    exit 1
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Launch the application
echo -e "${BLUE}🖥️  Starting Ultimate Database Manager...${NC}"
echo -e "${BLUE}📁 App directory: $SCRIPT_DIR${NC}"
echo -e "${BLUE}🐍 Python version: $(python --version)${NC}"

# Run the application
cd "$SCRIPT_DIR"
python "$APP_FILE"

echo -e "${YELLOW}👋 Application closed${NC}"
