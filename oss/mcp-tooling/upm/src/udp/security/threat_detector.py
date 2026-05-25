"""
Threat Detection System for Universal Dependency Platform.

Implements intelligent threat detection using various techniques including
pattern matching, behavioral analysis, and machine learning approaches.
"""

import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional
from urllib.parse import unquote, urlparse

import redis.asyncio as redis
from fastapi import Request

from ..core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ThreatIndicator:
    """Threat indicator data."""

    threat_type: str
    severity: float  # 0.0 to 1.0
    description: str
    pattern: Optional[str] = None
    source: Optional[str] = None


@dataclass
class ThreatContext:
    """Context information for threat analysis."""

    ip_address: str
    user_agent: str
    request_path: str
    method: str
    headers: dict[str, str]
    query_params: str
    body: Optional[str]
    timestamp: datetime


class ThreatDetector:
    """
    Intelligent threat detection system.

    Combines multiple detection techniques to identify various types of attacks
    including SQL injection, XSS, CSRF, brute force attempts, and more.
    """

    def __init__(self):
        """Initialize threat detector."""
        self.logger = logger
        self.settings = settings
        self._redis_client = None

        # Initialize threat indicators
        self.sql_injection_patterns = self._load_sql_injection_patterns()
        self.xss_patterns = self._load_xss_patterns()
        self.path_traversal_patterns = self._load_path_traversal_patterns()
        self.command_injection_patterns = self._load_command_injection_patterns()
        self.suspicious_user_agents = self._load_suspicious_user_agents()
        self.blocked_ips = self._load_blocked_ips()

        # Rate-based threat detection
        self.request_thresholds = {
            "requests_per_minute": 60,
            "failed_auth_per_minute": 5,
            "suspicious_requests_per_minute": 10,
            "large_requests_per_minute": 3,
        }

    async def _get_redis_client(self) -> redis.Redis:
        """Get Redis client for caching."""
        if self._redis_client is None:
            from ..infrastructure.redis import get_redis_client

            self._redis_client = await get_redis_client()
        return self._redis_client

    async def analyze_request(self, request: Request, context: dict[str, Any]) -> float:
        """
        Analyze request for threats and return threat score.

        Args:
            request: FastAPI request object
            context: Request context information

        Returns:
            float: Threat score between 0.0 (safe) and 1.0 (high threat)
        """
        threat_score = 0.0
        threat_indicators = []

        try:
            # Create threat context
            threat_context = ThreatContext(
                ip_address=context.get("ip_address", "unknown"),
                user_agent=context.get("user_agent", ""),
                request_path=context.get("endpoint_path", ""),
                method=context.get("method", ""),
                headers=dict(request.headers),
                query_params=str(request.query_params),
                body=await self._get_request_body(request),
                timestamp=datetime.utcnow(),
            )

            # Perform various threat checks
            indicators = await self._check_all_threats(threat_context, context)

            # Calculate combined threat score
            threat_score = self._calculate_threat_score(indicators)

            # Log high-threat requests
            if threat_score > 0.5:
                await self._log_threat_detection(
                    threat_context, indicators, threat_score
                )

                # Cache high-threat IPs for short-term blocking
                if threat_score > 0.8:
                    await self._cache_suspicious_ip(
                        threat_context.ip_address, threat_score
                    )

            return threat_score

        except Exception as e:
            self.logger.error(f"Error in threat analysis: {str(e)}")
            return 0.0  # Default to safe on error

    async def _get_request_body(self, request: Request) -> Optional[str]:
        """Get request body for analysis."""
        try:
            if request.method in ("POST", "PUT", "PATCH"):
                body = await request.body()
                return body.decode("utf-8", errors="ignore")[:1000]  # Limit size
        except Exception:
            pass
        return None

    async def _check_all_threats(
        self, context: ThreatContext, request_context: dict[str, Any]
    ) -> list[ThreatIndicator]:
        """Perform all threat detection checks."""
        indicators = []

        # Pattern-based checks
        indicators.extend(self._check_sql_injection(context))
        indicators.extend(self._check_xss(context))
        indicators.extend(self._check_path_traversal(context))
        indicators.extend(self._check_command_injection(context))
        indicators.extend(self._check_file_upload(context))
        indicators.extend(self._check_user_agent(context))

        # Behavioral checks
        indicators.extend(
            await self._check_rate_based_threats(context, request_context)
        )
        indicators.extend(
            await self._check_behavioral_anomalies(context, request_context)
        )

        # Header and protocol checks
        indicators.extend(self._check_header_anomalies(context))
        indicators.extend(self._check_protocol_violations(context))

        return indicators

    def _check_sql_injection(self, context: ThreatContext) -> list[ThreatIndicator]:
        """Check for SQL injection patterns."""
        indicators = []

        # Check query parameters, path, and body
        text_to_check = [
            context.query_params,
            unquote(context.query_params),
            context.request_path,
            context.body or "",
        ]

        for text in text_to_check:
            for pattern in self.sql_injection_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    indicators.append(
                        ThreatIndicator(
                            threat_type="sql_injection",
                            severity=0.9,
                            description="SQL injection pattern detected",
                            pattern=pattern,
                            source="pattern_match",
                        )
                    )
                    break

        return indicators

    def _check_xss(self, context: ThreatContext) -> list[ThreatIndicator]:
        """Check for XSS patterns."""
        indicators = []

        text_to_check = [
            context.query_params,
            unquote(context.query_params),
            context.request_path,
            context.body or "",
        ]

        for text in text_to_check:
            for pattern in self.xss_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    indicators.append(
                        ThreatIndicator(
                            threat_type="xss",
                            severity=0.8,
                            description="Cross-site scripting pattern detected",
                            pattern=pattern,
                            source="pattern_match",
                        )
                    )
                    break

        return indicators

    def _check_path_traversal(self, context: ThreatContext) -> list[ThreatIndicator]:
        """Check for path traversal patterns."""
        indicators = []

        if any(
            pattern in context.request_path for pattern in self.path_traversal_patterns
        ):
            indicators.append(
                ThreatIndicator(
                    threat_type="path_traversal",
                    severity=0.9,
                    description="Path traversal attempt detected",
                    source="path_check",
                )
            )

        return indicators

    def _check_command_injection(self, context: ThreatContext) -> list[ThreatIndicator]:
        """Check for command injection patterns."""
        indicators = []

        text_to_check = [context.query_params, context.request_path, context.body or ""]

        for text in text_to_check:
            for pattern in self.command_injection_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    indicators.append(
                        ThreatIndicator(
                            threat_type="command_injection",
                            severity=0.9,
                            description="Command injection pattern detected",
                            pattern=pattern,
                            source="pattern_match",
                        )
                    )
                    break

        return indicators

    def _check_file_upload(self, context: ThreatContext) -> list[ThreatIndicator]:
        """Check for malicious file upload attempts."""
        indicators = []

        # Check for suspicious file extensions in uploads
        if context.body and "filename=" in context.body:
            suspicious_extensions = [
                ".exe",
                ".bat",
                ".cmd",
                ".scr",
                ".pif",
                ".php",
                ".jsp",
                ".asp",
            ]
            for ext in suspicious_extensions:
                if ext in context.body.lower():
                    indicators.append(
                        ThreatIndicator(
                            threat_type="malicious_file_upload",
                            severity=0.8,
                            description=f"Suspicious file extension detected: {ext}",
                            source="file_upload_check",
                        )
                    )

        return indicators

    def _check_user_agent(self, context: ThreatContext) -> list[ThreatIndicator]:
        """Check for suspicious user agents."""
        indicators = []

        user_agent_lower = context.user_agent.lower()

        # Check for blocked user agents
        for blocked in self.suspicious_user_agents:
            if blocked in user_agent_lower:
                severity = 0.9 if blocked in ["sqlmap", "nikto", "nmap"] else 0.6
                indicators.append(
                    ThreatIndicator(
                        threat_type="suspicious_user_agent",
                        severity=severity,
                        description=f"Suspicious user agent: {blocked}",
                        source="user_agent_check",
                    )
                )

        return indicators

    async def _check_rate_based_threats(
        self, context: ThreatContext, request_context: dict[str, Any]
    ) -> list[ThreatIndicator]:
        """Check for rate-based threats."""
        indicators = []

        try:
            redis_client = await self._get_redis_client()
            ip_address = context.ip_address
            current_minute = int(time.time() // 60)

            # Check request rate
            request_key = f"threat_requests:{ip_address}:{current_minute}"
            request_count = await redis_client.incr(request_key)
            await redis_client.expire(request_key, 300)  # 5 minutes TTL

            if request_count > self.request_thresholds["requests_per_minute"]:
                indicators.append(
                    ThreatIndicator(
                        threat_type="high_request_rate",
                        severity=min(
                            0.8,
                            request_count
                            / self.request_thresholds["requests_per_minute"]
                            * 0.5,
                        ),
                        description=f"High request rate: {request_count} requests/minute",
                        source="rate_check",
                    )
                )

            # Check for repeated failed authentication
            if "login" in context.request_path or "auth" in context.request_path:
                auth_fail_key = f"threat_auth_fail:{ip_address}:{current_minute}"
                auth_fail_count = await redis_client.incr(auth_fail_key)
                await redis_client.expire(auth_fail_key, 300)

                if auth_fail_count > self.request_thresholds["failed_auth_per_minute"]:
                    indicators.append(
                        ThreatIndicator(
                            threat_type="brute_force_attempt",
                            severity=min(
                                0.9,
                                auth_fail_count
                                / self.request_thresholds["failed_auth_per_minute"]
                                * 0.6,
                            ),
                            description=f"Potential brute force: {auth_fail_count} failed attempts/minute",
                            source="auth_rate_check",
                        )
                    )

        except Exception as e:
            self.logger.error(f"Error in rate-based threat check: {str(e)}")

        return indicators

    async def _check_behavioral_anomalies(
        self, context: ThreatContext, request_context: dict[str, Any]
    ) -> list[ThreatIndicator]:
        """Check for behavioral anomalies."""
        indicators = []

        try:
            redis_client = await self._get_redis_client()
            ip_address = context.ip_address

            # Check for requests to common exploit paths
            exploit_paths = ["/admin", "/wp-admin", "/phpmyadmin", "/.env", "/config"]
            for path in exploit_paths:
                if path in context.request_path.lower():
                    indicators.append(
                        ThreatIndicator(
                            threat_type="reconnaissance",
                            severity=0.7,
                            description=f"Access to sensitive path: {path}",
                            source="behavioral_check",
                        )
                    )

            # Check for unusual HTTP methods
            unusual_methods = ["TRACE", "TRACK", "DEBUG", "CONNECT", "OPTIONS"]
            if context.method in unusual_methods:
                indicators.append(
                    ThreatIndicator(
                        threat_type="unusual_http_method",
                        severity=0.6,
                        description=f"Unusual HTTP method: {context.method}",
                        source="behavioral_check",
                    )
                )

            # Check for large payloads
            if context.body and len(context.body) > 100000:  # 100KB
                indicators.append(
                    ThreatIndicator(
                        threat_type="large_payload",
                        severity=0.5,
                        description=f"Large request payload: {len(context.body)} bytes",
                        source="behavioral_check",
                    )
                )

        except Exception as e:
            self.logger.error(f"Error in behavioral threat check: {str(e)}")

        return indicators

    def _check_header_anomalies(self, context: ThreatContext) -> list[ThreatIndicator]:
        """Check for header-based threats."""
        indicators = []

        # Check for missing required headers in suspicious requests
        if context.method in ["POST", "PUT", "PATCH"] and not context.headers.get(
            "Content-Type"
        ):
            indicators.append(
                ThreatIndicator(
                    threat_type="missing_content_type",
                    severity=0.3,
                    description="Missing Content-Type header",
                    source="header_check",
                )
            )

        # Check for suspicious header values
        suspicious_headers = ["X-Forwarded-For", "X-Real-IP", "X-Originating-IP"]
        for header in suspicious_headers:
            if header in context.headers:
                value = context.headers[header]
                # Check for private IP ranges in forwarded headers (potential header injection)
                if any(
                    ip in value for ip in ["127.0.0.1", "192.168.", "10.", "172.16."]
                ):
                    indicators.append(
                        ThreatIndicator(
                            threat_type="header_injection",
                            severity=0.6,
                            description=f"Suspicious {header} header value",
                            source="header_check",
                        )
                    )

        return indicators

    def _check_protocol_violations(
        self, context: ThreatContext
    ) -> list[ThreatIndicator]:
        """Check for HTTP protocol violations."""
        indicators = []

        # Check for malformed URLs
        try:
            parsed = urlparse(context.request_path)
            if parsed.scheme or parsed.netloc:
                indicators.append(
                    ThreatIndicator(
                        threat_type="malformed_url",
                        severity=0.5,
                        description="Malformed URL with scheme or netloc",
                        source="protocol_check",
                    )
                )
        except Exception:
            indicators.append(
                ThreatIndicator(
                    threat_type="invalid_url",
                    severity=0.4,
                    description="Invalid URL format",
                    source="protocol_check",
                )
            )

        return indicators

    def _calculate_threat_score(self, indicators: list[ThreatIndicator]) -> float:
        """Calculate overall threat score from indicators."""
        if not indicators:
            return 0.0

        # Weight different threat types
        weights = {
            "sql_injection": 1.0,
            "xss": 0.9,
            "path_traversal": 0.9,
            "command_injection": 0.9,
            "brute_force_attempt": 0.8,
            "malicious_file_upload": 0.8,
            "reconnaissance": 0.7,
            "high_request_rate": 0.6,
            "header_injection": 0.6,
            "suspicious_user_agent": 0.5,
        }

        # Calculate weighted average
        total_weighted_score = 0.0
        total_weight = 0.0

        for indicator in indicators:
            weight = weights.get(indicator.threat_type, 0.5)
            total_weighted_score += indicator.severity * weight
            total_weight += weight

        # Add bonus for multiple indicators
        indicator_count_bonus = min(0.2, len(indicators) * 0.05)

        base_score = total_weighted_score / total_weight if total_weight > 0 else 0.0
        final_score = min(1.0, base_score + indicator_count_bonus)

        return round(final_score, 3)

    async def _log_threat_detection(
        self, context: ThreatContext, indicators: list[ThreatIndicator], score: float
    ):
        """Log threat detection for security monitoring."""
        log_data = {
            "timestamp": context.timestamp.isoformat(),
            "ip_address": context.ip_address,
            "user_agent": context.user_agent,
            "request_path": context.request_path,
            "method": context.method,
            "threat_score": score,
            "indicators": [
                {
                    "type": ind.threat_type,
                    "severity": ind.severity,
                    "description": ind.description,
                    "source": ind.source,
                }
                for ind in indicators
            ],
        }

        self.logger.warning(
            f"Threat detected: {score:.3f} - {context.ip_address} - {context.method} {context.request_path}"
        )

        # Store in Redis for short-term analysis
        try:
            redis_client = await self._get_redis_client()
            threat_key = (
                f"threat_log:{context.ip_address}:{int(context.timestamp.timestamp())}"
            )
            await redis_client.setex(threat_key, 3600, str(log_data))  # 1 hour TTL
        except Exception as e:
            self.logger.error(f"Failed to log threat to Redis: {str(e)}")

    async def _cache_suspicious_ip(self, ip_address: str, threat_score: float):
        """Cache suspicious IP for short-term blocking."""
        try:
            redis_client = await self._get_redis_client()
            suspicious_key = f"suspicious_ip:{ip_address}"

            # Cache with TTL based on threat score
            ttl = int(300 * threat_score)  # 5-25 minutes based on severity
            await redis_client.setex(suspicious_key, ttl, str(threat_score))

        except Exception as e:
            self.logger.error(f"Failed to cache suspicious IP: {str(e)}")

    def _load_sql_injection_patterns(self) -> list[str]:
        """Load SQL injection patterns."""
        return [
            r"(\%27)|(\')|(\-\-)|(\%23)|(#)",
            r"((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))",
            r"\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))",
            r"union.*select",
            r"insert.*into",
            r"delete.*from",
            r"update.*set",
            r"drop.*table",
            r"create.*table",
            r"alter.*table",
            r"exec.*sp_",
            r"script.*alert",
            r"waitfor.*delay",
            r"convert.*int",
            r"cast.*int",
            r"substring.*char",
        ]

    def _load_xss_patterns(self) -> list[str]:
        """Load XSS patterns."""
        return [
            r"<script[^>]*>.*?</script>",
            r"javascript:",
            r"onload\s*=",
            r"onerror\s*=",
            r"onclick\s*=",
            r"onmouseover\s*=",
            r"alert\s*\(",
            r"confirm\s*\(",
            r"prompt\s*\(",
            r"document\.cookie",
            r"document\.location",
            r"window\.location",
            r"<iframe",
            r"<object",
            r"<embed",
            r"<form",
            r"expression\s*\(",
            r"@import",
            r"<link",
            r"<meta",
        ]

    def _load_path_traversal_patterns(self) -> list[str]:
        """Load path traversal patterns."""
        return [
            "../",
            "..\\",
            "%2e%2e%2f",
            "%2e%2e\\",
            "..%2f",
            "..%5c",
            "%2e%2e/",
            "%2e%2e\\",
            "..././",
            "...\\.\\",
            "/etc/passwd",
            "/etc/shadow",
            "/proc/version",
            "/sys/",
            "/var/",
        ]

    def _load_command_injection_patterns(self) -> list[str]:
        """Load command injection patterns."""
        return [
            r";\s*(ls|cat|ps|whoami|id|pwd)",
            r"&&\s*(ls|cat|ps|whoami|id|pwd)",
            r"\|\|\s*(ls|cat|ps|whoami|id|pwd)",
            r"`[^`]*`",
            r"\$\(.*\)",
            r"<\?.*\?>",
            r"<\%.*\%>",
            r"\|\s*(nc|netcat|telnet)",
            r";\s*(wget|curl)",
            r"eval\s*\(",
            r"exec\s*\(",
            r"system\s*\(",
        ]

    def _load_suspicious_user_agents(self) -> list[str]:
        """Load suspicious user agent patterns."""
        return [
            "sqlmap",
            "nikto",
            "nmap",
            "masscan",
            "dirb",
            "dirbuster",
            "gobuster",
            "wfuzz",
            "burp",
            "owasp",
            "acunetix",
            "nessus",
            "openvas",
            "python-requests",
            "curl",
            "wget",
            "powershell",
        ]

    def _load_blocked_ips(self) -> set[str]:
        """Load blocked IPs from configuration or database."""
        # This could be loaded from a database or configuration file
        return set()
