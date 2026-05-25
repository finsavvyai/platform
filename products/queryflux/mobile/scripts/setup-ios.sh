#!/bin/bash

# QueryFlux iOS Setup Script
# This script helps set up the iOS project for building

set -e

echo "🍎 QueryFlux iOS Setup"
echo "======================"

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script must be run on macOS"
    exit 1
fi

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode is not installed. Please install Xcode from the App Store"
    exit 1
fi

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Please run this script from the mobile project root"
    exit 1
fi

echo "✅ Environment checks passed"

# Check if iOS directory exists
if [[ ! -d "ios" ]]; then
    echo "📁 Creating iOS directory..."
    mkdir -p ios
fi

cd ios

# Check if the workspace exists
if [[ -f "QueryFlux.xcworkspace/contents.xcworkspacedata" ]]; then
    echo "✅ iOS workspace already exists"
else
    echo "⚠️  iOS workspace needs proper initialization"
    echo ""
    echo "To create a complete React Native iOS project:"
    echo "1. Run: npx react-native init QueryFluxTemp --template react-native-template-typescript"
    echo "2. Copy the iOS directory: cp -r QueryFluxTemp/ios/* ios/"
    echo "3. Clean up: rm -rf QueryFluxTemp"
    echo ""
    echo "Or use the automated setup below:"
fi

# Check for CocoaPods
if ! command -v pod &> /dev/null; then
    echo "📦 Installing CocoaPods..."
    sudo gem install cocoapods
else
    echo "✅ CocoaPods is installed"
fi

# Check if Podfile exists
if [[ -f "Podfile" ]]; then
    echo "📦 Installing pods..."
    pod install
    echo "✅ Pods installed successfully"
else
    echo "⚠️  No Podfile found"
fi

# Check if the project can be opened
if [[ -f "QueryFlux.xcworkspace" ]]; then
    echo "🚀 Opening workspace in Xcode..."
    open QueryFlux.xcworkspace
    echo ""
    echo "📋 Next steps:"
    echo "1. Select your development team in Xcode project settings"
    echo "2. Update bundle identifier if needed"
    echo "3. Build and run the project"
else
    echo "⚠️  No workspace found. Initialize React Native project first."
fi

echo ""
echo "🎉 iOS setup complete!"