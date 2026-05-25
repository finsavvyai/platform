"""
Advanced Regex Pattern Matching Engine for SDLC.ai DLP Service.

This module provides a high-performance regex pattern matching system with
dynamic pattern management, performance optimization, and comprehensive monitoring.
"""

import json
import logging
import re
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from enum import StrEnum
from re import Pattern
from typing import Any

import yaml

from app.core.config import get_settings
from app.models.schemas import ViolationInfo, ViolationSeverity

logger = logging.getLogger(__name__)


class RegexFlag(StrEnum):
    """Regex pattern flags."""

    IGNORECASE = "IGNORECASE"
    MULTILINE = "MULTILINE"
    DOTALL = "DOTALL"
    UNICODE = "UNICODE"
    VERBOSE = "VERBOSE"
    ASCII = "ASCII"
    LOCALE = "LOCALE"


class PatternCategory(StrEnum):
    """Pattern categories for organization."""

    PII = "PII"
    FINANCIAL = "FINANCIAL"
    HEALTH = "HEALTH"
    LEGAL = "LEGAL"
    CONTACT = "CONTACT"
    IDENTIFICATION = "IDENTIFICATION"
    TECHNICAL = "TECHNICAL"
    LOCATION = "LOCATION"
    CUSTOM = "CUSTOM"


class PatternStatus(StrEnum):
    """Pattern status values."""

    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    TESTING = "TESTING"
    DEPRECATED = "DEPRECATED"


@dataclass
class RegexPatternConfig:
    """Configuration for a regex pattern."""

    name: str
    pattern: str
    category: PatternCategory
    subcategory: str | None = None
    description: str | None = None
    flags: dict[RegexFlag, bool] = field(default_factory=dict)
    confidence: float = 0.9
    severity: ViolationSeverity = ViolationSeverity.MEDIUM
    tags: list[str] = field(default_factory=list)
    status: PatternStatus = PatternStatus.ACTIVE
    max_matches: int = 1000
    timeout_ms: int = 100

    # Performance tuning
    min_length: int = 1
    max_length: int = 1000
    require_word_boundaries: bool = True

    # Validation
    test_cases: list[tuple[str, bool]] = field(default_factory=list)
    false_positive_patterns: list[str] = field(default_factory=list)

    # Metadata
    created_by: str | None = None
    version: str = "1.0.0"

    def __post_init__(self):
        """Validate pattern configuration."""
        if not self.name:
            raise ValueError("Pattern name is required")
        if not self.pattern:
            raise ValueError("Pattern regex is required")
        if not self.category:
            raise ValueError("Pattern category is required")
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("Confidence must be between 0.0 and 1.0")


@dataclass
class PatternMatch:
    """Result of a pattern match."""

    pattern_name: str
    start: int
    end: int
    matched_text: str
    confidence: float
    severity: ViolationSeverity
    category: PatternCategory
    metadata: dict[str, Any] = field(default_factory=dict)

    # Context information
    line_number: int | None = None
    column_number: int | None = None
    context_before: str | None = None
    context_after: str | None = None


@dataclass
class PatternMatchResult:
    """Result of pattern matching on text."""

    matches: list[PatternMatch]
    total_matches: int
    patterns_matched: list[str]
    processing_time_ms: int
    text_length: int
    categories_found: list[PatternCategory]

    # Performance metrics
    patterns_tested: int
    cache_hits: int
    cache_misses: int

    def __post_init__(self):
        """Calculate derived values."""
        self.categories_found = list({match.category for match in self.matches})
        self.patterns_matched = list({match.pattern_name for match in self.matches})


