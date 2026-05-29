#!/bin/bash

# QueryLens Quick Start Script
# This script sets up and runs QueryLens with a single command

echo "🚀 QueryLens Quick Start"
echo "========================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Java
echo -e "\n${YELLOW}Checking Java...${NC}"
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
    if [ "$JAVA_VERSION" -ge 21 ]; then
        echo -e "${GREEN}✓ Java $JAVA_VERSION found${NC}"
    else
        echo -e "${RED}✗ Java 21+ required (found Java $JAVA_VERSION)${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Java not found${NC}"
    echo "Please install Java 21 or higher"
    exit 1
fi

# Check Maven
echo -e "\n${YELLOW}Checking Maven...${NC}"
if command -v mvn &> /dev/null; then
    echo -e "${GREEN}✓ Maven found${NC}"
else
    echo -e "${RED}✗ Maven not found${NC}"
    echo "Please install Maven 3.8+"
    exit 1
fi

# Build project
echo -e "\n${YELLOW}Building QueryLens...${NC}"
mvn clean compile -q
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Check if port 8080 is available
echo -e "\n${YELLOW}Checking port 8080...${NC}"
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}✗ Port 8080 is already in use${NC}"
    echo "Stop the other application or change the port in application.properties"
    exit 1
else
    echo -e "${GREEN}✓ Port 8080 is available${NC}"
fi

# Start application
echo -e "\n${YELLOW}Starting QueryLens...${NC}"
echo -e "${GREEN}➜ Application will start at: http://localhost:8080${NC}"
echo -e "${GREEN}➜ Press Ctrl+C to stop${NC}"
echo ""

# Run the application
mvn spring-boot:run