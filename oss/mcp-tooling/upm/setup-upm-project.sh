#!/bin/bash

# UPM Project Setup Script
# This script helps you set up UPM in any project

set -e

echo "🚀 UPM Project Setup"
echo "==================="

# Get project details
read -p "Enter project name: " PROJECT_NAME
read -p "Enter organization: " ORGANIZATION
read -p "Enter target language (java/python/javascript/go/rust): " TARGET_LANGUAGE

echo ""
echo "Setting up UPM for project: $PROJECT_NAME"
echo "Organization: $ORGANIZATION"
echo "Target Language: $TARGET_LANGUAGE"
echo ""

# Create upm.yml based on target language
case $TARGET_LANGUAGE in
    "java")
        echo "Setting up UPM for Java project..."
        cat > upm.yml << EOF
# UPM Configuration for Java Project
project: $PROJECT_NAME
organization: $ORGANIZATION
target_language: java
java_version: 8

upm_platform:
  base_url: "http://upmplus.dev"
  api_endpoint: "http://upmplus.dev"
  api_key: "$PROJECT_NAME-api-key"
  timeout: 30000
  retry_attempts: 3

bridges:
  python:
    runtime: jython
    version: "3.8"
    enabled: true
    upm_endpoint: "http://upmplus.dev/python"

  javascript:
    runtime: graalvm
    version: "es2020"
    enabled: true
    upm_endpoint: "http://upmplus.dev/javascript"

  rust:
    runtime: jni
    enabled: false
    upm_endpoint: "http://upmplus.dev/rust"

dependencies:
  java:
    - "io.helidon:helidon-se:1.3.1"
    - "org.postgresql:postgresql:42.2.25"
  python:
    - "requests:2.28.1"
    - "pandas:2.1.0"
  javascript:
    - "lodash:4.17.21"
    - "moment:2.29.4"
EOF
        ;;
    
    "python")
        echo "Setting up UPM for Python project..."
        cat > upm.yml << EOF
# UPM Configuration for Python Project
project: $PROJECT_NAME
organization: $ORGANIZATION
target_language: python
python_version: 3.11

upm_platform:
  base_url: "http://upmplus.dev"
  api_endpoint: "http://upmplus.dev"
  api_key: "$PROJECT_NAME-api-key"
  timeout: 30000
  retry_attempts: 3

bridges:
  javascript:
    runtime: pyodide
    version: "es2020"
    enabled: true
    upm_endpoint: "http://upmplus.dev/javascript"

  rust:
    runtime: pyo3
    enabled: true
    upm_endpoint: "http://upmplus.dev/rust"

dependencies:
  python:
    - "fastapi:0.104.1"
    - "pydantic:2.5.0"
  javascript:
    - "d3:7.8.0"
    - "plotly:2.26.0"
  rust:
    - "serde:1.0.0"
    - "tokio:1.0.0"
EOF
        ;;
    
    "javascript")
        echo "Setting up UPM for JavaScript project..."
        cat > upm.yml << EOF
# UPM Configuration for JavaScript Project
project: $PROJECT_NAME
organization: $ORGANIZATION
target_language: javascript
node_version: 18

upm_platform:
  base_url: "http://upmplus.dev"
  api_endpoint: "http://upmplus.dev"
  api_key: "$PROJECT_NAME-api-key"
  timeout: 30000
  retry_attempts: 3

bridges:
  python:
    runtime: node-python
    version: "3.11"
    enabled: true
    upm_endpoint: "http://upmplus.dev/python"

  rust:
    runtime: wasm
    enabled: true
    upm_endpoint: "http://upmplus.dev/rust"

dependencies:
  javascript:
    - "express:4.18.2"
    - "react:18.2.0"
  python:
    - "fastapi:0.104.1"
    - "pydantic:2.5.0"
  rust:
    - "serde:1.0.0"
    - "tokio:1.0.0"
EOF
        ;;
    
    "go")
        echo "Setting up UPM for Go project..."
        cat > upm.yml << EOF
# UPM Configuration for Go Project
project: $PROJECT_NAME
organization: $ORGANIZATION
target_language: go
go_version: 1.21

upm_platform:
  base_url: "http://upmplus.dev"
  api_endpoint: "http://upmplus.dev"
  api_key: "$PROJECT_NAME-api-key"
  timeout: 30000
  retry_attempts: 3

bridges:
  python:
    runtime: cgo
    version: "3.11"
    enabled: true
    upm_endpoint: "http://upmplus.dev/python"

  rust:
    runtime: cgo
    enabled: true
    upm_endpoint: "http://upmplus.dev/rust"

dependencies:
  go:
    - "github.com/gin-gonic/gin:v1.9.1"
    - "github.com/gorilla/websocket:v1.5.0"
  python:
    - "fastapi:0.104.1"
    - "uvicorn:0.24.0"
  rust:
    - "serde:1.0.0"
    - "tokio:1.0.0"
EOF
        ;;
    
    "rust")
        echo "Setting up UPM for Rust project..."
        cat > upm.yml << EOF
# UPM Configuration for Rust Project
project: $PROJECT_NAME
organization: $ORGANIZATION
target_language: rust
rust_version: 1.75

upm_platform:
  base_url: "http://upmplus.dev"
  api_endpoint: "http://upmplus.dev"
  api_key: "$PROJECT_NAME-api-key"
  timeout: 30000
  retry_attempts: 3

bridges:
  python:
    runtime: pyo3
    version: "3.11"
    enabled: true
    upm_endpoint: "http://upmplus.dev/python"

  javascript:
    runtime: wasm
    enabled: true
    upm_endpoint: "http://upmplus.dev/javascript"

dependencies:
  rust:
    - "serde:1.0.0"
    - "tokio:1.0.0"
  python:
    - "fastapi:0.104.1"
    - "pydantic:2.5.0"
  javascript:
    - "express:4.18.2"
    - "react:18.2.0"
EOF
        ;;
    
    *)
        echo "❌ Unsupported target language: $TARGET_LANGUAGE"
        echo "Supported languages: java, python, javascript, go, rust"
        exit 1
        ;;
esac

echo "✅ UPM configuration created: upm.yml"
echo ""

# Test UPM platform connection
echo "🧪 Testing UPM platform connection..."
if curl -s http://upmplus.dev/health > /dev/null; then
    echo "✅ UPM platform is accessible"
else
    echo "❌ UPM platform is not accessible"
    echo "Please check your internet connection and try again"
fi

echo ""
echo "🚀 Next steps:"
echo "1. Review the upm.yml configuration"
echo "2. Add your project-specific dependencies"
echo "3. Generate bridge classes: upm generate-bridges"
echo "4. Start using cross-language libraries in your code!"
echo ""
echo "📚 Documentation: http://upmplus.dev/docs"
echo "🔧 Health Check: http://upmplus.dev/health"
echo ""
echo "✅ UPM setup complete for $PROJECT_NAME!"


