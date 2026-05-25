#!/bin/bash

# Enhanced Database Manager VSCode Extension Build Script
# Builds the enhanced version with all new features

echo "🚀 Building Enhanced Database Manager VSCode Extension..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf out/
rm -f *.vsix

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npm run compile

# Check for compilation errors
if [ $? -ne 0 ]; then
    echo "❌ TypeScript compilation failed!"
    exit 1
fi

# Copy enhanced package.json
echo "📋 Setting up enhanced package.json..."
cp package-enhanced.json package.json

# Package the extension
echo "📦 Packaging extension..."
npx vsce package --out enhanced-db-manager-vscode-2.0.0.vsix

# Check if packaging was successful
if [ $? -eq 0 ]; then
    echo "✅ Enhanced Database Manager VSCode Extension built successfully!"
    echo "📁 Extension file: enhanced-db-manager-vscode-2.0.0.vsix"
    echo ""
    echo "🚀 Features included:"
    echo "  ✅ Enhanced table structure viewing"
    echo "  ✅ Schema selection and browsing"
    echo "  ✅ Inline data editing capabilities"
    echo "  ✅ Modern query editor"
    echo "  ✅ Improved UI/UX"
    echo ""
    echo "📖 To install:"
    echo "  code --install-extension enhanced-db-manager-vscode-2.0.0.vsix"
    echo ""
    echo "🎉 Ready to use!"
else
    echo "❌ Extension packaging failed!"
    exit 1
fi


