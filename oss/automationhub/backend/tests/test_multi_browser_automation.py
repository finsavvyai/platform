"""
Comprehensive test suite for multi-browser automation functionality.

Tests cover:
- Multi-browser support (Chrome, Firefox, Safari, Edge)
- Browser compatibility and version management
- Mobile device emulation
- Browser pool management
- Cross-browser compatibility testing
- Performance monitoring and optimization
- Resource management and isolation
"""

import asyncio
import json
import pytest
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any
from uuid import UUID

# Add backend path for imports
sys.path.append('/Users/shaharsolomon/dev/projects/02_AI_AGENTS/mcp-servers/automationhub/backend')

from app.services.browser_manager import (
    BrowserManager, BrowserType, BrowserConfig, DeviceProfile, ExecutionMode,
    BrowserCompatibilityInfo, BrowserPool
)


class TestMultiBrowserAutomation:
    """Test suite for multi-browser automation."""

    @pytest.fixture
    async def browser_manager(self):
        """Create browser manager instance for testing."""
        manager = BrowserManager()
        await manager._initialize_playwright()
        yield manager
        await manager.cleanup_all()

    @pytest.fixture
    def test_config(self):
        """Test browser configuration."""
        return BrowserConfig(
            browser_type=BrowserType.CHROMIUM,
            execution_mode=ExecutionMode.HEADLESS,
            viewport={"width": 1280, "height": 720},
            timeout=30000,
            max_pages=5,
            max_contexts=3
        )

    @pytest.mark.asyncio
    async def test_browser_compatibility_check(self, browser_manager):
        """Test browser compatibility checking."""
        # Test compatibility for all supported browsers
        supported_browsers = [BrowserType.CHROMIUM, BrowserType.FIREFOX, BrowserType.WEBKIT]

        for browser_type in supported_browsers:
            compatibility = await browser_manager.check_browser_compatibility(browser_type)

            assert isinstance(compatibility, BrowserCompatibilityInfo)
            assert compatibility.browser_type == browser_type
            assert compatibility.minimum_required_version == "90.0"
            assert isinstance(compatibility.is_compatible, bool)
            assert isinstance(compatibility.capabilities, list)
            assert isinstance(compatibility.limitations, list)

            print(f"✓ {browser_type} compatibility check passed")

    @pytest.mark.asyncio
    async def test_browser_pool_initialization(self, browser_manager):
        """Test browser pool initialization and management."""
        # Check if pools were created
        assert len(browser_manager.browser_pools) > 0

        for browser_type, pool in browser_manager.browser_pools.items():
            assert isinstance(pool, BrowserPool)
            assert pool.browser_type == browser_type
            assert pool.max_instances > 0
            assert pool.min_instances >= 0
            assert pool.current_instances >= 0
            assert pool.auto_scale in [True, False]

            print(f"✓ {browser_type} pool initialized correctly")

    @pytest.mark.asyncio
    async def test_browser_instance_creation(self, browser_manager, test_config):
        """Test browser instance creation and management."""
        # Create browser instance
        instance_id = await browser_manager.create_browser_instance(test_config)
        assert instance_id is not None
        assert isinstance(instance_id, UUID)

        # Verify instance was created
        assert instance_id in browser_manager.browser_instances
        assert instance_id in browser_manager.browsers

        instance = browser_manager.browser_instances[instance_id]
        assert instance.browser_type == test_config.browser_type
        assert instance.config == test_config

        # Clean up
        await browser_manager.close_browser_instance(instance_id)
        assert instance_id not in browser_manager.browser_instances
        assert instance_id not in browser_manager.browsers

        print("✓ Browser instance creation and cleanup test passed")

    @pytest.mark.asyncio
    async def test_context_and_page_creation(self, browser_manager, test_config):
        """Test browser context and page creation."""
        # Create browser instance
        instance_id = await browser_manager.create_browser_instance(test_config)

        # Create context
        context_id = await browser_manager.create_context(instance_id)
        assert context_id is not None
        assert isinstance(context_id, UUID)
        assert context_id in browser_manager.contexts

        # Create page
        page_id = await browser_manager.create_page(context_id)
        assert page_id is not None
        assert isinstance(page_id, UUID)
        assert page_id in browser_manager.pages

        # Verify page is functional
        page = await browser_manager.get_page(page_id)
        assert page is not None

        # Clean up
        await browser_manager.close_page(page_id)
        await browser_manager.close_context(context_id)
        await browser_manager.close_browser_instance(instance_id)

        print("✓ Context and page creation test passed")

    @pytest.mark.asyncio
    async def test_mobile_device_emulation(self, browser_manager):
        """Test mobile device emulation functionality."""
        # Test available device profiles
        device_profiles = browser_manager.get_device_profiles()
        assert len(device_profiles) > 0

        # Test iPhone emulation
        iphone_profile = device_profiles["iphone_13"]
        assert isinstance(iphone_profile, DeviceProfile)
        assert iphone_profile.is_mobile is True
        assert iphone_profile.has_touch is True

        # Create mobile configuration
        mobile_config = BrowserConfig(
            browser_type=BrowserType.CHROMIUM,
            execution_mode=ExecutionMode.HEADLESS,
            device_profile=iphone_profile
        )

        # Test mobile session creation
        session_info = await browser_manager.create_optimized_session(mobile_config)
        assert "instance_id" in session_info
        assert "context_id" in session_info
        assert "page_id" in session_info

        # Verify mobile viewport
        page = await browser_manager.get_page(session_info["page_id"])
        viewport = page.viewport_size
        assert viewport["width"] == iphone_profile.viewport["width"]
        assert viewport["height"] == iphone_profile.viewport["height"]

        # Clean up
        await browser_manager.cleanup_session(session_info)

        print("✓ Mobile device emulation test passed")

    @pytest.mark.asyncio
    async def test_browser_pool_operations(self, browser_manager, test_config):
        """Test browser pool operations."""
        browser_type = test_config.browser_type
        pool = browser_manager.browser_pools.get(browser_type)

        if not pool:
            pytest.skip(f"No pool available for {browser_type}")

        initial_available = len(pool.available_instances)
        initial_busy = len(pool.busy_instances)

        # Get browser from pool
        instance_id = await browser_manager.get_browser_from_pool(browser_type)
        if instance_id:
            assert len(pool.available_instances) == initial_available - 1
            assert len(pool.busy_instances) == initial_busy + 1

            # Return browser to pool
            await browser_manager.return_browser_to_pool(instance_id)
            assert len(pool.available_instances) == initial_available
            assert len(pool.busy_instances) == initial_busy

        print("✓ Browser pool operations test passed")

    @pytest.mark.asyncio
    async def test_cross_browser_session_creation(self, browser_manager):
        """Test cross-browser session creation."""
        browsers_to_test = [BrowserType.CHROMIUM, BrowserType.FIREFOX]

        # Filter compatible browsers
        compatible_browsers = []
        for browser_type in browsers_to_test:
            compatibility = await browser_manager.check_browser_compatibility(browser_type)
            if compatibility.is_compatible:
                compatible_browsers.append(browser_type)

        if not compatible_browsers:
            pytest.skip("No compatible browsers available for testing")

        # Create cross-browser sessions
        sessions = await browser_manager.create_cross_browser_session(compatible_browsers)

        assert len(sessions) > 0
        for browser_type, session_info in sessions.items():
            assert "instance_id" in session_info
            assert "context_id" in session_info
            assert "page_id" in session_info

            # Verify page is functional
            page = await browser_manager.get_page(session_info["page_id"])
            assert page is not None

        # Clean up all sessions
        for session_info in sessions.values():
            await browser_manager.cleanup_session(session_info)

        print(f"✓ Cross-browser session creation test passed for {len(sessions)} browsers")

    @pytest.mark.asyncio
    async def test_performance_optimization(self, browser_manager):
        """Test performance optimization features."""
        config = BrowserConfig(
            browser_type=BrowserType.CHROMIUM,
            execution_mode=ExecutionMode.HEADLESS,
            viewport={"width": 1920, "height": 1080}
        )

        # Create optimized session
        session_info = await browser_manager.create_optimized_session(config)
        page = await browser_manager.get_page(session_info["page_id"])

        # Navigate to a test page
        await page.goto("about:blank")

        # Check if performance monitoring was injected
        metrics = await page.evaluate("() => window.performanceMetrics")
        assert metrics is not None
        assert "navigationStart" in metrics

        # Clean up
        await browser_manager.cleanup_session(session_info)

        print("✓ Performance optimization test passed")

    @pytest.mark.asyncio
    async def test_enhanced_device_profiles(self, browser_manager):
        """Test enhanced device profiles with browser compatibility."""
        enhanced_profiles = browser_manager.get_enhanced_device_profiles()

        assert len(enhanced_profiles) > 0

        for device_name, profile in enhanced_profiles.items():
            assert "compatible_browsers" in profile
            assert "recommended_browser" in profile
            assert isinstance(profile["compatible_browsers"], list)
            assert profile["recommended_browser"] in BrowserType._value2member_map_

        print("✓ Enhanced device profiles test passed")

    @pytest.mark.asyncio
    async def test_comprehensive_statistics(self, browser_manager):
        """Test comprehensive statistics collection."""
        stats = await browser_manager.get_comprehensive_statistics()

        assert "pools" in stats
        assert "instances" in stats
        assert "browsers" in stats
        assert "devices" in stats
        assert "system" in stats
        assert "compatibility" in stats

        # Check system stats
        system_stats = stats["system"]
        assert "playwright_initialized" in system_stats
        assert "total_instances" in system_stats
        assert "total_contexts" in system_stats
        assert "total_pages" in system_stats

        # Check compatibility stats
        compatibility_stats = stats["compatibility"]
        assert "checked_browsers" in compatibility_stats
        assert "compatible_count" in compatibility_stats
        assert "incompatible_count" in compatibility_stats

        print("✓ Comprehensive statistics test passed")

    @pytest.mark.asyncio
    async def test_cross_browser_script_execution(self, browser_manager):
        """Test script execution across multiple browsers."""
        # Simple test script
        test_script = """
        () => {
            return {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                cookiesEnabled: navigator.cookieEnabled,
                screenResolution: `${screen.width}x${screen.height}`,
                timestamp: Date.now()
            };
        }
        """

        browsers_to_test = [BrowserType.CHROMIUM, BrowserType.FIREFOX]

        # Filter compatible browsers
        compatible_browsers = []
        for browser_type in browsers_to_test:
            compatibility = await browser_manager.check_browser_compatibility(browser_type)
            if compatibility.is_compatible:
                compatible_browsers.append(browser_type)

        if not compatible_browsers:
            pytest.skip("No compatible browsers available for testing")

        # Run cross-browser test
        results = await browser_manager.run_cross_browser_test(test_script, compatible_browsers)

        assert len(results) > 0

        for browser_type, result in results.items():
            assert "success" in result
            assert "execution_time_ms" in result
            assert "performance_metrics" in result
            assert "browser_info" in result

            if result["success"]:
                assert "result" in result
                browser_info = result["result"]
                assert "userAgent" in browser_info
                assert "platform" in browser_info
                assert "language" in browser_info

        print(f"✓ Cross-browser script execution test passed for {len(results)} browsers")

    @pytest.mark.asyncio
    async def test_browser_isolation_and_resource_management(self, browser_manager):
        """Test browser isolation and resource management."""
        # Create multiple instances with different configurations
        configs = [
            BrowserConfig(browser_type=BrowserType.CHROMIUM, execution_mode=ExecutionMode.HEADLESS),
            BrowserConfig(browser_type=BrowserType.FIREFOX, execution_mode=ExecutionMode.HEADLESS)
        ]

        sessions = []
        try:
            for config in configs:
                compatibility = await browser_manager.check_browser_compatibility(config.browser_type)
                if compatibility.is_compatible:
                    session_info = await browser_manager.create_optimized_session(config)
                    sessions.append(session_info)

            # Verify isolation - each session should have unique IDs
            instance_ids = [s["instance_id"] for s in sessions]
            context_ids = [s["context_id"] for s in sessions]
            page_ids = [s["page_id"] for s in sessions]

            assert len(set(instance_ids)) == len(instance_ids)
            assert len(set(context_ids)) == len(context_ids)
            assert len(set(page_ids)) == len(page_ids)

            # Test resource limits
            for i, session_info in enumerate(sessions):
                page = await browser_manager.get_page(session_info["page_id"])
                await page.goto("about:blank")
                await page.set_content(f"<html><body><h1>Browser {i + 1}</h1></body></html>")

                content = await page.content()
                assert f"Browser {i + 1}" in content

        finally:
            # Clean up all sessions
            for session_info in sessions:
                await browser_manager.cleanup_session(session_info)

        print("✓ Browser isolation and resource management test passed")

    @pytest.mark.asyncio
    async def test_error_handling_and_recovery(self, browser_manager):
        """Test error handling and recovery mechanisms."""
        config = BrowserConfig(
            browser_type=BrowserType.CHROMIUM,
            execution_mode=ExecutionMode.HEADLESS,
            timeout=5000  # Short timeout for testing
        )

        # Test invalid browser type
        with pytest.raises(Exception):
            invalid_config = BrowserConfig(browser_type="invalid_browser")
            await browser_manager.create_browser_instance(invalid_config)

        # Test session cleanup with invalid IDs
        await browser_manager.cleanup_session({"instance_id": UUID(), "context_id": UUID(), "page_id": UUID()})
        # Should not raise an exception

        print("✓ Error handling and recovery test passed")

    @pytest.mark.asyncio
    async def test_automatic_cleanup_and_maintenance(self, browser_manager):
        """Test automatic cleanup and maintenance features."""
        # Create some instances
        instance_ids = []
        config = BrowserConfig(browser_type=BrowserType.CHROMIUM, execution_mode=ExecutionMode.HEADLESS)

        for _ in range(3):
            try:
                instance_id = await browser_manager.create_browser_instance(config)
                instance_ids.append(instance_id)
            except:
                break

        # Simulate inactive instances by updating last activity
        old_time = datetime.utcnow() - timedelta(minutes=30)
        for instance_id in instance_ids:
            if instance_id in browser_manager.browser_instances:
                browser_manager.browser_instances[instance_id].last_activity = old_time

        # Run cleanup manually (would normally run in background)
        await browser_manager._cleanup_inactive_instances()

        print("✓ Automatic cleanup and maintenance test passed")


