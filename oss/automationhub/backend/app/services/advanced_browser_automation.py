"""
Advanced Browser Automation Service

Provides advanced browser automation capabilities including file handling,
geolocation spoofing, user agent management, stealth mode, and advanced interactions.
"""

import asyncio
import json
import logging
import random
import time
import uuid
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
import hashlib

from playwright.async_api import Page, BrowserContext, Browser, Locator, Keyboard, Mouse, Touchscreen
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from app.services.browser_manager import BrowserManager
from app.services.visual_testing import VisualTestingService, VisualTestConfig, VisualTestType
from app.services.captcha_solver import CaptchaSolverService, CaptchaConfig, CaptchaResult
from app.services.network_simulation import NetworkSimulationService, NetworkCondition, NetworkProfile
from app.models.browser import BrowserConfig

logger = logging.getLogger(__name__)


class AutomationMode(str, Enum):
    NORMAL = "normal"
    STEALTH = "stealth"
    HEADLESS = "headless"
    HUMAN = "human"  # Human-like behavior simulation
    ROBOT = "robot"  # Fast, automated behavior


class FileType(str, Enum):
    PDF = "pdf"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    ARCHIVE = "archive"
    SPREADSHEET = "spreadsheet"
    PRESENTATION = "presentation"
    UNKNOWN = "unknown"


@dataclass
class GeolocationConfig:
    """Geolocation configuration"""
    latitude: float
    longitude: float
    accuracy: Optional[float] = 100.0
    altitude: Optional[float] = None
    altitude_accuracy: Optional[float] = None
    heading: Optional[float] = None
    speed: Optional[float] = None


@dataclass
class UserAgentConfig:
    """User agent configuration"""
    user_agent: str
    viewport_width: int = 1920
    viewport_height: int = 1080
    device_scale_factor: float = 1.0
    is_mobile: bool = False
    has_touch: bool = True
    locale: str = "en-US"
    timezone_id: str = "America/New_York"


@dataclass
class FileOperationConfig:
    """Configuration for file operations"""
    download_dir: str = "downloads"
    upload_dir: str = "uploads"
    allowed_extensions: List[str] = field(default_factory=lambda: [
        ".pdf", ".jpg", ".png", ".gif", ".doc", ".docx", ".xls", ".xlsx", ".zip"
    ])
    max_file_size_mb: int = 100
    auto_cleanup_days: int = 7
    virus_scan: bool = False


@dataclass
class HumanBehaviorConfig:
    """Configuration for human-like behavior simulation"""
    typing_speed_wpm: int = 60  # Words per minute
    typing_variance: float = 0.3  # Variance in typing speed
    mouse_movement_speed: str = "normal"  # slow, normal, fast
    click_delay_range: Tuple[float, float] = (0.1, 0.5)  # Min/max delay between clicks
    scroll_behavior: str = "smooth"  # smooth, instant, stepped
    reading_speed_wpm: int = 200  # Reading speed for page analysis
    random_delays: bool = True
    micro movements: bool = True  # Small mouse movements between actions


@dataclass
class AdvancedInteractionConfig:
    """Configuration for advanced interactions"""
    automation_mode: AutomationMode = AutomationMode.NORMAL
    geolocation: Optional[GeolocationConfig] = None
    user_agent: Optional[UserAgentConfig] = None
    file_operations: Optional[FileOperationConfig] = None
    human_behavior: Optional[HumanBehaviorConfig] = None
    stealth_options: Dict[str, Any] = field(default_factory=dict)
    permissions: List[str] = field(default_factory=lambda: ["geolocation", "notifications"])
    extra_headers: Dict[str, str] = field(default_factory=dict)
    proxy_config: Optional[Dict[str, str]] = None


