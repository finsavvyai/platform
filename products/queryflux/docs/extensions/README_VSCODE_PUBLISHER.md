# QueryFlux VS Code Extension Publisher

This document describes the publishing system for the QueryFlux VS Code extension.

## Overview

The VS Code extension publisher automates the process of:
- Bumping version numbers
- Compiling TypeScript code
- Running tests
- Creating VSIX packages
- Publishing to target directory
- Creating installation scripts and documentation
- Git tagging

## Quick Start

### Publish New Version (Patch)
```bash
npm run vscode:publish
# or explicitly
npm run vscode:publish:patch
```

### Minor Version Bump
```bash
npm run vscode:publish:minor
```

### Major Version Bump
```bash
npm run vscode:publish:major
```

### Manual Version Bump
```bash
node scripts/publish-vscode-extension.js patch
node scripts/publish-vscode-extension.js minor
node scripts/publish-vscode-extension.js major
```

## Output Structure

Published extensions are placed in `/Users/shaharsolomon/projects/extensions/`:

```
extensions/
├── queryflux-vscode-v1.0.1/
│   ├── queryflux-1.0.1.vsix
│   ├── install.sh              # Linux/macOS installer
│   ├── install.ps1             # Windows PowerShell installer
│   ├── RELEASE.md              # Detailed release notes
│   ├── manifest.json           # Extension manifest
│   └── SHA256SUMS              # Checksums for verification
├── queryflux-vscode-v1.1.0/
│   └── ...
└── queryflux-vscode-latest -> queryflux-vscode-v1.0.1/
```

## Features

### Automated Build Process
- **TypeScript Compilation**: Full TypeScript to JavaScript compilation
- **Test Execution**: Runs unit tests before packaging
- **VSIX Creation**: Builds VSIX package using `vsce`
- **Dependency Management**: Clean install and compile process

### Cross-Platform Installation
- **Linux/macOS**: Bash script installer (`install.sh`)
- **Windows**: PowerShell installer (`install.ps1`)
- **VS Code CLI**: Direct `code --install-extension` support

### Documentation Generation
- **Release Notes**: Auto-generated comprehensive release notes
- **Installation Guide**: Step-by-step installation instructions
- **Feature Documentation**: Complete feature list and usage examples
- **Troubleshooting Guide**: Common issues and solutions

### Security & Verification
- **SHA256 Checksums**: Cryptographic verification of all files
- **Git Tagging**: Automatic version tagging in git repository
- **Version Tracking**: Complete version history management

## Usage Examples

### Basic Publishing
```bash
# Quick patch version bump and publish
npm run vscode:publish

# Output:
# 🚀 QueryFlux VS Code Extension Publisher
# Current version: 1.0.0
# New version: 1.0.1 (patch bump)
# ✓ Updated version to 1.0.1
# ✓ Created target directory: /Users/shaharsolomon/projects/extensions
# 📦 Installing dependencies...
# ✓ Dependencies installed
# 🔨 Compiling TypeScript...
# ✓ TypeScript compilation completed
# 📦 Creating VSIX package...
# ✓ Package created: queryflux-1.0.1.vsix
# ✓ Copied to target directory: /Users/shaharsolomon/projects/extensions/queryflux-vscode-v1.0.1
# ✅ Successfully published QueryFlux VS Code Extension v1.0.1!
```

### Version Bump Types
```bash
# Patch version (1.0.0 → 1.0.1)
npm run vscode:publish:patch

# Minor version (1.0.0 → 1.1.0)
npm run vscode:publish:minor

# Major version (1.0.0 → 2.0.0)
npm run vscode:publish:major
```

### Installation of Published Extension

#### Option 1: Automated Installer (Recommended)
```bash
# Navigate to extension directory
cd /Users/shaharsolomon/projects/extensions/queryflux-vscode-latest

# Run installer (Linux/macOS)
./install.sh

# Run installer (Windows)
PowerShell -ExecutionPolicy Bypass -File install.ps1
```

#### Option 2: Manual VSIX Installation
```bash
# Install from VSIX file
code --install-extension queryflux-1.0.1.vsix
```

#### Option 3: VS Code Marketplace
```bash
# Install from marketplace
code --install-extension queryflux.queryflux
```

## Configuration

The publisher can be configured by modifying `scripts/publish-vscode-extension.js`:

```javascript
const CONFIG = {
  extensionDir: path.join(__dirname, '../vscode-extension'),
  targetDir: '/Users/shaharsolomon/projects/extensions',
  packageJson: path.join(__dirname, '../vscode-extension/package.json'),
  marketplaceUrl: 'https://marketplace.visualstudio.com/items?itemName=queryflux.queryflux',
  githubRepo: 'https://github.com/queryflux/vscode-extension'
};
```

## Extension Features

### Database Support
- **PostgreSQL**: Full support with SSL
- **MySQL**: Complete functionality
- **MongoDB**: NoSQL database support
- **Redis**: Key-value store operations
- **SQLite**: Local database files
- **Cassandra**: Wide-column store
- **Oracle**: Enterprise database
- **SQL Server**: Microsoft database

### Core Features
- **AI Query Optimization**: Intelligent query suggestions
- **Schema Explorer**: Interactive database schema browser
- **Query Execution**: Direct SQL query execution
- **Results Panel**: Tabular results with export
- **SQL IntelliSense**: Advanced autocomplete
- **Connection Management**: Secure credential storage
- **Query History**: Track executed queries

