"""
Content Sanitization Service

Advanced content sanitization with secure data handling, content cleaning,
and comprehensive validation for enterprise data protection.

Key Features:
- Content sanitization and cleaning
- Secure data handling with validation
- Content structure preservation
- Security threat detection
- Data integrity validation
- Compliance enforcement
"""

import os
import re
import json
import logging
import asyncio
from typing import Dict, List, Any, Optional, Tuple, Union
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
import bleach
import html
import hashlib
from urllib.parse import urlparse
import base64
from redis.asyncio import Redis
import asyncpg

from ..database.models import SanitizationLog, SecurityThreat, ContentValidation
from .config import get_settings
from ..utils.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


class ThreatType(str, Enum):
    XSS = "xss"  # Cross-site scripting
    SQL_INJECTION = "sql_injection"  # SQL injection attempts
    MALICIOUS_SCRIPT = "malicious_script"  # Malicious scripts
    SUSPICIOUS_URLS = "suspicious_urls"  # Suspicious URLs
    MALWARE_INDICATORS = "malware_indicators"  # Malware indicators
    DATA_EXFILTRATION = "data_exfiltration"  # Data exfiltration patterns
    SENSITIVE_KEYWORDS = "sensitive_keywords"  # Sensitive information keywords


class SanitizationLevel(str, Enum):
    BASIC = "basic"  # Basic HTML sanitization
    STANDARD = "standard"  # Standard security measures
    ENHANCED = "enhanced"  # Enhanced threat detection
    PARANOID = "paranoid"  # Maximum security


@dataclass
class SanitizationResult:
    original_content: str
    sanitized_content: str
    threats_detected: List[Dict[str, Any]]
    security_score: float
    validation_results: Dict[str, Any]
    modifications_made: List[str]
    processing_time_ms: float
    audit_log_id: str