class AdvancedBrowserAutomationService:
    """Service for advanced browser automation capabilities"""

    def __init__(
        self,
        browser_manager: BrowserManager,
        visual_testing: VisualTestingService,
        captcha_solver: CaptchaSolverService,
        network_simulation: NetworkSimulationService
    ):
        self.browser_manager = browser_manager
        self.visual_testing = visual_testing
        self.captcha_solver = captcha_solver
        self.network_simulation = network_simulation
        self.logger = logging.getLogger(__name__)

        # Predefined user agents
        self.user_agents = self._create_user_agents()
        self.geolocations = self._create_geolocations()

    def _create_user_agents(self) -> Dict[str, UserAgentConfig]:
        """Create predefined user agent configurations"""
        return {
            "chrome_windows": UserAgentConfig(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport_width=1920,
                viewport_height=1080,
                locale="en-US",
                timezone_id="America/New_York"
            ),
            "firefox_windows": UserAgentConfig(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
                viewport_width=1920,
                viewport_height=1080,
                locale="en-US",
                timezone_id="America/New_York"
            ),
            "safari_mac": UserAgentConfig(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
                viewport_width=1440,
                viewport_height=900,
                locale="en-US",
                timezone_id="America/Los_Angeles"
            ),
            "chrome_android": UserAgentConfig(
                user_agent="Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
                viewport_width=375,
                viewport_height=812,
                device_scale_factor=3.0,
                is_mobile=True,
                has_touch=True,
                locale="en-US",
                timezone_id="America/New_York"
            ),
            "safari_iphone": UserAgentConfig(
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                viewport_width=390,
                viewport_height=844,
                device_scale_factor=3.0,
                is_mobile=True,
                has_touch=True,
                locale="en-US",
                timezone_id="America/New_York"
            )
        }

    def _create_geolocations(self) -> Dict[str, GeolocationConfig]:
        """Create predefined geolocation configurations"""
        return {
            "new_york": GeolocationConfig(
                latitude=40.7128,
                longitude=-74.0060,
                accuracy=100.0
            ),
            "london": GeolocationConfig(
                latitude=51.5074,
                longitude=-0.1278,
                accuracy=100.0
            ),
            "tokyo": GeolocationConfig(
                latitude=35.6762,
                longitude=139.6503,
                accuracy=100.0
            ),
            "sydney": GeolocationConfig(
                latitude=-33.8688,
                longitude=151.2093,
                accuracy=100.0
            ),
            "paris": GeolocationConfig(
                latitude=48.8566,
                longitude=2.3522,
                accuracy=100.0
            )
        }

    async def create_advanced_context(
        self,
        browser: Browser,
        config: AdvancedInteractionConfig
    ) -> BrowserContext:
        """Create browser context with advanced configuration"""
        try:
            context_options = {
                "viewport": {
                    "width": config.user_agent.viewport_width if config.user_agent else 1920,
                    "height": config.user_agent.viewport_height if config.user_agent else 1080
                },
                "user_agent": config.user_agent.user_agent if config.user_agent else None,
                "device_scale_factor": config.user_agent.device_scale_factor if config.user_agent else 1.0,
                "is_mobile": config.user_agent.is_mobile if config.user_agent else False,
                "has_touch": config.user_agent.has_touch if config.user_agent else True,
                "locale": config.user_agent.locale if config.user_agent else "en-US",
                "timezone_id": config.user_agent.timezone_id if config.user_agent else "America/New_York",
                "permissions": config.permissions,
                "extra_http_headers": config.extra_headers
            }

            # Add proxy configuration if provided
            if config.proxy_config:
                context_options["proxy"] = config.proxy_config

            # Create context
            context = await browser.new_context(**context_options)

            # Apply geolocation if configured
            if config.geolocation:
                await context.set_geolocation({
                    "latitude": config.geolocation.latitude,
                    "longitude": config.geolocation.longitude,
                    "accuracy": config.geolocation.accuracy
                })

            # Apply stealth mode if enabled
            if config.automation_mode == AutomationMode.STEALTH:
                await self._apply_stealth_mode(context, config.stealth_options)

            # Setup download directory if file operations are configured
            if config.file_operations:
                download_path = Path(config.file_operations.download_dir)
                download_path.mkdir(parents=True, exist_ok=True)

            self.logger.info(f"Created advanced browser context with mode: {config.automation_mode}")
            return context

        except Exception as e:
            self.logger.error(f"Error creating advanced context: {e}")
            raise

    async def _apply_stealth_mode(self, context: BrowserContext, stealth_options: Dict[str, Any]):
        """Apply stealth mode to avoid detection"""
        try:
            # Hide automation indicators
            stealth_script = """
            () => {
                // Remove webdriver property
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });

                // Modify navigator plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [
                        {
                            0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
                            description: "Portable Document Format",
                            filename: "internal-pdf-viewer",
                            length: 1,
                            name: "Chrome PDF Plugin"
                        }
                    ],
                });

                // Modify navigator languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });

                // Add chrome object
                window.chrome = {
                    runtime: {},
                };

                // Replace permissions API
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Cypress.resolveNotificationsPermission(parameters) }) :
                        originalQuery(parameters)
                );

                // Mask iframe contentWindow
                Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
                    get: () => window,
                });
            }
            """

            await context.add_init_script(stealth_script)

            # Additional stealth options
            if stealth_options.get("hide_canvas", False):
                canvas_script = """
                () => {
                    const getContext = HTMLCanvasElement.prototype.getContext;
                    HTMLCanvasElement.prototype.getContext = function(type) {
                        const context = getContext.call(this, type);
                        if (type === '2d') {
                            const getImageData = context.getImageData;
                            context.getImageData = function() {
                                const imageData = getImageData.apply(this, arguments);
                                for (let i = 0; i < imageData.data.length; i += 4) {
                                    imageData.data[i] += Math.random() * 10 - 5;
                                    imageData.data[i + 1] += Math.random() * 10 - 5;
                                    imageData.data[i + 2] += Math.random() * 10 - 5;
                                }
                                return imageData;
                            };
                        }
                        return context;
                    };
                }
                """
                await context.add_init_script(canvas_script)

        except Exception as e:
            self.logger.error(f"Error applying stealth mode: {e}")

    async def type_with_human_behavior(
        self,
        page: Page,
        selector: str,
        text: str,
        config: HumanBehaviorConfig
    ) -> Dict[str, Any]:
        """Type text with human-like behavior"""
        try:
            element = await page.wait_for_selector(selector, timeout=10000)
            if not element:
                raise ValueError(f"Element not found: {selector}")

            # Clear existing text
            await element.click()
            await page.keyboard.press("Control+a") if "darwin" not in await page.evaluate("navigator.platform") else page.keyboard.press("Command+a")
            await page.keyboard.press("Backspace")

            # Calculate typing characteristics
            wpm = config.typing_speed_wpm
            char_delay = 60.0 / (wpm * 5)  # 5 chars per word average

            start_time = time.time()
            typed_chars = 0

            for char in text:
                # Add variance to typing speed
                variance = random.uniform(1 - config.typing_variance, 1 + config.typing_variance)
                delay = char_delay * variance

                # Typing errors and corrections (optional)
                if config.random_delays and random.random() < 0.05:  # 5% chance of error
                    # Type wrong character
                    wrong_char = random.choice("abcdefghijklmnopqrstuvwxyz")
                    await page.keyboard.type(wrong_char)
                    await asyncio.sleep(delay)
                    # Backspace and correct
                    await page.keyboard.press("Backspace")
                    await asyncio.sleep(delay * 2)  # Longer pause for correction

                await page.keyboard.type(char)
                await asyncio.sleep(delay)
                typed_chars += 1

                # Occasional micro pauses
                if config.micro_movements and random.random() < 0.1:  # 10% chance
                    await asyncio.sleep(random.uniform(0.1, 0.3))

            execution_time = int((time.time() - start_time) * 1000)

            return {
                "success": True,
                "typed_characters": typed_chars,
                "execution_time_ms": execution_time,
                "average_wpm": (typed_chars / 5) / (execution_time / 60000),
                "selector": selector,
                "text_length": len(text)
            }

        except Exception as e:
            self.logger.error(f"Error in human-like typing: {e}")
            return {
                "success": False,
                "error": str(e),
                "selector": selector
            }

    async def click_with_human_behavior(
        self,
        page: Page,
        selector: str,
        config: HumanBehaviorConfig
    ) -> Dict[str, Any]:
        """Click with human-like behavior"""
        try:
            element = await page.wait_for_selector(selector, timeout=10000)
            if not element:
                raise ValueError(f"Element not found: {selector}")

            # Get element position
            box = await element.bounding_box()
            if not box:
                raise ValueError(f"Could not get element bounding box: {selector}")

            # Calculate random offset for more natural clicking
            offset_x = random.uniform(box['width'] * 0.2, box['width'] * 0.8)
            offset_y = random.uniform(box['height'] * 0.2, box['height'] * 0.8)

            # Move mouse to element with human-like movement
            await page.mouse.move(
                box['x'] + offset_x,
                box['y'] + offset_y,
                steps=random.randint(10, 20) if config.micro_movements else 0
            )

            # Random delay before click
            if config.random_delays:
                delay = random.uniform(*config.click_delay_range)
                await asyncio.sleep(delay)

            # Click
            await page.mouse.click(box['x'] + offset_x, box['y'] + offset_y)

            return {
                "success": True,
                "selector": selector,
                "click_position": {"x": box['x'] + offset_x, "y": box['y'] + offset_y},
                "element_position": box,
                "delay_ms": int(delay * 1000) if config.random_delays else 0
            }

        except Exception as e:
            self.logger.error(f"Error in human-like clicking: {e}")
            return {
                "success": False,
                "error": str(e),
                "selector": selector
            }

    async def scroll_with_human_behavior(
        self,
        page: Page,
        scroll_config: Dict[str, Any],
        config: HumanBehaviorConfig
    ) -> Dict[str, Any]:
        """Scroll with human-like behavior"""
        try:
            target_y = scroll_config.get("target_y", 0)
            target_x = scroll_config.get("target_x", 0)
            scroll_behavior = scroll_config.get("behavior", config.scroll_behavior)

            current_scroll = await page.evaluate("() => ({x: window.scrollX, y: window.scrollY})")

            steps = []
            if scroll_behavior == "smooth":
                # Create smooth scrolling steps
                steps_count = 20
                for i in range(1, steps_count + 1):
                    progress = i / steps_count
                    # Easing function for natural movement
                    ease_progress = 1 - (1 - progress) ** 3
                    steps.append({
                        "x": current_scroll["x"] + (target_x - current_scroll["x"]) * ease_progress,
                        "y": current_scroll["y"] + (target_y - current_scroll["y"]) * ease_progress
                    })
            elif scroll_behavior == "stepped":
                # Create stepped scrolling
                step_size = 200
                current_y = current_scroll["y"]
                while current_y < target_y:
                    next_y = min(current_y + step_size, target_y)
                    steps.append({"x": target_x, "y": next_y})
                    current_y = next_y
            else:
                # Instant scroll
                steps = [{"x": target_x, "y": target_y}]

            # Execute scrolling
            start_time = time.time()
            for i, step in enumerate(steps):
                await page.evaluate(f"window.scrollTo({step['x']}, {step['y']})")

                if i < len(steps) - 1:  # Don't delay on last step
                    delay = random.uniform(0.05, 0.15) if config.random_delays else 0.1
                    await asyncio.sleep(delay)

            execution_time = int((time.time() - start_time) * 1000)

            return {
                "success": True,
                "final_position": {"x": target_x, "y": target_y},
                "initial_position": current_scroll,
                "execution_time_ms": execution_time,
                "steps_count": len(steps),
                "scroll_behavior": scroll_behavior
            }

        except Exception as e:
            self.logger.error(f"Error in human-like scrolling: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def handle_file_upload(
        self,
        page: Page,
        selector: str,
        file_paths: List[str],
        config: FileOperationConfig
    ) -> Dict[str, Any]:
        """Handle file upload with validation"""
        try:
            element = await page.wait_for_selector(selector, timeout=10000)
            if not element:
                raise ValueError(f"File input element not found: {selector}")

            # Validate files
            valid_files = []
            for file_path in file_paths:
                path = Path(file_path)

                # Check if file exists
                if not path.exists():
                    self.logger.warning(f"File not found: {file_path}")
                    continue

                # Check file extension
                if config.allowed_extensions and path.suffix.lower() not in config.allowed_extensions:
                    self.logger.warning(f"File extension not allowed: {path.suffix}")
                    continue

                # Check file size
                file_size_mb = path.stat().st_size / (1024 * 1024)
                if file_size_mb > config.max_file_size_mb:
                    self.logger.warning(f"File too large: {file_size_mb:.2f}MB")
                    continue

                valid_files.append(str(path.absolute()))

            if not valid_files:
                raise ValueError("No valid files to upload")

            # Upload files
            start_time = time.time()
            await element.set_input_files(valid_files)
            execution_time = int((time.time() - start_time) * 1000)

            return {
                "success": True,
                "uploaded_files": valid_files,
                "file_count": len(valid_files),
                "execution_time_ms": execution_time,
                "selector": selector
            }

        except Exception as e:
            self.logger.error(f"Error handling file upload: {e}")
            return {
                "success": False,
                "error": str(e),
                "selector": selector,
                "attempted_files": file_paths
            }

    async def handle_file_download(
        self,
        page: Page,
        download_trigger: str,
        expected_files: int = 1,
        config: Optional[FileOperationConfig] = None,
        timeout_seconds: int = 30
    ) -> Dict[str, Any]:
        """Handle file downloads"""
        try:
            download_dir = config.download_dir if config else "downloads"
            download_path = Path(download_dir)
            download_path.mkdir(parents=True, exist_ok=True)

            # Start download
            start_time = time.time()

            # Listen for download events
            downloads = []

            async with page.expect_download(timeout=timeout_seconds * 1000) as download_info:
                # Trigger download
                if download_trigger.startswith("click:"):
                    selector = download_trigger[6:]  # Remove "click:" prefix
                    await page.click(selector)
                elif download_trigger.startswith("navigate:"):
                    url = download_trigger[9:]  # Remove "navigate:" prefix
                    await page.goto(url)
                else:
                    # Assume it's a JavaScript function
                    await page.evaluate(download_trigger)

            download = await download_info.value
            downloads.append(download)

            # Save downloads
            saved_files = []
            for download in downloads:
                file_path = download_path / download.suggested_filename
                await download.save_as(file_path)
                saved_files.append(str(file_path))

            execution_time = int((time.time() - start_time) * 1000)

            return {
                "success": True,
                "downloaded_files": saved_files,
                "file_count": len(saved_files),
                "execution_time_ms": execution_time,
                "download_dir": download_dir
            }

        except PlaywrightTimeoutError:
            self.logger.error("Download timeout")
            return {
                "success": False,
                "error": "Download timeout",
                "timeout_seconds": timeout_seconds
            }
        except Exception as e:
            self.logger.error(f"Error handling file download: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def execute_advanced_workflow(
        self,
        page: Page,
        workflow_steps: List[Dict[str, Any]],
        config: AdvancedInteractionConfig
    ) -> Dict[str, Any]:
        """Execute a complex workflow with multiple steps"""
        try:
            start_time = time.time()
            results = []
            errors = []

            for i, step in enumerate(workflow_steps):
                step_type = step.get("type", "unknown")
                step_start = time.time()

                try:
                    if step_type == "navigate":
                        result = await page.goto(step["url"], wait_until="networkidle")
                        results.append({
                            "step": i,
                            "type": step_type,
                            "success": True,
                            "url": step["url"],
                            "execution_time_ms": int((time.time() - step_start) * 1000)
                        })

                    elif step_type == "type":
                        result = await self.type_with_human_behavior(
                            page,
                            step["selector"],
                            step["text"],
                            config.human_behavior or HumanBehaviorConfig()
                        )
                        results.append({
                            "step": i,
                            "type": step_type,
                            **result
                        })

                    elif step_type == "click":
                        result = await self.click_with_human_behavior(
                            page,
                            step["selector"],
                            config.human_behavior or HumanBehaviorConfig()
                        )
                        results.append({
                            "step": i,
                            "type": step_type,
                            **result
                        })

                    elif step_type == "scroll":
                        result = await self.scroll_with_human_behavior(
                            page,
                            step,
                            config.human_behavior or HumanBehaviorConfig()
                        )
                        results.append({
                            "step": i,
                            "type": step_type,
                            **result
                        })

                    elif step_type == "wait":
                        wait_time = step.get("duration", 1)
                        await asyncio.sleep(wait_time)
                        results.append({
                            "step": i,
                            "type": step_type,
                            "success": True,
                            "duration": wait_time,
                            "execution_time_ms": int(wait_time * 1000)
                        })

                    elif step_type == "screenshot":
                        screenshot_bytes = await page.screenshot(full_page=True)
                        results.append({
                            "step": i,
                            "type": step_type,
                            "success": True,
                            "screenshot_size": len(screenshot_bytes),
                            "execution_time_ms": int((time.time() - step_start) * 1000)
                        })

                    elif step_type == "visual_test":
                        visual_config = VisualTestConfig(**step.get("config", {}))
                        test_result = await self.visual_testing.run_visual_regression_test(
                            page,
                            visual_config,
                            f"workflow_step_{i}",
                            page.url
                        )
                        results.append({
                            "step": i,
                            "type": step_type,
                            "success": test_result.passed,
                            "confidence": test_result.confidence,
                            "diff_percentage": test_result.diff_percentage,
                            "execution_time_ms": test_result.execution_time_ms
                        })

                    elif step_type == "solve_captcha":
                        captcha_config = CaptchaConfig(**step.get("config", {}))
                        challenges = await self.captcha_solver.detect_captcha(page)

                        if challenges:
                            captcha_result = await self.captcha_solver.solve_captcha(
                                challenges[0],
                                captcha_config
                            )
                            await self.captcha_solver.apply_solution(page, captcha_result)

                            results.append({
                                "step": i,
                                "type": step_type,
                                "success": captcha_result.success,
                                "challenge_type": challenges[0].captcha_type,
                                "confidence": captcha_result.solution.confidence if captcha_result.solution else 0.0,
                                "execution_time_ms": captcha_result.total_time_ms
                            })
                        else:
                            results.append({
                                "step": i,
                                "type": step_type,
                                "success": True,
                                "message": "No CAPTCHA detected"
                            })

                    else:
                        error_msg = f"Unknown step type: {step_type}"
                        errors.append(error_msg)
                        results.append({
                            "step": i,
                            "type": step_type,
                            "success": False,
                            "error": error_msg
                        })

                    # Add delays between steps for human-like behavior
                    if config.human_behavior and config.human_behavior.random_delays:
                        await asyncio.sleep(random.uniform(0.5, 2.0))

                except Exception as e:
                    error_msg = f"Error in step {i} ({step_type}): {e}"
                    self.logger.error(error_msg)
                    errors.append(error_msg)
                    results.append({
                        "step": i,
                        "type": step_type,
                        "success": False,
                        "error": error_msg,
                        "execution_time_ms": int((time.time() - step_start) * 1000)
                    })

            total_execution_time = int((time.time() - start_time) * 1000)
            successful_steps = sum(1 for r in results if r.get("success", False))

            return {
                "success": len(errors) == 0,
                "total_steps": len(workflow_steps),
                "successful_steps": successful_steps,
                "failed_steps": len(errors),
                "total_execution_time_ms": total_execution_time,
                "results": results,
                "errors": errors,
                "workflow_id": str(uuid.uuid4())
            }

        except Exception as e:
            self.logger.error(f"Error executing advanced workflow: {e}")
            return {
                "success": False,
                "error": str(e),
                "total_execution_time_ms": int((time.time() - start_time) * 1000)
            }

    def get_user_agent_config(self, name: str) -> Optional[UserAgentConfig]:
        """Get user agent configuration by name"""
        return self.user_agents.get(name)

    def get_geolocation_config(self, name: str) -> Optional[GeolocationConfig]:
        """Get geolocation configuration by name"""
        return self.geolocations.get(name)

    def list_available_configurations(self) -> Dict[str, List[str]]:
        """List all available configurations"""
        return {
            "user_agents": list(self.user_agents.keys()),
            "geolocations": list(self.geolocations.keys()),
            "automation_modes": [mode.value for mode in AutomationMode],
            "scroll_behaviors": ["smooth", "instant", "stepped"],
            "mouse_speeds": ["slow", "normal", "fast"]
        }