"""
Comprehensive tests for advanced browser features.

This test suite covers all advanced browser capabilities including:
- Browser extensions and plugins management
- Network interception and modification
- Advanced screenshot and recording features
- Cookie and session management automation
- Proxy and VPN automation support
- Advanced performance monitoring and profiling
- Browser fingerprinting and privacy features
"""

import asyncio
import json
import pytest
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.services.advanced_browser_features import (
    AdvancedBrowserFeaturesService,
    BrowserExtension,
    NetworkRule,
    ScreenshotConfig,
    RecordingConfig,
    ProxyConfig,
    CookieConfig,
    ExtensionType,
    NetworkModificationType,
    ScreenshotFormat,
    RecordingFormat,
    PerformanceMetrics,
    BrowserFingerprint
)
from app.services.browser_manager import BrowserType, ExecutionMode


class TestAdvancedBrowserFeaturesService:
    """Test suite for AdvancedBrowserFeaturesService."""

    @pytest.fixture
    def service(self):
        """Create a service instance for testing."""
        return AdvancedBrowserFeaturesService()

    @pytest.fixture
    def mock_context(self):
        """Create a mock browser context."""
        context = MagicMock()
        context.add_init_script = AsyncMock()
        context.add_cookie = AsyncMock()
        context.cookies = AsyncMock(return_value=[])
        context.clear_cookies = AsyncMock()
        return context

    @pytest.fixture
    def mock_page(self):
        """Create a mock page."""
        page = MagicMock()
        page.screenshot = AsyncMock(return_value=b"fake_screenshot")
        page.goto = AsyncMock()
        page.text_content = AsyncMock(return_value='{"origin": "127.0.0.1"}')
        page.add_style_tag = AsyncMock()
        page.add_init_script = AsyncMock()
        page.evaluate = AsyncMock()
        page.route = AsyncMock()
        page.url = "https://example.com"
        return page

    # Browser Extensions Tests

    @pytest.mark.asyncio
    async def test_install_extension_from_url(self, service, mock_context):
        """Test installing a browser extension from URL."""
        with patch('aiohttp.ClientSession') as mock_session:
            # Mock successful download
            mock_response = MagicMock()
            mock_response.status = 200
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value.read.return_value = b"fake_extension_data"

            extension = BrowserExtension(
                name="Test Extension",
                extension_type=ExtensionType.ADBLOCKER,
                source="https://example.com/extension.crx"
            )

            result = await service.install_extension(mock_context, extension)

            assert result["success"] is True
            assert result["extension_id"] == str(extension.id)
            assert result["name"] == "Test Extension"
            assert result["type"] == "adblocker"
            assert extension.id in service.extensions

    @pytest.mark.asyncio
    async def test_install_extension_local_file(self, service, mock_context):
        """Test installing a browser extension from local file."""
        # Create temporary manifest file
        with tempfile.TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "manifest.json"
            manifest_data = {
                "name": "Test Extension",
                "version": "1.0",
                "permissions": ["storage"]
            }
            with open(manifest_path, 'w') as f:
                json.dump(manifest_data, f)

            extension = BrowserExtension(
                name="Test Extension",
                extension_type=ExtensionType.CUSTOM,
                source=str(manifest_path.parent)
            )

            result = await service.install_extension(mock_context, extension)

            assert result["success"] is True
            assert result["extension_id"] == str(extension.id)
            assert extension.manifest_data == manifest_data

    @pytest.mark.asyncio
    async def test_install_extension_invalid_source(self, service, mock_context):
        """Test installing an extension from invalid source."""
        extension = BrowserExtension(
            name="Invalid Extension",
            extension_type=ExtensionType.CUSTOM,
            source="/nonexistent/path"
        )

        result = await service.install_extension(mock_context, extension)

        assert result["success"] is False
        assert "error" in result
        assert "not found" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_uninstall_extension(self, service, mock_context):
        """Test uninstalling a browser extension."""
        # First install an extension
        extension = BrowserExtension(
            name="Test Extension",
            extension_type=ExtensionType.SECURITY,
            source="https://example.com/security.crx"
        )
        service.extensions[extension.id] = extension

        result = await service.uninstall_extension(mock_context, extension.id)

        assert result["success"] is True
        assert result["extension_id"] == str(extension.id)
        assert extension.id not in service.extensions

    @pytest.mark.asyncio
    async def test_uninstall_nonexistent_extension(self, service, mock_context):
        """Test uninstalling a non-existent extension."""
        fake_id = uuid4()
        result = await service.uninstall_extension(mock_context, fake_id)

        assert result["success"] is False
        assert "not found" in result["error"].lower()

    def test_get_installed_extensions(self, service):
        """Test getting list of installed extensions."""
        # Add some test extensions
        extension1 = BrowserExtension(
            name="Extension 1",
            extension_type=ExtensionType.ADBLOCKER,
            source="test1.crx"
        )
        extension2 = BrowserExtension(
            name="Extension 2",
            extension_type=ExtensionType.DEVELOPER_TOOLS,
            source="test2.crx"
        )
        service.extensions[extension1.id] = extension1
        service.extensions[extension2.id] = extension2

        extensions = service.get_installed_extensions()

        assert len(extensions) == 2
        assert extensions[0]["name"] == "Extension 1"
        assert extensions[1]["name"] == "Extension 2"
        assert extensions[0]["type"] == "adblocker"
        assert extensions[1]["type"] == "developer_tools"

    # Network Interception Tests

    @pytest.mark.asyncio
    async def test_add_network_rule(self, service):
        """Test adding a network modification rule."""
        rule = NetworkRule(
            name="Block Ads",
            url_pattern="*/ads/*",
            modification_type=NetworkModificationType.BLOCK,
            priority=10
        )

        result = await service.add_network_rule(rule)

        assert result["success"] is True
        assert result["rule_id"] == str(rule.id)
        assert result["name"] == "Block Ads"
        assert result["type"] == "block"
        assert result["priority"] == 10
        assert rule.id in service.network_rules

    @pytest.mark.asyncio
    async def test_add_network_rule_with_action(self, service):
        """Test adding a network rule with custom action."""
        rule = NetworkRule(
            name="Redirect to Test",
            url_pattern="https://example.com/*",
            modification_type=NetworkModificationType.REDIRECT,
            action={"url": "https://test.com"},
            priority=5
        )

        result = await service.add_network_rule(rule)

        assert result["success"] is True
        assert rule.id in service.network_rules
        assert service.network_rules[rule.id].action == {"url": "https://test.com"}

    def test_get_network_rules(self, service):
        """Test getting list of network rules."""
        # Add some test rules
        rule1 = NetworkRule(
            name="Rule 1",
            url_pattern="*/test1/*",
            modification_type=NetworkModificationType.BLOCK,
            priority=5
        )
        rule2 = NetworkRule(
            name="Rule 2",
            url_pattern="*/test2/*",
            modification_type=NetworkModificationType.DELAY,
            action={"delay_ms": 1000},
            priority=10
        )
        service.network_rules[rule1.id] = rule1
        service.network_rules[rule2.id] = rule2

        rules = service.get_network_rules()

        assert len(rules) == 2
        # Rules should be sorted by priority (highest first)
        assert rules[0]["name"] == "Rule 2"
        assert rules[0]["priority"] == 10
        assert rules[1]["name"] == "Rule 1"
        assert rules[1]["priority"] == 5

    def test_url_matches_pattern_wildcard(self, service):
        """Test URL pattern matching with wildcards."""
        pattern = "https://example.com/*"
        url = "https://example.com/page"

        assert service._url_matches_pattern(url, pattern) is True
        assert service._url_matches_pattern("https://other.com/page", pattern) is False

    def test_url_matches_pattern_regex(self, service):
        """Test URL pattern matching with regex."""
        pattern = r"/https://.*\.example\.com.*/"
        url = "https://sub.example.com/page"

        assert service._url_matches_pattern(url, pattern) is True
        assert service._url_matches_pattern("https://other.com/page", pattern) is False

    def test_url_matches_pattern_exact(self, service):
        """Test exact URL pattern matching."""
        pattern = "https://example.com/exact"
        url = "https://example.com/exact"

        assert service._url_matches_pattern(url, pattern) is True
        assert service._url_matches_pattern("https://example.com/other", pattern) is False

    @pytest.mark.asyncio
    async def test_setup_network_interception(self, service, mock_page):
        """Test setting up network interception."""
        # Add some rules first
        rule = NetworkRule(
            name="Test Rule",
            url_pattern="*/test/*",
            modification_type=NetworkModificationType.BLOCK
        )
        service.network_rules[rule.id] = rule

        result = await service.setup_network_interception(mock_page)

        assert result["success"] is True
        assert result["interception_enabled"] is True
        assert result["active_rules"] == 1
        mock_page.route.assert_called_once()

    # Screenshot Tests

    @pytest.mark.asyncio
    async def test_capture_screenshot_basic(self, service, mock_page):
        """Test basic screenshot capture."""
        config = ScreenshotConfig(
            format=ScreenshotFormat.PNG,
            full_page=False
        )

        result = await service.capture_screenshot(mock_page, config)

        assert result["success"] is True
        assert "screenshot_id" in result
        assert result["format"] == "png"
        assert result["size_bytes"] == len(b"fake_screenshot")
        assert "base64_data" in result
        assert "captured_at" in result
        assert result["screenshot_id"] in service.screenshot_cache

    @pytest.mark.asyncio
    async def test_capture_screenshot_with_clip(self, service, mock_page):
        """Test screenshot capture with clipping."""
        config = ScreenshotConfig(
            format=ScreenshotFormat.JPEG,
            quality=80,
            clip={"x": 0, "y": 0, "width": 800, "height": 600}
        )

        result = await service.capture_screenshot(mock_page, config)

        assert result["success"] is True
        assert result["format"] == "jpeg"

        # Verify screenshot was called with correct parameters
        mock_page.screenshot.assert_called_once()
        call_args = mock_page.screenshot.call_args[1]
        assert call_args["type"] == "jpeg"
        assert call_args["quality"] == 80
        assert call_args["clip"]["width"] == 800

    @pytest.mark.asyncio
    async def test_capture_screenshot_with_highlights(self, service, mock_page):
        """Test screenshot capture with element highlighting."""
        config = ScreenshotConfig(
            highlight_elements=["#element1", ".class1"]
        )

        result = await service.capture_screenshot(mock_page, config)

        assert result["success"] is True

        # Verify highlight script was executed
        mock_page.evaluate.assert_called()

    # Recording Tests

    @pytest.mark.asyncio
    async def test_start_recording(self, service, mock_page):
        """Test starting screen recording."""
        config = RecordingConfig(
            format=RecordingFormat.WEBM,
            fps=30,
            max_duration_seconds=60
        )

        result = await service.start_recording(mock_page, config)

        assert result["success"] is True
        assert "recording_id" in result
        assert result["status"] == "started"
        assert result["config"]["fps"] == 30
        assert result["recording_id"] in service.active_recordings

        # Verify recording indicator was added
        mock_page.add_style_tag.assert_called()
        mock_page.evaluate.assert_called()

    @pytest.mark.asyncio
    async def test_stop_recording(self, service, mock_page):
        """Test stopping screen recording."""
        # Start recording first
        config = RecordingConfig()
        start_result = await service.start_recording(mock_page, config)
        recording_id = start_result["recording_id"]

        # Stop recording
        result = await service.stop_recording(recording_id)

        assert result["success"] is True
        assert result["recording_id"] == recording_id
        assert result["status"] == "stopped"
        assert "duration_seconds" in result
        assert "frames_captured" in result
        assert "file_path" in result
        assert recording_id not in service.active_recordings

    @pytest.mark.asyncio
    async def test_stop_nonexistent_recording(self, service):
        """Test stopping a non-existent recording."""
        result = await service.stop_recording("nonexistent_id")

        assert result["success"] is False
        assert "not found" in result["error"].lower()

    def test_get_active_recordings(self, service):
        """Test getting list of active recordings."""
        # Add some test recordings
        recording1 = {
            "recording_id": "rec1",
            "page_url": "https://example.com",
            "status": "recording",
            "started_at": datetime.utcnow(),
            "frames": [],
            "config": {"fps": 30}
        }
        recording2 = {
            "recording_id": "rec2",
            "page_url": "https://test.com",
            "status": "recording",
            "started_at": datetime.utcnow(),
            "frames": [],
            "config": {"fps": 60}
        }
        service.active_recordings["rec1"] = recording1
        service.active_recordings["rec2"] = recording2

        recordings = service.get_active_recordings()

        assert len(recordings) == 2
        assert recordings[0]["recording_id"] == "rec1"
        assert recordings[1]["recording_id"] == "rec2"

    # Cookie Management Tests

    @pytest.mark.asyncio
    async def test_get_cookies(self, service, mock_context):
        """Test getting cookies from context."""
        # Mock cookie data
        mock_cookies = [
            {
                "name": "test_cookie",
                "value": "test_value",
                "domain": "example.com",
                "path": "/",
                "httpOnly": False,
                "secure": True,
                "sameSite": "Strict"
            }
        ]
        mock_context.cookies.return_value = mock_cookies

        cookies = await service.get_cookies(mock_context)

        assert len(cookies) == 1
        assert cookies[0]["name"] == "test_cookie"
        assert cookies[0]["value"] == "test_value"
        assert cookies[0]["domain"] == "example.com"
        assert cookies[0]["http_only"] is False
        assert cookies[0]["secure"] is True
        assert cookies[0]["same_site"] == "Strict"

    @pytest.mark.asyncio
    async def test_set_cookies(self, service, mock_context):
        """Test setting cookies in context."""
        cookies = [
            {
                "name": "new_cookie",
                "value": "new_value",
                "domain": "test.com",
                "secure": True
            }
        ]

        result = await service.set_cookies(mock_context, cookies)

        assert result["success"] is True
        assert result["cookies_set"] == 1
        mock_context.add_cookies.assert_called_once()

    @pytest.mark.asyncio
    async def test_clear_cookies_all(self, service, mock_context):
        """Test clearing all cookies."""
        mock_context.cookies.return_value = [
            {"name": "cookie1", "domain": "example.com"},
            {"name": "cookie2", "domain": "test.com"}
        ]

        result = await service.clear_cookies(mock_context)

        assert result["success"] is True
        assert result["cookies_cleared"] == 2
        assert result["domain"] is None
        mock_context.clear_cookies.assert_called_once()

    @pytest.mark.asyncio
    async def test_clear_cookies_domain(self, service, mock_context):
        """Test clearing cookies for specific domain."""
        mock_context.cookies.return_value = [
            {"name": "cookie1", "domain": "example.com"},
            {"name": "cookie2", "domain": "test.com"}
        ]

        result = await service.clear_cookies(mock_context, domain="example.com")

        assert result["success"] is True
        assert result["cookies_cleared"] == 1
        assert result["domain"] == "example.com"

    @pytest.mark.asyncio
    async def test_export_session(self, service, mock_context):
        """Test exporting browser session."""
        # Mock storage data
        mock_context.pages = [MagicMock(url="https://example.com")]
        mock_context.evaluate.return_value = {
            "localStorage": {"key1": "value1"},
            "sessionStorage": {"key2": "value2"}
        }

        with patch('app.services.advanced_browser_features.json.dump') as mock_dump:
            result = await service.export_session(mock_context)

            assert result["success"] is True
            assert "file_path" in result
            assert result["cookies_count"] == 0  # No cookies in mock
            assert result["localStorage_items"] == 1
            assert result["sessionStorage_items"] == 1

    @pytest.mark.asyncio
    async def test_import_session(self, service, mock_context):
        """Test importing browser session."""
        # Create temporary session file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            session_data = {
                "cookies": [
                    {"name": "imported_cookie", "value": "imported_value", "domain": "test.com"}
                ],
                "localStorage": {"imported_key": "imported_value"},
                "sessionStorage": {"session_key": "session_value"}
            }
            json.dump(session_data, f)
            temp_file = f.name

        try:
            result = await service.import_session(mock_context, temp_file)

            assert result["success"] is True
            assert result["cookies_restored"] == 1
            assert result["localStorage_items"] == 1
            assert result["sessionStorage_items"] == 1

        finally:
            # Clean up temp file
            Path(temp_file).unlink()

    # Proxy Tests

    @pytest.mark.asyncio
    async def test_setup_proxy(self, service, mock_context):
        """Test setting up proxy configuration."""
        proxy_config = ProxyConfig(
            server="http://proxy.example.com:8080",
            username="user",
            password="pass"
        )

        result = await service.setup_proxy(mock_context, proxy_config)

        assert result["success"] is True
        assert result["proxy_server"] == "http://proxy.example.com:8080"
        assert "configured_at" in result

    @pytest.mark.asyncio
    async def test_test_proxy_connection(self, service, mock_page):
        """Test proxy connection."""
        result = await service.test_proxy_connection(mock_page)

        assert result["success"] is True
        assert result["ip_address"] == "127.0.0.1"
        assert "load_time_ms" in result
        assert "tested_at" in result
        mock_page.goto.assert_called_once_with("https://httpbin.org/ip", wait_until="networkidle")

    # Performance Monitoring Tests

    @pytest.mark.asyncio
    async def test_start_performance_monitoring(self, service, mock_page):
        """Test starting performance monitoring."""
        result = await service.start_performance_monitoring(mock_page)

        assert result["success"] is True
        assert "monitoring_id" in result
        assert "started_at" in result
        mock_page.add_init_script.assert_called()

    @pytest.mark.asyncio
    async def test_collect_performance_metrics(self, service, mock_page):
        """Test collecting performance metrics."""
        # Mock performance data
        mock_page.evaluate.return_value = {
            "load_time": 2000,
            "domContentLoaded": 1000,
            "metrics": {
                "first-paint": {"startTime": 800},
                "first-contentful-paint": {"startTime": 1000},
                "lcp": {"startTime": 1500},
                "cls": 0.1,
                "fid": {"processingStart": 1200, "startTime": 1150},
                "resources": [{"transferSize": 1000}, {"transferSize": 2000}]
            },
            "memory": {
                "usedJSHeapSize": 50 * 1024 * 1024,  # 50MB
                "totalJSHeapSize": 100 * 1024 * 1024,
                "jsHeapSizeLimit": 2048 * 1024 * 1024
            }
        }

        metrics = await service.collect_performance_metrics(mock_page)

        assert isinstance(metrics, PerformanceMetrics)
        assert metrics.load_time_ms == 2000.0
        assert metrics.domContentLoaded_ms == 1000.0
        assert metrics.first_paint_ms == 800.0
        assert metrics.first_contentful_paint_ms == 1000.0
        assert metrics.largest_contentful_paint_ms == 1500.0
        assert metrics.cumulative_layout_shift == 0.1
        assert metrics.first_input_delay_ms == 50.0  # 1200 - 1150
        assert metrics.resources_count == 2
        assert metrics.transfer_size_bytes == 3000
        assert metrics.memory_usage_mb == 50.0

        # Verify metrics are stored
        assert len(service.performance_metrics) == 1
        assert service.performance_metrics[0] == metrics

    def test_get_performance_metrics(self, service):
        """Test getting performance metrics."""
        # Add some test metrics
        metrics1 = PerformanceMetrics(
            url="https://example.com",
            load_time_ms=2000.0,
            domContentLoaded_ms=1000.0,
            first_paint_ms=800.0,
            first_contentful_paint_ms=1000.0,
            largest_contentful_paint_ms=1500.0,
            cumulative_layout_shift=0.1,
            first_input_delay_ms=50.0,
            resources_count=10,
            transfer_size_bytes=1000000,
            memory_usage_mb=50.0
        )
        metrics2 = PerformanceMetrics(
            url="https://test.com",
            load_time_ms=1500.0,
            domContentLoaded_ms=800.0,
            first_paint_ms=600.0,
            first_contentful_paint_ms=700.0,
            largest_contentful_paint_ms=1200.0,
            cumulative_layout_shift=0.05,
            first_input_delay_ms=30.0,
            resources_count=8,
            transfer_size_bytes=800000,
            memory_usage_mb=40.0
        )
        service.performance_metrics = [metrics1, metrics2]

        all_metrics = service.get_performance_metrics()
        assert len(all_metrics) == 2

        # Test with limit
        limited_metrics = service.get_performance_metrics(limit=1)
        assert len(limited_metrics) == 1
        assert limited_metrics[0]["url"] == "https://test.com"  # Should return the last one

        # Test with URL filter
        filtered_metrics = service.get_performance_metrics(url_filter="example.com")
        assert len(filtered_metrics) == 1
        assert filtered_metrics[0]["url"] == "https://example.com"

    @pytest.mark.asyncio
    async def test_generate_performance_report(self, service, mock_page):
        """Test generating performance report."""
        # Mock performance data
        mock_page.evaluate.return_value = {
            "load_time": 2000,
            "domContentLoaded": 1000,
            "metrics": {
                "lcp": {"startTime": 1500},
                "cls": 0.1,
                "fid": {"processingStart": 1200, "startTime": 1150},
                "resources": []
            },
            "memory": {"usedJSHeapSize": 50 * 1024 * 1024}
        }

        with patch('app.services.advanced_browser_features.json.dump') as mock_dump:
            result = await service.generate_performance_report(mock_page)

            assert result["success"] is True
            assert "report" in result
            assert "file_path" in result

            report = result["report"]
            assert "metrics" in report
            assert "core_web_vitals" in report
            assert "performance_grade" in report
            assert "recommendations" in report

            # Check Core Web Vitals
            cwv = report["core_web_vitals"]
            assert "largest_contentful_paint" in cwv
            assert "cumulative_layout_shift" in cwv
            assert "first_input_delay" in cwv

            # Check performance grade
            grade = report["performance_grade"]
            assert "score" in grade
            assert "grade" in grade
            assert "color" in grade

    def test_assess_core_web_vitals(self, service):
        """Test Core Web Vitals assessment."""
        metrics = PerformanceMetrics(
            url="https://example.com",
            load_time_ms=2000.0,
            domContentLoaded_ms=1000.0,
            first_paint_ms=800.0,
            first_contentful_paint_ms=1000.0,
            largest_contentful_paint_ms=1500.0,
            cumulative_layout_shift=0.1,
            first_input_delay_ms=50.0,
            resources_count=10,
            transfer_size_bytes=1000000,
            memory_usage_mb=50.0
        )

        cwv = service._assess_core_web_vitals(metrics)

        assert cwv["largest_contentful_paint"]["value_ms"] == 1500.0
        assert cwv["largest_contentful_paint"]["rating"] == "good"  # <= 2500ms
        assert cwv["cumulative_layout_shift"]["value"] == 0.1
        assert cwv["cumulative_layout_shift"]["rating"] == "good"  # <= 0.1
        assert cwv["first_input_delay"]["value_ms"] == 50.0
        assert cwv["first_input_delay"]["rating"] == "good"  # <= 100ms

    def test_calculate_performance_grade(self, service):
        """Test performance grade calculation."""
        # Test excellent performance
        good_metrics = PerformanceMetrics(
            url="https://example.com",
            load_time_ms=1500.0,
            domContentLoaded_ms=800.0,
            first_paint_ms=600.0,
            first_contentful_paint_ms=700.0,
            largest_contentful_paint_ms=1200.0,
            cumulative_layout_shift=0.05,
            first_input_delay_ms=30.0,
            resources_count=8,
            transfer_size_bytes=800000,
            memory_usage_mb=40.0
        )

        grade = service._calculate_performance_grade(good_metrics)
        assert grade["grade"] in ["A", "B"]
        assert grade["score"] >= 80

        # Test poor performance
        poor_metrics = PerformanceMetrics(
            url="https://example.com",
            load_time_ms=5000.0,
            domContentLoaded_ms=4000.0,
            first_paint_ms=3000.0,
            first_contentful_paint_ms=3500.0,
            largest_contentful_paint_ms=4500.0,
            cumulative_layout_shift=0.3,
            first_input_delay_ms=350.0,
            resources_count=200,
            transfer_size_bytes=10000000,
            memory_usage_mb=150.0
        )

        grade = service._calculate_performance_grade(poor_metrics)
        assert grade["grade"] in ["D", "F"]
        assert grade["score"] < 70

    def test_generate_performance_recommendations(self, service):
        """Test performance recommendations generation."""
        # Poor metrics that should trigger recommendations
        poor_metrics = PerformanceMetrics(
            url="https://example.com",
            load_time_ms=5000.0,
            domContentLoaded_ms=4000.0,
            first_paint_ms=3000.0,
            first_contentful_paint_ms=3500.0,
            largest_contentful_paint_ms=4500.0,
            cumulative_layout_shift=0.3,
            first_input_delay_ms=350.0,
            resources_count=200,
            transfer_size_bytes=10000000,
            memory_usage_mb=150.0
        )

        recommendations = service._generate_performance_recommendations(poor_metrics)

        assert len(recommendations) > 0
        assert any("Page load time is slow" in rec for rec in recommendations)
        assert any("Largest Contentful Paint is slow" in rec for rec in recommendations)
        assert any("High Cumulative Layout Shift" in rec for rec in recommendations)
        assert any("First Input Delay is high" in rec for rec in recommendations)
        assert any("High memory usage" in rec for rec in recommendations)
        assert any("High number of resources" in rec for rec in recommendations)

    # Browser Fingerprinting Tests

    @pytest.mark.asyncio
    async def test_generate_browser_fingerprint(self, service, mock_page):
        """Test generating browser fingerprint."""
        # Mock fingerprint data
        mock_page.evaluate.return_value = {
            "user_agent": "Mozilla/5.0 (Test Browser)",
            "platform": "Test Platform",
            "language": "en-US",
            "timezone": "America/New_York",
            "screen": {"width": 1920, "height": 1080, "color_depth": 24},
            "cookie_enabled": True,
            "local_storage_enabled": True,
            "session_storage_enabled": True,
            "indexed_db_enabled": True,
            "open_database_enabled": False,
            "fonts": ["Arial", "Helvetica", "Times"],
            "plugins": ["Chrome PDF Plugin", "Native Client"],
            "canvas_hash": "canvas_fingerprint_data",
            "webgl_hash": "webgl_fingerprint_data"
        }

        fingerprint = await service.generate_browser_fingerprint(mock_page)

        assert isinstance(fingerprint, BrowserFingerprint)
        assert fingerprint.user_agent == "Mozilla/5.0 (Test Browser)"
        assert fingerprint.platform == "Test Platform"
        assert fingerprint.language == "en-US"
        assert fingerprint.timezone == "America/New_York"
        assert fingerprint.screen_resolution == "1920x1080"
        assert fingerprint.color_depth == "24"
        assert fingerprint.cookies_enabled is True
        assert fingerprint.fonts == ["Arial", "Helvetica", "Times"]
        assert fingerprint.plugins == ["Chrome PDF Plugin", "Native Client"]
        assert fingerprint.canvas_hash == "canvas_fingerprint_data"
        assert fingerprint.webgl_hash == "webgl_fingerprint_data"

        # Verify fingerprint is stored
        assert len(service.browser_fingerprints) == 1

    def test_get_browser_fingerprints(self, service):
        """Test getting list of browser fingerprints."""
        # Add some test fingerprints
        fingerprint1 = BrowserFingerprint(
            user_agent="Browser 1",
            screen_resolution="1920x1080",
            color_depth="24",
            timezone="America/New_York",
            language="en-US",
            platform="Windows",
            cookies_enabled=True,
            localStorage_enabled=True,
            sessionStorage_enabled=True,
            indexed_db_enabled=True,
            open_database_enabled=False
        )
        fingerprint2 = BrowserFingerprint(
            user_agent="Browser 2",
            screen_resolution="1366x768",
            color_depth="32",
            timezone="Europe/London",
            language="en-GB",
            platform="Mac",
            cookies_enabled=True,
            localStorage_enabled=True,
            sessionStorage_enabled=True,
            indexed_db_enabled=True,
            open_database_enabled=False
        )
        service.browser_fingerprints["fp1"] = fingerprint1
        service.browser_fingerprints["fp2"] = fingerprint2

        fingerprints = service.get_browser_fingerprints()

        assert len(fingerprints) == 2
        assert fingerprints[0]["user_agent"] == "Browser 1"
        assert fingerprints[1]["user_agent"] == "Browser 2"
        assert fingerprints[0]["fonts_count"] == 0
        assert fingerprints[1]["plugins_count"] == 0

    @pytest.mark.asyncio
    async def test_enable_privacy_mode(self, service, mock_page):
        """Test enabling privacy mode."""
        privacy_options = {
            "disable_canvas": True,
            "disable_webgl": True,
            "limit_fonts": True,
            "disable_notifications": True
        }

        result = await service.enable_privacy_mode(mock_page, privacy_options)

        assert result["success"] is True
        assert result["privacy_options"] == privacy_options
        assert "enabled_at" in result
        mock_page.evaluate.assert_called_once()

    # Cleanup Tests

    @pytest.mark.asyncio
    async def test_cleanup(self, service):
        """Test service cleanup."""
        # Add some test data
        service.extensions[uuid4()] = BrowserExtension(
            name="Test Extension",
            extension_type=ExtensionType.ADBLOCKER,
            source="test.crx"
        )
        service.network_rules[uuid4()] = NetworkRule(
            name="Test Rule",
            url_pattern="*/test/*",
            modification_type=NetworkModificationType.BLOCK
        )
        service.screenshot_cache["test_id"] = b"test_screenshot"
        service.performance_metrics.append(PerformanceMetrics(
            url="https://test.com",
            load_time_ms=1000.0,
            domContentLoaded_ms=500.0,
            first_paint_ms=300.0,
            first_contentful_paint_ms=400.0,
            largest_contentful_paint_ms=600.0,
            cumulative_layout_shift=0.05,
            first_input_delay_ms=20.0,
            resources_count=5,
            transfer_size_bytes=500000,
            memory_usage_mb=30.0
        ))
        service.browser_fingerprints["test_fp"] = BrowserFingerprint(
            user_agent="Test Browser",
            screen_resolution="1920x1080",
            color_depth="24",
            timezone="America/New_York",
            language="en-US",
            platform="Test",
            cookies_enabled=True,
            localStorage_enabled=True,
            sessionStorage_enabled=True,
            indexed_db_enabled=True,
            open_database_enabled=False
        )

        # Start a recording
        mock_page = MagicMock()
        mock_page.evaluate = AsyncMock()
        await service.start_recording(mock_page, RecordingConfig())

        await service.cleanup()

        # Verify cleanup
        assert len(service.extensions) == 0
        assert len(service.network_rules) == 0
        assert len(service.screenshot_cache) == 0
        assert len(service.performance_metrics) == 0
        assert len(service.browser_fingerprints) == 0
        assert len(service.active_recordings) == 0


