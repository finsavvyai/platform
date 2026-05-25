"""
Unit tests for security components including rate limiting, middleware,
API keys, and monitoring systems.
"""

import pytest
import asyncio
import json
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
    IPReputationManager,
    RequestValidator,
    SecurityEvent,
    ThreatType,
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
    SecurityIncident,
    AlertSeverity,
    SecurityMetrics,
)


class TestRateLimiter:
    """Test rate limiting functionality."""

    @pytest.fixture
    async def rate_limiter(self):
        """Create rate limiter for testing."""
        # Create mock Redis client
        mock_redis = AsyncMock()
        rate_limiter = RateLimiter(mock_redis)

        # Add test rule
        await rate_limiter.add_rule(
            RateLimitRule(
                name="test_rule",
                requests=10,
                window_seconds=60,
                strategy=RateLimitStrategy.SLIDING_WINDOW,
                scope=RateLimitScope.USER,
            )
        )

        return rate_limiter

    @pytest.mark.asyncio
    async def test_sliding_window_rate_limiting(self, rate_limiter):
        """Test sliding window rate limiting strategy."""

        user_id = "test_user_123"

        # First 10 requests should be allowed
        for i in range(10):
            result = await rate_limiter.check_rate_limit(
                rule_name="test_rule", user_id=user_id
            )
            assert result.allowed is True
            assert result.remaining == 9 - i

        # 11th request should be denied
        result = await rate_limiter.check_rate_limit(
            rule_name="test_rule", user_id=user_id
        )
        assert result.allowed is False
        assert result.remaining == 0
        assert result.retry_after is not None

    @pytest.mark.asyncio
    async def test_token_bucket_rate_limiting(self, rate_limiter):
        """Test token bucket rate limiting strategy."""

        # Add token bucket rule
        await rate_limiter.add_rule(
            RateLimitRule(
                name="token_bucket_rule",
                requests=5,
                window_seconds=60,
                strategy=RateLimitStrategy.TOKEN_BUCKET,
                scope=RateLimitScope.USER,
                burst_limit=10,
            )
        )

        user_id = "test_user_456"

        # Should allow up to burst limit initially
        for i in range(10):
            result = await rate_limiter.check_rate_limit(
                rule_name="token_bucket_rule", user_id=user_id
            )
            assert result.allowed is True

        # Next request should be denied
        result = await rate_limiter.check_rate_limit(
            rule_name="token_bucket_rule", user_id=user_id
        )
        assert result.allowed is False

    @pytest.mark.asyncio
    async def test_fixed_window_rate_limiting(self, rate_limiter):
        """Test fixed window rate limiting strategy."""

        # Add fixed window rule
        await rate_limiter.add_rule(
            RateLimitRule(
                name="fixed_window_rule",
                requests=5,
                window_seconds=60,
                strategy=RateLimitStrategy.FIXED_WINDOW,
                scope=RateLimitScope.USER,
            )
        )

        user_id = "test_user_789"

        # First 5 requests should be allowed
        for i in range(5):
            result = await rate_limiter.check_rate_limit(
                rule_name="fixed_window_rule", user_id=user_id
            )
            assert result.allowed is True

        # 6th request should be denied
        result = await rate_limiter.check_rate_limit(
            rule_name="fixed_window_rule", user_id=user_id
        )
        assert result.allowed is False

    @pytest.mark.asyncio
    async def test_different_scopes_isolated(self, rate_limiter):
        """Test that different scopes are isolated."""

        # Test user scope
        for i in range(10):
            result = await rate_limiter.check_rate_limit(
                rule_name="test_rule", user_id="user1"
            )
            assert result.allowed is True

        # Same user should be rate limited
        result = await rate_limiter.check_rate_limit(
            rule_name="test_rule", user_id="user1"
        )
        assert result.allowed is False

        # Different user should still be allowed
        result = await rate_limiter.check_rate_limit(
            rule_name="test_rule", user_id="user2"
        )
        assert result.allowed is True

    @pytest.mark.asyncio
    async def test_get_rate_limiter_singleton(self):
        """Test that get_rate_limiter returns singleton instance."""

        limiter1 = await get_rate_limiter()
        limiter2 = await get_rate_limiter()

        assert limiter1 is limiter2

    @pytest.mark.asyncio
    async def test_rate_limit_stats(self, rate_limiter):
        """Test rate limiting statistics."""

        stats = await rate_limiter.get_stats()

        assert "total_rules" in stats
        assert "rules" in stats
        assert "redis_connected" in stats
        assert stats["total_rules"] >= 1
        assert "test_rule" in stats["rules"]


