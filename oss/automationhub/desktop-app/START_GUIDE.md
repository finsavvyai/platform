# 🚀 UPM.Plus Desktop App - Quick Start Guide

## Prerequisites

### 1. Install Rust
```bash
# Install Rust (required for Tauri)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Verify installation
rustc --version
cargo --version
```

### 2. Install Node.js
```bash
# Install Node.js 18+ (for Vue.js frontend)
# Using Homebrew (recommended on macOS)
brew install node@18

# Or download from: https://nodejs.org/
# Verify installation
node --version  # Should be 18+
npm --version
```

### 3. Install Tauri CLI
```bash
# Install Tauri CLI globally
npm install -g @tauri-apps/cli

# Or install locally in project
npm install --save-dev @tauri-apps/cli

# Verify installation
npx tauri --version
```

### 4. System Dependencies (macOS)
```bash
# Install Xcode Command Line Tools (if not already installed)
xcode-select --install

# Install additional dependencies
brew install pkg-config
```

## 🎯 Quick Start

### Step 1: Navigate to Desktop App Directory
```bash
cd /Users/shaharsolomon/dev/projects/github/upm.plus/desktop-app
```

### Step 2: Install Dependencies
```bash
# Install Node.js dependencies
npm install

# This will install:
# - Vue 3, TypeScript, Vite
# - Tauri dependencies
# - UI components (Tailwind, Heroicons)
# - State management (Pinia)
```

### Step 3: Start Development Server
```bash
# Start the development server
npm run tauri:dev

# This will:
# 1. Start Vite dev server (Vue.js frontend) on http://localhost:3000
# 2. Compile Rust backend
# 3. Launch native macOS app window
# 4. Enable hot reload for both frontend and backend
```

## 🎨 Alternative: Web Development Mode

If you want to develop the UI first without the native app:

```bash
# Start only the Vue.js frontend
npm run dev

# Open browser at http://localhost:3000
# Note: Tauri APIs won't work in browser mode
```

## 📦 Build for Production

```bash
# Build the native app for distribution
npm run tauri:build

# This creates:
# - Optimized Vue.js build
# - Compiled Rust binary
# - macOS app bundle (.app)
# - DMG installer (optional)
```

## 🐛 Troubleshooting

### Common Issues:

#### 1. Rust/Cargo not found
```bash
# Make sure Rust is in your PATH
echo $PATH | grep -o '[^:]*cargo[^:]*'

# If not found, add to your shell profile
echo 'source ~/.cargo/env' >> ~/.zshrc
source ~/.zshrc
```

#### 2. Node.js version too old
```bash
# Check Node.js version
node --version

# Update if needed
brew upgrade node@18
# or
npm install -g n
n 18
```

#### 3. Tauri compilation errors
```bash
# Clear Rust cache and rebuild
cd src-tauri
cargo clean
cd ..
npm run tauri:dev
```

#### 4. Frontend build issues
```bash
# Clear Node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 5. Missing Xcode tools
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Accept license
sudo xcodebuild -license accept
```

## ⚡ Development Tips

### Hot Reload
- **Frontend changes**: Vue.js files auto-reload in ~100ms
- **Backend changes**: Rust files trigger app restart (~2-3s)
- **Tauri config**: Requires manual restart

### Debugging
```bash
# View Rust logs
npm run tauri:dev -- --verbose

# Vue.js DevTools available in development
# Rust debugging with VS Code + rust-analyzer
```

### Recommended VS Code Extensions
```json
{
  "recommendations": [
    "rust-lang.rust-analyzer",
    "Vue.volar",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "tauri-apps.tauri-vscode"
  ]
}
```

## 🎯 Expected Startup Time

- **First build**: 2-5 minutes (Rust compilation)
- **Subsequent starts**: 10-30 seconds
- **Hot reload**: Near-instant

## 📱 App Features After Startup

Once started, you'll see:

1. **Native macOS app window** with UPM.Plus interface
2. **Menu bar icon** (🚀) for quick access
3. **Real-time dashboard** with system metrics
4. **Project detection** of local development projects
5. **AI project wizard** for creating new projects

## 🔧 Configuration

### Environment Variables
Create `.env` file in desktop-app directory:
```bash
# UPM.Plus Backend API
VITE_API_URL=http://localhost:8001

# Development mode
VITE_DEV_MODE=true

# Enable debugging
TAURI_DEBUG=true
```

### Tauri Configuration
Edit `src-tauri/tauri.conf.json` for:
- App name and version
- Window dimensions
- System permissions
- Auto-updater settings

## 🎉 Success!

When everything is working, you should see:
- Native macOS app window opens
- Beautiful Vue.js interface loads
- Menu bar icon appears
- Console shows "UPM.Plus Desktop initialized successfully"

The app will automatically scan for local projects and display them in the dashboard!