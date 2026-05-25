"""
Unit tests for API security components.

Tests threat detection, rate limiting, input validation,
and security middleware functionality.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import json
import re


class TestThreatDetector:
    """Test threat detection functionality."""

    @pytest.fixture
    def threat_detector(self):
        """Create threat detector instance."""
        with patch("udp.security.threat_detector.settings"):
            from udp.security.threat_detector import ThreatDetector

            return ThreatDetector()

    def test_load_sql_injection_patterns(self, threat_detector):
        """Test SQL injection pattern loading."""
        patterns = threat_detector._load_sql_injection_patterns()

        assert len(patterns) > 0
        assert any("union.*select" in pattern for pattern in patterns)
        assert any("drop.*table" in pattern for pattern in patterns)
        assert any(r"(\%27)|(\')" in pattern for pattern in patterns)

    def test_load_xss_patterns(self, threat_detector):
        """Test XSS pattern loading."""
        patterns = threat_detector._load_xss_patterns()

        assert len(patterns) > 0
        assert any("javascript:" in pattern for pattern in patterns)
        assert any("<script" in pattern for pattern in patterns)
        assert any("alert.*\\(" in pattern for pattern in patterns)

    def test_load_path_traversal_patterns(self, threat_detector):
        """Test path traversal pattern loading."""
        patterns = threat_detector._load_path_traversal_patterns()

        assert len(patterns) > 0
        assert "../" in patterns
        assert "..\\\\" in patterns
        assert any("/etc/passwd" in pattern for pattern in patterns)

    def test_load_command_injection_patterns(self, threat_detector):
        """Test command injection pattern loading."""
        patterns = threat_detector._load_command_injection_patterns()

        assert len(patterns) > 0
        assert any(";.*ls" in pattern for pattern in patterns)
        assert any(r"\\|\\|.*ls" in pattern for pattern in patterns)
        assert any("eval.*\\(" in pattern for pattern in patterns)

    def test_load_suspicious_user_agents(self, threat_detector):
        """Test suspicious user agent pattern loading."""
        agents = threat_detector._load_suspicious_user_agents()

        assert len(agents) > 0
        assert "sqlmap" in agents
        assert "nikto" in agents
        assert "nmap" in agents

    def test_check_sql_injection_safe(self, threat_detector):
        """Test SQL injection detection with safe input."""
        from udp.security.threat_detector import ThreatContext

        context = ThreatContext(
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            request_path="/api/v1/projects",
            method="GET",
            headers={},
            query_params="name=test&page=1",
            body=None,
            timestamp=datetime.utcnow(),
        )

        indicators = threat_detector._check_sql_injection(context)
        assert len(indicators) == 0

    def test_check_sql_injection_malicious(self, threat_detector):
        """Test SQL injection detection with malicious input."""
        from udp.security.threat_detector import ThreatContext

        context = ThreatContext(
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            request_path="/api/v1/users",
            method="GET",
            headers={},
            query_params="id=1' OR '1'='1",
            body=None,
            timestamp=datetime.utcnow(),
        )

        indicators = threat_detector._check_sql_injection(context)
        assert len(indicators) > 0
        assert indicators[0].threat_type == "sql_injection"
        assert indicators[0].severity >= 0.8

    def test_check_xss_safe(self, threat_detector):
        """Test XSS detection with safe input."""
        from udp.security.threat_detector import ThreatContext

        context = ThreatContext(
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            request_path="/api/v1/projects",
            method="POST",
            headers={},
            query_params="name=Test Project",
            body='{"description": "A safe project description"}',
            timestamp=datetime.utcnow(),
        )

        indicators = threat_detector._check_xss(context)
        assert len(indicators) == 0

    def test_check_xss_malicious(self, threat_detector):
        """Test XSS detection with malicious input."""
        from udp.security.threat_detector import ThreatContext

        context = ThreatContext(
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            request_path="/api/v1/projects",
            method="POST",
            headers={},
            query_params="name=test",
            body='<script>alert("xss")</script>',
            timestamp=datetime.utcnow(),
        )

        indicators = threat_detector._check_xss(context)
        assert len(indicators) > 0
        assert indicators[0].threat_type == "xss"
        assert indicators[0].severity >= 0.7

    def test_check_path_traversal_malicious(self, threat_detector):
        """Test path traversal detection."""
        from udp.security.threat_detector import ThreatContext

        context = ThreatContext(
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            request_path="/api/v1/files/../../../etc/passwd",
            method="GET",
            headers={},
            query_params="",
            body=None,
            timestamp=datetime.utcnow(),
        )

        indicators = threat_detector._check_path_traversal(context)
        assert len(indicators) > 0
        assert indicators[0].threat_type == "path_traversal"
        assert indicators[0].severity >= 0.8

    def test_check_suspicious_user_agent(self, threat_detector):
        """Test suspicious user agent detection."""
        from udp.security.threat_detector import ThreatContext

        context = ThreatContext(
            ip_address="192.168.1.1",
            user_agent="sqlmap/1.0",
            request_path="/api/v1/users",
            method="GET",
            headers={},
            query_params="",
            body=None,
            timestamp=datetime.utcnow(),
        )

        indicators = threat_detector._check_user_agent(context)
        assert len(indicators) > 0
        assert indicators[0].threat_type == "suspicious_user_agent"
        assert indicators[0].severity >= 0.8

    def test_calculate_threat_score(self, threat_detector):
        """Test threat score calculation."""
        from udp.security.threat_detector import ThreatIndicator

        # Test with no indicators
        score = threat_detector._calculate_threat_score([])
        assert score == 0.0

        # Test with single high-severity indicator
        indicators = [
            ThreatIndicator(
                threat_type="sql_injection",
                severity=0.9,
                description="SQL injection detected",
                source="test",
            )
        ]
        score = threat_detector._calculate_threat_score(indicators)
        assert score >= 0.8

        # Test with multiple indicators
        indicators.extend(
            [
                ThreatIndicator(
                    threat_type="xss",
                    severity=0.7,
                    description="XSS detected",
                    source="test",
                ),
                ThreatIndicator(
                    threat_type="path_traversal",
                    severity=0.8,
                    description="Path traversal detected",
                    source="test",
                ),
            ]
        )
        score = threat_detector._calculate_threat_score(indicators)
        assert score > 0.8  # Should be higher due to multiple indicators


class TestRateLimiterConfig:
    """Test rate limiter configuration."""

    def test_get_default_rate_limit_rules(self):
        """Test default rate limit rules loading."""
        from udp.security.rate_limiter_config import (
            get_default_rate_limit_rules,
            RATE_LIMIT_RULES,
        )

        rules = get_default_rate_limit_rules()

        assert len(rules) > 0
        assert any(rule.name == "global_dos_protection" for rule in rules)
        assert any(rule.name == "auth_login" for rule in rules)
        assert any(rule.name == "api_general" for rule in rules)

        # Check critical rules exist
        critical_rules = [
            "global_dos_protection",
            "auth_login",
            "api_general",
            "analysis_requests",
        ]

        rule_names = [rule.name for rule in rules]
        for critical_rule in critical_rules:
            assert critical_rule in rule_names

    def test_get_rate_limit_rule_mapping(self):
        """Test rate limit rule mapping."""
        from udp.security.rate_limiter_config import get_rate_limit_rule_mapping

        mapping = get_rate_limit_rule_mapping()

        assert len(mapping) > 0
        assert r"/auth/login" in mapping
        assert r"/api/v1/.*" in mapping

        # Check auth endpoints have auth rules
        login_rules = mapping.get(r"/auth/login", [])
        assert "auth_login" in login_rules
        assert "global_dos_protection" in login_rules

    def test_rate_limit_rule_constants(self):
        """Test rate limit rule constants."""
        from udp.security.rate_limiter_config import RATE_LIMIT_RULES

        assert isinstance(RATE_LIMIT_RULES, dict)
        assert len(RATE_LIMIT_RULES) > 0
        assert "GLOBAL_DOS_PROTECTION" in RATE_LIMIT_RULES
        assert "AUTH_LOGIN" in RATE_LIMIT_RULES


class TestSecurityMiddleware:
    """Test security middleware functionality."""

    def test_security_headers_csp_generation(self):
        """Test CSP header generation."""
        with patch("udp.api.middleware.security.settings"):
            from udp.api.middleware.security import SecurityHeadersMiddleware

            middleware = SecurityHeadersMiddleware(app=None, https_enabled=True)
            csp = middleware._get_csp_header()

            assert "default-src 'self'" in csp
            assert "script-src" in csp
            assert "style-src" in csp
            assert "frame-ancestors 'none'" in csp

    def test_security_headers_permissions_policy(self):
        """Test permissions policy generation."""
        with patch("udp.api.middleware.security.settings"):
            from udp.api.middleware.security import SecurityHeadersMiddleware

            middleware = SecurityHeadersMiddleware(app=None, https_enabled=True)
            policy = middleware._get_permissions_policy()

            assert "geolocation=()" in policy
            assert "microphone=()" in policy
            assert "camera=()" in policy

    def test_request_validation_blocked_user_agents(self):
        """Test blocked user agent validation."""
        with patch("udp.api.middleware.security.settings"):
            from udp.api.middleware.security import RequestValidationMiddleware

            middleware = RequestValidationMiddleware(app=None)
            blocked_agents = middleware._load_blocked_user_agents()

            assert "sqlmap" in blocked_agents
            assert "nikto" in blocked_agents
            assert "curl" in blocked_agents

            # Test blocked agent detection
            assert middleware._is_blocked_user_agent("sqlmap/1.0")
            assert middleware._is_blocked_user_agent("Mozilla/5.0 compatible with curl")
            assert not middleware._is_blocked_user_agent(
                "Mozilla/5.0 (Windows NT 10.0)"
            )

    def test_request_validation_path_security(self):
        """Test request path validation."""
        with patch("udp.api.middleware.security.settings"):
            from udp.api.middleware.security import RequestValidationMiddleware

            middleware = RequestValidationMiddleware(app=None)

            # Test safe paths
            assert middleware._is_valid_path("/api/v1/projects")
            assert middleware._is_valid_path("/api/v1/users/123")

            # Test dangerous paths
            assert not middleware._is_valid_path("/api/v1/files/../../../etc/passwd")
            assert not middleware._is_valid_path("/api/v1/../../windows/system32")
            assert not middleware._is_valid_path(
                "/api/v1/files/<script>alert('xss')</script>"
            )

    def test_cors_origin_validation(self):
        """Test CORS origin validation."""
        with patch("udp.api.middleware.security.settings"):
            from udp.api.middleware.security import CORSMiddleware

            # Test with development origins
            middleware = CORSMiddleware(
                app=None, allow_origins=["http://localhost:3000", "https://app.upm.com"]
            )

            assert middleware._is_origin_allowed("http://localhost:3000")
            assert middleware._is_origin_allowed("https://app.upm.com")
            assert not middleware._is_origin_allowed("https://evil.com")
            assert not middleware._is_origin_allowed("http://malicious-site.com")


class TestSecurityIntegration:
    """Test security integration scenarios."""

    def test_middleware_stack_integration(self):
        """Test that all middleware components can be imported together."""
        try:
            with patch("udp.api.middleware.security.settings"):
                from udp.api.middleware.security import (
                    SecurityHeadersMiddleware,
                    RateLimitMiddleware,
                    RequestValidationMiddleware,
                    AuditLoggingMiddleware,
                    CORSMiddleware,
                )

                # Test that middleware classes can be instantiated
                SecurityHeadersMiddleware(app=None, https_enabled=True)
                RateLimitMiddleware(app=None)
                RequestValidationMiddleware(app=None)
                AuditLoggingMiddleware(app=None)
                CORSMiddleware(app=None)

                assert True  # All imports successful

        except ImportError as e:
            pytest.fail(f"Failed to import security middleware: {e}")

    def test_security_components_compatibility(self):
        """Test that security components are compatible with each other."""
        try:
            with (
                patch("udp.security.threat_detector.settings"),
                patch("udp.security.rate_limiter.settings"),
            ):
                from udp.security.threat_detector import ThreatDetector
                from udp.security.rate_limiter_config import (
                    get_default_rate_limit_rules,
                )

                # Test that components can be created together
                detector = ThreatDetector()
                rules = get_default_rate_limit_rules()

                assert detector is not None
                assert len(rules) > 0

        except Exception as e:
            pytest.fail(f"Security components compatibility test failed: {e}")


# Test data for security scenarios
MALICIOUS_REQUESTS = [
    {
        "description": "SQL injection attempt",
        "query_params": "id=1' UNION SELECT * FROM users--",
        "expected_threat": "sql_injection",
        "min_severity": 0.8,
    },
    {
        "description": "XSS attempt",
        "body": "<script>alert('xss')</script>",
        "expected_threat": "xss",
        "min_severity": 0.7,
    },
    {
        "description": "Path traversal attempt",
        "path": "/api/v1/files/../../../etc/passwd",
        "expected_threat": "path_traversal",
        "min_severity": 0.8,
    },
    {
        "description": "Command injection attempt",
        "query_params": "cmd=test; ls -la",
        "expected_threat": "command_injection",
        "min_severity": 0.8,
    },
]

SAFE_REQUESTS = [
    {
        "description": "Normal API request",
        "query_params": "page=1&limit=10",
        "body": '{"name": "Test Project"}',
        "path": "/api/v1/projects",
        "expected_threat": None,
    },
    {
        "description": "User profile update",
        "query_params": "",
        "body": '{"email": "user@example.com", "name": "John Doe"}',
        "path": "/api/v1/users/profile",
        "expected_threat": None,
    },
]
