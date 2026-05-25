"""Add Cloudflare provider and resource tables

Revision ID: 006_add_cloudflare_tables
Revises: 005_create_infrastructure_tables
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = '006_add_cloudflare_tables'
down_revision = '005_create_infrastructure_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create cloudflare_providers table
    op.create_table(
        'cloudflare_providers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('api_token', sa.String(255), nullable=False),  # Encrypted
        sa.Column('account_id', sa.String(50), nullable=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('global_api_key', sa.String(255), nullable=True),  # Encrypted
        sa.Column('zone_type_preference', sa.String(20), nullable=False, server_default='full'),
        sa.Column('default_rate_limit', sa.Integer, nullable=False, server_default='10'),
        sa.Column('enable_caching', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('cache_ttl', sa.Integer(), nullable=True, server_default='86400'),
        sa.Column('enable_security', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('security_level', sa.String(20), nullable=False, server_default='medium'),
        sa.Column('enable_workers', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('workers_subdomain', sa.String(100), nullable=True),
        sa.Column('enable_r2', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('r2_access_key_id', sa.String(255), nullable=True),  # Encrypted
        sa.Column('r2_secret_access_key', sa.String(255), nullable=True),  # Encrypted
        sa.Column('enable_analytics', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('enable_logging', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true', index=True),
        sa.Column('last_verified', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_error', sa.Text(), nullable=True),
        sa.Column('stats', sa.JSON(), nullable=True),
        sa.Column('configuration', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Index('ix_cloudflare_providers_tenant_id', 'tenant_id'),
        sa.Index('ix_cloudflare_providers_is_active', 'is_active'),
        sa.Index('ix_cloudflare_providers_name', 'name'),
        sa.UniqueConstraint('tenant_id', 'name', name='uq_cloudflare_providers_tenant_name')
    )

    # Create cloudflare_zones table
    op.create_table(
        'cloudflare_zones',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cloudflare_providers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('zone_id', sa.String(50), nullable=False, index=True),  # Cloudflare zone ID
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('status', sa.String(50), nullable=False, index=True),
        sa.Column('paused', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('type', sa.String(20), nullable=False),  # full, partial
        sa.Column('development_mode', sa.Boolean(), nullable=False, server_default='false'),

        # Nameservers
        sa.Column('name_servers', sa.JSON(), nullable=True),

        # Zone settings
        sa.Column('plan_id', sa.String(50), nullable=True),
        sa.Column('permissions', sa.JSON(), nullable=True),

        # Status and verification
        sa.Column('status_checks', sa.JSON(), nullable=True),
        sa.Column('verification_key', sa.String(100), nullable=True),

        # Metadata
        sa.Column('account_id', sa.String(50), nullable=True),
        sa.Column('account_name', sa.String(255), nullable=True),
        sa.Column('name_servers_hash', sa.String(64), nullable=True),

        # Configuration
        sa.Column('ssl_setting', sa.String(20), nullable=False, server_default='flexible'),
        sa.Column('min_tls_version', sa.String(10), nullable=False, server_default='1.2'),
        sa.Column('hsts_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('always_online', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('bypass_cache_on_cookie', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('browser_cache_ttl', sa.Integer(), nullable=True, server_default='14400'),
        sa.Column('development_mode_allow', sa.Boolean(), nullable=False, server_default='false'),

        # Security settings
        sa.Column('security_level', sa.String(20), nullable=False, server_default='medium'),
        sa.Column('challenge_ttl', sa.Integer(), nullable=False, server_default='1800'),
        sa.Column('minify_settings', sa.JSON(), nullable=True),

        # Rate limiting
        sa.Column('rate_limiting_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('rate_limit_rules', sa.JSON(), nullable=True),

        # Analytics and monitoring
        sa.Column('analytics_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('logging_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('real_ip_header', sa.String(50), nullable=True),

        # Timestamps
        sa.Column('created_at_cloudflare', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_on_cloudflare', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_synced', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Index('ix_cloudflare_zones_provider_id', 'provider_id'),
        sa.Index('ix_cloudflare_zones_tenant_id', 'tenant_id'),
        sa.Index('ix_cloudflare_zones_zone_id', 'zone_id'),
        sa.Index('ix_cloudflare_zones_name', 'name'),
        sa.Index('ix_cloudflare_zones_status', 'status'),
        sa.UniqueConstraint('provider_id', 'zone_id', name='uq_cloudflare_zones_provider_zone'),
        sa.UniqueConstraint('tenant_id', 'name', name='uq_cloudflare_zones_tenant_name')
    )

    # Create cloudflare_dns_records table
    op.create_table(
        'cloudflare_dns_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cloudflare_providers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('zone_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cloudflare_zones.id', ondelete='CASCADE'), nullable=False),
        sa.Column('record_id', sa.String(50), nullable=False, index=True),  # Cloudflare record ID
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('type', sa.String(10), nullable=False, index=True),  # A, AAAA, CNAME, TXT, etc.
        sa.Column('content', sa.String(1000), nullable=False),
        sa.Column('ttl', sa.Integer(), nullable=False, server_default='1'),  # 1 = automatic
        sa.Column('priority', sa.Integer(), nullable=True),  # For MX/SRV records
        sa.Column('proxied', sa.Boolean(), nullable=False, server_default='false'),

        # Record-specific fields
        sa.Column('service', sa.String(100), nullable=True),  # For SRV records
        sa.Column('proto', sa.String(10), nullable=True),    # For SRV records
        sa.Column('srv_name', sa.String(255), nullable=True),  # For SRV records
        sa.Column('weight', sa.Integer(), nullable=True),    # For SRV records
        sa.Column('port', sa.Integer(), nullable=True),      # For SRV records
        sa.Column('target', sa.String(255), nullable=True),  # For SRV records

        # Health and status
        sa.Column('health', sa.String(20), nullable=True, index=True),
        sa.Column('dnssec_status', sa.String(20), nullable=True),
        sa.Column('proxiable', sa.Boolean(), nullable=True),
        sa.Column('locked', sa.Boolean(), nullable=False, server_default='false'),

        # Metadata
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True, default=list),

        # Monitoring
        sa.Column('monitoring_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('monitoring_interval', sa.Integer(), nullable=True, server_default='300'),
        sa.Column('last_health_check', sa.DateTime(timezone=True), nullable=True),
        sa.Column('health_status_history', sa.JSON(), nullable=True),

        # Timestamps
        sa.Column('created_at_cloudflare', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_on_cloudflare', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_synced', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Index('ix_cloudflare_dns_records_provider_id', 'provider_id'),
        sa.Index('ix_cloudflare_dns_records_tenant_id', 'tenant_id'),
        sa.Index('ix_cloudflare_dns_records_zone_id', 'zone_id'),
        sa.Index('ix_cloudflare_dns_records_record_id', 'record_id'),
        sa.Index('ix_cloudflare_dns_records_name', 'name'),
        sa.Index('ix_cloudflare_dns_records_type', 'type'),
        sa.UniqueConstraint('zone_id', 'record_id', name='uq_cloudflare_dns_records_zone_record'),
        sa.UniqueConstraint('zone_id', 'name', 'type', 'content', name='uq_cloudflare_dns_records_unique')
    )

    # Create cloudflare_workers table
    op.create_table(
        'cloudflare_workers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cloudflare_providers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('worker_name', sa.String(100), nullable=False, index=True),
        sa.Column('script_content', sa.Text(), nullable=False),
        sa.Column('compatibility_date', sa.String(20), nullable=False, server_default='2024-01-01'),
        sa.Column('compatibility_flags', sa.JSON(), nullable=True, default=list),
        sa.Column('bindings', sa.JSON(), nullable=True, default=dict),  # KV, D1, R2 bindings

        # Environment variables
        sa.Column('environment_variables', sa.JSON(), nullable=True, default=dict),
        sa.Column('secrets', sa.JSON(), nullable=True, default=dict),  # Encrypted secrets

        # Routes and triggers
        sa.Column('routes', sa.JSON(), nullable=True, default=list),
        sa.Column('triggers', sa.JSON(), nullable=True, default=list),
        sa.Column('cron_triggers', sa.JSON(), nullable=True, default=list),

        # Limits and usage
        sa.Column('cpu_limit_ms', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('memory_limit_mb', sa.Integer(), nullable=False, server_default='128'),
        sa.Column('invoke_limit', sa.Integer(), nullable=True),  # Daily invoke limit

        # Deployment and versioning
        sa.Column('version', sa.String(20), nullable=False, server_default='1.0.0'),
        sa.Column('deployment_status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('main_module', sa.String(100), nullable=True),
        sa.Column('assets', sa.JSON(), nullable=True, default=dict),

        # Analytics and monitoring
        sa.Column('analytics_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('real_time_logs', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('tail_enabled', sa.Boolean(), nullable=False, server_default='false'),

        # Production and preview environments
        sa.Column('environment', sa.String(20), nullable=False, server_default='production'),
        sa.Column('preview_url', sa.String(500), nullable=True),
        sa.Column('production_url', sa.String(500), nullable=True),

        # Metadata
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True, default=list),
        sa.Column('custom_domains', sa.JSON(), nullable=True, default=list),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_deployed', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Index('ix_cloudflare_workers_provider_id', 'provider_id'),
        sa.Index('ix_cloudflare_workers_tenant_id', 'tenant_id'),
        sa.Index('ix_cloudflare_workers_worker_name', 'worker_name'),
        sa.Index('ix_cloudflare_workers_environment', 'environment'),
        sa.Index('ix_cloudflare_workers_deployment_status', 'deployment_status'),
        sa.UniqueConstraint('provider_id', 'worker_name', 'environment', name='uq_cloudflare_workers_name_env')
    )

    # Create cloudflare_r2_buckets table
    op.create_table(
        'cloudflare_r2_buckets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cloudflare_providers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('bucket_name', sa.String(63), nullable=False, index=True),  # S3 bucket naming rules
        sa.Column('bucket_region', sa.String(50), nullable=False, server_default='auto'),

        # Bucket configuration
        sa.Column('public_access', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('versioning_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('mfa_delete_enabled', sa.Boolean(), nullable=False, server_default='false'),

        # CORS configuration
        sa.Column('cors_rules', sa.JSON(), nullable=True, default=list),

        # Lifecycle rules
        sa.Column('lifecycle_rules', sa.JSON(), nullable=True, default=list),

        # Access control
        sa.Column('access_policy', sa.Text(), nullable=True),  # IAM policy JSON
        sa.Column('bucket_policy', sa.Text(), nullable=True),  # Bucket policy

        # Storage metrics
        sa.Column('object_count', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('size_bytes', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('upload_count', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('download_count', sa.BigInteger(), nullable=False, server_default='0'),

        # Bandwidth and requests
        sa.Column('bandwidth_in_bytes', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('bandwidth_out_bytes', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('request_count', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('error_count', sa.BigInteger(), nullable=False, server_default='0'),

        # Usage metrics (monthly)
        sa.Column('monthly_storage_cost', sa.Numeric(10, 4), nullable=False, server_default='0.0000'),
        sa.Column('monthly_operations_cost', sa.Numeric(10, 4), nullable=False, server_default='0.0000'),
        sa.Column('monthly_egress_cost', sa.Numeric(10, 4), nullable=False, server_default='0.0000'),
        sa.Column('monthly_class_a_operations', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('monthly_class_b_operations', sa.BigInteger(), nullable=False, server_default='0'),

        # Monitoring
        sa.Column('last_metrics_update', sa.DateTime(timezone=True), nullable=True),
        sa.Column('metrics_updated_at', sa.DateTime(timezone=True), nullable=True),

        # Metadata
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True, default=list),
        sa.Column('custom_domain', sa.String(255), nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Index('ix_cloudflare_r2_buckets_provider_id', 'provider_id'),
        sa.Index('ix_cloudflare_r2_buckets_tenant_id', 'tenant_id'),
        sa.Index('ix_cloudflare_r2_buckets_bucket_name', 'bucket_name'),
        sa.UniqueConstraint('provider_id', 'bucket_name', name='uq_cloudflare_r2_buckets_provider_name')
    )

    # Create cloudflare_tunnels table
    op.create_table(
        'cloudflare_tunnels',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cloudflare_providers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tunnel_id', sa.String(50), nullable=False, index=True),  # Cloudflare tunnel UUID
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('secret', sa.String(255), nullable=False),  # Encrypted tunnel secret
        sa.Column('status', sa.String(20), nullable=False, index=True, server_default='inactive'),

        # Tunnel configuration
        sa.Column('config_content', sa.Text(), nullable=True),  # YAML configuration
        sa.Column('ingress_rules', sa.JSON(), nullable=True, default=list),
        sa.Column('origin_config', sa.JSON(), nullable=True, default=dict),

        # Network settings
        sa.Column('lb_pool', sa.String(100), nullable=True),
        sa.Column('origin_server_name', sa.String(255), nullable=True),
        sa.Column('origin_port', sa.Integer(), nullable=True),

        # Connection settings
        sa.Column('protocol', sa.String(10), nullable=False, server_default='https'),
        sa.Column('proxy_address', sa.String(50), nullable=True),
        sa.Column('proxy_port', sa.Integer(), nullable=False, server_default='7864'),
        sa.Column('ha_connections', sa.Integer(), nullable=False, server_default='4'),
        sa.Column('heartbeat_interval', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('heartbeat_timeout', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('ha_margin', sa.Integer(), nullable=False, server_default='50'),

        # Client configuration
        sa.Column('client_id', sa.String(100), nullable=True),
        sa.Column('client_secret', sa.String(255), nullable=True),  # Encrypted
        sa.Column('tunnel_token', sa.String(500), nullable=True),  # Quick tunnel token

        # DNS and certificates
        sa.Column('dns_records', sa.JSON(), nullable=True, default=list),
        sa.Column('ssl_config', sa.JSON(), nullable=True, default=dict),

        # Log settings
        sa.Column('log_level', sa.String(10), nullable=False, server_default='info'),
        sa.Column('log_file_path', sa.String(500), nullable=True),
        sa.Column('transport_protocol', sa.String(10), nullable=False, server_default='quic'),
        sa.Column('edge_http_version', sa.String(10), nullable=False, server_default='1'),

        # Metrics
        sa.Column('bytes_sent', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('bytes_received', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('conn_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_connection_time', sa.DateTime(timezone=True), nullable=True),

        # Monitoring
        sa.Column('monitoring_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('health_check_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('health_check_url', sa.String(500), nullable=True),
        sa.Column('health_check_interval', sa.Integer(), nullable=False, server_default='30'),

        # Metadata
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True, default=list),
        sa.Column('quick_tunnel', sa.Boolean(), nullable=False, server_default='false'),

        # Timestamps
        sa.Column('created_at_cloudflare', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at_cloudflare', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_connection_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Index('ix_cloudflare_tunnels_provider_id', 'provider_id'),
        sa.Index('ix_cloudflare_tunnels_tenant_id', 'tenant_id'),
        sa.Index('ix_cloudflare_tunnels_tunnel_id', 'tunnel_id'),
        sa.Index('ix_cloudflare_tunnels_name', 'name'),
        sa.Index('ix_cloudflare_tunnels_status', 'status'),
        sa.UniqueConstraint('provider_id', 'tunnel_id', name='uq_cloudflare_tunnels_provider_tunnel'),
        sa.UniqueConstraint('provider_id', 'name', name='uq_cloudflare_tunnels_provider_name')
    )


def downgrade() -> None:
    # Drop tables in reverse order due to foreign key constraints
    op.drop_table('cloudflare_tunnels')
    op.drop_table('cloudflare_r2_buckets')
    op.drop_table('cloudflare_workers')
    op.drop_table('cloudflare_dns_records')
    op.drop_table('cloudflare_zones')
    op.drop_table('cloudflare_providers')