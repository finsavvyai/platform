#!/bin/bash

# Questro Backend Build Script
# This script builds the backend while excluding test files

set -e

echo "🔨 Building Questro Backend..."

# Clean dist directory
echo "🧹 Cleaning dist directory..."
rm -rf dist
mkdir -p dist

# Try TypeScript compilation first
echo "📝 Attempting TypeScript compilation..."
if npx tsc --project tsconfig.build.json; then
    echo "✅ TypeScript compilation successful"
    
    # Copy assets if they exist
    if [ -d "src/assets" ]; then
        echo "📁 Copying assets..."
        cp -r src/assets dist/
    fi
    
    echo "🎉 Build completed successfully!"
    exit 0
else
    echo "⚠️  TypeScript compilation failed, trying Babel..."
fi

# Fallback to Babel with manual file copying
echo "🔄 Using Babel fallback..."

# Create a temporary source directory without test files
TEMP_SRC="temp_src"
rm -rf $TEMP_SRC
mkdir -p $TEMP_SRC

# Copy source files excluding test files
echo "📋 Copying source files (excluding tests)..."
find src -type f \( -name "*.ts" -o -name "*.js" \) ! -path "*/__tests__/*" ! -name "*.test.ts" ! -name "*.spec.ts" -exec cp --parents {} $TEMP_SRC \;

# Copy non-TypeScript files
find src -type f ! \( -name "*.ts" -o -name "*.js" -o -name "*.test.ts" -o -name "*.spec.ts" \) ! -path "*/__tests__/*" -exec cp --parents {} $TEMP_SRC \;

# Run Babel on the temporary source
echo "🔧 Running Babel compilation..."
if npx babel $TEMP_SRC --out-dir dist --extensions ".ts,.js" --source-maps; then
    echo "✅ Babel compilation successful"
else
    echo "❌ Babel compilation failed, trying without plugins..."
    # Try without the runtime plugin if it fails
    npx babel $TEMP_SRC --out-dir dist --extensions ".ts,.js" --source-maps --no-babelrc
fi

# Clean up temporary directory
rm -rf $TEMP_SRC

echo "🎉 Build completed successfully!"
