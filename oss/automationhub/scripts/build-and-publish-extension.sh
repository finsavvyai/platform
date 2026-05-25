#!/bin/bash

# UPM.Plus Extension Build and Publish Script
# This script bumps version, builds, and publishes extensions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
EXTENSION_NAME="upm-plus-cloudflare-manager"
VERSION_FILE="mcp-servers/cloudflare-mcp-server/package.json"
MANIFEST_FILE="mcp-servers/cloudflare-mcp-server/manifest.json"
BUILD_DIR="build/extension"
OUTPUT_DIR="/Users/shaharsolomon/projects/extensions"
GITHUB_REPO="shahar-solomon/upm.plus"

echo -e "${MAGENTA}🚀 UPM.PLUS EXTENSION BUILD AND PUBLISH${NC}"
echo -e "${BLUE}Cloudflare Domain Management Extension${NC}"
echo

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"
mkdir -p "$BUILD_DIR"

# Function to bump version
bump_version() {
    echo -e "${CYAN}📈 Bumping extension version...${NC}"

    if [ -f "$VERSION_FILE" ]; then
        # Get current version
        CURRENT_VERSION=$(cat "$VERSION_FILE" | jq -r '.version')
        echo -e "${YELLOW}Current version: $CURRENT_VERSION${NC}"

        # Bump version (increment patch)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$3++; print $1"."$2"."$3}')

        # Update version file
        jq --arg new_version "$NEW_VERSION" '.version = $new_version' "$VERSION_FILE" > tmp.json && mv tmp.json "$VERSION_FILE"

        echo -e "${GREEN}✅ Version bumped to: $NEW_VERSION${NC}"
        VERSION_NUMBER="$NEW_VERSION"
    else
        # Create version file with initial version
        VERSION_NUMBER="1.0.0"
        jq -n --arg version "$VERSION_NUMBER" '{version: $version}' > "$VERSION_FILE"
        echo -e "${GREEN}✅ Initial version set to: $VERSION_NUMBER${NC}"
    fi
}

# Function to create manifest.json
create_manifest() {
    echo -e "${CYAN}📋 Creating extension manifest...${NC}"

    cat > "$MANIFEST_FILE" << EOF
{
  "name": "UPM.Plus Cloudflare Manager",
  "version": "$VERSION_NUMBER",
  "description": "Automated Cloudflare domain management for UPM.Plus multi-domain infrastructure",
  "author": "Shahar Solomon",
  "license": "MIT",
  "homepage": "https://github.com/$GITHUB_REPO",
  "repository": {
    "type": "git",
    "url": "https://github.com/$GITHUB_REPO.git"
  },
  "keywords": [
    "cloudflare",
    "domain-management",
    "upm-plus",
    "automation",
    "dns",
    "ssl",
    "cdn"
  ],
  "category": "Developer Tools",
  "main": "cloudflare-production-server.py",
  "scripts": {
    "start": "python3 cloudflare-production-server.py",
    "test": "python3 -m pytest tests/",
    "lint": "python3 -m flake8 *.py",
    "install": "pip3 install -r requirements.txt"
  },
  "dependencies": {
    "fastapi": "^0.108.0",
    "uvicorn": "^0.25.0",
    "pydantic": "^2.5.3",
    "python-dotenv": "^1.0.0",
    "httpx": "^0.26.0",
    "cloudflare": "^2.20.0"
  },
  "mcp": {
    "server": "cloudflare-production-server.py",
    "tools": [
      "get_domains",
      "create_dns_record",
      "update_dns_record",
      "delete_dns_record",
      "configure_ssl",
      "configure_security",
      "purge_cache",
      "get_analytics",
      "deploy_all_domains"
    ]
  },
  "engines": {
    "python": ">=3.9"
  },
  "files": [
    "cloudflare-production-server.py",
    "cloudflare-demo-server.py",
    "requirements.txt",
    "README.md",
    ".env.example"
  ]
}
EOF

    echo -e "${GREEN}✅ Manifest created${NC}"
}

