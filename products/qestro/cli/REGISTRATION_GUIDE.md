# Questro CLI Registration and Distribution Guide

Complete guide for registering, publishing, and distributing the Questro CLI package.

## 📋 Table of Contents

1. [Pre-Registration Checklist](#pre-registration-checklist)
2. [Local Development Setup](#local-development-setup)
3. [NPM Registration](#npm-registration)
4. [Alternative Distribution Methods](#alternative-distribution-methods)
5. [Version Management](#version-management)
6. [CI/CD Integration](#cicd-integration)
7. [Post-Registration Tasks](#post-registration-tasks)
8. [Troubleshooting](#troubleshooting)

## 🔍 Pre-Registration Checklist

### ✅ Package Validation

Ensure your CLI package meets all requirements:

```bash
# Run structure validation
node quick-test.js
```

Required components:
- ✅ Complete `package.json` with proper binary configuration
- ✅ CLI entry point in `src/index.ts`
- ✅ Professional CLI structure (9 command groups)
- ✅ AWS-style authentication system
- ✅ Comprehensive test suite
- ✅ Professional documentation

### ✅ Package.json Verification

```json
{
  "name": "qestro-cli",
  "version": "1.0.0",
  "description": "Questro Professional CLI - Complete testing automation platform command-line interface",
  "main": "dist/index.js",
  "bin": {
    "qestro": "dist/index.js"
  },
  "files": [
    "dist/**/*",
    "README.md",
    "LICENSE"
  ],
  "keywords": [
    "qestro",
    "testing",
    "automation",
    "cli",
    "mobile-testing",
    "web-testing",
    "test-recording",
    "test-execution",
    "devops",
    "ci-cd"
  ],
  "engines": {
    "node": ">=16.0.0",
    "npm": ">=8.0.0"
  }
}
```

### ✅ npm Account Setup

1. **Create npm account**: https://www.npmjs.com/signup
2. **Verify email address**
3. **Enable 2FA** (recommended for package security)
4. **Create organization** (optional, for `@questro/qestro-cli`)

## 🛠️ Local Development Setup

### Prerequisites

```bash
# Check Node.js version
node --version  # Should be >= 16.0.0
npm --version   # Should be >= 8.0.0

# Install dependencies
npm install

# Build the CLI
npm run build

# Test local installation
npm link
```

### Local Testing

```bash
# Test the CLI locally
qestro --help
qestro auth --help
qestro config show

# Test authentication requirements
qestro projects list  # Should show auth required message
```

### Development Workflow

```bash
# 1. Make changes
# Edit source files in src/

# 2. Test changes
npm run dev        # Development mode with hot reload
npm run test       # Run test suite
npm run lint       # Check code quality

# 3. Build changes
npm run build

# 4. Test built CLI
node dist/index.js --help

# 5. Local testing
npm uninstall -g qestro-cli  # Remove previous version
npm install -g .                # Install local version
qestro --help
```

## 📦 NPM Registration

### Step 1: Prepare for Publishing

```bash
# Update version if needed
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0

# Run final tests
npm test
npm run build

# Verify package contents
npm pack --dry-run
```

### Step 2: Login to npm

```bash
# Login to npm (only needed once)
npm login

# Or use npm token for CI/CD
npm config set //registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

### Step 3: Publish Package

```bash
# Publish to npm registry
npm publish

# Publish with specific tag
npm publish --tag beta

# Publish with tag and access level
npm publish --tag latest --access public
```

### Step 4: Verify Publication

```bash
# Check if package is available
npm view qestro-cli

# Install and test
npm install -g qestro-cli@latest
qestro --version
```

## 🚀 Alternative Distribution Methods

### 1. GitHub Packages

#### Setup GitHub Packages

```json
// package.json
{
  "name": "@qestro/qestro-cli",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com/"
  }
}
```

#### Publish to GitHub

```bash
# Authenticate with GitHub Packages
npm login --scope=@qestro --registry=https://npm.pkg.github.com/

# Publish to GitHub Packages
npm publish
```

### 2. Direct Binary Distribution

#### Create install scripts

```bash
# scripts/install.sh
#!/bin/bash
set -e

CLI_NAME="qestro"
INSTALL_DIR="$HOME/.local/bin"
BINARY_URL="https://github.com/qestro/qestro-cli/releases/latest/download/qestro-cli-linux"

# Create installation directory
mkdir -p "$INSTALL_DIR"

# Download binary
curl -L "$BINARY_URL" -o "$INSTALL_DIR/qestro"

# Make executable
chmod +x "$INSTALL_DIR/qestro"

# Add to PATH if not already there
if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
    echo 'export PATH="$INSTALL_DIR:$PATH"' >> "$HOME/.bashrc"
    echo 'export PATH="$INSTALL_DIR:$PATH"' >> "$HOME/.zshrc"
    export PATH="$INSTALL_DIR:$PATH"
fi

echo "✅ qestro CLI installed to $INSTALL_DIR/qestro"
echo "Add $INSTALL_DIR to your PATH if not already added"
```

#### Cross-platform builds

```json
// package.json scripts
{
  "scripts": {
    "build:win": "pkg . --targets node16-win-x64 --output dist/qestro-cli-win.exe",
    "build:mac": "pkg . --targets node16-macos-x64 --output dist/qestro-cli-macos",
    "build:linux": "pkg . --targets node16-linux-x64 --output dist/qestro-cli-linux",
    "build:all": "npm run build:win && npm run build:mac && npm run build:linux"
  }
}
```

### 3. Docker Distribution

#### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build CLI
RUN npm run build

# Create symlink
RUN ln -s /app/dist/index.js /usr/local/bin/qestro

# Test installation
RUN qestro --version

# Set entrypoint
ENTRYPOINT ["qestro"]
```

#### Build and publish

```bash
# Build Docker image
docker build -t qestro-cli .

# Run container
docker run --rm qestro-cli --help

# Publish to Docker Hub
docker tag qestro-cli questro/qestro-cli:latest
docker push questro/qestro-cli:latest
```

### 4. Homebrew Formula

#### Create Formula (Formula/qestro-cli.rb)

```ruby
class QuestroCli < Formula
  desc "Questro Professional CLI - Complete testing automation platform"
  homepage "https://github.com/qestro/qestro-cli"
  url "https://registry.npmjs.org/qestro-cli/-/qestro-cli-1.0.0.tgz"
  sha256 "your-sha256-hash"
  license "MIT"

  depends_on "node"

  def install
    bin.install "dist/index.js" => "qestro"
  end

  test do
    system "#{bin}/qestro --version"
  end
end
```

#### Install via Homebrew

```bash
# Tap the formula
brew tap questro/tap

# Install CLI
brew install qestro-cli

# Test installation
qestro --help
```

## 📊 Version Management

### Semantic Versioning

Follow SemVer conventions: `MAJOR.MINOR.PATCH`

```bash
# Patch version (bug fixes)
npm version patch

# Minor version (new features)
npm version minor

# Major version (breaking changes)
npm version major
```

### Release Channels

```bash
# Stable release (default)
npm publish

# Beta release
npm publish --tag beta

# Alpha release
npm publish --tag alpha

# RC release
npm publish --tag rc
```

### Version Tagging in Git

```bash
# Tag version
git tag v1.0.0
git push origin v1.0.0

# Tag with annotations
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

## 🔄 CI/CD Integration

### GitHub Actions Workflow

#### `.github/workflows/release.yml`

```yaml
name: Release CLI

on:
  push:
    tags:
      - 'v*'
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16, 18, 20]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build CLI
        run: npm run build

      - name: Test CLI
        run: node dist/index.js --version

  publish:
    needs: test
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build CLI
        run: npm run build

      - name: Publish to npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### GitLab CI/CD

#### `.gitlab-ci.yml`

```yaml
stages:
  - test
  - build
  - publish

variables:
  NODE_VERSION: "18"

test:
  stage: test
  image: node:$NODE_VERSION
  script:
    - npm ci
    - npm test
  coverage: '/Coverage: \d+\.\d+%/'

build:
  stage: build
  image: node:$NODE_VERSION
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week

publish:
  stage: publish
  image: node:$NODE_VERSION
  script:
    - npm ci
    - npm run build
    - npm publish --access public
  only:
    - tags
  dependencies:
    - build
```

## ✅ Post-Registration Tasks

### 1. Update Documentation

```bash
# Update installation instructions
# Update version numbers in docs
# Add release notes
# Update examples and tutorials
```

### 2. Create Release Notes

```markdown
# Release Notes Template

## [Version] - [Date]

### Features
- New feature 1
- New feature 2

### Bug Fixes
- Fixed authentication issue
- Resolved performance problem

### Breaking Changes
- Changed command syntax (if applicable)

### API Changes
- Added new endpoints
- Deprecated old endpoints

### Installation
```bash
npm install -g qestro-cli@[version]
```
```

### 3. Verify Installation

```bash
# Clean install test
npm uninstall -g qestro-cli
npm cache clean --force

# Fresh install
npm install -g qestro-cli

# Test functionality
qestro --help
qestro auth --help
qestro config show
```

### 4. Monitor Usage

```bash
# Check download statistics
npm view qestro-cli

# Monitor downloads
npm info qestro-cli
```

### 5. Community Engagement

```bash
# Announce on platforms
- Twitter: "@QuestroCLI just released v1.0.0!"
- LinkedIn: Professional post about release
- Reddit: r/DevOps, r/javascript, r/nodejs
- Discord: Share in relevant communities
```

## 🚧 Troubleshooting

### Common Publishing Issues

#### 1. Package Name Already Taken

```bash
# Check availability
npm view qestro-cli

# Use alternative name
npm view qestro-cli-core
```

#### 2. Authentication Errors

```bash
# Clear npm cache
npm cache clean --force

# Re-authenticate
npm logout
npm login

# Check npm registry
npm config get registry
```

#### 3. Build Failures

```bash
# Check TypeScript configuration
npx tsc --noEmit

# Check for missing dependencies
npm ls
npm outdated

# Fix package.json issues
npm install --save missing-package
```

#### 4. Permission Errors

```bash
# Check npm permissions
npm config list

# Fix ownership
sudo chown -R $(whoami) ~/.npm
```

### Version Conflicts

```bash
# Check current version
npm view qestro-cli version

# Uninstall conflicting versions
npm uninstall -g qestro-cli

# Clean install
npm cache clean --force
npm install -g qestro-cli@latest
```

### Cross-Platform Issues

```bash
# Test on different platforms
# Windows
node dist/index.js --help

# macOS
node dist/index.js --help

# Linux
node dist/index.js --help

# Check executable permissions
ls -la dist/index.js
chmod +x dist/index.js
```

## 📚 Additional Resources

### Official Documentation
- [npm Publishing Guide](https://docs.npmjs.com/publishing-a-package)
- [Node.js Best Practices](https://nodejs.org/en/docs/)
- [Semantic Versioning](https://semver.org/)

### Community Resources
- [npm Registry](https://www.npmjs.com/)
- [GitHub Packages](https://github.com/features/packages)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/npm)

### CLI Development Resources
- [Commander.js Documentation](https://github.com/tj/commander.js/)
- [CLI Best Practices](https://clig.dev/)
- [CLI Guidelines](https://github.com/oclif/oclif)

## 🎯 Success Metrics

### Registration Checklist
- [ ] Package published successfully to npm
- [ ] CLI installs globally with `npm install -g`
- [ ] All commands work as expected
- [ ] AWS-style authentication works properly
- [ ] Help documentation is comprehensive
- [ ] Version management is automated
- [ ] CI/CD pipeline is functional

### Quality Indicators
- [ ] No TypeScript errors on build
- [ ] All tests passing
- [ ] Linting passes without warnings
- [ ] Performance benchmarks met
- [ ] Security scans pass
- [ ] Documentation is complete

---

**🚀 Your Questro CLI is now registered and ready for distribution!**

Follow this guide to ensure a smooth registration process and professional CLI distribution.