# QueryFlux Mobile Makefile
# Provides convenient commands for building and testing the React Native app

.PHONY: help install dev test clean build release android ios setup

# Default target
help:
	@echo "QueryFlux Mobile - Available Commands:"
	@echo ""
	@echo "Setup:"
	@echo "  install       Install dependencies"
	@echo "  setup:android Setup Android development environment"
	@echo "  setup:ios     Setup iOS development environment"
	@echo ""
	@echo "Development:"
	@echo "  dev           Start Metro bundler"
	@echo "  dev:android   Run on Android device/emulator"
	@echo "  dev:ios       Run on iOS simulator/device"
	@echo ""
	@echo "Testing:"
	@echo "  test          Run unit tests"
	@echo "  test:watch    Run tests in watch mode"
	@echo "  test:coverage Run tests with coverage"
	@echo "  lint          Run ESLint"
	@echo "  typecheck     Run TypeScript checking"
	@echo "  precommit     Run all pre-commit checks"
	@echo ""
	@echo "Building:"
	@echo "  build         Build all platforms"
	@echo "  build:android Build Android APK/AAB"
	@echo "  build:ios     Build iOS archive"
	@echo "  clean         Clean build artifacts"
	@echo ""
	@echo "Release:"
	@echo "  release       Create full release"
	@echo "  release:android Release Android only"
	@echo "  release:ios   Release iOS only"
	@echo "  release:staging Create staging release"
	@echo ""
	@echo "Fastlane:"
	@echo "  fastlane:android Run Android Fastlane"
	@echo "  fastlane:ios   Run iOS Fastlane"
	@echo ""
	@echo "Utilities:"
	@echo "  android:devices List connected Android devices"
	@echo "  android:logcat  Show Android logs"
	@echo "  ios:simulators  List iOS simulators"
	@echo "  ios:logs      Show iOS logs"
	@echo "  security:audit Run security audit"

# Setup
install:
	npm install
	npm run pod-install

setup:android:
	@echo "🔧 Setting up Android development environment..."
	@echo "Please ensure you have:"
	@echo "- Android Studio installed"
	@echo "- Android SDK configured"
	@echo "- An Android device or emulator running"
	@echo ""
	@echo "Run 'make android:devices' to verify setup"

setup:ios:
	@echo "🔧 Setting up iOS development environment..."
	@echo "Please ensure you have:"
	@echo "- Xcode installed"
	@echo "- Command line tools configured"
	@echo "- An iOS simulator or device"
	@echo ""
	@echo "Run 'make ios:simulators' to verify setup"

# Development
dev:
	npm start

dev:android:
	npm run android

dev:ios:
	npm run ios

# Testing
test:
	npm test

test:watch:
	npm run test:watch

test:coverage:
	npm run test:coverage

lint:
	npm run lint

lint:fix:
	npm run lint:fix

typecheck:
	npm run typecheck

precommit:
	npm run precommit

# Building
build:
	npm run build:all

build:android:
	npm run build:android

build:ios:
	npm run build:ios

clean:
	npm run clean

# Release
release:
	npm run release

release:android:
	npm run release:android

release:ios:
	npm run release:ios

release:staging:
	npm run release:staging

# Fastlane
fastlane:android:
	npm run fastlane:android

fastlane:ios:
	npm run fastlane:ios

# Utilities
android:devices:
	npm run android:devices

android:logcat:
	npm run android:logcat

android:install:debug:
	npm run android:install:debug

android:install:release:
	npm run android:install:release

ios:simulators:
	npm run ios:simulators

ios:logs:
	npm run ios:logs

security:audit:
	npm run security:audit

# Quick commands
quick-test: install test
quick-build: install build
quick-release: install release

# CI/CD
ci:
	npm run build:ci

# Environment checks
check-env:
	@echo "🔍 Checking environment..."
	@echo "Node.js: $(shell node --version)"
	@echo "npm: $(shell npm --version)"
	@echo "React Native CLI: $(shell npx react-native --version 2>/dev/null || echo 'Not installed')"
	@if command -v adb >/dev/null 2>&1; then \
		echo "Android SDK: ✅ ($(shell adb version | head -1))"; \
	else \
		echo "Android SDK: ❌"; \
	fi
	@if command -v xcodebuild >/dev/null 2>&1; then \
		echo "Xcode: ✅ ($(shell xcodebuild -version | head -1))"; \
	else \
		echo "Xcode: ❌"; \
	fi

# Project status
status:
	@echo "📊 Project Status:"
	@echo "Branch: $(shell git branch --show-current 2>/dev/null || echo 'Not a git repo')"
	@echo "Last commit: $(shell git log -1 --oneline 2>/dev/null || echo 'No commits')"
	@echo "Uncommitted changes: $(shell git status --porcelain 2>/dev/null | wc -l || echo 'Unknown')"
	@echo "Node modules: $(shell ls node_modules 2>/dev/null | wc -l || echo 'Not installed') packages"

# Help for specific platforms
help:android:
	@echo "Android Development Commands:"
	@echo "  make dev:android      - Run on Android device/emulator"
	@echo "  make build:android    - Build Android APK/AAB"
	@echo "  make android:devices  - List connected devices"
	@echo "  make android:logcat   - Show device logs"
	@echo ""
	@echo "Common Issues:"
	@echo "- Metro bundler not running: Start with 'make dev'"
	@echo "- Device not recognized: Check USB debugging"
	@echo "- Build fails: Try 'make clean && make install'"

help:ios:
	@echo "iOS Development Commands:"
	@echo "  make dev:ios          - Run on iOS simulator/device"
	@echo "  make build:ios        - Build iOS archive"
	@echo "  make ios:simulators   - List available simulators"
	@echo "  make ios:logs         - Show simulator logs"
	@echo ""
	@echo "Common Issues:"
	@echo "- CocoaPods issues: Run 'make clean && make install'"
	@echo "- Build fails: Check Xcode settings and signing"
	@echo "- Simulator issues: Reset iOS Simulator"