class ContentSanitizer:
    """Enterprise-grade content sanitization service"""

    def __init__(self):
        self.redis: Optional[Redis] = None
        self.db_pool: Optional[asyncpg.Pool] = None
        self._initialize_services()

        # Security patterns and configurations
        self._xss_patterns = self._load_xss_patterns()
        self._sql_injection_patterns = self._load_sql_injection_patterns()
        self._suspicious_domains = self._load_suspicious_domains()
        self._malware_indicators = self._load_malware_indicators()
        self._sensitive_keywords = self._load_sensitive_keywords()

        # HTML sanitization configuration
        self._html_sanitizer_config = {
            "tags": [
                "a",
                "abbr",
                "acronym",
                "b",
                "blockquote",
                "code",
                "em",
                "i",
                "li",
                "ol",
                "p",
                "strong",
                "ul",
                "h1",
                "h2",
                "h3",
                "h4",
                "h5",
                "h6",
                "br",
                "div",
                "span",
                "pre",
                "hr",
                "table",
                "tr",
                "td",
                "th",
                "thead",
                "tbody",
            ],
            "attributes": {
                "a": ["href", "title"],
                "abbr": ["title"],
                "acronym": ["title"],
                "p": ["class"],
                "div": ["class", "id"],
                "span": ["class", "id"],
                "td": ["colspan", "rowspan"],
                "th": ["colspan", "rowspan", "scope"],
            },
            "strip": True,
            "strip_comments": True,
        }

    def _initialize_services(self):
        """Initialize Redis and database connections"""

        try:
            self.redis = Redis.from_url(
                settings.redis_url, encoding="utf-8", decode_responses=True
            )

            self.db_pool = asyncpg.create_pool(
                settings.database_url, min_size=5, max_size=20, command_timeout=60
            )

            logger.info("Content sanitizer initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize content sanitizer: {e}")
            raise

    def _load_xss_patterns(self) -> List[re.Pattern]:
        """Load XSS detection patterns"""

        patterns = [
            # Script tag patterns
            r"<script[^>]*>.*?</script>",
            r"javascript:",
            r"on\w+\s*=",  # Event handlers like onclick, onload
            r"<iframe[^>]*>.*?</iframe>",
            r"<object[^>]*>.*?</object>",
            r"<embed[^>]*>.*?</embed>",
            r"<applet[^>]*>.*?</applet>",
            r"<meta[^>]*http-equiv",
            r"<link[^>]*>",
            # Common XSS vectors
            r"alert\s*\(",
            r"confirm\s*\(",
            r"prompt\s*\(",
            r"eval\s*\(",
            r"setTimeout\s*\(",
            r"setInterval\s*\(",
            r"document\.cookie",
            r"document\.location",
            r"window\.location",
            r"document\.write",
            r"document\.writeln",
            # Encoding attempts
            r"%3cscript%3e",
            r"%3Cscript%3E",
            r"&#60;script&#62;",
            r"&#x3C;script&#x3E;",
            # Expression and VBScript
            r"expression\s*\(",
            r"vbscript:",
            # Data URIs
            r"data:text/html",
            r"data:application/javascript",
        ]

        return [re.compile(pattern, re.IGNORECASE | re.DOTALL) for pattern in patterns]

    def _load_sql_injection_patterns(self) -> List[re.Pattern]:
        """Load SQL injection detection patterns"""

        patterns = [
            # Common SQL injection patterns
            r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)",
            r"(\bOR\b\s+['\"]\s*['\"])",
            r"(\bAND\b\s+['\"]\s*['\"])",
            r"(\bUNION\b\s+.*\bSELECT\b)",
            r"(--|#|\/\*|\*\/)",  # SQL comments
            r"(;|')",  # Statement terminators
            r"(\bEXEC\b\s*\(|\bEXECUTE\b\s*\()",
            r"(\bSP_\w+)",  # Stored procedures
            r"(\bxp_\w+)",  # Extended stored procedures
            r"(\bWHERE\b\s+.*\bOR\b)",
            r"(\bHAVING\b\s+.*\bOR\b)",
            r"(\bORDER BY\b.*\bCASE\b)",
            r"(\bGROUP BY\b.*\bCASE\b)",
            # Error-based injection patterns
            r"(\bCONVERT\b.*\bINT\b)",
            r"(\bCAST\b.*\bAS\b)",
            r"(@@version|@@servername|@@datadir)",
            r"(\bversion\(\))",
            r"(\bdatabase\(\))",
            r"(\buser\(\))",
            # Time-based injection
            r"(WAITFOR\s+DELAY)",
            r"(SLEEP\s*\()",
            r"(BENCHMARK\s*\()",
            r"(pg_sleep\s*\()",
        ]

        return [re.compile(pattern, re.IGNORECASE) for pattern in patterns]

    def _load_suspicious_domains(self) -> List[str]:
        """Load list of suspicious domains"""

        # Common suspicious TLDs and domains
        suspicious_tlds = [".tk", ".ml", ".ga", ".cf", ".pw", ".bit", ".onion"]

        suspicious_domains = [
            "bit.ly",
            "tinyurl.com",
            "goo.gl",
            "t.co",  # Shorteners (can be legit but suspicious)
            "pastebin.com",
            "hastebin.com",  # Code sharing sites
            "anonfiles.com",
            "mega.nz",
            "mediafire.com",  # File sharing
            "iplogger.com",
            "iplogger.org",  # IP logging services
        ]

        return suspicious_domains + suspicious_tlds

    def _load_malware_indicators(self) -> List[re.Pattern]:
        """Load malware detection patterns"""

        patterns = [
            # Base64 encoded content (possible payloads)
            r"(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)",
            # PowerShell patterns
            r"powershell\s+-\w+",
            r"Invoke-\w+",
            r"Start-Process",
            # Shell patterns
            r"/bin/sh",
            r"/bin/bash",
            r"cmd\.exe",
            r"wscript\.exe",
            r"cscript\.exe",
            # Macro patterns
            r"AutoOpen\(\)",
            r"Document_Open\(\)",
            r"Workbook_Open\(\)",
            # Suspicious file extensions in URLs
            r"\.(exe|scr|bat|cmd|pif|com|msi|dll|vbs|js|jar|ps1)$",
            # Suspicious content patterns
            r'\bpassword\s*=\s*["\']',
            r'\bsecret\s*=\s*["\']',
            r'\bkey\s*=\s*["\']',
            r'\btoken\s*=\s*["\']',
        ]

        return [re.compile(pattern, re.IGNORECASE) for pattern in patterns]

    def _load_sensitive_keywords(self) -> List[str]:
        """Load sensitive information keywords"""

        return [
            # Financial keywords
            "credit card",
            "bank account",
            "routing number",
            "swift code",
            "social security",
            "tax id",
            "passport",
            "driver license",
            # Medical keywords
            "medical record",
            "patient id",
            "diagnosis",
            "prescription",
            "HIPAA",
            "protected health information",
            "PHI",
            # Legal keywords
            "attorney-client",
            "privileged communication",
            "confidential",
            "trade secret",
            "intellectual property",
            "NDA",
            # Security keywords
            "password",
            "secret key",
            "access token",
            "API key",
            "private key",
            "certificate",
            "encryption key",
            # Internal keywords
            "internal only",
            "confidential",
            "company confidential",
            "do not distribute",
            "internal use only",
        ]

    async def sanitize_content(
        self,
        content: str,
        tenant_id: str,
        user_id: Optional[str] = None,
        sanitization_level: SanitizationLevel = SanitizationLevel.STANDARD,
        content_type: str = "text/plain",
    ) -> SanitizationResult:
        """
        Perform comprehensive content sanitization

        Args:
            content: Original content to sanitize
            tenant_id: Tenant identifier
            user_id: Optional user identifier
            sanitization_level: Level of sanitization to apply
            content_type: Type of content (text/plain, text/html, etc.)

        Returns:
            SanitizationResult with detailed information
        """

        start_time = asyncio.get_event_loop().time()
        audit_log_id = f"{tenant_id}:{int(start_time * 1000000)}"

        try:
            # Initialize result tracking
            threats_detected = []
            modifications_made = []
            sanitized_content = content

            # Detect security threats
            security_threats = await self._detect_security_threats(
                content, sanitization_level
            )
            threats_detected.extend(security_threats)

            # Apply sanitization based on content type
            if content_type == "text/html":
                sanitized_content = await self._sanitize_html_content(
                    sanitized_content, sanitization_level
                )
                modifications_made.append("HTML sanitization applied")

            # Remove suspicious URLs
            sanitized_content, url_threats = await self._sanitize_urls(
                sanitized_content, sanitization_level
            )
            threats_detected.extend(url_threats)
            if url_threats:
                modifications_made.append("Suspicious URLs removed")

            # Detect and handle sensitive keywords
            sanitized_content, keyword_threats = await self._handle_sensitive_keywords(
                sanitized_content, tenant_id, sanitization_level
            )
            threats_detected.extend(keyword_threats)
            if keyword_threats:
                modifications_made.append("Sensitive content handled")

            # Validate content integrity
            validation_results = await self._validate_content_integrity(
                content, sanitized_content
            )

            # Calculate security score
            security_score = await self._calculate_security_score(
                content, sanitized_content, threats_detected
            )

            # Log sanitization for audit purposes
            await self._log_sanitization(
                audit_log_id,
                tenant_id,
                user_id,
                content,
                sanitized_content,
                threats_detected,
                sanitization_level,
                security_score,
            )

            processing_time = (asyncio.get_event_loop().time() - start_time) * 1000

            result = SanitizationResult(
                original_content=content,
                sanitized_content=sanitized_content,
                threats_detected=threats_detected,
                security_score=security_score,
                validation_results=validation_results,
                modifications_made=modifications_made,
                processing_time_ms=processing_time,
                audit_log_id=audit_log_id,
            )

            return result

        except Exception as e:
            logger.error(f"Content sanitization failed: {e}")
            raise

    async def _detect_security_threats(
        self, content: str, sanitization_level: SanitizationLevel
    ) -> List[Dict[str, Any]]:
        """Detect security threats in content"""

        threats = []

        # Check for XSS threats
        for pattern in self._xss_patterns:
            matches = pattern.finditer(content)
            for match in matches:
                threats.append(
                    {
                        "threat_type": ThreatType.XSS,
                        "pattern": pattern.pattern,
                        "match": match.group(),
                        "start": match.start(),
                        "end": match.end(),
                        "severity": "high",
                    }
                )

        # Check for SQL injection threats
        for pattern in self._sql_injection_patterns:
            matches = pattern.finditer(content)
            for match in matches:
                threats.append(
                    {
                        "threat_type": ThreatType.SQL_INJECTION,
                        "pattern": pattern.pattern,
                        "match": match.group(),
                        "start": match.start(),
                        "end": match.end(),
                        "severity": "high",
                    }
                )

        # Check for malware indicators
        for pattern in self._malware_indicators:
            matches = pattern.finditer(content)
            for match in matches:
                threats.append(
                    {
                        "threat_type": ThreatType.MALWARE_INDICATORS,
                        "pattern": pattern.pattern,
                        "match": match.group(),
                        "start": match.start(),
                        "end": match.end(),
                        "severity": "medium",
                    }
                )

        return threats

    async def _sanitize_html_content(
        self, content: str, sanitization_level: SanitizationLevel
    ) -> str:
        """Sanitize HTML content"""

        if sanitization_level == SanitizationLevel.BASIC:
            # Basic HTML sanitization
            return bleach.clean(content, tags=["p", "br", "strong", "em"], strip=True)

        elif sanitization_level == SanitizationLevel.STANDARD:
            # Standard HTML sanitization
            return bleach.clean(
                content,
                tags=self._html_sanitizer_config["tags"],
                attributes=self._html_sanitizer_config["attributes"],
                strip=self._html_sanitizer_config["strip"],
                strip_comments=self._html_sanitizer_config["strip_comments"],
            )

        elif sanitization_level in [
            SanitizationLevel.ENHANCED,
            SanitizationLevel.PARANOID,
        ]:
            # Enhanced/Paranoid sanitization - very strict
            return bleach.clean(
                content,
                tags=["p", "br", "strong", "em"],  # Very limited tags
                strip=True,
                strip_comments=True,
            )

        return content

    async def _sanitize_urls(
        self, content: str, sanitization_level: SanitizationLevel
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """Detect and sanitize suspicious URLs"""

        threats = []
        sanitized_content = content

        # Find all URLs in content
        url_pattern = re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+', re.IGNORECASE)

        urls_to_remove = []

        for match in url_pattern.finditer(content):
            url = match.group()

            try:
                parsed = urlparse(url)
                domain = parsed.netloc.lower()

                # Check against suspicious domains
                is_suspicious = False
                for suspicious in self._suspicious_domains:
                    if suspicious in domain or domain.endswith(suspicious):
                        is_suspicious = True
                        break

                # Check for suspicious patterns in URL
                if not is_suspicious:
                    suspicious_patterns = [
                        r"\.exe$",
                        r"\.scr$",
                        r"\.bat$",
                        r"\.cmd$",
                        r"javascript:",
                        r"data:",
                        r"vbscript:",
                        r"@.*@",  # Email addresses in URLs
                        r"\.\.",  # Directory traversal
                    ]

                    for pattern in suspicious_patterns:
                        if re.search(pattern, url, re.IGNORECASE):
                            is_suspicious = True
                            break

                if is_suspicious:
                    urls_to_remove.append(
                        {
                            "url": url,
                            "start": match.start(),
                            "end": match.end(),
                            "reason": "Suspicious domain or pattern",
                        }
                    )

            except Exception as e:
                logger.warning(f"Failed to parse URL {url}: {e}")

        # Remove suspicious URLs
        for url_info in reversed(urls_to_remove):  # Reverse to maintain indices
            sanitized_content = (
                sanitized_content[: url_info["start"]]
                + "[REMOVED_URL]"
                + sanitized_content[url_info["end"] :]
            )

            threats.append(
                {
                    "threat_type": ThreatType.SUSPICIOUS_URLS,
                    "url": url_info["url"],
                    "start": url_info["start"],
                    "end": url_info["end"],
                    "reason": url_info["reason"],
                    "severity": "medium",
                }
            )

        return sanitized_content, threats

    async def _handle_sensitive_keywords(
        self, content: str, tenant_id: str, sanitization_level: SanitizationLevel
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """Handle sensitive keywords in content"""

        threats = []
        sanitized_content = content

        # Get tenant-specific sensitive keywords
        tenant_keywords = await self._get_tenant_sensitive_keywords(tenant_id)
        all_keywords = self._sensitive_keywords + tenant_keywords

        for keyword in all_keywords:
            # Find keyword occurrences (case-insensitive)
            pattern = re.compile(re.escape(keyword), re.IGNORECASE)
            matches = list(pattern.finditer(content))

            if matches:
                if sanitization_level == SanitizationLevel.PAROID:
                    # Remove all occurrences
                    for match in reversed(matches):
                        sanitized_content = (
                            sanitized_content[: match.start()]
                            + "[REMOVED]"
                            + sanitized_content[match.end() :]
                        )

                # Log all detected sensitive keywords
                for match in matches:
                    threats.append(
                        {
                            "threat_type": ThreatType.SENSITIVE_KEYWORDS,
                            "keyword": keyword,
                            "match": match.group(),
                            "start": match.start(),
                            "end": match.end(),
                            "severity": "low",
                        }
                    )

        return sanitized_content, threats

    async def _get_tenant_sensitive_keywords(self, tenant_id: str) -> List[str]:
        """Get tenant-specific sensitive keywords"""

        cache_key = f"tenant_sensitive_keywords:{tenant_id}"

        try:
            # Try cache first
            cached = await self.redis.get(cache_key)
            if cached:
                return json.loads(cached)

            # Get from database
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT keyword FROM tenant_sensitive_keywords
                    WHERE tenant_id = $1 AND is_active = true
                """,
                    tenant_id,
                )

            keywords = [row["keyword"] for row in rows]

            # Cache for 1 hour
            await self.redis.setex(cache_key, 3600, json.dumps(keywords))

            return keywords

        except Exception as e:
            logger.error(f"Failed to get tenant sensitive keywords: {e}")
            return []

    async def _validate_content_integrity(
        self, original_content: str, sanitized_content: str
    ) -> Dict[str, Any]:
        """Validate content integrity after sanitization"""

        validation_results = {
            "structure_preserved": True,
            "length_changed": False,
            "character_count_diff": 0,
            "word_count_diff": 0,
            "formatting_preserved": True,
            "validation_passed": True,
        }

        # Check length changes
        original_length = len(original_content)
        sanitized_length = len(sanitized_content)

        if original_length != sanitized_length:
            validation_results["length_changed"] = True
            validation_results["character_count_diff"] = (
                sanitized_length - original_length
            )

        # Check word count changes
        original_words = len(original_content.split())
        sanitized_words = len(sanitized_content.split())
        validation_results["word_count_diff"] = sanitized_words - original_words

        # Basic structure validation (paragraphs, lines)
        original_lines = original_content.count("\n")
        sanitized_lines = sanitized_content.count("\n")

        if abs(original_lines - sanitized_lines) > len(original_lines) * 0.5:
            validation_results["structure_preserved"] = False

        # Overall validation status
        validation_results["validation_passed"] = (
            validation_results["structure_preserved"]
            and not validation_results["length_changed"]
            or validation_results["character_count_diff"]
            > -len(original_content) * 0.8  # Allow up to 80% reduction
        )

        return validation_results

    async def _calculate_security_score(
        self,
        original_content: str,
        sanitized_content: str,
        threats_detected: List[Dict[str, Any]],
    ) -> float:
        """Calculate security score for sanitized content"""

        # Start with base score
        base_score = 1.0

        # Deduct points for each threat
        for threat in threats_detected:
            if threat["severity"] == "high":
                base_score -= 0.3
            elif threat["severity"] == "medium":
                base_score -= 0.2
            else:  # low
                base_score -= 0.1

        # Bonus for successful sanitization
        if len(threats_detected) > 0:
            # Check if content was actually cleaned
            if len(sanitized_content) < len(original_content):
                base_score += 0.1  # Bonus for actually removing content

        # Ensure score is between 0 and 1
        return max(0.0, min(1.0, base_score))

    async def _log_sanitization(
        self,
        audit_log_id: str,
        tenant_id: str,
        user_id: Optional[str],
        original_content: str,
        sanitized_content: str,
        threats_detected: List[Dict[str, Any]],
        sanitization_level: SanitizationLevel,
        security_score: float,
    ) -> None:
        """Log sanitization for audit purposes"""

        try:
            # Calculate content hash
            content_hash = hashlib.sha256(original_content.encode()).hexdigest()

            # Log to database
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO sanitization_logs (
                        audit_log_id, tenant_id, user_id, sanitization_level,
                        original_content_hash, sanitized_content, threats_detected,
                        security_score, processing_timestamp
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                """,
                    *[
                        audit_log_id,
                        tenant_id,
                        user_id,
                        sanitization_level.value,
                        content_hash,
                        sanitized_content,
                        json.dumps(threats_detected),
                        security_score,
                    ],
                )

            # Log individual threats for analysis
            for threat in threats_detected:
                await conn.execute(
                    """
                    INSERT INTO security_threats (
                        tenant_id, audit_log_id, threat_type, threat_data,
                        severity, detected_at
                    ) VALUES ($1, $2, $3, $4, $5, NOW())
                """,
                    tenant_id,
                    audit_log_id,
                    threat["threat_type"].value,
                    json.dumps(threat),
                    threat["severity"],
                )

        except Exception as e:
            logger.error(f"Sanitization logging failed: {e}")

    async def get_sanitization_analytics(
        self, tenant_id: str, days: int = 30
    ) -> Dict[str, Any]:
        """Get sanitization analytics for tenant"""

        try:
            async with self.db_pool.acquire() as conn:
                # Overall statistics
                stats = await conn.fetchrow(
                    """
                    SELECT
                        COUNT(*) as total_sanitizations,
                        AVG(security_score) as avg_security_score,
                        COUNT(DISTINCT user_id) as unique_users,
                        COUNT(CASE WHEN threats_detected != '[]' THEN 1 END) as with_threats
                    FROM sanitization_logs
                    WHERE tenant_id = $1
                        AND processing_timestamp > NOW() - INTERVAL $2 DAY
                """,
                    tenant_id,
                    days,
                )

                # Threat distribution
                threat_stats = await conn.fetch(
                    """
                    SELECT
                        threat_type,
                        COUNT(*) as count,
                        severity,
                        COUNT(DISTINCT audit_log_id) as affected_sanitizations
                    FROM security_threats
                    WHERE tenant_id = $1
                        AND detected_at > NOW() - INTERVAL $2 DAY
                    GROUP BY threat_type, severity
                    ORDER BY count DESC
                """,
                    tenant_id,
                    days,
                )

                # Daily sanitization volume
                daily_volume = await conn.fetch(
                    """
                    SELECT
                        DATE_TRUNC('day', processing_timestamp) as date,
                        COUNT(*) as sanitizations,
                        AVG(security_score) as avg_security,
                        COUNT(CASE WHEN threats_detected != '[]' THEN 1 END) as with_threats
                    FROM sanitization_logs
                    WHERE tenant_id = $1
                        AND processing_timestamp > NOW() - INTERVAL $2 DAY
                    GROUP BY DATE_TRUNC('day', processing_timestamp)
                    ORDER BY date DESC
                """,
                    tenant_id,
                    days,
                )

                return {
                    "summary": {
                        "total_sanitizations": stats["total_sanitizations"],
                        "avg_security_score": float(stats["avg_security_score"] or 0),
                        "unique_users": stats["unique_users"],
                        "sanitizations_with_threats": stats["with_threats"],
                        "threat_detection_rate": (
                            float(stats["with_threats"])
                            / float(stats["total_sanitizations"])
                            if stats["total_sanitizations"] > 0
                            else 0
                        ),
                    },
                    "threat_distribution": [
                        {
                            "threat_type": row["threat_type"],
                            "count": row["count"],
                            "severity": row["severity"],
                            "affected_sanitizations": row["affected_sanitizations"],
                        }
                        for row in threat_stats
                    ],
                    "daily_volume": [
                        {
                            "date": row["date"].isoformat(),
                            "sanitizations": row["sanitizations"],
                            "avg_security_score": float(row["avg_security_score"] or 0),
                            "with_threats": row["with_threats"],
                        }
                        for row in daily_volume
                    ],
                }

        except Exception as e:
            logger.error(f"Sanitization analytics retrieval failed: {e}")
            return {}

    async def close(self):
        """Close all connections"""

        if self.db_pool:
            await self.db_pool.close()

        if self.redis:
            await self.redis.close()
