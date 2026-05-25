"""
Comprehensive API Gateway Test Suite

This module contains comprehensive tests for the API gateway including:
- API key management and authentication
- Rate limiting functionality
- Request/response transformation
- API versioning
- WebSocket proxy functionality
- Security middleware
- Usage analytics
- Configuration management

Author: Claude Code Implementation
Task: 1.1.4 API Gateway Implementation
Updated: 2025-01-06
"""

import pytest
import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI, Request, WebSocket
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as redis

from app.gateway.core import APIGateway, GatewayMetrics
from app.gateway.auth import GatewayAuthenticator, APIKeyManager, SecurityValidator
from app.gateway.rate_limiter import RateLimiter, RateLimitType, RateLimitConfig, RateLimitResult
from app.gateway.transformer import RequestTransformer, ResponseTransformer, DataSanitizer, DataMasker
from app.gateway.versioning import APIVersioning, APIVersion, VersionStatus
from app.gateway.websocket import WebSocketProxy, WebSocketConnectionManager
from app.gateway.analytics import UsageTracker, AnalyticsEngine, UsageMetrics
from app.gateway.middleware import SecurityHeadersMiddleware, CORSMiddleware, RateLimitMiddleware
from app.gateway.config import GatewayConfig, CORSConfig, SecurityHeadersConfig
from app.gateway.models import APIKey, APIKeyStatus, APIKeyScope
from app.models.user import User


class TestAPIKeyManager:
    """Test API key management functionality"""

    def test_generate_api_key(self):
        """Test API key generation"""
        manager = APIKeyManager()
        api_key, key_hash, key_prefix = manager.generate_api_key()

        assert api_key.startswith("upm_")
        assert len(api_key) == 69  # "upm_" + 64 hex chars
        assert len(key_hash) == 64  # SHA256 hash
        assert len(key_prefix) == 8
        assert key_prefix == api_key[:8]

    def test_hash_api_key(self):
        """Test API key hashing"""
        manager = APIKeyManager()
        api_key = "upm_test_key_12345"
        hash1 = manager.hash_api_key(api_key)
        hash2 = manager.hash_api_key(api_key)

        assert hash1 == hash2
        assert len(hash1) == 64

    def test_verify_api_key(self):
        """Test API key verification"""
        manager = APIKeyManager()
        api_key = "upm_test_key_12345"
        key_hash = manager.hash_api_key(api_key)

        assert manager.verify_api_key(api_key, key_hash) is True
        assert manager.verify_api_key("wrong_key", key_hash) is False

    def test_extract_api_key_from_request(self):
        """Test API key extraction from requests"""
        manager = APIKeyManager()

        # Test Authorization header
        mock_request = Mock()
        mock_request.headers = {"Authorization": "Bearer upm_test_key_123"}
        assert manager.extract_api_key_from_request(mock_request) == "upm_test_key_123"

        # Test X-API-Key header
        mock_request.headers = {"X-API-Key": "upm_test_key_456"}
        assert manager.extract_api_key_from_request(mock_request) == "upm_test_key_456"

        # Test query parameter
        mock_request.headers = {}
        mock_request.query_params = {"api_key": "upm_test_key_789"}
        assert manager.extract_api_key_from_request(mock_request) == "upm_test_key_789"

        # No API key
        mock_request.headers = {}
        mock_request.query_params = {}
        assert manager.extract_api_key_from_request(mock_request) is None


