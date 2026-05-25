# QueryFlux Mobile - Deployment Guide

This guide covers building, testing, and deploying the QueryFlux mobile applications for iOS and Android platforms.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Setup](#development-setup)
3. [Building Applications](#building-applications)
4. [Testing](#testing)
5. [Deployment](#deployment)
6. [Store Distribution](#store-distribution)
7. [Security & Certificates](#security--certificates)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Development Environment
- Node.js 20+
- React Native CLI
- Android Studio (for Android development)
- Xcode 14+ (for iOS development)
- Git

### Platform-Specific Requirements

#### Android
- Android Studio with Android SDK
- Java Development Kit (JDK) 17
- Android SDK (API level 33+)
- Android build tools
- An Android device or emulator

#### iOS
- macOS 13+ (Ventura) or later
- Xcode 14+ with command line tools
- iOS Simulator
- Physical iOS device (for testing)
- Apple Developer account ($99/year)

### Required Services & Accounts
- **Firebase account** (for push notifications and analytics)
- **Google Play Console** account ($25 one-time)
- **Apple Developer Program** membership ($99/year)
- **GitHub repository** (for CI/CD)

## Development Setup

### 1. Clone Repository
```bash
git clone https://github.com/queryflux/queryflux.git
cd queryflux/mobile
```

### 2. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# Install iOS dependencies (macOS only)
cd ios && pod install && cd ..
```

### 3. Environment Configuration
Create environment files for different environments:

#### Development (`.env.development`)
```bash
# API endpoints
API_URL=http://localhost:8080/api
WS_URL=ws://localhost:8080/ws

# Firebase
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_PROJECT_ID=queryflux-dev
FIREBASE_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Sentry (error tracking)
SENTRY_DSN=your_sentry_dsn

# Analytics
ANALYTICS_ENABLED=true
```

#### Staging (`.env.staging`)
```bash
API_URL=https://staging-api.queryflux.com/api
WS_URL=wss://staging-api.queryflux.com/ws
FIREBASE_PROJECT_ID=queryflux-staging
```

#### Production (`.env.production`)
```bash
API_URL=https://api.queryflux.com/api
WS_URL=wss://api.queryflux.com/ws
FIREBASE_PROJECT_ID=queryflux-prod
ANALYTICS_ENABLED=true
```

### 4. Platform Setup

#### Android Setup
1. Open Android Studio
2. Configure Android SDK path
3. Create virtual device or connect physical device
4. Accept licenses:
   ```bash
   cd android
   ./gradlew --stacktrace
   ```

#### iOS Setup
1. Open Xcode
2. Open `ios/QueryFlux.xcworkspace`
3. Select your development team in project settings
4. Update bundle identifier if needed

## Building Applications

### Development Builds

#### Android
```bash
# Debug build
npm run build:android:debug

# Install debug APK
npm run android:install:debug

# Run on device/emulator
npm run android
```

#### iOS
```bash
# Debug build
npm run build:ios:debug

# Run on simulator
npm run ios

# Run on device (requires development certificate)
npm run run:ios:debug
```

### Production Builds

#### Android
```bash
# Release APK
npm run build:android

# Release Bundle (for Play Store)
npm run bundle:android

# Both APK and Bundle
npm run release:android
```

#### iOS
```bash
# Release build
npm run build:ios

# Archive and export IPA
npm run release:ios

# Ad-hoc build (for testing)
npm run build:ios:adhoc
```

### Build Artifacts

#### Android Outputs
- `android/app/build/outputs/apk/release/app-release.apk` - Release APK
- `android/app/build/outputs/bundle/release/app-release.aab` - Play Store Bundle

#### iOS Outputs
- `ios/build/QueryFlux.ipa` - Release IPA
- `~/Library/Developer/Xcode/Archives/` - Xcode archives

## Testing

### Unit Tests
```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Integration Tests
```bash
# Android instrumented tests
cd android && ./gradlew connectedAndroidTest

# iOS UI tests (use Xcode)
open ios/QueryFlux.xcworkspace
# Run UI tests from Xcode
```

### Linting & Type Checking
```bash
# ESLint
npm run lint

# Fix linting issues
npm run lint:fix

# TypeScript checking
npm run typecheck
```

### Security Audit
```bash
# Check for vulnerabilities
npm run security:audit

# Moderate level check
npm run security:check
```

## Deployment

### Automated Deployment (GitHub Actions)

The mobile apps are automatically built and deployed using GitHub Actions:

#### Triggers
- Push to `main` or `develop` branches
- Pull requests to `main`
- Tag pushes (releases)
- Manual workflow dispatch

#### Build Jobs
1. **Test** - Unit tests, linting, security audit
2. **Build Android** - APK and AAB generation
3. **Build iOS** - Archive and IPA creation
4. **Security Scan** - OWASP dependency check
5. **Release** - Create GitHub Release
6. **Deploy** - Upload to app stores

### Manual Deployment

#### Android
```bash
# Build release version
npm run release:android

# Upload to Google Play Console
# 1. Go to https://play.google.com/console
# 2. Select QueryFlux app
# 3. Create new release
# 4. Upload APK/AAB file
# 5. Fill release notes
# 6. Submit for review
```

#### iOS
```bash
# Build and archive
npm run release:ios

# Upload to App Store Connect
# 1. Go to https://appstoreconnect.apple.com
# 2. Select QueryFlux app
# 3. Create new version
# 4. Upload IPA using Xcode Organizer
# 5. Fill metadata and screenshots
# 6. Submit for review
```

## Store Distribution

### Google Play Store

#### Setup
1. Create app in [Google Play Console](https://play.google.com/console)
2. Upload first APK/AAB
3. Fill store listing
4. Set up content rating
5. Configure pricing and distribution
6. Set up signing keys

#### Release Tracks
- **Internal Testing** - Up to 100 testers
- **Closed Testing** - Up to 2,000 testers
- **Open Testing** - Public testing
- **Production** - Full release

#### Upload via Fastlane
```bash
cd android
bundle exec fastlane beta    # Internal testing
bundle exec fastlane release # Production
```

### Apple App Store

#### Setup
1. Create app in [App Store Connect](https://appstoreconnect.apple.com)
2. Configure app information
3. Set up pricing and availability
4. Prepare app metadata and screenshots
5. Configure App Store privacy

#### Build Configurations
- **Development** - Development certificates
- **Ad-Hoc** - Limited testing (up to 100 devices)
- **App Store** - Public distribution

#### Upload via Fastlane
```bash
cd ios
bundle exec fastlane beta    # TestFlight
bundle exec fastlane release # App Store
```

### Alternative Distribution

#### Direct APK Distribution
```bash
# Host APK on your website
# Share download link with users
# Enable "Install from unknown sources" on Android
```

#### Enterprise Distribution
- **Android** - Google Play Enterprise
- **iOS** - Apple Developer Enterprise Program

## Security & Certificates

### Android

#### Signing Keys
```bash
# Generate keystore (one-time)
keytool -genkey -v -keystore queryflux-release.keystore -alias queryflux -keyalg RSA -keysize 2048 -validity 10000

# Set environment variables
export RELEASE_STORE_FILE=queryflux-release.keystore
export RELEASE_STORE_PASSWORD=your_keystore_password
export RELEASE_KEY_ALIAS=queryflux
export RELEASE_KEY_PASSWORD=your_key_password
```

#### Google Play App Signing
- Let Google manage signing keys
- Upload only App Bundles (.aab)
- Enhanced security and automatic optimization

### iOS

#### Certificates
1. **Development Certificate** - Development and testing
2. **Distribution Certificate** - App Store distribution
3. **Push Notification Certificate** - Push notifications
4. **Provisioning Profiles** - Device authorization

#### Managing Certificates
```bash
# Install Fastlane
gem install fastlane

# Sync certificates
cd ios && bundle exec fastlane sync_certificates
```

### Environment Variables

#### GitHub Secrets
Set these in your GitHub repository settings:

**Android:**
- `ANDROID_KEYSTORE_BASE64` - Base64 encoded keystore
- `ANDROID_KEYSTORE_PASSWORD` - Keystore password
- `ANDROID_KEY_ALIAS` - Key alias
- `ANDROID_KEY_PASSWORD` - Key password
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` - Google Play API credentials

**iOS:**
- `BUILD_CERTIFICATE_BASE64` - Base64 encoded certificate
- `P12_PASSWORD` - Certificate password
- `BUILD_PROVISION_PROFILE_BASE64` - Base64 encoded profile
- `KEYCHAIN_PASSWORD` - Keychain password
- `APPLE_ID` - Apple ID
- `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Apple Team ID

## Troubleshooting

### Common Build Issues

#### Android
```bash
# Gradle sync issues
./gradlew clean

# Build cache issues
./gradlew cleanBuildCache

# Dependency issues
rm -rf .gradle && ./gradlew build

# Emulator issues
./gradlew clean && ./gradlew assembleDebug
```

#### iOS
```bash
# CocoaPods issues
cd ios && rm -rf Pods Podfile.lock && pod install

# Xcode cache issues
rm -rf ~/Library/Developer/Xcode/DerivedData

# Build issues
xcodebuild clean -workspace QueryFlux.xcworkspace -scheme QueryFlux
```

### Code Signing Issues

#### Android
1. Verify keystore exists and password is correct
2. Check key alias matches signing configuration
3. Ensure Gradle properties are set correctly

#### iOS
1. Verify certificates are valid and not expired
2. Check provisioning profile matches bundle identifier
3. Ensure Xcode team selection is correct
4. Clear keychain access issues

### Performance Issues

#### Build Performance
```bash
# Enable Gradle daemon and parallel builds
export GRADLE_OPTS="-Dorg.gradle.daemon=true -Dorg.gradle.parallel=true"

# Use build cache
export GRADLE_USER_HOME=$HOME/.gradle

# Android
./gradlew assembleRelease --build-cache --parallel

# iOS
xcodebuild -workspace QueryFlux.xcworkspace -scheme QueryFlux -configuration Release -derivedDataPath ./build
```

#### App Performance
- Use React Native Flipper for debugging
- Monitor with Firebase Performance
- Profile with Xcode Instruments (iOS)
- Use Android Studio Profiler (Android)

### CI/CD Issues

#### GitHub Actions
1. Check workflow logs for specific errors
2. Verify secrets are correctly configured
3. Ensure runner has sufficient resources
4. Check for timeout issues

#### Fastlane Issues
```bash
# Update Fastlane
bundle update fastlane

# Clear Fastlane cache
fastlane lane_cleanup

# Verbose logging
fastlane beta --verbose
```

## Monitoring & Analytics

### Firebase Integration
```javascript
// Initialize Firebase in your app
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';

// Analytics
await analytics().logScreenView({
  screen_name: 'Dashboard',
  screen_class: 'DashboardScreen',
});

// Crash reporting
crashlytics().recordError('Database connection failed');
```

### Error Tracking
- **Sentry** - Error monitoring and performance
- **Firebase Crashlytics** - Crash reports
- **Custom logging** - Database operation logs

### Performance Monitoring
- **Firebase Performance** - App performance metrics
- **Custom metrics** - Database connection times
- **Network monitoring** - API response times

## Best Practices

### Development
- Use environment-specific configurations
- Implement proper error handling
- Follow React Native best practices
- Use TypeScript for type safety

### Security
- Never commit secrets to version control
- Use certificate pinning for API calls
- Implement proper authentication
- Validate user inputs

### Performance
- Optimize bundle size with code splitting
- Use lazy loading for large components
- Implement proper caching strategies
- Monitor memory usage

### Testing
- Write comprehensive unit tests
- Test on multiple device sizes
- Perform integration testing
- Use automated testing in CI/CD

---

For more information, see:
- [React Native Documentation](https://reactnative.dev/)
- [Fastlane Documentation](https://docs.fastlane.tools/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)