"""
Self-Healing Automation Service

This service provides AI-powered self-healing capabilities for browser automation,
including automatic element detection, selector repair, visual matching,
and learning from execution history.
"""

import asyncio
import hashlib
import json
import logging
import base64
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.services.llm import llm_service
from app.core.redis import redis_client

logger = logging.getLogger(__name__)


class ElementMatch(BaseModel):
    """Element match result."""
    selector: str
    confidence: float
    element_text: Optional[str] = None
    element_attributes: Dict[str, Any] = Field(default_factory=dict)
    visual_signature: Optional[str] = None
    repair_strategy: Optional[str] = None


class SelectorRepairResult(BaseModel):
    """Selector repair result."""
    original_selector: str
    repaired_selector: str
    repair_strategy: str
    confidence: float
    test_results: List[Dict[str, Any]] = Field(default_factory=list)
    repair_history: List[str] = Field(default_factory=list)


class ExecutionHistory(BaseModel):
    """Browser execution history entry."""
    execution_id: UUID
    selector: str
    url: str
    success: bool
    timestamp: datetime
    page_snapshot: Optional[str] = None
    element_snapshot: Optional[str] = None
    error_type: Optional[str] = None
    repaired_selector: Optional[str] = None
    confidence: float = 0.0


class VisualSignature(BaseModel):
    """Visual element signature."""
    element_hash: str
    visual_features: Dict[str, Any]
    text_content: Optional[str] = None
    xpath: Optional[str] = None
    css_path: Optional[str] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SelfHealingService:
    """
    AI-powered self-healing service for browser automation.

    Provides intelligent element detection, automatic selector repair,
    visual matching, and learning from execution history.
    """

    def __init__(self):
        self.execution_history: Dict[str, List[ExecutionHistory]] = {}
        self.visual_signatures: Dict[str, VisualSignature] = {}
        self.selector_patterns: Dict[str, Dict[str, Any]] = {}
        self.repair_strategies = [
            "ai_detection",
            "visual_matching",
            "attribute_based",
            "text_based",
            "structural_based",
            "xpath_generation",
            "css_path_generation",
            "fuzzy_matching"
        ]

        # Initialize learning data
        self._load_historical_data()

        logger.info("Self-healing service initialized")

    def _load_historical_data(self):
        """Load historical execution data from storage."""
        try:
            # Load execution history from Redis
            history_keys = redis_client.keys("self_healing:history:*")
            for key in history_keys:
                try:
                    data = redis_client.get(key)
                    if data:
                        history_entry = ExecutionHistory(**json.loads(data))
                        url_hash = hashlib.md5(history_entry.url.encode()).hexdigest()
                        if url_hash not in self.execution_history:
                            self.execution_history[url_hash] = []
                        self.execution_history[url_hash].append(history_entry)
                except Exception as e:
                    logger.warning(f"Failed to load history entry {key}: {e}")

            # Load visual signatures from Redis
            signature_keys = redis_client.keys("self_healing:signatures:*")
            for key in signature_keys:
                try:
                    data = redis_client.get(key)
                    if data:
                        signature = VisualSignature(**json.loads(data))
                        self.visual_signatures[signature.element_hash] = signature
                except Exception as e:
                    logger.warning(f"Failed to load visual signature {key}: {e}")

            logger.info(f"Loaded {len(self.execution_history)} history entries and {len(self.visual_signatures)} visual signatures")

        except Exception as e:
            logger.error(f"Failed to load historical data: {e}")

    async def detect_element(
        self,
        page_content: str,
        page_url: str,
        original_selector: Optional[str] = None,
        description: Optional[str] = None,
        visual_context: Optional[Dict[str, Any]] = None
    ) -> List[ElementMatch]:
        """
        Detect elements using AI-powered analysis.

        Args:
            page_content: HTML content of the page
            page_url: Current page URL
            original_selector: Original failed selector (if any)
            description: Element description for AI detection
            visual_context: Visual context information (screenshots, etc.)

        Returns:
            List of potential element matches with confidence scores
        """
        try:
            matches = []

            # Strategy 1: AI-powered element detection
            if description:
                ai_matches = await self._ai_element_detection(
                    page_content, description, page_url
                )
                matches.extend(ai_matches)

            # Strategy 2: Historical pattern matching
            if original_selector:
                pattern_matches = await self._pattern_based_detection(
                    page_content, original_selector, page_url
                )
                matches.extend(pattern_matches)

            # Strategy 3: Visual matching (if visual context provided)
            if visual_context:
                visual_matches = await self._visual_element_matching(
                    page_content, visual_context, page_url
                )
                matches.extend(visual_matches)

            # Strategy 4: Fallback detection strategies
            fallback_matches = await self._fallback_detection_strategies(
                page_content, original_selector, description, page_url
            )
            matches.extend(fallback_matches)

            # Deduplicate and rank matches
            ranked_matches = self._rank_and_deduplicate_matches(matches)

            logger.info(f"Found {len(ranked_matches)} element matches for {original_selector or description}")
            return ranked_matches

        except Exception as e:
            logger.error(f"Element detection failed: {e}")
            return []

    async def repair_selector(
        self,
        failed_selector: str,
        page_content: str,
        page_url: str,
        error_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> SelectorRepairResult:
        """
        Repair a failed selector using multiple strategies.

        Args:
            failed_selector: The selector that failed
            page_content: Current page HTML content
            page_url: Current page URL
            error_type: Type of error that occurred
            context: Additional context information

        Returns:
            Selector repair result with new selector and confidence
        """
        try:
            repair_strategies_used = []
            test_results = []

            # Strategy 1: Direct selector repair
            repaired_selector = await self._direct_selector_repair(
                failed_selector, page_content, page_url
            )
            if repaired_selector != failed_selector:
                repair_strategies_used.append("direct_repair")
                test_results.append({
                    "strategy": "direct_repair",
                    "selector": repaired_selector,
                    "confidence": 0.8
                })

            # Strategy 2: AI-powered selector generation
            if not repaired_selector or repaired_selector == failed_selector:
                ai_selector = await self._ai_selector_generation(
                    failed_selector, page_content, page_url, error_type, context
                )
                if ai_selector:
                    repaired_selector = ai_selector
                    repair_strategies_used.append("ai_generation")
                    test_results.append({
                        "strategy": "ai_generation",
                        "selector": repaired_selector,
                        "confidence": 0.7
                    })

            # Strategy 3: Pattern-based repair
            if not repaired_selector or repaired_selector == failed_selector:
                pattern_selector = await self._pattern_based_repair(
                    failed_selector, page_content, page_url
                )
                if pattern_selector:
                    repaired_selector = pattern_selector
                    repair_strategies_used.append("pattern_repair")
                    test_results.append({
                        "strategy": "pattern_repair",
                        "selector": repaired_selector,
                        "confidence": 0.6
                    })

            # Strategy 4: Fallback strategies
            if not repaired_selector or repaired_selector == failed_selector:
                fallback_selector = await self._fallback_repair_strategies(
                    failed_selector, page_content, page_url, error_type
                )
                if fallback_selector:
                    repaired_selector = fallback_selector
                    repair_strategies_used.append("fallback")
                    test_results.append({
                        "strategy": "fallback",
                        "selector": repaired_selector,
                        "confidence": 0.5
                    })

            # Calculate overall confidence
            confidence = max([result["confidence"] for result in test_results]) if test_results else 0.0

            result = SelectorRepairResult(
                original_selector=failed_selector,
                repaired_selector=repaired_selector or failed_selector,
                repair_strategy=",".join(repair_strategies_used) if repair_strategies_used else "none",
                confidence=confidence,
                test_results=test_results
            )

            # Store repair result for learning
            await self._store_repair_result(result, page_url)

            logger.info(f"Selector repair completed: {failed_selector} -> {repaired_selector} (confidence: {confidence})")
            return result

        except Exception as e:
            logger.error(f"Selector repair failed: {e}")
            return SelectorRepairResult(
                original_selector=failed_selector,
                repaired_selector=failed_selector,
                repair_strategy="error",
                confidence=0.0,
                test_results=[{"strategy": "error", "error": str(e)}]
            )

    async def learn_from_execution(
        self,
        execution_id: UUID,
        selector: str,
        url: str,
        success: bool,
        page_snapshot: Optional[str] = None,
        element_snapshot: Optional[str] = None,
        error_type: Optional[str] = None,
        repaired_selector: Optional[str] = None,
        confidence: float = 0.0
    ):
        """
        Learn from execution results to improve future detection and repair.

        Args:
            execution_id: Unique execution identifier
            selector: The selector that was used
            url: Page URL where execution occurred
            success: Whether the execution was successful
            page_snapshot: Snapshot of the page at execution time
            element_snapshot: Snapshot of the target element
            error_type: Type of error if execution failed
            repaired_selector: Selector that was repaired (if any)
            confidence: Confidence score of the repair/detection
        """
        try:
            # Create history entry
            history_entry = ExecutionHistory(
                execution_id=execution_id,
                selector=selector,
                url=url,
                success=success,
                timestamp=datetime.utcnow(),
                page_snapshot=page_snapshot,
                element_snapshot=element_snapshot,
                error_type=error_type,
                repaired_selector=repaired_selector,
                confidence=confidence
            )

            # Store in memory
            url_hash = hashlib.md5(url.encode()).hexdigest()
            if url_hash not in self.execution_history:
                self.execution_history[url_hash] = []
            self.execution_history[url_hash].append(history_entry)

            # Store in Redis for persistence
            await self._store_execution_history(history_entry)

            # Update patterns and signatures
            if element_snapshot:
                await self._update_visual_signatures(selector, element_snapshot, url, success)

            # Update selector patterns
            await self._update_selector_patterns(selector, url, success, repaired_selector)

            # Cleanup old entries
            await self._cleanup_old_data()

            logger.info(f"Learned from execution {execution_id}: success={success}, confidence={confidence}")

        except Exception as e:
            logger.error(f"Learning from execution failed: {e}")

    async def _ai_element_detection(
        self, page_content: str, description: str, page_url: str
    ) -> List[ElementMatch]:
        """Use AI to detect elements based on description."""
        try:
            # Create AI prompt for element detection
            prompt = f"""
            You are a web automation expert. Analyze the following web page and find elements that match this description:

            Element Description: {description}
            Page URL: {page_url}

            Page Content (first 3000 characters):
            {page_content[:3000]}

            Find the best CSS selectors for elements matching the description. Consider:
            1. Text content matching
            2. Semantic HTML structure
            3. Common CSS classes and IDs
            4. Accessibility attributes
            5. Structural relationships

            Return a JSON array of matches with:
            - selector: CSS selector
            - confidence: confidence score (0-1)
            - reasoning: why this selector matches
            """

            result = await llm_service.generate_completion(
                prompt=prompt,
                temperature=0.2,
                max_tokens=1000
            )

            # Parse AI response
            matches = []
            try:
                ai_matches = json.loads(result.get("content", "[]"))
                for match in ai_matches:
                    element_match = ElementMatch(
                        selector=match.get("selector", ""),
                        confidence=match.get("confidence", 0.0),
                        repair_strategy="ai_detection"
                    )
                    matches.append(element_match)
            except json.JSONDecodeError:
                logger.warning("Failed to parse AI element detection response")
                # Try to extract selectors from text response
                selectors = self._extract_selectors_from_text(result.get("content", ""))
                for selector in selectors:
                    element_match = ElementMatch(
                        selector=selector,
                        confidence=0.6,
                        repair_strategy="ai_detection"
                    )
                    matches.append(element_match)

            return matches

        except Exception as e:
            logger.error(f"AI element detection failed: {e}")
            return []

    async def _pattern_based_detection(
        self, page_content: str, original_selector: str, page_url: str
    ) -> List[ElementMatch]:
        """Detect elements using historical patterns."""
        try:
            url_hash = hashlib.md5(page_url.encode()).hexdigest()

            if url_hash not in self.execution_history:
                return []

            # Find similar successful selectors from history
            similar_selectors = []
            for history_entry in self.execution_history[url_hash]:
                if history_entry.success and history_entry.confidence > 0.7:
                    # Calculate similarity between original and historical selector
                    similarity = self._calculate_selector_similarity(
                        original_selector, history_entry.selector
                    )
                    if similarity > 0.5:
                        similar_selectors.append({
                            "selector": history_entry.selector,
                            "confidence": history_entry.confidence * similarity,
                            "strategy": "pattern_based"
                        })

            # Sort by confidence and return top matches
            similar_selectors.sort(key=lambda x: x["confidence"], reverse=True)

            matches = []
            for selector_data in similar_selectors[:5]:  # Top 5 matches
                element_match = ElementMatch(
                    selector=selector_data["selector"],
                    confidence=selector_data["confidence"],
                    repair_strategy=selector_data["strategy"]
                )
                matches.append(element_match)

            return matches

        except Exception as e:
            logger.error(f"Pattern-based detection failed: {e}")
            return []

    async def _visual_element_matching(
        self, page_content: str, visual_context: Dict[str, Any], page_url: str
    ) -> List[ElementMatch]:
        """Match elements based on visual signatures."""
        try:
            if not visual_context.get("element_hash"):
                return []

            element_hash = visual_context["element_hash"]

            # Find similar visual signatures from history
            similar_signatures = []
            for signature_hash, signature in self.visual_signatures.items():
                similarity = self._calculate_visual_similarity(
                    element_hash, signature_hash
                )
                if similarity > 0.6:
                    similar_signatures.append({
                        "signature": signature,
                        "similarity": similarity,
                        "strategy": "visual_matching"
                    })

            # Sort by similarity and return matches
            similar_signatures.sort(key=lambda x: x["similarity"], reverse=True)

            matches = []
            for sig_data in similar_signatures[:3]:  # Top 3 visual matches
                signature = sig_data["signature"]

                # Try to find element using stored xpath or css_path
                selector = signature.xpath or signature.css_path or ""
                if selector:
                    element_match = ElementMatch(
                        selector=selector,
                        confidence=sig_data["similarity"] * 0.8,  # Slightly lower confidence for visual matching
                        visual_signature=signature.element_hash,
                        repair_strategy=sig_data["strategy"]
                    )
                    matches.append(element_match)

            return matches

        except Exception as e:
            logger.error(f"Visual element matching failed: {e}")
            return []

    async def _fallback_detection_strategies(
        self, page_content: str, original_selector: Optional[str],
        description: Optional[str], page_url: str
    ) -> List[ElementMatch]:
        """Apply fallback detection strategies."""
        try:
            matches = []

            # Strategy 1: Text-based matching
            if description:
                text_matches = self._find_elements_by_text(page_content, description)
                matches.extend(text_matches)

            # Strategy 2: Attribute-based matching
            if original_selector:
                attr_matches = self._find_elements_by_attributes(page_content, original_selector)
                matches.extend(attr_matches)

            # Strategy 3: Structural matching
            if original_selector:
                struct_matches = self._find_elements_by_structure(page_content, original_selector)
                matches.extend(struct_matches)

            # Strategy 4: Generic common selectors
            generic_matches = self._find_common_selectors(page_content, description)
            matches.extend(generic_matches)

            return matches

        except Exception as e:
            logger.error(f"Fallback detection strategies failed: {e}")
            return []

    async def _direct_selector_repair(
        self, failed_selector: str, page_content: str, page_url: str
    ) -> str:
        """Attempt direct repair of the selector."""
        try:
            # Common selector repair patterns
            repairs = [
                # ID repairs
                (r'#(\w+)', lambda m: f'[id="{m.group(1)}"]'),
                (r'#([^\s\]]+)', lambda m: f'[id*="{m.group(1)}"]'),

                # Class repairs
                (r'\.(\w+)', lambda m: f'[class*="{m.group(1)}"]'),
                (r'\.([^\s\]]+)', lambda m: f'[class*="{m.group(1)}"]'),

                # Attribute repairs
                (r'\[(\w+)=(["\']?)([^\]]*?)\2\]', lambda m: f'[{m.group(1)}*="{m.group(3)}"]'),

                # Tag repairs
                (r'^(\w+)', lambda m: f'{m.group(1)}'),

                # Combination repairs
                (r'(\w+)([#\.])([\w-]+)', lambda m: f'{m.group(1)}[{m.group(2)}="{m.group(3)}"]'),
            ]

            repaired_selector = failed_selector

            for pattern, replacement in repairs:
                if re.search(pattern, repaired_selector):
                    # Try the repair
                    test_selector = re.sub(pattern, replacement, repaired_selector)
                    if test_selector != repaired_selector:
                        # Validate if this might work by checking if pattern exists in content
                        if self._validate_selector_in_content(test_selector, page_content):
                            repaired_selector = test_selector
                            break

            return repaired_selector

        except Exception as e:
            logger.error(f"Direct selector repair failed: {e}")
            return failed_selector

    async def _ai_selector_generation(
        self, failed_selector: str, page_content: str, page_url: str,
        error_type: Optional[str], context: Optional[Dict[str, Any]]
    ) -> Optional[str]:
        """Use AI to generate a new selector."""
        try:
            prompt = f"""
            You are a web automation expert. The following CSS selector failed on a web page:

            Failed Selector: {failed_selector}
            Error Type: {error_type or 'Unknown'}
            Page URL: {page_url}

            Page Content (first 3000 characters):
            {page_content[:3000]}

            Context: {context or 'No additional context'}

            Generate a new, more robust CSS selector that would likely work on this page.
            Consider:
            1. More specific or more generic selectors as needed
            2. Alternative attributes (data-testid, role, aria-label)
            3. Structural relationships
            4. Text content matching
            5. Common web development patterns

            Return only the CSS selector, no explanation.
            """

            result = await llm_service.generate_completion(
                prompt=prompt,
                temperature=0.3,
                max_tokens=200
            )

            new_selector = result.get("content", "").strip()

            # Validate the generated selector
            if self._validate_selector_format(new_selector):
                return new_selector

            return None

        except Exception as e:
            logger.error(f"AI selector generation failed: {e}")
            return None

    async def _pattern_based_repair(
        self, failed_selector: str, page_content: str, page_url: str
    ) -> Optional[str]:
        """Repair selector based on historical patterns."""
        try:
            url_hash = hashlib.md5(page_url.encode()).hexdigest()

            if url_hash not in self.execution_history:
                return None

            # Find successful selectors for similar elements
            for history_entry in self.execution_history[url_hash]:
                if (history_entry.success and
                    history_entry.confidence > 0.8 and
                    history_entry.repaired_selector):

                    # Check if this repaired selector could work for our failed one
                    if self._could_selector_work_for_failed(
                        history_entry.repaired_selector, failed_selector, page_content
                    ):
                        return history_entry.repaired_selector

            return None

        except Exception as e:
            logger.error(f"Pattern-based repair failed: {e}")
            return None

    async def _fallback_repair_strategies(
        self, failed_selector: str, page_content: str, page_url: str, error_type: Optional[str]
    ) -> Optional[str]:
        """Apply fallback repair strategies."""
        try:
            # Strategy 1: Remove complex pseudo-selectors
            selector = re.sub(r':[a-zA-Z-]+(\([^)]*\))?', '', failed_selector)

            # Strategy 2: Use attribute selectors instead of class/id
            selector = re.sub(r'#([^\s\[]+)', r'[id="\1"]', selector)
            selector = re.sub(r'\.([^\s\[]+)', r'[class="\1"]', selector)

            # Strategy 3: Use contains matching for partial matches
            selector = re.sub(r'\[class="([^"]+)"\]', r'[class*="\1"]', selector)
            selector = re.sub(r'\[id="([^"]+)"\]', r'[id*="\1"]', selector)

            # Strategy 4: Add generic tag selectors
            if not selector.startswith(('[', '#', '.')):
                common_tags = ['button', 'input', 'a', 'div', 'span']
                for tag in common_tags:
                    test_selector = f"{tag}{selector}"
                    if self._validate_selector_in_content(test_selector, page_content):
                        return test_selector

            # Strategy 5: Use text-based selectors
            text_selectors = self._generate_text_based_selectors(page_content)
            if text_selectors:
                return text_selectors[0]

            return selector if selector != failed_selector else None

        except Exception as e:
            logger.error(f"Fallback repair strategies failed: {e}")
            return None

    def _rank_and_deduplicate_matches(self, matches: List[ElementMatch]) -> List[ElementMatch]:
        """Rank and deduplicate element matches."""
        try:
            # Deduplicate by selector
            seen_selectors = set()
            unique_matches = []

            for match in matches:
                if match.selector not in seen_selectors:
                    seen_selectors.add(match.selector)
                    unique_matches.append(match)

            # Sort by confidence (descending) and then by strategy priority
            strategy_priority = {
                "ai_detection": 1,
                "visual_matching": 2,
                "pattern_based": 3,
                "attribute_based": 4,
                "text_based": 5,
                "structural_based": 6,
                "fuzzy_matching": 7
            }

            unique_matches.sort(key=lambda x: (
                -x.confidence,
                strategy_priority.get(x.repair_strategy, 99)
            ))

            return unique_matches

        except Exception as e:
            logger.error(f"Failed to rank and deduplicate matches: {e}")
            return matches

    def _calculate_selector_similarity(self, selector1: str, selector2: str) -> float:
        """Calculate similarity between two selectors."""
        try:
            # Simple similarity calculation based on common parts
            parts1 = set(re.split(r'[>#\.\s\[\]]+', selector1))
            parts2 = set(re.split(r'[>#\.\s\[\]]+', selector2))

            if not parts1 or not parts2:
                return 0.0

            intersection = parts1.intersection(parts2)
            union = parts1.union(parts2)

            return len(intersection) / len(union) if union else 0.0

        except Exception as e:
            logger.error(f"Failed to calculate selector similarity: {e}")
            return 0.0

    def _calculate_visual_similarity(self, hash1: str, hash2: str) -> float:
        """Calculate similarity between two visual hashes."""
        try:
            # Simple hash similarity calculation
            if len(hash1) != len(hash2):
                return 0.0

            matching_chars = sum(c1 == c2 for c1, c2 in zip(hash1, hash2))
            return matching_chars / len(hash1)

        except Exception as e:
            logger.error(f"Failed to calculate visual similarity: {e}")
            return 0.0

    def _validate_selector_in_content(self, selector: str, content: str) -> bool:
        """Validate if a selector pattern exists in the content."""
        try:
            # Extract selector components
            if '#' in selector:
                id_value = re.search(r'#([^\s\[]+)', selector)
                if id_value and f'id="{id_value.group(1)}"' in content:
                    return True
                if id_value and f"id='{id_value.group(1)}'" in content:
                    return True

            if '.' in selector:
                class_value = re.search(r'\.([^\s\[]+)', selector)
                if class_value and f'class="{class_value.group(1)}"' in content:
                    return True
                if class_value and f"class='{class_value.group(1)}'" in content:
                    return True

            # Check for tag presence
            tag_match = re.match(r'^([a-zA-Z]+)', selector)
            if tag_match:
                tag = tag_match.group(1)
                if f'<{tag}' in content.lower():
                    return True

            return False

        except Exception as e:
            logger.error(f"Failed to validate selector in content: {e}")
            return False

    def _validate_selector_format(self, selector: str) -> bool:
        """Validate basic CSS selector format."""
        try:
            if not selector or not selector.strip():
                return False

            # Basic CSS selector validation
            if not re.match(r'^[a-zA-Z\[#.:#\-\s\*\=\>\+\~\(\)]+$', selector.strip()):
                return False

            # Check for balanced brackets and parentheses
            if selector.count('[') != selector.count(']'):
                return False
            if selector.count('(') != selector.count(')'):
                return False

            return True

        except Exception as e:
            logger.error(f"Failed to validate selector format: {e}")
            return False

    async def _store_execution_history(self, history_entry: ExecutionHistory):
        """Store execution history in Redis."""
        try:
            key = f"self_healing:history:{history_entry.execution_id}"
            data = history_entry.json()
            await redis_client.set(key, data, expire=86400 * 30)  # 30 days

        except Exception as e:
            logger.error(f"Failed to store execution history: {e}")

    async def _update_visual_signatures(
        self, selector: str, element_snapshot: str, url: str, success: bool
    ):
        """Update visual signatures database."""
        try:
            # Generate visual signature from element snapshot
            element_hash = hashlib.md5(element_snapshot.encode()).hexdigest()

            signature = VisualSignature(
                element_hash=element_hash,
                visual_features={},  # TODO: Extract actual visual features
                text_content=self._extract_text_from_snapshot(element_snapshot),
                xpath=selector,  # TODO: Generate actual xpath
                css_path=selector
            )

            self.visual_signatures[element_hash] = signature

            # Store in Redis
            key = f"self_healing:signatures:{element_hash}"
            await redis_client.set(key, signature.json(), expire=86400 * 30)

        except Exception as e:
            logger.error(f"Failed to update visual signatures: {e}")

    async def _update_selector_patterns(
        self, selector: str, url: str, success: bool, repaired_selector: Optional[str]
    ):
        """Update selector pattern database."""
        try:
            pattern_key = f"{hashlib.md5(url.encode()).hexdigest()}:{selector}"

            if pattern_key not in self.selector_patterns:
                self.selector_patterns[pattern_key] = {
                    "selector": selector,
                    "url": url,
                    "success_count": 0,
                    "failure_count": 0,
                    "repaired_selectors": [],
                    "last_updated": datetime.utcnow()
                }

            pattern = self.selector_patterns[pattern_key]
            if success:
                pattern["success_count"] += 1
            else:
                pattern["failure_count"] += 1

            if repaired_selector and repaired_selector not in pattern["repaired_selectors"]:
                pattern["repaired_selectors"].append(repaired_selector)

            pattern["last_updated"] = datetime.utcnow()

            # Store in Redis
            key = f"self_healing:patterns:{pattern_key}"
            await redis_client.set(key, json.dumps(pattern, default=str), expire=86400 * 30)

        except Exception as e:
            logger.error(f"Failed to update selector patterns: {e}")

    async def _cleanup_old_data(self):
        """Clean up old historical data."""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=30)

            # Clean execution history
            for url_hash, history_list in self.execution_history.items():
                self.execution_history[url_hash] = [
                    entry for entry in history_list
                    if entry.timestamp > cutoff_date
                ]

            # Clean visual signatures
            cutoff_timestamp = cutoff_date.timestamp()
            signatures_to_remove = [
                hash_key for hash_key, signature in self.visual_signatures.items()
                if signature.created_at.timestamp() < cutoff_timestamp
            ]

            for hash_key in signatures_to_remove:
                del self.visual_signatures[hash_key]

        except Exception as e:
            logger.error(f"Failed to cleanup old data: {e}")

    def _extract_selectors_from_text(self, text: str) -> List[str]:
        """Extract CSS selectors from AI text response."""
        try:
            # Look for CSS selector patterns in text
            selector_patterns = [
                r'["\']([#\[\.][^"\']+)["\']',  # Quoted selectors
                r'selector:\s*([#\[\.][^\s,]+)',  # "selector: #element"
                r'([#\[\.][a-zA-Z][a-zA-Z0-9_\-\[\]="\s]*)',  # Direct selectors
            ]

            selectors = set()
            for pattern in selector_patterns:
                matches = re.findall(pattern, text)
                for match in matches:
                    if self._validate_selector_format(match):
                        selectors.add(match)

            return list(selectors)

        except Exception as e:
            logger.error(f"Failed to extract selectors from text: {e}")
            return []

    def _find_elements_by_text(self, page_content: str, description: str) -> List[ElementMatch]:
        """Find elements by text content matching."""
        try:
            matches = []

            # Extract potential text matches from description
            text_candidates = [description]

            # Add common button/link text patterns
            words = description.lower().split()
            for word in words:
                if len(word) > 2:
                    text_candidates.append(word)

            for text in text_candidates:
                if text.lower() in page_content.lower():
                    # Generate text-based selectors
                    selectors = [
                        f'*[text()="{text}"]',
                        f'*[contains(text(), "{text}")]',
                        f'*[normalize-space()="{text}"]',
                        f'*[contains(normalize-space(), "{text}")]'
                    ]

                    for selector in selectors:
                        element_match = ElementMatch(
                            selector=selector,
                            confidence=0.6,
                            repair_strategy="text_based"
                        )
                        matches.append(element_match)

            return matches

        except Exception as e:
            logger.error(f"Failed to find elements by text: {e}")
            return []

    def _find_elements_by_attributes(self, page_content: str, original_selector: str) -> List[ElementMatch]:
        """Find elements by attribute matching."""
        try:
            matches = []

            # Extract attributes from original selector
            id_match = re.search(r'#([^\s\[]+)', original_selector)
            class_match = re.search(r'\.([^\s\[]+)', original_selector)
            attr_match = re.search(r'\[([^\]]+)\]', original_selector)

            # Generate alternative selectors based on attributes
            if id_match:
                id_value = id_match.group(1)
                alternative_selectors = [
                    f'[id*="{id_value}"]',
                    f'[id^="{id_value}"]',
                    f'[id$="{id_value}"]',
                    f'[data-testid*="{id_value}"]',
                    f'[data-test*="{id_value}"]',
                    f'[data-automation*="{id_value}"]'
                ]

                for selector in alternative_selectors:
                    if self._validate_selector_in_content(selector, page_content):
                        element_match = ElementMatch(
                            selector=selector,
                            confidence=0.7,
                            repair_strategy="attribute_based"
                        )
                        matches.append(element_match)

            if class_match:
                class_value = class_match.group(1)
                alternative_selectors = [
                    f'[class*="{class_value}"]',
                    f'[class^="{class_value}"]',
                    f'[class$="{class_value}"]'
                ]

                for selector in alternative_selectors:
                    if self._validate_selector_in_content(selector, page_content):
                        element_match = ElementMatch(
                            selector=selector,
                            confidence=0.6,
                            repair_strategy="attribute_based"
                        )
                        matches.append(element_match)

            return matches

        except Exception as e:
            logger.error(f"Failed to find elements by attributes: {e}")
            return []

    def _find_elements_by_structure(self, page_content: str, original_selector: str) -> List[ElementMatch]:
        """Find elements by structural relationships."""
        try:
            matches = []

            # Extract structural components from original selector
            components = re.split(r'[>\s+~]', original_selector)

            if len(components) > 1:
                # Try to simplify complex selectors
                simplified_selectors = [
                    components[-1],  # Last component only
                    ' '.join(components[-2:]),  # Last two components
                    components[0],  # First component only
                ]

                for selector in simplified_selectors:
                    if selector.strip() and self._validate_selector_in_content(selector, page_content):
                        element_match = ElementMatch(
                            selector=selector.strip(),
                            confidence=0.5,
                            repair_strategy="structural_based"
                        )
                        matches.append(element_match)

            return matches

        except Exception as e:
            logger.error(f"Failed to find elements by structure: {e}")
            return []

    def _find_common_selectors(self, page_content: str, description: Optional[str]) -> List[ElementMatch]:
        """Find common selector patterns."""
        try:
            matches = []

            # Common interactive element selectors
            common_selectors = [
                "button", "input[type='button']", "input[type='submit']",
                "a[href]", "[role='button']", "[role='link']",
                "[data-testid]", "[data-test]", "[data-automation]",
                ".btn", ".button", ".submit", ".click"
            ]

            # Context-aware selectors based on description
            if description:
                desc_lower = description.lower()
                if "button" in desc_lower or "click" in desc_lower:
                    common_selectors.extend(["button", "[role='button']", ".btn", ".button"])
                if "input" in desc_lower or "form" in desc_lower:
                    common_selectors.extend(["input", "textarea", "select"])
                if "link" in desc_lower or "anchor" in desc_lower:
                    common_selectors.extend(["a", "[role='link']"])
                if "menu" in desc_lower or "nav" in desc_lower:
                    common_selectors.extend(["nav", "menu", "[role='navigation']"])

            for selector in common_selectors:
                if self._validate_selector_in_content(selector, page_content):
                    element_match = ElementMatch(
                        selector=selector,
                        confidence=0.4,
                        repair_strategy="fuzzy_matching"
                    )
                    matches.append(element_match)

            return matches

        except Exception as e:
            logger.error(f"Failed to find common selectors: {e}")
            return []

    def _generate_text_based_selectors(self, page_content: str) -> List[str]:
        """Generate text-based selectors from page content."""
        try:
            selectors = []

            # Look for common button/link text
            common_text = ["submit", "login", "search", "click", "continue", "next", "previous"]

            for text in common_text:
                if text in page_content.lower():
                    selectors.extend([
                        f'*[contains(text(), "{text.title()}")]',
                        f'*[contains(text(), "{text}")]',
                        f'*[contains(normalize-space(), "{text.title()}")]',
                        f'*[contains(normalize-space(), "{text}")]'
                    ])

            return selectors

        except Exception as e:
            logger.error(f"Failed to generate text-based selectors: {e}")
            return []

    def _could_selector_work_for_failed(
        self, repaired_selector: str, failed_selector: str, page_content: str
    ) -> bool:
        """Check if a repaired selector could work for the failed one."""
        try:
            # Check if repaired selector exists in content
            if not self._validate_selector_in_content(repaired_selector, page_content):
                return False

            # Calculate similarity between selectors
            similarity = self._calculate_selector_similarity(repaired_selector, failed_selector)

            # Accept if similarity is reasonable or if repaired selector is more specific
            return similarity > 0.3 or len(repaired_selector) > len(failed_selector)

        except Exception as e:
            logger.error(f"Failed to check if selector could work: {e}")
            return False

    def _extract_text_from_snapshot(self, element_snapshot: str) -> Optional[str]:
        """Extract text content from element snapshot."""
        try:
            # Simple text extraction from HTML snapshot
            import re
            text_match = re.search(r'>([^<]+)<', element_snapshot)
            if text_match:
                return text_match.group(1).strip()
            return None

        except Exception as e:
            logger.error(f"Failed to extract text from snapshot: {e}")
            return None

    async def _store_repair_result(self, result: SelectorRepairResult, page_url: str):
        """Store selector repair result for learning."""
        try:
            key = f"self_healing:repairs:{uuid4()}"
            data = {
                "result": result.dict(),
                "url": page_url,
                "timestamp": datetime.utcnow().isoformat()
            }
            await redis_client.set(key, json.dumps(data, default=str), expire=86400 * 30)

        except Exception as e:
            logger.error(f"Failed to store repair result: {e}")

    def get_statistics(self) -> Dict[str, Any]:
        """Get self-healing service statistics."""
        try:
            total_history = sum(len(history) for history in self.execution_history.values())
            successful_repairs = sum(
                1 for history in self.execution_history.values()
                for entry in history
                if entry.success and entry.repaired_selector
            )

            return {
                "total_execution_history": total_history,
                "visual_signatures": len(self.visual_signatures),
                "selector_patterns": len(self.selector_patterns),
                "successful_repairs": successful_repairs,
                "repair_strategies": len(self.repair_strategies),
                "urls_tracked": len(self.execution_history)
            }

        except Exception as e:
            logger.error(f"Failed to get statistics: {e}")
            return {}

    def _calculate_selector_confidence(
        self, selector: str, matches: int, page_content: str
    ) -> float:
        """Calculate confidence score for a selector."""
        try:
            confidence = 0.5  # Base confidence

            # ID selectors get high confidence
            if '#' in selector:
                confidence += 0.4

            # Unique selectors get higher confidence
            if matches == 1:
                confidence += 0.3
            elif matches <= 3:
                confidence += 0.1
            elif matches > 10:
                confidence -= 0.2

            # Test attributes increase confidence
            test_attrs = ['data-testid', 'data-test', 'data-automation', 'data-cy']
            if any(attr in selector for attr in test_attrs):
                confidence += 0.2

            # Specificity balance
            specificity = self._calculate_selector_specificity(selector)
            if 0.3 <= specificity <= 0.8:
                confidence += 0.1

            return min(1.0, confidence)

        except Exception:
            return 0.5

    def _calculate_selector_specificity(self, selector: str) -> float:
        """Calculate CSS selector specificity (0-1 scale)."""
        try:
            # Simplified specificity calculation
            specificity_score = 0

            # IDs contribute most
            id_count = selector.count('#')
            specificity_score += id_count * 0.3

            # Classes and attributes
            class_attr_count = selector.count('.') + selector.count('[')
            specificity_score += class_attr_count * 0.1

            # Elements contribute least
            element_count = len(re.findall(r'^[a-zA-Z]+|[>+~]\s+[a-zA-Z]+', selector))
            specificity_score += element_count * 0.05

            # Normalize to 0-1 scale
            return min(1.0, specificity_score / 2.0)

        except Exception:
            return 0.5


# Global self-healing service instance
self_healing_service = SelfHealingService()