class TestRateLimiter:
    """Test rate limiting functionality"""

    @pytest.fixture
    async def rate_limiter(self):
        """Create rate limiter instance"""
        limiter = RateLimiter()
        await limiter.initialize()
        yield limiter
        await limiter.shutdown()

    @pytest.mark.asyncio
    async def test_rate_limit_check_basic(self, rate_limiter):
        """Test basic rate limit checking"""
        identifier = "test_user"
        endpoint = "/api/test"

        # First request should be allowed
        result = await rate_limiter.check_rate_limit(
            RateLimitType.PER_USER,
            identifier,
            endpoint
        )
        assert result.allowed is True
        assert result.remaining > 0

        # Second request should also be allowed (within limits)
        result2 = await rate_limiter.check_rate_limit(
            RateLimitType.PER_USER,
            identifier,
            endpoint
        )
        assert result2.allowed is True
        assert result2.remaining < result.remaining

    @pytest.mark.asyncio
    async def test_rate_limit_exceeded(self, rate_limiter):
        """Test rate limit exceeded scenario"""
        identifier = "test_user_exceed"
        endpoint = "/api/test/exceed"

        # Create a configuration with very low limits for testing
        low_limit_config = RateLimitConfig(
            requests_per_minute=2,
            requests_per_hour=10,
            requests_per_day=100
        )
        rate_limiter.set_config("test", low_limit_config)

        # Make requests up to the limit
        for i in range(2):
            result = await rate_limiter.check_rate_limit(
                RateLimitType.PER_USER,
                identifier,
                endpoint,
                "test"
            )
            assert result.allowed is True

        # Next request should be rate limited
        result = await rate_limiter.check_rate_limit(
            RateLimitType.PER_USER,
            identifier,
            endpoint,
            "test"
        )
        assert result.allowed is False
        assert result.remaining == 0
        assert result.retry_after is not None

    @pytest.mark.asyncio
    async def test_whitelist_and_blacklist(self, rate_limiter):
        """Test whitelist and blacklist functionality"""
        # Test whitelist
        whitelisted_config = RateLimitConfig(
            whitelist=["whitelisted_user"],
            requests_per_minute=1
        )
        rate_limiter.set_config("whitelist_test", whitelisted_config)

        result = await rate_limiter.check_rate_limit(
            RateLimitType.PER_USER,
            "whitelisted_user",
            "/api/test",
            "whitelist_test"
        )
        assert result.allowed is True
        assert result.is_whitelisted is True

        # Test blacklist
        blacklisted_config = RateLimitConfig(
            blacklist=["blacklisted_user"],
            requests_per_minute=1000
        )
        rate_limiter.set_config("blacklist_test", blacklisted_config)

        result = await rate_limiter.check_rate_limit(
            RateLimitType.PER_USER,
            "blacklisted_user",
            "/api/test",
            "blacklist_test"
        )
        assert result.allowed is False
        assert result.is_blacklisted is True


class TestSecurityValidator:
    """Test security validation functionality"""

    def test_validate_ip_address(self):
        """Test IP address validation"""
        validator = SecurityValidator()

        # Valid IPs
        assert validator.validate_ip_address("192.168.1.1") is True
        assert validator.validate_ip_address("10.0.0.1") is True
        assert validator.validate_ip_address("127.0.0.1") is True

        # Test whitelist
        allowed_ips = ["192.168.1.1", "10.0.0.1"]
        assert validator.validate_ip_address("192.168.1.1", allowed_ips=allowed_ips) is True
        assert validator.validate_ip_address("10.0.0.2", allowed_ips=allowed_ips) is False

        # Test blacklist
        blocked_ips = ["192.168.1.100"]
        assert validator.validate_ip_address("192.168.1.100", blocked_ips=blocked_ips) is False
        assert validator.validate_ip_address("192.168.1.1", blocked_ips=blocked_ips) is True

    def test_validate_origin(self):
        """Test origin validation"""
        validator = SecurityValidator()

        allowed_origins = ["https://example.com", "https://app.example.com"]

        assert validator.validate_origin("https://example.com", allowed_origins) is True
        assert validator.validate_origin("https://app.example.com", allowed_origins) is True
        assert validator.validate_origin("https://malicious.com", allowed_origins) is False

        # Wildcard origin
        assert validator.validate_origin("https://any.com", ["*"]) is True

    def test_calculate_risk_score(self):
        """Test risk score calculation"""
        validator = SecurityValidator()

        # Low risk request
        context = Mock()
        context.user_agent = "Mozilla/5.0 (compatible; TestBot/1.0)"
        context.timestamp = datetime.utcnow()
        context.security_flags = []

        score = validator.calculate_risk_score(context)
        assert 0 <= score <= 1

        # Higher risk request (bot user agent)
        context.user_agent = "BadBot/1.0"
        score = validator.calculate_risk_score(context)
        assert score > 0

        # Even higher risk (night time + bot)
        night_time = datetime.utcnow().replace(hour=2)
        context.timestamp = night_time
        score = validator.calculate_risk_score(context)
        assert score > 0.3