class TestBrowserIntegration:
    """Integration tests for browser automation."""

    @pytest.mark.asyncio
    async def test_full_workflow_simulation(self):
        """Test a complete automation workflow."""
        manager = BrowserManager()
        try:
            await manager._initialize_playwright()

            # Step 1: Check browser compatibility
            compatible_browsers = []
            for browser_type in [BrowserType.CHROMIUM, BrowserType.FIREFOX]:
                compatibility = await manager.check_browser_compatibility(browser_type)
                if compatibility.is_compatible:
                    compatible_browsers.append(browser_type)

            if not compatible_browsers:
                pytest.skip("No compatible browsers available")

            # Step 2: Create mobile emulation session
            device_profiles = manager.get_device_profiles()
            mobile_profile = device_profiles["iphone_13"]

            mobile_config = BrowserConfig(
                browser_type=BrowserType.CHROMIUM,
                device_profile=mobile_profile,
                execution_mode=ExecutionMode.HEADLESS
            )

            mobile_session = await manager.create_optimized_session(mobile_config)

            # Step 3: Create desktop session
            desktop_config = BrowserConfig(
                browser_type=compatible_browsers[0],
                execution_mode=ExecutionMode.HEADLESS,
                viewport={"width": 1920, "height": 1080}
            )

            desktop_session = await manager.create_optimized_session(desktop_config)

            # Step 4: Test page interactions
            mobile_page = await manager.get_page(mobile_session["page_id"])
            desktop_page = await manager.get_page(desktop_session["page_id"])

            await mobile_page.goto("about:blank")
            await desktop_page.goto("about:blank")

            await mobile_page.set_content("<html><body><h1>Mobile Test</h1></body></html>")
            await desktop_page.set_content("<html><body><h1>Desktop Test</h1></body></html>")

            # Step 5: Verify content
            mobile_content = await mobile_page.content()
            desktop_content = await desktop_page.content()

            assert "Mobile Test" in mobile_content
            assert "Desktop Test" in desktop_content

            # Step 6: Get statistics
            stats = await manager.get_comprehensive_statistics()
            assert stats["system"]["total_instances"] >= 2

            # Step 7: Cleanup
            await manager.cleanup_session(mobile_session)
            await manager.cleanup_session(desktop_session)

            print("✓ Full workflow simulation test passed")

        finally:
            await manager.cleanup_all()


if __name__ == "__main__":
    # Run specific tests
    import asyncio

    async def run_tests():
        """Run test suite."""
        test_suite = TestMultiBrowserAutomation()

        print("Running multi-browser automation tests...")
        print("=" * 60)

        # Test basic functionality
        await test_suite.test_browser_compatibility_check(BrowserManager())
        print("\n✅ All browser compatibility tests passed!")

        await test_suite.test_enhanced_device_profiles(BrowserManager())
        print("\n✅ Device profile tests passed!")

        # Test integration
        integration_test = TestBrowserIntegration()
        await integration_test.test_full_workflow_simulation()
        print("\n✅ Integration tests passed!")

        print("\n" + "=" * 60)
        print("🎉 All multi-browser automation tests completed successfully!")

    # Run tests
    asyncio.run(run_tests())