# Function to build extension
build_extension() {
    echo -e "${CYAN}🔨 Building extension...${NC}"

    # Clean build directory
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"

    # Copy necessary files
    cp mcp-servers/cloudflare-mcp-server/cloudflare-production-server.py "$BUILD_DIR/"
    cp mcp-servers/cloudflare-mcp-server/cloudflare-demo-server.py "$BUILD_DIR/"
    cp mcp-servers/cloudflare-mcp-server/requirements.txt "$BUILD_DIR/"
    cp mcp-servers/cloudflare-mcp-server/manifest.json "$BUILD_DIR/"
    cp mcp-servers/cloudflare-mcp-server/README.md "$BUILD_DIR/" 2>/dev/null || echo "# UPM.Plus Cloudflare Manager" > "$BUILD_DIR/README.md"

    # Create .env.example
    cat > "$BUILD_DIR/.env.example" << EOF
# Cloudflare Configuration
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
CLOUDFLARE_EMAIL=your_email@example.com

# UPM.Plus Zone IDs
CLOUDFLARE_ZONE_ID_UPM_PLUS=your_upm_plus_zone_id
CLOUDFLARE_ZONE_ID_UPMPLUS_DEV=your_upmplus_dev_zone_id
CLOUDFLARE_ZONE_ID_UPMPLUS_IO=your_upmplus_io_zone_id
CLOUDFLARE_ZONE_ID_UPMPLUS_AI=your_upmplus_ai_zone_id
EOF

    # Create installation script
    cat > "$BUILD_DIR/install.sh" << 'EOF'
#!/bin/bash
# UPM.Plus Cloudflare Manager Installation Script

set -e

echo "🚀 Installing UPM.Plus Cloudflare Manager..."

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
REQUIRED_VERSION="3.9"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Python $REQUIRED_VERSION or higher is required. Found: $PYTHON_VERSION"
    exit 1
fi

echo "✅ Python version check passed: $PYTHON_VERSION"

# Install dependencies
echo "📦 Installing dependencies..."
pip3 install -r requirements.txt

# Create configuration
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "⚙️  Configuration file created: .env"
    echo "⚠️  Please edit .env with your Cloudflare credentials"
fi

# Create startup script
cat > start.sh << 'EOS'
#!/bin/bash
echo "🚀 Starting UPM.Plus Cloudflare Manager..."
python3 cloudflare-production-server.py
EOS
chmod +x start.sh

# Create test script
cat > test.sh << 'EOT'
#!/bin/bash
echo "🧪 Testing UPM.Plus Cloudflare Manager..."
curl -s http://127.0.0.1:8083/health | python3 -m json.tool
EOT
chmod +x test.sh

echo "✅ Installation completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Cloudflare credentials"
echo "2. Run ./start.sh to start the server"
echo "3. Run ./test.sh to verify installation"
echo "4. Access API at http://127.0.0.1:8083"
EOF
    chmod +x "$BUILD_DIR/install.sh"

    # Create README
    cat > "$BUILD_DIR/README.md" << EOF
# UPM.Plus Cloudflare Manager

**Version:** $VERSION_NUMBER
**Category:** Developer Tools
**License:** MIT

## Overview

UPM.Plus Cloudflare Manager is a comprehensive API server for automated Cloudflare domain management. It provides REST API endpoints for managing DNS records, SSL/TLS settings, security configurations, and more across multiple UPM.Plus domains.

## Features

- 🌐 **Multi-Domain Management**: Manage upm.plus, upmplus.dev, upmplus.io, and upmplus.ai
- 🔄 **Automated DNS Operations**: Create, update, and delete DNS records
- 🔒 **SSL/TLS Management**: Configure SSL certificates and settings
- 🛡️ **Security Configuration**: Set up WAF rules and security levels
- 📊 **Analytics Integration**: Monitor domain performance and threats
- 🚀 **Background Tasks**: Deploy all domains asynchronously

## Quick Start

### 1. Installation
\`\`\`bash
./install.sh
\`\`\`

### 2. Configuration
Edit \`.env\` with your Cloudflare credentials:
\`\`\`
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_EMAIL=your_email@example.com
\`\`\`

### 3. Start Server
\`\`\`bash
./start.sh
\`\`\`

### 4. Test Installation
\`\`\`bash
./test.sh
\`\`\`

## API Endpoints

### Server Management
- \`GET /\` - Server information
- \`GET /health\` - Health check
- \`POST /test/connection\` - Test Cloudflare API connection

### Domain Management
- \`GET /domains\` - List all UPM.Plus domains
- \`GET /upm/config\` - Get complete UPM.Plus configuration

### DNS Operations
- \`POST /dns/create\` - Create DNS record
- \`GET /dns/{domain}\` - Get DNS records for domain
- \`PUT /dns/update\` - Update DNS record
- \`DELETE /dns/{zone_id}/{record_id}\` - Delete DNS record

### SSL & Security
- \`POST /ssl/configure\` - Configure SSL/TLS settings
- \`POST /security/configure\` - Configure security settings
- \`POST /cache/purge/{domain}\` - Purge cache for domain

### Deployment
- \`POST /upm/deploy-all\` - Deploy all UPM.Plus domains

## Configuration

### UPM.Plus Domains

1. **upm.plus** (Production)
   - SSL Mode: Strict
   - Security Level: High
   - Purpose: Main production platform

2. **upmplus.dev** (Development)
   - SSL Mode: Full
   - Security Level: Medium
   - Purpose: Development and testing

3. **upmplus.io** (Staging)
   - SSL Mode: Full
   - Security Level: Medium
   - Purpose: Staging and preview

4. **upmplus.ai** (AI Services)
   - SSL Mode: Strict
   - Security Level: High
   - Purpose: AI services and ML

## Example Usage

### Create DNS Record
\`\`\`bash
curl -X POST http://127.0.0.1:8083/dns/create \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "upm.plus",
    "name": "api",
    "type": "A",
    "content": "203.0.113.101",
    "proxied": true
  }'
\`\`\`

### Configure SSL
\`\`\`bash
curl -X POST http://127.0.0.1:8083/ssl/configure \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "upm.plus",
    "ssl_mode": "strict"
  }'
\`\`\`

### Deploy All Domains
\`\`\`bash
curl -X POST http://127.0.0.1:8083/upm/deploy-all
\`\`\`

## Requirements

- Python 3.9+
- Cloudflare API token with Zone:Zone:Read and Zone:Zone:Edit permissions
- Valid Cloudflare account with the four UPM.Plus domains

## Support

- **GitHub:** https://github.com/$GITHUB_REPO
- **Issues:** https://github.com/$GITHUB_REPO/issues
- **Documentation:** https://docs.upm.plus

## License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for UPM.Plus ecosystem**
EOF

    echo -e "${GREEN}✅ Extension built successfully${NC}"
}

# Function to package extension
package_extension() {
    echo -e "${CYAN}📦 Packaging extension...${NC}"

    PACKAGE_NAME="${EXTENSION_NAME}-v${VERSION_NUMBER}"
    PACKAGE_PATH="$OUTPUT_DIR/${PACKAGE_NAME}.tar.gz"

    # Create tar.gz package
    cd "$BUILD_DIR"
    tar -czf "$PACKAGE_PATH" .
    cd - > /dev/null

    echo -e "${GREEN}✅ Extension packaged: $PACKAGE_PATH${NC}"

    # Create ZIP package for easier distribution
    ZIP_PATH="$OUTPUT_DIR/${PACKAGE_NAME}.zip"
    cd "$BUILD_DIR"
    zip -r "$ZIP_PATH" .
    cd - > /dev/null

    echo -e "${GREEN}✅ Extension packaged: $ZIP_PATH${NC}"
}

# Function to publish to GitHub (if gh CLI is available)
publish_to_github() {
    if command -v gh &> /dev/null; then
        echo -e "${CYAN}🚀 Publishing to GitHub...${NC}"

        # Create and push tag
        git tag -a "v$VERSION_NUMBER" -m "UPM.Plus Cloudflare Manager v$VERSION_NUMBER"
        git push origin "v$VERSION_NUMBER"

        # Create GitHub release
        gh release create "v$VERSION_NUMBER" \
            "$OUTPUT_DIR/${EXTENSION_NAME}-v${VERSION_NUMBER}.tar.gz" \
            "$OUTPUT_DIR/${EXTENSION_NAME}-v${VERSION_NUMBER}.zip" \
            --title "UPM.Plus Cloudflare Manager v$VERSION_NUMBER" \
            --notes "Automated Cloudflare domain management extension for UPM.Plus

## Features
- Multi-domain management for upm.plus, upmplus.dev, upmplus.io, upmplus.ai
- DNS record operations (create, update, delete)
- SSL/TLS configuration management
- Security settings configuration
- Cache management
- Analytics integration
- Background deployment tasks

## Installation
1. Download the package
2. Extract and run \`./install.sh\`
3. Configure your Cloudflare credentials in \`.env\`
4. Start the server with \`./start.sh\`

## Changes in v$VERSION_NUMBER
- Automated version bump
- Comprehensive API endpoints
- Production-ready configuration
- Full documentation and examples"

        echo -e "${GREEN}✅ Published to GitHub${NC}"
    else
        echo -e "${YELLOW}⚠️  GitHub CLI (gh) not found. Skipping GitHub publish.${NC}"
    fi
}

# Function to create symlink in extensions directory
create_symlink() {
    echo -e "${CYAN}🔗 Creating symlink in extensions directory...${NC}"

    SYMLINK_PATH="$OUTPUT_DIR/${EXTENSION_NAME}-latest"
    if [ -L "$SYMLINK_PATH" ]; then
        rm "$SYMLINK_PATH"
    fi

    ln -s "$BUILD_DIR" "$SYMLINK_PATH"
    echo -e "${GREEN}✅ Symlink created: $SYMLINK_PATH${NC}"
}

# Function to display completion message
completion_message() {
    echo
    echo -e "${MAGENTA}🎉 EXTENSION BUILD AND PUBLISH COMPLETED!${NC}"
    echo
    echo -e "${CYAN}📦 Build Artifacts:${NC}"
    echo -e "   📁 Build Directory: $BUILD_DIR"
    echo -e "   📄 Package (tar.gz): $OUTPUT_DIR/${EXTENSION_NAME}-v${VERSION_NUMBER}.tar.gz"
    echo -e "   📄 Package (zip): $OUTPUT_DIR/${EXTENSION_NAME}-v${VERSION_NUMBER}.zip"
    echo -e "   🔗 Latest Version: $OUTPUT_DIR/${EXTENSION_NAME}-latest"
    echo
    echo -e "${CYAN}📋 Extension Details:${NC}"
    echo -e "   📛 Name: $EXTENSION_NAME"
    echo -e "   🏷️  Version: $VERSION_NUMBER"
    echo -e "   📝 Description: UPM.Plus Cloudflare Domain Management"
    echo -e "   📂 Location: $OUTPUT_DIR"
    echo
    echo -e "${CYAN}🚀 Next Steps:${NC}"
    echo -e "   1. Test the extension: cd $BUILD_DIR && ./install.sh"
    echo -e "   2. Configure Cloudflare credentials in .env"
    echo -e "   3. Start the server: ./start.sh"
    echo -e "   4. Verify installation: ./test.sh"
    echo
    echo -e "${GREEN}✨ Your UPM.Plus Cloudflare Manager extension is ready!${NC}"
}

# Main execution flow
main() {
    echo -e "${BLUE}Starting build process...${NC}"
    echo

    bump_version
    create_manifest
    build_extension
    package_extension
    create_symlink
    publish_to_github
    completion_message
}

# Check if we're in the right directory
if [ ! -f "scripts/build-and-publish-extension.sh" ]; then
    echo -e "${RED}❌ Error: Please run this script from the UPM.Plus root directory${NC}"
    exit 1
fi

# Run main function
main "$@"