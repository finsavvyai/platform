"""
Tests for OPA Client Service
"""

import asyncio
import json
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from aioresponses import aioresponses
from pydantic import ValidationError

from .opa_client import (
    OPAClient,
    OPAConfig,
    PolicyEvaluationResponse,
    BatchEvaluation,
    OPATimeoutError,
    OPAApiError,
    create_opa_client,
)


class TestOPAConfig:
    """Test OPA configuration"""

    def test_default_config(self):
        """Test default configuration values"""
        config = OPAConfig()
        assert config.base_url == "http://localhost:8181"
        assert config.timeout == 5
        assert config.cache_enabled is True
        assert config.cache_ttl == 30
        assert config.retry_attempts == 3
        assert config.retry_delay == 0.1

    def test_custom_config(self):
        """Test custom configuration"""
        config = OPAConfig(
            base_url="http://custom:8181", timeout=10, cache_enabled=False, cache_ttl=60
        )
        assert config.base_url == "http://custom:8181"
        assert config.timeout == 10
        assert config.cache_enabled is False
        assert config.cache_ttl == 60

    def test_invalid_config(self):
        """Test invalid configuration validation"""
        with pytest.raises(ValidationError):
            OPAConfig(timeout=-1)


class TestOPAClient:
    """Test OPA client functionality"""

    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client"""
        redis_mock = AsyncMock()
        redis_mock.get = AsyncMock(return_value=None)
        redis_mock.setex = AsyncMock(return_value=True)
        redis_mock.delete = AsyncMock(return_value=1)
        return redis_mock

    @pytest.fixture
    def opa_client(self, mock_redis):
        """Create OPA client instance"""
        config = OPAConfig(cache_enabled=True, timeout=1)
        return OPAClient(config=config, redis_client=mock_redis)

    @pytest.fixture
    def sample_opa_response(self):
        """Sample OPA response"""
        return {"result": {"allow": True, "decision_reason": ["Access granted"]}}

    @pytest.mark.asyncio
    async def test_evaluate_policy_success(self, opa_client, sample_opa_response):
        """Test successful policy evaluation"""
        with aioresponses() as m:
            m.post(
                "http://localhost:8181/v1/data/test.policy",
                payload=sample_opa_response,
                status=200,
            )

            async with opa_client:
                response = await opa_client.evaluate_policy(
                    "test.policy", {"user": "test", "action": "read"}
                )

            assert response.decision is True
            assert response.reason == "Access granted"
            assert response.result == sample_opa_response["result"]

    @pytest.mark.asyncio
    async def test_evaluate_policy_deny(self, opa_client):
        """Test policy evaluation with deny decision"""
        response_data = {
            "result": {"allow": False, "decision_reason": ["Access denied"]}
        }

        with aioresponses() as m:
            m.post(
                "http://localhost:8181/v1/data/test.policy",
                payload=response_data,
                status=200,
            )

            async with opa_client:
                response = await opa_client.evaluate_policy(
                    "test.policy", {"user": "test", "action": "delete"}
                )

            assert response.decision is False
            assert response.reason == "Access denied"

    @pytest.mark.asyncio
    async def test_evaluate_policy_api_error(self, opa_client):
        """Test policy evaluation with API error"""
        with aioresponses() as m:
            m.post(
                "http://localhost:8181/v1/data/test.policy",
                payload={"error": "policy not found"},
                status=404,
            )

            async with opa_client:
                with pytest.raises(OPAApiError) as exc_info:
                    await opa_client.evaluate_policy("test.policy", {"user": "test"})

            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_evaluate_policy_timeout(self, opa_client):
        """Test policy evaluation timeout"""
        with aioresponses() as m:
            m.post(
                "http://localhost:8181/v1/data/test.policy",
                exception=asyncio.TimeoutError(),
            )

            async with opa_client:
                with pytest.raises(OPATimeoutError):
                    await opa_client.evaluate_policy("test.policy", {"user": "test"})

    @pytest.mark.asyncio
    async def test_evaluate_policy_retry(self, opa_client):
        """Test policy evaluation with retry"""
        with aioresponses() as m:
            # First attempt fails
            m.post(
                "http://localhost:8181/v1/data/test.policy",
                exception=Exception("Network error"),
            )
            # Second attempt succeeds
            m.post(
                "http://localhost:8181/v1/data/test.policy",
                payload={"result": {"allow": True}},
                status=200,
            )

            config = OPAConfig(retry_attempts=2, retry_delay=0.01)
            client = OPAClient(config=config, redis_client=opa_client.redis)

            async with client:
                response = await client.evaluate_policy("test.policy", {"user": "test"})

            assert response.decision is True

    @pytest.mark.asyncio
    async def test_evaluate_data_policy(self, opa_client, sample_opa_response):
        """Test data policy evaluation"""
        with aioresponses() as m:
            m.post(
                "http://localhost:8181/v1/data/sdlc.data.access",
                payload=sample_opa_response,
                status=200,
            )

            async with opa_client:
                response = await opa_client.evaluate_data_policy(
                    tenant_id="tenant-123",
                    user_id="user-123",
                    action="read",
                    resource="documents",
                    data={"id": "doc-123"},
                )

            assert response.decision is True

    @pytest.mark.asyncio
    async def test_evaluate_auth_policy(self, opa_client, sample_opa_response):
        """Test authentication policy evaluation"""
        with aioresponses() as m:
            m.post(
                "http://localhost:8181/v1/data/sdlc.auth.policy",
                payload=sample_opa_response,
                status=200,
            )

            async with opa_client:
                response = await opa_client.evaluate_auth_policy(
                    {"user_id": "user-123", "role": "admin"}
                )

            assert response.decision is True

    @pytest.mark.asyncio
    async def test_evaluate_dlp_policy(self, opa_client):
        """Test DLP policy evaluation"""
        response_data = {
            "result": {
                "allow": False,
                "decision_reason": ["Content blocked: contains high-risk PII"],
            }
        }

        with aioresponses() as m:
            m.post(
                "http://localhost:8181/v1/data/sdlc.dlp.policy",
                payload=response_data,
                status=200,
            )

            async with opa_client:
                response = await opa_client.evaluate_dlp_policy(
                    content="SSN: 123-45-6789",
                    user_context={"user_id": "user-123", "role": "user"},
                )

            assert response.decision is False
            assert "high-risk PII" in response.reason

    @pytest.mark.asyncio
    async def test_evaluate_rag_policy(self, opa_client, sample_opa_response):
        """Test RAG policy evaluation"""
        with aioresponses() as m:
            m.post(
                "http://localhost:8181/v1/data/sdlc.rag.policy",
                payload=sample_opa_response,
                status=200,
            )

            async with opa_client:
                response = await opa_client.evaluate_rag_policy(
                    query="What is the revenue?",
                    user_context={"user_id": "user-123", "role": "analyst"},
                    documents=[{"id": "doc-1", "content": "Revenue is $1M"}],
                )

            assert response.decision is True

    @pytest.mark.asyncio
    async def test_batch_evaluate_policies(self, opa_client):
        """Test batch policy evaluation"""
        with aioresponses() as m:
            for i in range(3):
                m.post(
                    f"http://localhost:8181/v1/data/test.policy.{i}",
                    payload={"result": {"allow": True}},
                    status=200,
                )

            async with opa_client:
                evaluations = [
                    BatchEvaluation("test.policy.0", {"action": "read"}),
                    BatchEvaluation("test.policy.1", {"action": "write"}),
                    BatchEvaluation("test.policy.2", {"action": "delete"}),
                ]

                responses = await opa_client.batch_evaluate_policies(evaluations)

            assert len(responses) == 3
            for response in responses:
                assert response.decision is True

    @pytest.mark.asyncio
    async def test_list_policies(self, opa_client):
        """Test listing available policies"""
        response_data = {"result": {"sdlc": {"auth": {}, "data": {}, "dlp": {}}}}

        with aioresponses() as m:
            m.get("http://localhost:8181/v1/data", payload=response_data, status=200)

            async with opa_client:
                policies = await opa_client.list_policies()

            assert "sdlc" in policies

    @pytest.mark.asyncio
    async def test_get_policy_info(self, opa_client):
        """Test getting policy information"""
        response_data = {"result": {"allow": True, "rules": ["rule1", "rule2"]}}

        with aioresponses() as m:
            m.get(
                "http://localhost:8181/v1/data/test.policy",
                payload=response_data,
                status=200,
            )

            async with opa_client:
                info = await opa_client.get_policy_info("test.policy")

            assert "result" in info
            assert info["result"]["allow"] is True

    @pytest.mark.asyncio
    async def test_health_check_success(self, opa_client):
        """Test successful health check"""
        with aioresponses() as m:
            m.get("http://localhost:8181/health", payload={"status": "ok"}, status=200)

            async with opa_client:
                is_healthy = await opa_client.health_check()

            assert is_healthy is True

    @pytest.mark.asyncio
    async def test_health_check_failure(self, opa_client):
        """Test failed health check"""
        with aioresponses() as m:
            m.get("http://localhost:8181/health", status=503)

            async with opa_client:
                is_healthy = await opa_client.health_check()

            assert is_healthy is False

    @pytest.mark.asyncio
    async def test_caching_enabled(self, opa_client, mock_redis, sample_opa_response):
        """Test decision caching"""
        # Mock cache miss, then cache set
        mock_redis.get.return_value = None

        with aioresponses() as m:
            m.post(
                "http://localhost:8181/v1/data/test.policy",
                payload=sample_opa_response,
                status=200,
            )

            async with opa_client:
                response = await opa_client.evaluate_policy(
                    "test.policy", {"user": "test"}
                )

            assert response.decision is True
            # Verify cache was set
            mock_redis.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_caching_hit(self, opa_client, mock_redis):
        """Test cache hit"""
        # Mock cache hit
        cached_data = {
            "decision": True,
            "reason": "Access granted",
            "result": {"allow": True},
            "cached_at": datetime.utcnow().isoformat(),
            "ttl": 30,
        }
        mock_redis.get.return_value = json.dumps(cached_data)

        async with opa_client:
            response = await opa_client.evaluate_policy("test.policy", {"user": "test"})

        assert response.decision is True
        assert response.reason == "Access granted"
        # Verify cache was checked but not set
        mock_redis.get.assert_called_once()
        mock_redis.setex.assert_not_called()

    @pytest.mark.asyncio
    async def test_caching_disabled(self, mock_redis, sample_opa_response):
        """Test evaluation with caching disabled"""
        config = OPAConfig(cache_enabled=False)
        client = OPAClient(config=config, redis_client=mock_redis)

        with aioresponses() as m:
            m.post(
                "http://localhost:8181/v1/data/test.policy",
                payload=sample_opa_response,
                status=200,
            )

            async with client:
                response = await client.evaluate_policy("test.policy", {"user": "test"})

            assert response.decision is True
            # Verify cache was not used
            mock_redis.get.assert_not_called()
            mock_redis.setex.assert_not_called()

    @pytest.mark.asyncio
    async def test_context_manager(self, opa_client):
        """Test async context manager"""
        async with opa_client as client:
            assert client is opa_client
            assert client.session is not None
            assert not client.session.closed

        # Session should be closed after context exit
        assert client.session.closed

    @pytest.mark.asyncio
    async def test_create_opa_client(self, mock_redis):
        """Test OPA client factory function"""
        config = OPAConfig(base_url="http://test:8181")

        with patch("redis.asyncio.from_url", return_value=mock_redis):
            client = await create_opa_client(
                config=config, redis_url="redis://localhost:6379"
            )

        assert client.config.base_url == "http://test:8181"
        assert client.redis is mock_redis


# Integration tests (would require real OPA instance)
@pytest.mark.integration
class TestOPAClientIntegration:
    """Integration tests with real OPA instance"""

    @pytest.fixture
    def opa_config(self):
        """Configuration for integration tests"""
        return OPAConfig(
            base_url="http://localhost:8181",
            timeout=5,
            cache_enabled=False,  # Disable caching for integration tests
        )

    @pytest.mark.asyncio
    async def test_real_opa_evaluation(self, opa_config):
        """Test evaluation against real OPA instance"""
        pytest.skip("Requires real OPA instance")

        client = OPAClient(config=opa_config)

        async with client:
            # Test health first
            if not await client.health_check():
                pytest.skip("OPA not available")

            # Test simple policy evaluation
            response = await client.evaluate_policy(
                "example.allow", {"user": "alice", "action": "read", "resource": "data"}
            )

            assert isinstance(response, PolicyEvaluationResponse)


# Performance tests
@pytest.mark.performance
class TestOPAClientPerformance:
    """Performance tests for OPA client"""

    @pytest.mark.asyncio
    async def test_concurrent_evaluations(self, opa_client):
        """Test concurrent policy evaluations"""
        pytest.skip("Performance test - run manually")

        async with opa_client:
            # Mock many concurrent requests
            with aioresponses() as m:
                m.post(
                    "http://localhost:8181/v1/data/test.policy",
                    payload={"result": {"allow": True}},
                    status=200,
                )

                start_time = asyncio.get_event_loop().time()

                tasks = [
                    opa_client.evaluate_policy("test.policy", {"user": f"user{i}"})
                    for i in range(100)
                ]

                responses = await asyncio.gather(*tasks)

                end_time = asyncio.get_event_loop().time()
                duration = end_time - start_time

                assert len(responses) == 100
                assert all(r.decision for r in responses)
                assert duration < 5.0  # Should complete within 5 seconds

                print(f"100 concurrent evaluations completed in {duration:.2f}s")
