"""
Visual Testing Service

Provides visual testing capabilities including screenshot comparison,
visual regression testing, and visual diff analysis.
"""

import asyncio
import io
import base64
import logging
from typing import Dict, List, Optional, Any, Tuple, Union
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageChops
import numpy as np
from playwright.async_api import Page, Browser

from app.services.browser_manager import BrowserManager
from app.models.browser import BrowserConfig

logger = logging.getLogger(__name__)


class VisualTestType(str, Enum):
    SCREENSHOT = "screenshot"
    VISUAL_REGRESSION = "visual_regression"
    ELEMENT_VISUAL = "element_visual"
    LAYOUT_TEST = "layout_test"
    RESPONSIVE_TEST = "responsive_test"


class DiffType(str, Enum):
    PIXEL_DIFF = "pixel_diff"
    LAYOUT_DIFF = "layout_diff"
    CONTENT_DIFF = "content_diff"
    STYLE_DIFF = "style_diff"


@dataclass
class VisualTestConfig:
    """Configuration for visual testing"""
    test_type: VisualTestType
    threshold: float = 0.1
    ignore_regions: List[Dict[str, Any]] = field(default_factory=list)
    compare_mode: str = "pixel"  # pixel, layout, content
    screenshot_options: Dict[str, Any] = field(default_factory=dict)
    baseline_dir: str = "visual_baselines"
    output_dir: str = "visual_test_results"
    viewport_sizes: List[Tuple[int, int]] = field(default_factory=lambda: [(1920, 1080)])
    wait_for_stability: int = 1000  # ms
    pixel_ratio: float = 1.0


@dataclass
class VisualDiff:
    """Represents a visual difference"""
    diff_type: DiffType
    confidence: float
    bounding_box: Dict[str, int]
    pixel_count: int
    percentage: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class VisualTestResult:
    """Result of a visual test"""
    test_id: str
    test_type: VisualTestType
    passed: bool
    confidence: float
    diff_count: int
    total_pixels: int
    diff_percentage: float
    execution_time_ms: int
    screenshot_path: Optional[str] = None
    baseline_path: Optional[str] = None
    diff_path: Optional[str] = None
    diffs: List[VisualDiff] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ScreenshotConfig:
    """Configuration for screenshot capture"""
    full_page: bool = True
    quality: int = 90
    format: str = "png"  # png, jpeg
    clip: Optional[Dict[str, int]] = None
    omit_background: bool = False
    animations: str = "disabled"  # disabled, allow
    caret: str = "hide"  # hide, show, initial
    scale: str = "device"  # device, css


