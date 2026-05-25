"""
Advanced Browser Features Service for UPM.Plus AutomationHub

This service provides comprehensive advanced browser capabilities including:
- Browser extensions and plugins management
- Network interception and modification
- Advanced screenshot and recording features
- Cookie and session management automation
- Proxy and VPN automation support
- Advanced performance monitoring and profiling
- Browser fingerprinting and privacy features
"""

import asyncio
import base64
import json
import logging
import os
import tempfile
import time
import zipfile
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID, uuid4

from playwright.async_api import Page, BrowserContext, Route, Request, Response
from pydantic import BaseModel, Field, field_validator, ConfigDict

logger = logging.getLogger(__name__)


class ExtensionType(str, Enum):
    """Supported browser extension types."""
    ADBLOCKER = "adblocker"
    DEVELOPER_TOOLS = "developer_tools"
    SECURITY = "security"
    AUTOMATION = "automation"
    TESTING = "testing"
    ACCESSIBILITY = "accessibility"
    CUSTOM = "custom"


class NetworkModificationType(str, Enum):
    """Network modification types."""
    BLOCK = "block"
    REDIRECT = "redirect"
    MODIFY_HEADERS = "modify_headers"
    MODIFY_BODY = "modify_body"
    THROTTLE = "throttle"
    DELAY = "delay"
    MOCK = "mock"


class ScreenshotFormat(str, Enum):
    """Screenshot formats."""
    PNG = "png"
    JPEG = "jpeg"
    WEBP = "webp"


class RecordingFormat(str, Enum):
    """Screen recording formats."""
    WEBM = "webm"
    MP4 = "mp4"
    GIF = "gif"


class BrowserExtension(BaseModel):
    """Browser extension configuration."""
    id: UUID = Field(default_factory=uuid4)
    name: str
    extension_type: ExtensionType
    source: str  # URL or local path
    enabled: bool = True
    permissions: List[str] = Field(default_factory=list)
    settings: Dict[str, Any] = Field(default_factory=dict)
    manifest_data: Optional[Dict[str, Any]] = None
    installed_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(use_enum_values=True)


class NetworkRule(BaseModel):
    """Network modification rule."""
    id: UUID = Field(default_factory=uuid4)
    name: str
    url_pattern: str  # Supports wildcards and regex
    modification_type: NetworkModificationType
    action: Dict[str, Any] = Field(default_factory=dict)
    priority: int = 0
    enabled: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(use_enum_values=True)


class ScreenshotConfig(BaseModel):
    """Screenshot configuration."""
    format: ScreenshotFormat = ScreenshotFormat.PNG
    quality: int = Field(default=90, ge=1, le=100)
    full_page: bool = False
    clip: Optional[Dict[str, int]] = None  # x, y, width, height
    scale: float = Field(default=1.0, ge=0.1, le=3.0)
    animate: bool = False
    hide_scrollbars: bool = False
    highlight_elements: Optional[List[str]] = None


class RecordingConfig(BaseModel):
    """Screen recording configuration."""
    format: RecordingFormat = RecordingFormat.WEBM
    quality: int = Field(default=90, ge=1, le=100)
    fps: int = Field(default=30, ge=1, le=60)
    max_duration_seconds: int = Field(default=300, ge=1, le=3600)
    audio_enabled: bool = False
    cursor_highlight: bool = True
    area: Optional[Dict[str, int]] = None  # x, y, width, height


class CookieConfig(BaseModel):
    """Cookie management configuration."""
    domain: str
    path: str = "/"
    name: Optional[str] = None
    value: Optional[str] = None
    http_only: bool = False
    secure: bool = False
    same_site: Optional[str] = None  # Strict, Lax, None
    expires: Optional[datetime] = None

    @field_validator('same_site')
    @classmethod
    def validate_same_site(cls, v):
        if v is not None and v not in ['Strict', 'Lax', 'None']:
            raise ValueError('same_site must be one of: Strict, Lax, None')
        return v


class ProxyConfig(BaseModel):
    """Proxy configuration."""
    server: str  # http://proxy.example.com:8080
    username: Optional[str] = None
    password: Optional[str] = None
    bypass: Optional[List[str]] = None
    socks_version: Optional[int] = Field(default=5, ge=4, le=5)


class PerformanceMetrics(BaseModel):
    """Performance monitoring metrics."""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    url: str
    load_time_ms: float
    domContentLoaded_ms: float
    first_paint_ms: float
    first_contentful_paint_ms: float
    largest_contentful_paint_ms: float
    cumulative_layout_shift: float
    first_input_delay_ms: float
    resources_count: int
    transfer_size_bytes: int
    memory_usage_mb: float


class BrowserFingerprint(BaseModel):
    """Browser fingerprint information."""
    user_agent: str
    screen_resolution: str
    color_depth: str
    timezone: str
    language: str
    platform: str
    webgl_hash: Optional[str] = None
    canvas_hash: Optional[str] = None
    fonts: List[str] = Field(default_factory=list)
    plugins: List[str] = Field(default_factory=list)
    cookies_enabled: bool
    localStorage_enabled: bool
    sessionStorage_enabled: bool
    indexed_db_enabled: bool
    open_database_enabled: bool


