"""
Unit tests for the comprehensive security system.

Tests rate limiting, enhanced security middleware, API key management,
and security monitoring components.
"""

import pytest
import time
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, Any

from src.udp.security.rate_limiter import (
    RateLimiter,
    RateLimitRule,
    RateLimitStrategy,
    RateLimitScope,
    get_rate_limiter,
)
from src.udp.security.enhanced_middleware import (
    EnhancedSecurityMiddleware,
    SecurityEvent,
    ThreatType,
    IPReputationManager,
    RequestValidator,
    SecurityLevel,
)
from src.udp.security.api_keys import (
    APIKeyManager,
    APIKeyType,
    APIKeyScope,
    APIKeyCreateRequest,
    APIKeyValidationResult,
)
from src.udp.security.monitoring import (
    SecurityMonitor,
    SecurityAlert,
    AlertSeverity,
    ThreatType as MonitorThreatType,
    SecurityMetrics,
    SecurityIncident,
)


class TestRateLimiter:
    """Test cases for RateLimiter."""

    @pytest.fixture
    async def rate_limiter(self):
        """Create a test rate limiter instance."""
        limiter = RateLimiter(redis_client=None)  # Use mock Redis
        await limiter.add_rule(
            RateLimitRule(
                name="test_rule",
                requests=10,
                window_seconds=60,
                strategy=RateLimitStrategy.SLIDING_WINDOW,
                scope=RateLimitScope.USER,
            )
        )
        return limiter

    @pytest.mark.asyncio
    async def test_add_and_get_rules(self, rate_limiter):
        """Test adding and retrieving rate limit rules."""

        rule = RateLimitRule(
            name="new_rule",
            requests=5,
            window_seconds=30,
            strategy=RateLimitStrategy.TOKEN_BUCKET,
            scope=RateLimitScope.IP,
        )

        await rate_limiter.add_rule(rule)
        rules = await rate_limiter.get_rules()

        assert "new_rule" in rules
        assert rules["new_rule"].requests == 5
        assert rules["new_rule"].strategy == RateLimitStrategy.TOKEN_BUCKET

    @pytest.mark.asyncio
    async def test_remove_rule(self, rate_limiter):
        """Test removing rate limit rules."""

        await rate_limiter.remove_rule("test_rule")
        rules = await rate_limiter.get_rules()

        assert "test_rule" not in rules

    @pytest.mark.asyncio
    async def test_check_rate_limit_allowed(self, rate_limiter):
        """Test rate limit check when request is allowed."""

        # Mock Redis client
        mock_redis = AsyncMock()
        mock_redis.zremrangebyscore.return_value = 0
        mock_redis.zcard.return_value = 0
        mock_redis.zadd.return_value = 1
        mock_redis.expire.return_value = 1
        rate_limiter.redis = mock_redis

        result = await rate_limiter.check_rate_limit(
            rule_name="test_rule", user_id="test_user"
        )

        assert result.allowed is True
        assert result.remaining >= 0
        assert result.limit == 10
        assert result.window == 60

    @pytest.mark.asyncio
    async def test_check_rate_limit_exceeded(self, rate_limiter):
        """Test rate limit check when request is denied."""

        # Mock Redis client to simulate exceeded limit
        mock_redis = AsyncMock()
        mock_redis.zremrangebyscore.return_value = 0
        mock_redis.zcard.return_value = 10  # At limit
        mock_redis.zrange.return_value = [(b"request", time.time() - 30)]
        rate_limiter.redis = mock_redis

        result = await rate_limiter.check_rate_limit(
            rule_name="test_rule", user_id="test_user"
        )

        assert result.allowed is False
        assert result.remaining == 0
        assert result.retry_after is not None

    @pytest.mark.asyncio
    async def test_check_rate_limit_missing_rule(self, rate_limiter):
        """Test rate limit check for non-existent rule."""

        result = await rate_limiter.check_rate_limit(
            rule_name="non_existent_rule", user_id="test_user"
        )

        assert result.allowed is True  # Fail open
        assert result.limit == 0

    def test_generate_key(self, rate_limiter):
        """Test Redis key generation."""

        key = rate_limiter._generate_key(
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.USER,
            user_id="test_user",
        )

        assert "rate_limit" in key
        assert "sliding_window" in key
        assert "user" in key
        assert "test_user" in key

    @pytest.mark.asyncio
    async def test_sliding_window_strategy(self, rate_limiter):
        """Test sliding window rate limiting strategy."""

        # Mock Redis client
        mock_redis = AsyncMock()
        mock_redis.zremrangebyscore.return_value = 0
        mock_redis.zcard.return_value = 5
        mock_redis.zadd.return_value = 1
        mock_redis.expire.return_value = 1
        rate_limiter.redis = mock_redis

        rule = RateLimitRule(
            name="sliding_test",
            requests=10,
            window_seconds=60,
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.USER,
        )

        result = await rate_limiter._check_sliding_window(rule, "test_key")

        assert result.allowed is True
        assert result.remaining == 4  # 10 - 5 - 1

    @pytest.mark.asyncio
    async def test_token_bucket_strategy(self, rate_limiter):
        """Test token bucket rate limiting strategy."""

        # Mock Redis client
        mock_redis = AsyncMock()
        mock_redis.hgetall.return_value = {
            "tokens": "5.0",
            "last_refill": str(time.time()),
        }
        mock_redis.hset.return_value = 1
        mock_redis.expire.return_value = 1
        rate_limiter.redis = mock_redis

        rule = RateLimitRule(
            name="bucket_test",
            requests=10,
            window_seconds=60,
            strategy=RateLimitStrategy.TOKEN_BUCKET,
            scope=RateLimitScope.USER,
        )

        result = await rate_limiter._check_token_bucket(rule, "test_key")

        assert result.allowed is True
        assert result.remaining >= 0


