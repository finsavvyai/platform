# QueryFlux Extension Publisher

This document describes the extension publishing system for QueryFlux Desktop.

## Overview

The extension publisher automates the process of:
- Bumping version numbers
- Building the desktop application
- Publishing to the target directory
- Creating release notes and checksums
- Git tagging

## Usage

### Quick Publish (Patch Version)
```bash
npm run extension:publish
# or explicitly
npm run extension:publish:patch
```

### Minor Version Bump
```bash
npm run extension:publish:minor
```

### Major Version Bump
```bash
npm run extension:publish:major
```

### Manual Version Bump
```bash
node scripts/publish-extension.js patch
node scripts/publish-extension.js minor
node scripts/publish-extension.js major
```

## Output Structure

Published extensions are placed in `/Users/shaharsolomon/projects/extensions/`:

```
extensions/
├── queryflux-desktop-v1.0.1/
│   ├── QueryFlux-1.0.1.dmg
│   ├── QueryFlux Setup 1.0.1.exe
│   ├── queryflux-desktop-1.0.1.AppImage
│   ├── queryflux-desktop_1.0.1_amd64.deb
│   ├── queryflux-desktop-1.0.1-1.x86_64.rpm
│   ├── RELEASE.md
│   └── SHA256SUMS
├── queryflux-desktop-v1.1.0/
│   └── ...
└── queryflux-desktop-latest -> queryflux-desktop-v1.0.1/
```

## Features

### Automated Version Management
- Automatically bumps version in `electron/package.json`
- Creates git commits and tags
- Maintains version history

### Multi-Platform Builds
- **macOS**: DMG and MAS (Mac App Store) builds
- **Windows**: NSIS installer and Microsoft Store packages
- **Linux**: AppImage, DEB, and RPM packages

### Security & Verification
- SHA256 checksums for all files
- Tamper-evident verification
- Secure file copying

### Documentation
- Auto-generated release notes
- Installation instructions
- Feature descriptions

## Configuration

The publisher can be configured by modifying `scripts/publish-extension.js`:

```javascript
const CONFIG = {
  electronDir: path.join(__dirname, '../electron'),
  targetDir: '/Users/shaharsolomon/projects/extensions',
  packageJson: path.join(__dirname, '../electron/package.json')
};
```

## Release Process

1. **Version Bump**: Automatically increments version based on type
2. **Build**: Cleans and rebuilds the application
3. **Package**: Creates platform-specific installers
4. **Copy**: Moves files to target directory with versioning
5. **Document**: Creates release notes and checksums
6. **Tag**: Creates git tag for version tracking

## Requirements

### Prerequisites
- Node.js 18+
- npm
- Git (for tagging)
- Electron Builder dependencies

### Build Dependencies
The publisher requires all Electron build dependencies:
- `electron-builder`
- `electron-notarize` (for macOS)
- Platform-specific signing certificates (for production)

## Troubleshooting

### Build Failures
```bash
# Clean build
cd electron
rm -rf node_modules release
npm install
npm run build
```

### Permission Issues
```bash
# Make script executable
chmod +x scripts/publish-extension.js

# Fix target directory permissions
sudo chown -R $USER /Users/shaharsolomon/projects/extensions
```

### Git Issues
```bash
# Initialize git repo if missing
git init
git add .
git commit -m "Initial commit"

# Push tags
git push --tags
```

## Manual Override

If the automated script fails, you can manually build:

```bash
cd electron

# Bump version manually
npm version patch

# Build
npm run build
npm run dist:all

# Copy to target
cp -r release/* /Users/shaharsolomon/projects/extensions/queryflux-desktop-v$(node -p "require('./package.json').version")/
```

## Integration with CI/CD

The publisher can be integrated into CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Publish Extension
  run: |
    npm run extension:publish:patch
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Support

For issues with the extension publisher:
1. Check the console output for error messages
2. Verify all prerequisites are installed
3. Ensure target directory exists and is writable
4. Check Git configuration (if using tagging)

## Security Notes

- The publisher respects existing file permissions
- Checksums provide integrity verification
- Version tags prevent tampering
- No external network calls (offline operation)