### Language Features
- **25+ SQL Snippets**: Common SQL patterns
- **Syntax Highlighting**: Enhanced SQL syntax
- **Error Detection**: Real-time error checking
- **Auto Formatting**: Code formatting on save

## Release Process

### 1. Version Management
- Automatically increments version based on type
- Updates `package.json` with new version
- Creates git tag for version tracking

### 2. Build Process
- Clean dependency installation
- TypeScript compilation with strict type checking
- Unit test execution (if tests exist)
- VSIX package creation

### 3. Package Creation
- Creates `.vsix` file using `vsce`
- Generates installation scripts for all platforms
- Creates comprehensive documentation
- Calculates SHA256 checksums

### 4. Distribution
- Copies all files to target directory
- Creates versioned directory structure
- Maintains "latest" symlink
- Updates main project package.json

## Installation Scripts

### Linux/macOS (install.sh)
```bash
#!/bin/bash
# Automated installer that:
# - Checks for VS Code installation
# - Installs the extension using VS Code CLI
# - Provides success/failure feedback
# - Shows next steps and documentation links
```

### Windows (install.ps1)
```powershell
# PowerShell script that:
# - Validates VS Code installation
# - Installs extension via VS Code CLI
# - Provides detailed feedback
# - Shows troubleshooting information
```

## File Structure

```
vscode-extension/
├── src/
│   ├── extension.ts           # Main extension entry point
│   ├── database/              # Database connectivity
│   ├── ui/                    # UI components
│   ├── language/              # Language features
│   └── ai/                    # AI integration
├── snippets/
│   └── sql.json               # SQL snippets
├── package.json               # Extension manifest
├── tsconfig.json              # TypeScript configuration
├── README.md                  # Extension documentation
└── .vscodeignore              # Build exclusions

scripts/
└── publish-vscode-extension.js # Publisher script

target/
└── queryflux-vscode-v1.0.1/
    ├── queryflux-1.0.1.vsix   # Extension package
    ├── install.sh              # Linux/macOS installer
    ├── install.ps1             # Windows installer
    ├── RELEASE.md              # Release notes
    ├── manifest.json           # Extension metadata
    └── SHA256SUMS              # File checksums
```

## Troubleshooting

### Build Failures
```bash
# Clean and rebuild
cd vscode-extension
rm -rf node_modules out
npm install
npm run compile
```

### Permission Issues
```bash
# Make scripts executable
chmod +x scripts/publish-vscode-extension.js

# Fix target directory permissions
sudo chown -R $USER /Users/shaharsolomon/projects/extensions
```

### VS Code CLI Issues
```bash
# Install VS Code CLI (macOS)
shell script --install-command

# Install VS Code CLI (Linux)
sudo apt install code
# or
sudo snap install code --classic
```

### Dependency Issues
```bash
# Clear npm cache
npm cache clean --force

# Use npm legacy peer deps
npm install --legacy-peer-deps
```

## Development Workflow

### 1. Extension Development
```bash
cd vscode-extension
npm install
npm run compile          # Compile TypeScript
npm run watch           # Watch for changes
npm test                # Run tests
```

### 2. Local Testing
```bash
# Create development package
npm run package

# Install locally
code --install-extension queryflux-1.0.0.vsix
```

### 3. Publishing
```bash
# Publish to target directory
npm run vscode:publish:patch

# Publish to VS Code Marketplace (requires token)
npm run publish
```

## Marketplace Publishing

To publish to the VS Code Marketplace:

### 1. Create Publisher Account
1. Visit [Azure DevOps](https://dev.azure.com/)
2. Create organization and publisher account
3. Get Personal Access Token

### 2. Configure VSCE
```bash
# Create .vsce/publisher.json
{
  "name": "QueryFlux",
  "publisherId": "queryflux-publisher-id"
}

# Set token (environment variable)
export VSCE_PAT="your-personal-access-token"
```

### 3. Publish to Marketplace
```bash
cd vscode-extension
npm run publish:prod
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Publish VS Code Extension

on:
  push:
    tags:
      - 'vscode-v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run vscode:publish
      - uses: actions/upload-artifact@v2
        with:
          name: extension
          path: /Users/shaharsolomon/projects/extensions/
```

## Security Considerations

- **No External Dependencies**: Publisher works offline
- **Secure File Handling**: Proper file permissions and validation
- **Checksum Verification**: SHA256 verification for all files
- **Credential Protection**: No credentials stored in scripts
- **Git Security**: Signed commits and tags (optional)

## Performance Optimization

- **Parallel Operations**: Builds and tests run in parallel where possible
- **Incremental Builds**: TypeScript compilation is incremental
- **Caching**: Dependency caching for faster builds
- **Clean Builds**: Option for clean vs incremental builds

## Monitoring and Analytics

- **Build Metrics**: Track build times and success rates
- **Download Tracking**: Monitor extension downloads (from marketplace)
- **Error Tracking**: Log build failures and issues
- **Version Analytics**: Track version adoption and upgrades

## Support

For issues with the VS Code extension publisher:
1. Check the console output for detailed error messages
2. Verify all prerequisites are installed
3. Ensure target directory exists and is writable
4. Check git configuration if using tagging
5. Review VS Code CLI installation

## Related Documentation

- [QueryFlux Desktop Publisher](README_EXTENSION_PUBLISHER.md)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [VSCE Documentation](https://github.com/microsoft/vscode-vsce)
- [VS Code Marketplace](https://marketplace.visualstudio.com/)