class TestIPReputationManager:
    """Test IP reputation management."""

    @pytest.fixture
    def ip_reputation(self):
        """Create IP reputation manager for testing."""
        return IPReputationManager()

    def test_initial_reputation_score(self, ip_reputation):
        """Test that new IPs get neutral reputation score."""

        ip = "192.168.1.1"
        score = ip_reputation.get_score(ip)

        assert score == 50
        assert ip_reputation.is_blacklisted(ip) is False

    def test_score_updates_for_threats(self, ip_reputation):
        """Test that threat events update IP scores."""

        ip = "192.168.1.2"

        # Low severity threat
        ip_reputation.update_score(ip, ThreatType.SQL_INJECTION, "low")
        assert ip_reputation.get_score(ip) == 45  # 50 - 5

        # Medium severity threat
        ip_reputation.update_score(ip, ThreatType.XSS, "medium")
        assert ip_reputation.get_score(ip) == 30  # 45 - 15

        # High severity threat
        ip_reputation.update_score(ip, ThreatType.BRUTE_FORCE, "high")
        assert ip_reputation.get_score(ip) == 0  # 30 - 30

    def test_auto_blacklisting(self, ip_reputation):
        """Test automatic blacklisting for low scores."""

        ip = "192.168.1.3"

        # Critical threat should auto-blacklist
        ip_reputation.update_score(ip, ThreatType.DDoS, "critical")

        assert ip_reputation.get_score(ip) == 0
        assert ip_reputation.is_blacklisted(ip) is True

    def test_penalty_values(self, ip_reputation):
        """Test that severity penalties are applied correctly."""

        ip = "192.168.1.4"

        # Test all severity levels
        penalties = {"low": 5, "medium": 15, "high": 30, "critical": 50}

        for severity, expected_penalty in penalties.items():
            initial_score = ip_reputation.get_score(ip)
            ip_reputation.update_score(ip, ThreatType.SUSPICIOUS_USER_AGENT, severity)
            final_score = ip_reputation.get_score(ip)

            assert initial_score - final_score == expected_penalty


class TestRequestValidator:
    """Test request validation functionality."""

    @pytest.fixture
    def validator(self):
        """Create request validator for testing."""
        return RequestValidator()

    @pytest.fixture
    def mock_request(self):
        """Create mock request for testing."""
        request = MagicMock()
        request.client.host = "192.168.1.1"
        request.headers = {"user-agent": "Mozilla/5.0"}
        request.url.path = "/api/v1/test"
        request.url.query = ""
        return request

    def test_suspicious_user_agent_detection(self, validator, mock_request):
        """Test detection of suspicious user agents."""

        # Test with suspicious user agent
        mock_request.headers = {"user-agent": "sqlmap/1.0"}
        events = validator.validate_request(mock_request)

        assert len(events) == 1
        assert events[0].threat_type == ThreatType.SUSPICIOUS_USER_AGENT
        assert events[0].severity == "medium"

    def test_sql_injection_detection(self, validator, mock_request):
        """Test SQL injection pattern detection."""

        # Test with SQL injection in query
        mock_request.url.query = "id=1' OR '1'='1"
        events = validator.validate_request(mock_request)

        assert len(events) == 1
        assert events[0].threat_type == ThreatType.SQL_INJECTION
        assert events[0].severity == "high"

    def test_xss_detection(self, validator, mock_request):
        """Test XSS pattern detection."""

        # Test with XSS in query
        mock_request.url.query = "search=<script>alert('xss')</script>"
        events = validator.validate_request(mock_request)

        assert len(events) == 1
        assert events[0].threat_type == ThreatType.XSS
        assert events[0].severity == "high"

    def test_clean_request(self, validator, mock_request):
        """Test that clean requests pass validation."""

        events = validator.validate_request(mock_request)

        assert len(events) == 0

    def test_multiple_threats(self, validator, mock_request):
        """Test detection of multiple threats in one request."""

        # Request with both suspicious user agent and SQL injection
        mock_request.headers = {"user-agent": "nikto/2.1"}
        mock_request.url.query = "id=1'; DROP TABLE users; --"

        events = validator.validate_request(mock_request)

        assert len(events) == 2
        threat_types = {event.threat_type for event in events}
        assert ThreatType.SUSPICIOUS_USER_AGENT in threat_types
        assert ThreatType.SQL_INJECTION in threat_types


