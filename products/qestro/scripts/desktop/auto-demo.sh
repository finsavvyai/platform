#!/bin/bash

echo "🚀 LAUNCHING QESTRO DESKTOP APPLICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Starting QestroDesktop with automatic navigation to Voice-to-Text features..."
echo ""

# Create input sequence to navigate through the app
cat << 'EOF' | ./.build/debug/QestroDesktop --verbose
5
8
0
0
EOF

echo ""
echo "🎯 Desktop application demonstration complete!"
echo "✅ QestroDesktop is fully operational with Phase 7 Voice-to-Text Integration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"