class TestDataSanitizer:
    """Test data sanitization functionality"""

    def test_sanitize_html(self):
        """Test HTML sanitization"""
        sanitizer = DataSanitizer()

        # Remove dangerous HTML tags
        malicious_html = "<script>alert('xss')</script><p>Safe content</p>"
        sanitized = sanitizer.sanitize_html(malicious_html)
        assert "<script>" not in sanitized
        assert "<p>Safe content</p>" in sanitized

        # Remove dangerous attributes
        html_with_attrs = '<div onclick="alert(\'xss\')">Content</div>'
        sanitized = sanitizer.sanitize_html(html_with_attrs)
        assert "onclick" not in sanitized

    def test_sanitize_sql(self):
        """Test SQL injection sanitization"""
        sanitizer = DataSanitizer()

        # Remove SQL injection patterns
        malicious_sql = "SELECT * FROM users WHERE id = 1; DROP TABLE users;"
        sanitized = sanitizer.sanitize_sql(malicious_sql)
        assert "DROP TABLE" not in sanitized

    def test_sanitize_json(self):
        """Test JSON data sanitization"""
        sanitizer = DataSanitizer()

        # Sanitize JSON with malicious content
        malicious_data = {
            "name": "<script>alert('xss')</script>",
            "query": "SELECT * FROM users; DROP TABLE users;",
            "safe_field": "safe content"
        }
        sanitized = sanitizer.sanitize_json(malicious_data)

        assert sanitized["name"] != "<script>alert('xss')</script>"
        assert "DROP TABLE" not in str(sanitized["query"])
        assert sanitized["safe_field"] == "safe content"


class TestDataMasker:
    """Test data masking functionality"""

    def test_mask_email(self):
        """Test email masking"""
        masker = DataMasker()
        email = "user@example.com"
        masked = masker.mask_data(email, ["email"])
        assert "@" in masked
        assert "@" in masked.split("@")[1]  # Domain should be preserved
        assert masked.count("@") == 1

    def test_mask_phone(self):
        """Test phone number masking"""
        masker = DataMasker()
        phone = "123-456-7890"
        masked = masker.mask_data(phone, ["phone"])
        assert masked.endswith("7890")
        assert "***" in masked

    def test_mask_credit_card(self):
        """Test credit card masking"""
        masker = DataMasker()
        card = "4111-1111-1111-1111"
        masked = masker.mask_data(card, ["credit_card"])
        assert masked.endswith("1111")
        assert "****" in masked

    def test_mask_json_data(self):
        """Test JSON data masking"""
        masker = DataMasker()
        data = {
            "user_email": "user@example.com",
            "phone": "123-456-7890",
            "safe_field": "safe content"
        }
        masked = masker.mask_data(data, ["email", "phone"])

        assert masked["user_email"] != "user@example.com"
        assert masked["phone"] != "123-456-7890"
        assert masked["safe_field"] == "safe content"


class TestAPIVersioning:
    """Test API versioning functionality"""

    @pytest.fixture
    def versioning(self):
        """Create API versioning instance"""
        from app.gateway.config import GatewayPolicyConfig
        config = GatewayPolicyConfig()
        return APIVersioning(config)

    def test_extract_version_from_path(self, versioning):
        """Test version extraction from URL path"""
        # Mock request
        mock_request = Mock()
        mock_request.url = Mock()
        mock_request.url.path = "/api/v1/users"

        version = versioning._extract_version_from_path(mock_request)
        assert version == "v1"

        # Test alternative format
        mock_request.url.path = "/v2/data"
        version = versioning._extract_version_from_path(mock_request)
        assert version == "v2"

        # No version in path
        mock_request.url.path = "/users"
        version = versioning._extract_version_from_path(mock_request)
        assert version is None

    def test_version_support(self, versioning):
        """Test version support checking"""
        assert versioning._is_version_supported("v1") is True
        assert versioning._is_version_supported("v999") is False

    def test_add_version(self, versioning):
        """Test adding new version"""
        new_version = APIVersion(
            version="v4",
            status=VersionStatus.BETA,
            introduced_at=datetime.utcnow(),
            description="Test version v4"
        )
        versioning.add_version(new_version)

        assert versioning._is_version_supported("v4") is True
        retrieved = versioning.get_version_info("v4")
        assert retrieved.version == "v4"
        assert retrieved.status == VersionStatus.BETA

    def test_deprecate_version(self, versioning):
        """Test version deprecation"""
        versioning.deprecate_version("v3", sunset_days=30)

        version_info = versioning.get_version_info("v3")
        assert version_info.status == VersionStatus.DEPRECATED
        assert version_info.deprecated_at is not None
        assert version_info.sunset_at is not None


