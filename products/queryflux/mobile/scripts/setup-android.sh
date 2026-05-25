#!/bin/bash

# QueryFlux Android Setup Script
# This script helps set up the Android project for building

set -e

echo "🤖 QueryFlux Android Setup"
echo "========================="

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Please run this script from the mobile project root"
    exit 1
fi

echo "✅ Environment checks passed"

# Check if Android directory exists
if [[ ! -d "android" ]]; then
    echo "📁 Creating Android directory..."
    mkdir -p android
fi

cd android

# Check if the Gradle wrapper exists
if [[ ! -f "gradlew" ]]; then
    echo "⚠️  Android project needs proper initialization"
    echo ""
    echo "To create a complete React Native Android project:"
    echo "1. Run: npx react-native init QueryFluxTemp --template react-native-template-typescript"
    echo "2. Copy the Android directory: cp -r QueryFluxTemp/android/* android/"
    echo "3. Clean up: rm -rf QueryFluxTemp"
    echo ""
    echo "Or initialize a new Android project manually:"
    echo "1. Create a new Android project in Android Studio"
    echo "2. Copy the generated files to android/"
    echo "3. Configure the build.gradle and settings.gradle files"
else
    echo "✅ Android project structure found"
fi

# Check for basic configuration
if [[ -f "app/build.gradle" ]]; then
    echo "📦 Android build configuration found"
else
    echo "⚠️  No build.gradle found"
fi

# Check if we can run basic gradle commands
if command -v java &> /dev/null; then
    echo "☕ Java is available"
    java -version
else
    echo "❌ Java is not installed. Please install Java 8 or later"
fi

# Check for Android SDK
if [[ -n "$ANDROID_HOME" ]]; then
    echo "📱 ANDROID_HOME is set to: $ANDROID_HOME"
else
    echo "⚠️  ANDROID_HOME is not set"
    echo "   Set it to your Android SDK path"
    echo "   Example: export ANDROID_HOME=/Users/$USER/Library/Android/sdk"
fi

echo ""
echo "🎯 Build commands available:"
echo "  npm run build:android      - Show build status"
echo "  npm run build:android:debug - Build debug APK"
echo "  npm run build:android:release - Build release APK"
echo "  npm run build:android:bundle - Build AAB for Play Store"

echo ""
echo "📋 Next steps:"
echo "1. Install Android Studio if not already installed"
echo "2. Set up Android SDK and emulator"
echo "3. Configure ANDROID_HOME environment variable"
echo "4. Run 'npm run build:android:debug' to test build"
echo "5. For production builds, set up signing keys"

echo ""
echo "🎉 Android setup complete!"