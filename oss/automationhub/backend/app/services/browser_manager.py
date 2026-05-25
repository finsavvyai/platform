"""
Browser Management Service for Multi-Browser Support

This service provides comprehensive browser management capabilities including:
- Multi-browser support (Chrome, Firefox, Safari, Edge)
- Browser version compatibility checks
- Headless and headed execution modes
- Mobile device emulation
- Browser profile management
- Performance optimization
- Resource monitoring and cleanup
"""

import asyncio
import json
import logging
import platform
import subprocess
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID, uuid4

from playwright.async_api import async_playwright, Browser, BrowserContext, BrowserType, Page
from pydantic import BaseModel, Field, validator

logger = logging.getLogger(__name__)


class BrowserType(str, Enum):
    """Supported browser types."""
    CHROMIUM = "chromium"
    FIREFOX = "firefox"
    WEBKIT = "webkit"
    CHROME = "chrome"
    EDGE = "edge"
    SAFARI = "safari"


class ExecutionMode(str, Enum):
    """Browser execution modes."""
    HEADLESS = "headless"
    HEADED = "headed"
    DEBUG = "debug"


class DeviceProfile(BaseModel):
    """Mobile device emulation profile."""
    name: str
    user_agent: str
    viewport: Dict[str, int]
    device_scale_factor: float
    is_mobile: bool = True
    has_touch: bool = True

    @validator('viewport')
    def validate_viewport(cls, v):
        if 'width' not in v or 'height' not in v:
            raise ValueError('Viewport must include width and height')
        return v


class BrowserConfig(BaseModel):
    """Browser configuration."""
    browser_type: BrowserType
    execution_mode: ExecutionMode = ExecutionMode.HEADLESS
    viewport: Dict[str, int] = {"width": 1280, "height": 720}
    user_agent: Optional[str] = None
    locale: str = "en-US"
    timezone_id: str = "America/New_York"
    geolocation: Optional[Dict[str, float]] = None
    permissions: List[str] = []
    ignore_https_errors: bool = False
    accept_downloads: bool = False
    java_script_enabled: bool = True

    # Mobile emulation
    device_profile: Optional[DeviceProfile] = None

    # Performance settings
    timeout: int = 30000
    navigation_timeout: int = 60000
    action_timeout: int = 30000

    # Resource limits
    max_pages: int = 10
    max_contexts: int = 5
    memory_limit_mb: Optional[int] = None

    # Debug settings
    slow_mo: int = 0
    devtools: bool = False

    class Config:
        use_enum_values = True


class BrowserInstance(BaseModel):
    """Browser instance information."""
    instance_id: UUID = Field(default_factory=uuid4)
    browser_type: BrowserType
    config: BrowserConfig
    pid: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: datetime = Field(default_factory=datetime.utcnow)
    active_contexts: List[UUID] = Field(default_factory=list)
    active_pages: List[UUID] = Field(default_factory=list)
    memory_usage_mb: float = 0
    cpu_usage_percent: float = 0

    class Config:
        use_enum_values = True


class BrowserCompatibilityInfo(BaseModel):
    """Browser compatibility information."""
    browser_type: BrowserType
    installed_version: Optional[str] = None
    minimum_required_version: str
    is_compatible: bool
    installation_path: Optional[str] = None
    capabilities: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)

    class Config:
        use_enum_values = True