class TestWebSocketProxy:
    """Test WebSocket proxy functionality"""

    @pytest.fixture
    def websocket_proxy(self):
        """Create WebSocket proxy instance"""
        from app.gateway.config import GatewayPolicyConfig
        config = GatewayPolicyConfig()
        return WebSocketProxy(config)

    def test_connection_manager_initialization(self):
        """Test WebSocket connection manager initialization"""
        manager = WebSocketConnectionManager()

        assert manager.active_connections == {}
        assert manager.user_connections == {}
        assert manager.endpoint_connections == {}

    @pytest.mark.asyncio
    async def test_add_connection(self, websocket_proxy):
        """Test adding WebSocket connection"""
        manager = websocket_proxy.connection_manager
        connection_id = "test_conn_123"
        user_id = "test_user_456"
        endpoint = "/ws/test"

        # Mock WebSocket
        mock_websocket = Mock()
        mock_websocket.client = Mock()
        mock_websocket.client.host = "127.0.0.1"
        mock_websocket.headers = {"user-agent": "TestClient"}

        # Mock database operations
        with patch('app.gateway.models.get_db') as mock_db:
            mock_db.return_value.__aenter__ = AsyncMock()
            mock_db.return_value.__aexit__ = AsyncMock()
            mock_db_instance = AsyncMock()
            mock_db.return_value.__aenter__.return_value = mock_db_instance

            # Mock the add and commit operations
            mock_db_instance.add = Mock()
            mock_db_instance.commit = AsyncMock()
            mock_db_instance.refresh = AsyncMock()

            connection = await manager.add_connection(
                connection_id=connection_id,
                websocket=mock_websocket,
                user_id=user_id,
                endpoint=endpoint
            )

            assert connection.connection_id == connection_id
            assert connection.user_id == user_id
            assert connection.endpoint == endpoint
            assert connection.is_active is True

    @pytest.mark.asyncio
    async def test_remove_connection(self, websocket_proxy):
        """Test removing WebSocket connection"""
        manager = websocket_proxy.connection_manager
        connection_id = "test_conn_123"

        # Mock database operations
        with patch('app.gateway.models.get_db') as mock_db:
            mock_db.return_value.__aenter__ = AsyncMock()
            mock_db.return_value.__aexit__ = AsyncMock()
            mock_db_instance = AsyncMock()
            mock_db.return_value.__aenter__.return_value = mock_db_instance

            # Mock the execute and commit operations
            mock_db_instance.execute = AsyncMock()
            mock_db_instance.commit = AsyncMock()

            await manager.remove_connection(
                connection_id=connection_id,
                reason="Test disconnect",
                disconnect_code=1000
            )

            # Verify connection was removed from memory
            assert connection_id not in manager.active_connections


