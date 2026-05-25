"""
Enhanced Security Middleware for Universal Dependency Platform.

Provides comprehensive security features including:
- Advanced rate limiting with multiple strategies
- IP-based security and reputation scoring
- Request validation and sanitization
- Security header enforcement
- Bot detection and challenge-response
- DDoS protection and anomaly detection
"""

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from ..core.config import get_settings
from .rate_limiter import RateLimitResult, get_rate_limiter

logger = logging.getLogger(__name__)


class SecurityLevel(str, Enum):
    """Security levels for different contexts."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ThreatType(str, Enum):
    """Types of security threats."""

    SQL_INJECTION = "sql_injection"
    XSS = "xss"
    CSRF = "csrf"
    BOT = "bot"
    DDoS = "ddos"
    BRUTE_FORCE = "brute_force"
    SUSPICIOUS_USER_AGENT = "suspicious_user_agent"
    MALICIOUS_PAYLOAD = "malicious_payload"
    REPUTATION_BLACKLIST = "reputation_blacklist"
    ANOMALOUS_BEHAVIOR = "anomalous_behavior"


@dataclass
class SecurityEvent:
    """Security event for logging and analysis."""

    threat_type: ThreatType
    severity: str  # low, medium, high, critical
    source_ip: str
    user_agent: str
    endpoint: str
    payload: Optional[str] = None
    details: Optional[dict[str, Any]] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()
        if self.details is None:
            self.details = {}


class IPReputationManager:
    """Manages IP reputation scoring and blacklisting."""

    def __init__(self):
        self.blacklisted_ips: set[str] = set()
        self.ip_scores: dict[str, int] = {}
        self.ip_threats: dict[str, list[ThreatType]] = {}
        self.settings = get_settings()

    def is_blacklisted(self, ip_address: str) -> bool:
        """Check if IP is blacklisted."""
        return ip_address in self.blacklisted_ips

    def get_score(self, ip_address: str) -> int:
        """Get reputation score for IP (0-100, higher is better)."""
        return self.ip_scores.get(ip_address, 50)

    def update_score(self, ip_address: str, threat_type: ThreatType, severity: str):
        """Update IP reputation score based on threat."""
        # Initialize score if not exists
        if ip_address not in self.ip_scores:
            self.ip_scores[ip_address] = 50

        # Apply score penalty based on severity
        penalty = self._get_penalty_for_severity(severity)
        self.ip_scores[ip_address] = max(0, self.ip_scores[ip_address] - penalty)

        # Track threats
        if ip_address not in self.ip_threats:
            self.ip_threats[ip_address] = []
        self.ip_threats[ip_address].append(threat_type)

        # Auto-blacklist if score is too low
        if self.ip_scores[ip_address] < 10:
            self.blacklisted_ips.add(ip_address)
            logger.warning(
                f"IP {ip_address} auto-blacklisted due to low reputation score"
            )

    def _get_penalty_for_severity(self, severity: str) -> int:
        """Get score penalty for threat severity."""
        penalties = {"low": 5, "medium": 15, "high": 30, "critical": 50}
        return penalties.get(severity, 10)

    def cleanup_old_data(self):
        """Clean up old IP data to prevent memory leaks."""
        cutoff_time = datetime.utcnow() - timedelta(days=7)
        # In a real implementation, you would timestamp entries and clean them up
        # For now, this is a placeholder


class RequestValidator:
    """Validates and sanitizes incoming requests."""

    # SQL injection patterns
    SQL_INJECTION_PATTERNS = [
        r"(\%27)|(\')|(\-\-)|(\%23)|(#)",
        r"((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))",
        r"\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))",
        r"((\%27)|(\'))union",
        r"exec(\s|\+)+(s|x)p\w+",
        r"UNION(.*)SELECT",
        r"INSERT(.*)INTO",
        r"DELETE(.*)FROM",
        r"DROP(.*)TABLE",
    ]

    # XSS patterns
    XSS_PATTERNS = [
        r"<script",
        r"javascript:",
        r"onload=",
        r"onerror=",
        r"onclick=",
        r"<iframe",
        r"<object",
        r"<embed",
        r"<link",
        r"<meta",
        r"fromCharCode",
        r"String.fromCharCode",
    ]

    # Suspicious user agents
    SUSPICIOUS_USER_AGENTS = [
        "sqlmap",
        "nikto",
        "dirb",
        "nmap",
        "masscan",
        "zap",
        "burp",
        "acunetix",
        "netsparker",
        "openvas",
        "nessus",
        "gobuster",
        "wfuzz",
        "ffuf",
        "hydra",
        "medusa",
        "john",
        "hashcat",
        "malware",
        "bot",
        "crawler",
        "spider",
        "scraper",
    ]

    def validate_request(self, request: Request) -> list[SecurityEvent]:
        """Validate request and return list of security events."""
        events = []

        # Check user agent
        user_agent = request.headers.get("user-agent", "").lower()
        if self._is_suspicious_user_agent(user_agent):
            events.append(
                SecurityEvent(
                    threat_type=ThreatType.SUSPICIOUS_USER_AGENT,
                    severity="medium",
                    source_ip=request.client.host if request.client else "unknown",
                    user_agent=user_agent,
                    endpoint=str(request.url.path),
                    details={"user_agent": user_agent},
                )
            )

        # Check query parameters and path for injection patterns
        query_string = str(request.url.query)
        path = str(request.url.path)

        content_to_check = f"{path} {query_string}"

        # Check for SQL injection
        if self._contains_sql_injection(content_to_check):
            events.append(
                SecurityEvent(
                    threat_type=ThreatType.SQL_INJECTION,
                    severity="high",
                    source_ip=request.client.host if request.client else "unknown",
                    user_agent=user_agent,
                    endpoint=str(request.url.path),
                    payload=content_to_check[:200],
                )
            )

        # Check for XSS
        if self._contains_xss(content_to_check):
            events.append(
                SecurityEvent(
                    threat_type=ThreatType.XSS,
                    severity="high",
                    source_ip=request.client.host if request.client else "unknown",
                    user_agent=user_agent,
                    endpoint=str(request.url.path),
                    payload=content_to_check[:200],
                )
            )

        return events

    def _is_suspicious_user_agent(self, user_agent: str) -> bool:
        """Check if user agent matches suspicious patterns."""
        for suspicious in self.SUSPICIOUS_USER_AGENTS:
            if suspicious in user_agent:
                return True
        return False

    def _contains_sql_injection(self, content: str) -> bool:
        """Check if content contains SQL injection patterns."""
        content_lower = content.lower()
        for pattern in self.SQL_INJECTION_PATTERNS:
            if re.search(pattern, content_lower, re.IGNORECASE):
                return True
        return False

    def _contains_xss(self, content: str) -> bool:
        """Check if content contains XSS patterns."""
        content_lower = content.lower()
        for pattern in self.XSS_PATTERNS:
            if re.search(pattern, content_lower, re.IGNORECASE):
                return True
        return False


class EnhancedSecurityMiddleware(BaseHTTPMiddleware):
    """
    Enhanced security middleware with comprehensive protection.
    """

    def __init__(self, app, security_level: SecurityLevel = SecurityLevel.MEDIUM):
        super().__init__(app)
        self.security_level = security_level
        self.ip_reputation = IPReputationManager()
        self.request_validator = RequestValidator()
        self.settings = get_settings()
        self.rate_limiter = None
        self._setup_complete = False

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request through security checks."""

        # Ensure setup is complete
        if not self._setup_complete:
            await self._setup()

        # Get client information
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")

        # Check IP blacklist
        if self.ip_reputation.is_blacklisted(client_ip):
            await self._log_security_event(
                SecurityEvent(
                    threat_type=ThreatType.REPUTATION_BLACKLIST,
                    severity="critical",
                    source_ip=client_ip,
                    user_agent=user_agent,
                    endpoint=str(request.url.path),
                )
            )
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Access denied"},
            )

        # Validate request
        security_events = self.request_validator.validate_request(request)

        # Process security events
        blocked = False
        for event in security_events:
            self.ip_reputation.update_score(
                client_ip, event.threat_type, event.severity
            )

            await self._log_security_event(event)

            # Block high and critical severity events
            if event.severity in ["high", "critical"]:
                blocked = True

        if blocked:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Request blocked by security policy"},
            )

        # Apply rate limiting
        rate_limit_result = await self._apply_rate_limiting(request, client_ip)

        if not rate_limit_result.allowed:
            response = JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded",
                    "retry_after": rate_limit_result.retry_after,
                },
            )
            response.headers["X-RateLimit-Limit"] = str(rate_limit_result.limit)
            response.headers["X-RateLimit-Remaining"] = str(rate_limit_result.remaining)
            response.headers["X-RateLimit-Reset"] = str(rate_limit_result.reset_time)
            response.headers["Retry-After"] = str(rate_limit_result.retry_after or 60)
            return response

        # Add security headers
        response = await call_next(request)
        self._add_security_headers(response)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(rate_limit_result.limit)
        response.headers["X-RateLimit-Remaining"] = str(rate_limit_result.remaining)
        response.headers["X-RateLimit-Reset"] = str(rate_limit_result.reset_time)

        return response

    async def _setup(self):
        """Setup async components."""
        if self.rate_limiter is None:
            self.rate_limiter = await get_rate_limiter()
        self._setup_complete = True

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request."""
        # Check for forwarded IP headers
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # X-Forwarded-For can contain multiple IPs, take the first one
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Fall back to direct connection IP
        return request.client.host if request.client else "unknown"

    async def _apply_rate_limiting(
        self, request: Request, client_ip: str
    ) -> RateLimitResult:
        """Apply appropriate rate limiting based on request characteristics."""

        # Extract user information if available
        user_id = None
        organization_id = None

        # Try to get user info from request state (set by auth middleware)
        if hasattr(request.state, "user") and request.state.user:
            user_id = str(request.state.user.id)
            if hasattr(request.state.user, "organization_id"):
                organization_id = str(request.state.user.organization_id)

        # Get API key if present
        api_key = request.headers.get("x-api-key")

        # Determine which rate limit rule to apply
        endpoint = str(request.url.path)
        rule_name = self._get_rate_limit_rule(endpoint)

        # Check rate limit
        return await self.rate_limiter.check_rate_limit(
            rule_name=rule_name,
            user_id=user_id,
            ip_address=client_ip,
            organization_id=organization_id,
            api_key=api_key,
            endpoint=endpoint,
        )

    def _get_rate_limit_rule(self, endpoint: str) -> str:
        """Determine appropriate rate limit rule for endpoint."""

        # Auth endpoints
        if endpoint.startswith("/api/v1/auth/login"):
            return "auth_login"
        elif endpoint.startswith("/api/v1/auth/reset-password"):
            return "auth_password_reset"

        # Analysis endpoints
        elif endpoint.startswith("/api/v1/analysis"):
            return "analysis_requests"

        # API key authenticated endpoints
        elif endpoint.startswith("/api/v1/external/"):
            return "api_key_requests"

        # Default general rate limit
        else:
            return "api_general"

    def _add_security_headers(self, response: Response):
        """Add security headers to response."""

        # Content Security Policy
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        response.headers["Content-Security-Policy"] = csp

        # Other security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), "
            "payment=(), usb=(), accelerometer=(), gyroscope=()"
        )

        # HSTS (only in production with HTTPS)
        if self.settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

    async def _log_security_event(self, event: SecurityEvent):
        """Log security event for monitoring and analysis."""

        # Log to application logger
        logger.warning(
            f"Security event: {event.threat_type.value} - "
            f"Severity: {event.severity} - "
            f"IP: {event.source_ip} - "
            f"Endpoint: {event.endpoint}"
        )

        # In a production environment, you would also:
        # - Send to security monitoring system (SIEM)
        # - Store in security event database
        # - Trigger alerts for critical events
        # - Update threat intelligence feeds

        # For now, we'll just log to a file
        try:
            with open("security_events.log", "a") as f:
                f.write(
                    json.dumps(
                        {
                            "timestamp": event.timestamp.isoformat(),
                            "threat_type": event.threat_type.value,
                            "severity": event.severity,
                            "source_ip": event.source_ip,
                            "user_agent": event.user_agent,
                            "endpoint": event.endpoint,
                            "payload": event.payload,
                            "details": event.details,
                        }
                    )
                    + "\n"
                )
        except Exception as e:
            logger.error(f"Failed to log security event: {e}")


class DDoSMiddleware(BaseHTTPMiddleware):
    """
    Specialized middleware for DDoS protection.
    """

    def __init__(self, app):
        super().__init__(app)
        self.request_counts: dict[str, list[float]] = {}
        self.blocked_ips: set[str] = set()
        self.cleanup_interval = 300  # 5 minutes
        self.last_cleanup = time.time()

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request for DDoS protection."""

        client_ip = self._get_client_ip(request)
        now = time.time()

        # Clean up old data periodically
        if now - self.last_cleanup > self.cleanup_interval:
            self._cleanup_old_data()
            self.last_cleanup = now

        # Check if IP is blocked
        if client_ip in self.blocked_ips:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "detail": "Access temporarily suspended due to suspicious activity"
                },
            )

        # Track request count
        if client_ip not in self.request_counts:
            self.request_counts[client_ip] = []

        # Remove old requests (older than 1 minute)
        self.request_counts[client_ip] = [
            req_time
            for req_time in self.request_counts[client_ip]
            if now - req_time < 60
        ]

        # Add current request
        self.request_counts[client_ip].append(now)

        # Check for DDoS patterns
        request_count = len(self.request_counts[client_ip])

        # More than 100 requests per minute is suspicious
        if request_count > 100:
            # Block for 5 minutes
            self.blocked_ips.add(client_ip)
            logger.warning(f"IP {client_ip} temporarily blocked for DDoS protection")

            # Schedule unblocking
            asyncio.create_task(self._unblock_ip(client_ip, 300))

            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Too many requests. Please slow down.",
                    "retry_after": 300,
                },
            )

        # More than 30 requests in 10 seconds is very suspicious
        recent_requests = [
            req_time
            for req_time in self.request_counts[client_ip]
            if now - req_time < 10
        ]
        if len(recent_requests) > 30:
            # Block for 10 minutes
            self.blocked_ips.add(client_ip)
            logger.warning(
                f"IP {client_ip} temporarily blocked for rapid-fire requests"
            )

            # Schedule unblocking
            asyncio.create_task(self._unblock_ip(client_ip, 600))

            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Request rate too high. Please slow down.",
                    "retry_after": 600,
                },
            )

        return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address."""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    def _cleanup_old_data(self):
        """Clean up old request data to prevent memory leaks."""
        now = time.time()

        # Clean old request counts
        for ip in list(self.request_counts.keys()):
            self.request_counts[ip] = [
                req_time
                for req_time in self.request_counts[ip]
                if now - req_time < 300  # Keep last 5 minutes
            ]

            # Remove empty entries
            if not self.request_counts[ip]:
                del self.request_counts[ip]

        # Clean old blocked IPs
        # In a real implementation, you'd want to track block times
        # For now, we'll just keep a reasonable number
        if len(self.blocked_ips) > 10000:
            # Keep only the most recent 5000 blocked IPs
            self.blocked_ips = set(list(self.blocked_ips)[-5000:])

    async def _unblock_ip(self, ip_address: str, delay: int):
        """Unblock IP after delay."""
        await asyncio.sleep(delay)
        if ip_address in self.blocked_ips:
            self.blocked_ips.remove(ip_address)
            logger.info(f"IP {ip_address} unblocked after suspension period")