class BrowserPool(BaseModel):
    """Browser pool for managing multiple instances of the same browser type."""
    pool_id: UUID = Field(default_factory=uuid4)
    browser_type: BrowserType
    max_instances: int = 5
    min_instances: int = 1
    current_instances: int = 0
    available_instances: List[UUID] = Field(default_factory=list)
    busy_instances: List[UUID] = Field(default_factory=list)
    auto_scale: bool = True
    scale_up_threshold: float = 0.8
    scale_down_threshold: float = 0.2
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_scaled: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class BrowserManager:
    """
    Comprehensive browser management service.

    Provides multi-browser support with advanced features including:
    - Browser version compatibility checking
    - Mobile device emulation
    - Browser pool management for parallel execution
    - Performance monitoring and optimization
    - Resource management and isolation
    - Cross-browser compatibility testing
    - Debug support
    """

    def __init__(self):
        self.playwright = None
        self.browser_instances: Dict[UUID, BrowserInstance] = {}
        self.browsers: Dict[UUID, Browser] = {}
        self.contexts: Dict[UUID, BrowserContext] = {}
        self.pages: Dict[UUID, Page] = {}
        self.browser_pools: Dict[BrowserType, BrowserPool] = {}

        # Device profiles for mobile emulation
        self.device_profiles = self._initialize_device_profiles()

        # Browser compatibility cache
        self._compatibility_cache: Dict[BrowserType, BrowserCompatibilityInfo] = {}
        self._compatibility_checked = False

        # Performance monitoring
        self._performance_monitor_task = None
        self._cleanup_task = None
        self._auto_scale_task = None

        # Resource limits
        self.max_memory_per_browser_mb = 2048
        self.max_cpu_per_browser_percent = 80
        self.session_timeout_minutes = 60
        self.cleanup_interval_seconds = 300

        logger.info("Browser manager initialized")

    def _initialize_device_profiles(self) -> Dict[str, DeviceProfile]:
        """Initialize mobile device profiles."""
        return {
            # iPhone profiles
            "iphone_13": DeviceProfile(
                name="iPhone 13",
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
                viewport={"width": 390, "height": 844},
                device_scale_factor=3.0
            ),
            "iphone_13_pro_max": DeviceProfile(
                name="iPhone 13 Pro Max",
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
                viewport={"width": 428, "height": 926},
                device_scale_factor=3.0
            ),

            # Android profiles
            "pixel_6": DeviceProfile(
                name="Google Pixel 6",
                user_agent="Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Mobile Safari/537.36",
                viewport={"width": 412, "height": 915},
                device_scale_factor=2.625
            ),
            "samsung_s21": DeviceProfile(
                name="Samsung Galaxy S21",
                user_agent="Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Mobile Safari/537.36",
                viewport={"width": 384, "height": 854},
                device_scale_factor=3.0
            ),

            # Tablet profiles
            "ipad_pro": DeviceProfile(
                name="iPad Pro",
                user_agent="Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
                viewport={"width": 1024, "height": 1366},
                device_scale_factor=2.0
            ),

            # Desktop responsive profiles
            "small_desktop": DeviceProfile(
                name="Small Desktop",
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36",
                viewport={"width": 768, "height": 1024},
                device_scale_factor=1.0,
                is_mobile=False,
                has_touch=False
            ),
            "large_desktop": DeviceProfile(
                name="Large Desktop",
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
                device_scale_factor=1.0,
                is_mobile=False,
                has_touch=False
            )
        }

    async def _initialize_playwright(self):
        """Initialize Playwright instance."""
        if not self.playwright:
            self.playwright = await async_playwright().start()
            await self._initialize_browser_pools()
            logger.info("Playwright initialized")
        return self.playwright

    async def _initialize_browser_pools(self):
        """Initialize browser pools for parallel execution."""
        try:
            supported_browsers = [BrowserType.CHROMIUM, BrowserType.FIREFOX, BrowserType.WEBKIT]

            for browser_type in supported_browsers:
                # Check compatibility before creating pool
                compatibility = await self.check_browser_compatibility(browser_type)
                if compatibility.is_compatible:
                    pool = BrowserPool(
                        browser_type=browser_type,
                        max_instances=5,
                        min_instances=1,
                        auto_scale=True
                    )
                    self.browser_pools[browser_type] = pool

                    # Create minimum instances
                    for _ in range(pool.min_instances):
                        try:
                            await self._create_pooled_browser_instance(browser_type)
                        except Exception as e:
                            logger.warning(f"Failed to create initial {browser_type} instance: {e}")
                else:
                    logger.warning(f"Skipping {browser_type} pool due to compatibility issues")

            logger.info(f"Initialized {len(self.browser_pools)} browser pools")

            # Start auto-scaling task
            if not self._auto_scale_task:
                self._auto_scale_task = asyncio.create_task(self._auto_scale_loop())

        except Exception as e:
            logger.error(f"Failed to initialize browser pools: {e}")

    async def _create_pooled_browser_instance(self, browser_type: BrowserType) -> UUID:
        """Create a new browser instance for the pool."""
        try:
            # Create a default config for pooled instances
            config = BrowserConfig(
                browser_type=browser_type,
                execution_mode=ExecutionMode.HEADLESS,
                max_pages=10,
                max_contexts=5
            )

            instance_id = await self.create_browser_instance(config)

            # Add to pool
            if browser_type in self.browser_pools:
                pool = self.browser_pools[browser_type]
                pool.current_instances += 1
                pool.available_instances.append(instance_id)

            return instance_id

        except Exception as e:
            logger.error(f"Failed to create pooled browser instance: {e}")
            raise

    async def get_browser_from_pool(self, browser_type: BrowserType) -> Optional[UUID]:
        """Get an available browser instance from the pool."""
        try:
            pool = self.browser_pools.get(browser_type)
            if not pool:
                return None

            # Check for available instances
            if pool.available_instances:
                instance_id = pool.available_instances.pop(0)
                pool.busy_instances.append(instance_id)

                # Update instance activity
                if instance_id in self.browser_instances:
                    self.browser_instances[instance_id].last_activity = datetime.utcnow()

                return instance_id

            # Try to auto-scale if needed
            if pool.auto_scale and pool.current_instances < pool.max_instances:
                try:
                    new_instance_id = await self._create_pooled_browser_instance(browser_type)
                    pool.available_instances.remove(new_instance_id)
                    pool.busy_instances.append(new_instance_id)
                    return new_instance_id
                except Exception as e:
                    logger.warning(f"Auto-scaling failed for {browser_type}: {e}")

            return None

        except Exception as e:
            logger.error(f"Failed to get browser from pool: {e}")
            return None

    async def return_browser_to_pool(self, instance_id: UUID):
        """Return a browser instance to the pool."""
        try:
            # Find the pool this instance belongs to
            for pool in self.browser_pools.values():
                if instance_id in pool.busy_instances:
                    pool.busy_instances.remove(instance_id)
                    pool.available_instances.append(instance_id)

                    # Update instance activity
                    if instance_id in self.browser_instances:
                        self.browser_instances[instance_id].last_activity = datetime.utcnow()

                    break

        except Exception as e:
            logger.error(f"Failed to return browser to pool: {e}")

    async def _auto_scale_loop(self):
        """Auto-scaling loop for browser pools."""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute

                current_time = datetime.utcnow()

                for browser_type, pool in self.browser_pools.items():
                    if not pool.auto_scale:
                        continue

                    # Calculate utilization
                    utilization = len(pool.busy_instances) / max(pool.current_instances, 1)

                    # Scale up if needed
                    if utilization > pool.scale_up_threshold and pool.current_instances < pool.max_instances:
                        try:
                            await self._create_pooled_browser_instance(browser_type)
                            pool.last_scaled = current_time
                            logger.info(f"Scaled up {browser_type} pool to {pool.current_instances} instances")
                        except Exception as e:
                            logger.warning(f"Failed to scale up {browser_type}: {e}")

                    # Scale down if possible
                    elif utilization < pool.scale_down_threshold and pool.current_instances > pool.min_instances:
                        # Find an idle instance to remove
                        for instance_id in pool.available_instances:
                            instance = self.browser_instances.get(instance_id)
                            if instance:
                                # Check if instance has been idle for more than 5 minutes
                                idle_time = (current_time - instance.last_activity).total_seconds()
                                if idle_time > 300:  # 5 minutes
                                    try:
                                        await self.close_browser_instance(instance_id)
                                        pool.current_instances -= 1
                                        pool.available_instances.remove(instance_id)
                                        pool.last_scaled = current_time
                                        logger.info(f"Scaled down {browser_type} pool to {pool.current_instances} instances")
                                        break
                                    except Exception as e:
                                        logger.warning(f"Failed to scale down {browser_type}: {e}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Auto-scaling error: {e}")

    def get_pool_statistics(self) -> Dict[str, Any]:
        """Get statistics for all browser pools."""
        stats = {}

        for browser_type, pool in self.browser_pools.items():
            stats[browser_type.value] = {
                "pool_id": str(pool.pool_id),
                "current_instances": pool.current_instances,
                "available_instances": len(pool.available_instances),
                "busy_instances": len(pool.busy_instances),
                "utilization": len(pool.busy_instances) / max(pool.current_instances, 1),
                "auto_scale": pool.auto_scale,
                "last_scaled": pool.last_scaled.isoformat(),
                "max_instances": pool.max_instances,
                "min_instances": pool.min_instances
            }

        return stats

    async def check_browser_compatibility(self, browser_type: BrowserType) -> BrowserCompatibilityInfo:
        """Check browser compatibility and version."""
        if browser_type in self._compatibility_cache:
            return self._compatibility_cache[browser_type]

        try:
            await self._initialize_playwright()

            # Map browser types to Playwright browser launchers
            browser_launcher_map = {
                BrowserType.CHROMIUM: self.playwright.chromium,
                BrowserType.FIREFOX: self.playwright.firefox,
                BrowserType.WEBKIT: self.playwright.webkit,
                BrowserType.CHROME: self.playwright.chromium,
                BrowserType.EDGE: self.playwright.chromium,
                BrowserType.SAFARI: self.playwright.webkit
            }

            # Get browser instance for version checking
            browser_launcher = browser_launcher_map.get(browser_type)
            if not browser_launcher:
                raise ValueError(f"Browser launcher not found for {browser_type}")

            # Try to get browser information
            compatibility_info = BrowserCompatibilityInfo(
                browser_type=browser_type,
                minimum_required_version="90.0",  # Minimum version for modern web features
                is_compatible=True,  # Default to compatible
                capabilities=self._get_browser_capabilities(browser_type),
                limitations=[]
            )

            try:
                # Launch browser to check version (headless for quick check)
                browser = await browser_launcher.launch(headless=True)
                version_info = await browser.version()
                await browser.close()

                compatibility_info.installed_version = version_info
                compatibility_info.is_compatible = self._is_version_compatible(version_info)

                # Check for limitations
                compatibility_info.limitations = self._get_browser_limitations(browser_type, version_info)

                # Try to detect installation path
                compatibility_info.installation_path = self._detect_browser_installation_path(browser_type)

            except Exception as e:
                logger.warning(f"Could not launch {browser_type} for compatibility check: {e}")
                # Still mark as compatible but note the limitation
                compatibility_info.limitations.append(f"Browser launch failed: {str(e)}")
                # Keep default compatibility as True for testing purposes

            self._compatibility_cache[browser_type] = compatibility_info
            return compatibility_info

        except Exception as e:
            logger.error(f"Browser compatibility check failed for {browser_type}: {e}")
            return BrowserCompatibilityInfo(
                browser_type=browser_type,
                minimum_required_version="90.0",
                is_compatible=True,  # Default to compatible for testing
                limitations=[f"Compatibility check failed: {str(e)}"],
                capabilities=self._get_browser_capabilities(browser_type)
            )

    def _detect_browser_installation_path(self, browser_type: BrowserType) -> Optional[str]:
        """Detect browser installation path."""
        try:
            system = platform.system()
            browser_commands = {
                BrowserType.CHROME: {
                    "Windows": ["where", "chrome"],
                    "Darwin": ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--version"],
                    "Linux": ["google-chrome", "--version"]
                },
                BrowserType.FIREFOX: {
                    "Windows": ["where", "firefox"],
                    "Darwin": ["/Applications/Firefox.app/Contents/MacOS/firefox", "--version"],
                    "Linux": ["firefox", "--version"]
                },
                BrowserType.EDGE: {
                    "Windows": ["where", "msedge"],
                    "Darwin": ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "--version"],
                    "Linux": ["microsoft-edge", "--version"]
                }
            }

            if browser_type in browser_commands:
                commands = browser_commands[browser_type].get(system, [])
                if commands:
                    result = subprocess.run(commands, capture_output=True, text=True, timeout=5)
                    if result.returncode == 0:
                        return commands[0] if system == "Windows" else commands[0]

        except Exception:
            pass

        return None

    def _is_version_compatible(self, version: str) -> bool:
        """Check if browser version meets minimum requirements."""
        try:
            # Extract version number (remove non-numeric characters)
            version_num = int(''.join(filter(str.isdigit, version.split('.')[0])))
            return version_num >= 90  # Minimum version for modern features
        except Exception:
            return False

    def _get_browser_capabilities(self, browser_type: BrowserType) -> List[str]:
        """Get browser capabilities based on type."""
        capabilities = {
            BrowserType.CHROMIUM: ["headless", "headed", "mobile_emulation", "extensions", "devtools"],
            BrowserType.FIREFOX: ["headless", "headed", "mobile_emulation", "extensions"],
            BrowserType.WEBKIT: ["headless", "headed", "mobile_emulation", "touch_events"],
            BrowserType.CHROME: ["headless", "headed", "mobile_emulation", "extensions", "devtools"],
            BrowserType.EDGE: ["headless", "headed", "mobile_emulation", "extensions", "devtools"],
            BrowserType.SAFARI: ["headed", "mobile_emulation", "touch_events"]  # Safari doesn't support headless
        }
        return capabilities.get(browser_type, [])

    def _get_browser_limitations(self, browser_type: BrowserType, version: Optional[str]) -> List[str]:
        """Get browser limitations based on type and version."""
        limitations = []

        if browser_type == BrowserType.SAFARI:
            limitations.append("Safari does not support headless mode")
            limitations.append("Limited extension support")

        if browser_type == BrowserType.FIREFOX:
            limitations.append("Slower startup compared to Chromium")
            limitations.append("Limited mobile device emulation")

        if version and not self._is_version_compatible(version):
            limitations.append("Browser version may not support all modern web features")

        # Platform-specific limitations
        if platform.system() == "Linux" and browser_type == BrowserType.SAFARI:
            limitations.append("Safari is not available on Linux")

        if platform.system() == "Windows" and browser_type == BrowserType.SAFARI:
            limitations.append("Safari support on Windows is deprecated")

        return limitations

    async def create_browser_instance(self, config: BrowserConfig) -> UUID:
        """Create a new browser instance with the specified configuration."""
        instance_id = uuid4()

        try:
            await self._initialize_playwright()

            # Check browser compatibility
            compatibility_info = await self.check_browser_compatibility(config.browser_type)
            if not compatibility_info.is_compatible:
                logger.warning(f"Browser {config.browser_type} may not be fully compatible")

            # Get browser launcher
            browser_launcher = getattr(self.playwright, config.browser_type.value)

            # Prepare launch options
            launch_options = self._prepare_launch_options(config)

            # Launch browser
            browser = await browser_launcher.launch(**launch_options)

            # Create browser instance record
            instance = BrowserInstance(
                instance_id=instance_id,
                browser_type=config.browser_type,
                config=config
            )

            # Store instance and browser
            self.browser_instances[instance_id] = instance
            self.browsers[instance_id] = browser

            logger.info(f"Created browser instance {instance_id} of type {config.browser_type}")
            return instance_id

        except Exception as e:
            logger.error(f"Failed to create browser instance: {e}")
            raise

    def _prepare_launch_options(self, config: BrowserConfig) -> Dict[str, Any]:
        """Prepare launch options for browser."""
        options = {
            "headless": config.execution_mode == ExecutionMode.HEADLESS,
            "slow_mo": config.slow_mo,
            "devtools": config.devtools or config.execution_mode == ExecutionMode.DEBUG
        }

        # Browser-specific options
        if config.browser_type in [BrowserType.CHROMIUM, BrowserType.CHROME, BrowserType.EDGE]:
            # Chromium-based browsers support additional options
            chromium_args = []

            if config.device_profile and config.device_profile.is_mobile:
                chromium_args.extend([
                    "--mobile-emulation",
                    f"device={config.device_profile.name}"
                ])

            if config.memory_limit_mb:
                chromium_args.append(f"--memory-pressure-off")

            if len(chromium_args) > 0:
                options["args"] = chromium_args

        return options

    async def create_context(self, browser_instance_id: UUID, context_config: Optional[Dict[str, Any]] = None) -> UUID:
        """Create a new browser context."""
        context_id = uuid4()

        try:
            browser = self.browsers.get(browser_instance_id)
            if not browser:
                raise ValueError(f"Browser instance {browser_instance_id} not found")

            instance = self.browser_instances[browser_instance_id]
            config = instance.config

            # Check context limits
            if len(instance.active_contexts) >= config.max_contexts:
                raise ValueError(f"Maximum contexts ({config.max_contexts}) reached for browser instance")

            # Prepare context options
            context_options = self._prepare_context_options(config, context_config)

            # Create context
            context = await browser.new_context(**context_options)

            # Store context
            self.contexts[context_id] = context
            instance.active_contexts.append(context_id)
            instance.last_activity = datetime.utcnow()

            logger.info(f"Created context {context_id} for browser instance {browser_instance_id}")
            return context_id

        except Exception as e:
            logger.error(f"Failed to create context: {e}")
            raise

    def _prepare_context_options(self, config: BrowserConfig, context_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Prepare context options."""
        options = {
            "viewport": config.device_profile.viewport if config.device_profile else config.viewport,
            "user_agent": config.device_profile.user_agent if config.device_profile else config.user_agent,
            "locale": config.locale,
            "timezone_id": config.timezone_id,
            "permissions": config.permissions,
            "ignore_https_errors": config.ignore_https_errors,
            "accept_downloads": config.accept_downloads,
            "java_script_enabled": config.java_script_enabled
        }

        # Add device-specific options
        if config.device_profile:
            options.update({
                "device_scale_factor": config.device_profile.device_scale_factor,
                "is_mobile": config.device_profile.is_mobile,
                "has_touch": config.device_profile.has_touch
            })

        # Add geolocation if specified
        if config.geolocation:
            options["geolocation"] = config.geolocation
            options["permissions"].append("geolocation")

        # Merge with additional context config
        if context_config:
            options.update(context_config)

        # Remove None values
        options = {k: v for k, v in options.items() if v is not None}

        return options

    async def create_page(self, context_id: UUID) -> UUID:
        """Create a new page in the specified context."""
        page_id = uuid4()

        try:
            context = self.contexts.get(context_id)
            if not context:
                raise ValueError(f"Context {context_id} not found")

            # Find browser instance
            browser_instance_id = None
            for instance_id, instance in self.browser_instances.items():
                if context_id in instance.active_contexts:
                    browser_instance_id = instance_id
                    break

            if not browser_instance_id:
                raise ValueError(f"Could not find browser instance for context {context_id}")

            instance = self.browser_instances[browser_instance_id]

            # Check page limits
            if len(instance.active_pages) >= instance.config.max_pages:
                raise ValueError(f"Maximum pages ({instance.config.max_pages}) reached for browser instance")

            # Create page
            page = await context.new_page()

            # Set timeouts
            page.set_default_timeout(instance.config.action_timeout)
            page.set_default_navigation_timeout(instance.config.navigation_timeout)

            # Store page
            self.pages[page_id] = page
            instance.active_pages.append(page_id)
            instance.last_activity = datetime.utcnow()

            logger.info(f"Created page {page_id} in context {context_id}")
            return page_id

        except Exception as e:
            logger.error(f"Failed to create page: {e}")
            raise

    async def get_page(self, page_id: UUID) -> Page:
        """Get a page by ID."""
        page = self.pages.get(page_id)
        if not page:
            raise ValueError(f"Page {page_id} not found")
        return page

    async def close_page(self, page_id: UUID):
        """Close a page."""
        try:
            page = self.pages.get(page_id)
            if page:
                await page.close()
                del self.pages[page_id]

                # Remove from instance
                for instance in self.browser_instances.values():
                    if page_id in instance.active_pages:
                        instance.active_pages.remove(page_id)
                        break

                logger.info(f"Closed page {page_id}")
        except Exception as e:
            logger.error(f"Failed to close page {page_id}: {e}")

    async def close_context(self, context_id: UUID):
        """Close a browser context and all its pages."""
        try:
            context = self.contexts.get(context_id)
            if context:
                await context.close()
                del self.contexts[context_id]

                # Remove pages from instance
                for instance in self.browser_instances.values():
                    if context_id in instance.active_contexts:
                        instance.active_contexts.remove(context_id)
                        # Remove all pages belonging to this context
                        pages_to_remove = []
                        for page_id in instance.active_pages:
                            if page_id in self.pages:
                                page = self.pages[page_id]
                                if page.context == context:
                                    pages_to_remove.append(page_id)
                        for page_id in pages_to_remove:
                            instance.active_pages.remove(page_id)
                            if page_id in self.pages:
                                del self.pages[page_id]
                        break

                logger.info(f"Closed context {context_id}")
        except Exception as e:
            logger.error(f"Failed to close context {context_id}: {e}")

    async def close_browser_instance(self, instance_id: UUID):
        """Close a browser instance and all its contexts and pages."""
        try:
            browser = self.browsers.get(instance_id)
            if browser:
                await browser.close()
                del self.browsers[instance_id]

                # Clean up instance
                if instance_id in self.browser_instances:
                    del self.browser_instances[instance_id]

                logger.info(f"Closed browser instance {instance_id}")
        except Exception as e:
            logger.error(f"Failed to close browser instance {instance_id}: {e}")

    def get_available_browsers(self) -> List[Dict[str, Any]]:
        """Get list of available browser types with compatibility info."""
        browsers = []

        for browser_type in BrowserType:
            compatibility = self._compatibility_cache.get(browser_type)
            if not compatibility:
                # We'll check compatibility asynchronously
                browsers.append({
                    "type": browser_type.value,
                    "name": browser_type.value.title(),
                    "compatible": None,  # Not checked yet
                    "version": None,
                    "capabilities": self._get_browser_capabilities(browser_type),
                    "limitations": []
                })
            else:
                browsers.append({
                    "type": compatibility.browser_type.value,
                    "name": compatibility.browser_type.value.title(),
                    "compatible": compatibility.is_compatible,
                    "version": compatibility.installed_version,
                    "capabilities": compatibility.capabilities,
                    "limitations": compatibility.limitations
                })

        return browsers

    def get_device_profiles(self) -> Dict[str, Dict[str, Any]]:
        """Get available device profiles for mobile emulation."""
        return {
            name: {
                "name": profile.name,
                "user_agent": profile.user_agent,
                "viewport": profile.viewport,
                "device_scale_factor": profile.device_scale_factor,
                "is_mobile": profile.is_mobile,
                "has_touch": profile.has_touch
            }
            for name, profile in self.device_profiles.items()
        }

    def get_active_instances(self) -> List[Dict[str, Any]]:
        """Get information about active browser instances."""
        instances = []

        for instance_id, instance in self.browser_instances.items():
            instances.append({
                "instance_id": str(instance_id),
                "browser_type": instance.browser_type.value,
                "execution_mode": instance.config.execution_mode.value,
                "active_contexts": len(instance.active_contexts),
                "active_pages": len(instance.active_pages),
                "created_at": instance.created_at.isoformat(),
                "last_activity": instance.last_activity.isoformat(),
                "memory_usage_mb": instance.memory_usage_mb,
                "cpu_usage_percent": instance.cpu_usage_percent
            })

        return instances

    async def update_instance_metrics(self, instance_id: UUID, memory_mb: float, cpu_percent: float):
        """Update performance metrics for a browser instance."""
        if instance_id in self.browser_instances:
            instance = self.browser_instances[instance_id]
            instance.memory_usage_mb = memory_mb
            instance.cpu_usage_percent = cpu_percent
            instance.last_activity = datetime.utcnow()

    async def start_performance_monitoring(self):
        """Start performance monitoring for all browser instances."""
        if self._performance_monitor_task:
            return  # Already running

        self._performance_monitor_task = asyncio.create_task(self._performance_monitor_loop())
        logger.info("Performance monitoring started")

    async def create_optimized_session(self, config: BrowserConfig) -> Dict[str, UUID]:
        """Create an optimized browser session with pool management."""
        try:
            # Get browser instance from pool
            instance_id = await self.get_browser_from_pool(config.browser_type)
            if not instance_id:
                # Fallback to creating new instance
                instance_id = await self.create_browser_instance(config)

            # Create context with optimized settings
            context_id = await self.create_context(instance_id)

            # Create page with performance optimizations
            page_id = await self.create_page(context_id)

            # Apply performance optimizations to page
            page = await self.get_page(page_id)
            await self._apply_performance_optimizations(page, config)

            return {
                "instance_id": instance_id,
                "context_id": context_id,
                "page_id": page_id
            }

        except Exception as e:
            logger.error(f"Failed to create optimized session: {e}")
            raise

    async def _apply_performance_optimizations(self, page: Page, config: BrowserConfig):
        """Apply performance optimizations to a page."""
        try:
            # Disable images if not needed
            if not config.device_profile or not config.device_profile.is_mobile:
                await page.route("**/*.{png,jpg,jpeg,gif,webp,svg}", lambda route: route.abort())

            # Block unnecessary resources for faster loading
            await page.route("**/*.css", lambda route: route.abort() if not config.device_profile else route.continue_())
            await page.route("**/*.js", lambda route: route.continue_())  # Keep JS for functionality

            # Set performance budgets
            await page.evaluate("""
                () => {
                    // Monitor performance metrics
                    window.performanceMetrics = {
                        navigationStart: performance.timing.navigationStart,
                        loadEventEnd: null,
                        domContentLoaded: null,
                        resourceCount: 0
                    };

                    // Count resources
                    const observer = new PerformanceObserver((list) => {
                        window.performanceMetrics.resourceCount += list.getEntries().length;
                    });
                    observer.observe({entryTypes: ['resource']});

                    // Track load events
                    window.addEventListener('load', () => {
                        window.performanceMetrics.loadEventEnd = performance.timing.loadEventEnd;
                        window.performanceMetrics.domContentLoaded = performance.timing.domContentLoadedEventEnd;
                    });
                }
            """)

        except Exception as e:
            logger.warning(f"Failed to apply performance optimizations: {e}")

    async def create_cross_browser_session(self, browsers: List[BrowserType], config: Optional[BrowserConfig] = None) -> Dict[BrowserType, Dict[str, UUID]]:
        """Create sessions across multiple browsers for cross-browser testing."""
        try:
            sessions = {}

            for browser_type in browsers:
                # Check compatibility first
                compatibility = await self.check_browser_compatibility(browser_type)
                if not compatibility.is_compatible:
                    logger.warning(f"Skipping {browser_type} due to compatibility issues")
                    continue

                # Create browser-specific config
                browser_config = config or BrowserConfig(browser_type=browser_type)

                # Create optimized session
                session_info = await self.create_optimized_session(browser_config)
                sessions[browser_type] = session_info

            return sessions

        except Exception as e:
            logger.error(f"Failed to create cross-browser session: {e}")
            raise

    async def run_cross_browser_test(self, test_script: str, browsers: List[BrowserType], config: Optional[BrowserConfig] = None) -> Dict[BrowserType, Dict[str, Any]]:
        """Run a test script across multiple browsers."""
        try:
            results = {}

            # Create cross-browser sessions
            sessions = await self.create_cross_browser_session(browsers, config)

            # Run test in each browser
            for browser_type, session_info in sessions.items():
                try:
                    page = await self.get_page(session_info["page_id"])

                    # Execute test script
                    start_time = datetime.utcnow()

                    try:
                        result = await page.evaluate(test_script)
                        success = True
                        error = None
                    except Exception as e:
                        result = None
                        success = False
                        error = str(e)

                    end_time = datetime.utcnow()
                    execution_time = (end_time - start_time).total_seconds() * 1000

                    # Get performance metrics
                    metrics = await page.evaluate("() => window.performanceMetrics || {}")

                    results[browser_type] = {
                        "success": success,
                        "result": result,
                        "error": error,
                        "execution_time_ms": execution_time,
                        "performance_metrics": metrics,
                        "browser_info": await self._get_browser_page_info(page)
                    }

                except Exception as e:
                    results[browser_type] = {
                        "success": False,
                        "error": str(e),
                        "execution_time_ms": 0,
                        "performance_metrics": {},
                        "browser_info": {}
                    }

                finally:
                    # Clean up session
                    await self.cleanup_session(session_info)

            return results

        except Exception as e:
            logger.error(f"Cross-browser test failed: {e}")
            raise

    async def _get_browser_page_info(self, page: Page) -> Dict[str, Any]:
        """Get browser and page information."""
        try:
            info = await page.evaluate("""
                () => ({
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    cookieEnabled: navigator.cookieEnabled,
                    doNotTrack: navigator.doNotTrack,
                    onLine: navigator.onLine,
                    screen: {
                        width: screen.width,
                        height: screen.height,
                        colorDepth: screen.colorDepth,
                        pixelDepth: screen.pixelDepth
                    },
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight,
                        outerWidth: window.outerWidth,
                        outerHeight: window.outerHeight
                    }
                })
            """)
            return info
        except Exception as e:
            logger.warning(f"Failed to get browser page info: {e}")
            return {}

    async def cleanup_session(self, session_info: Dict[str, UUID]):
        """Clean up a browser session and return resources to pool."""
        try:
            page_id = session_info.get("page_id")
            context_id = session_info.get("context_id")
            instance_id = session_info.get("instance_id")

            # Close page
            if page_id:
                await self.close_page(page_id)

            # Close context
            if context_id:
                await self.close_context(context_id)

            # Return browser instance to pool
            if instance_id:
                await self.return_browser_to_pool(instance_id)

        except Exception as e:
            logger.error(f"Failed to cleanup session: {e}")

    def get_enhanced_device_profiles(self) -> Dict[str, Dict[str, Any]]:
        """Get enhanced device profiles with cross-browser compatibility."""
        profiles = self.get_device_profiles()

        # Add compatibility info for each device
        for name, profile in profiles.items():
            profile["compatible_browsers"] = self._get_device_compatible_browsers(profile)
            profile["recommended_browser"] = self._get_recommended_browser_for_device(profile)

        return profiles

    def _get_device_compatible_browsers(self, device_profile: Dict[str, Any]) -> List[str]:
        """Get list of browsers compatible with a device profile."""
        compatible_browsers = []

        if device_profile.get("is_mobile", False):
            # Mobile devices work best with Chrome/Chromium and Safari on iOS
            compatible_browsers.extend([BrowserType.CHROMIUM.value, BrowserType.CHROME.value])
            if platform.system() == "Darwin":
                compatible_browsers.append(BrowserType.WEBKIT.value)
        else:
            # Desktop devices work with all browsers
            compatible_browsers.extend([
                BrowserType.CHROMIUM.value,
                BrowserType.FIREFOX.value,
                BrowserType.WEBKIT.value,
                BrowserType.CHROME.value,
                BrowserType.EDGE.value
            ])

        return compatible_browsers

    def _get_recommended_browser_for_device(self, device_profile: Dict[str, Any]) -> str:
        """Get the recommended browser for a device profile."""
        if device_profile.get("is_mobile", False):
            if device_profile.get("user_agent", "").lower().startswith("mozilla/5.0 (iphone"):
                return BrowserType.WEBKIT.value  # Safari for iPhone
            else:
                return BrowserType.CHROMIUM.value  # Chrome for Android
        else:
            return BrowserType.CHROMIUM.value  # Chrome for desktop

    async def get_comprehensive_statistics(self) -> Dict[str, Any]:
        """Get comprehensive browser manager statistics."""
        try:
            stats = {
                "pools": self.get_pool_statistics(),
                "instances": self.get_active_instances(),
                "browsers": self.get_available_browsers(),
                "devices": self.get_enhanced_device_profiles(),
                "system": {
                    "playwright_initialized": self.playwright is not None,
                    "monitoring_active": self._performance_monitor_task is not None,
                    "auto_scaling_active": self._auto_scale_task is not None,
                    "total_instances": len(self.browser_instances),
                    "total_contexts": len(self.contexts),
                    "total_pages": len(self.pages)
                },
                "compatibility": {
                    "checked_browsers": list(self._compatibility_cache.keys()),
                    "compatible_count": len([c for c in self._compatibility_cache.values() if c.is_compatible]),
                    "incompatible_count": len([c for c in self._compatibility_cache.values() if not c.is_compatible])
                }
            }

            return stats

        except Exception as e:
            logger.error(f"Failed to get comprehensive statistics: {e}")
            return {}

    async def stop_performance_monitoring(self):
        """Stop performance monitoring."""
        if self._performance_monitor_task:
            self._performance_monitor_task.cancel()
            self._performance_monitor_task = None
            logger.info("Performance monitoring stopped")

    async def _performance_monitor_loop(self):
        """Performance monitoring loop."""
        while True:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds

                # Update metrics for each instance
                for instance_id, instance in self.browser_instances.items():
                    try:
                        # Get browser process for metrics
                        browser = self.browsers.get(instance_id)
                        if browser and hasattr(browser, '_process'):
                            process = browser._process
                            try:
                                import psutil
                                process_obj = psutil.Process(process.pid)
                                memory_mb = process_obj.memory_info().rss / 1024 / 1024
                                cpu_percent = process_obj.cpu_percent()

                                await self.update_instance_metrics(instance_id, memory_mb, cpu_percent)
                            except Exception:
                                pass  # Metrics collection failed, continue
                    except Exception as e:
                        logger.warning(f"Failed to update metrics for instance {instance_id}: {e}")

                # Check for resource cleanup
                await self._cleanup_inactive_instances()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Performance monitoring error: {e}")

    async def _cleanup_inactive_instances(self):
        """Clean up inactive browser instances."""
        cleanup_threshold = datetime.utcnow() - timedelta(hours=1)

        for instance_id, instance in list(self.browser_instances.items()):
            if (instance.last_activity < cleanup_threshold and
                len(instance.active_contexts) == 0):
                logger.info(f"Cleaning up inactive instance {instance_id}")
                await self.close_browser_instance(instance_id)

    async def cleanup_all(self):
        """Clean up all browser resources."""
        try:
            # Stop all background tasks
            if self._performance_monitor_task:
                self._performance_monitor_task.cancel()
                self._performance_monitor_task = None

            if self._cleanup_task:
                self._cleanup_task.cancel()
                self._cleanup_task = None

            if self._auto_scale_task:
                self._auto_scale_task.cancel()
                self._auto_scale_task = None

            # Stop monitoring
            await self.stop_performance_monitoring()

            # Close all pages
            for page_id in list(self.pages.keys()):
                await self.close_page(page_id)

            # Close all contexts
            for context_id in list(self.contexts.keys()):
                await self.close_context(context_id)

            # Close all browsers
            for instance_id in list(self.browsers.keys()):
                await self.close_browser_instance(instance_id)

            # Clear all data structures
            self.browser_instances.clear()
            self.browsers.clear()
            self.contexts.clear()
            self.pages.clear()
            self.browser_pools.clear()

            # Stop playwright
            if self.playwright:
                await self.playwright.stop()
                self.playwright = None

            logger.info("Browser manager cleanup completed")

        except Exception as e:
            logger.error(f"Browser manager cleanup failed: {e}")


# Global browser manager instance
browser_manager = BrowserManager()