class TestUsageTracker:
    """Test usage tracking functionality"""

    @pytest.fixture
    async def usage_tracker(self):
        """Create usage tracker instance"""
        tracker = UsageTracker()
        await tracker.start()
        yield tracker
        await tracker.stop()

    @pytest.mark.asyncio
    async def test_track_request(self, usage_tracker):
        """Test request tracking"""
        metrics = UsageMetrics(
            timestamp=datetime.utcnow(),
            endpoint="/api/test",
            method="GET",
            status_code=200,
            response_time_ms=150.5,
            response_size_bytes=1024,
            user_id="test_user",
            ip_address="127.0.0.1"
        )

        # Mock database operations
        with patch('app.gateway.models.get_db') as mock_db:
            mock_db.return_value.__aenter__ = AsyncMock()
            mock_db.return_value.__aexit__ = AsyncMock()
            mock_db_instance = AsyncMock()
            mock_db.return_value.__aenter__.return_value = mock_db_instance

            # Mock the add_all and commit operations
            mock_db_instance.add_all = Mock()
            mock_db_instance.commit = AsyncMock()

            await usage_tracker.track_request(metrics)

            # Check that metrics were added to buffer
            assert len(usage_tracker.buffer) > 0

    @pytest.mark.asyncio
    async def test_flush_buffer(self, usage_tracker):
        """Test buffer flushing"""
        # Add some metrics to buffer
        for i in range(5):
            metrics = UsageMetrics(
                timestamp=datetime.utcnow(),
                endpoint=f"/api/test/{i}",
                method="GET",
                status_code=200,
                response_time_ms=100 + i,
                response_size_bytes=1000,
                user_id="test_user",
                ip_address="127.0.0.1"
            )
            usage_tracker.buffer.append(metrics)

        # Mock database operations
        with patch('app.gateway.models.get_db') as mock_db:
            mock_db.return_value.__aenter__ = AsyncMock()
            mock_db.return_value.__aexit__ = AsyncMock()
            mock_db_instance = AsyncMock()
            mock_db.return_value.__aenter__.return_value = mock_db_instance

            # Mock the add_all and commit operations
            mock_db_instance.add_all = Mock()
            mock_db_instance.commit = AsyncMock()

            buffer_size = len(usage_tracker.buffer)
            await usage_tracker.flush_buffer()

            # Buffer should be empty after flush
            assert len(usage_tracker.buffer) == 0


class TestGatewayMiddleware:
    """Test gateway middleware functionality"""

    @pytest.fixture
    def app(self):
        """Create FastAPI app for testing"""
        app = FastAPI()

        @app.get("/test")
        async def test_endpoint():
            return {"message": "test"}

        @app.post("/test")
        async def test_post_endpoint():
            return {"message": "test_post"}

        return app

    def test_security_headers_middleware(self, app):
        """Test security headers middleware"""
        from app.gateway.config import GatewayPolicyConfig, SecurityHeadersConfig
        config = GatewayPolicyConfig()
        middleware = SecurityHeadersMiddleware(app, config)

        # Test middleware creation
        assert middleware.config == config

    def test_cors_middleware(self, app):
        """Test CORS middleware"""
        from app.gateway.config import GatewayPolicyConfig, CORSConfig
        config = GatewayPolicyConfig()
        middleware = CORSMiddleware(app, config)

        # Test middleware creation
        assert middleware.config == config

    def test_ip_filtering(self, app):
        """Test IP filtering middleware"""
        from app.gateway.middleware import IPFilterMiddleware
        from app.gateway.config import GatewayPolicyConfig

        config = GatewayPolicyConfig()
        middleware = IPFilterMiddleware(app, config)

        # Test IP validation methods
        assert middleware._is_ip_allowed("192.168.1.1") is True
        assert middleware._is_ip_blocked("192.168.1.1") is False

        # Add blocked IP
        middleware.block_ip("192.168.1.100")
        assert middleware._is_ip_blocked("192.168.1.100") is True


class TestGatewayIntegration:
    """Integration tests for the complete gateway system"""

    @pytest.fixture
    async def gateway(self):
        """Create gateway instance"""
        gateway = APIGateway()
        await gateway.initialize()
        yield gateway
        await gateway.shutdown()

    @pytest.mark.asyncio
    async def test_gateway_initialization(self, gateway):
        """Test gateway initialization"""
        assert gateway._initialized is True
        assert gateway.config is not None
        assert gateway.authenticator is not None
        assert gateway.http_client is not None

    def test_gateway_metrics(self, gateway):
        """Test gateway metrics collection"""
        metrics = gateway.get_metrics()

        assert "uptime_seconds" in metrics
        assert "total_requests" in metrics
        assert "error_rate" in metrics
        assert "average_response_time_ms" in metrics
        assert "requests_per_second" in metrics

    @pytest.mark.asyncio
    async def test_gateway_status(self, gateway):
        """Test gateway status"""
        status = gateway.get_status()

        assert "initialized" in status
        assert "uptime" in status
        assert "total_requests" in status
        assert "error_rate" in status
        assert "rate_limiting_enabled" in status