class TestAPIKeyManager:
    """Test API key management functionality."""

    @pytest.fixture
    def mock_db_session(self):
        """Create mock database session."""
        session = AsyncMock()
        session.commit = AsyncMock()
        return session

    @pytest.fixture
    def api_key_manager(self, mock_db_session):
        """Create API key manager for testing."""
        return APIKeyManager(mock_db_session)

    @pytest.mark.asyncio
    async def test_create_api_key(self, api_key_manager, mock_db_session):
        """Test API key creation."""

        request = APIKeyCreateRequest(
            name="Test Key",
            key_type=APIKeyType.READ_ONLY,
            scopes=[APIKeyScope.PROJECT_READ, APIKeyScope.PACKAGE_READ],
            organization_id="org_123",
            user_id="user_456",
        )

        key_id, key_secret = await api_key_manager.create_api_key(request)

        assert key_id is not None
        assert key_secret is not None
        assert key_secret.startswith("upm_")
        assert key_id in key_secret
        assert len(key_secret) > 20

        # Verify database operations
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_validate_api_key_success(self, api_key_manager, mock_db_session):
        """Test successful API key validation."""

        # Mock successful database lookup
        mock_record = MagicMock()
        mock_record.key_id = "test_key_id"
        mock_record.key_hash = "hash"
        mock_record.name = "Test Key"
        mock_record.key_type = APIKeyType.READ_ONLY.value
        mock_record.scopes = [APIKeyScope.PROJECT_READ.value]
        mock_record.organization_id = "org_123"
        mock_record.user_id = "user_456"
        mock_record.expires_at = None
        mock_record.last_used_at = None
        mock_record.created_at = datetime.utcnow()
        mock_record.metadata = {}
        mock_record.is_active = True

        mock_db_session.execute.return_value.scalar_one_or_none.return_value = (
            mock_record
        )

        # Mock hash verification
        with patch.object(api_key_manager, "_verify_key_hash", return_value=True):
            result = await api_key_manager.validate_api_key("upm_test_key_id_random")

        assert result.is_valid is True
        assert result.key_info is not None
        assert result.key_info.key_id == "test_key_id"
        assert result.key_info.name == "Test Key"

    @pytest.mark.asyncio
    async def test_validate_api_key_not_found(self, api_key_manager, mock_db_session):
        """Test API key validation when key not found."""

        mock_db_session.execute.return_value.scalar_one_or_none.return_value = None

        result = await api_key_manager.validate_api_key("upm_nonexistent_key")

        assert result.is_valid is False
        assert result.error_code == "KEY_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_validate_api_key_expired(self, api_key_manager, mock_db_session):
        """Test API key validation when key is expired."""

        mock_record = MagicMock()
        mock_record.key_id = "test_key_id"
        mock_record.key_hash = "hash"
        mock_record.expires_at = datetime.utcnow() - timedelta(days=1)
        mock_record.is_active = True

        mock_db_session.execute.return_value.scalar_one_or_none.return_value = (
            mock_record
        )

        with patch.object(api_key_manager, "_verify_key_hash", return_value=True):
            result = await api_key_manager.validate_api_key("upm_test_key_id_random")

        assert result.is_valid is False
        assert result.error_code == "KEY_EXPIRED"

    @pytest.mark.asyncio
    async def test_scope_validation(self, api_key_manager):
        """Test API key scope validation."""

        # Test valid scopes for read-only key
        valid_scopes = [APIKeyScope.PROJECT_READ, APIKeyScope.PACKAGE_READ]
        await api_key_manager._validate_key_scopes(APIKeyType.READ_ONLY, valid_scopes)

        # Test invalid scope for read-only key
        invalid_scopes = [APIKeyScope.PROJECT_DELETE]
        with pytest.raises(ValueError):
            await api_key_manager._validate_key_scopes(
                APIKeyType.READ_ONLY, invalid_scopes
            )

    def test_key_secret_generation(self, api_key_manager):
        """Test API key secret generation."""

        key_id = "test_key_123"
        key_secret = api_key_manager._generate_key_secret(key_id)

        assert key_secret.startswith("upm_")
        assert key_id in key_secret
        assert len(key_secret) > len(key_id)

    def test_key_id_extraction(self, api_key_manager):
        """Test key ID extraction from secret."""

        key_secret = "upm_test_key_123_randompart"
        key_id = api_key_manager._extract_key_id(key_secret)

        assert key_id == "test_key_123"

    def test_key_hashing(self, api_key_manager):
        """Test API key hashing."""

        key_secret = "upm_test_key_123_randompart"
        key_hash = api_key_manager._hash_key(key_secret)

        assert key_hash is not None
        assert len(key_hash) == 64  # SHA256 hex length

        # Verify consistent hashing
        key_hash2 = api_key_manager._hash_key(key_secret)
        assert key_hash == key_hash2


