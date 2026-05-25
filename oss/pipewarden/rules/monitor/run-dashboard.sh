#!/bin/bash

# Development script to run frontend and backend separately
echo "Starting BSL Monitor Dashboard in development mode..."

# Kill any existing processes
pkill -f "spring-boot" 2>/dev/null
pkill -f "react-scripts" 2>/dev/null

# Start Spring Boot backend
echo "Starting Spring Boot backend on port 9098..."
./gradlew bootRun &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 10

# Start React frontend
echo "Starting React frontend on port 3000..."
cd frontend
npm start &
FRONTEND_PID=$!

echo "Dashboard started!"
echo "Backend PID: $BACKEND_PID (port 9098)"
echo "Frontend PID: $FRONTEND_PID (port 3000)"
echo ""
echo "Access the dashboard at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both services..."

# Wait for interrupt
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait