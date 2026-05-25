#!/bin/bash

# TEDDK + UPM Simple Setup Script
# Minimal configuration, no complex YAML

set -e

echo "🚀 TEDDK + UPM Simple Setup"
echo "============================"

# Check if we're in the right directory
if [ ! -f "pom.xml" ]; then
    echo "❌ Error: pom.xml not found. Please run this script from your TEDDK project root."
    echo "Expected location: /Users/shaharsolomon/projects/telia/teddk/"
    exit 1
fi

echo "✅ Found pom.xml - TEDDK project detected"
echo ""

# Create simple UPM configuration
echo "📝 Creating simple UPM configuration..."
cat > upm.yml << 'EOF'
# UPM Configuration for TEDDK (Simple)
project: teddk
upm_endpoint: "https://upmplus.dev"

# Just the essentials
python:
  - "requests:2.28.1"
  - "pandas:2.1.0"

javascript:
  - "lodash:4.17.21"
EOF

echo "✅ Created simple upm.yml configuration"
echo ""

# Test UPM platform connectivity
echo "🧪 Testing UPM platform connectivity..."
if curl -s https://upmplus.dev/ > /dev/null; then
    echo "✅ UPM platform is accessible"
else
    echo "❌ UPM platform is not accessible"
    echo "Please check your internet connection and try again"
fi

echo ""
echo "📋 Next steps:"
echo "1. Add these simple dependencies to your pom.xml:"
echo "   - org.python:jython-standalone:2.7.3"
echo "   - org.graalvm.js:js:22.3.0"
echo ""
echo "2. Copy the simple UPM classes from the guide"
echo "3. Build: mvn clean compile"
echo "4. Test: mvn test"
echo ""
echo "📚 Simple Integration Guide: /Users/shaharsolomon/Documents/UPM/teddk-upm-simple-config.md"
echo ""
echo "🌐 UPM Platform: https://upmplus.dev/"
echo "✅ Simple UPM setup complete for TEDDK!"

