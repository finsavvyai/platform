# Advanced Browser Features Documentation

This document provides comprehensive documentation for the advanced browser features implemented in UPM.Plus AutomationHub. These features extend the basic browser automation capabilities with enterprise-grade functionality for testing, monitoring, and automation scenarios.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Installation and Setup](#installation-and-setup)
4. [API Reference](#api-reference)
5. [Usage Examples](#usage-examples)
6. [Configuration](#configuration)
7. [Testing](#testing)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Overview

The Advanced Browser Features module provides comprehensive browser automation capabilities beyond basic navigation and interaction. It includes:

- **Browser Extension Management**: Install, configure, and manage browser extensions
- **Network Interception**: Intercept, modify, and control network requests
- **Advanced Media Capture**: High-quality screenshots and screen recordings
- **Session Management**: Comprehensive cookie and session data handling
- **Proxy Support**: HTTP/HTTPS and SOCKS proxy configuration
- **Performance Monitoring**: Real-time performance metrics and analysis
- **Browser Fingerprinting**: Browser identification and privacy protection

## Features

### 1. Browser Extensions Management

**Supported Extension Types:**
- Ad-blockers (Adblock Plus, uBlock Origin)
- Developer tools (Web Developer, React Developer Tools)
- Security extensions (HTTPS Everywhere, Privacy Badger)
- Custom extensions from local files or URLs

**Key Capabilities:**
- Install extensions from CRX files or local directories
- Configure extension permissions and settings
- Enable/disable extensions dynamically
- Validate extension manifests
- Manage extension lifecycle

### 2. Network Interception and Modification

**Modification Types:**
- **Block**: Block specific requests (ads, trackers, analytics)
- **Redirect**: Redirect URLs to different endpoints
- **Modify Headers**: Add, remove, or modify HTTP headers
- **Delay**: Add artificial delays to simulate network conditions
- **Throttle**: Slow down requests for testing
- **Mock**: Return custom responses for specific requests

**Pattern Matching:**
- Wildcard patterns (`*/api/*`)
- Regular expressions (`/https://api\.example\.com.*/`)
- Exact URL matches

### 3. Advanced Screenshots and Recordings

**Screenshot Features:**
- Multiple formats (PNG, JPEG, WebP)
- Full-page and viewport screenshots
- Element clipping and highlighting
- High-resolution capture (2x scaling)
- Custom quality settings
- Automatic file management

**Recording Features:**
- Multiple formats (WebM, MP4, GIF)
- Adjustable frame rates (1-60 FPS)
- Cursor highlighting
- Audio capture support
- Time limits and automatic stopping
- Real-time progress monitoring

### 4. Cookie and Session Management

**Cookie Operations:**
- Get cookies with detailed metadata
- Set cookies with advanced options
- Clear cookies by domain or all
- Export/import session data
- Cross-browser session portability

**Session Data:**
- LocalStorage contents
- SessionStorage contents
- IndexedDB data
- Application state preservation

### 5. Proxy and VPN Support

**Proxy Types:**
- HTTP/HTTPS proxies with authentication
- SOCKS5 proxies
- Proxy bypass rules
- Connection testing and validation

**Use Cases:**
- Geographic location testing
- Network condition simulation
- Security testing
- Load balancing

### 6. Performance Monitoring and Profiling

**Core Web Vitals:**
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- First Input Delay (FID)
- First Contentful Paint (FCP)

**Additional Metrics:**
- Page load times
- Resource loading analysis
- Memory usage tracking
- JavaScript execution timing
- Network performance analysis

**Reporting:**
- Automated performance reports
- Grade calculation (A-F)
- Optimization recommendations
- Historical data analysis

### 7. Browser Fingerprinting and Privacy

**Fingerprinting Data:**
- User agent and platform information
- Screen resolution and color depth
- Available fonts and plugins
- Canvas and WebGL fingerprints
- Storage capabilities

**Privacy Features:**
- Canvas fingerprint blocking
- WebGL fingerprint prevention
- Font detection limitation
- Timezone randomization
- API disabling (notifications, geolocation, etc.)

## Installation and Setup

### Prerequisites

- Python 3.8+
- Playwright browser engines
- Access to browser extension files (if using local extensions)

### Installation

1. **Install the advanced browser features service:**

```python
# The service is part of the main application
from app.services.advanced_browser_features import advanced_browser_features_service
```

2. **Initialize the browser manager:**

```python
from app.services.browser_manager import browser_manager

await browser_manager._initialize_playwright()
```

3. **Set up API endpoints:**

```python
# API endpoints are automatically included in the main application
# Available at /api/v1/browser/advanced/*
```

## API Reference

### Extension Management

#### Install Extension

```http
POST /api/v1/browser/advanced/extensions/install
Content-Type: application/json

{
  "name": "AdBlock Plus",
  "extension_type": "adblocker",
  "source": "https://example.com/adblocker.crx",
  "permissions": ["storage", "webRequest"],
  "enabled": true
}
```

#### List Extensions

```http
GET /api/v1/browser/advanced/extensions
```

#### Uninstall Extension

```http
DELETE /api/v1/browser/advanced/extensions/{extension_id}
```

### Network Interception

#### Add Network Rule

```http
POST /api/v1/browser/advanced/network/rules
Content-Type: application/json

{
  "name": "Block Ads",
  "url_pattern": */ads/*,
  "modification_type": "block",
  "priority": 10,
  "enabled": true
}
```

#### Setup Interception

```http
POST /api/v1/browser/advanced/network/intercept/{page_id}
```

### Screenshots

#### Capture Screenshot

```http
POST /api/v1/browser/advanced/screenshots
Content-Type: application/json

{
  "browser_instance_id": "uuid",
  "context_id": "uuid",
  "page_id": "uuid",
  "config": {
    "format": "png",
    "quality": 90,
    "full_page": true,
    "highlight_elements": ["h1", ".important"]
  },
  "save_to_disk": true
}
```

### Recordings

#### Start Recording

```http
POST /api/v1/browser/advanced/recordings/start
Content-Type: application/json

{
  "browser_instance_id": "uuid",
  "context_id": "uuid",
  "page_id": "uuid",
  "config": {
    "format": "webm",
    "fps": 30,
    "max_duration_seconds": 120,
    "cursor_highlight": true
  }
}
```

#### Stop Recording

```http
POST /api/v1/browser/advanced/recordings/{recording_id}/stop
```

### Cookie Management

#### Manage Cookies

```http
POST /api/v1/browser/advanced/cookies/manage
Content-Type: application/json

{
  "browser_instance_id": "uuid",
  "context_id": "uuid",
  "action": "set",
  "cookies": [
    {
      "name": "session_id",
      "value": "abc123",
      "domain": "example.com",
      "secure": true
    }
  ]
}
```

### Performance Monitoring

#### Collect Metrics

```http
POST /api/v1/browser/advanced/performance/collect/{page_id}
```

#### Generate Report

```http
POST /api/v1/browser/advanced/performance/report/{page_id}
```

### Browser Fingerprinting

#### Generate Fingerprint

```http
POST /api/v1/browser/advanced/fingerprint/generate/{page_id}
```

#### Enable Privacy Mode

```http
POST /api/v1/browser/advanced/privacy/enable/{page_id}
Content-Type: application/json

{
  "disable_canvas": true,
  "disable_webgl": true,
  "limit_fonts": true,
  "disable_notifications": true
}
```

## Usage Examples

### Basic Extension Management

```python
from app.services.advanced_browser_features import (
    advanced_browser_features_service,
    BrowserExtension,
    ExtensionType
)

# Create browser context
config = BrowserConfig(browser_type=BrowserType.CHROMIUM)
instance_id = await browser_manager.create_browser_instance(config)
context_id = await browser_manager.create_context(instance_id)
context = browser_manager.contexts[context_id]

# Install extension
extension = BrowserExtension(
    name="AdBlock Plus",
    extension_type=ExtensionType.ADBLOCKER,
    source="path/to/adblocker.crx"
)

result = await advanced_browser_features_service.install_extension(context, extension)
print(f"Extension installed: {result}")
```

### Network Interception

```python
from app.services.advanced_browser_features import (
    NetworkRule,
    NetworkModificationType
)

# Block ads
ad_block_rule = NetworkRule(
    name="Block Ads",
    url_pattern="*/doubleclick.net/*",
    modification_type=NetworkModificationType.BLOCK,
    priority=10
)

await advanced_browser_features_service.add_network_rule(ad_block_rule)

# Setup interception on page
page = browser_manager.pages[page_id]
await advanced_browser_features_service.setup_network_interception(page)
```

### Advanced Screenshot

```python
from app.services.advanced_browser_features import (
    ScreenshotConfig,
    ScreenshotFormat
)

# High-quality screenshot with highlights
config = ScreenshotConfig(
    format=ScreenshotFormat.PNG,
    quality=100,
    full_page=True,
    scale=2.0,
    highlight_elements=[".main-content", ".cta-button"],
    hide_scrollbars=True
)

result = await advanced_browser_features_service.capture_screenshot(page, config)
print(f"Screenshot saved: {result['file_path']}")
```

### Performance Monitoring

```python
# Start monitoring
await advanced_browser_features_service.start_performance_monitoring(page)

# Navigate to page
await page.goto("https://example.com")

# Collect metrics
metrics = await advanced_browser_features_service.collect_performance_metrics(page)
print(f"Page load time: {metrics.load_time_ms}ms")

# Generate report
report = await advanced_browser_features_service.generate_performance_report(page)
print(f"Performance grade: {report['report']['performance_grade']['grade']}")
```

## Configuration

### Service Configuration

```python
# Configure temporary directories
service = AdvancedBrowserFeaturesService()
service.temp_dir = Path("/custom/temp/path")
service.extensions_dir = Path("/custom/extensions")
service.recordings_dir = Path("/custom/recordings")
```

### Browser Configuration

```python
from app.services.browser_manager import BrowserConfig, DeviceProfile

# Mobile device emulation
config = BrowserConfig(
    browser_type=BrowserType.CHROMIUM,
    device_profile=DeviceProfile(
        name="iPhone 13",
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
        viewport={"width": 390, "height": 844},
        device_scale_factor=3.0
    )
)
```

### Network Rules Configuration

```python
# Comprehensive ad blocking
ad_block_rules = [
    NetworkRule(
        name="Block Google Analytics",
        url_pattern="*/google-analytics.com/*",
        modification_type=NetworkModificationType.BLOCK,
        priority=10
    ),
    NetworkRule(
        name="Block Facebook Pixel",
        url_pattern="*/facebook.com/tr*",
        modification_type=NetworkModificationType.BLOCK,
        priority=10
    ),
    NetworkRule(
        name="Block DoubleClick",
        url_pattern="*/doubleclick.net/*",
        modification_type=NetworkModificationType.BLOCK,
        priority=10
    )
]
```

## Testing

### Running Tests

```bash
# Run all advanced browser feature tests
pytest tests/test_advanced_browser_features.py -v

# Run specific test categories
pytest tests/test_advanced_browser_features.py::TestAdvancedBrowserFeaturesService::test_install_extension -v
pytest tests/test_advanced_browser_features.py::TestAdvancedBrowserIntegration -v
```

### Test Coverage

The test suite covers:
- Extension management (installation, uninstallation, listing)
- Network interception (rules, URL matching, request handling)
- Screenshots and recordings (capture, formats, configurations)
- Cookie and session management (CRUD operations, import/export)
- Proxy configuration (setup, testing)
- Performance monitoring (metrics collection, report generation)
- Browser fingerprinting (generation, privacy mode)
- Integration scenarios (end-to-end workflows)

### Performance Tests

```bash
# Run performance tests
pytest tests/test_advanced_browser_features.py::TestAdvancedBrowserPerformance -v
```

## Best Practices

### 1. Resource Management

```python
# Always cleanup resources
try:
    # Perform browser operations
    result = await advanced_browser_features_service.capture_screenshot(page, config)
finally:
    # Cleanup
    await browser_manager.close_page(page_id)
    await browser_manager.close_context(context_id)
    await browser_manager.close_browser_instance(instance_id)
    await advanced_browser_features_service.cleanup()
```

### 2. Error Handling

```python
try:
    extension_result = await advanced_browser_features_service.install_extension(context, extension)
    if not extension_result["success"]:
        logger.error(f"Extension installation failed: {extension_result['error']}")
        # Handle error appropriately
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    # Cleanup and recover
```

### 3. Performance Optimization

```python
# Reuse browser contexts for multiple operations
context_id = await browser_manager.create_context(instance_id)

# Perform multiple operations
for url in test_urls:
    page_id = await browser_manager.create_page(context_id)
    page = browser_manager.pages[page_id]

    await page.goto(url)
    metrics = await advanced_browser_features_service.collect_performance_metrics(page)

    await browser_manager.close_page(page_id)

# Cleanup context once
await browser_manager.close_context(context_id)
```

### 4. Security Considerations

```python
# Validate extension sources
if not extension.source.startswith(('http://', 'https://', '/')):
    raise ValueError("Invalid extension source")

# Use secure cookie settings
secure_cookie = {
    "name": "session_token",
    "value": token,
    "domain": "example.com",
    "secure": True,
    "http_only": True,
    "same_site": "Strict"
}

# Clean up sensitive data
await advanced_browser_features_service.clear_cookies(context, domain="example.com")
```

## Troubleshooting

### Common Issues

1. **Extension Installation Fails**
   - Verify extension source is accessible
   - Check manifest.json format
   - Ensure extension permissions are valid

2. **Network Interception Not Working**
   - Verify URL patterns match requests
   - Check rule priorities
   - Ensure interception is set up before navigation

3. **Screenshot Capture Fails**
   - Verify page is loaded and ready
   - Check file system permissions
   - Ensure sufficient disk space

4. **Performance Metrics Missing**
   - Ensure performance monitoring is started
   - Check page navigation timing
   - Verify JavaScript execution is enabled

### Debug Logging

```python
import logging

# Enable debug logging
logging.getLogger("app.services.advanced_browser_features").setLevel(logging.DEBUG)

# Monitor service activity
logger.info(f"Active extensions: {len(advanced_browser_features_service.extensions)}")
logger.info(f"Network rules: {len(advanced_browser_features_service.network_rules)}")
logger.info(f"Active recordings: {len(advanced_browser_features_service.active_recordings)}")
```

### Health Checks

```python
# Service health check
status = await advanced_browser_features_service.health_check()
if status["status"] != "healthy":
    logger.warning(f"Service unhealthy: {status}")
```

## Contributing

When contributing to the advanced browser features:

1. **Add Tests**: Ensure new functionality has comprehensive tests
2. **Update Documentation**: Keep API documentation current
3. **Performance Considerations**: Monitor resource usage and performance impact
4. **Error Handling**: Implement proper error handling and logging
5. **Backward Compatibility**: Maintain API compatibility when possible

## License

This module is part of the UPM.Plus AutomationHub project and follows the same license terms.