class PatternValidator:
    """Validates regex patterns for correctness and performance."""

    @staticmethod
    def validate_pattern(pattern_config: RegexPatternConfig) -> tuple[bool, list[str]]:
        """Validate a regex pattern configuration."""
        errors = []

        try:
            # Test basic regex compilation
            flags = PatternValidator._compile_flags(pattern_config.flags)
            compiled_pattern = re.compile(pattern_config.pattern, flags)

            # Test performance with sample data
            if not PatternValidator._test_pattern_performance(
                compiled_pattern, pattern_config.timeout_ms
            ):
                errors.append("Pattern exceeds timeout threshold")

            # Validate test cases
            test_errors = PatternValidator._validate_test_cases(
                compiled_pattern, pattern_config.test_cases
            )
            errors.extend(test_errors)

            # Check for common regex issues
            regex_errors = PatternValidator._check_regex_issues(pattern_config.pattern)
            errors.extend(regex_errors)

        except re.error as e:
            errors.append(f"Invalid regex: {e}")
        except Exception as e:
            errors.append(f"Validation error: {e}")

        return len(errors) == 0, errors

    @staticmethod
    def _compile_flags(flags: dict[RegexFlag, bool]) -> int:
        """Compile regex flags from configuration."""
        flag_map = {
            RegexFlag.IGNORECASE: re.IGNORECASE,
            RegexFlag.MULTILINE: re.MULTILINE,
            RegexFlag.DOTALL: re.DOTALL,
            RegexFlag.UNICODE: re.UNICODE,
            RegexFlag.VERBOSE: re.VERBOSE,
            RegexFlag.ASCII: re.ASCII,
            RegexFlag.LOCALE: re.LOCALE,
        }

        compiled_flags = 0
        for flag, enabled in flags.items():
            if enabled:
                compiled_flags |= flag_map.get(flag, 0)

        return compiled_flags

    @staticmethod
    def _test_pattern_performance(pattern: Pattern, timeout_ms: int) -> bool:
        """Test pattern performance against timeout."""
        try:
            # Test with ReDoS-prone patterns
            test_text = "a" * 1000 + "b" + "c" * 1000

            start_time = time.time()
            list(pattern.finditer(test_text))
            elapsed_ms = (time.time() - start_time) * 1000

            return elapsed_ms < timeout_ms
        except:
            return False

    @staticmethod
    def _validate_test_cases(
        pattern: Pattern, test_cases: list[tuple[str, bool]]
    ) -> list[str]:
        """Validate pattern against test cases."""
        errors = []

        for test_text, should_match in test_cases:
            matches = list(pattern.finditer(test_text))
            has_matches = len(matches) > 0

            if should_match and not has_matches:
                errors.append(f"Pattern should match '{test_text}' but doesn't")
            elif not should_match and has_matches:
                errors.append(f"Pattern should not match '{test_text}' but does")

        return errors

    @staticmethod
    def _check_regex_issues(pattern_str: str) -> list[str]:
        """Check for common regex issues."""
        issues = []

        # Check for catastrophic backtracking patterns
        dangerous_patterns = [
            r"\(.+\*\)",
            r"\(.+\+\)",
            r"\(.+\?\)",
            r"\*\?\+",
            r"\+\?\*",
            r"\(\.\*\*\)",
            r"\(\.\+\+\)",
        ]

        for dangerous in dangerous_patterns:
            if dangerous in pattern_str:
                issues.append(f"Potential ReDoS pattern detected: {dangerous}")

        # Check for unescaped meta characters
        unescaped_meta = [
            "(",
            ")",
            "[",
            "]",
            "{",
            "}",
            "^",
            "$",
            ".",
            "|",
            "?",
            "*",
            "+",
        ]
        for meta in unescaped_meta:
            if meta in pattern_str and f"\\{meta}" not in pattern_str:
                # This is a rough check, might have false positives
                issues.append(f"Unescaped meta character: {meta}")

        return issues


