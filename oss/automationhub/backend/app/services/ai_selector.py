"""
AI-Powered Element Selector Service

This service provides advanced AI capabilities for intelligent element detection,
selector generation, and visual analysis for browser automation.
"""

import asyncio
import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from app.services.llm import llm_service

logger = logging.getLogger(__name__)


class ElementAnalysis(BaseModel):
    """Analysis result for a web element."""
    element_type: str
    text_content: Optional[str] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)
    xpath: Optional[str] = None
    css_path: Optional[str] = None
    confidence: float
    accessibility_features: Dict[str, Any] = Field(default_factory=dict)
    visual_description: Optional[str] = None


class SelectorCandidate(BaseModel):
    """Candidate selector with confidence score."""
    selector: str
    selector_type: str  # css, xpath, text, attribute
    confidence: float
    reasoning: str
    robustness_score: float
    performance_score: float


class AISelectorService:
    """
    AI-powered element selector service.

    Provides intelligent element analysis, selector generation,
    and visual matching capabilities for browser automation.
    """

    def __init__(self):
        self.element_patterns = {
            "interactive_elements": {
                "tags": ["button", "input", "select", "textarea", "a"],
                "attributes": ["onclick", "onchange", "href", "type"],
                "roles": ["button", "link", "textbox", "combobox", "listbox"],
                "test_ids": ["data-testid", "data-test", "data-automation", "data-cy"]
            },
            "content_elements": {
                "tags": ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "div"],
                "semantic_tags": ["header", "footer", "nav", "main", "section", "article"],
                "text_indicators": ["title", "alt", "label", "placeholder"]
            },
            "form_elements": {
                "tags": ["form", "input", "select", "textarea", "button", "label"],
                "attributes": ["name", "id", "for", "type", "required", "disabled"],
                "validation": ["pattern", "minlength", "maxlength", "min", "max"]
            },
            "navigation_elements": {
                "tags": ["nav", "menu", "ul", "ol", "li", "a"],
                "attributes": ["href", "aria-current", "aria-selected"],
                "roles": ["navigation", "menu", "menuitem", "tab"]
            }
        }

        logger.info("AI selector service initialized")

    async def analyze_element(
        self,
        html_content: str,
        element_description: str,
        context: Optional[Dict[str, Any]] = None,
        page_url: Optional[str] = None
    ) -> List[ElementAnalysis]:
        """
        Analyze page content to find elements matching the description.

        Args:
            html_content: HTML content of the page
            element_description: Natural language description of the target element
            context: Additional context (previous actions, page state, etc.)
            page_url: Current page URL for additional context

        Returns:
            List of element analyses with confidence scores
        """
        try:
            # Create comprehensive analysis prompt
            prompt = self._create_analysis_prompt(
                html_content, element_description, context, page_url
            )

            # Get AI analysis
            ai_response = await llm_service.generate_completion(
                prompt=prompt,
                temperature=0.2,
                max_tokens=2000
            )

            # Parse AI response
            analyses = self._parse_ai_analysis(ai_response.get("content", ""))

            # Enhance analyses with additional processing
            enhanced_analyses = []
            for analysis in analyses:
                enhanced = await self._enhance_element_analysis(analysis, html_content)
                enhanced_analyses.append(enhanced)

            # Sort by confidence and return top results
            enhanced_analyses.sort(key=lambda x: x.confidence, reverse=True)

            logger.info(f"AI element analysis completed: {len(enhanced_analyses)} elements found")
            return enhanced_analyses[:10]  # Return top 10 candidates

        except Exception as e:
            logger.error(f"AI element analysis failed: {e}")
            return []

    async def generate_selectors(
        self,
        element_analysis: ElementAnalysis,
        html_content: str,
        requirements: Optional[Dict[str, Any]] = None
    ) -> List[SelectorCandidate]:
        """
        Generate multiple selector candidates for an element.

        Args:
            element_analysis: Analysis of the target element
            html_content: HTML content for validation
            requirements: Specific requirements for the selector

        Returns:
            List of selector candidates with confidence scores
        """
        try:
            selector_candidates = []

            # Strategy 1: ID-based selectors
            if element_analysis.attributes.get("id"):
                id_selectors = self._generate_id_selectors(element_analysis)
                selector_candidates.extend(id_selectors)

            # Strategy 2: Class-based selectors
            if element_analysis.attributes.get("class"):
                class_selectors = self._generate_class_selectors(element_analysis)
                selector_candidates.extend(class_selectors)

            # Strategy 3: Attribute-based selectors
            attr_selectors = self._generate_attribute_selectors(element_analysis)
            selector_candidates.extend(attr_selectors)

            # Strategy 4: Text-based selectors
            if element_analysis.text_content:
                text_selectors = self._generate_text_selectors(element_analysis)
                selector_candidates.extend(text_selectors)

            # Strategy 5: XPath selectors
            xpath_selectors = await self._generate_xpath_selectors(element_analysis, html_content)
            selector_candidates.extend(xpath_selectors)

            # Strategy 6: Structural selectors
            struct_selectors = self._generate_structural_selectors(element_analysis)
            selector_candidates.extend(struct_selectors)

            # Strategy 7: AI-generated selectors
            ai_selectors = await self._generate_ai_selectors(element_analysis, html_content, requirements)
            selector_candidates.extend(ai_selectors)

            # Validate and score selectors
            scored_candidates = []
            for candidate in selector_candidates:
                score = await self._score_selector(candidate, element_analysis, html_content, requirements)
                candidate.confidence = score
                scored_candidates.append(candidate)

            # Sort by confidence and return top candidates
            scored_candidates.sort(key=lambda x: x.confidence, reverse=True)

            logger.info(f"Generated {len(scored_candidates)} selector candidates")
            return scored_candidates[:8]  # Return top 8 candidates

        except Exception as e:
            logger.error(f"Selector generation failed: {e}")
            return []

    async def validate_selector(
        self,
        selector: str,
        html_content: str,
        expected_element_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validate a selector against HTML content.

        Args:
            selector: CSS selector to validate
            html_content: HTML content to validate against
            expected_element_type: Expected type of element

        Returns:
            Validation result with confidence and metadata
        """
        try:
            validation_result = {
                "valid": False,
                "confidence": 0.0,
                "matches": 0,
                "element_type": None,
                "issues": [],
                "suggestions": []
            }

            # Basic selector validation
            if not self._is_valid_css_selector(selector):
                validation_result["issues"].append("Invalid CSS selector syntax")
                return validation_result

            # Check if selector pattern exists in content
            if not self._selector_exists_in_content(selector, html_content):
                validation_result["issues"].append("Selector pattern not found in content")
                return validation_result

            # Count potential matches
            matches = self._count_selector_matches(selector, html_content)
            validation_result["matches"] = matches

            if matches == 0:
                validation_result["issues"].append("No elements match the selector")
                return validation_result

            # Determine element type if possible
            element_type = self._infer_element_type_from_selector(selector)
            validation_result["element_type"] = element_type

            # Check against expected element type
            if expected_element_type and element_type != expected_element_type:
                validation_result["issues"].append(
                    f"Expected element type '{expected_element_type}' but got '{element_type}'"
                )
                validation_result["confidence"] = max(0, validation_result["confidence"] - 0.3)

            # Calculate confidence based on specificity and uniqueness
            confidence = self._calculate_selector_confidence(selector, matches, html_content)
            validation_result["confidence"] = confidence

            # Generate suggestions for improvement
            suggestions = self._generate_selector_suggestions(selector, matches, html_content)
            validation_result["suggestions"] = suggestions

            validation_result["valid"] = confidence > 0.5 and len(validation_result["issues"]) == 0

            return validation_result

        except Exception as e:
            logger.error(f"Selector validation failed: {e}")
            return {
                "valid": False,
                "confidence": 0.0,
                "matches": 0,
                "element_type": None,
                "issues": [f"Validation error: {str(e)}"],
                "suggestions": []
            }

    async def improve_selector(
        self,
        original_selector: str,
        html_content: str,
        error_context: Optional[Dict[str, Any]] = None,
        improvement_goals: Optional[List[str]] = None
    ) -> List[SelectorCandidate]:
        """
        Improve an existing selector based on failure context.

        Args:
            original_selector: The selector that failed
            html_content: Current HTML content
            error_context: Context about the failure
            improvement_goals: Specific goals for improvement

        Returns:
            List of improved selector candidates
        """
        try:
            improvement_candidates = []

            # Analyze the original selector
            selector_analysis = self._analyze_selector_structure(original_selector)

            # Strategy 1: Fix common syntax issues
            if selector_analysis["has_syntax_issues"]:
                fixed_selectors = self._fix_selector_syntax(original_selector)
                for fixed in fixed_selectors:
                    if fixed != original_selector:
                        candidate = SelectorCandidate(
                            selector=fixed,
                            selector_type="css",
                            confidence=0.7,
                            reasoning="Fixed syntax issues",
                            robustness_score=0.8,
                            performance_score=0.9
                        )
                        improvement_candidates.append(candidate)

            # Strategy 2: Increase specificity
            if selector_analysis["too_generic"]:
                specific_selectors = self._increase_selector_specificity(original_selector, html_content)
                improvement_candidates.extend(specific_selectors)

            # Strategy 3: Decrease specificity (if too specific)
            if selector_analysis["too_specific"]:
                generic_selectors = self._decrease_selector_specificity(original_selector)
                improvement_candidates.extend(generic_selectors)

            # Strategy 4: Use alternative attributes
            alternative_selectors = self._generate_alternative_attribute_selectors(
                original_selector, html_content
            )
            improvement_candidates.extend(alternative_selectors)

            # Strategy 5: AI-powered improvement
            ai_improvements = await self._ai_improve_selector(
                original_selector, html_content, error_context, improvement_goals
            )
            improvement_candidates.extend(ai_improvements)

            # Validate all candidates
            validated_candidates = []
            for candidate in improvement_candidates:
                validation = await self.validate_selector(candidate.selector, html_content)
                if validation["valid"]:
                    candidate.confidence = validation["confidence"]
                    validated_candidates.append(candidate)

            # Sort by confidence
            validated_candidates.sort(key=lambda x: x.confidence, reverse=True)

            logger.info(f"Generated {len(validated_candidates)} improved selector candidates")
            return validated_candidates[:5]  # Return top 5 improvements

        except Exception as e:
            logger.error(f"Selector improvement failed: {e}")
            return []

    def _create_analysis_prompt(
        self,
        html_content: str,
        element_description: str,
        context: Optional[Dict[str, Any]],
        page_url: Optional[str]
    ) -> str:
        """Create a comprehensive AI prompt for element analysis."""
        prompt = f"""
        You are an expert web automation analyst. Analyze the following HTML content to find elements that match this description:

        Element Description: {element_description}
        Page URL: {page_url}
        Context: {context or 'No additional context provided'}

        HTML Content (first 4000 characters):
        {html_content[:4000]}

        Please analyze the page and identify elements that match the description. For each matching element, provide:
        1. Element type (button, input, link, text, etc.)
        2. Text content (if any)
        3. Key attributes (id, class, role, data-testid, etc.)
        4. XPath selector
        5. CSS selector
        6. Confidence score (0-1)
        7. Accessibility features
        8. Brief visual description

        Consider:
        - Semantic HTML structure
        - Accessibility attributes
        - Common web development patterns
        - Test automation best practices
        - User interaction patterns

        Return the analysis as a JSON array of element objects.
        """

        return prompt

    def _parse_ai_analysis(self, ai_response: str) -> List[ElementAnalysis]:
        """Parse AI response into ElementAnalysis objects."""
        try:
            analyses = []

            # Try to parse as JSON
            try:
                elements_data = json.loads(ai_response)
                for element_data in elements_data:
                    analysis = ElementAnalysis(
                        element_type=element_data.get("element_type", "unknown"),
                        text_content=element_data.get("text_content"),
                        attributes=element_data.get("attributes", {}),
                        xpath=element_data.get("xpath"),
                        css_path=element_data.get("css_path"),
                        confidence=float(element_data.get("confidence", 0.0)),
                        accessibility_features=element_data.get("accessibility_features", {}),
                        visual_description=element_data.get("visual_description")
                    )
                    analyses.append(analysis)
            except json.JSONDecodeError:
                # Fallback: extract information from text response
                text_elements = self._extract_elements_from_text(ai_response)
                analyses.extend(text_elements)

            return analyses

        except Exception as e:
            logger.error(f"Failed to parse AI analysis: {e}")
            return []

    async def _enhance_element_analysis(
        self, analysis: ElementAnalysis, html_content: str
    ) -> ElementAnalysis:
        """Enhance element analysis with additional processing."""
        try:
            # Extract additional attributes from HTML
            additional_attrs = self._extract_element_attributes(
                analysis.css_path or analysis.xpath, html_content
            )
            analysis.attributes.update(additional_attrs)

            # Improve confidence based on multiple factors
            confidence_factors = []

            # Factor 1: Presence of test-friendly attributes
            test_attrs = ["data-testid", "data-test", "data-automation", "data-cy"]
            if any(attr in analysis.attributes for attr in test_attrs):
                confidence_factors.append(0.2)

            # Factor 2: Semantic HTML
            semantic_tags = ["button", "input", "select", "textarea", "nav", "main", "header"]
            if analysis.element_type.lower() in semantic_tags:
                confidence_factors.append(0.1)

            # Factor 3: Accessibility features
            if analysis.accessibility_features.get("aria_label") or analysis.accessibility_features.get("role"):
                confidence_factors.append(0.1)

            # Factor 4: Unique identifiers
            if analysis.attributes.get("id"):
                confidence_factors.append(0.15)

            # Update confidence
            if confidence_factors:
                analysis.confidence = min(1.0, analysis.confidence + sum(confidence_factors))

            return analysis

        except Exception as e:
            logger.error(f"Failed to enhance element analysis: {e}")
            return analysis

    def _generate_id_selectors(self, analysis: ElementAnalysis) -> List[SelectorCandidate]:
        """Generate ID-based selectors."""
        candidates = []
        element_id = analysis.attributes.get("id")

        if element_id:
            # Direct ID selector
            candidate = SelectorCandidate(
                selector=f"#{element_id}",
                selector_type="css",
                confidence=0.95,
                reasoning="Direct ID selector - most reliable",
                robustness_score=0.95,
                performance_score=0.9
            )
            candidates.append(candidate)

            # ID-based attribute selectors
            id_variants = [
                f'[id="{element_id}"]',
                f'[id*="{element_id}"]',
                f'[id^="{element_id}"]'
            ]

            for variant in id_variants:
                candidate = SelectorCandidate(
                    selector=variant,
                    selector_type="css",
                    confidence=0.85,
                    reasoning="ID-based attribute selector",
                    robustness_score=0.8,
                    performance_score=0.7
                )
                candidates.append(candidate)

        return candidates

    def _generate_class_selectors(self, analysis: ElementAnalysis) -> List[SelectorCandidate]:
        """Generate class-based selectors."""
        candidates = []
        classes = analysis.attributes.get("class", "").split()

        for class_name in classes:
            if class_name.strip():
                # Direct class selector
                candidate = SelectorCandidate(
                    selector=f".{class_name.strip()}",
                    selector_type="css",
                    confidence=0.7,
                    reasoning="Direct class selector",
                    robustness_score=0.6,
                    performance_score=0.8
                )
                candidates.append(candidate)

                # Class-based attribute selector
                candidate = SelectorCandidate(
                    selector=f'[class*="{class_name.strip()}"]',
                    selector_type="css",
                    confidence=0.6,
                    reasoning="Class-based attribute selector",
                    robustness_score=0.7,
                    performance_score=0.6
                )
                candidates.append(candidate)

        return candidates

    def _generate_attribute_selectors(self, analysis: ElementAnalysis) -> List[SelectorCandidate]:
        """Generate attribute-based selectors."""
        candidates = []

        # Test automation attributes
        test_attrs = {
            "data-testid": 0.9,
            "data-test": 0.85,
            "data-automation": 0.85,
            "data-cy": 0.8,
            "data-qa": 0.75
        }

        for attr, confidence_base in test_attrs.items():
            if attr in analysis.attributes:
                value = analysis.attributes[attr]
                candidate = SelectorCandidate(
                    selector=f'[{attr}="{value}"]',
                    selector_type="css",
                    confidence=confidence_base,
                    reasoning=f"Test automation attribute: {attr}",
                    robustness_score=0.9,
                    performance_score=0.7
                )
                candidates.append(candidate)

        # Role attribute
        if "role" in analysis.attributes:
            role = analysis.attributes["role"]
            candidate = SelectorCandidate(
                selector=f'[role="{role}"]',
                selector_type="css",
                confidence=0.7,
                reasoning=f"ARIA role: {role}",
                robustness_score=0.6,
                performance_score=0.8
            )
            candidates.append(candidate)

        # Type attribute (for inputs)
        if "type" in analysis.attributes:
            type_value = analysis.attributes["type"]
            tag = analysis.element_type.lower()
            if tag in ["input", "button"]:
                candidate = SelectorCandidate(
                    selector=f'{tag}[type="{type_value}"]',
                    selector_type="css",
                    confidence=0.6,
                    reasoning=f"Element with type: {type_value}",
                    robustness_score=0.5,
                    performance_score=0.8
                )
                candidates.append(candidate)

        return candidates

    def _generate_text_selectors(self, analysis: ElementAnalysis) -> List[SelectorCandidate]:
        """Generate text-based selectors."""
        candidates = []

        if analysis.text_content:
            text = analysis.text_content.strip()
            if len(text) > 0 and len(text) < 100:  # Reasonable text length
                text_variants = [
                    f'*[text()="{text}"]',
                    f'*[contains(text(), "{text}")]',
                    f'*[normalize-space()="{text}"]',
                    f'*[contains(normalize-space(), "{text}")]'
                ]

                for i, variant in enumerate(text_variants):
                    confidence = 0.6 - (i * 0.1)  # Decreasing confidence for less specific variants
                    candidate = SelectorCandidate(
                        selector=variant,
                        selector_type="css",
                        confidence=confidence,
                        reasoning="Text-based selector",
                        robustness_score=0.4,
                        performance_score=0.5
                    )
                    candidates.append(candidate)

        return candidates

    async def _generate_xpath_selectors(
        self, analysis: ElementAnalysis, html_content: str
    ) -> List[SelectorCandidate]:
        """Generate XPath selectors."""
        candidates = []

        try:
            # Create XPath generation prompt
            prompt = f"""
            Generate reliable XPath selectors for this element:

            Element Type: {analysis.element_type}
            Text Content: {analysis.text_content}
            Attributes: {analysis.attributes}
            CSS Selector: {analysis.css_path}

            HTML Context (first 2000 characters):
            {html_content[:2000]}

            Generate 2-3 XPath selectors with varying specificity:
            1. Absolute XPath (most specific)
            2. Relative XPath with attributes
            3. XPath with text content (if applicable)

            Return as a JSON array of strings.
            """

            result = await llm_service.generate_completion(
                prompt=prompt,
                temperature=0.1,
                max_tokens=500
            )

            # Parse XPath results
            try:
                xpath_selectors = json.loads(result.get("content", "[]"))
                for xpath in xpath_selectors:
                    if isinstance(xpath, str) and xpath.strip():
                        candidate = SelectorCandidate(
                            selector=xpath.strip(),
                            selector_type="xpath",
                            confidence=0.75,
                            reasoning="AI-generated XPath selector",
                            robustness_score=0.7,
                            performance_score=0.6
                        )
                        candidates.append(candidate)
            except json.JSONDecodeError:
                # Extract XPath patterns from text
                xpath_patterns = re.findall(r'([^"\s\]]*(?:/|@)[^"\s\]]*)', result.get("content", ""))
                for xpath in xpath_patterns:
                    if xpath.strip() and len(xpath.strip()) > 3:
                        candidate = SelectorCandidate(
                            selector=xpath.strip(),
                            selector_type="xpath",
                            confidence=0.6,
                            reasoning="XPath pattern from text",
                            robustness_score=0.5,
                            performance_score=0.4
                        )
                        candidates.append(candidate)

        except Exception as e:
            logger.error(f"Failed to generate XPath selectors: {e}")

        return candidates

    def _generate_structural_selectors(self, analysis: ElementAnalysis) -> List[SelectorCandidate]:
        """Generate structural selectors based on element relationships."""
        candidates = []

        # Combine element type with key attributes
        if analysis.element_type:
            element_type = analysis.element_type.lower()

            # Type + ID
            if "id" in analysis.attributes:
                candidate = SelectorCandidate(
                    selector=f'{element_type}#{analysis.attributes["id"]}',
                    selector_type="css",
                    confidence=0.9,
                    reasoning="Element type with ID",
                    robustness_score=0.9,
                    performance_score=0.8
                )
                candidates.append(candidate)

            # Type + Class
            if "class" in analysis.attributes:
                classes = analysis.attributes["class"].split()
                if classes:
                    first_class = classes[0].strip()
                    candidate = SelectorCandidate(
                        selector=f'{element_type}.{first_class}',
                        selector_type="css",
                        confidence=0.8,
                        reasoning="Element type with primary class",
                        robustness_score=0.7,
                        performance_score=0.85
                    )
                    candidates.append(candidate)

            # Type + Role
            if "role" in analysis.attributes:
                candidate = SelectorCandidate(
                    selector=f'{element_type}[role="{analysis.attributes["role"]}"]',
                    selector_type="css",
                    confidence=0.7,
                    reasoning="Element type with ARIA role",
                    robustness_score=0.6,
                    performance_score=0.8
                )
                candidates.append(candidate)

        return candidates

    async def _generate_ai_selectors(
        self,
        analysis: ElementAnalysis,
        html_content: str,
        requirements: Optional[Dict[str, Any]]
    ) -> List[SelectorCandidate]:
        """Generate AI-powered selectors."""
        candidates = []

        try:
            # Create AI selector generation prompt
            prompt = f"""
            Generate robust CSS selectors for this element:

            Element Analysis:
            - Type: {analysis.element_type}
            - Text: {analysis.text_content}
            - Attributes: {analysis.attributes}
            - Current CSS: {analysis.css_path}
            - Current XPath: {analysis.xpath}

            Requirements: {requirements or 'Standard reliability and performance'}

            Generate 3-4 CSS selectors with different approaches:
            1. Most reliable (ID or unique attribute)
            2. Good balance of specificity and robustness
            3. Semantic and accessible
            4. Fallback option

            For each selector, provide:
            - The CSS selector
            - Brief reasoning
            - Expected robustness (0-1)
            - Expected performance (0-1)

            Return as JSON array of objects.
            """

            result = await llm_service.generate_completion(
                prompt=prompt,
                temperature=0.2,
                max_tokens=800
            )

            # Parse AI-generated selectors
            try:
                ai_selectors = json.loads(result.get("content", "[]"))
                for selector_data in ai_selectors:
                    if isinstance(selector_data, dict):
                        candidate = SelectorCandidate(
                            selector=selector_data.get("selector", ""),
                            selector_type="css",
                            confidence=float(selector_data.get("confidence", 0.7)),
                            reasoning=selector_data.get("reasoning", "AI-generated"),
                            robustness_score=float(selector_data.get("robustness", 0.7)),
                            performance_score=float(selector_data.get("performance", 0.7))
                        )
                        candidates.append(candidate)
            except json.JSONDecodeError:
                logger.warning("Failed to parse AI selector generation response")

        except Exception as e:
            logger.error(f"Failed to generate AI selectors: {e}")

        return candidates

    async def _score_selector(
        self,
        candidate: SelectorCandidate,
        analysis: ElementAnalysis,
        html_content: str,
        requirements: Optional[Dict[str, Any]]
    ) -> float:
        """Score a selector candidate based on multiple factors."""
        try:
            score = candidate.confidence  # Start with base confidence

            # Factor 1: Selector type preference
            type_scores = {
                "css": 0.1,
                "xpath": -0.1,  # Generally prefer CSS over XPath
                "text": -0.2,
                "attribute": 0.05
            }
            score += type_scores.get(candidate.selector_type, 0)

            # Factor 2: Robustness score
            score += (candidate.robustness_score - 0.5) * 0.3

            # Factor 3: Performance score
            score += (candidate.performance_score - 0.5) * 0.2

            # Factor 4: Specificity balance
            specificity = self._calculate_selector_specificity(candidate.selector)
            if 0.3 <= specificity <= 0.8:  # Good specificity balance
                score += 0.1
            elif specificity > 0.9:  # Too specific
                score -= 0.1
            elif specificity < 0.2:  # Too generic
                score -= 0.15

            # Factor 5: Requirements alignment
            if requirements:
                if requirements.get("prefer_accessibility") and "role" in candidate.selector:
                    score += 0.1
                if requirements.get("prefer_performance") and candidate.performance_score > 0.8:
                    score += 0.1
                if requirements.get("prefer_robustness") and candidate.robustness_score > 0.8:
                    score += 0.1

            # Ensure score is within bounds
            score = max(0.0, min(1.0, score))

            return score

        except Exception as e:
            logger.error(f"Failed to score selector: {e}")
            return candidate.confidence

    def _is_valid_css_selector(self, selector: str) -> bool:
        """Check if a selector is valid CSS."""
        try:
            # Basic validation
            if not selector or not selector.strip():
                return False

            # Check for balanced characters
            if selector.count('[') != selector.count(']'):
                return False
            if selector.count('(') != selector.count(')'):
                return False

            # Check for invalid characters
            invalid_chars = ['<', '>', '|', '^', '$']
            if any(char in selector for char in invalid_chars):
                return False

            return True

        except Exception:
            return False

    def _selector_exists_in_content(self, selector: str, html_content: str) -> bool:
        """Check if selector pattern exists in HTML content."""
        try:
            # Extract key identifiers from selector
            if '#' in selector:
                id_match = re.search(r'#([^\s\[]+)', selector)
                if id_match and f'id="{id_match.group(1)}"' in html_content:
                    return True

            if '.' in selector:
                class_match = re.search(r'\.([^\s\[]+)', selector)
                if class_match and f'class="{class_match.group(1)}"' in html_content:
                    return True

            if '[' in selector:
                attr_match = re.search(r'\[([^\]]+)\]', selector)
                if attr_match:
                    attr_content = attr_match.group(1)
                    if f'{attr_content}="' in html_content or f"{attr_content}='" in html_content:
                        return True

            # Check for tag presence
            tag_match = re.match(r'^([a-zA-Z]+)', selector)
            if tag_match:
                tag = tag_match.group(1)
                return f'<{tag}' in html_content.lower()

            return False

        except Exception:
            return False

    def _count_selector_matches(self, selector: str, html_content: str) -> int:
        """Estimate number of matches for a selector."""
        try:
            # This is a simplified estimation
            # In a real implementation, you'd use a proper CSS parser

            # ID selectors should match exactly 1
            if '#' in selector and not re.search(r'[.\s\[]+', selector.split('#')[1].split()[0]):
                return 1

            # Very specific selectors
            if len(selector) > 20 and selector.count('[') >= 2:
                return 1

            # Generic selectors
            if selector in ['div', 'span', 'p', 'a']:
                return html_content.lower().count(f'<{selector}')

            # Default estimation
            return 1

        except Exception:
            return 0

    def _infer_element_type_from_selector(self, selector: str) -> str:
        """Infer element type from CSS selector."""
        try:
            # Check for specific tags
            tag_match = re.match(r'^([a-zA-Z]+)', selector)
            if tag_match:
                return tag_match.group(1).lower()

            # Check for common patterns
            if 'input' in selector:
                return 'input'
            if 'button' in selector or '[role="button"]' in selector:
                return 'button'
            if 'a' in selector or '[href' in selector:
                return 'a'

            return 'unknown'

        except Exception:
            return 'unknown'

    def _calculate_selector_confidence(
        self, selector: str, matches: int, html_content: str
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

    def _generate_selector_suggestions(
        self, selector: str, matches: int, html_content: str
    ) -> List[str]:
        """Generate suggestions for improving a selector."""
        suggestions = []

        if matches > 1:
            suggestions.append("Consider adding more specific attributes to reduce matches")

        if matches == 0:
            suggestions.append("Selector doesn't match any elements - check syntax or page structure")

        if not any(attr in selector for attr in ['#', '.', '[']):
            suggestions.append("Consider using more specific selectors with IDs, classes, or attributes")

        if 'data-testid' not in selector and 'data-test' not in selector:
            suggestions.append("Consider using test automation attributes like data-testid for better reliability")

        specificity = self._calculate_selector_specificity(selector)
        if specificity < 0.2:
            suggestions.append("Selector is too generic - add more specificity")
        elif specificity > 0.9:
            suggestions.append("Selector is very specific - might be brittle if page structure changes")

        return suggestions

    def _extract_elements_from_text(self, text: str) -> List[ElementAnalysis]:
        """Extract element information from text response."""
        elements = []

        # Simple pattern matching for common element descriptions
        patterns = [
            r'(button|input|link|text).*?selector:\s*([^\s,]+)',
            r'([a-zA-Z]+)\s+element.*?selector:\s*([^\s,]+)',
            r'element\s+type:\s*([a-zA-Z]+).*?selector:\s*([^\s,]+)'
        ]

        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                if len(match) >= 2:
                    analysis = ElementAnalysis(
                        element_type=match[0].lower(),
                        css_path=match[1],
                        confidence=0.5
                    )
                    elements.append(analysis)

        return elements

    def _extract_element_attributes(self, selector: str, html_content: str) -> Dict[str, Any]:
        """Extract additional attributes for an element from HTML."""
        attributes = {}

        try:
            # This is a simplified extraction
            # In practice, you'd use an HTML parser for accurate extraction

            if '#' in selector:
                id_match = re.search(r'#([^\s\[]+)', selector)
                if id_match:
                    attributes["id"] = id_match.group(1)

            if '.' in selector:
                class_match = re.search(r'\.([^\s\[]+)', selector)
                if class_match:
                    attributes["class"] = class_match.group(1)

            if '[' in selector:
                attr_matches = re.findall(r'\[([^\]]+)\]', selector)
                for attr in attr_matches:
                    if '=' in attr:
                        key, value = attr.split('=', 1)
                        # Remove quotes
                        value = value.strip('"\'')
                        attributes[key] = value

        except Exception as e:
            logger.error(f"Failed to extract element attributes: {e}")

        return attributes

    def _analyze_selector_structure(self, selector: str) -> Dict[str, Any]:
        """Analyze the structure of a selector."""
        analysis = {
            "has_syntax_issues": False,
            "too_generic": False,
            "too_specific": False,
            "complexity": 0,
            "specificity": 0.0
        }

        try:
            # Check for syntax issues
            if selector.count('[') != selector.count(']'):
                analysis["has_syntax_issues"] = True
            if selector.count('(') != selector.count(')'):
                analysis["has_syntax_issues"] = True

            # Calculate complexity
            analysis["complexity"] = len(selector) + selector.count('[') + selector.count(':')

            # Calculate specificity
            analysis["specificity"] = self._calculate_selector_specificity(selector)

            # Determine if too generic or specific
            if analysis["specificity"] < 0.2:
                analysis["too_generic"] = True
            elif analysis["specificity"] > 0.9:
                analysis["too_specific"] = True

        except Exception as e:
            logger.error(f"Failed to analyze selector structure: {e}")

        return analysis

    def _fix_selector_syntax(self, selector: str) -> List[str]:
        """Fix common syntax issues in selectors."""
        fixed_selectors = []

        try:
            # Fix unbalanced brackets
            fixed = selector
            while fixed.count('[') > fixed.count(']'):
                fixed += ']'
            while fixed.count(']') > fixed.count('['):
                fixed = fixed[:-1]

            # Fix unbalanced parentheses
            while fixed.count('(') > fixed.count(')'):
                fixed += ')'
            while fixed.count(')') > fixed.count('('):
                fixed = fixed[:-1]

            if fixed != selector:
                fixed_selectors.append(fixed)

        except Exception as e:
            logger.error(f"Failed to fix selector syntax: {e}")

        return fixed_selectors

    def _increase_selector_specificity(self, selector: str, html_content: str) -> List[SelectorCandidate]:
        """Increase selector specificity."""
        candidates = []

        try:
            # Add element type if missing
            if not re.match(r'^[a-zA-Z]', selector):
                common_tags = ['button', 'input', 'a', 'div', 'span']
                for tag in common_tags:
                    if f'<{tag}' in html_content.lower():
                        candidate = SelectorCandidate(
                            selector=f'{tag}{selector}',
                            selector_type="css",
                            confidence=0.6,
                            reasoning=f"Added element type: {tag}",
                            robustness_score=0.5,
                            performance_score=0.7
                        )
                        candidates.append(candidate)

        except Exception as e:
            logger.error(f"Failed to increase selector specificity: {e}")

        return candidates

    def _decrease_selector_specificity(self, selector: str) -> List[SelectorCandidate]:
        """Decrease selector specificity."""
        candidates = []

        try:
            # Remove some specificity
            components = selector.split()
            if len(components) > 2:
                # Use last component only
                last_component = components[-1]
                candidate = SelectorCandidate(
                    selector=last_component,
                    selector_type="css",
                    confidence=0.5,
                    reasoning="Reduced specificity to last component",
                    robustness_score=0.4,
                    performance_score=0.8
                )
                candidates.append(candidate)

                # Use last two components
                if len(components) > 1:
                    last_two = ' '.join(components[-2:])
                    candidate = SelectorCandidate(
                        selector=last_two,
                        selector_type="css",
                        confidence=0.6,
                        reasoning="Reduced specificity to last two components",
                        robustness_score=0.5,
                        performance_score=0.7
                    )
                    candidates.append(candidate)

        except Exception as e:
            logger.error(f"Failed to decrease selector specificity: {e}")

        return candidates

    def _generate_alternative_attribute_selectors(
        self, original_selector: str, html_content: str
    ) -> List[SelectorCandidate]:
        """Generate alternative attribute-based selectors."""
        candidates = []

        try:
            # Common test attributes to try
            test_attrs = ['data-testid', 'data-test', 'data-automation', 'data-cy', 'data-qa']

            # Extract potential values from original selector
            if '#' in original_selector:
                id_match = re.search(r'#([^\s\[]+)', original_selector)
                if id_match:
                    id_value = id_match.group(1)
                    for attr in test_attrs:
                        candidate = SelectorCandidate(
                            selector=f'[{attr}*="{id_value}"]',
                            selector_type="css",
                            confidence=0.7,
                            reasoning=f"Alternative attribute: {attr}",
                            robustness_score=0.6,
                            performance_score=0.5
                        )
                        candidates.append(candidate)

            if '.' in original_selector:
                class_match = re.search(r'\.([^\s\[]+)', original_selector)
                if class_match:
                    class_value = class_match.group(1)
                    for attr in test_attrs:
                        candidate = SelectorCandidate(
                            selector=f'[{attr}*="{class_value}"]',
                            selector_type="css",
                            confidence=0.6,
                            reasoning=f"Alternative attribute: {attr}",
                            robustness_score=0.5,
                            performance_score=0.4
                        )
                        candidates.append(candidate)

        except Exception as e:
            logger.error(f"Failed to generate alternative attribute selectors: {e}")

        return candidates

    async def _ai_improve_selector(
        self,
        original_selector: str,
        html_content: str,
        error_context: Optional[Dict[str, Any]],
        improvement_goals: Optional[List[str]]
    ) -> List[SelectorCandidate]:
        """Use AI to improve a selector."""
        candidates = []

        try:
            # Create AI improvement prompt
            prompt = f"""
            Improve this failing CSS selector for web automation:

            Original Selector: {original_selector}
            Error Context: {error_context or 'No error context provided'}
            Improvement Goals: {improvement_goals or 'Standard reliability improvements'}

            HTML Content (first 3000 characters):
            {html_content[:3000]}

            Generate 3 improved CSS selectors that are more likely to work reliably.
            For each selector, provide:
            - The improved CSS selector
            - Reasoning for the improvement
            - Expected confidence (0-1)
            - Expected robustness (0-1)
            - Expected performance (0-1)

            Consider:
            - Test automation best practices
            - Common failure patterns
            - Selector robustness vs. specificity balance
            - Performance considerations

            Return as JSON array of objects.
            """

            result = await llm_service.generate_completion(
                prompt=prompt,
                temperature=0.2,
                max_tokens=1000
            )

            # Parse AI improvements
            try:
                improvements = json.loads(result.get("content", "[]"))
                for improvement in improvements:
                    if isinstance(improvement, dict):
                        candidate = SelectorCandidate(
                            selector=improvement.get("selector", ""),
                            selector_type="css",
                            confidence=float(improvement.get("confidence", 0.7)),
                            reasoning=improvement.get("reasoning", "AI-improved"),
                            robustness_score=float(improvement.get("robustness", 0.7)),
                            performance_score=float(improvement.get("performance", 0.7))
                        )
                        candidates.append(candidate)
            except json.JSONDecodeError:
                logger.warning("Failed to parse AI selector improvement response")

        except Exception as e:
            logger.error(f"Failed AI selector improvement: {e}")

        return candidates


# Global AI selector service instance
ai_selector_service = AISelectorService()