class TestIPReputationManager:
    """Test cases for IPReputationManager."""

    @pytest.fixture
    def ip_manager(self):
        """Create an IP reputation manager instance."""
        return IPReputationManager()

    def test_initial_reputation(self, ip_manager):
        """Test initial reputation score."""
        score = ip_manager.get_score("192.168.1.1")
        assert score == 50  # Default score
        assert not ip_manager.is_blacklisted("192.168.1.1")

    def test_update_score_low_threat(self, ip_manager):
        """Test updating score for low severity threat."""
        ip_manager.update_score("192.168.1.1", ThreatType.SQL_INJECTION, "low")

        score = ip_manager.get_score("192.168.1.1")
        assert score == 45  # 50 - 5
        assert not ip_manager.is_blacklisted("192.168.1.1")

    def test_update_score_critical_threat(self, ip_manager):
        """Test updating score for critical severity threat."""
        ip_manager.update_score("192.168.1.1", ThreatType.SQL_INJECTION, "critical")

        score = ip_manager.get_score("192.168.1.1")
        assert score == 0  # 50 - 50
        assert ip_manager.is_blacklisted("192.168.1.1")

    def test_multiple_threats(self, ip_manager):
        """Test multiple threats accumulation."""
        ip_manager.update_score("192.168.1.1", ThreatType.SQL_INJECTION, "medium")
        ip_manager.update_score("192.168.1.1", ThreatType.XSS, "high")

        score = ip_manager.get_score("192.168.1.1")
        assert score == 5  # 50 - 15 - 30

    def test_penalty_values(self, ip_manager):
        """Test penalty values for different severities."""
        assert ip_manager._get_penalty_for_severity("low") == 5
        assert ip_manager._get_penalty_for_severity("medium") == 15
        assert ip_manager._get_penalty_for_severity("high") == 30
        assert ip_manager._get_penalty_for_severity("critical") == 50
        assert ip_manager._get_penalty_for_severity("unknown") == 10


