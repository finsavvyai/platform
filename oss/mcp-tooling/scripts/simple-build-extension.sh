#!/bin/bash

# Simple Extension Build Script
# Packages the extension without complex builds

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Extension directory
EXTENSION_DIR="/Users/shaharsolomon/projects/extensions"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

info() {
    echo -e "${CYAN}ℹ️ $1${NC}"
}

# Step 1: Validate environment
validate_environment() {
    log "🔍 Validating environment..."

    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        error "package.json not found. Please run this script from the project root."
        exit 1
    fi

    # Create extension directory if it doesn't exist
    mkdir -p "$EXTENSION_DIR"

    success "Environment validated"
}

# Step 2: Bump version number
bump_version() {
    log "📈 Bumping version number..."

    cd "$PROJECT_ROOT"

    # Get current version
    CURRENT_VERSION=$(node -p "require('./package.json').version")
    info "Current version: $CURRENT_VERSION"

    # Parse version and increment patch version
    IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
    MAJOR=${VERSION_PARTS[0]}
    MINOR=${VERSION_PARTS[1]}
    PATCH=${VERSION_PARTS[2]}

    # Increment patch version
    PATCH=$((PATCH + 1))
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"

    info "New version: $NEW_VERSION"

    # Update package.json
    sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json

    success "Version bumped to $NEW_VERSION"
    export NEW_VERSION
}

