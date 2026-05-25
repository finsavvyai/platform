"""
Cloudflare API Tests
Tests for Cloudflare API endpoints
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, Mock
from uuid import uuid4
import json

from app.main import app
from app.models.cloudflare import CloudflareProvider, CloudflareZone
from app.schemas.cloudflare import CloudflareProviderCreate, CloudflareZoneCreate


class TestCloudflareAPI:
    """Test cases for Cloudflare API endpoints"""

    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)

    @pytest.fixture
    def mock_provider_service(self):
        """Mock Cloudflare service"""
        mock_service = AsyncMock()
        return mock_service

    @pytest.fixture
    def sample_provider_create_data(self):
        """Sample provider creation data"""
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
    def sample_zone_create_data(self):
        """Sample zone creation data"""
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
            "proxied": True,
            "priority": None
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

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_create_provider_success(self, mock_service_class, client, sample_provider_create_data):
        """Test successful provider creation"""
        # Setup mock
        mock_service = AsyncMock()
        mock_service.create_provider.return_value = Mock(
            id=uuid4(),
            name=sample_provider_create_data["name"],
            email=sample_provider_create_data["email"],
            is_active=True
        )
        mock_service_class.return_value = mock_service

        # Make request
        response = client.post(
            "/api/v1/cloudflare/providers",
            json=sample_provider_create_data
        )

        # Assertions
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == sample_provider_create_data["name"]
        assert data["email"] == sample_provider_create_data["email"]
        assert data["is_active"] is True

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_create_provider_validation_error(self, client):
        """Test provider creation with validation error"""
        invalid_data = {
            "name": "",  # Empty name should fail validation
            "api_token": "test_token",
            "email": "invalid-email"  # Invalid email format
        }

        response = client.post(
            "/api/v1/cloudflare/providers",
            json=invalid_data
        )

        assert response.status_code == 422  # Validation error

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_get_providers(self, mock_service_class, client):
        """Test getting list of providers"""
        # Setup mock
        mock_service = AsyncMock()
        mock_service.get_providers.return_value = [
            Mock(
                id=uuid4(),
                name="Provider 1",
                email="provider1@example.com",
                is_active=True
            ),
            Mock(
                id=uuid4(),
                name="Provider 2",
                email="provider2@example.com",
                is_active=False
            )
        ]
        mock_service_class.return_value = mock_service

        response = client.get("/api/v1/cloudflare/providers")

        assert response.status_code == 200
        data = response.json()
        assert len(data["providers"]) == 2
        assert data["total"] == 2

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_get_provider_by_id(self, mock_service_class, client):
        """Test getting provider by ID"""
        provider_id = uuid4()
        mock_service = AsyncMock()
        mock_service.get_provider.return_value = Mock(
            id=provider_id,
            name="Test Provider",
            email="test@example.com",
            is_active=True
        )
        mock_service_class.return_value = mock_service

        response = client.get(f"/api/v1/cloudflare/providers/{provider_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(provider_id)
        assert data["name"] == "Test Provider"

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_create_zone_success(self, mock_service_class, client, sample_zone_create_data):
        """Test successful zone creation"""
        provider_id = uuid4()
        mock_service = AsyncMock()
        mock_service.create_zone.return_value = Mock(
            id=uuid4(),
            zone_id="test_zone_123",
            name=sample_zone_create_data["name"],
            status="active",
            name_servers=["ns1.cloudflare.com", "ns2.cloudflare.com"]
        )
        mock_service_class.return_value = mock_service

        response = client.post(
            f"/api/v1/cloudflare/providers/{provider_id}/zones",
            json=sample_zone_create_data
        )

        assert response.status_code == 201
        data = response.json()
        assert data["zone_id"] == "test_zone_123"
        assert data["name"] == sample_zone_create_data["name"]
        assert data["status"] == "active"

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_get_zones(self, mock_service_class, client):
        """Test getting zones for a provider"""
        provider_id = uuid4()
        mock_service = AsyncMock()
        mock_service.get_zones.return_value = [
            Mock(
                id=uuid4(),
                zone_id="zone_1",
                name="example.com",
                status="active"
            ),
            Mock(
                id=uuid4(),
                zone_id="zone_2",
                name="test.com",
                status="pending"
            )
        ]
        mock_service_class.return_value = mock_service

        response = client.get(f"/api/v1/cloudflare/providers/{provider_id}/zones")

        assert response.status_code == 200
        data = response.json()
        assert len(data["zones"]) == 2
        assert data["total"] == 2

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_create_dns_record_success(self, mock_service_class, client, sample_dns_record_data):
        """Test successful DNS record creation"""
        provider_id = uuid4()
        zone_id = uuid4()
        mock_service = AsyncMock()
        mock_service.create_dns_record.return_value = Mock(
            id=uuid4(),
            record_id="record_123",
            type=sample_dns_record_data["type"],
            name=sample_dns_record_data["name"],
            content=sample_dns_record_data["content"],
            proxied=sample_dns_record_data["proxied"]
        )
        mock_service_class.return_value = mock_service

        response = client.post(
            f"/api/v1/cloudflare/providers/{provider_id}/zones/{zone_id}/dns",
            json=sample_dns_record_data
        )

        assert response.status_code == 201
        data = response.json()
        assert data["record_id"] == "record_123"
        assert data["type"] == sample_dns_record_data["type"]
        assert data["name"] == sample_dns_record_data["name"]

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_get_dns_records(self, mock_service_class, client):
        """Test getting DNS records for a zone"""
        provider_id = uuid4()
        zone_id = uuid4()
        mock_service = AsyncMock()
        mock_service.get_dns_records.return_value = [
            Mock(
                id=uuid4(),
                record_id="record_1",
                type="A",
                name="example.com",
                content="192.168.1.1"
            )
        ]
        mock_service_class.return_value = mock_service

        response = client.get(f"/api/v1/cloudflare/providers/{provider_id}/zones/{zone_id}/dns")

        assert response.status_code == 200
        data = response.json()
        assert len(data["records"]) == 1

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_deploy_worker_success(self, mock_service_class, client, sample_worker_data):
        """Test successful worker deployment"""
        provider_id = uuid4()
        mock_service = AsyncMock()
        mock_service.deploy_worker.return_value = Mock(
            id=uuid4(),
            worker_name=sample_worker_data["worker_name"],
            deployment_status="active",
            routes=sample_worker_data["routes"]
        )
        mock_service_class.return_value = mock_service

        response = client.post(
            f"/api/v1/cloudflare/providers/{provider_id}/workers",
            json=sample_worker_data
        )

        assert response.status_code == 201
        data = response.json()
        assert data["worker_name"] == sample_worker_data["worker_name"]
        assert data["deployment_status"] == "active"

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_get_workers(self, mock_service_class, client):
        """Test getting workers for a provider"""
        provider_id = uuid4()
        mock_service = AsyncMock()
        mock_service.get_workers.return_value = [
            Mock(
                id=uuid4(),
                worker_name="worker-1",
                deployment_status="active"
            )
        ]
        mock_service_class.return_value = mock_service

        response = client.get(f"/api/v1/cloudflare/providers/{provider_id}/workers")

        assert response.status_code == 200
        data = response.json()
        assert len(data["workers"]) == 1

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_create_r2_bucket_success(self, mock_service_class, client, sample_r2_bucket_data):
        """Test successful R2 bucket creation"""
        provider_id = uuid4()
        mock_service = AsyncMock()
        mock_service.create_r2_bucket.return_value = Mock(
            id=uuid4(),
            bucket_name=sample_r2_bucket_data["bucket_name"],
            bucket_region=sample_r2_bucket_data["bucket_region"],
            public_access=sample_r2_bucket_data["public_access"],
            versioning_enabled=sample_r2_bucket_data["versioning_enabled"]
        )
        mock_service_class.return_value = mock_service

        response = client.post(
            f"/api/v1/cloudflare/providers/{provider_id}/r2/buckets",
            json=sample_r2_bucket_data
        )

        assert response.status_code == 201
        data = response.json()
        assert data["bucket_name"] == sample_r2_bucket_data["bucket_name"]
        assert data["public_access"] is False
        assert data["versioning_enabled"] is True

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_get_r2_buckets(self, mock_service_class, client):
        """Test getting R2 buckets for a provider"""
        provider_id = uuid4()
        mock_service = AsyncMock()
        mock_service.get_r2_buckets.return_value = [
            Mock(
                id=uuid4(),
                bucket_name="bucket-1",
                object_count=100,
                size_bytes=1000000
            )
        ]
        mock_service_class.return_value = mock_service

        response = client.get(f"/api/v1/cloudflare/providers/{provider_id}/r2/buckets")

        assert response.status_code == 200
        data = response.json()
        assert len(data["buckets"]) == 1

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_get_zone_analytics(self, mock_service_class, client):
        """Test getting zone analytics"""
        provider_id = uuid4()
        zone_id = uuid4()
        mock_service = AsyncMock()
        mock_service.get_zone_analytics.return_value = Mock(
            total_requests=1000000,
            total_bandwidth=5000000000,
            threats_total=500,
            series_data=[
                {"timestamp": "2024-01-01T00:00:00Z", "requests": 10000},
                {"timestamp": "2024-01-01T01:00:00Z", "requests": 12000}
            ]
        )
        mock_service_class.return_value = mock_service

        response = client.get(
            f"/api/v1/cloudflare/providers/{provider_id}/zones/{zone_id}/analytics"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_requests"] == 1000000
        assert data["total_bandwidth"] == 5000000000
        assert len(data["series_data"]) == 2

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_verify_provider_credentials(self, mock_service_class, client):
        """Test verifying provider credentials"""
        mock_service = AsyncMock()
        mock_service.verify_provider_credentials.return_value = Mock(
            success=True,
            user_id="test_user_123",
            email="test@example.com"
        )
        mock_service_class.return_value = mock_service

        response = client.post(
            "/api/v1/cloudflare/verify-credentials",
            json={
                "email": "test@example.com",
                "api_token": "test_token_123"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["user_id"] == "test_user_123"

    @patch('app.services.cloudflare_service.CloudflareService')
    def test_error_handling(self, mock_service_class, client):
        """Test API error handling"""
        mock_service = AsyncMock()
        mock_service.get_providers.side_effect = Exception("Service unavailable")
        mock_service_class.return_value = mock_service

        response = client.get("/api/v1/cloudflare/providers")

        assert response.status_code == 500
        data = response.json()
        assert "error" in data.lower()

    def test_invalid_provider_id(self, client):
        """Test request with invalid provider ID"""
        invalid_id = "invalid-uuid"
        response = client.get(f"/api/v1/cloudflare/providers/{invalid_id}/zones")

        assert response.status_code == 422  # Validation error for UUID

    def test_missing_required_fields(self, client):
        """Test request with missing required fields"""
        incomplete_data = {
            "name": "Test Provider"
            # Missing api_token and email
        }

        response = client.post(
            "/api/v1/cloudflare/providers",
            json=incomplete_data
        )

        assert response.status_code == 422  # Validation error


@pytest.mark.integration
class TestCloudflareAPIIntegration:
    """Integration tests for Cloudflare API (requires actual services)"""

    def test_full_provider_lifecycle(self):
        """Test complete provider lifecycle (create, get, update, delete)"""
        # This would require actual database and services
        pytest.skip("Integration test - requires full stack setup")

    def test_zone_with_dns_records_lifecycle(self):
        """Test complete zone lifecycle with DNS records"""
        # This would require actual Cloudflare credentials
        pytest.skip("Integration test - requires Cloudflare API access")