# Integration Tests

class TestAdvancedBrowserIntegration:
    """Integration tests for advanced browser features."""

    @pytest.mark.asyncio
    async def test_end_to_end_workflow(self):
        """Test complete end-to-end workflow."""
        service = AdvancedBrowserFeaturesService()
        mock_context = MagicMock()
        mock_context.add_init_script = AsyncMock()
        mock_context.cookies = AsyncMock(return_value=[])
        mock_page = MagicMock()
        mock_page.screenshot = AsyncMock(return_value=b"test_screenshot")
        mock_page.goto = AsyncMock()
        mock_page.add_style_tag = AsyncMock()
        mock_page.add_init_script = AsyncMock()
        mock_page.evaluate = AsyncMock()
        mock_page.route = AsyncMock()
        mock_page.url = "https://example.com"

        # 1. Install an extension
        extension = BrowserExtension(
            name="Test Extension",
            extension_type=ExtensionType.SECURITY,
            source="test.crx"
        )
        with tempfile.NamedTemporaryFile(suffix='.json') as f:
            manifest_data = {"name": "Test Extension", "version": "1.0"}
            json.dump(manifest_data, f)
            f.flush()
            extension.source = str(Path(f.name).parent)

            install_result = await service.install_extension(mock_context, extension)
            assert install_result["success"] is True

        # 2. Add network rule
        rule = NetworkRule(
            name="Test Rule",
            url_pattern="*/test/*",
            modification_type=NetworkModificationType.DELAY,
            action={"delay_ms": 100}
        )
        rule_result = await service.add_network_rule(rule)
        assert rule_result["success"] is True

        # 3. Setup network interception
        interception_result = await service.setup_network_interception(mock_page)
        assert interception_result["success"] is True

        # 4. Start performance monitoring
        monitoring_result = await service.start_performance_monitoring(mock_page)
        assert monitoring_result["success"] is True

        # 5. Take screenshot
        screenshot_config = ScreenshotConfig(
            format=ScreenshotFormat.PNG,
            full_page=True
        )
        screenshot_result = await service.capture_screenshot(mock_page, screenshot_config)
        assert screenshot_result["success"] is True

        # 6. Start recording
        recording_config = RecordingConfig(fps=30, max_duration_seconds=60)
        recording_result = await service.start_recording(mock_page, recording_config)
        assert recording_result["success"] is True

        # 7. Stop recording
        stop_result = await service.stop_recording(recording_result["recording_id"])
        assert stop_result["success"] is True

        # 8. Generate browser fingerprint
        mock_page.evaluate.return_value = {
            "user_agent": "Test Browser",
            "platform": "Test Platform",
            "language": "en-US",
            "timezone": "America/New_York",
            "screen": {"width": 1920, "height": 1080, "color_depth": 24},
            "cookie_enabled": True,
            "local_storage_enabled": True,
            "session_storage_enabled": True,
            "indexed_db_enabled": True,
            "open_database_enabled": False,
            "fonts": ["Arial"],
            "plugins": [],
            "canvas_hash": "test",
            "webgl_hash": "test"
        }
        fingerprint = await service.generate_browser_fingerprint(mock_page)
        assert fingerprint.user_agent == "Test Browser"

        # 9. Export session
        mock_context.pages = [mock_page]
        mock_context.evaluate.return_value = {
            "localStorage": {"key": "value"},
            "sessionStorage": {}
        }
        export_result = await service.export_session(mock_context)
        assert export_result["success"] is True

        # 10. Cleanup
        await service.cleanup()

        # Verify all resources are cleaned up
        assert len(service.extensions) == 0
        assert len(service.network_rules) == 0
        assert len(service.screenshot_cache) == 0
        assert len(service.active_recordings) == 0