class TestSecurityMonitor:
    """Test security monitoring functionality."""

    @pytest.fixture
    def mock_db_session(self):
        """Create mock database session."""
        return AsyncMock()

    @pytest.fixture
    def security_monitor(self, mock_db_session):
        """Create security monitor for testing."""
        return SecurityMonitor(mock_db_session)

    @pytest.mark.asyncio
    async def test_record_security_event(self, security_monitor):
        """Test security event recording."""

        event = SecurityEvent(
            threat_type=ThreatType.SQL_INJECTION,
            severity="high",
            source_ip="192.168.1.1",
            user_agent="test-agent",
            endpoint="/api/v1/test",
        )

        await security_monitor.record_security_event(event)

        assert len(security_monitor.event_buffer) == 1
        assert security_monitor.event_buffer[0] == event

    @pytest.mark.asyncio
    async def test_security_metrics_calculation(self, security_monitor):
        """Test security metrics calculation."""

        # Add test events
        events = [
            SecurityEvent(
                threat_type=ThreatType.SQL_INJECTION,
                severity="high",
                source_ip="192.168.1.1",
                user_agent="agent1",
                endpoint="/api/v1/test1",
            ),
            SecurityEvent(
                threat_type=ThreatType.XSS,
                severity="medium",
                source_ip="192.168.1.2",
                user_agent="agent2",
                endpoint="/api/v1/test2",
            ),
            SecurityEvent(
                threat_type=ThreatType.SQL_INJECTION,
                severity="high",
                source_ip="192.168.1.1",
                user_agent="agent1",
                endpoint="/api/v1/test1",
            ),
        ]

        for event in events:
            await security_monitor.record_security_event(event)

        metrics = await security_monitor.get_security_metrics("1h")

        assert metrics.total_events == 3
        assert len(metrics.events_by_threat_type) == 2
        assert metrics.events_by_threat_type[ThreatType.SQL_INJECTION] == 2
        assert metrics.events_by_threat_type[ThreatType.XSS] == 1
        assert metrics.unique_ips == 2
        assert metrics.unique_users == 2

    @pytest.mark.asyncio
    async def test_alert_creation(self, security_monitor):
        """Test security alert creation."""

        alert = await security_monitor.create_alert(
            title="Test Alert",
            description="Test alert description",
            severity=AlertSeverity.HIGH,
            threat_type=ThreatType.SQL_INJECTION,
            source_ip="192.168.1.1",
            endpoint="/api/v1/test",
            organization_id="org_123",
        )

        assert alert is not None
        assert alert.title == "Test Alert"
        assert alert.severity == AlertSeverity.HIGH
        assert alert.status == AlertStatus.NEW
        assert alert.id in security_monitor.active_alerts

    @pytest.mark.asyncio
    async def test_alert_status_update(self, security_monitor):
        """Test alert status update."""

        # Create alert
        alert = await security_monitor.create_alert(
            title="Test Alert",
            description="Test",
            severity=AlertSeverity.MEDIUM,
            threat_type=ThreatType.XSS,
            source_ip="192.168.1.1",
            endpoint="/api/v1/test",
        )

        # Update status
        success = await security_monitor.update_alert_status(
            alert.id,
            AlertStatus.RESOLVED,
            resolved_by="admin_user",
            notes="Investigated and resolved",
        )

        assert success is True
        assert alert.status == AlertStatus.RESOLVED
        assert alert.resolved_by == "admin_user"
        assert alert.notes == "Investigated and resolved"

    @pytest.mark.asyncio
    async def test_ddos_incident_creation(self, security_monitor):
        """Test DDoS incident creation."""

        # Create multiple events from same IP
        for i in range(50):
            event = SecurityEvent(
                threat_type=ThreatType.DDoS,
                severity="high",
                source_ip="192.168.1.100",
                user_agent=f"bot_{i}",
                endpoint=f"/api/v1/endpoint_{i % 5}",
            )
            await security_monitor.record_security_event(event)

        # Check for incident creation
        await security_monitor._check_incident_conditions(event)

        # Should have created a DDoS incident
        ddos_incidents = [
            incident
            for incident in security_monitor.active_incidents.values()
            if ThreatType.DDoS in incident.threat_types
        ]

        assert len(ddos_incidents) > 0
        incident = ddos_incidents[0]
        assert incident.title == "DDoS Attack Detected"
        assert incident.severity == AlertSeverity.HIGH
        assert "192.168.1.100" in incident.affected_ips

    @pytest.mark.asyncio
    async def test_start_stop_monitoring(self, security_monitor):
        """Test starting and stopping security monitoring."""

        # Start monitoring
        await security_monitor.start_monitoring()
        assert security_monitor._monitoring_active is True
        assert security_monitor._monitoring_task is not None

        # Stop monitoring
        await security_monitor.stop_monitoring()
        assert security_monitor._monitoring_active is False