class PatternCache:
    """Thread-safe cache for compiled patterns and results."""

    def __init__(self, max_size: int = 10000, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._pattern_cache = {}
        self._result_cache = {}
        self._cache_access_times = {}
        self._lock = threading.RLock()

    def get_compiled_pattern(
        self, pattern_config: RegexPatternConfig
    ) -> Pattern | None:
        """Get compiled pattern from cache."""
        cache_key = self._get_pattern_cache_key(pattern_config)

        with self._lock:
            if cache_key in self._pattern_cache:
                cached_data = self._pattern_cache[cache_key]
                if not self._is_expired(cached_data["timestamp"]):
                    self._cache_access_times[cache_key] = time.time()
                    return cached_data["pattern"]
                else:
                    # Remove expired entry
                    del self._pattern_cache[cache_key]
                    if cache_key in self._cache_access_times:
                        del self._cache_access_times[cache_key]

        return None

    def cache_compiled_pattern(
        self, pattern_config: RegexPatternConfig, compiled_pattern: Pattern
    ):
        """Cache a compiled pattern."""
        cache_key = self._get_pattern_cache_key(pattern_config)

        with self._lock:
            self._cleanup_if_needed()

            self._pattern_cache[cache_key] = {
                "pattern": compiled_pattern,
                "timestamp": time.time(),
                "config": pattern_config,
            }
            self._cache_access_times[cache_key] = time.time()

    def get_match_result(
        self, text: str, patterns: list[str]
    ) -> PatternMatchResult | None:
        """Get cached match result."""
        cache_key = self._get_result_cache_key(text, patterns)

        with self._lock:
            if cache_key in self._result_cache:
                cached_data = self._result_cache[cache_key]
                if not self._is_expired(cached_data["timestamp"]):
                    self._cache_access_times[cache_key] = time.time()
                    return cached_data["result"]
                else:
                    del self._result_cache[cache_key]
                    if cache_key in self._cache_access_times:
                        del self._cache_access_times[cache_key]

        return None

    def cache_match_result(
        self, text: str, patterns: list[str], result: PatternMatchResult
    ):
        """Cache a match result."""
        cache_key = self._get_result_cache_key(text, patterns)

        with self._lock:
            self._cleanup_if_needed()

            self._result_cache[cache_key] = {
                "result": result,
                "timestamp": time.time(),
            }
            self._cache_access_times[cache_key] = time.time()

    def _get_pattern_cache_key(self, pattern_config: RegexPatternConfig) -> str:
        """Generate cache key for pattern."""
        # Create a unique key based on pattern and flags
        flags_str = json.dumps(pattern_config.flags, sort_keys=True)
        return (
            f"pattern:{pattern_config.name}:{hash(pattern_config.pattern + flags_str)}"
        )

    def _get_result_cache_key(self, text: str, patterns: list[str]) -> str:
        """Generate cache key for match result."""
        patterns_str = ":".join(sorted(patterns))
        return f"result:{hash(text)}:{hash(patterns_str)}"

    def _is_expired(self, timestamp: float) -> bool:
        """Check if cache entry is expired."""
        return time.time() - timestamp > self.ttl_seconds

    def _cleanup_if_needed(self):
        """Clean up cache if it exceeds max size."""
        total_entries = len(self._pattern_cache) + len(self._result_cache)

        if total_entries > self.max_size:
            # Sort by access time and remove oldest entries
            sorted_keys = sorted(
                self._cache_access_times.keys(),
                key=lambda k: self._cache_access_times[k],
            )

            # Remove oldest 25% of entries
            entries_to_remove = len(sorted_keys) // 4

            for key in sorted_keys[:entries_to_remove]:
                if key in self._pattern_cache:
                    del self._pattern_cache[key]
                if key in self._result_cache:
                    del self._result_cache[key]
                if key in self._cache_access_times:
                    del self._cache_access_times[key]


class RegexPatternEngine:
    """Main regex pattern matching engine."""

    def __init__(self):
        self.settings = get_settings()
        self.patterns: dict[str, RegexPatternConfig] = {}
        self.compiled_patterns: dict[str, Pattern] = {}
        self.cache = PatternCache()
        self.validator = PatternValidator()
        self._stats = defaultdict(int)
        self._stats_lock = threading.Lock()
        self._load_builtin_patterns()

    def _load_builtin_patterns(self):
        """Load built-in patterns for common data types."""
        builtin_patterns = [
            # Email patterns
            RegexPatternConfig(
                name="email_standard",
                pattern=r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
                category=PatternCategory.CONTACT,
                subcategory="EMAIL",
                description="Standard email address pattern",
                confidence=0.95,
                severity=ViolationSeverity.MEDIUM,
                flags={RegexFlag.IGNORECASE: True},
                test_cases=[
                    ("john.doe@example.com", True),
                    ("not-an-email", False),
                ],
            ),
            # Phone number patterns
            RegexPatternConfig(
                name="phone_us",
                pattern=r"\b(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b",
                category=PatternCategory.CONTACT,
                subcategory="PHONE",
                description="US phone number pattern",
                confidence=0.9,
                severity=ViolationSeverity.MEDIUM,
                flags={RegexFlag.IGNORECASE: True},
                test_cases=[
                    ("555-123-4567", True),
                    ("(555) 123-4567", True),
                    ("+1 555-123-4567", True),
                    ("123456", False),
                ],
            ),
            # Credit card patterns
            RegexPatternConfig(
                name="credit_card_general",
                pattern=r"\b(?:\d{4}[-\s]?){3}\d{4}\b",
                category=PatternCategory.FINANCIAL,
                subcategory="CREDIT_CARD",
                description="General credit card number pattern",
                confidence=0.85,
                severity=ViolationSeverity.HIGH,
                flags={RegexFlag.IGNORECASE: True},
                test_cases=[
                    ("4111-1111-1111-1111", True),
                    ("4111 1111 1111 1111", True),
                    ("4111111111111111", True),
                    ("1234", False),
                ],
            ),
            # SSN pattern
            RegexPatternConfig(
                name="ssn_us",
                pattern=r"\b\d{3}-\d{2}-\d{4}\b",
                category=PatternCategory.IDENTIFICATION,
                subcategory="SSN",
                description="US Social Security Number",
                confidence=0.95,
                severity=ViolationSeverity.CRITICAL,
                flags={RegexFlag.IGNORECASE: True},
                test_cases=[
                    ("123-45-6789", True),
                    ("123456789", False),
                    ("12-345-6789", False),
                ],
            ),
            # IP Address pattern
            RegexPatternConfig(
                name="ip_address_ipv4",
                pattern=r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b",
                category=PatternCategory.TECHNICAL,
                subcategory="IP",
                description="IPv4 address pattern",
                confidence=0.8,
                severity=ViolationSeverity.LOW,
                flags={RegexFlag.IGNORECASE: True},
                test_cases=[
                    ("192.168.1.1", True),
                    ("10.0.0.1", True),
                    ("256.256.256.256", True),  # Basic pattern doesn't validate range
                    ("192.168.1", False),
                ],
            ),
            # URL pattern
            RegexPatternConfig(
                name="url_http",
                pattern=r"https?://(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:\w*))?)?",
                category=PatternCategory.TECHNICAL,
                subcategory="URL",
                description="HTTP/HTTPS URL pattern",
                confidence=0.9,
                severity=ViolationSeverity.LOW,
                flags={RegexFlag.IGNORECASE: True},
                test_cases=[
                    ("https://example.com", True),
                    ("http://example.com/path?query=value", True),
                    ("ftp://example.com", False),
                ],
            ),
        ]

        for pattern_config in builtin_patterns:
            self.add_pattern(pattern_config)

        logger.info(f"Loaded {len(builtin_patterns)} built-in patterns")

    def add_pattern(self, pattern_config: RegexPatternConfig) -> tuple[bool, list[str]]:
        """Add a new pattern to the engine."""
        # Validate pattern
        is_valid, errors = self.validator.validate_pattern(pattern_config)
        if not is_valid:
            return False, errors

        # Compile pattern
        try:
            flags = self._compile_flags(pattern_config.flags)
            compiled_pattern = re.compile(pattern_config.pattern, flags)

            # Store pattern
            self.patterns[pattern_config.name] = pattern_config
            self.compiled_patterns[pattern_config.name] = compiled_pattern

            # Cache compiled pattern
            self.cache.cache_compiled_pattern(pattern_config, compiled_pattern)

            logger.info(f"Added pattern: {pattern_config.name}")
            return True, []

        except Exception as e:
            error_msg = f"Failed to compile pattern: {e}"
            logger.error(error_msg)
            return False, [error_msg]

    def remove_pattern(self, pattern_name: str) -> bool:
        """Remove a pattern from the engine."""
        if pattern_name in self.patterns:
            del self.patterns[pattern_name]
            if pattern_name in self.compiled_patterns:
                del self.compiled_patterns[pattern_name]
            logger.info(f"Removed pattern: {pattern_name}")
            return True
        return False

    def update_pattern(
        self, pattern_config: RegexPatternConfig
    ) -> tuple[bool, list[str]]:
        """Update an existing pattern."""
        if pattern_config.name not in self.patterns:
            return False, ["Pattern not found"]

        return self.add_pattern(
            pattern_config
        )  # This will replace the existing pattern

    def get_pattern(self, pattern_name: str) -> RegexPatternConfig | None:
        """Get a pattern configuration by name."""
        return self.patterns.get(pattern_name)

    def list_patterns(
        self,
        category: PatternCategory | None = None,
        status: PatternStatus | None = None,
    ) -> list[RegexPatternConfig]:
        """List patterns with optional filtering."""
        patterns = list(self.patterns.values())

        if category:
            patterns = [p for p in patterns if p.category == category]

        if status:
            patterns = [p for p in patterns if p.status == status]

        return patterns

    def match_text(
        self,
        text: str,
        pattern_names: list[str] | None = None,
        categories: list[PatternCategory] | None = None,
        max_matches: int | None = None,
        timeout_ms: int | None = None,
    ) -> PatternMatchResult:
        """Match patterns against text."""
        start_time = time.time()

        # Determine which patterns to use
        patterns_to_test = self._get_patterns_to_test(pattern_names, categories)

        # Check cache first
        pattern_names_list = [p.name for p in patterns_to_test]
        cached_result = self.cache.get_match_result(text, pattern_names_list)
        if cached_result:
            with self._stats_lock:
                self._stats["cache_hits"] += 1
            return cached_result

        with self._stats_lock:
            self._stats["cache_misses"] += 1

        # Perform matching
        all_matches = []
        patterns_matched = []

        for pattern_config in patterns_to_test:
            if pattern_config.status != PatternStatus.ACTIVE:
                continue

            pattern_name = pattern_config.name

            # Get compiled pattern (from cache or compile new)
            compiled_pattern = self.cache.get_compiled_pattern(pattern_config)
            if compiled_pattern is None:
                compiled_pattern = self.compiled_patterns.get(pattern_name)
                if compiled_pattern:
                    self.cache.cache_compiled_pattern(pattern_config, compiled_pattern)

            if not compiled_pattern:
                continue

            # Check text length constraints
            if (
                len(text) < pattern_config.min_length
                or len(text) > pattern_config.max_length
            ):
                continue

            # Match pattern
            try:
                matches = self._match_single_pattern(
                    compiled_pattern, pattern_config, text, max_matches, timeout_ms
                )

                if matches:
                    all_matches.extend(matches)
                    patterns_matched.append(pattern_name)

            except Exception as e:
                logger.error(f"Error matching pattern {pattern_name}: {e}")
                continue

        # Sort matches by start position
        all_matches.sort(key=lambda m: m.start)

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Create result
        result = PatternMatchResult(
            matches=all_matches,
            total_matches=len(all_matches),
            patterns_matched=patterns_matched,
            processing_time_ms=processing_time_ms,
            text_length=len(text),
            categories_found=list({match.category for match in all_matches}),
            patterns_tested=len(patterns_to_test),
            cache_hits=self._stats.get("cache_hits", 0),
            cache_misses=self._stats.get("cache_misses", 0),
        )

        # Cache result
        self.cache.cache_match_result(text, pattern_names_list, result)

        return result

    def _get_patterns_to_test(
        self,
        pattern_names: list[str] | None = None,
        categories: list[PatternCategory] | None = None,
    ) -> list[RegexPatternConfig]:
        """Get list of patterns to test based on filters."""
        if pattern_names:
            # Specific patterns requested
            return [
                self.patterns[name] for name in pattern_names if name in self.patterns
            ]

        patterns = list(self.patterns.values())

        if categories:
            patterns = [p for p in patterns if p.category in categories]

        # Filter by status
        patterns = [p for p in patterns if p.status == PatternStatus.ACTIVE]

        return patterns

    def _match_single_pattern(
        self,
        compiled_pattern: Pattern,
        pattern_config: RegexPatternConfig,
        text: str,
        max_matches: int | None = None,
        timeout_ms: int | None = None,
    ) -> list[PatternMatch]:
        """Match a single pattern against text."""
        matches = []
        max_matches = max_matches or pattern_config.max_matches
        timeout_ms = timeout_ms or pattern_config.timeout_ms

        start_time = time.time()

        try:
            for match in compiled_pattern.finditer(text):
                # Check timeout
                if timeout_ms and (time.time() - start_time) * 1000 > timeout_ms:
                    break

                # Check max matches
                if len(matches) >= max_matches:
                    break

                start, end = match.span()
                matched_text = text[start:end]

                # Get context
                context_before, context_after = self._get_context(text, start, end)

                # Create match object
                pattern_match = PatternMatch(
                    pattern_name=pattern_config.name,
                    start=start,
                    end=end,
                    matched_text=matched_text,
                    confidence=pattern_config.confidence,
                    severity=pattern_config.severity,
                    category=pattern_config.category,
                    metadata={
                        "subcategory": pattern_config.subcategory,
                        "tags": pattern_config.tags,
                    },
                    line_number=self._get_line_number(text, start),
                    column_number=self._get_column_number(text, start),
                    context_before=context_before,
                    context_after=context_after,
                )

                matches.append(pattern_match)

        except re.timeout:
            logger.warning(f"Pattern {pattern_config.name} timed out")
        except Exception as e:
            logger.error(f"Error matching pattern {pattern_config.name}: {e}")

        return matches

    def _compile_flags(self, flags: dict[RegexFlag, bool]) -> int:
        """Compile regex flags from configuration."""
        flag_map = {
            RegexFlag.IGNORECASE: re.IGNORECASE,
            RegexFlag.MULTILINE: re.MULTILINE,
            RegexFlag.DOTALL: re.DOTALL,
            RegexFlag.UNICODE: re.UNICODE,
            RegexFlag.VERBOSE: re.VERBOSE,
            RegexFlag.ASCII: re.ASCII,
            RegexFlag.LOCALE: re.LOCALE,
        }

        compiled_flags = 0
        for flag, enabled in flags.items():
            if enabled:
                compiled_flags |= flag_map.get(flag, 0)

        return compiled_flags

    def _get_context(
        self, text: str, start: int, end: int, context_size: int = 50
    ) -> tuple[str, str]:
        """Get context before and after a match."""
        context_start = max(0, start - context_size)
        context_end = min(len(text), end + context_size)

        context_before = text[context_start:start]
        context_after = text[end:context_end]

        return context_before.strip(), context_after.strip()

    def _get_line_number(self, text: str, position: int) -> int | None:
        """Get line number for a character position."""
        try:
            lines_before = text[:position].count("\n")
            return lines_before + 1
        except:
            return None

    def _get_column_number(self, text: str, position: int) -> int | None:
        """Get column number for a character position."""
        try:
            last_newline = text.rfind("\n", 0, position)
            if last_newline == -1:
                return position + 1
            else:
                return position - last_newline
        except:
            return None

    def batch_match(
        self,
        texts: list[str],
        pattern_names: list[str] | None = None,
        categories: list[PatternCategory] | None = None,
        max_concurrent: int = 4,
    ) -> list[PatternMatchResult]:
        """Match patterns against multiple texts in parallel."""
        if not texts:
            return []

        results = []

        with ThreadPoolExecutor(max_workers=max_concurrent) as executor:
            # Submit all tasks
            future_to_text = {
                executor.submit(
                    self.match_text,
                    text,
                    pattern_names,
                    categories,
                ): text
                for text in texts
            }

            # Collect results as they complete
            for future in as_completed(future_to_text):
                text = future_to_text[future]
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    logger.error(f"Error in batch matching: {e}")
                    # Create error result
                    error_result = PatternMatchResult(
                        matches=[],
                        total_matches=0,
                        patterns_matched=[],
                        processing_time_ms=0,
                        text_length=len(text),
                        categories_found=[],
                        patterns_tested=0,
                        cache_hits=0,
                        cache_misses=0,
                    )
                    results.append(error_result)

        return results

    def convert_to_violations(
        self,
        result: PatternMatchResult,
        scan_id: str,
        tenant_id: str,
        content_path: str | None = None,
    ) -> list[ViolationInfo]:
        """Convert pattern matches to violation objects."""
        violations = []

        for match in result.matches:
            violation = ViolationInfo(
                id=f"{scan_id}-{match.pattern_name}-{match.start}",
                violation_type=f"REGEX_{match.category.value}_{match.pattern_name}",
                severity=match.severity,
                confidence=match.confidence,
                content_type="text/plain",
                content_path=content_path,
                line_number=match.line_number,
                column_number=match.column_number,
                detected_value=match.matched_text,
                entity_type=match.category.value,
                pattern_name=match.pattern_name,
                context=f"{match.context_before} {match.matched_text} {match.context_after}".strip(),
                metadata={
                    "scan_id": scan_id,
                    "tenant_id": tenant_id,
                    "category": match.category.value,
                    "subcategory": match.metadata.get("subcategory"),
                    "tags": match.metadata.get("tags", []),
                },
            )

            violations.append(violation)

        return violations

    def get_statistics(self) -> dict[str, Any]:
        """Get engine statistics."""
        with self._stats_lock:
            stats = dict(self._stats)

        stats.update(
            {
                "total_patterns": len(self.patterns),
                "active_patterns": len(
                    [
                        p
                        for p in self.patterns.values()
                        if p.status == PatternStatus.ACTIVE
                    ]
                ),
                "categories": list({p.category for p in self.patterns.values()}),
                "cache_size": len(self.cache._pattern_cache)
                + len(self.cache._result_cache),
            }
        )

        return stats

    def export_patterns(self, format: str = "yaml") -> str:
        """Export patterns configuration."""
        patterns_data = []

        for pattern_config in self.patterns.values():
            pattern_dict = {
                "name": pattern_config.name,
                "pattern": pattern_config.pattern,
                "category": pattern_config.category.value,
                "subcategory": pattern_config.subcategory,
                "description": pattern_config.description,
                "flags": {
                    flag.value: enabled
                    for flag, enabled in pattern_config.flags.items()
                },
                "confidence": pattern_config.confidence,
                "severity": pattern_config.severity.value,
                "tags": pattern_config.tags,
                "status": pattern_config.status.value,
                "max_matches": pattern_config.max_matches,
                "timeout_ms": pattern_config.timeout_ms,
                "min_length": pattern_config.min_length,
                "max_length": pattern_config.max_length,
                "require_word_boundaries": pattern_config.require_word_boundaries,
                "test_cases": pattern_config.test_cases,
                "false_positive_patterns": pattern_config.false_positive_patterns,
                "created_by": pattern_config.created_by,
                "version": pattern_config.version,
            }
            patterns_data.append(pattern_dict)

        if format.lower() == "yaml":
            return yaml.dump(patterns_data, default_flow_style=False)
        elif format.lower() == "json":
            return json.dumps(patterns_data, indent=2)
        else:
            raise ValueError(f"Unsupported export format: {format}")


# Singleton instance
_regex_engine = None


def get_regex_engine() -> RegexPatternEngine:
    """Get singleton instance of regex pattern engine."""
    global _regex_engine
    if _regex_engine is None:
        _regex_engine = RegexPatternEngine()
    return _regex_engine