# Performance Tests

class TestAdvancedBrowserPerformance:
    """Performance tests for advanced browser features."""

    @pytest.mark.asyncio
    async def test_screenshot_performance(self):
        """Test screenshot capture performance."""
        service = AdvancedBrowserFeaturesService()
        mock_page = MagicMock()
        mock_page.screenshot = AsyncMock(return_value=b"x" * 1024 * 1024)  # 1MB screenshot

        config = ScreenshotConfig(format=ScreenshotFormat.PNG)

        start_time = asyncio.get_event_loop().time()
        result = await service.capture_screenshot(mock_page, config)
        end_time = asyncio.get_event_loop().time()

        assert result["success"] is True
        assert (end_time - start_time) < 5.0  # Should complete within 5 seconds

    @pytest.mark.asyncio
    async def test_network_rules_performance(self):
        """Test network rule matching performance."""
        service = AdvancedBrowserFeaturesService()

        # Add many rules
        for i in range(1000):
            rule = NetworkRule(
                name=f"Rule {i}",
                url_pattern=f"https://example{i}.com/*",
                modification_type=NetworkModificationType.BLOCK,
                priority=i
            )
            service.network_rules[rule.id] = rule

        # Test URL matching performance
        test_url = "https://example500.com/page"
        start_time = asyncio.get_event_loop().time()
        matches = service._url_matches_pattern(test_url, "https://example*.com/*")
        end_time = asyncio.get_event_loop().time()

        assert matches is True
        assert (end_time - start_time) < 0.01  # Should complete within 10ms

    @pytest.mark.asyncio
    async def test_memory_usage(self):
        """Test memory usage with many operations."""
        service = AdvancedBrowserFeaturesService()

        # Add many screenshots to cache
        for i in range(100):
            service.screenshot_cache[f"ss_{i}"] = b"x" * 1024 * 10  # 10KB each

        # Add many performance metrics
        for i in range(1000):
            metrics = PerformanceMetrics(
                url=f"https://test{i}.com",
                load_time_ms=1000.0,
                domContentLoaded_ms=500.0,
                first_paint_ms=300.0,
                first_contentful_paint_ms=400.0,
                largest_contentful_paint_ms=600.0,
                cumulative_layout_shift=0.05,
                first_input_delay_ms=20.0,
                resources_count=5,
                transfer_size_bytes=500000,
                memory_usage_mb=30.0
            )
            service.performance_metrics.append(metrics)

        # Verify data is properly stored
        assert len(service.screenshot_cache) == 100
        assert len(service.performance_metrics) == 1000

        # Cleanup and verify memory is freed
        await service.cleanup()
        assert len(service.screenshot_cache) == 0
        assert len(service.performance_metrics) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])