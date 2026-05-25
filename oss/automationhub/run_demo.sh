#!/bin/bash

# UPM.Plus Production Features Demo Runner
# This script helps you run the demo easily

echo "🚀 UPM.Plus Production Features Demo"
echo "===================================="
echo ""

# Check if server is running
echo "Checking if server is running..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Server is running!"
else
    echo "❌ Server is not running!"
    echo ""
    echo "Please start the server first:"
    echo "  cd backend"
    echo "  uvicorn app.main:app --reload"
    echo ""
    read -p "Press Enter to continue anyway or Ctrl+C to exit..."
fi

echo ""
echo "Choose demo type:"
echo "1. Python CLI Demo (recommended)"
echo "2. Web Interface Demo"
echo "3. Both"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "Running Python CLI Demo..."
        python3 demo_production_features.py
        ;;
    2)
        echo ""
        echo "Opening Web Interface Demo..."
        echo "The demo will open in your browser."
        echo "If it doesn't open automatically, navigate to:"
        echo "  file://$(pwd)/demo_web_interface.html"
        echo ""
        
        # Try to open in browser
        if command -v xdg-open > /dev/null; then
            xdg-open demo_web_interface.html
        elif command -v open > /dev/null; then
            open demo_web_interface.html
        elif command -v start > /dev/null; then
            start demo_web_interface.html
        else
            echo "Please open demo_web_interface.html in your browser manually."
        fi
        ;;
    3)
        echo ""
        echo "Running Python CLI Demo..."
        python3 demo_production_features.py
        echo ""
        echo "Opening Web Interface Demo..."
        if command -v xdg-open > /dev/null; then
            xdg-open demo_web_interface.html
        elif command -v open > /dev/null; then
            open demo_web_interface.html
        elif command -v start > /dev/null; then
            start demo_web_interface.html
        fi
        ;;
    *)
        echo "Invalid choice. Running Python CLI Demo by default..."
        python3 demo_production_features.py
        ;;
esac

echo ""
echo "Demo complete! 🎉"