class TestRequestValidator:
    """Test cases for RequestValidator."""

    @pytest.fixture
    def validator(self):
        """Create a request validator instance."""
        return RequestValidator()

    @pytest.fixture
    def mock_request(self):
        """Create a mock FastAPI request."""
        request = MagicMock()
        request.client.host = "192.168.1.1"
        request.headers = {"user-agent": "TestAgent/1.0"}
        request.url.path = "/api/v1/test"
        request.url.query = "param=value"
        return request

    def test_suspicious_user_agent_detection(self, validator):
        """Test detection of suspicious user agents."""
        # Create request with suspicious user agent
        request = MagicMock()
        request.headers = {"user-agent": "sqlmap/1.0"}
        request.client.host = "192.168.1.1"
        request.url.path = "/api/v1/test"
        request.url.query = ""

        events = validator.validate_request(request)

        assert len(events) == 1
        assert events[0].threat_type == ThreatType.SUSPICIOUS_USER_AGENT
        assert events[0].severity == "medium"

    def test_sql_injection_detection(self, validator, mock_request):
        """Test SQL injection detection."""
        mock_request.url.query = "id=1' OR '1'='1"

        events = validator.validate_request(mock_request)

        assert len(events) == 1
        assert events[0].threat_type == ThreatType.SQL_INJECTION
        assert events[0].severity == "high"

    def test_xss_detection(self, validator, mock_request):
        """Test XSS detection."""
        mock_request.url.query = "search=<script>alert('xss')</script>"

        events = validator.validate_request(mock_request)

        assert len(events) == 1
        assert events[0].threat_type == ThreatType.XSS
        assert events[0].severity == "high"

    def test_clean_request(self, validator, mock_request):
        """Test validation of clean request."""
        events = validator.validate_request(mock_request)

        assert len(events) == 0

    def test_sql_injection_patterns(self, validator):
        """Test SQL injection pattern matching."""
        assert validator._contains_sql_injection("'; DROP TABLE users; --")
        assert validator._contains_sql_injection("1' OR '1'='1")
        assert validator._contains_sql_injection("UNION SELECT * FROM users")
        assert not validator._contains_sql_injection("normal query string")

    def test_xss_patterns(self, validator):
        """Test XSS pattern matching."""
        assert validator._contains_xss("<script>alert('test')</script>")
        assert validator._contains_xss("javascript:void(0)")
        assert validator._contains_xss("<iframe src='evil.com'>")
        assert not validator._contains_xss("normal content")


class TestAPIKeyManager:
    """Test cases for APIKeyManager."""

    @pytest.fixture
    async def api_key_manager(self):
        """Create an API key manager instance."""
        mock_db = AsyncMock()
        return APIKeyManager(mock_db)

    @pytest.mark.asyncio
    async def test_create_api_key(self, api_key_manager):
        """Test API key creation."""

        request = APIKeyCreateRequest(
            name="Test Key",
            key_type=APIKeyType.READ_ONLY,
            scopes=[APIKeyScope.PROJECT_READ, APIKeyScope.PACKAGE_READ],
            organization_id="org123",
            user_id="user123",
        )

        # Mock database operations
        api_key_manager.db_session.add = MagicMock()
        api_key_manager.db_session.commit = AsyncMock()

        key_id, key_secret = await api_key_manager.create_api_key(request)

        assert key_id is not None
        assert key_secret is not None
        assert key_secret.startswith("upm_")
        assert key_id in key_secret

    @pytest.mark.asyncio
    async def test_validate_api_key_success(self, api_key_manager):
        """Test successful API key validation."""

        key_secret = "upm_testkey_randomstring"

        # Mock database query
        mock_record = MagicMock()
        mock_record.key_id = "testkey"
        mock_record.key_hash = api_key_manager._hash_key(key_secret)
        mock_record.name = "Test Key"
        mock_record.key_type = APIKeyType.READ_ONLY.value
        mock_record.scopes = [APIKeyScope.PROJECT_READ.value]
        mock_record.organization_id = "org123"
        mock_record.user_id = "user123"
        mock_record.is_active = True
        mock_record.expires_at = None
        mock_record.last_used_at = None
        mock_record.created_at = datetime.utcnow()
        mock_record.metadata = {}

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_record

        api_key_manager.db_session.execute = AsyncMock(return_value=mock_result)
        api_key_manager.db_session.commit = AsyncMock()

        result = await api_key_manager.validate_api_key(key_secret)

        assert result.is_valid is True
        assert result.key_info is not None
        assert result.key_info.key_id == "testkey"
        assert result.key_info.key_type == APIKeyType.READ_ONLY

    @pytest.mark.asyncio
    async def test_validate_api_key_not_found(self, api_key_manager):
        """Test API key validation when key not found."""

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        api_key_manager.db_session.execute = AsyncMock(return_value=mock_result)

        result = await api_key_manager.validate_api_key("invalid_key")

        assert result.is_valid is False
        assert result.error_code == "KEY_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_validate_api_key_expired(self, api_key_manager):
        """Test API key validation when key is expired."""

        mock_record = MagicMock()
        mock_record.key_id = "testkey"
        mock_record.key_hash = "hash"
        mock_record.is_active = True
        mock_record.expires_at = datetime.utcnow() - timedelta(days=1)  # Expired

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_record
        api_key_manager.db_session.execute = AsyncMock(return_value=mock_result)

        result = await api_key_manager.validate_api_key("upm_testkey_random")

        assert result.is_valid is False
        assert result.error_code == "KEY_EXPIRED"

    def test_scope_validation(self, api_key_manager):
        """Test scope validation for different key types."""

        # Valid scope for read-only key
        valid_scopes = [APIKeyScope.PROJECT_READ, APIKeyScope.PACKAGE_READ]
        # Should not raise exception
        api_key_manager._validate_key_scopes(APIKeyType.READ_ONLY, valid_scopes)

        # Invalid scope for read-only key
        invalid_scopes = [APIKeyScope.PROJECT_DELETE]
        with pytest.raises(ValueError):
            api_key_manager._validate_key_scopes(APIKeyType.READ_ONLY, invalid_scopes)

    def test_key_generation(self, api_key_manager):
        """Test API key generation and parsing."""

        key_id = "test123"
        key_secret = api_key_manager._generate_key_secret(key_id)

        assert key_secret.startswith("upm_")
        extracted_id = api_key_manager._extract_key_id(key_secret)
        assert extracted_id == key_id

    def test_key_hashing(self, api_key_manager):
        """Test API key hashing and verification."""

        key_secret = "test_key_secret"
        key_hash = api_key_manager._hash_key(key_secret)

        assert key_hash is not None
        assert len(key_hash) == 64  # SHA256 hash length

        # Test verification
        assert api_key_manager._verify_key_hash(key_secret, key_hash)
        assert not api_key_manager._verify_key_hash("wrong_key", key_hash)


