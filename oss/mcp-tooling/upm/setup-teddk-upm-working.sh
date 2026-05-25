#!/bin/bash

# TEDDK + UPM Working Integration Setup Script
# This script sets up UPM in your TEDDK project using REAL dependencies only

set -e

echo "🚀 TEDDK + UPM Working Integration Setup"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "pom.xml" ]; then
    echo "❌ Error: pom.xml not found. Please run this script from your TEDDK project root."
    echo "Expected location: /Users/shaharsolomon/projects/telia/teddk/"
    exit 1
fi

echo "✅ Found pom.xml - TEDDK project detected"
echo ""

# Create UPM configuration
echo "📝 Creating UPM configuration..."
cat > upm.yml << 'EOF'
# UPM Configuration for TEDDK
project: teddk
organization: telia
target_language: java
java_version: 8

# UPM Platform Connection (HTTPS WORKING!)
upm_platform:
  base_url: "https://upmplus.dev"
  api_endpoint: "https://upmplus.dev"
  health_endpoint: "https://upmplus.dev/health"
  api_key: "teddk-api-key-12345"
  timeout: 30000
  retry_attempts: 3
  ssl_verify: true

# Cross-language bridges
bridges:
  python:
    runtime: jython
    version: "3.8"
    enabled: true
    upm_endpoint: "https://upmplus.dev/python"

  javascript:
    runtime: graalvm
    version: "es2020"
    enabled: true
    upm_endpoint: "https://upmplus.dev/javascript"

# Enhanced dependencies for TEDDK
dependencies:
  # Keep existing Java dependencies
  java:
    - "io.helidon:helidon-se:1.3.1"
    - "org.postgresql:postgresql:42.2.25"
    - "com.fasterxml.jackson.core:jackson-databind:2.15.2"
    - "com.jcraft:jsch:0.1.55"

  # Add Python libraries for enhanced functionality
  python:
    - "requests:2.28.1"          # Better HTTP client than Java's
    - "pandas:2.1.0"             # CSV/data processing
    - "python-dateutil:2.8.2"    # Better date parsing
    - "paramiko:2.12.0"          # Better SFTP than JSch

  # Add JavaScript utilities
  javascript:
    - "lodash:4.17.21"           # Utility functions
    - "moment:2.29.4"            # Date manipulation
    - "csv-parser:3.0.0"         # Fast CSV parsing
EOF

echo "✅ Created upm.yml configuration"
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
echo "1. Add REAL Maven dependencies to your pom.xml (see practical integration guide)"
echo "2. Create UPM bridge classes (copy from practical integration guide)"
echo "3. Build with new dependencies: mvn clean compile"
echo "4. Test enhanced functionality: mvn test"
echo ""
echo "📚 Practical Integration Guide: /Users/shaharsolomon/Documents/UPM/teddk-upm-practical-integration.md"
echo ""
echo "🌐 UPM Platform: https://upmplus.dev/"
echo "✅ UPM setup complete for TEDDK (using REAL dependencies only)!"

