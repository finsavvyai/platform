#!/bin/bash

# Custom build script for Netlify deployment
echo "🚀 Starting Questro Frontend Build..."

# Clean up any existing build artifacts
echo "🧹 Cleaning up..."
rm -rf node_modules package-lock.json dist

# Install dependencies with legacy peer deps to handle rollup issues
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

# Install rollup binary explicitly if needed
echo "🔧 Installing rollup binary..."
npm install @rollup/rollup-linux-x64-gnu --save-dev --legacy-peer-deps

# Run TypeScript compilation
echo "🔨 Running TypeScript compilation..."
npx tsc

# Run Vite build
echo "⚡ Running Vite build..."
npx vite build

echo "✅ Build completed successfully!"
