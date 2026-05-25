#!/bin/bash

echo "🚀 Building Ultimate Universal Database Manager VSCode Extension"
echo "=============================================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npm run compile

if [ $? -ne 0 ]; then
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Run linting
echo "🧹 Running linter..."
npm run lint
if [ $? -ne 0 ]; then
    echo "⚠️ Linting found issues, but continuing build..."
fi

# Package the extension
echo "📦 Packaging extension..."
npm run package

if [ $? -ne 0 ]; then
    echo "❌ Extension packaging failed"
    exit 1
fi

echo "✅ Extension built successfully!"
echo ""
echo "📁 Output: ultimate-db-manager-vscode-1.0.0.vsix"
echo ""
echo "🎯 To install:"
echo "   code --install-extension ultimate-db-manager-vscode-1.0.0.vsix"
echo ""
echo "🚀 To publish:"
echo "   vsce publish"