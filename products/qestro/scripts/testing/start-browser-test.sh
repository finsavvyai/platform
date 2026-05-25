#!/bin/bash

# Enterprise Testing System - Browser Test Startup Script

echo "🚀 Starting Enterprise Testing System Browser Test"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Navigate to backend directory
cd backend

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🔧 Starting test server..."
echo "📡 Server will be available at: http://localhost:3001"
echo "🌐 Open your browser and navigate to the URL above"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the test server
node test-server.js