class TestSecurityMonitor:
    """Test cases for SecurityMonitor."""

    @pytest.fixture
    async def security_monitor(self):
        """Create a security monitor instance."""
        mock_db = AsyncMock()
        monitor = SecurityMonitor(mock_db)
        return monitor

    @pytest.mark.asyncio
    async def test_record_security_event(self, security_monitor):
        """Test recording security events."""

        event = SecurityEvent(
            threat_type=ThreatType.SQL_INJECTION,
            severity="high",
            source_ip="192.168.1.1",
            user_agent="TestAgent",
            endpoint="/api/v1/test",
        )

        await security_monitor.record_security_event(event)

        assert len(security_monitor.event_buffer) == 1
        assert security_monitor.event_buffer[0] == event

    @pytest.mark.asyncio
    async def test_get_security_metrics(self, security_monitor):
        """Test getting security metrics."""

        # Add some test events
        events = [
            SecurityEvent(
                threat_type=ThreatType.SQL_INJECTION,
                severity="high",
                source_ip="192.168.1.1",
                user_agent="TestAgent",
                endpoint="/api/v1/test",
                timestamp=datetime.utcnow(),
            ),
            SecurityEvent(
                threat_type=ThreatType.XSS,
                severity="medium",
                source_ip="192.168.1.2",
                user_agent="TestAgent2",
                endpoint="/api/v1/test2",
                timestamp=datetime.utcnow(),
            ),
        ]

        for event in events:
            security_monitor.event_buffer.append(event)

        metrics = await security_monitor.get_security_metrics("1h")

        assert metrics.total_events == 2
        assert metrics.unique_ips == 2
        assert metrics.unique_users == 2
        assert len(metrics.events_by_threat_type) == 2
        assert len(metrics.events_by_severity) == 2

    @pytest.mark.asyncio
    async def test_create_security_alert(self, security_monitor):
        """Test creating security alerts."""

        alert = await security_monitor.create_alert(
            title="Test Alert",
            description="Test alert description",
            severity=AlertSeverity.HIGH,
            threat_type=ThreatType.SQL_INJECTION,
            source_ip="192.168.1.1",
            endpoint="/api/v1/test",
        )

        assert alert.title == "Test Alert"
        assert alert.severity == AlertSeverity.HIGH
        assert alert.status == AlertStatus.NEW
        assert alert.id in security_monitor.active_alerts

    @pytest.mark.asyncio
    async def test_update_alert_status(self, security_monitor):
        """Test updating alert status."""

        # Create an alert first
        alert = await security_monitor.create_alert(
            title="Test Alert",
            description="Test alert description",
            severity=AlertSeverity.HIGH,
            threat_type=ThreatType.SQL_INJECTION,
            source_ip="192.168.1.1",
            endpoint="/api/v1/test",
        )

        # Update alert status
        success = await security_monitor.update_alert_status(
            alert.id,
            AlertStatus.RESOLVED,
            resolved_by="admin123",
            notes="False positive",
        )

        assert success is True
        updated_alert = security_monitor.active_alerts[alert.id]
        assert updated_alert.status == AlertStatus.RESOLVED
        assert updated_alert.resolved_by == "admin123"
        assert updated_alert.notes == "False positive"

    @pytest.mark.asyncio
    async def test_ddos_incident_creation(self, security_monitor):
        """Test DDoS incident creation."""

        # Create many events from same IP
        events = []
        for i in range(50):
            event = SecurityEvent(
                threat_type=ThreatType.DDoS,
                severity="high",
                source_ip="192.168.1.100",
                user_agent=f"Bot{i}",
                endpoint=f"/api/v1/endpoint{i}",
            )
            events.append(event)
            security_monitor.event_buffer.append(event)

        # Trigger incident check
        await security_monitor._check_incident_conditions(events[0])

        # Check if incident was created
        incidents = await security_monitor.get_active_incidents()
        ddos_incidents = [
            inc for inc in incidents if inc.title == "DDoS Attack Detected"
        ]

        assert len(ddos_incidents) >= 1
        assert "192.168.1.100" in ddos_incidents[0].affected_ips

    def test_time_window_parsing(self, security_monitor):
        """Test time window parsing."""

        assert security_monitor._parse_time_window("1h") == timedelta(hours=1)
        assert security_monitor._parse_time_window("2d") == timedelta(days=2)
        assert security_monitor._parse_time_window("1w") == timedelta(weeks=1)
        assert security_monitor._parse_time_window("30m") == timedelta(minutes=30)
        assert security_monitor._parse_time_window("invalid") == timedelta(
            hours=1
        )  # Default


