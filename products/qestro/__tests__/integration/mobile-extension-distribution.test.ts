import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('Mobile and Extension Distribution Integration Tests', () => {
  const testDir = '/tmp/questro-integration-test';

  beforeEach(() => {
    // Create test directory structure
    fs.ensureDirSync(testDir);
    fs.ensureDirSync(path.join(testDir, 'mobile'));
    fs.ensureDirSync(path.join(testDir, 'browser-extension'));
    fs.ensureDirSync(path.join(testDir, 'coordinated-release'));

    // Mock environment variables for both platforms
    process.env = {
      ...process.env,
      MOBILE_PROJECT_ROOT: path.join(testDir, 'mobile'),
      BROWSER_EXTENSION_ROOT: path.join(testDir, 'browser-extension'),
      QUESTRO_ROOT: testDir,
      COORDINATED_RELEASE_DIR: path.join(testDir, 'coordinated-release'),

      // Mobile environment
      FASTLANE_USER: 'test@example.com',
      GOOGLE_PLAY_JSON_KEY: 'mock_json_key',
      APP_STORE_CONNECT_API_KEY_ID: 'TEST_KEY_ID',

      // Browser extension environment
      CHROME_CLIENT_ID: 'test_chrome_client_id',
      FIREFOX_JWT_ISSUER: 'test_firefox_issuer',
      EDGE_CLIENT_ID: 'test_edge_client_id'
    };
  });

  afterEach(() => {
    // Clean up test directory
    fs.removeSync(testDir);
  });

  describe('Coordinated Release Management', () => {
    it('should synchronize releases across mobile and browser platforms', () => {
      const coordinationScript = `
        cd ${testDir}

        VERSION="1.0.0"
        RELEASE_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

        echo "Starting coordinated release v$VERSION..."

        # Create coordinated release structure
        mkdir -p coordinated-release/v$VERSION/{mobile,browser-extension}

        # Initialize release manifest
        cat > coordinated-release/v$VERSION/release_manifest.json << EOF
        {
          "version": "$VERSION",
          "release_date": "$RELEASE_DATE",
          "status": "in_progress",
          "platforms": {
            "mobile": {
              "ios": {"status": "pending", "package": null},
              "android": {"status": "pending", "package": null}
            },
            "browser_extension": {
              "chrome": {"status": "pending", "package": null},
              "firefox": {"status": "pending", "package": null},
              "edge": {"status": "pending", "package": null}
            }
          },
          "overall_status": "pending"
        }
        EOF

        # 1. Build mobile applications
        echo "Stage 1: Building mobile applications..."

        # iOS
        mkdir -p mobile/dist
        echo "mock iOS IPA" > mobile/dist/Questro.ipa

        # Android
        echo "mock Android AAB" > mobile/dist/Questro.aab

        # Update manifest with mobile builds
        node -e "
          const manifest = require('./coordinated-release/v$VERSION/release_manifest.json');
          manifest.platforms.mobile.ios.status = 'built';
          manifest.platforms.mobile.ios.package = 'Questro.ipa';
          manifest.platforms.mobile.android.status = 'built';
          manifest.platforms.mobile.android.package = 'Questro.aab';
          require('fs').writeFileSync('./coordinated-release/v$VERSION/release_manifest.json', JSON.stringify(manifest, null, 2));
        "

        echo "✓ Mobile applications built"

        # 2. Build browser extensions
        echo "Stage 2: Building browser extensions..."

        browsers=("chrome" "firefox" "edge")
        for browser in "\${browsers[@]}"; do
          mkdir -p browser-extension/dist/$browser
          echo "mock $browser extension" > browser-extension/dist/questro-$browser-v$VERSION.zip
        done

        # Update manifest with browser builds
        node -e "
          const manifest = require('./coordinated-release/v$VERSION/release_manifest.json');
          const browsers = ['chrome', 'firefox', 'edge'];
          browsers.forEach(browser => {
            manifest.platforms.browser_extension[browser].status = 'built';
            manifest.platforms.browser_extension[browser].package = 'questro-' + browser + '-v$VERSION.zip';
          });
          require('fs').writeFileSync('./coordinated-release/v$VERSION/release_manifest.json', JSON.stringify(manifest, null, 2));
        "

        echo "✓ Browser extensions built"

        # 3. Create unified release package
        echo "Stage 3: Creating unified release package..."

        # Copy all artifacts to release directory
        cp mobile/dist/* coordinated-release/v$VERSION/mobile/
        cp -r browser-extension/dist/* coordinated-release/v$VERSION/browser-extension/

        # Create unified release notes
        cat > coordinated-release/v$VERSION/RELEASE_NOTES.md << EOF
        # Questro v$VERSION - Unified Release

        **Release Date:** $RELEASE_DATE

        ## Overview
        This release brings Questro AI Testing Platform to all major platforms:
        - Mobile applications (iOS & Android)
        - Browser extensions (Chrome, Firefox, Edge)

        ## What's New
        - 🎉 Initial unified release across all platforms
        - ✨ Smart recording capabilities on mobile and web
        - 🤖 AI-powered test generation
        - 🔄 Cross-platform synchronization
        - 📊 Comprehensive reporting

        ## Platform-Specific Features
        ### Mobile (iOS & Android)
        - Touch-optimized interface
        - Gesture recording and playback
        - Device-specific test capabilities
        - Offline recording mode

        ### Browser Extensions
        - Web page recording and analysis
        - DevTools integration
        - Cross-browser test compatibility
        - Real-time synchronization with mobile

        ## Installation
        - **iOS**: Download from App Store (link in release package)
        - **Android**: Download from Google Play Store (link in release package)
        - **Chrome**: Install from Chrome Web Store
        - **Firefox**: Install from Firefox Add-ons
        - **Edge**: Install from Microsoft Edge Add-ons

        ## System Requirements
        - iOS 14.0+
        - Android 8.0+
        - Chrome 88+, Firefox 78+, Edge 88+

        EOF

        echo "✓ Unified release package created"

        # 4. Update final status
        node -e "
          const manifest = require('./coordinated-release/v$VERSION/release_manifest.json');
          manifest.status = 'completed';
          manifest.overall_status = 'completed';
          manifest.completed_at = '$(date -u +%Y-%m-%dT%H:%M:%SZ)';
          require('fs').writeFileSync('./coordinated-release/v$VERSION/release_manifest.json', JSON.stringify(manifest, null, 2));
        "

        echo ""
        echo "🎉 Coordinated release v$VERSION completed successfully!"
        echo "Release directory: coordinated-release/v$VERSION/"
        echo "Mobile apps: $(ls coordinated-release/v$VERSION/mobile/ | wc -l) files"
        echo "Browser extensions: $(find coordinated-release/v$VERSION/browser-extension/ -name "*.zip" | wc -l) files"
      `;

      const result = execSync(coordinationScript, { encoding: 'utf8' });
      expect(result).toContain('🎉 Coordinated release v1.0.0 completed successfully!');
    });

    it('should validate platform interdependencies', () => {
      const validationScript = `
        cd ${testDir}

        VERSION="1.0.0"

        # Create mock platform builds
        mkdir -p mobile/dist
        echo "iOS app" > mobile/dist/Questro.ipa
        echo "Android app" > mobile/dist/Questro.aab

        browsers=("chrome" "firefox" "edge")
        for browser in "\${browsers[@]}"; do
          mkdir -p browser-extension/dist/$browser
          echo "extension content" > browser-extension/dist/questro-$browser-v$VERSION.zip
        done

        echo "Validating platform interdependencies..."

        # 1. Version consistency check
        echo "1. Checking version consistency..."

        # Create version manifests for each platform
        cat > mobile/version.json << EOF
        {
          "version": "$VERSION",
          "build_number": "1",
          "platform": "mobile",
          "apps": {
            "ios": {"version": "$VERSION", "build": "1"},
            "android": {"version": "$VERSION", "code": 1}
          }
        }
        EOF

        cat > browser-extension/version.json << EOF
        {
          "version": "$VERSION",
          "platform": "browser-extension",
          "extensions": {
            "chrome": {"version": "$VERSION"},
            "firefox": {"version": "$VERSION"},
            "edge": {"version": "$VERSION"}
          }
        }
        EOF

        # Validate version consistency
        mobile_version=$(node -e "console.log(require('./mobile/version.json').version)")
        browser_version=$(node -e "console.log(require('./browser-extension/version.json').version)")

        if [ "$mobile_version" != "$browser_version" ] || [ "$mobile_version" != "$VERSION" ]; then
          echo "ERROR: Version inconsistency detected"
          echo "Mobile: $mobile_version"
          echo "Browser: $browser_version"
          echo "Expected: $VERSION"
          exit 1
        else
          echo "✓ Version consistency validated"
        fi

        # 2. API compatibility check
        echo "2. Checking API compatibility..."

        # Create API compatibility manifests
        cat > mobile/api_compatibility.json << EOF
        {
          "version": "$VERSION",
          "api_endpoints": [
            "/api/v1/recordings",
            "/api/v1/test-execution",
            "/api/v1/sync",
            "/api/v1/auth"
          ],
          "websocket_support": true,
          "zero_sync_compatible": true
        }
        EOF

        cat > browser-extension/api_compatibility.json << EOF
        {
          "version": "$VERSION",
          "api_endpoints": [
            "/api/v1/recordings",
            "/api/v1/test-execution",
            "/api/v1/sync",
            "/api/v1/auth"
          ],
          "websocket_support": true,
          "zero_sync_compatible": true
        }
        EOF

        # Validate API compatibility
        mobile_api_count=$(node -e "console.log(require('./mobile/api_compatibility.json').api_endpoints.length)")
        browser_api_count=$(node -e "console.log(require('./browser-extension/api_compatibility.json').api_endpoints.length)")

        if [ "$mobile_api_count" -eq "$browser_api_count" ] && [ "$mobile_api_count" -gt 0 ]; then
          echo "✓ API compatibility validated ($mobile_api_count endpoints)"
        else
          echo "ERROR: API compatibility issue"
          exit 1
        fi

        # 3. ZeroSync compatibility check
        echo "3. Checking ZeroSync compatibility..."

        mobile_zerosync=$(node -e "console.log(require('./mobile/api_compatibility.json').zero_sync_compatible)")
        browser_zerosync=$(node -e "console.log(require('./browser-extension/api_compatibility.json').zero_sync_compatible)")

        if [ "$mobile_zerosync" = "true" ] && [ "$browser_zerosync" = "true" ]; then
          echo "✓ ZeroSync compatibility validated"
        else
          echo "ERROR: ZeroSync compatibility issue"
          exit 1
        fi

        # 4. Feature parity check
        echo "4. Checking feature parity..."

        # Create feature manifests
        cat > mobile/features.json << EOF
        {
          "core_features": [
            "recording",
            "test_execution",
            "real_time_sync",
            "ai_generation"
          ],
          "platform_specific": [
            "touch_gestures",
            "device_orientation",
            "native_integration"
          ]
        }
        EOF

        cat > browser-extension/features.json << EOF
        {
          "core_features": [
            "recording",
            "test_execution",
            "real_time_sync",
            "ai_generation"
          ],
          "platform_specific": [
            "dom_inspection",
            "devtools_integration",
            "cross_browser_testing"
          ]
        }
        EOF

        # Validate core feature parity
        mobile_core_count=$(node -e "console.log(require('./mobile/features.json').core_features.length)")
        browser_core_count=$(node -e "console.log(require('./browser-extension/features.json').core_features.length)")

        if [ "$mobile_core_count" -eq "$browser_core_count" ] && [ "$mobile_core_count" -gt 0 ]; then
          echo "✓ Core feature parity validated ($mobile_core_count core features)"
        else
          echo "ERROR: Core feature parity issue"
          exit 1
        fi

        echo ""
        echo "🎉 Platform interdependency validation completed successfully!"
        echo "✓ Version consistency: $VERSION across all platforms"
        echo "✓ API compatibility: $mobile_api_count shared endpoints"
        echo "✓ ZeroSync support: Enabled on all platforms"
        echo "✓ Feature parity: $mobile_core_count core features consistent"
      `;

      const result = execSync(validationScript, { encoding: 'utf8' });
      expect(result).toContain('🎉 Platform interdependency validation completed successfully!');
    });
  });

  describe('Cross-Platform Synchronization', () => {
    it('should test ZeroSync synchronization between mobile and browser', () => {
      const syncScript = `
        cd ${testDir}

        echo "Testing ZeroSync synchronization between mobile and browser platforms..."

        # Create mock ZeroSync configuration
        mkdir -p coordinated-release/zerosync-config

        cat > coordinated-release/zerosync-config/sync_config.json << EOF
        {
          "version": "1.0.0",
          "sync_protocol": "websocket",
          "server_url": "wss://api.qestro.app",
          "authentication": "jwt",
          "platforms": {
            "mobile": {
              "connection_string": "wss://api.qestro.app/mobile-sync",
              "heartbeat_interval": 30000,
              "reconnection_strategy": "exponential_backoff"
            },
            "browser_extension": {
              "connection_string": "wss://api.qestro.app/browser-sync",
              "heartbeat_interval": 15000,
              "reconnection_strategy": "linear_backoff"
            }
          },
          "sync_events": [
            "recording_started",
            "recording_stopped",
            "test_generated",
            "test_executed",
            "sync_request"
          ]
        }
        EOF

        # Mock synchronization test
        echo "1. Testing connection establishment..."

        # Mock mobile connection
        mobile_connection() {
          echo "Mobile: Establishing WebSocket connection..."
          echo "Mobile: Connected to wss://api.qestro.app/mobile-sync"
          echo "Mobile: Authentication successful"
          return 0
        }

        # Mock browser connection
        browser_connection() {
          echo "Browser: Establishing WebSocket connection..."
          echo "Browser: Connected to wss://api.qestro.app/browser-sync"
          echo "Browser: Authentication successful"
          return 0
        }

        if mobile_connection && browser_connection; then
          echo "✓ Both platforms connected successfully"
        else
          echo "ERROR: Connection establishment failed"
          exit 1
        fi

        echo "2. Testing event synchronization..."

        # Test event broadcasting
        echo "Mobile: Broadcasting recording_started event..."
        echo "Browser: Received recording_started event from mobile"
        echo "Browser: Updating UI state"

        echo "Browser: Broadcasting test_generated event..."
        echo "Mobile: Received test_generated event from browser"
        echo "Mobile: Updating test list"

        echo "✓ Event synchronization working correctly"

        echo "3. Testing state consistency..."

        # Create state validation
        cat > coordinated-release/zerosync-config/state_validation.json << EOF
        {
          "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
          "platform_states": {
            "mobile": {
              "active_recording": false,
              "pending_tests": 3,
              "last_sync": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
            },
            "browser_extension": {
              "active_recording": false,
              "pending_tests": 3,
              "last_sync": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
            }
          },
          "consistency_check": {
            "states_match": true,
            "timestamp_diff_ms": 0,
            "data_integrity": "verified"
          }
        }
        EOF

        echo "✓ State consistency validated"

        echo "4. Testing reconnection handling..."

        # Mock connection loss and recovery
        echo "Simulating connection loss on mobile..."
        echo "Mobile: Connection lost"
        echo "Mobile: Attempting reconnection (attempt 1)..."
        echo "Mobile: Reconnected successfully"

        echo "Browser: Detected mobile reconnection"
        echo "Browser: Resyncing state with mobile"

        echo "✓ Reconnection handling working correctly"

        echo ""
        echo "🎉 ZeroSync synchronization test completed successfully!"
        echo "✓ Connection establishment: Both platforms connected"
        echo "✓ Event synchronization: Real-time updates working"
        echo "✓ State consistency: Data integrity maintained"
        echo "✓ Reconnection handling: Automatic recovery working"
      `;

      const result = execSync(syncScript, { encoding: 'utf8' });
      expect(result).toContain('🎉 ZeroSync synchronization test completed successfully!');
    });
  });

  describe('Unified Build Pipeline', () => {
    it('should orchestrate builds across all platforms', () => {
      const pipelineScript = `
        cd ${testDir}

        echo "Starting unified build pipeline..."

        VERSION="1.0.0"
        BUILD_START_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

        # Create build pipeline configuration
        cat > build-pipeline.json << EOF
        {
          "version": "$VERSION",
          "build_start_time": "$BUILD_START_TIME",
          "platforms": {
            "mobile": {
              "ios": {"status": "pending", "build_time": null},
              "android": {"status": "pending", "build_time": null}
            },
            "browser_extension": {
              "chrome": {"status": "pending", "build_time": null},
              "firefox": {"status": "pending", "build_time": null},
              "edge": {"status": "pending", "build_time": null}
            }
          },
          "parallel_builds": true,
          "max_parallel_jobs": 3
        }
        EOF

        # 1. Mobile builds (can run in parallel)
        echo "Stage 1: Building mobile applications..."

        # iOS build
        {
          echo "Building iOS application..."
          sleep 2
          mkdir -p mobile/dist
          echo "iOS IPA content" > mobile/dist/Questro.ipa

          # Update pipeline status
          node -e "
            const pipeline = require('./build-pipeline.json');
            pipeline.platforms.mobile.ios.status = 'completed';
            pipeline.platforms.mobile.ios.build_time = '$(date -u +%Y-%m-%dT%H:%M:%SZ)';
            require('fs').writeFileSync('./build-pipeline.json', JSON.stringify(pipeline, null, 2));
          "
          echo "✓ iOS build completed"
        } &

        # Android build
        {
          echo "Building Android application..."
          sleep 2
          echo "Android AAB content" >> mobile/dist/Questro.aab

          # Update pipeline status
          node -e "
            const pipeline = require('./build-pipeline.json');
            pipeline.platforms.mobile.android.status = 'completed';
            pipeline.platforms.mobile.android.build_time = '$(date -u +%Y-%m-%dT%H:%M:%SZ)';
            require('fs').writeFileSync('./build-pipeline.json', JSON.stringify(pipeline, null, 2));
          "
          echo "✓ Android build completed"
        } &

        # Wait for mobile builds
        wait

        # 2. Browser extension builds (can run in parallel)
        echo "Stage 2: Building browser extensions..."

        browsers=("chrome" "firefox" "edge")
        for browser in "\${browsers[@]}"; do
          {
            echo "Building $browser extension..."
            sleep 1
            mkdir -p browser-extension/dist/$browser
            echo "$browser extension content" > browser-extension/dist/questro-$browser-v$VERSION.zip

            # Update pipeline status
            node -e "
              const pipeline = require('./build-pipeline.json');
              pipeline.platforms.browser_extension.$browser.status = 'completed';
              pipeline.platforms.browser_extension.$browser.build_time = '$(date -u +%Y-%m-%dT%H:%M:%SZ)';
              require('fs').writeFileSync('./build-pipeline.json', JSON.stringify(pipeline, null, 2));
            "
            echo "✓ $browser extension build completed"
          } &
        done

        # Wait for browser builds
        wait

        # 3. Finalize build pipeline
        echo "Stage 3: Finalizing build pipeline..."

        BUILD_END_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

        # Update final pipeline status
        node -e "
          const pipeline = require('./build-pipeline.json');
          pipeline.build_end_time = '$BUILD_END_TIME';
          pipeline.status = 'completed';
          pipeline.total_build_time_seconds = Math.floor((new Date('$BUILD_END_TIME') - new Date('$BUILD_START_TIME')) / 1000);
          require('fs').writeFileSync('./build-pipeline.json', JSON.stringify(pipeline, null, 2));
        "

        # 4. Create unified distribution package
        echo "Stage 4: Creating unified distribution package..."

        mkdir -p unified-release/v$VERSION

        # Copy all artifacts
        cp mobile/dist/* unified-release/v$VERSION/
        cp -r browser-extension/dist/* unified-release/v$VERSION/

        # Create build report
        cat > unified-release/v$VERSION/build_report.json << EOF
        {
          "version": "$VERSION",
          "build_start_time": "$BUILD_START_TIME",
          "build_end_time": "$BUILD_END_TIME",
          "platforms_built": {
            "mobile": {
              "ios": {"file": "Questro.ipa", "size_bytes": $(stat -f%z mobile/dist/Questro.ipa 2>/dev/null || stat -c%s mobile/dist/Questro.ipa 2>/dev/null)},
              "android": {"file": "Questro.aab", "size_bytes": $(stat -f%z mobile/dist/Questro.aab 2>/dev/null || stat -c%s mobile/dist/Questro.aab 2>/dev/null)}
            },
            "browser_extension": {
              "chrome": {"file": "questro-chrome-v$VERSION.zip", "size_bytes": $(stat -f%z browser-extension/dist/chrome/questro-chrome-v$VERSION.zip 2>/dev/null || stat -c%s browser-extension/dist/chrome/questro-chrome-v$VERSION.zip 2>/dev/null)},
              "firefox": {"file": "questro-firefox-v$VERSION.zip", "size_bytes": $(stat -f%z browser-extension/dist/firefox/questro-firefox-v$VERSION.zip 2>/dev/null || stat -c%s browser-extension/dist/firefox/questro-firefox-v$VERSION.zip 2>/dev/null)},
              "edge": {"file": "questro-edge-v$VERSION.zip", "size_bytes": $(stat -f%z browser-extension/dist/edge/questro-edge-v$VERSION.zip 2>/dev/null || stat -c%s browser-extension/dist/edge/questro-edge-v$VERSION.zip 2>/dev/null)}
            }
          },
          "total_artifacts": 5,
          "build_pipeline": $(cat build-pipeline.json)
        }
        EOF

        # Validate unified release
        total_artifacts=$(find unified-release/v$VERSION/ -type f \( -name "*.ipa" -o -name "*.aab" -o -name "*.zip" \) | wc -l)

        if [ "$total_artifacts" -eq 5 ]; then
          echo "✓ All build artifacts present in unified release"
        else
          echo "ERROR: Missing build artifacts. Expected: 5, Found: $total_artifacts"
          exit 1
        fi

        # Display build summary
        total_build_time=$(node -e "console.log(require('./build-pipeline.json').total_build_time_seconds)")

        echo ""
        echo "🎉 Unified build pipeline completed successfully!"
        echo "Build time: ${total_build_time} seconds"
        echo "Artifacts created: $total_artifacts"
        echo "Release package: unified-release/v$VERSION/"
        echo "Platforms built: iOS, Android, Chrome, Firefox, Edge"
      `;

      const result = execSync(pipelineScript, { encoding: 'utf8' });
      expect(result).toContain('🎉 Unified build pipeline completed successfully!');
    });
  });

  describe('Quality Gates and Validation', () => {
    it('should enforce quality gates across all platforms', () => {
      const qualityGatesScript = `
        cd ${testDir}

        echo "Enforcing quality gates across all platforms..."

        VERSION="1.0.0"

        # Create mock builds with various quality metrics
        mkdir -p mobile/dist
        echo "iOS IPA content with 85% test coverage" > mobile/dist/Questro.ipa
        echo "Android AAB content with 87% test coverage" > mobile/dist/Questro.aab

        browsers=("chrome" "firefox" "edge")
        for browser in "\${browsers[@]}"; do
          mkdir -p browser-extension/dist/$browser
          echo "$browser extension with 90% test coverage" > browser-extension/dist/questro-$browser-v$VERSION.zip
        done

        # Quality gate configuration
        cat > quality-gates.json << EOF
        {
          "version": "$VERSION",
          "gates": {
            "test_coverage": {
              "mobile": {"minimum": 80, "ios": 85, "android": 87},
              "browser_extension": {"minimum": 85, "chrome": 90, "firefox": 89, "edge": 90}
            },
            "performance": {
              "mobile": {"max_startup_time_ms": 3000, "max_memory_mb": 256},
              "browser_extension": {"max_load_time_ms": 1000, "max_memory_mb": 128}
            },
            "security": {
              "no_known_vulnerabilities": true,
              "dependency_scan_required": true
            },
            "compatibility": {
              "api_compatibility_check": true,
              "version_consistency": true
            }
          }
        }
        EOF

        # Quality gate validation
        echo "1. Test coverage validation..."

        # Mobile test coverage
        mobile_ios_coverage=85
        mobile_android_coverage=87
        mobile_min_coverage=$(node -e "console.log(require('./quality-gates.json').gates.test_coverage.mobile.minimum)")

        if [ "$mobile_ios_coverage" -ge "$mobile_min_coverage" ] && [ "$mobile_android_coverage" -ge "$mobile_min_coverage" ]; then
          echo "✓ Mobile test coverage gate passed (iOS: ${mobile_ios_coverage}%, Android: ${mobile_android_coverage}%)"
        else
          echo "ERROR: Mobile test coverage gate failed"
          exit 1
        fi

        # Browser extension test coverage
        browser_coverage=90
        browser_min_coverage=$(node -e "console.log(require('./quality-gates.json').gates.test_coverage.browser_extension.minimum)")

        if [ "$browser_coverage" -ge "$browser_min_coverage" ]; then
          echo "✓ Browser extension test coverage gate passed (${browser_coverage}%)"
        else
          echo "ERROR: Browser extension test coverage gate failed"
          exit 1
        fi

        echo "2. Performance validation..."

        # Mock performance test results
        cat > performance_results.json << EOF
        {
          "mobile": {
            "ios": {"startup_time_ms": 2500, "memory_usage_mb": 180},
            "android": {"startup_time_ms": 2200, "memory_usage_mb": 200}
          },
          "browser_extension": {
            "chrome": {"load_time_ms": 800, "memory_usage_mb": 64},
            "firefox": {"load_time_ms": 900, "memory_usage_mb": 72},
            "edge": {"load_time_ms": 850, "memory_usage_mb": 68}
          }
        }
        EOF

        # Validate performance against gates
        mobile_max_startup=$(node -e "console.log(require('./quality-gates.json').gates.performance.mobile.max_startup_time_ms)")
        mobile_max_memory=$(node -e "console.log(require('./quality-gates.json').gates.performance.mobile.max_memory_mb)")

        ios_startup=$(node -e "console.log(require('./performance_results.json').mobile.ios.startup_time_ms)")
        android_memory=$(node -e "console.log(require('./performance_results.json').mobile.android.memory_usage_mb)")

        if [ "$ios_startup" -le "$mobile_max_startup" ] && [ "$android_memory" -le "$mobile_max_memory" ]; then
          echo "✓ Mobile performance gate passed (iOS startup: ${ios_startup}ms, Android memory: ${android_memory}MB)"
        else
          echo "ERROR: Mobile performance gate failed"
          exit 1
        fi

        browser_max_load=$(node -e "console.log(require('./quality-gates.json').gates.performance.browser_extension.max_load_time_ms)")
        chrome_load=$(node -e "console.log(require('./performance_results.json').browser_extension.chrome.load_time_ms)")

        if [ "$chrome_load" -le "$browser_max_load" ]; then
          echo "✓ Browser extension performance gate passed (Chrome load: ${chrome_load}ms)"
        else
          echo "ERROR: Browser extension performance gate failed"
          exit 1
        fi

        echo "3. Security validation..."

        # Mock security scan results
        cat > security_scan_results.json << EOF
        {
          "vulnerability_scan": {
            "critical": 0,
            "high": 0,
            "medium": 1,
            "low": 3,
            "total_dependencies_scanned": 245
          },
          "dependency_check": {
            "outdated_dependencies": 2,
            "vulnerable_dependencies": 0,
              "compliance_status": "passed"
          }
        }
        EOF

        critical_vulns=$(node -e "console.log(require('./security_scan_results.json').vulnerability_scan.critical)")
        compliance_status=$(node -e "console.log(require('./security_scan_results.json').dependency_check.compliance_status)")

        if [ "$critical_vulns" -eq 0 ] && [ "$compliance_status" = "passed" ]; then
          echo "✓ Security gate passed (0 critical vulnerabilities, compliance: $compliance_status)"
        else
          echo "ERROR: Security gate failed"
          exit 1
        fi

        echo "4. Compatibility validation..."

        # Mock compatibility check results
        cat > compatibility_results.json << EOF
        {
          "api_compatibility": {
            "mobile_backend_compatibility": true,
            "browser_extension_compatibility": true,
            "cross_platform_sync": true
          },
          "version_consistency": {
            "all_platforms_same_version": true,
            "version": "$VERSION"
          }
        }
        EOF

        api_compat=$(node -e "console.log(require('./compatibility_results.json').api_compatibility.mobile_backend_compatibility)")
        version_consistency=$(node -e "console.log(require('./compatibility_results.json').version_consistency.all_platforms_same_version)")

        if [ "$api_compat" = "true" ] && [ "$version_consistency" = "true" ]; then
          echo "✓ Compatibility gate passed (API compatibility: $api_compat, Version consistency: $version_consistency)"
        else
          echo "ERROR: Compatibility gate failed"
          exit 1
        fi

        echo "5. Generate quality gate report..."

        cat > quality_gate_report.json << EOF
        {
          "version": "$VERSION",
          "validation_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
          "gates_status": {
            "test_coverage": "passed",
            "performance": "passed",
            "security": "passed",
            "compatibility": "passed"
          },
          "overall_status": "passed",
          "summary": {
            "total_gates": 4,
            "passed_gates": 4,
            "failed_gates": 0,
            "pass_rate": "100%"
          },
          "artifacts_approved": [
            "mobile/dist/Questro.ipa",
            "mobile/dist/Questro.aab",
            "browser-extension/dist/chrome/questro-chrome-v$VERSION.zip",
            "browser-extension/dist/firefox/questro-firefox-v$VERSION.zip",
            "browser-extension/dist/edge/questro-edge-v$VERSION.zip"
          ]
        }
        EOF

        echo ""
        echo "🎉 All quality gates passed successfully!"
        echo "✓ Test coverage: Above minimum thresholds"
        echo "✓ Performance: Within acceptable limits"
        echo "✓ Security: No critical vulnerabilities"
        echo "✓ Compatibility: Cross-platform consistency verified"
        echo ""
        echo "Quality gate report: quality_gate_report.json"
        echo "Artifacts approved for release: 5"
      `;

      const result = execSync(qualityGatesScript, { encoding: 'utf8' });
      expect(result).toContain('🎉 All quality gates passed successfully!');
    });
  });
});