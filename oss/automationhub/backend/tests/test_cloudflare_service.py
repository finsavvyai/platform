"""
Cloudflare Service Tests
Comprehensive tests for Cloudflare API integration and management
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone
from uuid import uuid4

from app.services.cloudflare_service import CloudflareService
from app.schemas.cloudflare import (
    CloudflareProviderCreate, CloudflareProviderResponse,
    CloudflareZoneCreate, CloudflareZoneResponse,
    CloudflareDNSRecordCreate, CloudflareDNSRecordResponse,
    CloudflareWorkerCreate, CloudflareWorkerResponse,
    CloudflareR2BucketCreate, CloudflareR2BucketResponse,
    CloudflareTunnelCreate, CloudflareTunnelResponse
)


class TestCloudflareService:
    """Test cases for CloudflareService"""

    @pytest.fixture
    def mock_cloudflare_api(self):
        """Mock Cloudflare API client"""
        mock_client = AsyncMock()
        mock_client.get.return_value = {
            "success": True,
            "result": {}
        }
        mock_client.post.return_value = {
            "success": True,
            "result": {}
        }
        mock_client.put.return_value = {
            "success": True,
            "result": {}
        }
        mock_client.delete.return_value = {
            "success": True,
            "result": {}
        }
        return mock_client

    @pytest.fixture
    def cloudflare_service(self, mock_cloudflare_api):
        """Create CloudflareService instance with mocked API"""
        with patch('app.services.cloudflare_service.aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value = mock_cloudflare_api
            service = CloudflareService()
            return service

    @pytest.fixture
    def sample_provider_data(self):
        """Sample Cloudflare provider data"""
        return {
            "name": "Test Cloudflare Account",
            "api_token": "test_api_token_123",
            "email": "test@example.com",
            "account_id": "test_account_123",
            "zone_type_preference": "full",
            "default_rate_limit": 10,
            "enable_caching": True,
            "cache_ttl": 86400,
            "enable_security": True,
            "security_level": "medium",
            "enable_workers": True,
            "workers_subdomain": "test-workers",
            "enable_r2": True,
            "enable_analytics": True,
            "enable_logging": True
        }

    @pytest.fixture
    def sample_zone_data(self):
        """Sample zone data"""
        return {
            "name": "example.com",
            "account_id": "test_account_123",
            "jump_start": True,
            "type": "full"
        }

    @pytest.fixture
    def sample_dns_record_data(self):
        """Sample DNS record data"""
        return {
            "type": "A",
            "name": "test.example.com",
            "content": "192.168.1.1",
            "ttl": 3600,
            "proxied": True
        }

    @pytest.fixture
    def sample_worker_data(self):
        """Sample worker data"""
        return {
            "worker_name": "test-worker",
            "script_content": "export default { fetch() { return new Response('Hello World'); } };",
            "compatibility_date": "2024-01-01",
            "routes": ["example.com/*"],
            "environment_variables": {"ENV": "production"},
            "cpu_limit_ms": 50,
            "memory_limit_mb": 128
        }

    @pytest.fixture
    def sample_r2_bucket_data(self):
        """Sample R2 bucket data"""
        return {
            "bucket_name": "test-bucket",
            "bucket_region": "auto",
            "public_access": False,
            "versioning_enabled": True,
            "mfa_delete_enabled": False,
            "cors_rules": [
                {
                    "allowed_headers": ["*"],
                    "allowed_methods": ["GET", "POST"],
                    "allowed_origins": ["*"],
                    "max_age_seconds": 3600
                }
            ]
        }

    @pytest.fixture
    def sample_tunnel_data(self):
        """Sample tunnel data"""
        return {
            "name": "test-tunnel",
            "protocol": "https",
            "proxy_address": "localhost",
            "proxy_port": 8080,
            "ha_connections": 4,
            "ingress_rules": [
                {"hostname": "tunnel.example.com", "service": "http://localhost:8080"}
            ],
            "health_check_enabled": True,
            "health_check_url": "http://localhost:8080/health"
        }

    @pytest.mark.asyncio
    async def test_create_provider(self, cloudflare_service, mock_cloudflare_api, sample_provider_data):
        """Test creating a Cloudflare provider"""
        # Mock API responses
        mock_cloudflare_api.get.return_value = {
            "success": True,
            "result": {
                "id": "test_user_123",
                "email": "test@example.com",
                "status": "active"
            }
        }
        mock_cloudflare_api.post.return_value = {
            "success": True,
            "result": {
                "id": "test_token_123",
                "name": "Test Token"
            }
        }

        provider_data = CloudflareProviderCreate(**sample_provider_data)
        result = await cloudflare_service.create_provider(provider_data)

        assert result.name == sample_provider_data["name"]
        assert result.email == sample_provider_data["email"]
        assert result.api_token == sample_provider_data["api_token"]  # Will be encrypted in real implementation
        mock_cloudflare_api.get.assert_called()
        mock_cloudflare_api.post.assert_called()

    @pytest.mark.asyncio
    async def test_verify_provider_credentials(self, cloudflare_service, mock_cloudflare_api):
        """Test verifying Cloudflare provider credentials"""
        mock_cloudflare_api.get.return_value = {
            "success": True,
            "result": {
                "id": "test_user_123",
                "email": "test@example.com",
                "status": "active"
            }
        }

        result = await cloudflare_service.verify_provider_credentials(
            "test@example.com", "test_api_token_123"
        )

        assert result.success is True
        assert result.user_id == "test_user_123"
        assert result.email == "test@example.com"
        mock_cloudflare_api.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_zone(self, cloudflare_service, mock_cloudflare_api, sample_zone_data):
        """Test creating a Cloudflare zone"""
        zone_data = CloudflareZoneCreate(**sample_zone_data)

        # Mock API response
        mock_cloudflare_api.post.return_value = {
            "success": True,
            "result": {
                "id": "test_zone_123",
                "name": "example.com",
                "status": "active",
                "name_servers": [
                    "ns1.cloudflare.com",
                    "ns2.cloudflare.com"
                ]
            }
        }

        result = await cloudflare_service.create_zone(
            provider_id=uuid4(),
            zone_data=zone_data
        )

        assert result.zone_id == "test_zone_123"
        assert result.name == "example.com"
        assert result.status == "active"
        assert len(result.name_servers) == 2

    @pytest.mark.asyncio
    async def test_create_dns_record(self, cloudflare_service, mock_cloudflare_api, sample_dns_record_data):
        """Test creating a DNS record"""
        dns_data = CloudflareDNSRecordCreate(**sample_dns_record_data)

        # Mock API response
        mock_cloudflare_api.post.return_value = {
            "success": True,
            "result": {
                "id": "test_record_123",
                "type": "A",
                "name": "test.example.com",
                "content": "192.168.1.1",
                "ttl": 3600,
                "proxied": True
            }
        }

        result = await cloudflare_service.create_dns_record(
            provider_id=uuid4(),
            zone_id="test_zone_123",
            record_data=dns_data
        )

        assert result.record_id == "test_record_123"
        assert result.type == "A"
        assert result.name == "test.example.com"
        assert result.content == "192.168.1.1"
        assert result.proxied is True

    @pytest.mark.asyncio
    async def test_deploy_worker(self, cloudflare_service, mock_cloudflare_api, sample_worker_data):
        """Test deploying a Cloudflare Worker"""
        worker_data = CloudflareWorkerCreate(**sample_worker_data)

        # Mock API responses
        mock_cloudflare_api.post.return_value = {
            "success": True,
            "result": {
                "id": "test_worker_123",
                "script": "test-worker"
            }
        }

        result = await cloudflare_service.deploy_worker(
            provider_id=uuid4(),
            worker_data=worker_data
        )

        assert result.worker_name == "test-worker"
        assert result.deployment_status == "active"
        mock_cloudflare_api.post.assert_called()

    @pytest.mark.asyncio
    async def test_create_r2_bucket(self, cloudflare_service, mock_cloudflare_api, sample_r2_bucket_data):
        """Test creating an R2 bucket"""
        bucket_data = CloudflareR2BucketCreate(**sample_r2_bucket_data)

        # Mock API response
        mock_cloudflare_api.post.return_value = {
            "success": True,
            "result": {
                "name": "test-bucket",
                "creation_date": datetime.now(timezone.utc).isoformat()
            }
        }

        result = await cloudflare_service.create_r2_bucket(
            provider_id=uuid4(),
            bucket_data=bucket_data
        )

        assert result.bucket_name == "test-bucket"
        assert result.public_access is False
        assert result.versioning_enabled is True

    @pytest.mark.asyncio
    async def test_create_tunnel(self, cloudflare_service, mock_cloudflare_api, sample_tunnel_data):
        """Test creating a Cloudflare Tunnel"""
        tunnel_data = CloudflareTunnelCreate(**sample_tunnel_data)

        # Mock API response
        mock_cloudflare_api.post.return_value = {
            "success": True,
            "result": {
                "id": "test_tunnel_123",
                "name": "test-tunnel",
                "secret": "test_secret_123",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        }

        result = await cloudflare_service.create_tunnel(
            provider_id=uuid4(),
            tunnel_data=tunnel_data
        )

        assert result.tunnel_id == "test_tunnel_123"
        assert result.name == "test-tunnel"
        assert result.status == "inactive"  # New tunnels start inactive

    @pytest.mark.asyncio
    async def test_get_zone_analytics(self, cloudflare_service, mock_cloudflare_api):
        """Test getting zone analytics"""
        # Mock API response
        mock_cloudflare_api.get.return_value = {
            "success": True,
            "result": {
                "totals": {
                    "requests": {"all": 1000000},
                    "bandwidth": {"all": 5000000000},
                    "threats": {"all": 500},
                    "pageviews": {"all": 100000}
                },
                "timeseries": [
                    {"since": "2024-01-01T00:00:00Z", "requests": {"all": 10000}},
                    {"since": "2024-01-01T01:00:00Z", "requests": {"all": 12000}}
                ]
            }
        }

        result = await cloudflare_service.get_zone_analytics(
            provider_id=uuid4(),
            zone_id="test_zone_123",
            since=datetime.now(timezone.utc),
            until=datetime.now(timezone.utc)
        )

        assert result.total_requests > 0
        assert result.total_bandwidth > 0
        assert result.threats_total >= 0
        assert len(result.series_data) > 0

    @pytest.mark.asyncio
    async def test_manage_waf_rules(self, cloudflare_service, mock_cloudflare_api):
        """Test managing WAF rules"""
        # Mock API response
        mock_cloudflare_api.post.return_value = {
            "success": True,
            "result": {
                "id": "test_waf_rule_123",
                "description": "Test WAF rule",
                "mode": "on",
                "configuration": {
                    "target": "ip",
                    "value": "192.168.1.0/24"
                }
            }
        }

        result = await cloudflare_service.manage_waf_rules(
            provider_id=uuid4(),
            zone_id="test_zone_123",
            action="create",
            rule_config={
                "description": "Test WAF rule",
                "mode": "on",
                "target": "ip",
                "value": "192.168.1.0/24"
            }
        )

        assert result.success is True
        assert len(result.rules) == 1
        assert result.rules[0]["mode"] == "on"

    @pytest.mark.asyncio
    async def test_error_handling(self, cloudflare_service, mock_cloudflare_api):
        """Test error handling in Cloudflare service"""
        # Mock API error response
        mock_cloudflare_api.get.return_value = {
            "success": False,
            "errors": [{"code": 1003, "message": "Invalid API token"}]
        }

        with pytest.raises(Exception) as exc_info:
            await cloudflare_service.verify_provider_credentials(
                "test@example.com", "invalid_token"
            )

        assert "Invalid API token" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_rate_limiting(self, cloudflare_service, mock_cloudflare_api):
        """Test rate limiting handling"""
        # Mock rate limit error
        mock_cloudflare_api.get.return_value = {
            "success": False,
            "errors": [{"code": 1004, "message": "Rate limit exceeded"}]
        }

        # Test that rate limiting is handled gracefully
        result = await cloudflare_service.verify_provider_credentials(
            "test@example.com", "test_token"
        )

        # Should return error info instead of raising exception
        assert result.success is False

    def test_validate_credentials(self):
        """Test credential validation logic"""
        service = CloudflareService()

        # Test valid API token
        assert service.validate_credentials("test@example.com", "valid_token_123") is True

        # Test invalid email
        assert service.validate_credentials("", "valid_token_123") is False

        # Test invalid token
        assert service.validate_credentials("test@example.com", "") is False

    def test_format_ttl_value(self):
        """Test TTL value formatting"""
        service = CloudflareService()

        # Test automatic TTL
        assert service.format_ttl(1) == 1

        # Test valid TTL range
        assert service.format_ttl(300) == 300
        assert service.format_ttl(86400) == 86400

        # Test TTL normalization
        assert service.format_ttl(0) == 1  # Minimum TTL
        assert service.format_ttl(999999) == 86400  # Maximum TTL

    def test_validate_zone_name(self):
        """Test zone name validation"""
        service = CloudflareService()

        # Valid zone names
        assert service.validate_zone_name("example.com") is True
        assert service.validate_zone_name("sub.example.com") is True
        assert service.validate_zone_name("test.co.uk") is True

        # Invalid zone names
        assert service.validate_zone_name("") is False
        assert service.validate_zone_name("invalid..com") is False
        assert service.validate_zone_name("toolong" + ".com" * 50) is False

    def test_validate_dns_record(self):
        """Test DNS record validation"""
        service = CloudflareService()

        # Valid A record
        assert service.validate_dns_record("A", "test.example.com", "192.168.1.1") is True

        # Valid CNAME record
        assert service.validate_dns_record("CNAME", "www.example.com", "example.com") is True

        # Invalid IP for A record
        assert service.validate_dns_record("A", "test.example.com", "invalid_ip") is False

        # Invalid CNAME target
        assert service.validate_dns_record("CNAME", "www.example.com", "invalid..target") is False

    def test_validate_worker_script(self):
        """Test Cloudflare Worker script validation"""
        service = CloudflareService()

        # Valid worker script
        valid_script = """
        export default {
          fetch(request) {
            return new Response('Hello World');
          }
        };
        """
        assert service.validate_worker_script(valid_script) is True

        # Invalid worker script (no export)
        invalid_script = "console.log('No export');"
        assert service.validate_worker_script(invalid_script) is False

    def test_validate_bucket_name(self):
        """Test R2 bucket name validation"""
        service = CloudflareService()

        # Valid bucket names
        assert service.validate_bucket_name("test-bucket") is True
        assert service.validate_bucket_name("my-test-bucket-123") is True

        # Invalid bucket names
        assert service.validate_bucket_name("") is False
        assert service.validate_bucket_name(".invalid") is False
        assert service.validate_bucket_name("invalid.") is False
        assert service.validate_bucket_name("Invalid-Bucket") is False
        assert service.validate_bucket_name("toolong" + "name" * 50) is False


@pytest.mark.integration
class TestCloudflareServiceIntegration:
    """Integration tests for CloudflareService (requires actual Cloudflare credentials)"""

    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_full_cloudflare_workflow(self):
        """Test complete Cloudflare workflow (requires actual credentials)"""
        # This test would require actual Cloudflare credentials
        # and should be run in a separate environment with proper setup
        pytest.skip("Integration test - requires actual Cloudflare credentials")

    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_zone_lifecycle(self):
        """Test complete zone lifecycle (create, configure, delete)"""
        # This test would require actual Cloudflare credentials
        pytest.skip("Integration test - requires actual Cloudflare credentials")