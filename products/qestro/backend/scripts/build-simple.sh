#!/bin/bash

# Simple Questro Backend Build Script
# Uses only TypeScript compilation to avoid Babel issues

set -e

echo "🔨 Building Questro Backend (Simple Mode)..."

# Clean dist directory
echo "🧹 Cleaning dist directory..."
rm -rf dist
mkdir -p dist

# Use TypeScript compilation with test exclusion
echo "📝 Compiling TypeScript (excluding tests)..."
npx tsc --project tsconfig.build.json

# Copy assets if they exist
if [ -d "src/assets" ]; then
    echo "📁 Copying assets..."
    cp -r src/assets dist/
fi

echo "🎉 Build completed successfully!"
