# 🍎 FinSavvyAI macOS App Guide

## Building the macOS App

### Quick Build
```bash
cd desktop-app
./build_macos_app.sh
```

This creates:
- App bundle: `build/macos/FinSavvyAI.app`
- DMG: `build/macos/FinSavvyAI-1.0.0-macOS.dmg`

## App Structure

```
FinSavvyAI.app/
├── Contents/
│   ├── Info.plist          # App metadata
│   ├── PkgInfo             # Package info
│   ├── MacOS/
│   │   └── FinSavvyAI      # Main executable
│   └── Resources/
│       ├── finsavvyai-backend  # Go backend
│       ├── index.html          # Frontend
│       ├── js/                 # JavaScript
│       ├── css/                # Stylesheets
│       └── icons/              # App icons
```

## Features

### Automatic Port Detection
- Finds available port (8080-8090)
- Avoids conflicts with other apps

### Background Service
- Go backend runs as background process
- Auto-starts when app launches
- Auto-stops when app quits

### Browser Integration
- Automatically opens default browser
- Connects to local backend
- No manual URL entry needed

### Logging
- Logs stored in `~/Library/Logs/FinSavvyAI/app.log`
- Backend logs included
- Error tracking

## Installation

### From DMG
1. Open the DMG file
2. Drag `FinSavvyAI.app` to Applications
3. Open from Applications folder

### First Launch
1. Right-click app → Open
2. Click "Open" in security dialog
3. App will start backend and open browser

## Usage

### Starting the App
- Double-click `FinSavvyAI.app`
- Or use Spotlight: `Cmd+Space`, type "FinSavvyAI"

### Accessing the App
- Browser opens automatically to `http://localhost:8080`
- If browser doesn't open, navigate manually

### Stopping the App
- Quit the app normally (Cmd+Q)
- Backend stops automatically

## Troubleshooting

### App Won't Open
```bash
# Check if port is in use
lsof -i :8080

# Check logs
tail -f ~/Library/Logs/FinSavvyAI/app.log
```

### Backend Not Starting
```bash
# Check backend binary
ls -la FinSavvyAI.app/Contents/Resources/finsavvyai-backend

# Run manually
./FinSavvyAI.app/Contents/Resources/finsavvyai-backend
```

### Browser Doesn't Open
- Manually navigate to `http://localhost:8080`
- Check if backend is running: `lsof -i :8080`

### Permission Issues
```bash
# Make executable
chmod +x FinSavvyAI.app/Contents/MacOS/FinSavvyAI
chmod +x FinSavvyAI.app/Contents/Resources/finsavvyai-backend
```

## Customization

### Change Port Range
Edit `build_macos_app.sh`:
```bash
local start_port=8080
local end_port=8090
```

### Change App Name
Edit `build_macos_app.sh`:
```bash
APP_NAME="YourAppName"
BUNDLE_ID="com.yourcompany.yourapp"
```

### Add App Icon
1. Create `icons/AppIcon.icns`
2. Run build script
3. Icon will be included automatically

## Distribution

### Code Signing (Optional)
```bash
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name" \
  FinSavvyAI.app
```

### Notarization (Optional)
```bash
xcrun notarytool submit FinSavvyAI.dmg \
  --apple-id your@email.com \
  --team-id YOUR_TEAM_ID \
  --password YOUR_APP_PASSWORD
```

### Create Installer (Optional)
Use `createinstallmedia` or PackageMaker for installer creation.

## Development

### Testing Locally
```bash
# Build app
./build_macos_app.sh

# Test app
open build/macos/FinSavvyAI.app
```

### Debugging
```bash
# View logs
tail -f ~/Library/Logs/FinSavvyAI/app.log

# Run backend manually
./build/macos/FinSavvyAI.app/Contents/Resources/finsavvyai-backend
```

## Requirements

- macOS 10.15 (Catalina) or later
- Go 1.21+ (for building)
- Internet connection (for initial setup)

## Support

For issues:
1. Check logs: `~/Library/Logs/FinSavvyAI/app.log`
2. Verify backend is running
3. Check port availability
4. Review troubleshooting section