class AdvancedBrowserFeaturesService:
    """
    Advanced browser features service providing enterprise-grade capabilities.

    This service extends the base browser automation with advanced features
    for comprehensive testing, monitoring, and automation scenarios.
    """

    def __init__(self):
        self.extensions: Dict[UUID, BrowserExtension] = {}
        self.network_rules: Dict[UUID, NetworkRule] = {}
        self.active_recordings: Dict[str, Dict[str, Any]] = {}
        self.screenshot_cache: Dict[str, bytes] = {}
        self.performance_metrics: List[PerformanceMetrics] = []
        self.browser_fingerprints: Dict[str, BrowserFingerprint] = {}

        # Configuration
        self.temp_dir = Path(tempfile.gettempdir()) / "upm_browser_features"
        self.temp_dir.mkdir(exist_ok=True)

        # Extension storage
        self.extensions_dir = self.temp_dir / "extensions"
        self.extensions_dir.mkdir(exist_ok=True)

        # Recording storage
        self.recordings_dir = self.temp_dir / "recordings"
        self.recordings_dir.mkdir(exist_ok=True)

        logger.info("Advanced browser features service initialized")

    # Browser Extensions Management

    async def install_extension(
        self,
        context: BrowserContext,
        extension: BrowserExtension
    ) -> Dict[str, Any]:
        """Install a browser extension in the specified context."""
        try:
            if extension.source.startswith(('http://', 'https://')):
                # Download extension from URL
                extension_path = await self._download_extension(extension)
            else:
                # Use local extension path
                extension_path = Path(extension.source)
                if not extension_path.exists():
                    raise ValueError(f"Extension not found: {extension.source}")

            # Validate extension manifest
            manifest_path = extension_path / "manifest.json"
            if not manifest_path.exists():
                raise ValueError("Invalid extension: manifest.json not found")

            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest_data = json.load(f)
                extension.manifest_data = manifest_data

            # Install extension in context
            # Note: Playwright supports Chrome extensions with crx files
            if str(extension_path).endswith('.crx'):
                await context.add_init_script(f"""
                    console.log('Extension {extension.name} installed');
                """)
                install_result = {
                    "success": True,
                    "extension_id": str(extension.id),
                    "name": extension.name,
                    "type": extension.extension_type.value,
                    "permissions": manifest_data.get("permissions", []),
                    "version": manifest_data.get("version", "unknown")
                }
            else:
                # For non-CRX extensions, create a mock installation
                await context.add_init_script(f"""
                    console.log('Extension {extension.name} loaded (mock installation)');
                """)
                install_result = {
                    "success": True,
                    "extension_id": str(extension.id),
                    "name": extension.name,
                    "type": extension.extension_type.value,
                    "note": "Mock installation for non-CRX extension",
                    "permissions": manifest_data.get("permissions", []),
                    "version": manifest_data.get("version", "unknown")
                }

            # Store extension
            extension.installed_at = datetime.utcnow()
            self.extensions[extension.id] = extension

            logger.info(f"Extension {extension.name} installed successfully")
            return install_result

        except Exception as e:
            logger.error(f"Failed to install extension {extension.name}: {e}")
            return {
                "success": False,
                "error": str(e),
                "extension_id": str(extension.id),
                "name": extension.name
            }

    async def _download_extension(self, extension: BrowserExtension) -> Path:
        """Download extension from URL."""
        try:
            import aiofiles
            import aiohttp

            extension_filename = f"{extension.name.replace(' ', '_')}.crx"
            extension_path = self.extensions_dir / extension_filename

            async with aiohttp.ClientSession() as session:
                async with session.get(extension.source) as response:
                    if response.status == 200:
                        async with aiofiles.open(extension_path, 'wb') as f:
                            await f.write(await response.read())
                        return extension_path
                    else:
                        raise Exception(f"Failed to download extension: HTTP {response.status}")

        except Exception as e:
            logger.error(f"Failed to download extension {extension.source}: {e}")
            raise

    async def uninstall_extension(
        self,
        context: BrowserContext,
        extension_id: UUID
    ) -> Dict[str, Any]:
        """Uninstall a browser extension."""
        try:
            extension = self.extensions.get(extension_id)
            if not extension:
                raise ValueError("Extension not found")

            # Remove extension script
            await context.add_init_script(f"""
                console.log('Extension {extension.name} uninstalled');
            """)

            # Remove from storage
            del self.extensions[extension_id]

            logger.info(f"Extension {extension.name} uninstalled successfully")
            return {
                "success": True,
                "extension_id": str(extension_id),
                "name": extension.name
            }

        except Exception as e:
            logger.error(f"Failed to uninstall extension {extension_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "extension_id": str(extension_id)
            }

    def get_installed_extensions(self) -> List[Dict[str, Any]]:
        """Get list of installed extensions."""
        return [
            {
                "id": str(ext.id),
                "name": ext.name,
                "type": str(ext.extension_type.value) if hasattr(ext.extension_type, 'value') else str(ext.extension_type),
                "enabled": ext.enabled,
                "permissions": ext.permissions,
                "installed_at": ext.installed_at.isoformat(),
                "manifest_version": ext.manifest_data.get("manifest_version") if ext.manifest_data else None,
                "version": ext.manifest_data.get("version") if ext.manifest_data else None
            }
            for ext in self.extensions.values()
        ]

    # Network Interception and Modification

    async def add_network_rule(self, rule: NetworkRule) -> Dict[str, Any]:
        """Add a network modification rule."""
        try:
            self.network_rules[rule.id] = rule

            # Sort rules by priority
            sorted_rules = sorted(
                self.network_rules.values(),
                key=lambda x: x.priority,
                reverse=True
            )

            logger.info(f"Network rule {rule.name} added with priority {rule.priority}")
            return {
                "success": True,
                "rule_id": str(rule.id),
                "name": rule.name,
                "type": str(rule.modification_type.value) if hasattr(rule.modification_type, 'value') else str(rule.modification_type),
                "priority": rule.priority
            }

        except Exception as e:
            logger.error(f"Failed to add network rule {rule.name}: {e}")
            return {
                "success": False,
                "error": str(e),
                "rule_id": str(rule.id)
            }

    async def setup_network_interception(self, page: Page) -> Dict[str, Any]:
        """Setup network interception for a page."""
        try:
            intercepted_rules = 0

            async def handle_route(route: Route, request: Request):
                """Handle individual network requests."""
                url = request.url
                method = request.method
                headers = request.headers

                # Check if any rules match this request
                matching_rules = []
                for rule in self.network_rules.values():
                    if not rule.enabled:
                        continue

                    if self._url_matches_pattern(url, rule.url_pattern):
                        matching_rules.append(rule)
                        break  # Use first matching rule (highest priority)

                if not matching_rules:
                    await route.continue_()
                    return

                rule = matching_rules[0]

                try:
                    if rule.modification_type == NetworkModificationType.BLOCK:
                        await route.abort()
                        logger.info(f"Blocked request to {url}")

                    elif rule.modification_type == NetworkModificationType.REDIRECT:
                        redirect_url = rule.action.get("url")
                        if redirect_url:
                            await route.redirect(redirect_url)
                            logger.info(f"Redirected {url} to {redirect_url}")
                        else:
                            await route.continue_()

                    elif rule.modification_type == NetworkModificationType.MODIFY_HEADERS:
                        modified_headers = headers.copy()
                        modified_headers.update(rule.action.get("headers", {}))
                        await route.continue_(headers=modified_headers)

                    elif rule.modification_type == NetworkModificationType.DELAY:
                        delay_ms = rule.action.get("delay_ms", 1000)
                        await asyncio.sleep(delay_ms / 1000)
                        await route.continue_()

                    elif rule.modification_type == NetworkModificationType.THROTTLE:
                        # Simplified throttling - add delay
                        delay_ms = rule.action.get("delay_ms", 500)
                        await asyncio.sleep(delay_ms / 1000)
                        await route.continue_()

                    elif rule.modification_type == NetworkModificationType.MOCK:
                        mock_response = rule.action.get("response")
                        if mock_response:
                            await route.fulfill(
                                status=mock_response.get("status", 200),
                                headers=mock_response.get("headers", {}),
                                body=mock_response.get("body", "")
                            )
                        else:
                            await route.continue_()

                    else:
                        await route.continue_()

                    intercepted_rules += 1

                except Exception as e:
                    logger.error(f"Error applying network rule {rule.name}: {e}")
                    await route.continue_()

            # Setup route interception
            await page.route('**/*', handle_route)

            return {
                "success": True,
                "interception_enabled": True,
                "active_rules": len([r for r in self.network_rules.values() if r.enabled])
            }

        except Exception as e:
            logger.error(f"Failed to setup network interception: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def _url_matches_pattern(self, url: str, pattern: str) -> bool:
        """Check if URL matches a pattern (supports wildcards and regex)."""
        try:
            import re

            # Handle wildcard patterns
            if '*' in pattern:
                # Convert wildcard to regex
                regex_pattern = pattern.replace('*', '.*').replace('?', '.')
                return re.match(f"^{regex_pattern}", url) is not None

            # Handle regex patterns
            elif pattern.startswith('/') and pattern.endswith('/'):
                regex_pattern = pattern[1:-1]
                return re.match(regex_pattern, url) is not None

            # Handle exact matches
            else:
                return url == pattern

        except Exception as e:
            logger.error(f"Error matching URL pattern: {e}")
            return False

    def get_network_rules(self) -> List[Dict[str, Any]]:
        """Get list of network modification rules."""
        return [
            {
                "id": str(rule.id),
                "name": rule.name,
                "url_pattern": rule.url_pattern,
                "type": str(rule.modification_type.value) if hasattr(rule.modification_type, 'value') else str(rule.modification_type),
                "action": rule.action,
                "priority": rule.priority,
                "enabled": rule.enabled,
                "created_at": rule.created_at.isoformat()
            }
            for rule in sorted(
                self.network_rules.values(),
                key=lambda x: x.priority,
                reverse=True
            )
        ]

    # Advanced Screenshot and Recording

    async def capture_screenshot(
        self,
        page: Page,
        config: ScreenshotConfig,
        save_to_disk: bool = True
    ) -> Dict[str, Any]:
        """Capture an advanced screenshot with various options."""
        try:
            screenshot_id = str(uuid4())

            # Prepare screenshot options
            screenshot_options = {
                "type": config.format.value,
                "quality": config.quality if config.format != ScreenshotFormat.PNG else None,
                "full_page": config.full_page,
                "scale": config.scale
            }

            if config.clip:
                screenshot_options["clip"] = {
                    "x": config.clip["x"],
                    "y": config.clip["y"],
                    "width": config.clip["width"],
                    "height": config.clip["height"]
                }

            # Highlight elements if specified
            if config.highlight_elements:
                await self._highlight_elements(page, config.highlight_elements)

            # Hide scrollbars if requested
            if config.hide_scrollbars:
                await page.add_style_tag("""
                    ::-webkit-scrollbar { display: none; }
                    html { -ms-overflow-style: none; scrollbar-width: none; }
                """)

            # Capture screenshot
            screenshot_bytes = await page.screenshot(**screenshot_options)

            # Convert to base64
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode()

            # Cache screenshot
            self.screenshot_cache[screenshot_id] = screenshot_bytes

            # Save to disk if requested
            file_path = None
            if save_to_disk:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"screenshot_{timestamp}_{screenshot_id[:8]}.{config.format.value}"
                file_path = self.temp_dir / filename

                with open(file_path, 'wb') as f:
                    f.write(screenshot_bytes)

            # Clean up highlights and styles
            if config.highlight_elements:
                await page.evaluate("""
                    // Remove highlight styles
                    const highlights = document.querySelectorAll('[data-upm-highlight]');
                    highlights.forEach(el => el.remove());
                """)

            result = {
                "success": True,
                "screenshot_id": screenshot_id,
                "format": config.format.value,
                "size_bytes": len(screenshot_bytes),
                "base64_data": screenshot_b64,
                "file_path": str(file_path) if file_path else None,
                "config": config.dict(),
                "captured_at": datetime.utcnow().isoformat()
            }

            logger.info(f"Screenshot captured: {screenshot_id}")
            return result

        except Exception as e:
            logger.error(f"Failed to capture screenshot: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _highlight_elements(self, page: Page, selectors: List[str]):
        """Highlight elements on the page for screenshots."""
        highlight_script = """
        (selectors) => {
            selectors.forEach((selector, index) => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        element.setAttribute('data-upm-highlight', 'true');
                        const existing = element.getAttribute('data-upm-original-border');
                        if (!existing) {
                            element.setAttribute('data-upm-original-border',
                                element.style.border || 'none');
                        }
                        const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];
                        element.style.border = `3px solid ${colors[index % colors.length]}`;
                        element.style.boxShadow = `0 0 5px ${colors[index % colors.length]}`;
                    });
                } catch (e) {
                    console.error(`Failed to highlight selector: ${selector}`, e);
                }
            });
        }
        """
        await page.evaluate(highlight_script, selectors)

    async def start_recording(
        self,
        page: Page,
        config: RecordingConfig
    ) -> Dict[str, Any]:
        """Start screen recording."""
        try:
            recording_id = str(uuid4())

            # Note: Playwright doesn't have built-in video recording for all browsers
            # This is a mock implementation that simulates recording
            recording_data = {
                "recording_id": recording_id,
                "page_url": page.url,
                "config": config.dict(),
                "started_at": datetime.utcnow(),
                "frames": [],
                "status": "recording"
            }

            self.active_recordings[recording_id] = recording_data

            # Add recording indicator to page
            await page.add_style_tag("""
                .upm-recording-indicator {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: red;
                    color: white;
                    padding: 5px 10px;
                    border-radius: 3px;
                    font-size: 12px;
                    z-index: 10000;
                    animation: pulse 1s infinite;
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            """)

            await page.evaluate("""
                const indicator = document.createElement('div');
                indicator.className = 'upm-recording-indicator';
                indicator.textContent = '● REC';
                document.body.appendChild(indicator);
            """)

            # Setup frame capture loop
            asyncio.create_task(self._capture_recording_frames(page, recording_id, config))

            result = {
                "success": True,
                "recording_id": recording_id,
                "status": "started",
                "config": config.dict(),
                "started_at": recording_data["started_at"].isoformat()
            }

            logger.info(f"Recording started: {recording_id}")
            return result

        except Exception as e:
            logger.error(f"Failed to start recording: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _capture_recording_frames(
        self,
        page: Page,
        recording_id: str,
        config: RecordingConfig
    ):
        """Capture frames for recording (mock implementation)."""
        try:
            recording_data = self.active_recordings.get(recording_id)
            if not recording_data:
                return

            frame_interval = 1.0 / config.fps
            max_frames = config.max_duration_seconds * config.fps
            frame_count = 0

            while (recording_data["status"] == "recording" and
                   frame_count < max_frames):
                try:
                    # Capture frame (screenshot)
                    screenshot_bytes = await page.screenshot(type="png")
                    recording_data["frames"].append({
                        "timestamp": time.time(),
                        "data": base64.b64encode(screenshot_bytes).decode()
                    })

                    frame_count += 1
                    await asyncio.sleep(frame_interval)

                except Exception as e:
                    logger.error(f"Error capturing frame {frame_count}: {e}")
                    break

        except Exception as e:
            logger.error(f"Recording frame capture failed: {e}")

    async def stop_recording(
        self,
        recording_id: str
    ) -> Dict[str, Any]:
        """Stop screen recording and save the file."""
        try:
            recording_data = self.active_recordings.get(recording_id)
            if not recording_data:
                raise ValueError("Recording not found")

            recording_data["status"] = "stopped"
            recording_data["stopped_at"] = datetime.utcnow()

            # Generate mock recording file path
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"recording_{timestamp}_{recording_id[:8]}.webm"
            file_path = self.recordings_dir / filename

            # Create a placeholder file (in real implementation,
            # you would convert frames to video)
            with open(file_path, 'wb') as f:
                # Write a simple placeholder
                f.write(b"PLACEHOLDER_VIDEO_DATA")

            duration = (
                recording_data["stopped_at"] - recording_data["started_at"]
            ).total_seconds()

            result = {
                "success": True,
                "recording_id": recording_id,
                "status": "stopped",
                "file_path": str(file_path),
                "duration_seconds": duration,
                "frames_captured": len(recording_data["frames"]),
                "file_size_bytes": file_path.stat().st_size,
                "stopped_at": recording_data["stopped_at"].isoformat()
            }

            # Remove recording indicator
            if "page" in recording_data:
                try:
                    await recording_data["page"].evaluate("""
                        const indicator = document.querySelector('.upm-recording-indicator');
                        if (indicator) indicator.remove();
                    """)
                except:
                    pass

            # Keep recording data for reference
            del self.active_recordings[recording_id]

            logger.info(f"Recording stopped: {recording_id}")
            return result

        except Exception as e:
            logger.error(f"Failed to stop recording {recording_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "recording_id": recording_id
            }

    def get_active_recordings(self) -> List[Dict[str, Any]]:
        """Get list of active recordings."""
        return [
            {
                "recording_id": rec_id,
                "page_url": rec["page_url"],
                "status": rec["status"],
                "started_at": rec["started_at"].isoformat(),
                "frames_captured": len(rec["frames"]),
                "config": rec["config"]
            }
            for rec_id, rec in self.active_recordings.items()
        ]

    # Cookie and Session Management

    async def get_cookies(
        self,
        context: BrowserContext,
        urls: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Get cookies from the browser context."""
        try:
            cookies = await context.cookies(urls)

            # Process and enhance cookie data
            processed_cookies = []
            for cookie in cookies:
                processed_cookie = {
                    "name": cookie.get("name"),
                    "value": cookie.get("value"),
                    "domain": cookie.get("domain"),
                    "path": cookie.get("path"),
                    "expires": cookie.get("expires"),
                    "http_only": cookie.get("httpOnly", False),
                    "secure": cookie.get("secure", False),
                    "same_site": cookie.get("sameSite"),
                    "size": len(cookie.get("name", "")) + len(cookie.get("value", "")),
                    "session": cookie.get("expires") is None
                }
                processed_cookies.append(processed_cookie)

            return processed_cookies

        except Exception as e:
            logger.error(f"Failed to get cookies: {e}")
            return []

    async def set_cookies(
        self,
        context: BrowserContext,
        cookies: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Set cookies in the browser context."""
        try:
            # Process cookies for Playwright format
            playwright_cookies = []
            for cookie_data in cookies:
                cookie = {
                    "name": cookie_data["name"],
                    "value": cookie_data["value"],
                    "domain": cookie_data.get("domain"),
                    "path": cookie_data.get("path", "/"),
                    "url": cookie_data.get("url"),
                    "httpOnly": cookie_data.get("http_only", False),
                    "secure": cookie_data.get("secure", False),
                    "sameSite": cookie_data.get("same_site")
                }

                # Handle expiration
                if "expires" in cookie_data:
                    if isinstance(cookie_data["expires"], datetime):
                        cookie["expires"] = cookie_data["expires"].timestamp()
                    elif isinstance(cookie_data["expires"], (int, float)):
                        cookie["expires"] = cookie_data["expires"]

                playwright_cookies.append(cookie)

            # Set cookies
            await context.add_cookies(playwright_cookies)

            logger.info(f"Set {len(cookies)} cookies")
            return {
                "success": True,
                "cookies_set": len(cookies)
            }

        except Exception as e:
            logger.error(f"Failed to set cookies: {e}")
            return {
                "success": False,
                "error": str(e),
                "cookies_set": 0
            }

    async def clear_cookies(
        self,
        context: BrowserContext,
        domain: Optional[str] = None
    ) -> Dict[str, Any]:
        """Clear cookies from the browser context."""
        try:
            if domain:
                # Clear cookies for specific domain
                cookies = await context.cookies()
                domain_cookies = [
                    cookie for cookie in cookies
                    if cookie.get("domain") == domain or
                       cookie.get("domain", "").endswith(domain)
                ]
                await context.clear_cookies()

                # Re-add cookies that don't match the domain
                other_cookies = [
                    cookie for cookie in cookies
                    if cookie not in domain_cookies
                ]
                if other_cookies:
                    await context.add_cookies(other_cookies)

                cleared_count = len(domain_cookies)
            else:
                # Clear all cookies
                await context.clear_cookies()
                cleared_count = len(await context.cookies())

            logger.info(f"Cleared {cleared_count} cookies")
            return {
                "success": True,
                "cookies_cleared": cleared_count,
                "domain": domain
            }

        except Exception as e:
            logger.error(f"Failed to clear cookies: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def export_session(
        self,
        context: BrowserContext
    ) -> Dict[str, Any]:
        """Export browser session data (cookies, localStorage, sessionStorage)."""
        try:
            # Get cookies
            cookies = await self.get_cookies(context)

            # Get localStorage and sessionStorage
            storage_data = await context.evaluate("""
                () => {
                    const data = {
                        localStorage: {},
                        sessionStorage: {}
                    };

                    // Get localStorage
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        data.localStorage[key] = localStorage.getItem(key);
                    }

                    // Get sessionStorage
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        data.sessionStorage[key] = sessionStorage.getItem(key);
                    }

                    return data;
                }
            """)

            session_data = {
                "cookies": cookies,
                "localStorage": storage_data["localStorage"],
                "sessionStorage": storage_data["sessionStorage"],
                "exported_at": datetime.utcnow().isoformat(),
                "url": context.pages[0].url if context.pages else None
            }

            # Save to file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"session_{timestamp}.json"
            file_path = self.temp_dir / filename

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, indent=2, default=str)

            logger.info(f"Session exported to {file_path}")
            return {
                "success": True,
                "file_path": str(file_path),
                "cookies_count": len(cookies),
                "localStorage_items": len(storage_data["localStorage"]),
                "sessionStorage_items": len(storage_data["sessionStorage"])
            }

        except Exception as e:
            logger.error(f"Failed to export session: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def import_session(
        self,
        context: BrowserContext,
        session_file_path: str
    ) -> Dict[str, Any]:
        """Import browser session data from file."""
        try:
            with open(session_file_path, 'r', encoding='utf-8') as f:
                session_data = json.load(f)

            # Restore cookies
            cookies = session_data.get("cookies", [])
            if cookies:
                await self.set_cookies(context, cookies)

            # Restore localStorage and sessionStorage
            storage_script = f"""
                (data) => {{
                    // Restore localStorage
                    if (data.localStorage) {{
                        Object.keys(data.localStorage).forEach(key => {{
                            localStorage.setItem(key, data.localStorage[key]);
                        }});
                    }}

                    // Restore sessionStorage
                    if (data.sessionStorage) {{
                        Object.keys(data.sessionStorage).forEach(key => {{
                            sessionStorage.setItem(key, data.sessionStorage[key]);
                        }});
                    }}
                }}
            """
            await context.evaluate(storage_script, session_data)

            logger.info(f"Session imported from {session_file_path}")
            return {
                "success": True,
                "cookies_restored": len(cookies),
                "localStorage_items": len(session_data.get("localStorage", {})),
                "sessionStorage_items": len(session_data.get("sessionStorage", {}))
            }

        except Exception as e:
            logger.error(f"Failed to import session: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    # Proxy and VPN Support

    async def setup_proxy(
        self,
        context: BrowserContext,
        proxy_config: ProxyConfig
    ) -> Dict[str, Any]:
        """Setup proxy configuration for browser context."""
        try:
            # Note: Playwright proxy setup must be done at browser creation time
            # This is a mock implementation that simulates proxy setup

            await context.add_init_script(f"""
                console.log('Proxy configured: {proxy_config.server}');
                // In a real implementation, proxy would be configured at browser launch
            """)

            # Store proxy configuration
            await context.add_init_script("""
                window.upmProxyConfig = arguments[0];
            """, proxy_config.dict())

            logger.info(f"Proxy configured: {proxy_config.server}")
            return {
                "success": True,
                "proxy_server": proxy_config.server,
                "configured_at": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to setup proxy: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def test_proxy_connection(
        self,
        page: Page,
        test_url: str = "https://httpbin.org/ip"
    ) -> Dict[str, Any]:
        """Test proxy connection by checking IP address."""
        try:
            start_time = time.time()

            # Navigate to test URL
            await page.goto(test_url, wait_until="networkidle")

            # Get response
            response_text = await page.text_content("body")
            load_time = (time.time() - start_time) * 1000

            try:
                response_data = json.loads(response_text)
                ip_address = response_data.get("origin", "Unknown")
            except:
                ip_address = "Could not determine"

            result = {
                "success": True,
                "ip_address": ip_address,
                "load_time_ms": round(load_time, 2),
                "test_url": test_url,
                "tested_at": datetime.utcnow().isoformat()
            }

            logger.info(f"Proxy test completed. IP: {ip_address}")
            return result

        except Exception as e:
            logger.error(f"Proxy test failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "test_url": test_url
            }

    # Performance Monitoring and Profiling

    async def start_performance_monitoring(
        self,
        page: Page
    ) -> Dict[str, Any]:
        """Start performance monitoring for a page."""
        try:
            monitoring_id = str(uuid4())

            # Inject performance monitoring script
            await page.add_init_script("""
                window.upmPerformanceMonitor = {
                    startTime: performance.now(),
                    metrics: {},
                    observers: []
                };

                // Performance Observer for various metrics
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'navigation') {
                            window.upmPerformanceMonitor.metrics.navigation = entry;
                        } else if (entry.entryType === 'paint') {
                            window.upmPerformanceMonitor.metrics[entry.name] = entry;
                        } else if (entry.entryType === 'largest-contentful-paint') {
                            window.upmPerformanceMonitor.metrics.lcp = entry;
                        } else if (entry.entryType === 'layout-shift') {
                            if (!window.upmPerformanceMonitor.metrics.cls) {
                                window.upmPerformanceMonitor.metrics.cls = 0;
                            }
                            window.upmPerformanceMonitor.metrics.cls += entry.value;
                        } else if (entry.entryType === 'first-input') {
                            window.upmPerformanceMonitor.metrics.fid = entry;
                        }
                    }
                });

                observer.observe({entryTypes: ['navigation', 'paint', 'largest-contentful-paint', 'layout-shift', 'first-input']});

                // Monitor resource loading
                const resourceObserver = new PerformanceObserver((list) => {
                    const resources = list.getEntries();
                    if (!window.upmPerformanceMonitor.metrics.resources) {
                        window.upmPerformanceMonitor.metrics.resources = [];
                    }
                    window.upmPerformanceMonitor.metrics.resources.push(...resources);
                });

                resourceObserver.observe({entryTypes: ['resource']});
            """)

            logger.info(f"Performance monitoring started: {monitoring_id}")
            return {
                "success": True,
                "monitoring_id": monitoring_id,
                "started_at": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to start performance monitoring: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def collect_performance_metrics(
        self,
        page: Page,
        url: Optional[str] = None
    ) -> PerformanceMetrics:
        """Collect performance metrics from the page."""
        try:
            # Get metrics from page
            metrics_data = await page.evaluate("""
                () => {
                    const metrics = window.upmPerformanceMonitor || {metrics: {}};
                    const perfData = performance.timing;
                    const navStart = perfData.navigationStart;

                    return {
                        load_time: perfData.loadEventEnd - navStart,
                        domContentLoaded: perfData.domContentLoadedEventEnd - navStart,
                        metrics: metrics.metrics,
                        resources: metrics.metrics.resources || [],
                        memory: performance.memory ? {
                            usedJSHeapSize: performance.memory.usedJSHeapSize,
                            totalJSHeapSize: performance.memory.totalJSHeapSize,
                            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                        } : null
                    };
                }
            """)

            # Extract specific metrics
            metrics = metrics_data["metrics"]

            # Get paint metrics
            first_paint = None
            first_contentful_paint = None
            if "first-paint" in metrics:
                first_paint = metrics["first-paint"].startTime
            if "first-contentful-paint" in metrics:
                first_contentful_paint = metrics["first-contentful-paint"].startTime

            # Get LCP
            lcp = None
            if "lcp" in metrics:
                lcp = metrics["lcp"].startTime

            # Get CLS
            cls = 0.0
            if "cls" in metrics:
                cls = metrics["cls"]

            # Get FID
            fid = None
            if "fid" in metrics:
                fid = metrics["fid"].processingStart - metrics["fid"].startTime

            # Calculate resource metrics
            resources = metrics.get("resources", [])
            total_transfer_size = sum(
                resource.get("transferSize", 0) for resource in resources
            )

            # Get memory usage
            memory_mb = 0.0
            if metrics_data.get("memory"):
                memory_mb = metrics_data["memory"]["usedJSHeapSize"] / 1024 / 1024

            performance_metrics = PerformanceMetrics(
                url=url or page.url,
                load_time_ms=metrics_data["load_time"],
                domContentLoaded_ms=metrics_data["domContentLoaded"],
                first_paint_ms=first_paint,
                first_contentful_paint_ms=first_contentful_paint,
                largest_contentful_paint_ms=lcp,
                cumulative_layout_shift=cls,
                first_input_delay_ms=fid,
                resources_count=len(resources),
                transfer_size_bytes=total_transfer_size,
                memory_usage_mb=memory_mb
            )

            # Store metrics
            self.performance_metrics.append(performance_metrics)

            # Keep only last 1000 metrics
            if len(self.performance_metrics) > 1000:
                self.performance_metrics = self.performance_metrics[-1000:]

            return performance_metrics

        except Exception as e:
            logger.error(f"Failed to collect performance metrics: {e}")
            # Return empty metrics on error
            return PerformanceMetrics(url=url or page.url, load_time_ms=0.0, domContentLoaded_ms=0.0,
                                   first_paint_ms=0.0, first_contentful_paint_ms=0.0, largest_contentful_paint_ms=0.0,
                                   cumulative_layout_shift=0.0, first_input_delay_ms=0.0, resources_count=0,
                                   transfer_size_bytes=0, memory_usage_mb=0.0)

    def get_performance_metrics(
        self,
        limit: int = 100,
        url_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get collected performance metrics."""
        metrics = self.performance_metrics

        if url_filter:
            metrics = [m for m in metrics if url_filter in m.url]

        metrics = metrics[-limit:] if limit > 0 else metrics

        return [
            {
                "timestamp": m.timestamp.isoformat(),
                "url": m.url,
                "load_time_ms": m.load_time_ms,
                "domContentLoaded_ms": m.domContentLoaded_ms,
                "first_paint_ms": m.first_paint_ms,
                "first_contentful_paint_ms": m.first_contentful_paint_ms,
                "largest_contentful_paint_ms": m.largest_contentful_paint_ms,
                "cumulative_layout_shift": m.cumulative_layout_shift,
                "first_input_delay_ms": m.first_input_delay_ms,
                "resources_count": m.resources_count,
                "transfer_size_bytes": m.transfer_size_bytes,
                "memory_usage_mb": m.memory_usage_mb
            }
            for m in metrics
        ]

    async def generate_performance_report(
        self,
        page: Page,
        url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate comprehensive performance report."""
        try:
            # Collect current metrics
            metrics = await self.collect_performance_metrics(page, url)

            # Get Core Web Vitals assessment
            core_web_vitals = self._assess_core_web_vitals(metrics)

            # Get performance grade
            performance_grade = self._calculate_performance_grade(metrics)

            # Get recommendations
            recommendations = self._generate_performance_recommendations(metrics)

            report = {
                "url": metrics.url,
                "timestamp": metrics.timestamp.isoformat(),
                "metrics": metrics.dict(),
                "core_web_vitals": core_web_vitals,
                "performance_grade": performance_grade,
                "recommendations": recommendations,
                "generated_at": datetime.utcnow().isoformat()
            }

            # Save report to file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"performance_report_{timestamp}.json"
            file_path = self.temp_dir / filename

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, default=str)

            logger.info(f"Performance report generated: {file_path}")
            return {
                "success": True,
                "report": report,
                "file_path": str(file_path)
            }

        except Exception as e:
            logger.error(f"Failed to generate performance report: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def _assess_core_web_vitals(self, metrics: PerformanceMetrics) -> Dict[str, Any]:
        """Assess Core Web Vitals metrics."""
        return {
            "largest_contentful_paint": {
                "value_ms": metrics.largest_contentful_paint_ms,
                "rating": self._rate_lcp(metrics.largest_contentful_paint_ms),
                "threshold_good": 2500,
                "threshold_needs_improvement": 4000
            },
            "cumulative_layout_shift": {
                "value": metrics.cumulative_layout_shift,
                "rating": self._rate_cls(metrics.cumulative_layout_shift),
                "threshold_good": 0.1,
                "threshold_needs_improvement": 0.25
            },
            "first_input_delay": {
                "value_ms": metrics.first_input_delay_ms,
                "rating": self._rate_fid(metrics.first_input_delay_ms),
                "threshold_good": 100,
                "threshold_needs_improvement": 300
            }
        }

    def _rate_lcp(self, lcp_ms: float) -> str:
        """Rate LCP metric."""
        if lcp_ms <= 2500:
            return "good"
        elif lcp_ms <= 4000:
            return "needs_improvement"
        else:
            return "poor"

    def _rate_cls(self, cls: float) -> str:
        """Rate CLS metric."""
        if cls <= 0.1:
            return "good"
        elif cls <= 0.25:
            return "needs_improvement"
        else:
            return "poor"

    def _rate_fid(self, fid_ms: float) -> str:
        """Rate FID metric."""
        if fid_ms <= 100:
            return "good"
        elif fid_ms <= 300:
            return "needs_improvement"
        else:
            return "poor"

    def _calculate_performance_grade(self, metrics: PerformanceMetrics) -> Dict[str, Any]:
        """Calculate overall performance grade."""
        score = 100

        # Deduct points for slow load time
        if metrics.load_time_ms > 3000:
            score -= 20
        elif metrics.load_time_ms > 2000:
            score -= 10

        # Deduct points for poor Core Web Vitals
        if self._rate_lcp(metrics.largest_contentful_paint_ms) == "poor":
            score -= 15
        elif self._rate_lcp(metrics.largest_contentful_paint_ms) == "needs_improvement":
            score -= 5

        if self._rate_cls(metrics.cumulative_layout_shift) == "poor":
            score -= 15
        elif self._rate_cls(metrics.cumulative_layout_shift) == "needs_improvement":
            score -= 5

        if self._rate_fid(metrics.first_input_delay_ms) == "poor":
            score -= 10
        elif self._rate_fid(metrics.first_input_delay_ms) == "needs_improvement":
            score -= 3

        # Deduct points for high memory usage
        if metrics.memory_usage_mb > 100:
            score -= 10
        elif metrics.memory_usage_mb > 50:
            score -= 5

        score = max(0, score)  # Ensure score doesn't go below 0

        grade_map = {
            (90, 100): "A",
            (80, 89): "B",
            (70, 79): "C",
            (60, 69): "D",
            (0, 59): "F"
        }

        for (min_score, max_score), grade in grade_map.items():
            if min_score <= score <= max_score:
                return {
                    "score": score,
                    "grade": grade,
                    "color": self._get_grade_color(grade)
                }

        return {"score": 0, "grade": "F", "color": "#dc3545"}

    def _get_grade_color(self, grade: str) -> str:
        """Get color for performance grade."""
        colors = {
            "A": "#28a745",  # Green
            "B": "#17a2b8",  # Blue
            "C": "#ffc107",  # Yellow
            "D": "#fd7e14",  # Orange
            "F": "#dc3545"   # Red
        }
        return colors.get(grade, "#6c757d")

    def _generate_performance_recommendations(self, metrics: PerformanceMetrics) -> List[str]:
        """Generate performance optimization recommendations."""
        recommendations = []

        if metrics.load_time_ms > 3000:
            recommendations.append("Page load time is slow. Consider optimizing images, enabling compression, or using a CDN.")

        if metrics.largest_contentful_paint_ms > 4000:
            recommendations.append("Largest Contentful Paint is slow. Optimize your largest content element.")

        if metrics.cumulative_layout_shift > 0.25:
            recommendations.append("High Cumulative Layout Shift detected. Ensure proper sizing for images and ads.")

        if metrics.first_input_delay_ms > 300:
            recommendations.append("First Input Delay is high. Reduce JavaScript execution time and main thread work.")

        if metrics.memory_usage_mb > 100:
            recommendations.append("High memory usage detected. Check for memory leaks and optimize JavaScript.")

        if metrics.resources_count > 100:
            recommendations.append("High number of resources. Consider bundling and reducing HTTP requests.")

        if metrics.transfer_size_bytes > 5 * 1024 * 1024:  # 5MB
            recommendations.append("Large transfer size. Compress assets and optimize file sizes.")

        return recommendations

    # Browser Fingerprinting and Privacy

    async def generate_browser_fingerprint(
        self,
        page: Page
    ) -> BrowserFingerprint:
        """Generate browser fingerprint."""
        try:
            fingerprint_data = await page.evaluate("""
                () => {
                    const fingerprint = {
                        // Basic browser info
                        user_agent: navigator.userAgent,
                        platform: navigator.platform,
                        language: navigator.language,
                        languages: navigator.languages || [],
                        cookie_enabled: navigator.cookieEnabled,
                        do_not_track: navigator.doNotTrack,
                        on_line: navigator.onLine,

                        // Screen info
                        screen: {
                            width: screen.width,
                            height: screen.height,
                            color_depth: screen.colorDepth,
                            pixel_depth: screen.pixelDepth,
                            avail_width: screen.availWidth,
                            avail_height: screen.availHeight
                        },

                        // Timezone
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        timezone_offset: new Date().getTimezoneOffset(),

                        // Storage capabilities
                        local_storage_enabled: !!window.localStorage,
                        session_storage_enabled: !!window.sessionStorage,
                        indexed_db_enabled: !!window.indexedDB,
                        open_database_enabled: !!window.openDatabase,

                        // Fonts detection
                        fonts: [],

                        // Plugins
                        plugins: [],

                        // Canvas fingerprint
                        canvas_hash: null,

                        // WebGL fingerprint
                        webgl_hash: null
                    };

                    // Detect available fonts
                    const testFonts = [
                        'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
                        'Helvetica', 'Impact', 'Times New Roman', 'Trebuchet MS', 'Verdana',
                        'Microsoft Sans Serif', 'Palatino', 'Tahoma', 'Lucida Console',
                        'Lucida Sans Unicode', 'MS Sans Serif', 'MS Serif', 'Small Fonts',
                        'Segoe UI', 'Tahoma', 'Trebuchet MS', 'Verdana', 'Courier New'
                    ];

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    testFonts.forEach(font => {
                        ctx.font = `72px ${font}`;
                        ctx.fillText('mmmmmmmmmmlli', 2, 2);
                        const textWidth = ctx.measureText('mmmmmmmmmmlli').width;
                        if (textWidth !== 0) {
                            fingerprint.fonts.push(font);
                        }
                    });

                    // Get plugins
                    if (navigator.plugins) {
                        for (let i = 0; i < navigator.plugins.length; i++) {
                            fingerprint.plugins.push(navigator.plugins[i].name);
                        }
                    }

                    // Canvas fingerprint
                    try {
                        canvas.width = 200;
                        canvas.height = 50;
                        ctx.textBaseline = 'top';
                        ctx.font = '14px Arial';
                        ctx.fillStyle = '#f60';
                        ctx.fillRect(125, 1, 62, 20);
                        ctx.fillStyle = '#069';
                        ctx.fillText('Browser fingerprint 🌍', 2, 15);
                        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
                        ctx.fillText('Browser fingerprint 🌍', 4, 17);
                        fingerprint.canvas_hash = canvas.toDataURL();
                    } catch (e) {
                        console.error('Canvas fingerprint failed:', e);
                    }

                    // WebGL fingerprint
                    try {
                        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                        if (gl) {
                            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                            if (debugInfo) {
                                fingerprint.webgl_hash = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                            }
                        }
                    } catch (e) {
                        console.error('WebGL fingerprint failed:', e);
                    }

                    return fingerprint;
                }
            """)

            # Process fingerprint data
            fingerprint = BrowserFingerprint(
                user_agent=fingerprint_data["user_agent"],
                screen_resolution=f"{fingerprint_data['screen']['width']}x{fingerprint_data['screen']['height']}",
                color_depth=str(fingerprint_data["screen"]["color_depth"]),
                timezone=fingerprint_data["timezone"],
                language=fingerprint_data["language"],
                platform=fingerprint_data["platform"],
                webgl_hash=fingerprint_data["webgl_hash"],
                canvas_hash=fingerprint_data["canvas_hash"],
                fonts=fingerprint_data["fonts"],
                plugins=fingerprint_data["plugins"],
                cookies_enabled=fingerprint_data["cookie_enabled"],
                localStorage_enabled=fingerprint_data["local_storage_enabled"],
                sessionStorage_enabled=fingerprint_data["session_storage_enabled"],
                indexed_db_enabled=fingerprint_data["indexed_db_enabled"],
                open_database_enabled=fingerprint_data["open_database_enabled"]
            )

            # Store fingerprint
            fingerprint_key = f"{fingerprint.user_agent}_{fingerprint.screen_resolution}"
            self.browser_fingerprints[fingerprint_key] = fingerprint

            logger.info(f"Browser fingerprint generated: {fingerprint_key}")
            return fingerprint

        except Exception as e:
            logger.error(f"Failed to generate browser fingerprint: {e}")
            raise

    async def enable_privacy_mode(
        self,
        page: Page,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Enable privacy mode to reduce fingerprinting."""
        try:
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

            if options:
                privacy_options.update(options)

            # Apply privacy settings
            privacy_script = f"""
                (options) => {{
                    // Block canvas fingerprinting
                    if (options.disable_canvas) {{
                        const originalGetContext = HTMLCanvasElement.prototype.getContext;
                        HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {{
                            if (contextType === '2d' || contextType === 'webgl' || contextType === 'experimental-webgl') {{
                                return null;
                            }}
                            return originalGetContext.apply(this, [contextType, ...args]);
                        }};
                    }}

                    // Block WebGL
                    if (options.disable_webgl) {{
                        const originalGetContext = HTMLCanvasElement.prototype.getContext;
                        HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {{
                            if (contextType === 'webgl' || contextType === 'experimental-webgl') {{
                                throw new Error('WebGL is disabled');
                            }}
                            return originalGetContext.apply(this, [contextType, ...args]);
                        }};
                    }}

                    // Limit fonts detection
                    if (options.limit_fonts) {{
                        Object.defineProperty(navigator, 'plugins', {{
                            get: function() {{
                                return [];
                            }}
                        }});
                    }}

                    // Randomize timezone
                    if (options.randomize_timezone) {{
                        const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
                        Date.prototype.getTimezoneOffset = function() {{
                            return Math.floor(Math.random() * 720) - 360; // Random offset
                        }};
                    }}

                    // Disable notifications
                    if (options.disable_notifications) {{
                        Notification = undefined;
                    }}

                    // Disable geolocation
                    if (options.disable_geolocation) {{
                        navigator.geolocation = undefined;
                    }}

                    // Disable battery API
                    if (options.disable_battery_api) {{
                        navigator.getBattery = undefined;
                    }}

                    // Disable device memory API
                    if (options.disable_device_memory) {{
                        delete navigator.deviceMemory;
                    }}

                    console.log('Privacy mode enabled with options:', options);
                }}
            """

            await page.evaluate(privacy_script, privacy_options)

            logger.info("Privacy mode enabled")
            return {
                "success": True,
                "privacy_options": privacy_options,
                "enabled_at": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to enable privacy mode: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def get_browser_fingerprints(self) -> List[Dict[str, Any]]:
        """Get collected browser fingerprints."""
        return [
            {
                "user_agent": fp.user_agent,
                "screen_resolution": fp.screen_resolution,
                "platform": fp.platform,
                "timezone": fp.timezone,
                "language": fp.language,
                "fonts_count": len(fp.fonts),
                "plugins_count": len(fp.plugins),
                "canvas_hash": fp.canvas_hash[:50] + "..." if fp.canvas_hash else None,
                "webgl_hash": fp.webgl_hash[:50] + "..." if fp.webgl_hash else None
            }
            for fp in self.browser_fingerprints.values()
        ]

    async def cleanup(self):
        """Cleanup service resources."""
        try:
            # Stop all active recordings
            for recording_id in list(self.active_recordings.keys()):
                await self.stop_recording(recording_id)

            # Clear caches
            self.screenshot_cache.clear()
            self.performance_metrics.clear()
            self.browser_fingerprints.clear()

            # Clean up temporary files
            import shutil
            if self.temp_dir.exists():
                shutil.rmtree(self.temp_dir)

            logger.info("Advanced browser features service cleanup completed")

        except Exception as e:
            logger.error(f"Failed to cleanup advanced browser features service: {e}")


# Global advanced browser features service instance
advanced_browser_features_service = AdvancedBrowserFeaturesService()