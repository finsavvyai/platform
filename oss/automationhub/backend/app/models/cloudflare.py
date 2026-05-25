"""
Cloudflare Models
SQLAlchemy models for Cloudflare provider and resource management
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, JSON, ForeignKey, BigInteger, Numeric
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.declarative import declarative_base

from app.core.database import Base


class CloudflareProvider(Base):
    """Cloudflare provider model for API account management"""
    __tablename__ = "cloudflare_providers"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    api_token = Column(String(255), nullable=False)  # Encrypted
    account_id = Column(String(50), nullable=True)
    email = Column(String(255), nullable=False)
    global_api_key = Column(String(255), nullable=True)  # Encrypted

    # Zone preferences
    zone_type_preference = Column(String(20), nullable=False, server_default="full")  # full, partial
    default_rate_limit = Column(Integer, nullable=False, server_default="10")

    # Caching settings
    enable_caching = Column(Boolean, nullable=False, server_default="true")
    cache_ttl = Column(Integer, nullable=True, server_default="86400")

    # Security settings
    enable_security = Column(Boolean, nullable=False, server_default="true")
    security_level = Column(String(20), nullable=False, server_default="medium")  # off, essentially_off, low, medium, high, under_attack

    # Workers settings
    enable_workers = Column(Boolean, nullable=False, server_default="true")
    workers_subdomain = Column(String(100), nullable=True)

    # R2 settings
    enable_r2 = Column(Boolean, nullable=False, server_default="false")
    r2_access_key_id = Column(String(255), nullable=True)  # Encrypted
    r2_secret_access_key = Column(String(255), nullable=True)  # Encrypted

    # Analytics and logging
    enable_analytics = Column(Boolean, nullable=False, server_default="true")
    enable_logging = Column(Boolean, nullable=False, server_default="true")

    # Status
    is_active = Column(Boolean, nullable=False, server_default="true", index=True)
    last_verified = Column(DateTime(timezone=True), nullable=True)
    verification_error = Column(Text, nullable=True)

    # Statistics and configuration
    stats = Column(JSON, nullable=True)
    configuration = Column(JSON, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    zones = relationship("CloudflareZone", back_populates="provider", cascade="all, delete-orphan")
    workers = relationship("CloudflareWorker", back_populates="provider", cascade="all, delete-orphan")
    r2_buckets = relationship("CloudflareR2Bucket", back_populates="provider", cascade="all, delete-orphan")
    tunnels = relationship("CloudflareTunnel", back_populates="provider", cascade="all, delete-orphan")

    @validates('email')
    def validate_email(self, key, value):
        if not value or '@' not in value:
            raise ValueError('Invalid email address')
        return value.lower()

    @validates('zone_type_preference')
    def validate_zone_type_preference(self, key, value):
        valid_types = ['full', 'partial']
        if value not in valid_types:
            raise ValueError(f'Zone type preference must be one of: {valid_types}')
        return value

    @validates('security_level')
    def validate_security_level(self, key, value):
        valid_levels = ['off', 'essentially_off', 'low', 'medium', 'high', 'under_attack']
        if value not in valid_levels:
            raise ValueError(f'Security level must be one of: {valid_levels}')
        return value

    def __repr__(self):
        return f"<CloudflareProvider(id={self.id}, name='{self.name}', email='{self.email}')>"


class CloudflareZone(Base):
    """Cloudflare zone model for domain management"""
    __tablename__ = "cloudflare_zones"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("cloudflare_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Cloudflare zone details
    zone_id = Column(String(50), nullable=False, index=True)  # Cloudflare zone ID
    name = Column(String(255), nullable=False, index=True)
    status = Column(String(50), nullable=False, index=True)  # active, pending, initializing, moved, deleted
    paused = Column(Boolean, nullable=False, server_default="false")
    type = Column(String(20), nullable=False)  # full, partial
    development_mode = Column(Boolean, nullable=False, server_default="false")

    # Nameservers
    name_servers = Column(JSON, nullable=True)

    # Zone details
    plan_id = Column(String(50), nullable=True)
    permissions = Column(JSON, nullable=True)

    # Status and verification
    status_checks = Column(JSON, nullable=True)
    verification_key = Column(String(100), nullable=True)

    # Metadata
    account_id = Column(String(50), nullable=True)
    account_name = Column(String(255), nullable=True)
    name_servers_hash = Column(String(64), nullable=True)

    # Zone configuration
    ssl_setting = Column(String(20), nullable=False, server_default="flexible")  # off, flexible, full, strict, origin_pull
    min_tls_version = Column(String(10), nullable=False, server_default="1.2")
    hsts_enabled = Column(Boolean, nullable=False, server_default="false")
    always_online = Column(Boolean, nullable=False, server_default="true")
    bypass_cache_on_cookie = Column(Boolean, nullable=False, server_default="false")
    browser_cache_ttl = Column(Integer, nullable=True, server_default="14400")
    development_mode_allow = Column(Boolean, nullable=False, server_default="false")

    # Security settings
    security_level = Column(String(20), nullable=False, server_default="medium")
    challenge_ttl = Column(Integer, nullable=False, server_default="1800")
    minify_settings = Column(JSON, nullable=True)

    # Rate limiting
    rate_limiting_enabled = Column(Boolean, nullable=False, server_default="false")
    rate_limit_rules = Column(JSON, nullable=True)

    # Analytics and monitoring
    analytics_enabled = Column(Boolean, nullable=False, server_default="true")
    logging_enabled = Column(Boolean, nullable=False, server_default="true")
    real_ip_header = Column(String(50), nullable=True)

    # Timestamps
    created_at_cloudflare = Column(DateTime(timezone=True), nullable=True)
    modified_on_cloudflare = Column(DateTime(timezone=True), nullable=True)
    last_synced = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    provider = relationship("CloudflareProvider", back_populates="zones")
    dns_records = relationship("CloudflareDNSRecord", back_populates="zone", cascade="all, delete-orphan")

    @validates('name')
    def validate_name(self, key, value):
        if not value or len(value.strip()) < 1:
            raise ValueError('Zone name cannot be empty')
        if len(value) > 255:
            raise ValueError('Zone name too long')
        return value.strip().lower()

    @validates('status')
    def validate_status(self, key, value):
        valid_statuses = ['active', 'pending', 'initializing', 'moved', 'deleted']
        if value not in valid_statuses:
            raise ValueError(f'Status must be one of: {valid_statuses}')
        return value

    @validates('type')
    def validate_type(self, key, value):
        valid_types = ['full', 'partial']
        if value not in valid_types:
            raise ValueError(f'Zone type must be one of: {valid_types}')
        return value

    @validates('ssl_setting')
    def validate_ssl_setting(self, key, value):
        valid_settings = ['off', 'flexible', 'full', 'strict', 'origin_pull']
        if value not in valid_settings:
            raise ValueError(f'SSL setting must be one of: {valid_settings}')
        return value

    def __repr__(self):
        return f"<CloudflareZone(id={self.id}, zone_id='{self.zone_id}', name='{self.name}', status='{self.status}')>"


class CloudflareDNSRecord(Base):
    """Cloudflare DNS record model"""
    __tablename__ = "cloudflare_dns_records"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("cloudflare_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    zone_id = Column(PG_UUID(as_uuid=True), ForeignKey("cloudflare_zones.id", ondelete="CASCADE"), nullable=False, index=True)

    # DNS record details
    record_id = Column(String(50), nullable=False, index=True)  # Cloudflare record ID
    name = Column(String(255), nullable=False, index=True)
    type = Column(String(10), nullable=False, index=True)  # A, AAAA, CNAME, TXT, MX, NS, SRV, etc.
    content = Column(String(1000), nullable=False)
    ttl = Column(Integer, nullable=False, server_default="1")  # 1 = automatic
    priority = Column(Integer, nullable=True)  # For MX/SRV records
    proxied = Column(Boolean, nullable=False, server_default="false")

    # SRV record fields
    service = Column(String(100), nullable=True)  # For SRV records
    proto = Column(String(10), nullable=True)    # For SRV records
    srv_name = Column(String(255), nullable=True)  # For SRV records
    weight = Column(Integer, nullable=True)    # For SRV records
    port = Column(Integer, nullable=True)      # For SRV records
    target = Column(String(255), nullable=True)  # For SRV records

    # Health and status
    health = Column(String(20), nullable=True, index=True)
    dnssec_status = Column(String(20), nullable=True)
    proxiable = Column(Boolean, nullable=True)
    locked = Column(Boolean, nullable=False, server_default="false")

    # Metadata
    extra_metadata = Column(JSON, nullable=True)  # Additional metadata (renamed from 'metadata' to avoid SQLAlchemy conflict)
    tags = Column(JSON, nullable=True, default=list)

    # Monitoring
    monitoring_enabled = Column(Boolean, nullable=False, server_default="false")
    monitoring_interval = Column(Integer, nullable=True, server_default="300")
    last_health_check = Column(DateTime(timezone=True), nullable=True)
    health_status_history = Column(JSON, nullable=True)

    # Timestamps
    created_at_cloudflare = Column(DateTime(timezone=True), nullable=True)
    modified_on_cloudflare = Column(DateTime(timezone=True), nullable=True)
    last_synced = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    provider = relationship("CloudflareProvider")
    zone = relationship("CloudflareZone", back_populates="dns_records")

    @validates('name')
    def validate_name(self, key, value):
        if not value or len(value.strip()) < 1:
            raise ValueError('DNS record name cannot be empty')
        return value.strip().lower()

    @validates('type')
    def validate_type(self, key, value):
        valid_types = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'SRV', 'LOC', 'CAA', 'CERT', 'DNSKEY', 'DS', 'NSEC', 'PTR', 'SMIMEA', 'SSHFP', 'TLSA', 'URI']
        if value.upper() not in valid_types:
            raise ValueError(f'DNS record type must be one of: {valid_types}')
        return value.upper()

    @validates('ttl')
    def validate_ttl(self, key, value):
        if value not in [1] and (value < 60 or value > 86400):
            raise ValueError('TTL must be 1 (automatic) or between 60 and 86400 seconds')
        return value

    @validates('content')
    def validate_content(self, key, value):
        if not value or len(value.strip()) < 1:
            raise ValueError('DNS record content cannot be empty')
        return value.strip()

    def __repr__(self):
        return f"<CloudflareDNSRecord(id={self.id}, record_id='{self.record_id}', name='{self.name}', type='{self.type}')>"


class CloudflareWorker(Base):
    """Cloudflare Worker model"""
    __tablename__ = "cloudflare_workers"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("cloudflare_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Worker details
    worker_name = Column(String(100), nullable=False, index=True)
    script_content = Column(Text, nullable=False)
    compatibility_date = Column(String(20), nullable=False, server_default="2024-01-01")
    compatibility_flags = Column(JSON, nullable=True, default=list)
    bindings = Column(JSON, nullable=True, default=dict)  # KV, D1, R2 bindings

    # Environment variables
    environment_variables = Column(JSON, nullable=True, default=dict)
    secrets = Column(JSON, nullable=True, default=dict)  # Encrypted secrets

    # Routes and triggers
    routes = Column(JSON, nullable=True, default=list)
    triggers = Column(JSON, nullable=True, default=list)
    cron_triggers = Column(JSON, nullable=True, default=list)

    # Limits and usage
    cpu_limit_ms = Column(Integer, nullable=False, server_default="50")
    memory_limit_mb = Column(Integer, nullable=False, server_default="128")
    invoke_limit = Column(Integer, nullable=True)  # Daily invoke limit

    # Deployment and versioning
    version = Column(String(20), nullable=False, server_default="1.0.0")
    deployment_status = Column(String(20), nullable=False, server_default="draft")  # draft, active, inactive
    main_module = Column(String(100), nullable=True)
    assets = Column(JSON, nullable=True, default=dict)

    # Analytics and monitoring
    analytics_enabled = Column(Boolean, nullable=False, server_default="true")
    real_time_logs = Column(Boolean, nullable=False, server_default="false")
    tail_enabled = Column(Boolean, nullable=False, server_default="false")

    # Production and preview environments
    environment = Column(String(20), nullable=False, server_default="production")  # production, staging, preview
    preview_url = Column(String(500), nullable=True)
    production_url = Column(String(500), nullable=True)

    # Metadata
    extra_metadata = Column(JSON, nullable=True)  # Additional metadata (renamed from 'metadata' to avoid SQLAlchemy conflict)
    tags = Column(JSON, nullable=True, default=list)
    custom_domains = Column(JSON, nullable=True, default=list)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    last_deployed = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    provider = relationship("CloudflareProvider", back_populates="workers")

    @validates('worker_name')
    def validate_worker_name(self, key, value):
        if not value or len(value.strip()) < 1:
            raise ValueError('Worker name cannot be empty')
        if len(value) > 100:
            raise ValueError('Worker name too long')
        return value.strip().lower()

    @validates('deployment_status')
    def validate_deployment_status(self, key, value):
        valid_statuses = ['draft', 'active', 'inactive', 'failed']
        if value not in valid_statuses:
            raise ValueError(f'Deployment status must be one of: {valid_statuses}')
        return value

    @validates('environment')
    def validate_environment(self, key, value):
        valid_environments = ['production', 'staging', 'preview', 'development']
        if value not in valid_environments:
            raise ValueError(f'Environment must be one of: {valid_environments}')
        return value

    @validates('cpu_limit_ms')
    def validate_cpu_limit(self, key, value):
        if value < 1 or value > 100:
            raise ValueError('CPU limit must be between 1 and 100 milliseconds')
        return value

    @validates('memory_limit_mb')
    def validate_memory_limit(self, key, value):
        if value < 128 or value > 1024:
            raise ValueError('Memory limit must be between 128 and 1024 MB')
        return value

    def __repr__(self):
        return f"<CloudflareWorker(id={self.id}, worker_name='{self.worker_name}', status='{self.deployment_status}')>"


class CloudflareR2Bucket(Base):
    """Cloudflare R2 bucket model"""
    __tablename__ = "cloudflare_r2_buckets"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("cloudflare_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Bucket details
    bucket_name = Column(String(63), nullable=False, index=True)  # S3 bucket naming rules
    bucket_region = Column(String(50), nullable=False, server_default="auto")

    # Bucket configuration
    public_access = Column(Boolean, nullable=False, server_default="false")
    versioning_enabled = Column(Boolean, nullable=False, server_default="false")
    mfa_delete_enabled = Column(Boolean, nullable=False, server_default="false")

    # CORS configuration
    cors_rules = Column(JSON, nullable=True, default=list)

    # Lifecycle rules
    lifecycle_rules = Column(JSON, nullable=True, default=list)

    # Access control
    access_policy = Column(Text, nullable=True)  # IAM policy JSON
    bucket_policy = Column(Text, nullable=True)  # Bucket policy

    # Storage metrics
    object_count = Column(BigInteger, nullable=False, server_default="0")
    size_bytes = Column(BigInteger, nullable=False, server_default="0")
    upload_count = Column(BigInteger, nullable=False, server_default="0")
    download_count = Column(BigInteger, nullable=False, server_default="0")

    # Bandwidth and requests
    bandwidth_in_bytes = Column(BigInteger, nullable=False, server_default="0")
    bandwidth_out_bytes = Column(BigInteger, nullable=False, server_default="0")
    request_count = Column(BigInteger, nullable=False, server_default="0")
    error_count = Column(BigInteger, nullable=False, server_default="0")

    # Usage metrics (monthly)
    monthly_storage_cost = Column(Numeric(10, 4), nullable=False, server_default="0.0000")
    monthly_operations_cost = Column(Numeric(10, 4), nullable=False, server_default="0.0000")
    monthly_egress_cost = Column(Numeric(10, 4), nullable=False, server_default="0.0000")
    monthly_class_a_operations = Column(BigInteger, nullable=False, server_default="0")
    monthly_class_b_operations = Column(BigInteger, nullable=False, server_default="0")

    # Monitoring
    last_metrics_update = Column(DateTime(timezone=True), nullable=True)
    metrics_updated_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    extra_metadata = Column(JSON, nullable=True)  # Additional metadata (renamed from 'metadata' to avoid SQLAlchemy conflict)
    tags = Column(JSON, nullable=True, default=list)
    custom_domain = Column(String(255), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    provider = relationship("CloudflareProvider", back_populates="r2_buckets")

    @validates('bucket_name')
    def validate_bucket_name(self, key, value):
        if not value or len(value.strip()) < 3:
            raise ValueError('Bucket name must be at least 3 characters long')
        if len(value) > 63:
            raise ValueError('Bucket name cannot exceed 63 characters')
        # S3 bucket naming rules
        if not value[0].isalnum() or not value[-1].isalnum():
            raise ValueError('Bucket name must start and end with a letter or number')
        if '..' in value:
            raise ValueError('Bucket name cannot contain consecutive periods')
        if value.lower() != value:
            raise ValueError('Bucket name must be lowercase')
        return value.lower()

    @validates('bucket_region')
    def validate_bucket_region(self, key, value):
        valid_regions = ['auto', 'wnam', 'enam', 'weur', 'eeur', 'apac', 'oc', 'africa', 'me']
        if value not in valid_regions:
            raise ValueError(f'Bucket region must be one of: {valid_regions}')
        return value

    def __repr__(self):
        return f"<CloudflareR2Bucket(id={self.id}, bucket_name='{self.bucket_name}', region='{self.bucket_region}')>"


class CloudflareTunnel(Base):
    """Cloudflare Tunnel model"""
    __tablename__ = "cloudflare_tunnels"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("cloudflare_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Tunnel details
    tunnel_id = Column(String(50), nullable=False, index=True)  # Cloudflare tunnel UUID
    name = Column(String(255), nullable=False, index=True)
    secret = Column(String(255), nullable=False)  # Encrypted tunnel secret
    status = Column(String(20), nullable=False, index=True, server_default="inactive")  # inactive, active, degraded, down

    # Tunnel configuration
    config_content = Column(Text, nullable=True)  # YAML configuration
    ingress_rules = Column(JSON, nullable=True, default=list)
    origin_config = Column(JSON, nullable=True, default=dict)

    # Network settings
    lb_pool = Column(String(100), nullable=True)
    origin_server_name = Column(String(255), nullable=True)
    origin_port = Column(Integer, nullable=True)

    # Connection settings
    protocol = Column(String(10), nullable=False, server_default="https")
    proxy_address = Column(String(50), nullable=True)
    proxy_port = Column(Integer, nullable=False, server_default="7864")
    ha_connections = Column(Integer, nullable=False, server_default="4")
    heartbeat_interval = Column(Integer, nullable=False, server_default="10")
    heartbeat_timeout = Column(Integer, nullable=False, server_default="5")
    ha_margin = Column(Integer, nullable=False, server_default="50")

    # Client configuration
    client_id = Column(String(100), nullable=True)
    client_secret = Column(String(255), nullable=True)  # Encrypted
    tunnel_token = Column(String(500), nullable=True)  # Quick tunnel token

    # DNS and certificates
    dns_records = Column(JSON, nullable=True, default=list)
    ssl_config = Column(JSON, nullable=True, default=dict)

    # Log settings
    log_level = Column(String(10), nullable=False, server_default="info")
    log_file_path = Column(String(500), nullable=True)
    transport_protocol = Column(String(10), nullable=False, server_default="quic")
    edge_http_version = Column(String(10), nullable=False, server_default="1")

    # Metrics
    bytes_sent = Column(BigInteger, nullable=False, server_default="0")
    bytes_received = Column(BigInteger, nullable=False, server_default="0")
    conn_index = Column(Integer, nullable=False, server_default="0")
    start_time = Column(DateTime(timezone=True), nullable=True)
    last_connection_time = Column(DateTime(timezone=True), nullable=True)

    # Monitoring
    monitoring_enabled = Column(Boolean, nullable=False, server_default="true")
    health_check_enabled = Column(Boolean, nullable=False, server_default="true")
    health_check_url = Column(String(500), nullable=True)
    health_check_interval = Column(Integer, nullable=False, server_default="30")

    # Metadata
    extra_metadata = Column(JSON, nullable=True)  # Additional metadata (renamed from 'metadata' to avoid SQLAlchemy conflict)
    tags = Column(JSON, nullable=True, default=list)
    quick_tunnel = Column(Boolean, nullable=False, server_default="false")

    # Timestamps
    created_at_cloudflare = Column(DateTime(timezone=True), nullable=True)
    deleted_at_cloudflare = Column(DateTime(timezone=True), nullable=True)
    last_connection_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    provider = relationship("CloudflareProvider", back_populates="tunnels")

    @validates('name')
    def validate_name(self, key, value):
        if not value or len(value.strip()) < 1:
            raise ValueError('Tunnel name cannot be empty')
        if len(value) > 255:
            raise ValueError('Tunnel name too long')
        return value.strip()

    @validates('status')
    def validate_status(self, key, value):
        valid_statuses = ['inactive', 'active', 'degraded', 'down']
        if value not in valid_statuses:
            raise ValueError(f'Status must be one of: {valid_statuses}')
        return value

    @validates('protocol')
    def validate_protocol(self, key, value):
        valid_protocols = ['http', 'https', 'tcp', 'udp']
        if value.lower() not in valid_protocols:
            raise ValueError(f'Protocol must be one of: {valid_protocols}')
        return value.lower()

    @validates('transport_protocol')
    def validate_transport_protocol(self, key, value):
        valid_protocols = ['quic', 'tcp']
        if value.lower() not in valid_protocols:
            raise ValueError(f'Transport protocol must be one of: {valid_protocols}')
        return value.lower()

    @validates('proxy_port')
    def validate_proxy_port(self, key, value):
        if value < 1 or value > 65535:
            raise ValueError('Proxy port must be between 1 and 65535')
        return value

    @validates('ha_connections')
    def validate_ha_connections(self, key, value):
        if value < 1 or value > 10:
            raise ValueError('HA connections must be between 1 and 10')
        return value

    def __repr__(self):
        return f"<CloudflareTunnel(id={self.id}, tunnel_id='{self.tunnel_id}', name='{self.name}', status='{self.status}')>"