# Load Testing Tests
class TestGatewayLoad:
    """Load testing for gateway components"""

    @pytest.mark.asyncio
    async def test_rate_limiter_performance(self):
        """Test rate limiter performance under load"""
        limiter = RateLimiter()
        await limiter.initialize()

        start_time = time.time()
        tasks = []

        # Create many concurrent rate limit checks
        for i in range(1000):
            task = limiter.check_rate_limit(
                RateLimitType.GLOBAL,
                f"load_test_{i}",
                "/api/load/test"
            )
            tasks.append(task)

        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks)
        end_time = time.time()

        # Performance assertions
        assert end_time - start_time < 5.0  # Should complete within 5 seconds
        assert len(results) == 1000
        assert all(isinstance(result, RateLimitResult) for result in results)

        await limiter.shutdown()

    @pytest.mark.asyncio
    async def test_authenticator_performance(self):
        """Test authenticator performance under load"""
        authenticator = GatewayAuthenticator()

        start_time = time.time()
        tasks = []

        # Create many concurrent authentication attempts
        for i in range(100):
            mock_request = Mock()
            mock_request.headers = {
                "X-API-Key": f"upm_test_key_{i}"
            }
            mock_request.query_params = {}
            mock_request.client = Mock()
            mock_request.client.host = "127.0.0.1"

            task = authenticator.authenticate(mock_request)
            tasks.append(task)

        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = time.time()

        # Performance assertions
        assert end_time - start_time < 2.0  # Should complete within 2 seconds
        assert len(results) == 100

        # All should fail (invalid keys) but not crash
        assert all(isinstance(result, Exception) or hasattr(result, 'authenticated') for result in results)


# Security Tests
class TestGatewaySecurity:
    """Security tests for gateway components"""

    @pytest.mark.asyncio
    async def test_sql_injection_prevention(self):
        """Test SQL injection prevention in sanitization"""
        sanitizer = DataSanitizer()

        malicious_inputs = [
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            "UNION SELECT * FROM users --",
            "'; INSERT INTO users VALUES ('hacker', 'pass'); --"
        ]

        for malicious_input in malicious_inputs:
            sanitized = sanitizer.sanitize_sql(malicious_input)
            assert "DROP TABLE" not in sanitized
            assert "INSERT INTO" not in sanitized
            assert "UNION SELECT" not in sanitized

    @pytest.mark.asyncio
    async def test_xss_prevention(self):
        """Test XSS prevention in sanitization"""
        sanitizer = DataSanitizer()

        xss_payloads = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert('xss')>",
            "<svg onload=alert('xss')>",
            "javascript:alert('xss')",
            "<iframe src=javascript:alert('xss')></iframe>"
        ]

        for payload in xss_payloads:
            sanitized = sanitizer.sanitize_html(payload)
            assert "<script>" not in sanitized.lower()
            assert "onerror=" not in sanitized.lower()
            assert "onload=" not in sanitized.lower()
            assert "javascript:" not in sanitized.lower()

    def test_sensitive_data_masking(self):
        """Test sensitive data masking"""
        masker = DataMasker()

        sensitive_data = {
            "email": "user@example.com",
            "ssn": "123-45-6789",
            "credit_card": "4111-1111-1111-1111",
            "api_key": "upm_secret_key_12345",
            "password": "secret123",
            "safe_field": "This is safe"
        }

        masked = masker.mask_data(sensitive_data, ["email", "ssn", "credit_card", "api_key", "password"])

        assert masked["email"] != "user@example.com"
        assert masked["ssn"] != "123-45-6789"
        assert masked["credit_card"] != "4111-1111-1111-1111"
        assert masked["api_key"] != "upm_secret_key_12345"
        assert masked["password"] != "secret123"
        assert masked["safe_field"] == "This is safe"


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])