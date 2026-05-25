#!/bin/bash

# UPM.Plus - Run All Examples
# This script runs all automation examples sequentially

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║           UPM.Plus - Running All Examples                   ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")/.."

# Master demo
echo "🚀 Running master demo..."
python3.12 examples/complete_automation_examples.py

echo ""
echo "="
echo "✅ All examples completed!"
echo "📊 Check examples/ directory for more specific examples"
echo "📚 See examples/README.md for full documentation"
echo ""
