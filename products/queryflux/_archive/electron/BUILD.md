# QueryFlux Desktop - Build & Distribution Guide

This guide covers building and distributing QueryFlux Desktop for macOS, Windows, and Linux platforms.

## Prerequisites

### Development Environment
- Node.js 20+
- npm or yarn
- Git

### Platform-Specific Requirements

#### macOS
- Xcode 14+
- Apple Developer account ($99/year)
- macOS 10.15+ for development
- macOS 11+ for distribution

#### Windows
- Windows 10/11
- Visual Studio 2019+ (for C++ dependencies)
- Code signing certificate (for distribution)

#### Linux
- Linux distribution with glibc 2.17+
- Build tools: `build-essential`, `rpm`, `dpkg-dev`

## Setup

### 1. Install Dependencies
```bash
cd electron
npm install
```

### 2. Setup Code Signing Certificates
```bash
npm run setup:certs
```

#### macOS Certificates
1. Create Apple Developer account
2. Generate certificates in Xcode → Preferences → Accounts
3. Download from Apple Developer Portal
4. Set environment variables:
   ```bash
   export CSC_LINK="/path/to/certificate.p12"
   export CSC_KEY_PASSWORD="certificate_password"
   export APPLE_ID="your@apple.id"
   export APPLE_ID_PASSWORD="app_specific_password"
   export APPLE_TEAM_ID="your_team_id"
   ```

#### Windows Certificates
1. Purchase code signing certificate (DigiCert, Sectigo)
2. Install in Windows Certificate Manager
3. Set environment variables:
   ```bash
   export WIN_CSC_LINK="/path/to/certificate.p12"
   export WIN_CSC_KEY_PASSWORD="certificate_password"
   ```

## Development

### Start Development Server
```bash
npm run dev
```
This starts both the main process and renderer process with hot reload.

### Build for Testing
```bash
npm run build
npm start
```

## Production Builds

### Build All Platforms
```bash
npm run build:prod
```

### Build Specific Platforms
```bash
# macOS
npm run build:prod:mac

# Windows
npm run build:prod:win

# Linux
npm run build:prod:linux
```

### Individual Platform Commands
```bash
# Development builds (unsigned)
npm run dist:mac
npm run dist:win
npm run dist:linux

# Production builds (signed if certificates configured)
npm run dist:all
```

## Build Artifacts

Build outputs are created in `release/` directory:

### macOS
- `QueryFlux-1.0.0.dmg` - DMG installer
- `QueryFlux-1.0.0.pkg` - Mac App Store package
- `queryflux-1.0.0-mac.zip` - Archive for manual distribution

### Windows
- `QueryFlux-Setup-1.0.0.exe` - NSIS installer
- `QueryFlux-1.0.0.msi` - MSI installer
- `QueryFlux-1.0.0.appx` - Microsoft Store package

### Linux
- `QueryFlux-1.0.0.AppImage` - Universal AppImage
- `queryflux_1.0.0_amd64.deb` - Debian/Ubuntu package
- `queryflux-1.0.0-1.x86_64.rpm` - RedHat/Fedora package

## Automated Builds

### GitHub Actions
Builds are automatically triggered on:
- Push to `main` or `develop` branches
- Pull requests to `main`
- Tag pushes (releases)

#### Manual Builds
```bash
# Trigger build workflow for specific platform
gh workflow run build-electron --field platform=mac
```

### Environment Variables for CI
Set these in GitHub repository settings:

#### macOS
- `CSC_LINK` - Base64 encoded certificate
- `CSC_KEY_PASSWORD` - Certificate password
- `APPLE_ID` - Apple ID
- `APPLE_ID_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Apple Team ID

#### Windows
- `WIN_CSC_LINK` - Base64 encoded certificate
- `WIN_CSC_KEY_PASSWORD` - Certificate password

#### Notifications
- `SLACK_WEBHOOK` - For build notifications
- `HOMEBREW_TOKEN` - For Homebrew formula updates

## Release Process

### Version Management
```bash
# Beta release
npm run release:beta

# Patch release
npm run release:patch

# Minor release
npm run release:minor

# Major release
npm run release:major
```

### Manual Release
1. Update version in `package.json`
2. Create git tag: `git tag v1.0.0`
3. Push tag: `git push origin v1.0.0`
4. GitHub Actions will build and create release

### Local Installation
```bash
# Install built app locally
npm run install:local
```

## Code Signing & Notarization

### macOS
- Automatic notarization with Apple's notary service
- Requires valid Apple Developer certificate
- Supports both DMG and Mac App Store builds

### Windows
- Authenticode code signing with Windows certificates
- Supports SmartScreen reputation
- Optional Microsoft Store distribution

### Linux
- GPG signing for packages (optional)
- AppImage signing (community-supported)

## Testing

### Automated Tests
```bash
# Run type checking
npm run typecheck

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### Manual Testing
1. Test all platform builds
2. Verify installation process
3. Test auto-updater functionality
4. Validate code signing

## Distribution

### Direct Downloads
- Host builds on GitHub Releases
- Use CDN for global distribution
- Provide checksum verification

### App Stores
- **Mac App Store**: Requires MAS build and App Store review
- **Microsoft Store**: Requires AppX package and Store certification
- **Snap Store**: Linux Snap packages (future)

### Package Managers
- **Homebrew** (macOS): Automatic formula updates
- **Chocolatey** (Windows): Community-maintained package
- **APT/DEB/RPM**: Linux package repositories

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clean build artifacts
npm run clean

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Code Signing Errors
1. Verify certificate validity
2. Check certificate password
3. Ensure certificate is in correct store
4. Verify Apple Developer account status

#### macOS Notarization Issues
1. Check Apple ID credentials
2. Verify app bundle ID matches certificate
3. Check for prohibited entitlements
4. Review notarization logs

#### Linux Build Issues
1. Install missing build dependencies
2. Check glibc version compatibility
3. Verify package building tools

### Debug Builds
```bash
# Build with verbose output
DEBUG=electron-builder npm run dist

# Enable detailed logging
DEBUG=* npm run dist
```

## Security

### Certificate Management
- Store certificates securely
- Use environment variables for secrets
- Rotate certificates annually
- Backup certificates safely

### Build Security
- Use pinned dependency versions
- Scan for security vulnerabilities
- Verify build integrity
- Use reproducible builds

## Performance Optimization

### Bundle Size
- Tree-shake unused dependencies
- Optimize asset compression
- Use code splitting
- Remove development dependencies

### Build Speed
- Use cache for dependencies
- Parallelize build steps
- Incremental builds
- Build only target platforms

## Support

For build-related issues:
1. Check [GitHub Issues](https://github.com/queryflux/queryflux/issues)
2. Review [Electron Builder docs](https://www.electron.build/)
3. Consult [Apple Developer documentation](https://developer.apple.com/)
4. Reference [Microsoft Store guidelines](https://docs.microsoft.com/en-us/windows/uwp/publish/)

---

**Note**: This guide covers the complete build pipeline. For development setup, see [README.md](README.md).