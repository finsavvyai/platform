#!/bin/bash
set -e

# FinSavvyAI Desktop - Production Build Script
# Builds Go backend + bundles frontend into macOS .app

APP_NAME="FinSavvyAI"
VERSION="1.0.0"
BUNDLE_ID="com.finsavvyai.desktop"
BUILD_DIR="build"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"

echo "Building $APP_NAME Desktop v$VERSION..."

# Clean
rm -rf "$BUILD_DIR"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Build Go backend (stripped, optimized)
echo "Compiling Go backend..."
CGO_ENABLED=0 go build -ldflags="-s -w" -o "$APP_BUNDLE/Contents/Resources/finsavvyai-backend" simple_backend.go

# Copy frontend
echo "Copying frontend..."
cp src-frontend/index.html "$APP_BUNDLE/Contents/Resources/"
if [ -d "src-frontend/icons" ]; then
    cp -r src-frontend/icons "$APP_BUNDLE/Contents/Resources/"
fi

# Info.plist
cat > "$APP_BUNDLE/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID</string>
    <key>CFBundleName</key>
    <string>$APP_NAME Desktop</string>
    <key>CFBundleDisplayName</key>
    <string>$APP_NAME Desktop</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSRequiresAquaSystemAppearance</key>
    <false/>
    <key>CFBundleCategory</key>
    <string>public.app-category.developer-tools</string>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsLocalNetworking</key>
        <true/>
    </dict>
</dict>
</plist>
EOF

echo "APPL????" > "$APP_BUNDLE/Contents/PkgInfo"

# Launcher script
cat > "$APP_BUNDLE/Contents/MacOS/$APP_NAME" << 'LAUNCHER'
#!/bin/bash
set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESOURCES_DIR="$APP_DIR/Resources"
BACKEND="$RESOURCES_DIR/finsavvyai-backend"
LOG_DIR="$HOME/Library/Logs/FinSavvyAI"
LOG_FILE="$LOG_DIR/app.log"

mkdir -p "$LOG_DIR"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

# Find available port
for PORT in $(seq 8080 8090); do
    if ! lsof -ti:$PORT > /dev/null 2>&1; then break; fi
done

export PORT
log "Starting FinSavvyAI on port $PORT"

# Start backend
"$BACKEND" >> "$LOG_FILE" 2>&1 &
PID=$!
echo $PID > "$APP_DIR/backend.pid"

cleanup() {
    kill $PID 2>/dev/null || true
    rm -f "$APP_DIR/backend.pid"
    log "Stopped"
}
trap cleanup EXIT

# Wait for backend
for i in $(seq 1 10); do
    if curl -sf "http://localhost:$PORT/api/health" > /dev/null 2>&1; then break; fi
    if [ $i -eq 10 ]; then
        osascript -e 'display dialog "FinSavvyAI failed to start. Check ~/Library/Logs/FinSavvyAI/app.log" buttons {"OK"} with icon stop'
        exit 1
    fi
    sleep 1
done

log "Backend ready on port $PORT"
open "http://localhost:$PORT"
wait $PID 2>/dev/null || true
LAUNCHER

chmod +x "$APP_BUNDLE/Contents/MacOS/$APP_NAME"

# Build DMG
echo "Creating DMG..."
DMG_PATH="$BUILD_DIR/$APP_NAME-$VERSION.dmg"
hdiutil create -volname "$APP_NAME" -srcfolder "$APP_BUNDLE" -ov -format UDZO "$DMG_PATH" 2>/dev/null || {
    echo "DMG creation skipped (hdiutil unavailable). App bundle is ready."
}

# Summary
BINARY_SIZE=$(du -h "$APP_BUNDLE/Contents/Resources/finsavvyai-backend" | cut -f1)
echo ""
echo "Build complete!"
echo "  App:    $APP_BUNDLE"
echo "  Binary: $BINARY_SIZE"
if [ -f "$DMG_PATH" ]; then
    DMG_SIZE=$(du -h "$DMG_PATH" | cut -f1)
    echo "  DMG:    $DMG_PATH ($DMG_SIZE)"
fi
echo ""
echo "To run: open $APP_BUNDLE"