class VisualTestingService:
    """Service for visual testing and comparison"""

    def __init__(self, browser_manager: BrowserManager):
        self.browser_manager = browser_manager
        self.logger = logging.getLogger(__name__)

    async def capture_screenshot(
        self,
        page: Page,
        config: ScreenshotConfig,
        test_id: str
    ) -> bytes:
        """Capture a screenshot with the given configuration"""
        try:
            # Wait for page stability
            await page.wait_for_timeout(config.animations == "allow" and 1000 or 500)

            # Set animation behavior
            await page.evaluate("""
                () => {
                    if (arguments[0] === 'disabled') {
                        document.head.appendChild(Object.assign(document.createElement('style'), {
                            textContent: '* { animation-duration: 0s !important; transition-duration: 0s !important; }'
                        }));
                    }
                }
            """, config.animations)

            # Configure caret
            if config.caret == "hide":
                await page.evaluate("() => document.activeElement && document.activeElement.blur()")

            # Capture screenshot
            screenshot_bytes = await page.screenshot(
                full_page=config.full_page,
                quality=None if config.format == "png" else config.quality,
                type=config.format,
                clip=config.clip,
                omit_background=config.omit_background
            )

            return screenshot_bytes

        except Exception as e:
            self.logger.error(f"Error capturing screenshot for {test_id}: {e}")
            raise

    async def compare_images(
        self,
        image1_bytes: bytes,
        image2_bytes: bytes,
        threshold: float = 0.1
    ) -> Tuple[bool, List[VisualDiff], Image.Image]:
        """Compare two images and return differences"""
        try:
            # Convert bytes to PIL Images
            img1 = Image.open(io.BytesIO(image1_bytes))
            img2 = Image.open(io.BytesIO(image2_bytes))

            # Ensure images are the same size
            if img1.size != img2.size:
                # Resize to the larger dimensions
                max_width = max(img1.width, img2.width)
                max_height = max(img1.height, img2.height)
                img1 = img1.resize((max_width, max_height), Image.Resampling.LANCZOS)
                img2 = img2.resize((max_width, max_height), Image.Resampling.LANCZOS)

            # Calculate pixel differences
            diff = ImageChops.difference(img1, img2)
            diff_array = np.array(diff)

            # Find significant differences
            significant_diffs = []
            total_pixels = diff_array.shape[0] * diff_array.shape[1]

            # Convert to grayscale for analysis
            gray_diff = diff.convert('L')
            gray_array = np.array(gray_diff)

            # Find pixels above threshold
            threshold_value = int(255 * threshold)
            diff_mask = gray_array > threshold_value

            if np.any(diff_mask):
                # Find connected components (contiguous diff regions)
                from scipy import ndimage
                labeled_array, num_features = ndimage.label(diff_mask)

                for i in range(1, num_features + 1):
                    # Find bounding box for each diff region
                    positions = np.where(labeled_array == i)
                    if len(positions[0]) > 0:
                        min_y, max_y = positions[0].min(), positions[0].max()
                        min_x, max_x = positions[1].min(), positions[1].max()

                        # Calculate confidence for this region
                        region_pixels = gray_array[labeled_array == i]
                        avg_diff = np.mean(region_pixels) / 255.0
                        pixel_count = len(region_pixels)

                        visual_diff = VisualDiff(
                            diff_type=DiffType.PIXEL_DIFF,
                            confidence=avg_diff,
                            bounding_box={
                                "x": int(min_x),
                                "y": int(min_y),
                                "width": int(max_x - min_x),
                                "height": int(max_y - min_y)
                            },
                            pixel_count=pixel_count,
                            percentage=(pixel_count / total_pixels) * 100,
                            metadata={
                                "region_id": i,
                                "avg_pixel_diff": float(avg_diff),
                                "max_pixel_diff": float(np.max(region_pixels) / 255.0)
                            }
                        )
                        significant_diffs.append(visual_diff)

            # Create diff visualization
            diff_visual = self._create_diff_visualization(img1, img2, diff, significant_diffs)

            # Determine if test passed
            total_diff_percentage = sum(d.percentage for d in significant_diffs)
            passed = total_diff_percentage < (threshold * 100)  # Convert threshold to percentage

            return passed, significant_diffs, diff_visual

        except Exception as e:
            self.logger.error(f"Error comparing images: {e}")
            raise

    def _create_diff_visualization(
        self,
        img1: Image.Image,
        img2: Image.Image,
        diff: Image.Image,
        diffs: List[VisualDiff]
    ) -> Image.Image:
        """Create a visual diff image with highlighted regions"""
        try:
            # Create a composite image showing original, new, and diff
            width = img1.width * 3 + 20  # 10px padding between images
            height = max(img1.height, img2.height, diff.height) + 100  # Space for labels

            # Create white background
            composite = Image.new('RGB', (width, height), 'white')
            draw = ImageDraw.Draw(composite)

            # Paste images
            composite.paste(img1, (10, 50))
            composite.paste(img2, (img1.width + 20, 50))
            composite.paste(diff, (img1.width * 2 + 30, 50))

            # Add labels
            try:
                # Try to load a font
                font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 16)
            except:
                font = ImageFont.load_default()

            draw.text((10, 10), "Baseline", fill='black', font=font)
            draw.text((img1.width + 20, 10), "Current", fill='black', font=font)
            draw.text((img1.width * 2 + 30, 10), "Difference", fill='black', font=font)

            # Draw bounding boxes on diff image
            for diff_region in diffs:
                bbox = diff_region.bounding_box
                x_offset = img1.width * 2 + 30
                y_offset = 50

                draw.rectangle([
                    x_offset + bbox["x"],
                    y_offset + bbox["y"],
                    x_offset + bbox["x"] + bbox["width"],
                    y_offset + bbox["y"] + bbox["height"]
                ], outline='red', width=2)

            return composite

        except Exception as e:
            self.logger.error(f"Error creating diff visualization: {e}")
            return diff

    async def run_visual_regression_test(
        self,
        page: Page,
        test_config: VisualTestConfig,
        test_id: str,
        url: str,
        update_baseline: bool = False
    ) -> VisualTestResult:
        """Run a visual regression test"""
        start_time = datetime.now()

        try:
            # Navigate to URL
            await page.goto(url, wait_until="networkidle")
            await page.wait_for_timeout(test_config.wait_for_stability)

            # Capture current screenshot
            screenshot_config = ScreenshotConfig(**test_config.screenshot_options)
            current_screenshot = await self.capture_screenshot(page, screenshot_config, test_id)

            # Generate baseline path
            baseline_hash = hashlib.md5(f"{test_id}_{url}".encode()).hexdigest()
            baseline_path = Path(test_config.baseline_dir) / f"{baseline_hash}.png"

            # Check if baseline exists
            if update_baseline or not baseline_path.exists():
                # Create or update baseline
                baseline_path.parent.mkdir(parents=True, exist_ok=True)
                with open(baseline_path, 'wb') as f:
                    f.write(current_screenshot)

                return VisualTestResult(
                    test_id=test_id,
                    test_type=VisualTestType.VISUAL_REGRESSION,
                    passed=True,
                    confidence=1.0,
                    diff_count=0,
                    total_pixels=0,
                    diff_percentage=0.0,
                    execution_time_ms=int((datetime.now() - start_time).total_seconds() * 1000),
                    baseline_path=str(baseline_path),
                    screenshot_path=str(baseline_path),
                    metadata={"status": "baseline_created" if not baseline_path.exists() else "baseline_updated"}
                )

            # Load baseline
            with open(baseline_path, 'rb') as f:
                baseline_screenshot = f.read()

            # Compare images
            passed, diffs, diff_visual = await self.compare_images(
                baseline_screenshot,
                current_screenshot,
                test_config.threshold
            )

            # Save current screenshot
            current_path = Path(test_config.output_dir) / "current" / f"{test_id}.png"
            current_path.parent.mkdir(parents=True, exist_ok=True)
            with open(current_path, 'wb') as f:
                f.write(current_screenshot)

            # Save diff visualization if there are differences
            diff_path = None
            if diffs:
                diff_path = Path(test_config.output_dir) / "diff" / f"{test_id}.png"
                diff_path.parent.mkdir(parents=True, exist_ok=True)
                diff_visual.save(diff_path)

            # Calculate confidence
            confidence = 1.0 - (sum(d.percentage for d in diffs) / 100.0)
            confidence = max(0.0, min(1.0, confidence))

            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)

            return VisualTestResult(
                test_id=test_id,
                test_type=VisualTestType.VISUAL_REGRESSION,
                passed=passed,
                confidence=confidence,
                diff_count=len(diffs),
                total_pixels=len(current_screenshot) // 3,  # Approximate
                diff_percentage=sum(d.percentage for d in diffs),
                execution_time_ms=execution_time,
                screenshot_path=str(current_path),
                baseline_path=str(baseline_path),
                diff_path=str(diff_path) if diff_path else None,
                diffs=diffs,
                metadata={
                    "url": url,
                    "threshold": test_config.threshold,
                    "viewport": page.viewport_size
                }
            )

        except Exception as e:
            self.logger.error(f"Error running visual regression test for {test_id}: {e}")
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)

            return VisualTestResult(
                test_id=test_id,
                test_type=VisualTestType.VISUAL_REGRESSION,
                passed=False,
                confidence=0.0,
                diff_count=0,
                total_pixels=0,
                diff_percentage=100.0,
                execution_time_ms=execution_time,
                metadata={"error": str(e)}
            )

    async def run_responsive_test(
        self,
        page: Page,
        test_config: VisualTestConfig,
        test_id: str,
        url: str
    ) -> List[VisualTestResult]:
        """Run responsive visual tests across multiple viewport sizes"""
        results = []

        for i, (width, height) in enumerate(test_config.viewport_sizes):
            try:
                # Set viewport
                await page.set_viewport_size({"width": width, "height": height})

                # Run visual regression test for this viewport
                viewport_test_id = f"{test_id}_viewport_{i}_{width}x{height}"
                result = await self.run_visual_regression_test(
                    page, test_config, viewport_test_id, url
                )

                # Update metadata
                result.metadata.update({
                    "viewport_width": width,
                    "viewport_height": height,
                    "test_type": "responsive"
                })

                results.append(result)

            except Exception as e:
                self.logger.error(f"Error in responsive test for viewport {width}x{height}: {e}")

                # Create error result
                error_result = VisualTestResult(
                    test_id=f"{test_id}_viewport_{i}_{width}x{height}",
                    test_type=VisualTestType.RESPONSIVE_TEST,
                    passed=False,
                    confidence=0.0,
                    diff_count=0,
                    total_pixels=0,
                    diff_percentage=100.0,
                    execution_time_ms=0,
                    metadata={
                        "error": str(e),
                        "viewport_width": width,
                        "viewport_height": height
                    }
                )
                results.append(error_result)

        return results

    async def capture_element_screenshot(
        self,
        page: Page,
        selector: str,
        test_id: str,
        screenshot_config: Optional[ScreenshotConfig] = None
    ) -> bytes:
        """Capture a screenshot of a specific element"""
        try:
            # Find element
            element = await page.query_selector(selector)
            if not element:
                raise ValueError(f"Element not found: {selector}")

            # Get element bounding box
            bbox = await element.bounding_box()
            if not bbox:
                raise ValueError(f"Could not get bounding box for element: {selector}")

            # Configure screenshot to clip to element
            config = screenshot_config or ScreenshotConfig()
            config.clip = {
                "x": int(bbox["x"]),
                "y": int(bbox["y"]),
                "width": int(bbox["width"]),
                "height": int(bbox["height"])
            }
            config.full_page = False

            # Capture screenshot
            return await self.capture_screenshot(page, config, test_id)

        except Exception as e:
            self.logger.error(f"Error capturing element screenshot for {selector}: {e}")
            raise

    def get_test_statistics(self, results_dir: str) -> Dict[str, Any]:
        """Get statistics for visual tests in a directory"""
        try:
            results_path = Path(results_dir)
            stats = {
                "total_tests": 0,
                "passed_tests": 0,
                "failed_tests": 0,
                "average_confidence": 0.0,
                "test_types": {},
                "recent_results": []
            }

            # Load all test results
            for json_file in results_path.glob("**/*.json"):
                try:
                    with open(json_file, 'r') as f:
                        result = json.load(f)

                    stats["total_tests"] += 1
                    if result.get("passed", False):
                        stats["passed_tests"] += 1
                    else:
                        stats["failed_tests"] += 1

                    stats["average_confidence"] += result.get("confidence", 0.0)

                    test_type = result.get("test_type", "unknown")
                    stats["test_types"][test_type] = stats["test_types"].get(test_type, 0) + 1

                    # Keep recent results (last 10)
                    stats["recent_results"].append({
                        "test_id": result.get("test_id"),
                        "passed": result.get("passed"),
                        "confidence": result.get("confidence"),
                        "timestamp": result.get("timestamp")
                    })

                except Exception as e:
                    self.logger.warning(f"Error loading test result from {json_file}: {e}")

            # Calculate average confidence
            if stats["total_tests"] > 0:
                stats["average_confidence"] /= stats["total_tests"]
                stats["pass_rate"] = (stats["passed_tests"] / stats["total_tests"]) * 100

            # Sort recent results by timestamp
            stats["recent_results"] = sorted(
                stats["recent_results"],
                key=lambda x: x.get("timestamp", ""),
                reverse=True
            )[:10]

            return stats

        except Exception as e:
            self.logger.error(f"Error getting test statistics: {e}")
            return {"error": str(e)}