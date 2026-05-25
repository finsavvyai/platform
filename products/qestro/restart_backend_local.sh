#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting backend restart process...${NC}"

# Find process on port 8000
PORT=8000
PID=$(lsof -t -i:$PORT)

if [ -n "$PID" ]; then
    echo -e "${RED}Process found on port $PORT (PID: $PID). Killing it...${NC}"
    kill -9 $PID
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Process $PID killed successfully.${NC}"
    else
        echo -e "${RED}Failed to kill process $PID.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}No process found on port $PORT.${NC}"
fi

# Navigate to backend directory
BACKEND_DIR="./backend"
if [ -d "$BACKEND_DIR" ]; then
    echo -e "${YELLOW}Navigating to backend directory...${NC}"
    cd "$BACKEND_DIR" || exit
else
    echo -e "${RED}Backend directory not found at $BACKEND_DIR.${NC}"
    exit 1
fi

# Start the backend server
echo -e "${GREEN}Starting backend server with 'npm run dev'...${NC}"
npm run dev