class TestIntegratedSecurityFlow:
    """Test integrated security workflows."""

    @pytest.mark.asyncio
    async def test_complete_security_flow(self):
        """Test complete security workflow from request to alert."""

        # Mock components
        mock_db_session = AsyncMock()
        rate_limiter = RateLimiter(AsyncMock())
        ip_reputation = IPReputationManager()
        request_validator = RequestValidator()
        security_monitor = SecurityMonitor(mock_db_session)

        # Setup rate limiting
        await rate_limiter.add_rule(
            RateLimitRule(
                name="test_rule",
                requests=5,
                window_seconds=60,
                strategy=RateLimitStrategy.SLIDING_WINDOW,
                scope=RateLimitScope.IP,
            )
        )

        # Simulate malicious request
        client_ip = "192.168.1.200"

        # Create malicious request
        mock_request = MagicMock()
        mock_request.client.host = client_ip
        mock_request.headers = {"user-agent": "sqlmap/1.0"}
        mock_request.url.path = "/api/v1/users"
        mock_request.url.query = "id=1'; DROP TABLE users; --"

        # Validate request
        events = request_validator.validate_request(mock_request)
        assert len(events) >= 2  # Should detect both suspicious UA and SQL injection

        # Update IP reputation
        for event in events:
            ip_reputation.update_score(client_ip, event.threat_type, event.severity)
            await security_monitor.record_security_event(event)

        # Check if IP is now blacklisted
        ip_score = ip_reputation.get_score(client_ip)
        assert ip_score < 50  # Score should be reduced

        # Simulate multiple malicious requests to trigger incident
        for i in range(10):
            event = SecurityEvent(
                threat_type=ThreatType.SQL_INJECTION,
                severity="high",
                source_ip=client_ip,
                user_agent="sqlmap/1.0",
                endpoint="/api/v1/users",
            )
            await security_monitor.record_security_event(event)

        # Check for alerts
        alerts = await security_monitor.get_active_alerts()
        assert len(alerts) > 0

        # Check metrics
        metrics = await security_monitor.get_security_metrics("1h")
        assert metrics.total_events >= 10

        # Verify IP reputation is severely impacted
        final_score = ip_reputation.get_score(client_ip)
        assert final_score < 20  # Should be heavily penalized


