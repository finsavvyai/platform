"""Add API Gateway tables

Revision ID: 002_add_api_gateway_tables
Revises: 001_enhance_user_authentication
Create Date: 2025-01-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_add_api_gateway_tables'
down_revision = '001_enhance_user_authentication'
branch_labels = None
depends_on = None


def upgrade():
    """Create API Gateway tables"""

    # Create api_keys table
    op.create_table(
        'api_keys',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('key_id', sa.String(length=100), nullable=False),
        sa.Column('key_hash', sa.String(length=255), nullable=False),
        sa.Column('key_prefix', sa.String(length=20), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('scope', sa.String(length=50), nullable=False),
        sa.Column('permissions', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('allowed_endpoints', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('denied_endpoints', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('rate_limit_per_minute', sa.Integer(), nullable=True),
        sa.Column('rate_limit_per_hour', sa.Integer(), nullable=True),
        sa.Column('rate_limit_per_day', sa.Integer(), nullable=True),
        sa.Column('quota_bytes_per_month', sa.BigInteger(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_used_ip', sa.String(length=45), nullable=True),
        sa.Column('usage_count', sa.BigInteger(), nullable=True),
        sa.Column('allowed_ip_addresses', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('allowed_origins', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('require_mfa', sa.Boolean(), nullable=True),
        sa.Column('enforce_rate_limits', sa.Boolean(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('revoke_reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['revoked_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_api_keys_created_at'), 'api_keys', ['created_at'], unique=False)
    op.create_index(op.f('ix_api_keys_key_hash'), 'api_keys', ['key_hash'], unique=True)
    op.create_index(op.f('ix_api_keys_key_id'), 'api_keys', ['key_id'], unique=True)
    op.create_index(op.f('ix_api_keys_key_prefix_hash'), 'api_keys', ['key_prefix', 'key_hash'], unique=False)
    op.create_index('ix_api_keys_last_used', 'api_keys', ['last_used_at'], unique=False)
    op.create_index('ix_api_keys_org_status', 'api_keys', ['organization_id', 'status'], unique=False)
    op.create_index('ix_api_keys_scope_status', 'api_keys', ['scope', 'status'], unique=False)
    op.create_index('ix_api_keys_user_status', 'api_keys', ['user_id', 'status'], unique=False)
    op.create_index(op.f('ix_api_keys_user_id'), 'api_keys', ['user_id'], unique=False)

    # Create api_usage_logs table
    op.create_table(
        'api_usage_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('request_id', sa.String(length=100), nullable=False),
        sa.Column('api_key_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('method', sa.String(length=10), nullable=False),
        sa.Column('endpoint', sa.String(length=500), nullable=False),
        sa.Column('path', sa.String(length=1000), nullable=False),
        sa.Column('query_params', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('origin', sa.String(length=500), nullable=True),
        sa.Column('status_code', sa.Integer(), nullable=False),
        sa.Column('response_size_bytes', sa.BigInteger(), nullable=True),
        sa.Column('response_time_ms', sa.Float(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('rate_limited', sa.Boolean(), nullable=True),
        sa.Column('rate_limit_type', sa.String(length=50), nullable=True),
        sa.Column('rate_limit_remaining', sa.Integer(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('request_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('response_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('performance_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_usage_api_key_timestamp', 'api_usage_logs', ['api_key_id', 'timestamp'], unique=False)
    op.create_index('idx_usage_endpoint_timestamp', 'api_usage_logs', ['endpoint', 'timestamp'], unique=False)
    op.create_index('idx_usage_ip_timestamp', 'api_usage_logs', ['ip_address', 'timestamp'], unique=False)
    op.create_index('idx_usage_method_timestamp', 'api_usage_logs', ['method', 'timestamp'], unique=False)
    op.create_index('idx_usage_org_timestamp', 'api_usage_logs', ['organization_id', 'timestamp'], unique=False)
    op.create_index('idx_usage_rate_limited', 'api_usage_logs', ['rate_limited', 'timestamp'], unique=False)
    op.create_index('idx_usage_status_timestamp', 'api_usage_logs', ['status_code', 'timestamp'], unique=False)
    op.create_index('idx_usage_user_timestamp', 'api_usage_logs', ['user_id', 'timestamp'], unique=False)
    op.create_index(op.f('ix_api_usage_logs_request_id'), 'api_usage_logs', ['request_id'], unique=True)
    op.create_index(op.f('ix_api_usage_logs_timestamp'), 'api_usage_logs', ['timestamp'], unique=False)

    # Create gateway_configurations table
    op.create_table(
        'gateway_configurations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('version', sa.String(length=20), nullable=False),
        sa.Column('environment', sa.String(length=50), nullable=False),
        sa.Column('config_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('policies', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('rate_limit_policies', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('security_policies', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('transformation_rules', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('applied_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_gateway_config_default', 'gateway_configurations', ['is_default', 'environment'], unique=False)
    op.create_index('idx_gateway_config_env_active', 'gateway_configurations', ['environment', 'is_active'], unique=False)
    op.create_index('idx_gateway_config_priority', 'gateway_configurations', ['priority', 'is_active'], unique=False)
    op.create_index(op.f('ix_gateway_configurations_name'), 'gateway_configurations', ['name'], unique=True)

    # Create websocket_connections table
    op.create_table(
        'websocket_connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('connection_id', sa.String(length=100), nullable=False),
        sa.Column('api_key_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('endpoint', sa.String(length=500), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('origin', sa.String(length=500), nullable=True),
        sa.Column('connected_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('disconnected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_activity_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('message_count', sa.BigInteger(), nullable=True),
        sa.Column('bytes_sent', sa.BigInteger(), nullable=True),
        sa.Column('bytes_received', sa.BigInteger(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('disconnect_reason', sa.String(length=200), nullable=True),
        sa.Column('disconnect_code', sa.Integer(), nullable=True),
        sa.Column('rate_limited', sa.Boolean(), nullable=False),
        sa.Column('security_violations', sa.Integer(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True),
        sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_ws_api_key_active', 'websocket_connections', ['api_key_id', 'is_active'], unique=False)
    op.create_index('idx_ws_connected_at', 'websocket_connections', ['connected_at'], unique=False)
    op.create_index('idx_ws_endpoint_active', 'websocket_connections', ['endpoint', 'is_active'], unique=False)
    op.create_index('idx_ws_last_activity', 'websocket_connections', ['last_activity_at', 'is_active'], unique=False)
    op.create_index('idx_ws_user_active', 'websocket_connections', ['user_id', 'is_active'], unique=False)
    op.create_index(op.f('ix_websocket_connections_connection_id'), 'websocket_connections', ['connection_id'], unique=True)

def downgrade():
    """Drop API Gateway tables"""

    # Drop websocket_connections table
    op.drop_index(op.f('ix_websocket_connections_connection_id'), table_name='websocket_connections')
    op.drop_index('idx_ws_user_active', table_name='websocket_connections')
    op.drop_index('idx_ws_last_activity', table_name='websocket_connections')
    op.drop_index('idx_ws_endpoint_active', table_name='websocket_connections')
    op.drop_index('idx_ws_connected_at', table_name='websocket_connections')
    op.drop_index('idx_ws_api_key_active', table_name='websocket_connections')
    op.drop_table('websocket_connections')

    # Drop gateway_configurations table
    op.drop_index(op.f('ix_gateway_configurations_name'), table_name='gateway_configurations')
    op.drop_index('idx_gateway_config_priority', table_name='gateway_configurations')
    op.drop_index('idx_gateway_config_env_active', table_name='gateway_configurations')
    op.drop_index('idx_gateway_config_default', table_name='gateway_configurations')
    op.drop_table('gateway_configurations')

    # Drop api_usage_logs table
    op.drop_index(op.f('ix_api_usage_logs_timestamp'), table_name='api_usage_logs')
    op.drop_index(op.f('ix_api_usage_logs_request_id'), table_name='api_usage_logs')
    op.drop_index('idx_usage_status_timestamp', table_name='api_usage_logs')
    op.drop_index('idx_usage_rate_limited', table_name='api_usage_logs')
    op.drop_index('idx_usage_org_timestamp', table_name='api_usage_logs')
    op.drop_index('idx_usage_method_timestamp', table_name='api_usage_logs')
    op.drop_index('idx_usage_ip_timestamp', table_name='api_usage_logs')
    op.drop_index('idx_usage_endpoint_timestamp', table_name='api_usage_logs')
    op.drop_index('idx_usage_user_timestamp', table_name='api_usage_logs')
    op.drop_index('idx_usage_api_key_timestamp', table_name='api_usage_logs')
    op.drop_table('api_usage_logs')

    # Drop api_keys table
    op.drop_index(op.f('ix_api_keys_user_id'), table_name='api_keys')
    op.drop_index('ix_api_keys_user_status', table_name='api_keys')
    op.drop_index('ix_api_keys_scope_status', table_name='api_keys')
    op.drop_index('ix_api_keys_org_status', table_name='api_keys')
    op.drop_index('ix_api_keys_last_used', table_name='api_keys')
    op.drop_index('ix_api_keys_key_prefix_hash', table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_key_id'), table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_key_hash'), table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_created_at'), table_name='api_keys')
    op.drop_table('api_keys')