# Step 3: Create extension package
create_extension_package() {
    log "📦 Creating extension package..."

    cd "$PROJECT_ROOT"

    # Create extension-specific directory
    EXTENSION_NAME="mcpoverflow-extension-v$NEW_VERSION"
    EXTENSION_PATH="$EXTENSION_DIR/$EXTENSION_NAME"

    mkdir -p "$EXTENSION_PATH"

    # Copy source files
    if [[ -d "apps" ]]; then
        cp -r apps/ "$EXTENSION_PATH/"
        success "Copied apps directory"
    fi

    if [[ -d "packages" ]]; then
        cp -r packages/ "$EXTENSION_PATH/"
        success "Copied packages directory"
    fi

    if [[ -d "services" ]]; then
        cp -r services/ "$EXTENSION_PATH/"
        success "Copied services directory"
    fi

    # Copy configuration files
    cp package.json "$EXTENSION_PATH/"
    cp package-lock.json "$EXTENSION_PATH/" 2>/dev/null || warn "No package-lock.json found"
    cp README.md "$EXTENSION_PATH/" 2>/dev/null || warn "No README.md found"
    cp tsconfig.json "$EXTENSION_PATH/" 2>/dev/null || warn "No tsconfig.json found"

    # Copy deployment scripts
    if [[ -d "scripts" ]]; then
        mkdir -p "$EXTENSION_PATH/scripts"
        cp scripts/*.sh "$EXTENSION_PATH/scripts/" 2>/dev/null || warn "No scripts found"
        success "Copied deployment scripts"
    fi

    # Copy Cloudflare Workers
    if [[ -d "deploy-io" ]]; then
        cp -r deploy-io/ "$EXTENSION_PATH/"
        success "Copied Cloudflare Workers"
    fi

    if [[ -d "deploy-ai" ]]; then
        cp -r deploy-ai/ "$EXTENSION_PATH/"
        success "Copied Cloudflare Workers"
    fi

    # Create extension manifest
    cat > "$EXTENSION_PATH/manifest.json" << EOF
{
  "name": "MCP Overflow Extension",
  "version": "$NEW_VERSION",
  "description": "MCP Connector Development Platform Extension - Complete platform with voice-activated features and multi-domain deployment",
  "main": "apps/marketing/package.json",
  "scripts": {
    "install": "npm install",
    "dev:marketing": "cd apps/marketing && npm run dev",
    "dev:docs": "cd apps/docs-site && npm run dev",
    "dev:ai": "cd apps/ai-platform && npm run dev",
    "dev:io": "cd apps/io && npm run dev",
    "build:all": "npm run build --workspaces",
    "deploy:workers": "./scripts/deploy-cloudflare.sh",
    "deploy:all": "./scripts/deploy-multi-domain.sh"
  },
  "author": "MCP Overflow Team",
  "license": "MIT",
  "keywords": ["mcp", "connector", "api", "openapi", "cloudflare", "voice", "ai"],
  "repository": {
    "type": "git",
    "url": "https://github.com/mcpoverflow/mcpoverflow.git"
  },
  "buildDate": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "environment": "$( [[ $NODE_ENV == "production" ]] && echo "production" || echo "development" )",
  "platforms": {
    "marketing": "https://mcpoverflow.com",
    "documentation": "https://mcpoverflow.dev",
    "developer": "https://mcpoverflow.io",
    "ai": "https://mcpoverflow.ai"
  },
  "features": [
    "Voice-activated navigation",
    "AI-powered development tools",
    "Multi-domain deployment",
    "Real-time analytics",
    "Cloudflare Workers integration",
    "OpenAPI to MCP conversion",
    "Voice command processing",
    "AI assistants"
  ]
}
EOF

    # Create comprehensive README
    cat > "$EXTENSION_PATH/README.md" << EOF
# MCP Overflow Extension v$NEW_VERSION

Complete MCP connector development platform with voice-activated features and multi-domain deployment.

## 🚀 Features

- **Voice-Activated Navigation**: Control the platform with voice commands
- **AI-Powered Tools**: Intelligent code generation and optimization
- **Multi-Domain Platform**: Specialized content per domain
- **Real-Time Analytics**: Monitor usage and performance
- **Cloudflare Workers**: Global deployment with edge computing
- **OpenAPI Conversion**: Convert OpenAPI specs to MCP connectors
- **AI Assistants**: Contextual help and guidance

## 🌐 Platform Domains

- **mcpoverflow.com** - Marketing platform with voice commands
- **mcpoverflow.dev** - Documentation with voice reading
- **mcpoverflow.io** - Developer platform with voice deployment
- **mcpoverflow.ai** - AI platform with AI voice assistants

## 📦 Installation

1. Extract the extension package
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Start development:
   \`\`\`bash
   # Marketing platform
   npm run dev:marketing

   # Documentation site
   npm run dev:docs

   # AI platform
   npm run dev:ai

   # Developer platform
   npm run dev:io
   \`\`\`

## 🛠️ Development

### Build All Platforms
\`\`\`bash
npm run build:all
\`\`\`

### Deploy to Cloudflare Workers
\`\`\`bash
npm run deploy:workers
\`\`\`

### Multi-Domain Deployment
\`\`\`bash
npm run deploy:all
\`\`\`

## 🎤 Voice Commands

- "Deploy connector" - Initiates deployment
- "Run tests" - Executes test suites
- "Show analytics" - Displays metrics
- "Start chat" - Activates AI assistants
- "Generate connector" - Starts generation
- "Open docs" - Opens documentation

## 🏗️ Architecture

\`\`\`
mcpoverflow-extension/
├── apps/                    # Platform applications
│   ├── marketing/          # Marketing site
│   ├── docs-site/          # Documentation
│   ├── ai-platform/        # AI platform
│   └── io/                 # Developer platform
├── packages/               # Shared packages
│   ├── ui/                 # UI components
│   ├── openapi-parser/     # API parsing
│   ├── codegen/            # Code generation
│   └── wasm/               # WebAssembly modules
├── services/               # Backend services
│   ├── api-service/        # Main API
│   ├── generator-service/  # Connector generation
│   └── analytics-service/  # Analytics
├── scripts/                # Deployment scripts
├── deploy-*/              # Cloudflare Workers
└── manifest.json          # Extension manifest
\`\`\`

## 📊 Build Information

- **Version**: $NEW_VERSION
- **Build Date**: $(date)
- **Environment**: $NODE_ENV
- **Node Version**: $(node --version)
- **NPM Version**: $(npm --version)

## 🔗 Links

- [Main Platform](https://mcpoverflow.com)
- [Documentation](https://mcpoverflow.dev)
- [Developer Tools](https://mcpoverflow.io)
- [AI Platform](https://mcpoverflow.ai)

---
Generated on: $(date)
Builder: $(whoami)@$(hostname)
EOF

    # Create build info
    cat > "$EXTENSION_PATH/BUILD_INFO.txt" << EOF
MCP Overflow Extension Build Information
========================================
Version: $NEW_VERSION
Build Date: $(date)
Git Commit: $(git rev-parse HEAD 2>/dev/null || echo "Unknown")
Build Environment: $NODE_ENV
Node Version: $(node --version)
NPM Version: $(npm --version)
Builder: $(whoami)@$(hostname)

Files included:
- apps/ (platform applications)
- packages/ (shared packages)
- services/ (backend services)
- scripts/ (deployment scripts)
- deploy-*/ (Cloudflare Workers)
- package.json (dependencies)
- README.md (documentation)
- Configuration files

Build Steps Completed:
✅ Environment validated
✅ Version bumped from $CURRENT_VERSION to $NEW_VERSION
✅ Source files copied
✅ Configuration files copied
✅ Deployment scripts copied
✅ Extension manifest created
✅ Documentation generated
✅ Build info created

Voice Features:
- Voice command recognition
- Text-to-speech synthesis
- AI voice assistants
- Cross-platform voice integration

Deployment Ready:
- Cloudflare Workers included
- Multi-domain configuration
- Voice activation scripts
- Build automation tools
EOF

    success "Extension package created at $EXTENSION_PATH"
}

# Step 4: Create archive
create_archive() {
    log "🗜️ Creating distribution archive..."

    cd "$EXTENSION_DIR"

    ARCHIVE_NAME="mcpoverflow-extension-v$NEW_VERSION.tar.gz"

    tar -czf "$ARCHIVE_NAME" -C . "$(basename "$EXTENSION_PATH")"

    # Calculate checksum
    if command -v sha256sum >/dev/null 2>&1; then
        CHECKSUM=$(sha256sum "$ARCHIVE_NAME" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
        CHECKSUM=$(shasum -a 256 "$ARCHIVE_NAME" | awk '{print $1}')
    else
        CHECKSUM="Checksum not available"
    fi

    # Create checksum file
    echo "$CHECKSUM  $ARCHIVE_NAME" > "$ARCHIVE_NAME.sha256"

    success "Archive created: $EXTENSION_DIR/$ARCHIVE_NAME"
    info "SHA256: $CHECKSUM"
}

# Step 5: Generate build report
generate_report() {
    log "📊 Generating build report..."

    REPORT_PATH="$EXTENSION_DIR/build-report-v$NEW_VERSION.md"

    cat > "$REPORT_PATH" << EOF
# MCP Overflow Extension Build Report

## Build Summary
- **Version**: $NEW_VERSION
- **Build Date**: $(date)
- **Build Environment**: $NODE_ENV
- **Git Commit**: $(git rev-parse HEAD 2>/dev/null || echo "Unknown")

## Extension Package Location
- **Directory**: $EXTENSION_PATH
- **Archive**: $EXTENSION_DIR/$ARCHIVE_NAME
- **Checksum**: $CHECKSUM

## Build Steps Completed
✅ Environment validated
✅ Version bumped from $CURRENT_VERSION to $NEW_VERSION
✅ Extension package created
✅ Source files copied
✅ Configuration files included
✅ Deployment scripts included
✅ Cloudflare Workers included
✅ Extension manifest created
✅ Documentation generated
✅ Archive created
✅ Checksum generated
✅ Build report generated

## Package Contents
- \`apps/\` - Platform applications (marketing, docs, ai, developer)
- \`packages/\` - Shared packages (UI, parser, codegen, wasm)
- \`services/\` - Backend services (API, generator, analytics)
- \`scripts/\` - Deployment and build scripts
- \`deploy-*/\` - Cloudflare Workers for each domain
- \`package.json\` - Dependencies and scripts
- \`manifest.json\` - Extension manifest with metadata
- \`README.md\` - Comprehensive documentation
- \`BUILD_INFO.txt\` - Detailed build information

## Platform Features
- Voice-activated navigation across all platforms
- AI-powered development tools and assistants
- Multi-domain deployment with specialized content
- Real-time analytics and performance monitoring
- Cloudflare Workers integration for global deployment
- OpenAPI specification to MCP connector conversion
- Voice command processing and synthesis
- Cross-platform integration and navigation

## Installation Instructions
1. Download: \`$ARCHIVE_NAME\`
2. Extract: \`tar -xzf $ARCHIVE_NAME\`
3. Install: \`cd $(basename "$EXTENSION_PATH") && npm install\`
4. Start development: \`npm run dev:marketing\`

## Voice Commands
- "Deploy connector" - Deploy MCP connectors
- "Run tests" - Execute test suites
- "Show analytics" - View performance metrics
- "Start chat" - Activate AI assistants
- "Generate connector" - Start connector generation
- "Open docs" - Access documentation

## Deployment URLs
- Marketing: https://mcpoverflow.com
- Documentation: https://mcpoverflow.dev
- Developer: https://mcpoverflow.io
- AI Platform: https://mcpoverflow.ai

---
Generated on: $(date)
Builder: $(whoami)@$(hostname)
Build Duration: $SECONDS seconds
EOF

    success "Build report generated: $REPORT_PATH"
}

# Main execution
main() {
    echo -e "${CYAN}🚀 MCP Overflow Simple Extension Build${NC}"
    echo -e "${CYAN}=====================================${NC}"
    echo ""

    validate_environment
    bump_version
    create_extension_package
    create_archive
    generate_report

    echo ""
    echo -e "${GREEN}🎉 Extension build completed successfully!${NC}"
    echo -e "${CYAN}📍 Extension package:${NC} $EXTENSION_PATH"
    echo -e "${CYAN}📦 Archive:${NC} $EXTENSION_DIR/$ARCHIVE_NAME"
    echo -e "${CYAN}📋 Report:${NC} $REPORT_PATH"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Extract and test the extension package"
    echo "2. Review the build report and documentation"
    echo "3. Install dependencies and run development servers"
    echo "4. Deploy to Cloudflare Workers using included scripts"
    echo "5. Test voice features across all platforms"
}

# Run main function
main "$@"