# Integration tests
@pytest.mark.integration
class TestSecurityIntegration:
    """Integration tests for security components."""

    @pytest.mark.asyncio
    async def test_middleware_integration(self):
        """Test security middleware integration with FastAPI."""

        # This would test the actual middleware with FastAPI app
        # For now, we'll test the components individually

        pass

    @pytest.mark.asyncio
    async def test_rate_limiting_integration(self):
        """Test rate limiting integration with Redis."""

        # This would test actual Redis operations
        # For now, we'll test with mocked Redis

        pass


# Performance tests
@pytest.mark.performance
class TestSecurityPerformance:
    """Performance tests for security components."""

    @pytest.mark.asyncio
    async def test_rate_limiter_performance(self):
        """Test rate limiter performance under load."""

        mock_redis = AsyncMock()
        rate_limiter = RateLimiter(mock_redis)

        await rate_limiter.add_rule(
            RateLimitRule(
                name="perf_test",
                requests=1000,
                window_seconds=60,
                strategy=RateLimitStrategy.SLIDING_WINDOW,
                scope=RateLimitScope.USER,
            )
        )

        # Test 1000 concurrent requests
        start_time = time.time()

        tasks = []
        for i in range(1000):
            task = rate_limiter.check_rate_limit(
                rule_name="perf_test",
                user_id=f"user_{i % 100}",  # 100 different users
            )
            tasks.append(task)

        results = await asyncio.gather(*tasks)

        end_time = time.time()
        duration = end_time - start_time

        # Performance assertions
        assert duration < 5.0  # Should complete within 5 seconds
        assert len(results) == 1000
        assert all(result.allowed for result in results)  # All should be allowed

        print(f"Rate limiter processed 1000 requests in {duration:.2f} seconds")

    @pytest.mark.asyncio
    async def test_validator_performance(self):
        """Test request validator performance under load."""

        validator = RequestValidator()

        # Test 1000 validations
        start_time = time.time()

        for i in range(1000):
            mock_request = MagicMock()
            mock_request.client.host = f"192.168.1.{i % 255}"
            mock_request.headers = {"user-agent": f"agent_{i}"}
            mock_request.url.path = "/api/v1/test"
            mock_request.url.query = f"param={i}"

            events = validator.validate_request(mock_request)
            # Should return empty list for clean requests

        end_time = time.time()
        duration = end_time - start_time

        # Performance assertions
        assert duration < 1.0  # Should complete within 1 second

        print(f"Validator processed 1000 requests in {duration:.2f} seconds")
