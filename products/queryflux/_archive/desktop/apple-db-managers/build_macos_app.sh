#!/bin/bash

# 🍎 Build Ultimate Database Manager as macOS App Bundle
echo "🍎 Building Ultimate Database Manager for macOS..."

# Activate virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

# Install dependencies
echo "📥 Installing build dependencies..."
pip install --upgrade pip
pip install PySide6 psycopg2-binary py2app

# Install optional dependencies
pip install mysql-connector-python pymongo redis || echo "⚠️ Optional database drivers installation failed"
pip install qdarktheme || echo "⚠️ qdarktheme not available - will use fallback"

# Create icns file from PNG icons
echo "🎨 Creating icon set..."
if command -v iconutil &> /dev/null; then
    # Create iconset directory structure
    mkdir -p resources/app_icon.iconset

    # Copy icons to iconset with proper naming
    cp resources/icon_16.png resources/app_icon.iconset/icon_16x16.png
    cp resources/icon_32.png resources/app_icon.iconset/icon_16x16@2x.png
    cp resources/icon_32.png resources/app_icon.iconset/icon_32x32.png
    cp resources/icon_64.png resources/app_icon.iconset/icon_32x32@2x.png
    cp resources/icon_128.png resources/app_icon.iconset/icon_128x128.png
    cp resources/icon_256.png resources/app_icon.iconset/icon_128x128@2x.png
    cp resources/icon_256.png resources/app_icon.iconset/icon_256x256.png
    cp resources/icon_512.png resources/app_icon.iconset/icon_256x256@2x.png
    cp resources/icon_512.png resources/app_icon.iconset/icon_512x512.png
    cp resources/icon_1024.png resources/app_icon.iconset/icon_512x512@2x.png

    # Create icns file
    iconutil -c icns resources/app_icon.iconset -o resources/app_icon.icns
    echo "✅ App icon created: resources/app_icon.icns"
else
    echo "⚠️ iconutil not found - app will use default icon"
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf build dist

# Build the app
echo "🔨 Building macOS app bundle..."
python setup_macos_app.py py2app

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ macOS App Build Complete!"
    echo ""
    echo "📱 Your app is ready:"
    echo "   Location: dist/Ultimate Database Manager.app"
    echo "   Size: $(du -sh "dist/Ultimate Database Manager.app" | cut -f1)"
    echo ""
    echo "🚀 To install:"
    echo "   1. Copy to Applications folder:"
    echo "      cp -R 'dist/Ultimate Database Manager.app' /Applications/"
    echo ""
    echo "   2. Or run directly:"
    echo "      open 'dist/Ultimate Database Manager.app'"
    echo ""
    echo "📦 For App Store distribution:"
    echo "   - Code signing required"
    echo "   - Notarization required"
    echo "   - App Store provisioning profile needed"
    echo ""
else
    echo "❌ Build failed. Check the output above for errors."
    exit 1
fi