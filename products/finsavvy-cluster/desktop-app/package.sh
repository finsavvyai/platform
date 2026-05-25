#!/bin/bash

# FinSavvyAI Desktop App - Package Creator

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_NAME="finsavvyai"
VERSION="1.0.0"
PACKAGE_DIR="packages"

print_status() {
    echo -e "${GREEN}[PKG]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo -e "${BLUE}📦 FinSavvyAI Desktop App Package Creator${NC}"
echo -e "${BLUE}=======================================${NC}"

# Clean and create package directory
print_status "Creating package directory..."
rm -rf $PACKAGE_DIR
mkdir -p $PACKAGE_DIR

# Get current platform
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m | tr '[:upper:]' '[:lower:]')

case $ARCH in
    x86_64)
        ARCH="amd64"
        ;;
    arm64|aarch64)
        ARCH="arm64"
        ;;
esac

print_status "Building for $PLATFORM-$ARCH"

# Build Go backend
print_status "Building Go backend..."
cd src-go
CGO_ENABLED=0 GOOS=$PLATFORM GOARCH=$ARCH go build -ldflags="-s -w" -o ../$PACKAGE_DIR/go-backend .
cd ..

# Package frontend files
print_status "Packaging frontend files..."
mkdir -p $PACKAGE_DIR/frontend
cp -r src-frontend/* $PACKAGE_DIR/frontend/

# Create platform-specific packages
create_package() {
    local platform=$1
    local arch=$2

    print_status "Creating package for $platform-$arch..."

    case $platform in
        "darwin")
            create_macos_package $arch
            ;;
        "linux")
            create_linux_package $arch
            ;;
        "windows")
            create_windows_package $arch
            ;;
        *)
            print_warning "Unsupported platform: $platform"
            ;;
    esac
}

# macOS Package
create_macos_package() {
    local arch=$1
    local package_name="${APP_NAME}-${VERSION}-macos-${arch}"

    mkdir -p $PACKAGE_DIR/$package_name

    # Create app structure
    mkdir -p $PACKAGE_DIR/$package_name/FinSavvyAI.app/Contents/MacOS
    mkdir -p $PACKAGE_DIR/$package_name/FinSavvyAI.app/Contents/Resources

    # Copy files
    cp $PACKAGE_DIR/go-backend $PACKAGE_DIR/$package_name/FinSavvyAI.app/Contents/MacOS/
    cp -r $PACKAGE_DIR/frontend/* $PACKAGE_DIR/$package_name/FinSavvyAI.app/Contents/Resources/

    # Create Info.plist
    cat > $PACKAGE_DIR/$package_name/FinSavvyAI.app/Contents/Info.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>go-backend</string>
    <key>CFBundleIdentifier</key>
    <string>com.finsavvyai.desktop</string>
    <key>CFBundleName</key>
    <string>FinSavvyAI</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
</dict>
</plist>
EOF

    # Create launcher script
    cat > $PACKAGE_DIR/$package_name/FinSavvyAI.app/Contents/MacOS/launcher << 'EOF'
#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
"$DIR/go-backend" &
EOF
    chmod +x $PACKAGE_DIR/$package_name/FinSavvyAI.app/Contents/MacOS/launcher

    # Create DMG
    cd $PACKAGE_DIR
    if command -v create-dmg &> /dev/null; then
        create-dmg --volname "FinSavvyAI" --volicon "icon.icns" --window-pos 200 120 --window-size 600 300 --icon-size 100 --icon "FinSavvyAI.app" 175 120 --hide-extension "FinSavvyAI.app" --app-drop-link 425 120 "$package_name" "${package_name}.dmg"
    else
        print_warning "create-dmg not available, creating zip instead"
        zip -r "${package_name}.zip" "$package_name/"
    fi
    cd ..

    print_status "✓ macOS package created: ${package_name}.dmg"
}

# Linux Package
create_linux_package() {
    local arch=$1
    local package_name="${APP_NAME}-${VERSION}-linux-${arch}"

    mkdir -p $PACKAGE_DIR/$package_name/usr/bin
    mkdir -p $PACKAGE_DIR/$package_name/usr/share/finsavvyai
    mkdir -p $PACKAGE_DIR/$package_name/usr/share/applications
    mkdir -p $PACKAGE_DIR/$package_name/usr/share/icons/hicolor/256x256/apps

    # Copy files
    cp $PACKAGE_DIR/go-backend $PACKAGE_DIR/$package_name/usr/bin/finsavvyai-desktop
    cp -r $PACKAGE_DIR/frontend/* $PACKAGE_DIR/$package_name/usr/share/finsavvyai/

    # Create .desktop file
    cat > $PACKAGE_DIR/$package_name/usr/share/applications/finsavvyai.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=FinSavvyAI
Comment=FinSavvyAI Distributed AI Cluster Manager
Exec=/usr/bin/finsavvyai-desktop
Icon=finsavvyai
Terminal=false
Categories=Development;Science;
EOF

    # Create DEB package
    cd $PACKAGE_DIR/$package_name
    mkdir -p DEBIAN

    cat > DEBIAN/control << EOF
Package: finsavvyai-desktop
Version: $VERSION
Section: science
Priority: optional
Architecture: $arch
Depends: libc6
Maintainer: FinSavvyAI Team <support@finsavvyai.com>
Description: FinSavvyAI Distributed AI Cluster Manager
 A modern desktop application for managing distributed AI clusters.
 Built with Go, Rust, and web technologies.
EOF

    cat > DEBIAN/postinst << 'EOF'
#!/bin/bash
update-desktop-database
EOF
    chmod +x DEBIAN/postinst

    cd ..
    dpkg-deb --build $package_name

    # Also create tar.gz
    tar -czf "${package_name}.tar.gz" "$package_name/"

    cd ..

    print_status "✓ Linux packages created: ${package_name}.deb, ${package_name}.tar.gz"
}

# Windows Package
create_windows_package() {
    local arch=$1
    local package_name="${APP_NAME}-${VERSION}-windows-${arch}"

    mkdir -p $PACKAGE_DIR/$package_name

    # Copy files
    cp $PACKAGE_DIR/go-backend $PACKAGE_DIR/$package_name/finsavvyai-desktop.exe
    cp -r $PACKAGE_DIR/frontend/* $PACKAGE_DIR/$package_name/

    # Create batch launcher
    cat > $PACKAGE_DIR/$package_name/FinSavvyAI.bat << 'EOF'
@echo off
cd /d "%~dp0"
start /B finsavvyai-desktop.exe
EOF

    # Create installer script (requires makensis)
    cat > $PACKAGE_DIR/$package_name/installer.nsi << EOF
!define APPNAME "FinSavvyAI"
!define VERSION "$VERSION"
!define PUBLISHER "FinSavvyAI Team"

Name "\${APPNAME}"
OutFile "${APPNAME}-\${VERSION}-Setup.exe"
InstallDir "$PROGRAMFILES\\${APPNAME}"
RequestExecutionLevel admin

Page directory
Page instfiles

Section "MainSection" SEC01
    SetOutPath "$INSTDIR"
    File /r "*"
    CreateShortCut "$DESKTOP\\${APPNAME}.lnk" "$INSTDIR\\FinSavvyAI.bat"
    CreateDirectory "$SMPROGRAMS\\${APPNAME}"
    CreateShortCut "$SMPROGRAMS\\${APPNAME}\\${APPNAME}.lnk" "$INSTDIR\\FinSavvyAI.bat"
SectionEnd
EOF

    # Create ZIP package
    cd $PACKAGE_DIR
    zip -r "${package_name}.zip" "$package_name/"
    cd ..

    print_status "✓ Windows package created: ${package_name}.zip"
    print_warning "NSIS installer script created: $package_name/installer.nsi"
}

# Create icon placeholder
create_icon_placeholder() {
    print_status "Creating icon placeholders..."

    # Create a simple icon file placeholder
    cat > $PACKAGE_DIR/icon.png << 'EOF'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==
EOF

    # This is a minimal 1x1 PNG - would be replaced with actual app icon
}

# Create README for package
create_package_readme() {
    cat > $PACKAGE_DIR/README.md << EOF
# FinSavvyAI Desktop Application v$VERSION

## Installation

### macOS
1. Download the \`.dmg\` file
2. Double-click to mount
3. Drag FinSavvyAI to Applications folder
4. Launch from Applications

### Linux
1. Download the \`.deb\` file (Debian/Ubuntu) or \`.tar.gz\` (other distributions)
2. For DEB: \`sudo dpkg -i finsavvyai-desktop_$VERSION*.deb\`
3. For tar.gz: \`tar -xzf finsavvyai-desktop-$VERSION*.tar.gz\` and run the binary

### Windows
1. Download the \`.zip\` file
2. Extract to a folder
3. Run \`FinSavvyAI.bat\`

## Usage

1. Start the application
2. Configure your cluster settings in the Settings panel
3. Add worker nodes using the Nodes section
4. Start the cluster and monitor performance

## Requirements

- **Backend**: Python 3.8+ with FinSavvyAI cluster
- **Memory**: 512MB minimum, 1GB recommended
- **Storage**: 50MB disk space

## Support

- Documentation: https://docs.finsavvyai.com
- Issues: https://github.com/finsavvyai/finsavvyai-cluster/issues
- Support: support@finsavvyai.com

---
FinSavvyAI Desktop v$VERSION
Built on $(date)
EOF
}

# Main execution
main() {
    create_icon_placeholder
    create_package_readme
    create_package $PLATFORM $ARCH

    # Show package info
    echo -e "\n${BLUE}📦 Package Summary${NC}"
    echo -e "${BLUE}==================${NC}"

    cd $PACKAGE_DIR
    echo -e "Created packages:"
    ls -la *.zip *.dmg *.deb *.tar.gz 2>/dev/null | while read -r line; do
        echo -e "  ${GREEN}$line${NC}"
    done
    cd ..

    # Get package sizes
    total_size=$(du -sh $PACKAGE_DIR | cut -f1)
    echo -e "\nTotal package size: ${GREEN}$total_size${NC}"

    print_status "🎉 Package creation completed!"
    echo -e "${YELLOW}Note: Upload packages to GitHub Releases for distribution${NC}"
}

# Run main function
main "$@"
