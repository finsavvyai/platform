"""
CAPTCHA Solver Service

Provides automated CAPTCHA solving capabilities using various techniques
including OCR, machine learning, and third-party services.
"""

import asyncio
import base64
import io
import json
import logging
import re
import time
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import hashlib
import urllib.parse

import aiohttp
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import cv2
import pytesseract
from playwright.async_api import Page

from app.services.ai_selector import AISelectorService
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class CaptchaType(str, Enum):
    TEXT = "text"  # Standard text CAPTCHA
    RECAPTCHA_V2 = "recaptcha_v2"  # Google reCAPTCHA v2
    RECAPTCHA_V3 = "recaptcha_v3"  # Google reCAPTCHA v3
    HCAPTCHA = "hcaptcha"  # hCaptcha
    MATH = "math"  # Math problem CAPTCHA
    IMAGE = "image"  # Image selection CAPTCHA
    AUDIO = "audio"  # Audio CAPTCHA
    SLIDER = "slider"  # Slider CAPTCHA
    PUZZLE = "puzzle"  # Puzzle CAPTCHA


class SolverType(str, Enum):
    OCR = "ocr"  # Optical Character Recognition
    AI_ML = "ai_ml"  # AI/Machine Learning
    THIRD_PARTY = "third_party"  # Third-party service
    MANUAL = "manual"  # Manual intervention


@dataclass
class CaptchaConfig:
    """Configuration for CAPTCHA solving"""
    solver_type: SolverType
    max_attempts: int = 3
    timeout_seconds: int = 30
    confidence_threshold: float = 0.7
    enable_preprocessing: bool = True
    third_party_service: Optional[str] = None
    api_key: Optional[str] = None
    ocr_config: Dict[str, Any] = field(default_factory=dict)
    ai_model_config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CaptchaChallenge:
    """Represents a CAPTCHA challenge"""
    challenge_id: str
    captcha_type: CaptchaType
    page_url: str
    site_key: Optional[str] = None
    image_data: Optional[bytes] = None
    audio_data: Optional[bytes] = None
    question: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class CaptchaSolution:
    """Represents a CAPTCHA solution"""
    challenge_id: str
    solution: str
    confidence: float
    solver_used: SolverType
    processing_time_ms: int
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class CaptchaResult:
    """Result of a CAPTCHA solving attempt"""
    success: bool
    challenge: CaptchaChallenge
    solution: Optional[CaptchaSolution] = None
    error_message: Optional[str] = None
    attempts_made: int = 0
    total_time_ms: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


