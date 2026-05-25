#!/bin/bash

# Convenience script to run database integration tests from the root directory
echo "🚀 QueryFlux Database Adapter Integration Tests"
echo "==============================================="

# Check if we're in the right directory
if [ ! -d "backend" ]; then
    echo "❌ Error: backend directory not found. Please run this from the project root."
    exit 1
fi

# Change to backend directory and run the tests
cd backend
exec ./tests/integration/database/run_tests.sh "$@"