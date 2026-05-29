#!/bin/bash
# QueryLens Restart Script
# This script stops any running QueryLens instances and starts a fresh one on port 8085

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}QueryLens Restart Script${NC}"
echo "================================================="

# Define the target port
PORT=8085

# Function to check if a port is in use
port_in_use() {
  lsof -i :$1 &> /dev/null
}

# Stop any existing Spring Boot application
echo -e "${YELLOW}Stopping any running QueryLens instances...${NC}"
pkill -f "spring-boot:run" || true
sleep 2

# Kill any process using our target port
if port_in_use $PORT; then
  echo -e "${YELLOW}Port $PORT is in use. Attempting to free it...${NC}"
  PID=$(lsof -ti :$PORT)
  if [ ! -z "$PID" ]; then
    echo -e "${YELLOW}Killing process $PID that is using port $PORT...${NC}"
    kill -9 $PID
    sleep 1
  fi
fi

# Verify port is now available
if port_in_use $PORT; then
  echo -e "${RED}Could not free port $PORT. Please free it manually and try again.${NC}"
  exit 1
else
  echo -e "${GREEN}Port $PORT is available.${NC}"
fi

# Build the application if needed
if [ "$1" == "-b" ] || [ "$1" == "--build" ]; then
  echo -e "${YELLOW}Building the application...${NC}"
  mvn clean package -DskipTests
  if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
  fi
  echo -e "${GREEN}Build completed successfully.${NC}"
fi

# Start the application
echo -e "${YELLOW}Starting QueryLens on port $PORT...${NC}"
mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=$PORT &

# Wait for the application to start
echo -e "${YELLOW}Waiting for QueryLens to start...${NC}"
for i in {1..30}; do
  if curl -s http://localhost:$PORT > /dev/null; then
    echo -e "${GREEN}QueryLens started successfully! Running on port $PORT${NC}"
    echo -e "${GREEN}Access the API at: http://localhost:$PORT${NC}"
    echo -e "${GREEN}H2 Console available at: http://localhost:$PORT/h2-console${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}Timeout waiting for QueryLens to start.${NC}"
    echo -e "${YELLOW}Check logs for errors. The process might still be starting up.${NC}"
  fi
  echo -n "."
  sleep 1
done

echo -e "\n${YELLOW}=================================================${NC}"
echo -e "${GREEN}Use 'pkill -f \"spring-boot:run\"' to stop the application when done.${NC}"