class TestSecurityIntegration:
    """Integration tests for security components."""

    @pytest.mark.asyncio
    async def test_full_security_flow(self):
        """Test full security flow with all components."""

        # This would test the integration between rate limiting,
        # security middleware, API key validation, and monitoring

        # Create mock components
        mock_db = AsyncMock()
        rate_limiter = RateLimiter(redis_client=None)
        api_key_manager = APIKeyManager(mock_db)
        security_monitor = SecurityMonitor(mock_db)

        # Setup rate limit rule
        await rate_limiter.add_rule(
            RateLimitRule(
                name="integration_test",
                requests=5,
                window_seconds=60,
                strategy=RateLimitStrategy.SLIDING_WINDOW,
                scope=RateLimitScope.USER,
            )
        )

        # Test rate limiting
        mock_redis = AsyncMock()
        mock_redis.zremrangebyscore.return_value = 0
        mock_redis.zcard.return_value = 3
        mock_redis.zadd.return_value = 1
        mock_redis.expire.return_value = 1
        rate_limiter.redis = mock_redis

        rate_result = await rate_limiter.check_rate_limit(
            rule_name="integration_test", user_id="test_user"
        )
        assert rate_result.allowed

        # Test API key creation and validation
        key_request = APIKeyCreateRequest(
            name="Integration Test Key",
            key_type=APIKeyType.READ_ONLY,
            scopes=[APIKeyScope.PROJECT_READ],
            organization_id="org123",
        )

        api_key_manager.db_session.add = MagicMock()
        api_key_manager.db_session.commit = AsyncMock()

        key_id, key_secret = await api_key_manager.create_api_key(key_request)
        assert key_id and key_secret

        # Test security monitoring
        event = SecurityEvent(
            threat_type=ThreatType.SQL_INJECTION,
            severity="high",
            source_ip="192.168.1.1",
            user_agent="TestAgent",
            endpoint="/api/v1/test",
        )

        await security_monitor.record_security_event(event)

        metrics = await security_monitor.get_security_metrics("1h")
        assert metrics.total_events == 1

        alerts = await security_monitor.get_active_alerts()
        assert len(alerts) >= 1  # Should have created an alert for high severity event


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
