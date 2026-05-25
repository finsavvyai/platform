#!/bin/bash

# 🚀 Questro Development Server Startup Script
# Start backend and frontend development servers concurrently

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                QUESTRO DEV SERVER                        ║"
echo "║               Starting Development! 🚀                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}🌟 STARTING QUESTRO DEVELOPMENT ENVIRONMENT${NC}"
echo
echo "🔧 Development Configuration:"
echo "• Backend API: http://localhost:8000"
echo "• Frontend App: http://localhost:3000"
echo "• Environment: Development"
echo "• Database: In-memory SQLite (no setup required)"
echo "• Payments: Test mode"
echo "• AI: Mock responses"
echo

# Check if port 8000 is available
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  Port 8000 is already in use. Stopping existing process...${NC}"
    kill -9 $(lsof -ti:8000) 2>/dev/null || true
    sleep 2
fi

# Check if port 3000 is available
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  Port 3000 is already in use. Stopping existing process...${NC}"
    kill -9 $(lsof -ti:3000) 2>/dev/null || true
    sleep 2
fi

echo -e "${CYAN}📦 Installing dependencies if needed...${NC}"
cd backend && npm install --silent &
cd ../frontend && npm install --silent &
wait

echo -e "${GREEN}✅ Dependencies ready!${NC}"
echo

echo -e "${CYAN}🚀 Starting development servers...${NC}"

# Function to start backend with proper error handling
start_backend() {
    cd backend
    echo -e "${BLUE}Starting backend server...${NC}"
    # Use tsx for development with auto-restart
    npx tsx watch src/index.ts 2>&1 | while read line; do
        echo -e "${GREEN}[Backend]${NC} $line"
    done
}

# Function to start frontend with proper error handling  
start_frontend() {
    cd frontend
    # Wait a moment for backend to start
    sleep 3
    echo -e "${BLUE}Starting frontend server...${NC}"
    npm run dev 2>&1 | while read line; do
        echo -e "${CYAN}[Frontend]${NC} $line"
    done
}

# Start both servers in background
start_backend &
BACKEND_PID=$!

start_frontend &
FRONTEND_PID=$!

echo
echo -e "${GREEN}🌟 DEVELOPMENT SERVERS STARTING!${NC}"
echo -e "${YELLOW}Backend PID: $BACKEND_PID${NC}"
echo -e "${YELLOW}Frontend PID: $FRONTEND_PID${NC}"
echo
echo -e "${CYAN}📊 Access your application:${NC}"
echo "• Frontend: http://localhost:3000"
echo "• Backend API: http://localhost:8000"
echo "• API Health: http://localhost:8000/health"
echo
echo -e "${PURPLE}🔧 Development Tools:${NC}"
echo "• Backend logs: Watch above for [Backend] messages"
echo "• Frontend logs: Watch above for [Frontend] messages"
echo "• API testing: Use curl or Postman to test http://localhost:8000"
echo
echo -e "${GREEN}💡 Tips:${NC}"
echo "• Make changes to code - servers will auto-restart"
echo "• Check browser console for frontend errors"
echo "• Check terminal logs for backend errors"
echo "• Press Ctrl+C to stop all servers"
echo

# Function to cleanup on exit
cleanup() {
    echo
    echo -e "${YELLOW}🛑 Stopping development servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    # Kill any remaining processes on our ports
    kill -9 $(lsof -ti:8000) 2>/dev/null || true
    kill -9 $(lsof -ti:3000) 2>/dev/null || true
    echo -e "${GREEN}✅ Development servers stopped${NC}"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup INT TERM

# Wait for background processes
wait