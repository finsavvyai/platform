#!/bin/bash

# Configure teddk to use cloud-deployed UDP service

set -e

echo "🔧 Configuring teddk to use UDP cloud service..."

# Check if udp-config.env exists
if [ ! -f "udp-config.env" ]; then
    echo "❌ udp-config.env not found. Please run deploy-to-gcp.sh first."
    exit 1
fi

# Load UDP configuration
source udp-config.env

# Navigate to teddk project
TEDDK_PATH="/Users/shaharsolomon/projects/telia/teddk"
if [ ! -d "$TEDDK_PATH" ]; then
    echo "❌ teddk project not found at $TEDDK_PATH"
    exit 1
fi

cd "$TEDDK_PATH"

echo "📋 Configuring teddk with:"
echo "  UDP Service URL: $UDP_SERVICE_URL"
echo "  Project ID: $UDP_PROJECT_ID"

# Update pom.xml with UDP service URL
echo "📝 Updating pom.xml configuration..."

# Backup original pom.xml
cp pom.xml pom.xml.backup

# Update UDP plugin configuration
cat > temp_plugin_config.xml << EOF
<plugin>
    <groupId>com.udp</groupId>
    <artifactId>udp-maven-plugin</artifactId>
    <version>1.0.0</version>
    <configuration>
        <configFile>udp.yml</configFile>
        <generateBridges>true</generateBridges>
        <bridgePackage>telia.server.udp.bridges</bridgePackage>
        <udpServiceUrl>$UDP_SERVICE_URL</udpServiceUrl>
        <enableCloudMode>true</enableCloudMode>
    </configuration>
    <executions>
        <execution>
            <phase>generate-sources</phase>
            <goals>
                <goal>setup-bridges</goal>
                <goal>download-dependencies</goal>
            </goals>
        </execution>
    </executions>
</plugin>
EOF

# Update udp.yml with cloud configuration
echo "📝 Updating udp.yml configuration..."
cat > udp.yml << EOF
project: teddk
organization: telia
target_language: java
java_version: 8

# UDP Cloud Service Configuration
udp_service:
  url: "$UDP_SERVICE_URL"
  enabled: true
  timeout: 30
  retry_attempts: 3

# Enable cross-language bridges
bridges:
  python:
    runtime: jython
    version: "3.8"
    enabled: true

  javascript:
    runtime: graalvm
    version: "es2020"
    enabled: true

  rust:
    runtime: jni
    enabled: false  # Start with false, enable later

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
    - "pandas:1.5.2"             # CSV/data processing
    - "python-dateutil:2.8.2"    # Better date parsing
    - "paramiko:2.12.0"          # Better SFTP than JSch

  # Add JavaScript utilities
  javascript:
    - "lodash:4.17.21"           # Utility functions
    - "moment:2.29.4"            # Date manipulation
    - "csv-parser:3.0.0"         # Fast CSV parsing

# Build optimization
build:
  cache_dependencies: true
  parallel_downloads: true
  bridge_optimization: true
EOF

# Create Maven settings for UDP plugin repository
echo "📝 Creating Maven settings.xml..."
cat > settings-udp.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0
          http://maven.apache.org/xsd/settings-1.0.0.xsd">

  <profiles>
    <profile>
      <id>udp-cloud</id>
      <properties>
        <udp.service.url>$UDP_SERVICE_URL</udp.service.url>
        <udp.cloud.enabled>true</udp.cloud.enabled>
      </properties>
    </profile>
  </profiles>

  <activeProfiles>
    <activeProfile>udp-cloud</activeProfile>
  </activeProfiles>

</settings>
EOF

# Test UDP service connectivity
echo "🧪 Testing UDP service connectivity..."
if curl -f -s "$UDP_SERVICE_URL/health" > /dev/null; then
    echo "✅ UDP service is accessible!"
else
    echo "❌ UDP service is not accessible. Please check deployment."
    exit 1
fi

# Test UDP API endpoints
echo "🧪 Testing UDP API endpoints..."
if curl -f -s "$UDP_SERVICE_URL/api/v1/dependencies" > /dev/null; then
    echo "✅ UDP API endpoints are working!"
else
    echo "⚠️ UDP API endpoints may not be fully ready yet."
fi

echo "✅ teddk configuration completed!"
echo ""
echo "🚀 Next steps:"
echo "1. Test the configuration:"
echo "   cd $TEDDK_PATH"
echo "   mvn clean compile -s settings-udp.xml"
echo ""
echo "2. If you get plugin resolution errors, first build the UDP Maven plugin:"
echo "   cd /Users/shaharsolomon/Documents/UPM/src/udp/plugins/maven"
echo "   mvn clean install"
echo ""
echo "3. Monitor UDP service logs:"
echo "   kubectl logs -l app=udp-api -n udp --follow"
echo ""
echo "📋 Configuration summary:"
echo "  ✅ UDP Service URL: $UDP_SERVICE_URL"
echo "  ✅ udp.yml updated with cloud configuration"
echo "  ✅ Maven settings configured for UDP"
echo "  ✅ Service connectivity verified"

# Create a test script
cat > test-udp-integration.sh << EOF
#!/bin/bash
echo "🧪 Testing UDP integration with teddk..."

# Test 1: UDP service health
echo "1. Testing UDP service health..."
curl -s "$UDP_SERVICE_URL/health" | jq .

# Test 2: Dependency analysis
echo "2. Testing dependency analysis..."
curl -s -X POST "$UDP_SERVICE_URL/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d @udp.yml | jq .

# Test 3: Bridge generation
echo "3. Testing bridge generation..."
curl -s -X POST "$UDP_SERVICE_URL/api/v1/bridges/generate" \
  -H "Content-Type: application/json" \
  -d '{"project": "teddk", "target_language": "java", "bridges": ["python", "javascript"]}' | jq .

echo "✅ UDP integration tests completed!"
EOF

chmod +x test-udp-integration.sh

echo "🎯 Created test script: test-udp-integration.sh"
echo "   Run it to verify full UDP integration!"