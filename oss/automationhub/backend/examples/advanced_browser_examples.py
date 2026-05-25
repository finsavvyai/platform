"""
Advanced Browser Features Usage Examples

This file demonstrates how to use all the advanced browser features implemented
in the UPM.Plus AutomationHub system. Each example shows practical usage patterns
and best practices for different automation scenarios.

Examples include:
- Browser extension management
- Network interception and modification
- Advanced screenshot and recording
- Cookie and session management
- Proxy and VPN configuration
- Performance monitoring and profiling
- Browser fingerprinting and privacy features
"""

import asyncio
import json
import logging
import tempfile
from pathlib import Path
from uuid import uuid4

from app.services.advanced_browser_features import (
    advanced_browser_features_service,
    BrowserExtension,
    NetworkRule,
    ScreenshotConfig,
    RecordingConfig,
    ProxyConfig,
    CookieConfig,
    ExtensionType,
    NetworkModificationType,
    ScreenshotFormat,
    RecordingFormat
)
from app.services.browser_manager import (
    browser_manager,
    BrowserType,
    BrowserConfig,
    DeviceProfile,
    ExecutionMode
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AdvancedBrowserExamples:
    """Collection of advanced browser feature examples."""

    def __init__(self):
        self.service = advanced_browser_features_service

    async def example_1_extension_management(self):
        """
        Example 1: Browser Extension Management

        Demonstrates how to install, manage, and uninstall browser extensions
        for enhanced automation capabilities.
        """
        logger.info("=== Example 1: Browser Extension Management ===")

        try:
            # Initialize browser manager
            await browser_manager._initialize_playwright()

            # Create browser instance and context
            config = BrowserConfig(
                browser_type=BrowserType.CHROMIUM,
                execution_mode=ExecutionMode.HEADLESS
            )
            instance_id = await browser_manager.create_browser_instance(config)
            context_id = await browser_manager.create_context(instance_id)
            context = browser_manager.contexts[context_id]

            # Example 1a: Install ad-blocker extension
            logger.info("Installing ad-blocker extension...")
            adblocker = BrowserExtension(
                name="AdBlock Plus",
                extension_type=ExtensionType.ADBLOCKER,
                source="https://example.com/adblocker.crx",  # Mock URL
                permissions=["storage", "webRequest"]
            )

            # For demo purposes, we'll simulate a local extension
            with tempfile.TemporaryDirectory() as temp_dir:
                manifest_path = Path(temp_dir) / "manifest.json"
                manifest_data = {
                    "name": "AdBlock Plus",
                    "version": "3.10",
                    "manifest_version": 2,
                    "permissions": ["storage", "webRequest", "<all_urls>"],
                    "background": {"scripts": ["background.js"]}
                }
                with open(manifest_path, 'w') as f:
                    json.dump(manifest_data, f)

                adblocker.source = str(temp_dir)
                install_result = await self.service.install_extension(context, adblocker)
                logger.info(f"Extension install result: {install_result}")

            # Example 1b: Install developer tools extension
            logger.info("Installing developer tools extension...")
            dev_tools = BrowserExtension(
                name="Web Developer",
                extension_type=ExtensionType.DEVELOPER_TOOLS,
                source="https://example.com/webdev.crx"  # Mock URL
            )

            # Example 1c: List installed extensions
            extensions = self.service.get_installed_extensions()
            logger.info(f"Installed extensions: {json.dumps(extensions, indent=2)}")

            # Example 1d: Uninstall extension
            if install_result["success"]:
                extension_id = install_result["extension_id"]
                uninstall_result = await self.service.uninstall_extension(
                    context, uuid4()  # Using a fake UUID for demo
                )
                logger.info(f"Extension uninstall result: {uninstall_result}")

            # Cleanup
            await browser_manager.close_context(context_id)
            await browser_manager.close_browser_instance(instance_id)

        except Exception as e:
            logger.error(f"Extension management example failed: {e}")

    async def example_2_network_interception(self):
        """
        Example 2: Network Interception and Modification

        Demonstrates how to intercept, modify, and control network requests
        for testing and automation scenarios.
        """
        logger.info("=== Example 2: Network Interception and Modification ===")

        try:
            # Initialize browser and create page
            await browser_manager._initialize_playwright()
            config = BrowserConfig(browser_type=BrowserType.CHROMIUM)
            instance_id = await browser_manager.create_browser_instance(config)
            context_id = await browser_manager.create_context(instance_id)
            page_id = await browser_manager.create_page(context_id)
            page = browser_manager.pages[page_id]

            # Example 2a: Block ads and trackers
            logger.info("Setting up ad blocking rules...")
            ad_block_rules = [
                NetworkRule(
                    name="Block Google Analytics",
                    url_pattern="*/google-analytics.com/*",
                    modification_type=NetworkModificationType.BLOCK,
                    priority=10
                ),
                NetworkRule(
                    name="Block DoubleClick",
                    url_pattern="*/doubleclick.net/*",
                    modification_type=NetworkModificationType.BLOCK,
                    priority=10
                ),
                NetworkRule(
                    name="Block Facebook Pixel",
                    url_pattern="*/facebook.com/tr*",
                    modification_type=NetworkModificationType.BLOCK,
                    priority=10
                )
            ]

            for rule in ad_block_rules:
                result = await self.service.add_network_rule(rule)
                logger.info(f"Added rule '{rule.name}': {result}")

            # Example 2b: Modify request headers
            logger.info("Setting up header modification...")
            header_rule = NetworkRule(
                name="Add Custom Headers",
                url_pattern="https://api.example.com/*",
                modification_type=NetworkModificationType.MODIFY_HEADERS,
                action={
                    "headers": {
                        "X-Custom-Header": "Automation-Test",
                        "Authorization": "Bearer test-token"
                    }
                },
                priority=5
            )
            header_result = await self.service.add_network_rule(header_rule)
            logger.info(f"Header modification result: {header_result}")

            # Example 2c: Redirect specific URLs
            logger.info("Setting up URL redirection...")
            redirect_rule = NetworkRule(
                name="Redirect to Test Environment",
                url_pattern="https://production.example.com/*",
                modification_type=NetworkModificationType.REDIRECT,
                action={"url": "https://staging.example.com/"},
                priority=15
            )
            redirect_result = await self.service.add_network_rule(redirect_rule)
            logger.info(f"Redirect rule result: {redirect_result}")

            # Example 2d: Add delays for testing
            logger.info("Setting up request delays...")
            delay_rule = NetworkRule(
                name="Simulate Slow Network",
                url_pattern="*/api/slow-endpoint",
                modification_type=NetworkModificationType.DELAY,
                action={"delay_ms": 2000},
                priority=1
            )
            delay_result = await self.service.add_network_rule(delay_rule)
            logger.info(f"Delay rule result: {delay_result}")

            # Example 2e: Setup network interception on page
            logger.info("Setting up network interception...")
            interception_result = await self.service.setup_network_interception(page)
            logger.info(f"Network interception: {interception_result}")

            # Example 2f: List all network rules
            rules = self.service.get_network_rules()
            logger.info(f"Active network rules: {json.dumps(rules, indent=2)}")

            # Cleanup
            await browser_manager.close_page(page_id)
            await browser_manager.close_context(context_id)
            await browser_manager.close_browser_instance(instance_id)

        except Exception as e:
            logger.error(f"Network interception example failed: {e}")

    async def example_3_screenshots_and_recordings(self):
        """
        Example 3: Advanced Screenshots and Recordings

        Demonstrates advanced screenshot capabilities and screen recording
        for documentation and debugging purposes.
        """
        logger.info("=== Example 3: Advanced Screenshots and Recordings ===")

        try:
            # Initialize browser and create page
            await browser_manager._initialize_playwright()
            config = BrowserConfig(browser_type=BrowserType.CHROMIUM)
            instance_id = await browser_manager.create_browser_instance(config)
            context_id = await browser_manager.create_context(instance_id)
            page_id = await browser_manager.create_page(context_id)
            page = browser_manager.pages[page_id]

            # Navigate to a test page (mock)
            await page.goto("https://example.com", wait_until="networkidle")

            # Example 3a: Basic full-page screenshot
            logger.info("Taking full-page screenshot...")
            basic_config = ScreenshotConfig(
                format=ScreenshotFormat.PNG,
                full_page=True,
                quality=100
            )
            basic_result = await self.service.capture_screenshot(page, basic_config)
            logger.info(f"Full-page screenshot: {basic_result['screenshot_id']}")

            # Example 3b: Element screenshot with highlights
            logger.info("Taking element screenshot with highlights...")
            element_config = ScreenshotConfig(
                format=ScreenshotFormat.JPEG,
                quality=90,
                clip={"x": 100, "y": 100, "width": 800, "height": 600},
                highlight_elements=["h1", ".important-element"],
                hide_scrollbars=True
            )
            element_result = await self.service.capture_screenshot(page, element_config)
            logger.info(f"Element screenshot: {element_result['screenshot_id']}")

            # Example 3c: High-quality screenshot for documentation
            logger.info("Taking high-quality documentation screenshot...")
            doc_config = ScreenshotConfig(
                format=ScreenshotFormat.PNG,
                quality=100,
                scale=2.0,  # 2x resolution
                full_page=True
            )
            doc_result = await self.service.capture_screenshot(page, doc_config)
            logger.info(f"Documentation screenshot: {doc_result['screenshot_id']}")

            # Example 3d: Start screen recording
            logger.info("Starting screen recording...")
            recording_config = RecordingConfig(
                format=RecordingFormat.WEBM,
                quality=90,
                fps=30,
                max_duration_seconds=60,
                cursor_highlight=True,
                audio_enabled=False
            )
            recording_start = await self.service.start_recording(page, recording_config)
            logger.info(f"Recording started: {recording_start['recording_id']}")

            # Simulate some page interactions
            await asyncio.sleep(2)

            # Example 3e: Stop recording
            recording_stop = await self.service.stop_recording(recording_start['recording_id'])
            logger.info(f"Recording stopped: {recording_stop}")

            # Example 3f: List active recordings
            active_recordings = self.service.get_active_recordings()
            logger.info(f"Active recordings: {json.dumps(active_recordings, indent=2)}")

            # Cleanup
            await browser_manager.close_page(page_id)
            await browser_manager.close_context(context_id)
            await browser_manager.close_browser_instance(instance_id)

        except Exception as e:
            logger.error(f"Screenshots and recordings example failed: {e}")

    async def example_4_cookie_and_session_management(self):
        """
        Example 4: Cookie and Session Management

        Demonstrates advanced cookie management and session handling
        for authentication and state management scenarios.
        """
        logger.info("=== Example 4: Cookie and Session Management ===")

        try:
            # Initialize browser and create context
            await browser_manager._initialize_playwright()
            config = BrowserConfig(browser_type=BrowserType.CHROMIUM)
            instance_id = await browser_manager.create_browser_instance(config)
            context_id = await browser_manager.create_context(instance_id)
            context = browser_manager.contexts[context_id]

            # Example 4a: Set authentication cookies
            logger.info("Setting authentication cookies...")
            auth_cookies = [
                {
                    "name": "session_id",
                    "value": "abc123def456",
                    "domain": "example.com",
                    "path": "/",
                    "secure": True,
                    "http_only": True,
                    "same_site": "Strict"
                },
                {
                    "name": "user_token",
                    "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "domain": "example.com",
                    "path": "/api",
                    "secure": True,
                    "http_only": True
                },
                {
                    "name": "preferences",
                    "value": json.dumps({"theme": "dark", "lang": "en"}),
                    "domain": "example.com",
                    "path": "/",
                    "secure": False
                }
            ]

            set_result = await self.service.set_cookies(context, auth_cookies)
            logger.info(f"Cookies set result: {set_result}")

            # Example 4b: Get cookies for specific domain
            logger.info("Getting cookies for domain...")
            cookies = await self.service.get_cookies(context, ["https://example.com"])
            logger.info(f"Retrieved cookies: {json.dumps(cookies, indent=2)}")

            # Example 4c: Export session data
            logger.info("Exporting session data...")
            export_result = await self.service.export_session(context)
            logger.info(f"Session export result: {export_result}")

            # Example 4d: Clear cookies for specific domain
            logger.info("Clearing cookies for specific domain...")
            clear_result = await self.service.clear_cookies(context, domain="example.com")
            logger.info(f"Cookies cleared result: {clear_result}")

            # Example 4e: Import session data (in a real scenario)
            if export_result["success"]:
                logger.info("Importing session data...")
                import_result = await self.service.import_session(
                    context,
                    export_result["file_path"]
                )
                logger.info(f"Session import result: {import_result}")

            # Cleanup
            await browser_manager.close_context(context_id)
            await browser_manager.close_browser_instance(instance_id)

        except Exception as e:
            logger.error(f"Cookie and session management example failed: {e}")

    async def example_5_proxy_and_automation(self):
        """
        Example 5: Proxy and VPN Automation

        Demonstrates proxy configuration and testing for different
        geographic locations and network conditions.
        """
        logger.info("=== Example 5: Proxy and VPN Automation ===")

        try:
            # Initialize browser and create context
            await browser_manager._initialize_playwright()
            config = BrowserConfig(browser_type=BrowserType.CHROMIUM)
            instance_id = await browser_manager.create_browser_instance(config)
            context_id = await browser_manager.create_context(instance_id)
            page_id = await browser_manager.create_page(context_id)
            context = browser_manager.contexts[context_id]
            page = browser_manager.pages[page_id]

            # Example 5a: Setup HTTP proxy
            logger.info("Setting up HTTP proxy...")
            http_proxy = ProxyConfig(
                server="http://proxy.example.com:8080",
                username="proxy_user",
                password="proxy_pass",
                bypass=["localhost", "127.0.0.1"]
            )
            proxy_result = await self.service.setup_proxy(context, http_proxy)
            logger.info(f"HTTP proxy setup result: {proxy_result}")

            # Example 5b: Setup SOCKS proxy
            logger.info("Setting up SOCKS proxy...")
            socks_proxy = ProxyConfig(
                server="socks5://socks.example.com:1080",
                socks_version=5
            )
            socks_result = await self.service.setup_proxy(context, socks_proxy)
            logger.info(f"SOCKS proxy setup result: {socks_result}")

            # Example 5c: Test proxy connection
            logger.info("Testing proxy connection...")
            proxy_test = await self.service.test_proxy_connection(
                page,
                "https://httpbin.org/ip"
            )
            logger.info(f"Proxy test result: {proxy_test}")

            # Example 5d: Test different geographic locations
            # (In a real scenario, you would have proxies in different locations)
            geo_proxies = [
                {"server": "http://us-proxy.example.com:8080", "location": "US"},
                {"server": "http://eu-proxy.example.com:8080", "location": "EU"},
                {"server": "http://asia-proxy.example.com:8080", "location": "Asia"}
            ]

            for proxy_config in geo_proxies:
                logger.info(f"Testing {proxy_config['location']} proxy...")
                proxy = ProxyConfig(server=proxy_config["server"])
                await self.service.setup_proxy(context, proxy)

                test_result = await self.service.test_proxy_connection(page)
                logger.info(f"{proxy_config['location']} proxy IP: {test_result.get('ip_address', 'Unknown')}")

            # Cleanup
            await browser_manager.close_page(page_id)
            await browser_manager.close_context(context_id)
            await browser_manager.close_browser_instance(instance_id)

        except Exception as e:
            logger.error(f"Proxy and automation example failed: {e}")

    async def example_6_performance_monitoring(self):
        """
        Example 6: Advanced Performance Monitoring

        Demonstrates comprehensive performance monitoring and analysis
        for web application optimization.
        """
        logger.info("=== Example 6: Advanced Performance Monitoring ===")

        try:
            # Initialize browser and create page
            await browser_manager._initialize_playwright()
            config = BrowserConfig(browser_type=BrowserType.CHROMIUM)
            instance_id = await browser_manager.create_browser_instance(config)
            context_id = await browser_manager.create_context(instance_id)
            page_id = await browser_manager.create_page(context_id)
            page = browser_manager.pages[page_id]

            # Example 6a: Start performance monitoring
            logger.info("Starting performance monitoring...")
            monitoring_start = await self.service.start_performance_monitoring(page)
            logger.info(f"Performance monitoring started: {monitoring_start}")

            # Navigate to test pages (mock)
            test_urls = [
                "https://example.com",
                "https://example.com/about",
                "https://example.com/products"
            ]

            performance_results = []

            for url in test_urls:
                logger.info(f"Analyzing performance for: {url}")

                # Navigate to page
                await page.goto(url, wait_until="networkidle")

                # Wait for page to fully load
                await asyncio.sleep(2)

                # Collect performance metrics
                metrics = await self.service.collect_performance_metrics(page, url)
                performance_results.append(metrics)

                logger.info(f"Load time: {metrics.load_time_ms}ms")
                logger.info(f"DOM Content Loaded: {metrics.domContentLoaded_ms}ms")
                logger.info(f"First Contentful Paint: {metrics.first_contentful_paint_ms}ms")
                logger.info(f"Largest Contentful Paint: {metrics.largest_contentful_paint_ms}ms")
                logger.info(f"Memory Usage: {metrics.memory_usage_mb}MB")

            # Example 6b: Generate comprehensive performance report
            logger.info("Generating performance report...")
            report_result = await self.service.generate_performance_report(page)
            if report_result["success"]:
                report = report_result["report"]

                logger.info("=== Performance Report ===")
                logger.info(f"URL: {report['url']}")
                logger.info(f"Grade: {report['performance_grade']['grade']} ({report['performance_grade']['score']}/100)")

                # Core Web Vitals
                cwv = report["core_web_vitals"]
                logger.info("Core Web Vitals:")
                logger.info(f"  LCP: {cwv['largest_contentful_paint']['value_ms']}ms ({cwv['largest_contentful_paint']['rating']})")
                logger.info(f"  CLS: {cwv['cumulative_layout_shift']['value']} ({cwv['cumulative_layout_shift']['rating']})")
                logger.info(f"  FID: {cwv['first_input_delay']['value_ms']}ms ({cwv['first_input_delay']['rating']})")

                # Recommendations
                if report["recommendations"]:
                    logger.info("Recommendations:")
                    for rec in report["recommendations"]:
                        logger.info(f"  - {rec}")

            # Example 6c: Get historical performance data
            logger.info("Retrieving historical performance data...")
            historical_metrics = self.service.get_performance_metrics(limit=10)
            logger.info(f"Historical metrics count: {len(historical_metrics)}")

            # Example 6d: Performance comparison
            if len(performance_results) > 1:
                logger.info("=== Performance Comparison ===")
                for i, metrics in enumerate(performance_results):
                    logger.info(f"Page {i+1} ({metrics.url}):")
                    logger.info(f"  Load Time: {metrics.load_time_ms}ms")
                    logger.info(f"  Memory: {metrics.memory_usage_mb}MB")

            # Cleanup
            await browser_manager.close_page(page_id)
            await browser_manager.close_context(context_id)
            await browser_manager.close_browser_instance(instance_id)

        except Exception as e:
            logger.error(f"Performance monitoring example failed: {e}")

    async def example_7_browser_fingerprinting(self):
        """
        Example 7: Browser Fingerprinting and Privacy

        Demonstrates browser fingerprinting techniques and privacy
        protection features for anti-detection scenarios.
        """
        logger.info("=== Example 7: Browser Fingerprinting and Privacy ===")

        try:
            # Initialize browser and create page
            await browser_manager._initialize_playwright()
            config = BrowserConfig(browser_type=BrowserType.CHROMIUM)
            instance_id = await browser_manager.create_browser_instance(config)
            context_id = await browser_manager.create_context(instance_id)
            page_id = await browser_manager.create_page(context_id)
            page = browser_manager.pages[page_id]

            # Example 7a: Generate browser fingerprint
            logger.info("Generating browser fingerprint...")
            fingerprint = await self.service.generate_browser_fingerprint(page)

            logger.info("=== Browser Fingerprint ===")
            logger.info(f"User Agent: {fingerprint.user_agent}")
            logger.info(f"Screen Resolution: {fingerprint.screen_resolution}")
            logger.info(f"Platform: {fingerprint.platform}")
            logger.info(f"Language: {fingerprint.language}")
            logger.info(f"Timezone: {fingerprint.timezone}")
            logger.info(f"Color Depth: {fingerprint.color_depth}")
            logger.info(f"Fonts Count: {len(fingerprint.fonts)}")
            logger.info(f"Plugins Count: {len(fingerprint.plugins)}")
            logger.info(f"Canvas Hash: {fingerprint.canvas_hash[:50] if fingerprint.canvas_hash else 'None'}...")
            logger.info(f"WebGL Hash: {fingerprint.webgl_hash[:50] if fingerprint.webgl_hash else 'None'}...")

            # Example 7b: Enable privacy mode
            logger.info("Enabling privacy mode...")
            privacy_options = {
                "disable_canvas": True,
                "disable_webgl": True,
                "limit_fonts": True,
                "randomize_timezone": False,
                "disable_notifications": True,
                "disable_geolocation": True,
                "disable_battery_api": True,
                "disable_device_memory": True
            }
            privacy_result = await self.service.enable_privacy_mode(page, privacy_options)
            logger.info(f"Privacy mode result: {privacy_result}")

            # Example 7c: Generate fingerprint after privacy mode
            logger.info("Generating fingerprint after enabling privacy mode...")
            # Mock the privacy-altered fingerprint
            page.evaluate = AsyncMock(return_value={
                "user_agent": "Mozilla/5.0 (Privacy Browser)",
                "platform": "Linux x86_64",
                "language": "en-US",
                "timezone": "UTC",
                "screen": {"width": 1920, "height": 1080, "color_depth": 24},
                "cookie_enabled": True,
                "local_storage_enabled": True,
                "session_storage_enabled": True,
                "indexed_db_enabled": True,
                "open_database_enabled": False,
                "fonts": ["Arial"],  # Limited fonts
                "plugins": [],  # No plugins
                "canvas_hash": None,  # Canvas disabled
                "webgl_hash": None  # WebGL disabled
            })

            privacy_fingerprint = await self.service.generate_browser_fingerprint(page)

            logger.info("=== Privacy Mode Fingerprint ===")
            logger.info(f"User Agent: {privacy_fingerprint.user_agent}")
            logger.info(f"Canvas Hash: {privacy_fingerprint.canvas_hash}")
            logger.info(f"WebGL Hash: {privacy_fingerprint.webgl_hash}")
            logger.info(f"Fonts Count: {len(privacy_fingerprint.fonts)}")
            logger.info(f"Plugins Count: {len(privacy_fingerprint.plugins)}")

            # Example 7d: Compare fingerprints
            logger.info("=== Fingerprint Comparison ===")
            logger.info(f"Original fonts: {len(fingerprint.fonts)}")
            logger.info(f"Privacy fonts: {len(privacy_fingerprint.fonts)}")
            logger.info(f"Original plugins: {len(fingerprint.plugins)}")
            logger.info(f"Privacy plugins: {len(privacy_fingerprint.plugins)}")
            logger.info(f"Canvas fingerprint changed: {fingerprint.canvas_hash != privacy_fingerprint.canvas_hash}")

            # Example 7e: Get all collected fingerprints
            fingerprints = self.service.get_browser_fingerprints()
            logger.info(f"Total fingerprints collected: {len(fingerprints)}")

            # Cleanup
            await browser_manager.close_page(page_id)
            await browser_manager.close_context(context_id)
            await browser_manager.close_browser_instance(instance_id)

        except Exception as e:
            logger.error(f"Browser fingerprinting example failed: {e}")

    async def example_8_comprehensive_automation_scenario(self):
        """
        Example 8: Comprehensive Automation Scenario

        Demonstrates a complete automation workflow that combines
        multiple advanced browser features for a real-world scenario.
        """
        logger.info("=== Example 8: Comprehensive Automation Scenario ===")

        try:
            # Scenario: Automated e-commerce testing with advanced features
            logger.info("Starting comprehensive e-commerce testing scenario...")

            # Initialize browser with mobile device emulation
            await browser_manager._initialize_playwright()
            device_profile = browser_manager.get_device_profiles().get("iphone_13")
            config = BrowserConfig(
                browser_type=BrowserType.CHROMIUM,
                device_profile=device_profile,
                execution_mode=ExecutionMode.HEADLESS
            )
            instance_id = await browser_manager.create_browser_instance(config)
            context_id = await browser_manager.create_context(instance_id)
            page_id = await browser_manager.create_page(context_id)
            page = browser_manager.pages[page_id]

            # Step 1: Setup network monitoring and ad blocking
            logger.info("Step 1: Setting up network monitoring...")

            # Block ads and trackers
            ad_block_rule = NetworkRule(
                name="Block E-commerce Trackers",
                url_pattern="*/analytics*",
                modification_type=NetworkModificationType.BLOCK,
                priority=10
            )
            await self.service.add_network_rule(ad_block_rule)
            await self.service.setup_network_interception(page)

            # Step 2: Start performance monitoring
            logger.info("Step 2: Starting performance monitoring...")
            await self.service.start_performance_monitoring(page)

            # Step 3: Generate baseline fingerprint
            logger.info("Step 3: Generating baseline fingerprint...")
            baseline_fingerprint = await self.service.generate_browser_fingerprint(page)

            # Step 4: Navigate to e-commerce site
            logger.info("Step 4: Navigating to e-commerce site...")
            await page.goto("https://example-shop.com", wait_until="networkidle")

            # Step 5: Take initial screenshot
            logger.info("Step 5: Taking initial screenshot...")
            screenshot_config = ScreenshotConfig(
                format=ScreenshotFormat.PNG,
                full_page=True,
                quality=100
            )
            initial_screenshot = await self.service.capture_screenshot(page, screenshot_config)
            logger.info(f"Initial screenshot: {initial_screenshot['screenshot_id']}")

            # Step 6: Start recording user interaction
            logger.info("Step 6: Starting screen recording...")
            recording_config = RecordingConfig(
                format=RecordingFormat.WEBM,
                fps=30,
                max_duration_seconds=120,
                cursor_highlight=True
            )
            recording = await self.service.start_recording(page, recording_config)

            # Step 7: Simulate user journey
            logger.info("Step 7: Simulating user journey...")

            # Mock user interactions (in real scenario, you'd use actual page interactions)
            await asyncio.sleep(2)  # Simulate page reading time

            # Mock adding items to cart
            await asyncio.sleep(1)

            # Mock checkout process
            await asyncio.sleep(3)

            # Step 8: Collect performance metrics
            logger.info("Step 8: Collecting performance metrics...")
            metrics = await self.service.collect_performance_metrics(page)
            logger.info(f"Page load time: {metrics.load_time_ms}ms")
            logger.info(f"Memory usage: {metrics.memory_usage_mb}MB")

            # Step 9: Take final screenshot
            logger.info("Step 9: Taking final screenshot...")
            final_screenshot = await self.service.capture_screenshot(page, screenshot_config)
            logger.info(f"Final screenshot: {final_screenshot['screenshot_id']}")

            # Step 10: Stop recording
            logger.info("Step 10: Stopping screen recording...")
            recording_result = await self.service.stop_recording(recording['recording_id'])
            logger.info(f"Recording completed: {recording_result['duration_seconds']}s")

            # Step 11: Generate performance report
            logger.info("Step 11: Generating performance report...")
            report_result = await self.service.generate_performance_report(page)

            if report_result["success"]:
                report = report_result["report"]
                logger.info(f"Performance grade: {report['performance_grade']['grade']}")
                logger.info(f"Recommendations: {len(report['recommendations'])}")

            # Step 12: Export session data
            logger.info("Step 12: Exporting session data...")
            session_export = await self.service.export_session(
                browser_manager.contexts[context_id]
            )
            logger.info(f"Session exported: {session_export['success']}")

            # Step 13: Summary
            logger.info("=== Test Execution Summary ===")
            logger.info(f"Browser: Mobile (iPhone 13)")
            logger.info(f"Pages loaded: 1")
            logger.info(f"Screenshots taken: 2")
            logger.info(f"Recording duration: {recording_result['duration_seconds']}s")
            logger.info(f"Performance grade: {report_result['report']['performance_grade']['grade'] if report_result['success'] else 'N/A'}")
            logger.info(f"Network rules applied: {len(self.service.network_rules)}")

            # Cleanup
            await browser_manager.close_page(page_id)
            await browser_manager.close_context(context_id)
            await browser_manager.close_browser_instance(instance_id)

            logger.info("Comprehensive automation scenario completed successfully!")

        except Exception as e:
            logger.error(f"Comprehensive automation scenario failed: {e}")


async def run_all_examples():
    """Run all advanced browser feature examples."""
    examples = AdvancedBrowserExamples()

    print("🚀 Starting Advanced Browser Features Examples")
    print("=" * 60)

    # List of all examples to run
    example_methods = [
        examples.example_1_extension_management,
        examples.example_2_network_interception,
        examples.example_3_screenshots_and_recordings,
        examples.example_4_cookie_and_session_management,
        examples.example_5_proxy_and_automation,
        examples.example_6_performance_monitoring,
        examples.example_7_browser_fingerprinting,
        examples.example_8_comprehensive_automation_scenario
    ]

    # Run each example
    for i, example_method in enumerate(example_methods, 1):
        try:
            print(f"\n📋 Running Example {i}: {example_method.__doc__.strip().split('\n')[0]}")
            await example_method()
            print(f"✅ Example {i} completed successfully!")
        except Exception as e:
            print(f"❌ Example {i} failed: {e}")

        # Add delay between examples
        await asyncio.sleep(1)

    print("\n🎉 All examples completed!")
    print("=" * 60)


if __name__ == "__main__":
    # Run all examples
    asyncio.run(run_all_examples())