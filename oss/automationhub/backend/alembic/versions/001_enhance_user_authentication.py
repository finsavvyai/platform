"""Enhanced User Authentication System

Revision ID: 001_enhance_user_authentication
Revises:
Create Date: 2025-01-05 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_enhance_user_authentication'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade to enhanced user authentication system"""

    # Create enhanced users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=sa.text('gen_random_uuid()')),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=True),
        sa.Column('hashed_password', sa.String(length=255), nullable=True),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_superuser', sa.Boolean(), nullable=False, default=False),
        sa.Column('is_verified', sa.Boolean(), nullable=False, default=False),
        sa.Column('is_staff', sa.Boolean(), nullable=False, default=False),
        sa.Column('auth_methods', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('[]')),
        sa.Column('oauth_providers', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('{}')),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('role', sa.String(length=50), nullable=True, default='user'),
        sa.Column('permissions', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('[]')),
        sa.Column('subscription_tier', sa.String(length=50), nullable=True, default='free'),
        sa.Column('usage_limits', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('{}')),
        sa.Column('billing_info', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('{}')),
        sa.Column('preferences', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('{}')),
        sa.Column('security_settings', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('{}')),
        sa.Column('avatar_url', sa.String(length=500), nullable=True),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('timezone', sa.String(length=50), nullable=True, default='UTC'),
        sa.Column('language', sa.String(length=10), nullable=True, default='en'),
        sa.Column('phone_number', sa.String(length=50), nullable=True),
        sa.Column('phone_verified', sa.Boolean(), nullable=True, default=False),
        sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('two_factor_enabled', sa.Boolean(), nullable=True, default=False),
        sa.Column('two_factor_secret', sa.String(length=255), nullable=True),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_login_ip', sa.String(length=45), nullable=True),
        sa.Column('last_login_device', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('login_count', sa.Integer(), nullable=True, default=0),
        sa.Column('failed_login_attempts', sa.Integer(), nullable=True, default=0),
        sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_token', sa.String(length=255), nullable=True),
        sa.Column('verification_token_expires', sa.DateTime(timezone=True), nullable=True),
        sa.Column('password_reset_token', sa.String(length=255), nullable=True),
        sa.Column('password_reset_token_expires', sa.DateTime(timezone=True), nullable=True),
        sa.Column('api_keys', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('[]')),
        sa.Column('personal_access_tokens', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('[]')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('app_preferences', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('{}')),
        sa.Column('notification_settings', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('{}')),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('{}')),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('[]')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username')
    )

    # Create indexes for users table
    op.create_index('idx_user_email_active', 'users', ['email', 'is_active'])
    op.create_index('idx_user_org_tier', 'users', ['organization_id', 'subscription_tier'])
    op.create_index('idx_user_last_login', 'users', ['last_login'])
    op.create_index('idx_user_created_at', 'users', ['created_at'])
    op.create_index('idx_user_verification', 'users', ['is_verified', 'verification_token_expires'])
    op.create_index('idx_user_security', 'users', ['locked_until', 'failed_login_attempts'])

    # Create refresh tokens table
    op.create_table(
        'refresh_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token_hash', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), nullable=True, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_used', sa.DateTime(timezone=True), nullable=True),
        sa.Column('device_info', sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash')
    )

    # Create indexes for refresh_tokens
    op.create_index('idx_refresh_token_user', 'refresh_tokens', ['user_id'])
    op.create_index('idx_refresh_token_expires', 'refresh_tokens', ['expires_at'])

    # Create OAuth providers table
    op.create_table(
        'oauth_providers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('display_name', sa.String(length=200), nullable=False),
        sa.Column('client_id', sa.String(length=500), nullable=False),
        sa.Column('client_secret', sa.String(length=500), nullable=False),
        sa.Column('authorization_url', sa.String(length=500), nullable=False),
        sa.Column('token_url', sa.String(length=500), nullable=False),
        sa.Column('userinfo_url', sa.String(length=500), nullable=False),
        sa.Column('jwks_url', sa.String(length=500), nullable=True),
        sa.Column('scopes', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('[]')),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('is_oidc', sa.Boolean(), nullable=True, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('user_mapping', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('{}')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Create OAuth states table
    op.create_table(
        'oauth_states',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=sa.text('gen_random_uuid()')),
        sa.Column('state', sa.String(length=100), nullable=False),
        sa.Column('provider_name', sa.String(length=100), nullable=False),
        sa.Column('redirect_uri', sa.String(length=500), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('state')
    )

    # Create user sessions table
    op.create_table(
        'user_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_token', sa.String(length=255), nullable=False),
        sa.Column('refresh_token_hash', sa.String(length=255), nullable=False),
        sa.Column('device_info', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('location', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_accessed', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('is_suspicious', sa.Boolean(), nullable=True, default=False),
        sa.Column('suspicious_reasons', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('[]')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_token')
    )

    # Create indexes for user_sessions
    op.create_index('idx_session_user', 'user_sessions', ['user_id', 'is_active'])
    op.create_index('idx_session_token', 'user_sessions', ['session_token'])
    op.create_index('idx_session_expires', 'user_sessions', ['expires_at'])

    # Create security events table
    op.create_table(
        'security_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('event_category', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=True, default='info'),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('request_id', sa.String(length=100), nullable=True),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('{}')),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default=sa.text('{}')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('risk_score', sa.Integer(), nullable=True, default=0),
        sa.Column('is_anomalous', sa.Boolean(), nullable=True, default=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for security_events
    op.create_index('idx_security_user', 'security_events', ['user_id', 'created_at'])
    op.create_index('idx_security_type', 'security_events', ['event_type', 'created_at'])
    op.create_index('idx_security_severity', 'security_events', ['severity', 'created_at'])
    op.create_index('idx_security_ip', 'security_events', ['ip_address', 'created_at'])

    # Create MFA backup codes table
    op.create_table(
        'mfa_backup_codes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code_hash', sa.String(length=255), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=True, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for MFA backup codes
    op.create_index('idx_mfa_backup_user', 'mfa_backup_codes', ['user_id'])
    op.create_index('idx_mfa_backup_code', 'mfa_backup_codes', ['code_hash'])
    op.create_index('idx_mfa_backup_used', 'mfa_backup_codes', ['is_used'])

    # Insert default OAuth provider configurations
    op.execute("""
        INSERT INTO oauth_providers (name, display_name, client_id, client_secret, authorization_url, token_url, userinfo_url, jwks_url, scopes, is_oidc, user_mapping)
        VALUES
        (
            'google',
            'Google',
            'placeholder_client_id',
            'placeholder_client_secret',
            'https://accounts.google.com/o/oauth2/v2/auth',
            'https://oauth2.googleapis.com/token',
            'https://www.googleapis.com/oauth2/v2/userinfo',
            'https://www.googleapis.com/oauth2/v3/certs',
            '["openid", "email", "profile"]',
            true,
            '{"email": "email", "name": "full_name", "given_name": "first_name", "family_name": "last_name", "picture": "avatar_url"}'
        ),
        (
            'microsoft',
            'Microsoft',
            'placeholder_client_id',
            'placeholder_client_secret',
            'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            'https://graph.microsoft.com/v1.0/me',
            'https://login.microsoftonline.com/common/discovery/v2.0/keys',
            '["openid", "email", "profile", "User.Read"]',
            true,
            '{"mail": "email", "displayName": "full_name", "givenName": "first_name", "surname": "last_name"}'
        ),
        (
            'github',
            'GitHub',
            'placeholder_client_id',
            'placeholder_client_secret',
            'https://github.com/login/oauth/authorize',
            'https://github.com/login/oauth/access_token',
            'https://api.github.com/user',
            null,
            '["user:email"]',
            false,
            '{"email": "email", "name": "full_name", "login": "username"}'
        )
    """)


def downgrade() -> None:
    """Downgrade from enhanced user authentication system"""

    # Drop tables in reverse order of creation
    op.drop_table('mfa_backup_codes')
    op.drop_table('security_events')
    op.drop_table('user_sessions')
    op.drop_table('oauth_states')
    op.drop_table('oauth_providers')
    op.drop_table('refresh_tokens')
    op.drop_table('users')