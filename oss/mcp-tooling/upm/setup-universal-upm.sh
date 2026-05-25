#!/bin/bash

# Universal UPM Setup Script
# Works with any project - not just TEDDK!

set -e

echo "🚀 Universal UPM Setup"
echo "======================"

# Check if we're in a project directory
if [ ! -f "pom.xml" ] && [ ! -f "build.gradle" ] && [ ! -f "package.json" ]; then
    echo "❌ Error: No project file found (pom.xml, build.gradle, or package.json)"
    echo "Please run this script from your project root directory"
    exit 1
fi

echo "✅ Project detected"

# Detect project type
if [ -f "pom.xml" ]; then
    PROJECT_TYPE="Maven"
    echo "📦 Maven project detected"
elif [ -f "build.gradle" ]; then
    PROJECT_TYPE="Gradle"
    echo "📦 Gradle project detected"
elif [ -f "package.json" ]; then
    PROJECT_TYPE="Node.js"
    echo "📦 Node.js project detected"
fi

echo ""

# Create universal UPM configuration
echo "📝 Creating universal UPM configuration..."
cat > upm.yml << 'EOF'
# Universal UPM Configuration
project: universal
upm_endpoint: "https://upmplus.dev"

# Universal Python packages
python:
  - "requests:2.28.1"          # HTTP client
  - "pandas:2.1.0"             # Data processing
  - "numpy:1.24.0"             # Numerical computing
  - "matplotlib:3.7.0"         # Plotting
  - "scikit-learn:1.3.0"       # Machine learning
  - "beautifulsoup4:4.12.0"    # Web scraping
  - "paramiko:2.12.0"          # SSH/SFTP

# Universal JavaScript packages
javascript:
  - "lodash:4.17.21"           # Utility functions
  - "moment:2.29.4"            # Date manipulation
  - "axios:1.4.0"              # HTTP client
  - "csv-parser:3.0.0"        # CSV processing
  - "jsonwebtoken:9.0.0"       # JWT handling
  - "crypto-js:4.1.1"          # Encryption
EOF

echo "✅ Created universal upm.yml configuration"
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
echo "📋 Next steps for $PROJECT_TYPE project:"
echo ""

if [ "$PROJECT_TYPE" = "Maven" ]; then
    echo "1. Add these dependencies to your pom.xml:"
    echo "   - org.python:jython-standalone:2.7.3"
    echo "   - org.graalvm.js:js:22.3.0"
    echo "   - com.squareup.okhttp3:okhttp:4.11.0"
    echo ""
    echo "2. Copy the universal UPM classes to src/main/java/com/upm/"
    echo "3. Build: mvn clean compile"
    echo "4. Test: mvn test"
elif [ "$PROJECT_TYPE" = "Gradle" ]; then
    echo "1. Add these dependencies to your build.gradle:"
    echo "   - implementation 'org.python:jython-standalone:2.7.3'"
    echo "   - implementation 'org.graalvm.js:js:22.3.0'"
    echo "   - implementation 'com.squareup.okhttp3:okhttp:4.11.0'"
    echo ""
    echo "2. Copy the universal UPM classes to src/main/java/com/upm/"
    echo "3. Build: ./gradlew build"
    echo "4. Test: ./gradlew test"
elif [ "$PROJECT_TYPE" = "Node.js" ]; then
    echo "1. Install UPM dependencies:"
    echo "   - npm install jython-standalone"
    echo "   - npm install @graalvm/js"
    echo ""
    echo "2. Copy the universal UPM classes to src/upm/"
    echo "3. Build: npm run build"
    echo "4. Test: npm test"
fi

echo ""
echo "📚 Universal Integration Guide: /Users/shaharsolomon/Documents/UPM/universal-upm-integration.md"
echo ""
echo "🌐 UPM Platform: https://upmplus.dev/"
echo "✅ Universal UPM setup complete for $PROJECT_TYPE project!"

