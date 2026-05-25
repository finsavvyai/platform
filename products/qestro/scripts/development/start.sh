#!/bin/bash

# 🚀 Qestro Quick Start Script
# Quickly start all Qestro services

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}  🚀 Qestro Platform - Quick Start${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Call the main build script with run-only option
exec ./build-and-run.sh --run-only "$@"