class CaptchaSolverService:
    """Service for automated CAPTCHA solving"""

    def __init__(self, ai_selector: Optional[AISelectorService] = None):
        self.ai_selector = ai_selector
        self.logger = logging.getLogger(__name__)
        self.session_cache = {}
        self.solution_cache = {}
        self.stats = {
            "total_challenges": 0,
            "successful_solves": 0,
            "failed_solves": 0,
            "average_solve_time": 0.0
        }

    async def detect_captcha(self, page: Page) -> List[CaptchaChallenge]:
        """Detect CAPTCHAs on the current page"""
        challenges = []

        try:
            # Check for various CAPTCHA types
            challenges.extend(await self._detect_recaptcha(page))
            challenges.extend(await self._detect_hcaptcha(page))
            challenges.extend(await self._detect_text_captcha(page))
            challenges.extend(await self._detect_math_captcha(page))
            challenges.extend(await self._detect_image_captcha(page))
            challenges.extend(await self._detect_slider_captcha(page))

            self.logger.info(f"Detected {len(challenges)} CAPTCHA challenges")
            return challenges

        except Exception as e:
            self.logger.error(f"Error detecting CAPTCHAs: {e}")
            return []

    async def _detect_recaptcha(self, page: Page) -> List[CaptchaChallenge]:
        """Detect Google reCAPTCHA"""
        challenges = []

        try:
            # Check for reCAPTCHA v2
            recaptcha_elements = await page.query_selector_all('.g-recaptcha')
            for element in recaptcha_elements:
                site_key = await element.get_attribute('data-sitekey')
                if site_key:
                    challenge = CaptchaChallenge(
                        challenge_id=self._generate_challenge_id(),
                        captcha_type=CaptchaType.RECAPTCHA_V2,
                        page_url=page.url,
                        site_key=site_key,
                        metadata={"element": "g-recaptcha"}
                    )
                    challenges.append(challenge)

            # Check for reCAPTCHA v3
            recaptcha_v3_script = await page.query_selector('script[src*="recaptcha/api.js"]')
            if recaptcha_v3_script:
                challenge = CaptchaChallenge(
                    challenge_id=self._generate_challenge_id(),
                    captcha_type=CaptchaType.RECAPTCHA_V3,
                    page_url=page.url,
                    metadata={"detected_via": "script_tag"}
                )
                challenges.append(challenge)

        except Exception as e:
            self.logger.debug(f"Error detecting reCAPTCHA: {e}")

        return challenges

    async def _detect_hcaptcha(self, page: Page) -> List[CaptchaChallenge]:
        """Detect hCaptcha"""
        challenges = []

        try:
            # Check for hCaptcha
            hcaptcha_elements = await page.query_selector_all('.h-captcha')
            for element in hcaptcha_elements:
                site_key = await element.get_attribute('data-sitekey')
                if site_key:
                    challenge = CaptchaChallenge(
                        challenge_id=self._generate_challenge_id(),
                        captcha_type=CaptchaType.HCAPTCHA,
                        page_url=page.url,
                        site_key=site_key,
                        metadata={"element": "h-captcha"}
                    )
                    challenges.append(challenge)

        except Exception as e:
            self.logger.debug(f"Error detecting hCaptcha: {e}")

        return challenges

    async def _detect_text_captcha(self, page: Page) -> List[CaptchaChallenge]:
        """Detect text-based CAPTCHAs"""
        challenges = []

        try:
            # Look for common text CAPTCHA patterns
            captcha_selectors = [
                'img[src*="captcha"]',
                'img[alt*="captcha" i]',
                '.captcha img',
                '#captcha img',
                'img[src*="Captcha"]'
            ]

            for selector in captcha_selectors:
                elements = await page.query_selector_all(selector)
                for element in elements:
                    try:
                        # Get the image
                        src = await element.get_attribute('src')
                        if src:
                            image_data = await self._get_image_data(page, src)
                            if image_data:
                                challenge = CaptchaChallenge(
                                    challenge_id=self._generate_challenge_id(),
                                    captcha_type=CaptchaType.TEXT,
                                    page_url=page.url,
                                    image_data=image_data,
                                    metadata={"selector": selector, "src": src}
                                )
                                challenges.append(challenge)

                    except Exception as e:
                        self.logger.debug(f"Error processing text CAPTCHA element: {e}")

        except Exception as e:
            self.logger.debug(f"Error detecting text CAPTCHA: {e}")

        return challenges

    async def _detect_math_captcha(self, page: Page) -> List[CaptchaChallenge]:
        """Detect math problem CAPTCHAs"""
        challenges = []

        try:
            # Look for math problem patterns
            math_patterns = [
                r'(\d+)\s*[\+\-\*\/]\s*(\d+)\s*=',
                r'What\s+is\s+(\d+)\s*[\+\-\*\/]\s*(\d+)\?',
                r'Solve\s*:\s*(\d+)\s*[\+\-\*\/]\s*(\d+)'
            ]

            page_content = await page.content()
            for pattern in math_patterns:
                matches = re.findall(pattern, page_content, re.IGNORECASE)
                if matches:
                    # Extract the full question
                    full_match = re.search(pattern, page_content, re.IGNORECASE)
                    if full_match:
                        question = full_match.group(0)
                        challenge = CaptchaChallenge(
                            challenge_id=self._generate_challenge_id(),
                            captcha_type=CaptchaType.MATH,
                            page_url=page.url,
                            question=question,
                            metadata={"pattern": pattern, "match": question}
                        )
                        challenges.append(challenge)

        except Exception as e:
            self.logger.debug(f"Error detecting math CAPTCHA: {e}")

        return challenges

    async def _detect_image_captcha(self, page: Page) -> List[CaptchaChallenge]:
        """Detect image selection CAPTCHAs"""
        challenges = []

        try:
            # Look for image-based CAPTCHA patterns
            image_captcha_selectors = [
                '.image-captcha img',
                '.captcha-image img',
                '[data-captcha-type="image"] img'
            ]

            for selector in image_captcha_selectors:
                elements = await page.query_selector_all(selector)
                if len(elements) > 1:  # Multiple images suggest selection CAPTCHA
                    # Get question text
                    question_selectors = ['.captcha-question', '.captcha-instruction']
                    question = ""
                    for q_selector in question_selectors:
                        q_element = await page.query_selector(q_selector)
                        if q_element:
                            question = await q_element.text_content()
                            break

                    # Collect all images
                    images_data = []
                    for element in elements:
                        src = await element.get_attribute('src')
                        if src:
                            image_data = await self._get_image_data(page, src)
                            if image_data:
                                images_data.append(image_data)

                    if images_data:
                        challenge = CaptchaChallenge(
                            challenge_id=self._generate_challenge_id(),
                            captcha_type=CaptchaType.IMAGE,
                            page_url=page.url,
                            question=question,
                            metadata={"image_count": len(images_data), "selector": selector}
                        )
                        challenges.append(challenge)

        except Exception as e:
            self.logger.debug(f"Error detecting image CAPTCHA: {e}")

        return challenges

    async def _detect_slider_captcha(self, page: Page) -> List[CaptchaChallenge]:
        """Detect slider CAPTCHAs"""
        challenges = []

        try:
            # Look for slider patterns
            slider_selectors = [
                '.slider-captcha',
                '.captcha-slider',
                '[data-captcha-type="slider"]',
                '.slider-track',
                '.slider-button'
            ]

            for selector in slider_selectors:
                element = await page.query_selector(selector)
                if element:
                    challenge = CaptchaChallenge(
                        challenge_id=self._generate_challenge_id(),
                        captcha_type=CaptchaType.SLIDER,
                        page_url=page.url,
                        metadata={"selector": selector}
                    )
                    challenges.append(challenge)

        except Exception as e:
            self.logger.debug(f"Error detecting slider CAPTCHA: {e}")

        return challenges

    async def solve_captcha(self, challenge: CaptchaChallenge, config: CaptchaConfig) -> CaptchaResult:
        """Solve a CAPTCHA challenge"""
        start_time = time.time()
        attempts = 0
        solution = None

        try:
            self.logger.info(f"Attempting to solve {challenge.captcha_type} CAPTCHA: {challenge.challenge_id}")

            while attempts < config.max_attempts and not solution:
                attempts += 1

                try:
                    if config.solver_type == SolverType.OCR and challenge.captcha_type == CaptchaType.TEXT:
                        solution = await self._solve_text_captcha_ocr(challenge, config)
                    elif config.solver_type == SolverType.AI_ML:
                        solution = await self._solve_with_ai(challenge, config)
                    elif config.solver_type == SolverType.THIRD_PARTY:
                        solution = await self._solve_with_third_party(challenge, config)
                    elif challenge.captcha_type == CaptchaType.MATH:
                        solution = await self._solve_math_captcha(challenge, config)
                    elif challenge.captcha_type == CaptchaType.SLIDER:
                        solution = await self._solve_slider_captcha(challenge, config)

                    if solution and solution.confidence >= config.confidence_threshold:
                        break
                    else:
                        solution = None

                except Exception as e:
                    self.logger.warning(f"Attempt {attempts} failed: {e}")

                if attempts < config.max_attempts:
                    await asyncio.sleep(1)  # Brief delay between attempts

            total_time = int((time.time() - start_time) * 1000)

            # Update statistics
            self._update_stats(solution is not None, total_time)

            return CaptchaResult(
                success=solution is not None,
                challenge=challenge,
                solution=solution,
                attempts_made=attempts,
                total_time_ms=total_time,
                metadata={"solver_type": config.solver_type.value}
            )

        except Exception as e:
            self.logger.error(f"Error solving CAPTCHA {challenge.challenge_id}: {e}")
            total_time = int((time.time() - start_time) * 1000)

            return CaptchaResult(
                success=False,
                challenge=challenge,
                error_message=str(e),
                attempts_made=attempts,
                total_time_ms=total_time
            )

    async def _solve_text_captcha_ocr(self, challenge: CaptchaChallenge, config: CaptchaConfig) -> Optional[CaptchaSolution]:
        """Solve text CAPTCHA using OCR"""
        try:
            if not challenge.image_data:
                return None

            # Preprocess image
            image = Image.open(io.BytesIO(challenge.image_data))

            if config.enable_preprocessing:
                image = self._preprocess_image_for_ocr(image)

            # Configure OCR
            ocr_config = config.ocr_config or {
                '--psm': '8',  # Treat as single word
                '--oem': '3',  # Default OCR engine
                '-c': 'tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
            }

            # Perform OCR
            text = pytesseract.image_to_string(image, config=' '.join(f'--{k} {v}' for k, v in ocr_config.items()))
            text = text.strip()

            # Clean and validate result
            text = re.sub(r'[^a-zA-Z0-9]', '', text)

            if len(text) >= 4:  # Minimum reasonable CAPTCHA length
                confidence = self._calculate_ocr_confidence(image, text)

                return CaptchaSolution(
                    challenge_id=challenge.challenge_id,
                    solution=text,
                    confidence=confidence,
                    solver_used=SolverType.OCR,
                    processing_time_ms=0,  # Could be measured more precisely
                    metadata={"ocr_config": ocr_config}
                )

        except Exception as e:
            self.logger.error(f"Error in OCR solving: {e}")

        return None

    async def _solve_math_captcha(self, challenge: CaptchaChallenge, config: CaptchaConfig) -> Optional[CaptchaSolution]:
        """Solve math problem CAPTCHA"""
        try:
            if not challenge.question:
                return None

            # Extract math expression
            math_patterns = [
                r'(\d+)\s*[\+\-\*\/]\s*(\d+)',
                r'(\d+)\s*plus\s*(\d+)',
                r'(\d+)\s*minus\s*(\d+)',
                r'(\d+)\s*times\s*(\d+)',
                r'(\d+)\s*divided\s*by\s*(\d+)'
            ]

            for pattern in math_patterns:
                match = re.search(pattern, challenge.question, re.IGNORECASE)
                if match:
                    num1 = int(match.group(1))
                    num2 = int(match.group(2))
                    operator = match.group(0)[len(match.group(1)):len(match.group(0))-len(match.group(2))].strip()

                    # Calculate result
                    if '+' in operator or 'plus' in operator.lower():
                        result = num1 + num2
                    elif '-' in operator or 'minus' in operator.lower():
                        result = num1 - num2
                    elif '*' in operator or 'times' in operator.lower():
                        result = num1 * num2
                    elif '/' in operator or 'divided' in operator.lower():
                        result = num1 // num2 if num2 != 0 else 0
                    else:
                        continue

                    return CaptchaSolution(
                        challenge_id=challenge.challenge_id,
                        solution=str(result),
                        confidence=0.95,  # High confidence for math problems
                        solver_used=SolverType.AI_ML,
                        processing_time_ms=0,
                        metadata={"expression": match.group(0), "result": result}
                    )

        except Exception as e:
            self.logger.error(f"Error solving math CAPTCHA: {e}")

        return None

    async def _solve_slider_captcha(self, challenge: CaptchaChallenge, config: CaptchaConfig) -> Optional[CaptchaSolution]:
        """Solve slider CAPTCHA"""
        try:
            # Slider CAPTCHAs typically require user interaction
            # For now, return a basic solution that would need to be applied via browser automation
            return CaptchaSolution(
                challenge_id=challenge.challenge_id,
                solution="slider_action_required",
                confidence=0.5,  # Lower confidence as this is not a complete solution
                solver_used=SolverType.AI_ML,
                processing_time_ms=0,
                metadata={"requires_browser_interaction": True}
            )

        except Exception as e:
            self.logger.error(f"Error solving slider CAPTCHA: {e}")

        return None

    async def _solve_with_ai(self, challenge: CaptchaChallenge, config: CaptchaConfig) -> Optional[CaptchaSolution]:
        """Solve CAPTCHA using AI/ML models"""
        try:
            if not self.ai_selector:
                return None

            # For now, this is a placeholder for AI-based solving
            # In a real implementation, this would use trained models
            self.logger.info(f"AI solving not implemented for {challenge.captcha_type}")
            return None

        except Exception as e:
            self.logger.error(f"Error in AI solving: {e}")

        return None

    async def _solve_with_third_party(self, challenge: CaptchaChallenge, config: CaptchaConfig) -> Optional[CaptchaSolution]:
        """Solve CAPTCHA using third-party service"""
        try:
            if not config.api_key or not config.third_party_service:
                return None

            # Placeholder for third-party service integration
            # Examples: 2Captcha, Anti-Captcha, DeathByCaptcha, etc.
            self.logger.info(f"Third-party solving not implemented for {config.third_party_service}")
            return None

        except Exception as e:
            self.logger.error(f"Error in third-party solving: {e}")

        return None

    def _preprocess_image_for_ocr(self, image: Image.Image) -> Image.Image:
        """Preprocess image to improve OCR accuracy"""
        try:
            # Convert to grayscale
            if image.mode != 'L':
                image = image.convert('L')

            # Enhance contrast
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(2.0)

            # Apply threshold to make it binary
            image = image.point(lambda x: 0 if x < 128 else 255, '1')

            # Remove noise
            image = image.filter(ImageFilter.MedianFilter())

            return image

        except Exception as e:
            self.logger.error(f"Error preprocessing image: {e}")
            return image

    def _calculate_ocr_confidence(self, image: Image.Image, text: str) -> float:
        """Calculate confidence score for OCR result"""
        try:
            # Basic confidence calculation based on text properties
            confidence = 0.5  # Base confidence

            # Length factor
            if 4 <= len(text) <= 8:  # Typical CAPTCHA length
                confidence += 0.2

            # Character diversity
            has_letters = any(c.isalpha() for c in text)
            has_numbers = any(c.isdigit() for c in text)
            if has_letters and has_numbers:
                confidence += 0.1

            # No special characters (CAPTCHAs usually don't have them)
            if text.isalnum():
                confidence += 0.1

            return min(1.0, confidence)

        except Exception as e:
            self.logger.error(f"Error calculating OCR confidence: {e}")
            return 0.5

    async def _get_image_data(self, page: Page, src: str) -> Optional[bytes]:
        """Get image data from src URL"""
        try:
            if src.startswith('data:'):
                # Base64 encoded image
                base64_data = src.split(',')[1]
                return base64.b64decode(base64_data)
            else:
                # URL-based image
                async with page.context.request.get(src) as response:
                    if response.status == 200:
                        return await response.body()

        except Exception as e:
            self.logger.debug(f"Error getting image data from {src}: {e}")

        return None

    def _generate_challenge_id(self) -> str:
        """Generate a unique challenge ID"""
        return hashlib.md5(f"{time.time()}{id(self)}".encode()).hexdigest()[:16]

    def _update_stats(self, success: bool, solve_time: int):
        """Update solving statistics"""
        self.stats["total_challenges"] += 1
        if success:
            self.stats["successful_solves"] += 1
        else:
            self.stats["failed_solves"] += 1

        # Update average solve time
        total_time = self.stats["average_solve_time"] * (self.stats["total_challenges"] - 1) + solve_time
        self.stats["average_solve_time"] = total_time / self.stats["total_challenges"]

    def get_statistics(self) -> Dict[str, Any]:
        """Get CAPTCHA solving statistics"""
        if self.stats["total_challenges"] > 0:
            success_rate = (self.stats["successful_solves"] / self.stats["total_challenges"]) * 100
        else:
            success_rate = 0.0

        return {
            **self.stats,
            "success_rate": success_rate,
            "cache_size": len(self.solution_cache)
        }

    async def apply_solution(self, page: Page, result: CaptchaResult) -> bool:
        """Apply CAPTCHA solution to the page"""
        try:
            if not result.success or not result.solution:
                return False

            challenge = result.challenge
            solution = result.solution.solution

            if challenge.captcha_type == CaptchaType.TEXT:
                # Find input field and enter text
                input_selectors = [
                    'input[name*="captcha"]',
                    'input[id*="captcha"]',
                    '.captcha-input',
                    '#captcha-input'
                ]

                for selector in input_selectors:
                    input_element = await page.query_selector(selector)
                    if input_element:
                        await input_element.fill(solution)
                        return True

            elif challenge.captcha_type == CaptchaType.MATH:
                # Similar to text CAPTCHA
                input_selectors = [
                    'input[name*="answer"]',
                    'input[name*="captcha"]',
                    '.math-answer',
                    '#answer'
                ]

                for selector in input_selectors:
                    input_element = await page.query_selector(selector)
                    if input_element:
                        await input_element.fill(solution)
                        return True

            # Add more cases for other CAPTCHA types as needed
            self.logger.warning(f"Solution application not implemented for {challenge.captcha_type}")
            return False

        except Exception as e:
            self.logger.error(f"Error applying CAPTCHA solution: {e}")
            return False