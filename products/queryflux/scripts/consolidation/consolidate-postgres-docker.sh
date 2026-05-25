#!/bin/bash
# Consolidation Script: postgres-docker → QueryFlux

set -e  # Exit on error

SOURCE="/Users/shaharsolomon/dev/projects/03_Enterprize_application/postgres-docker"
TARGET="/Users/shaharsolomon/dev/projects/03_Enterprize_application/queryflux"

echo "🚀 Starting postgres-docker Consolidation into QueryFlux..."
echo "Source: $SOURCE"
echo "Target: $TARGET"
echo ""

# Check if source exists
if [ ! -d "$SOURCE" ]; then
    echo "❌ Error: Source directory not found: $SOURCE"
    exit 1
fi

# Create target directories
echo "📁 Creating target directory structure..."
mkdir -p "$TARGET"/{desktop,mobile,extensions/vscode,themes,backend/python}

# Copy Desktop App (Apple Glass Design)
echo "🖥️  Copying desktop application..."
if [ -d "$SOURCE/apple-db-managers" ]; then
    cp -r "$SOURCE/apple-db-managers" "$TARGET/desktop/" 2>/dev/null || echo "⚠️  apple-db-managers not found"
fi

if [ -d "$SOURCE/src/ultimate_db_manager" ]; then
    cp -r "$SOURCE/src/ultimate_db_manager" "$TARGET/desktop/" 2>/dev/null || echo "⚠️  ultimate_db_manager not found"
fi

# Copy launch scripts
[ -f "$SOURCE/launch_glass_db_manager.py" ] && cp "$SOURCE/launch_glass_db_manager.py" "$TARGET/desktop/" || echo "⚠️  launch script not found"
[ -f "$SOURCE/launch_ultimate_db_manager.sh" ] && cp "$SOURCE/launch_ultimate_db_manager.sh" "$TARGET/desktop/" || echo "⚠️  launch script not found"

# Copy Mobile App
echo "📱 Copying mobile application..."
if [ -d "$SOURCE/mobile" ]; then
    cp -r "$SOURCE/mobile" "$TARGET/" 2>/dev/null || echo "⚠️  mobile directory not found"
fi

if [ -d "$SOURCE/android-pgdesk" ]; then
    cp -r "$SOURCE/android-pgdesk" "$TARGET/mobile/" 2>/dev/null || echo "⚠️  android-pgdesk not found"
fi

# Copy VS Code Extension
echo "🔧 Copying VS Code extension..."
if [ -d "$SOURCE/pgdesktop-vscode-extension" ]; then
    cp -r "$SOURCE/pgdesktop-vscode-extension" "$TARGET/extensions/vscode/" 2>/dev/null || echo "⚠️  vscode extension not found"
fi

# Copy Themes
echo "🎨 Copying premium themes..."
mkdir -p "$TARGET/themes/apple-glass"
mkdir -p "$TARGET/themes/professional"

# Copy theme-related files
find "$SOURCE" -name "*theme*" -type f -exec cp {} "$TARGET/themes/professional/" \; 2>/dev/null || echo "⚠️  No theme files found"

# Copy AI Components
echo "🤖 Copying AI components..."
if [ -d "$SOURCE/pg_ai" ]; then
    cp -r "$SOURCE/pg_ai" "$TARGET/backend/python/" 2>/dev/null || echo "⚠️  pg_ai not found"
fi

# Copy Database Adapters
echo "🗄️  Copying database adapters..."
if [ -d "$SOURCE/nosql_adapters" ]; then
    cp -r "$SOURCE/nosql_adapters" "$TARGET/backend/python/" 2>/dev/null || echo "⚠️  nosql_adapters not found"
fi

# Copy Documentation
echo "📚 Copying documentation..."
if [ -d "$SOURCE/docs" ]; then
    mkdir -p "$TARGET/docs/postgres-docker"
    cp -r "$SOURCE/docs"/* "$TARGET/docs/postgres-docker/" 2>/dev/null || echo "⚠️  docs not found"
fi

# Copy Python requirements
echo "📦 Copying Python dependencies..."
[ -f "$SOURCE/requirements.txt" ] && cp "$SOURCE/requirements.txt" "$TARGET/desktop/requirements-desktop.txt" || echo "⚠️  requirements.txt not found"
[ -f "$SOURCE/requirements-desktop.txt" ] && cp "$SOURCE/requirements-desktop.txt" "$TARGET/desktop/" || echo "⚠️  requirements-desktop.txt not found"
[ -f "$SOURCE/requirements-ai.txt" ] && cp "$SOURCE/requirements-ai.txt" "$TARGET/backend/python/" || echo "⚠️  requirements-ai.txt not found"

# Copy Docker configurations
echo "🐳 Copying Docker configurations..."
[ -f "$SOURCE/docker-compose.yml" ] && cp "$SOURCE/docker-compose.yml" "$TARGET/desktop/" || echo "⚠️  docker-compose.yml not found"
[ -f "$SOURCE/Dockerfile.gui" ] && cp "$SOURCE/Dockerfile.gui" "$TARGET/desktop/" || echo "⚠️  Dockerfile.gui not found"

# Create README for desktop
cat > "$TARGET/desktop/README.md" << 'EOF'
# QueryFlux Desktop Application

Premium desktop application with Apple Glass design.

**Migrated from:** postgres-docker (Ultimate Database Manager)

## Features

- 🍎 Apple Glass Design - Beautiful glassmorphism UI
- 🗄️ Multi-Database Support - PostgreSQL, MySQL, MongoDB, Redis, SQLite, and more
- 🎨 Premium Themes - Toad, Sublime, Sequel Pro, SQLyog, Cursor, Kiro
- 🤖 AI-Powered Analysis - Query optimization and schema insights
- 🔊 Audio Feedback - Professional sound cues
- 📊 Advanced Visualization - Interactive schema diagrams

## Tech Stack

- Python 3.8+ with PySide6
- Apple Glass design system
- Multi-database adapters
- AI integration

## Quick Start

```bash
# Install dependencies
pip install -r requirements-desktop.txt

# Launch desktop app
python launch_glass_db_manager.py
```

## Documentation

See the main QueryFlux README for complete documentation.
EOF

# Create README for mobile
cat > "$TARGET/mobile/README.md" << 'EOF'
# QueryFlux Mobile Application

React Native mobile companion app for iOS and Android.

**Migrated from:** postgres-docker

## Features

- 📱 Native iOS and Android support
- 🗄️ Database management on the go
- 🔄 Sync with web and desktop
- 📊 Query execution and results
- 🔔 Push notifications for alerts

## Tech Stack

- React Native
- Expo (optional)
- Native modules for database connectivity

## Quick Start

```bash
# Install dependencies
npm install

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Documentation

See the main QueryFlux README for complete documentation.
EOF

echo ""
echo "✅ postgres-docker consolidation complete!"
echo ""
echo "📊 Migration Summary:"
echo "  - Desktop app: Copied to desktop/"
echo "  - Mobile app: Copied to mobile/"
echo "  - VS Code extension: Copied to extensions/vscode/"
echo "  - Themes: Copied to themes/"
echo "  - AI components: Copied to backend/python/"
echo "  - Documentation: Copied to docs/postgres-docker/"
echo ""
echo "📍 Files migrated to: $TARGET"
echo ""
