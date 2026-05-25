"""
Cloudflare Models Tests
Tests for Cloudflare database models and Pydantic schemas
"""

import pytest
from datetime import datetime, timezone
from uuid import uuid4

from app.models.cloudflare import (
    CloudflareProvider, CloudflareZone, CloudflareDNSRecord,
    CloudflareWorker, CloudflareR2Bucket, CloudflareTunnel
)
from app.schemas.cloudflare import (
    CloudflareProviderCreate, CloudflareProviderUpdate,
    CloudflareZoneCreate, CloudflareZoneUpdate,
    CloudflareDNSRecordCreate, CloudflareDNSRecordUpdate,
    CloudflareWorkerCreate, CloudflareWorkerUpdate,
    CloudflareR2BucketCreate, CloudflareR2BucketUpdate,
    CloudflareTunnelCreate, CloudflareTunnelUpdate
)


class TestCloudflareSchemas:
    """Test cases for Cloudflare Pydantic schemas"""

    def test_cloudflare_provider_create_valid(self):
        """Test valid CloudflareProviderCreate schema"""
        data = {
            "name": "Test Provider",
            "api_token": "test_token_123",
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

        schema = CloudflareProviderCreate(**data)
        assert schema.name == data["name"]
        assert schema.api_token == data["api_token"]
        assert schema.email == data["email"]
        assert schema.zone_type_preference == "full"
        assert schema.security_level == "medium"

    def test_cloudflare_provider_create_invalid_email(self):
        """Test CloudflareProviderCreate with invalid email"""
        data = {
            "name": "Test Provider",
            "api_token": "test_token_123",
            "email": "invalid-email",  # Invalid email format
            "account_id": "test_account_123"
        }

        with pytest.raises(ValueError) as exc_info:
            CloudflareProviderCreate(**data)

        assert "email" in str(exc_info.value).lower()

    def test_cloudflare_provider_create_invalid_security_level(self):
        """Test CloudflareProviderCreate with invalid security level"""
        data = {
            "name": "Test Provider",
            "api_token": "test_token_123",
            "email": "test@example.com",
            "account_id": "test_account_123",
            "security_level": "invalid"  # Invalid security level
        }

        with pytest.raises(ValueError) as exc_info:
            CloudflareProviderCreate(**data)

        assert "security_level" in str(exc_info.value).lower()

    def test_cloudflare_provider_update_partial(self):
        """Test CloudflareProviderUpdate with partial data"""
        data = {
            "name": "Updated Provider",
            "security_level": "high"
        }

        schema = CloudflareProviderUpdate(**data)
        assert schema.name == "Updated Provider"
        assert schema.security_level == "high"
        assert schema.api_token is None  # Should be optional

    def test_cloudflare_zone_create_valid(self):
        """Test valid CloudflareZoneCreate schema"""
        data = {
            "name": "example.com",
            "account_id": "test_account_123",
            "jump_start": True,
            "type": "full"
        }

        schema = CloudflareZoneCreate(**data)
        assert schema.name == data["name"]
        assert schema.account_id == data["account_id"]
        assert schema.jump_start is True
        assert schema.type == "full"

    def test_cloudflare_zone_create_invalid_type(self):
        """Test CloudflareZoneCreate with invalid zone type"""
        data = {
            "name": "example.com",
            "account_id": "test_account_123",
            "type": "invalid"  # Invalid zone type
        }

        with pytest.raises(ValueError) as exc_info:
            CloudflareZoneCreate(**data)

        assert "type" in str(exc_info.value).lower()

    def test_cloudflare_dns_record_create_valid(self):
        """Test valid CloudflareDNSRecordCreate schema"""
        data = {
            "type": "A",
            "name": "test.example.com",
            "content": "192.168.1.1",
            "ttl": 3600,
            "proxied": True
        }

        schema = CloudflareDNSRecordCreate(**data)
        assert schema.type == "A"
        assert schema.name == "test.example.com"
        assert schema.content == "192.168.1.1"
        assert schema.ttl == 3600
        assert schema.proxied is True

    def test_cloudflare_dns_record_create_invalid_type(self):
        """Test CloudflareDNSRecordCreate with invalid record type"""
        data = {
            "type": "INVALID",  # Invalid DNS record type
            "name": "test.example.com",
            "content": "192.168.1.1"
        }

        with pytest.raises(ValueError) as exc_info:
            CloudflareDNSRecordCreate(**data)

        assert "type" in str(exc_info.value).lower()

    def test_cloudflare_dns_record_create_cname_record(self):
        """Test CloudflareDNSRecordCreate with CNAME record"""
        data = {
            "type": "CNAME",
            "name": "www.example.com",
            "content": "example.com",
            "ttl": 1,  # Automatic TTL
            "proxied": True
        }

        schema = CloudflareDNSRecordCreate(**data)
        assert schema.type == "CNAME"
        assert schema.ttl == 1

    def test_cloudflare_dns_record_create_mx_record(self):
        """Test CloudflareDNSRecordCreate with MX record"""
        data = {
            "type": "MX",
            "name": "example.com",
            "content": "mail.example.com",
            "priority": 10,
            "ttl": 3600,
            "proxied": False  # MX records can't be proxied
        }

        schema = CloudflareDNSRecordCreate(**data)
        assert schema.type == "MX"
        assert schema.priority == 10
        assert schema.proxied is False

    def test_cloudflare_worker_create_valid(self):
        """Test valid CloudflareWorkerCreate schema"""
        data = {
            "worker_name": "test-worker",
            "script_content": "export default { fetch() { return new Response('Hello'); } };",
            "compatibility_date": "2024-01-01",
            "routes": ["example.com/*"],
            "environment_variables": {"ENV": "production"},
            "cpu_limit_ms": 50,
            "memory_limit_mb": 128
        }

        schema = CloudflareWorkerCreate(**data)
        assert schema.worker_name == "test-worker"
        assert "fetch" in schema.script_content
        assert schema.routes == ["example.com/*"]
        assert schema.cpu_limit_ms == 50
        assert schema.memory_limit_mb == 128

    def test_cloudflare_worker_create_invalid_cpu_limit(self):
        """Test CloudflareWorkerCreate with invalid CPU limit"""
        data = {
            "worker_name": "test-worker",
            "script_content": "export default { fetch() { return new Response('Hello'); } };",
            "cpu_limit_ms": 150  # Exceeds maximum of 100ms
        }

        with pytest.raises(ValueError) as exc_info:
            CloudflareWorkerCreate(**data)

        assert "cpu_limit_ms" in str(exc_info.value).lower()

    def test_cloudflare_r2_bucket_create_valid(self):
        """Test valid CloudflareR2BucketCreate schema"""
        data = {
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

        schema = CloudflareR2BucketCreate(**data)
        assert schema.bucket_name == "test-bucket"
        assert schema.public_access is False
        assert schema.versioning_enabled is True
        assert len(schema.cors_rules) == 1

    def test_cloudflare_r2_bucket_create_invalid_name(self):
        """Test CloudflareR2BucketCreate with invalid bucket name"""
        data = {
            "bucket_name": ".invalid",  # Invalid bucket name
            "bucket_region": "auto"
        }

        with pytest.raises(ValueError) as exc_info:
            CloudflareR2BucketCreate(**data)

        assert "bucket_name" in str(exc_info.value).lower()

    def test_cloudflare_tunnel_create_valid(self):
        """Test valid CloudflareTunnelCreate schema"""
        data = {
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

        schema = CloudflareTunnelCreate(**data)
        assert schema.name == "test-tunnel"
        assert schema.protocol == "https"
        assert schema.proxy_address == "localhost"
        assert schema.proxy_port == 8080
        assert len(schema.ingress_rules) == 1
        assert schema.health_check_enabled is True

    def test_cloudflare_tunnel_create_invalid_protocol(self):
        """Test CloudflareTunnelCreate with invalid protocol"""
        data = {
            "name": "test-tunnel",
            "protocol": "invalid",  # Invalid protocol
            "proxy_address": "localhost"
        }

        with pytest.raises(ValueError) as exc_info:
            CloudflareTunnelCreate(**data)

        assert "protocol" in str(exc_info.value).lower()


class TestCloudflareModels:
    """Test cases for Cloudflare database models"""

    def test_cloudflare_provider_model_creation(self):
        """Test CloudflareProvider model creation"""
        provider = CloudflareProvider(
            id=uuid4(),
            tenant_id=uuid4(),
            name="Test Provider",
            api_token="encrypted_token_123",
            email="test@example.com",
            account_id="test_account_123",
            zone_type_preference="full",
            default_rate_limit=10,
            enable_caching=True,
            enable_security=True,
            security_level="medium",
            enable_workers=True,
            enable_r2=True,
            enable_analytics=True,
            enable_logging=True,
            is_active=True
        )

        assert provider.name == "Test Provider"
        assert provider.email == "test@example.com"
        assert provider.zone_type_preference == "full"
        assert provider.security_level == "medium"
        assert provider.is_active is True
        assert provider.created_at is not None

    def test_cloudflare_zone_model_creation(self):
        """Test CloudflareZone model creation"""
        zone = CloudflareZone(
            id=uuid4(),
            provider_id=uuid4(),
            tenant_id=uuid4(),
            zone_id="test_zone_123",
            name="example.com",
            status="active",
            paused=False,
            type="full",
            development_mode=False,
            name_servers=["ns1.cloudflare.com", "ns2.cloudflare.com"],
            ssl_setting="flexible",
            min_tls_version="1.2",
            security_level="medium",
            rate_limiting_enabled=False,
            analytics_enabled=True,
            logging_enabled=True
        )

        assert zone.zone_id == "test_zone_123"
        assert zone.name == "example.com"
        assert zone.status == "active"
        assert zone.type == "full"
        assert len(zone.name_servers) == 2
        assert zone.ssl_setting == "flexible"

    def test_cloudflare_dns_record_model_creation(self):
        """Test CloudflareDNSRecord model creation"""
        record = CloudflareDNSRecord(
            id=uuid4(),
            provider_id=uuid4(),
            tenant_id=uuid4(),
            zone_id=uuid4(),
            record_id="test_record_123",
            name="test.example.com",
            type="A",
            content="192.168.1.1",
            ttl=3600,
            priority=None,
            proxied=True,
            health="healthy",
            monitoring_enabled=True,
            monitoring_interval=300
        )

        assert record.record_id == "test_record_123"
        assert record.name == "test.example.com"
        assert record.type == "A"
        assert record.content == "192.168.1.1"
        assert record.proxied is True
        assert record.health == "healthy"
        assert record.monitoring_enabled is True

    def test_cloudflare_worker_model_creation(self):
        """Test CloudflareWorker model creation"""
        worker = CloudflareWorker(
            id=uuid4(),
            provider_id=uuid4(),
            tenant_id=uuid4(),
            worker_name="test-worker",
            script_content="export default { fetch() { return new Response('Hello'); } };",
            compatibility_date="2024-01-01",
            compatibility_flags=["nodejs_compat"],
            bindings={},
            environment_variables={"ENV": "production"},
            routes=["example.com/*"],
            cpu_limit_ms=50,
            memory_limit_mb=128,
            version="1.0.0",
            deployment_status="active",
            analytics_enabled=True,
            real_time_logs=False,
            environment="production"
        )

        assert worker.worker_name == "test-worker"
        assert "fetch" in worker.script_content
        assert worker.compatibility_date == "2024-01-01"
        assert worker.cpu_limit_ms == 50
        assert worker.memory_limit_mb == 128
        assert worker.deployment_status == "active"
        assert worker.analytics_enabled is True

    def test_cloudflare_r2_bucket_model_creation(self):
        """Test CloudflareR2Bucket model creation"""
        bucket = CloudflareR2Bucket(
            id=uuid4(),
            provider_id=uuid4(),
            tenant_id=uuid4(),
            bucket_name="test-bucket",
            bucket_region="auto",
            public_access=False,
            versioning_enabled=True,
            mfa_delete_enabled=False,
            cors_rules=[],
            lifecycle_rules=[],
            object_count=1000,
            size_bytes=1000000,
            upload_count=500,
            download_count=2000,
            bandwidth_in_bytes=5000000,
            bandwidth_out_bytes=10000000,
            request_count=3000,
            error_count=5,
            monthly_storage_cost=10.50,
            monthly_operations_cost=2.75,
            monthly_egress_cost=15.25,
            monthly_class_a_operations=100,
            monthly_class_b_operations=500
        )

        assert bucket.bucket_name == "test-bucket"
        assert bucket.bucket_region == "auto"
        assert bucket.public_access is False
        assert bucket.versioning_enabled is True
        assert bucket.object_count == 1000
        assert bucket.size_bytes == 1000000
        assert bucket.request_count == 3000
        assert float(bucket.monthly_storage_cost) == 10.50

    def test_cloudflare_tunnel_model_creation(self):
        """Test CloudflareTunnel model creation"""
        tunnel = CloudflareTunnel(
            id=uuid4(),
            provider_id=uuid4(),
            tenant_id=uuid4(),
            tunnel_id="test_tunnel_123",
            name="test-tunnel",
            secret="encrypted_secret_123",
            status="active",
            config_content="tunnel: test-tunnel\ningress:\n  - hostname: tunnel.example.com\n    service: http://localhost:8080",
            ingress_rules=[
                {"hostname": "tunnel.example.com", "service": "http://localhost:8080"}
            ],
            protocol="https",
            proxy_address="localhost",
            proxy_port=8080,
            ha_connections=4,
            heartbeat_interval=10,
            transport_protocol="quic",
            log_level="info",
            monitoring_enabled=True,
            health_check_enabled=True,
            health_check_url="http://localhost:8080/health",
            bytes_sent=1000000,
            bytes_received=5000000,
            quick_tunnel=False
        )

        assert tunnel.tunnel_id == "test_tunnel_123"
        assert tunnel.name == "test-tunnel"
        assert tunnel.status == "active"
        assert tunnel.protocol == "https"
        assert tunnel.proxy_address == "localhost"
        assert tunnel.proxy_port == 8080
        assert tunnel.monitoring_enabled is True
        assert tunnel.health_check_enabled is True
        assert tunnel.quick_tunnel is False

    def test_model_relationships(self):
        """Test model relationships"""
        # These would be created with proper foreign key relationships
        # For testing purposes, we're just verifying the structure
        provider = CloudflareProvider(
            id=uuid4(),
            tenant_id=uuid4(),
            name="Test Provider",
            api_token="token",
            email="test@example.com"
        )

        zone = CloudflareZone(
            id=uuid4(),
            provider_id=provider.id,
            tenant_id=provider.tenant_id,
            zone_id="zone_123",
            name="example.com",
            status="active",
            type="full"
        )

        record = CloudflareDNSRecord(
            id=uuid4(),
            provider_id=provider.id,
            tenant_id=provider.tenant_id,
            zone_id=zone.id,
            record_id="record_123",
            name="test.example.com",
            type="A",
            content="192.168.1.1"
        )

        # Verify relationships through IDs
        assert zone.provider_id == provider.id
        assert record.zone_id == zone.id
        assert record.provider_id == provider.id

    def test_model_timestamps(self):
        """Test model timestamp fields"""
        now = datetime.now(timezone.utc)
        provider = CloudflareProvider(
            id=uuid4(),
            tenant_id=uuid4(),
            name="Test Provider",
            api_token="token",
            email="test@example.com",
            created_at=now,
            updated_at=now
        )

        assert provider.created_at == now
        assert provider.updated_at == now

    def test_model_validation(self):
        """Test model validation rules"""
        # Test zone name validation
        with pytest.raises(ValueError):
            CloudflareZone(
                id=uuid4(),
                provider_id=uuid4(),
                tenant_id=uuid4(),
                zone_id="zone_123",
                name="",  # Empty name should fail
                status="active",
                type="full"
            )

        # Test invalid DNS record type
        with pytest.raises(ValueError):
            CloudflareDNSRecord(
                id=uuid4(),
                provider_id=uuid4(),
                tenant_id=uuid4(),
                zone_id=uuid4(),
                record_id="record_123",
                name="test.example.com",
                type="INVALID",  # Invalid type
                content="192.168.1.1"
            )