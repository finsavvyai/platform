"""Create tenant administration and management tables

Revision ID: 004_create_tenant_admin_tables
Revises: 003_create_branding_tables
Create Date: 2024-11-10 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004_create_tenant_admin_tables'
down_revision = '003_create_branding_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create tenant administration and management tables"""

    # Create tenant_events table for audit logging
    op.create_table(
        'tenant_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('event_data', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('session_id', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('event_type IN (\'created\', \'updated\', \'deleted\', \'suspended\', \'reactivated\', \'plan_changed\', \'billing_updated\', \'user_added\', \'user_removed\', \'security_incident\', \'api_access\')', name='ck_tenant_event_type'),
        sa.CheckConstraint('severity IN (\'info\', \'warning\', \'error\', \'critical\')', name='ck_tenant_event_severity'),
        sa.CheckConstraint('source IN (\'system\', \'admin\', \'api\', \'web\', \'mobile\', \'integration\')', name='ck_tenant_event_source'),
        comment='Audit log for tenant events and activities'
    )
    op.create_index(op.f('ix_tenant_events_tenant_id'), 'tenant_events', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_tenant_events_event_type'), 'tenant_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_tenant_events_created_at'), 'tenant_events', ['created_at'], unique=False)
    op.create_index(op.f('ix_tenant_events_severity'), 'tenant_events', ['severity'], unique=False)

    # Create tenant_metrics table for usage tracking
    op.create_table(
        'tenant_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('metric_date', sa.Date(), nullable=False),
        sa.Column('metric_type', sa.String(length=50), nullable=False),
        sa.Column('value', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('unit', sa.String(length=20), nullable=False),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'metric_date', 'metric_type', name='uq_tenant_metric'),
        sa.CheckConstraint('metric_type IN (\'users\', \'storage\', \'api_requests\', \'workflow_executions\', \'errors\', \'cpu_usage\', \'memory_usage\', \'network_transfer\')', name='ck_tenant_metric_type'),
        sa.CheckConstraint('unit IN (\'count\', \'gb\', \'mb\', \'requests\', \'seconds\', \'percentage\', \'dollars\')', name='ck_tenant_metric_unit'),
        comment='Tenant usage and performance metrics'
    )
    op.create_index(op.f('ix_tenant_metrics_tenant_id'), 'tenant_metrics', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_tenant_metrics_metric_date'), 'tenant_metrics', ['metric_date'], unique=False)
    op.create_index(op.f('ix_tenant_metrics_metric_type'), 'tenant_metrics', ['metric_type'], unique=False)

    # Create billing_invoices table
    op.create_table(
        'billing_invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('invoice_number', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('tax_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('billing_period_start', sa.Date(), nullable=False),
        sa.Column('billing_period_end', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('payment_transaction_id', sa.String(length=100), nullable=True),
        sa.Column('line_items', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invoice_number', name='uq_invoice_number'),
        sa.CheckConstraint('status IN (\'draft\', \'sent\', \'paid\', \'overdue\', \'cancelled\', \'refunded\')', name='ck_invoice_status'),
        sa.CheckConstraint('amount >= 0', name='ck_invoice_amount'),
        sa.CheckConstraint('total_amount >= 0', name='ck_invoice_total'),
        comment='Tenant billing invoices and payments'
    )
    op.create_index(op.f('ix_billing_invoices_tenant_id'), 'billing_invoices', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_billing_invoices_status'), 'billing_invoices', ['status'], unique=False)
    op.create_index(op.f('ix_billing_invoices_due_date'), 'billing_invoices', ['due_date'], unique=False)
    op.create_index(op.f('ix_billing_invoices_created_at'), 'billing_invoices', ['created_at'], unique=False)

    # Create billing_subscriptions table
    op.create_table(
        'billing_subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('subscription_id', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('plan', sa.String(length=50), nullable=False),
        sa.Column('tier', sa.String(length=50), nullable=False),
        sa.Column('billing_cycle', sa.String(length=20), nullable=False),
        sa.Column('monthly_price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('annual_price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('current_period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('current_period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('trial_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('trial_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('canceled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('payment_method_id', sa.String(length=100), nullable=True),
        sa.Column('customer_id', sa.String(length=100), nullable=True),
        sa.Column('promotion_code', sa.String(length=50), nullable=True),
        sa.Column('discount_amount', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('auto_renew', sa.Boolean(), nullable=False),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('subscription_id', name='uq_subscription_id'),
        sa.CheckConstraint('status IN (\'active\', \'trialing\', \'past_due\', \'canceled\', \'unpaid\', \'incomplete\')', name='ck_subscription_status'),
        sa.CheckConstraint('billing_cycle IN (\'monthly\', \'annually\')', name='ck_subscription_billing_cycle'),
        sa.CheckConstraint('monthly_price >= 0', name='ck_subscription_monthly_price'),
        sa.CheckConstraint('annual_price >= 0', name='ck_subscription_annual_price'),
        comment='Tenant billing subscriptions'
    )
    op.create_index(op.f('ix_billing_subscriptions_tenant_id'), 'billing_subscriptions', ['tenant_id'], unique=True)
    op.create_index(op.f('ix_billing_subscriptions_status'), 'billing_subscriptions', ['status'], unique=False)
    op.create_index(op.f('ix_billing_subscriptions_current_period_end'), 'billing_subscriptions', ['current_period_end'], unique=False)

    # Create tenant_invitations table for user invitations
    op.create_table(
        'tenant_invitations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('invitation_token', sa.String(length=500), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('permissions', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('invited_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('declined_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invited_by'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'email', 'expires_at', name='uq_tenant_invitation'),
        sa.CheckConstraint('role IN (\'admin\', \'user\', \'viewer\', \'contributor\')', name='ck_invitation_role'),
        comment='Tenant user invitations'
    )
    op.create_index(op.f('ix_tenant_invitations_tenant_id'), 'tenant_invitations', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_tenant_invitations_email'), 'tenant_invitations', ['email'], unique=False)
    op.create_index(op.f('ix_tenant_invitations_token'), 'tenant_invitations', ['invitation_token'], unique=True)
    op.create_index(op.f('ix_tenant_invitations_expires_at'), 'tenant_invitations', ['expires_at'], unique=False)

    # Create tenant_api_keys table for API access management
    op.create_table(
        'tenant_api_keys',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('key_name', sa.String(length=100), nullable=False),
        sa.Column('api_key', sa.String(length=500), nullable=False),
        sa.Column('api_key_hash', sa.String(length=255), nullable=False),
        sa.Column('key_type', sa.String(length=20), nullable=False),
        sa.Column('permissions', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('allowed_ips', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('rate_limit', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('usage_count', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('api_key_hash', name='uq_api_key_hash'),
        sa.UniqueConstraint('tenant_id', 'key_name', name='uq_tenant_api_key_name'),
        sa.CheckConstraint('key_type IN (\'read_only\', \'read_write\', \'admin\', \'service\')', name='ck_api_key_type'),
        sa.CheckConstraint('rate_limit > 0', name='ck_api_key_rate_limit'),
        sa.CheckConstraint('usage_count >= 0', name='ck_api_key_usage_count'),
        comment='Tenant API keys for programmatic access'
    )
    op.create_index(op.f('ix_tenant_api_keys_tenant_id'), 'tenant_api_keys', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_tenant_api_keys_is_active'), 'tenant_api_keys', ['is_active'], unique=False)
    op.create_index(op.f('ix_tenant_api_keys_last_used_at'), 'tenant_api_keys', ['last_used_at'], unique=False)

    # Create tenant_security_settings table
    op.create_table(
        'tenant_security_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('require_2fa', sa.Boolean(), nullable=False),
        sa.Column('password_policy', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('session_timeout_minutes', sa.Integer(), nullable=False),
        sa.Column('max_login_attempts', sa.Integer(), nullable=False),
        sa.Column('lockout_duration_minutes', sa.Integer(), nullable=False),
        sa.Column('allowed_ip_ranges', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('blocked_ip_ranges', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('api_rate_limiting', sa.Boolean(), nullable=False),
        sa.Column('audit_logging', sa.Boolean(), nullable=False),
        sa.Column('data_encryption', sa.Boolean(), nullable=False),
        sa.Column('backup_retention_days', sa.Integer(), nullable=False),
        sa.Column('compliance_standards', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('security_level', sa.String(length=20), nullable=False),
        sa.Column('custom_security_rules', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', name='uq_tenant_security_settings'),
        sa.CheckConstraint('security_level IN (\'basic\', \'standard\', \'high\', \'enterprise\')', name='ck_security_level'),
        sa.CheckConstraint('session_timeout_minutes > 0', name='ck_session_timeout'),
        sa.CheckConstraint('max_login_attempts > 0', name='ck_max_login_attempts'),
        sa.CheckConstraint('lockout_duration_minutes >= 0', name='ck_lockout_duration'),
        sa.CheckConstraint('backup_retention_days > 0', name='ck_backup_retention'),
        comment='Tenant-specific security settings and policies'
    )
    op.create_index(op.f('ix_tenant_security_settings_tenant_id'), 'tenant_security_settings', ['tenant_id'], unique=True)
    op.create_index(op.f('ix_tenant_security_settings_security_level'), 'tenant_security_settings', ['security_level'], unique=False)

    # Enable RLS on new tables
    op.execute("ALTER TABLE tenant_events ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenant_metrics ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenant_api_keys ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenant_security_settings ENABLE ROW LEVEL SECURITY")

    # Create RLS policies for new tables
    op.execute("""
        CREATE POLICY tenant_isolation_tenant_events ON tenant_events
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_tenant_metrics ON tenant_metrics
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_billing_invoices ON billing_invoices
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_billing_subscriptions ON billing_subscriptions
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_tenant_invitations ON tenant_invitations
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_tenant_api_keys ON tenant_api_keys
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_tenant_security_settings ON tenant_security_settings
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    # Create triggers for new tables
    op.execute("""
        CREATE TRIGGER enforce_tenant_context_tenant_events
        BEFORE INSERT OR UPDATE ON tenant_events
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_tenant_metrics
        BEFORE INSERT OR UPDATE ON tenant_metrics
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_billing_invoices
        BEFORE INSERT OR UPDATE ON billing_invoices
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_billing_subscriptions
        BEFORE INSERT OR UPDATE ON billing_subscriptions
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_tenant_invitations
        BEFORE INSERT OR UPDATE ON tenant_invitations
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_tenant_api_keys
        BEFORE INSERT OR UPDATE ON tenant_api_keys
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_tenant_security_settings
        BEFORE INSERT OR UPDATE ON tenant_security_settings
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    # Create indexes for performance optimization
    op.execute("CREATE INDEX idx_tenant_events_composite ON tenant_events (tenant_id, event_type, created_at DESC)")
    op.execute("CREATE INDEX idx_tenant_metrics_composite ON tenant_metrics (tenant_id, metric_date DESC, metric_type)")
    op.execute("CREATE INDEX idx_billing_invoices_composite ON billing_invoices (tenant_id, status, due_date)")
    op.execute("CREATE INDEX idx_tenant_api_keys_composite ON tenant_api_keys (tenant_id, is_active, last_used_at DESC)")

    # Add default security settings for existing tenants
    op.execute("""
        INSERT INTO tenant_security_settings (tenant_id, require_2fa, password_policy, session_timeout_minutes,
                                               max_login_attempts, lockout_duration_minutes, api_rate_limiting,
                                               audit_logging, data_encryption, backup_retention_days,
                                               security_level)
        SELECT id, false, '{"min_length": 8, "require_uppercase": true, "require_lowercase": true, "require_numbers": true, "require_symbols": false}',
               480, 5, 15, true, true, true, 90, 'standard'
        FROM tenants WHERE status != 'deleted';
    """)


def downgrade() -> None:
    """Remove tenant administration and management tables"""

    # Drop indexes
    op.execute("DROP INDEX IF EXISTS idx_tenant_api_keys_composite")
    op.execute("DROP INDEX IF EXISTS idx_billing_invoices_composite")
    op.execute("DROP INDEX IF EXISTS idx_tenant_metrics_composite")
    op.execute("DROP INDEX IF EXISTS idx_tenant_events_composite")

    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_tenant_security_settings ON tenant_security_settings")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_tenant_api_keys ON tenant_api_keys")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_tenant_invitations ON tenant_invitations")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_billing_subscriptions ON billing_subscriptions")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_billing_invoices ON billing_invoices")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_tenant_metrics ON tenant_metrics")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_tenant_events ON tenant_events")

    # Drop RLS policies
    op.execute("DROP POLICY IF EXISTS tenant_isolation_tenant_security_settings ON tenant_security_settings")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_tenant_api_keys ON tenant_api_keys")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_tenant_invitations ON tenant_invitations")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_billing_subscriptions ON billing_subscriptions")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_billing_invoices ON billing_invoices")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_tenant_metrics ON tenant_metrics")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_tenant_events ON tenant_events")

    # Disable RLS
    op.execute("ALTER TABLE tenant_security_settings DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenant_api_keys DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenant_invitations DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE billing_subscriptions DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE billing_invoices DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenant_metrics DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenant_events DISABLE ROW LEVEL SECURITY")

    # Drop indexes and tables
    op.drop_index(op.f('ix_tenant_security_settings_security_level'), table_name='tenant_security_settings')
    op.drop_index(op.f('ix_tenant_security_settings_tenant_id'), table_name='tenant_security_settings')
    op.drop_table('tenant_security_settings')

    op.drop_index(op.f('ix_tenant_api_keys_last_used_at'), table_name='tenant_api_keys')
    op.drop_index(op.f('ix_tenant_api_keys_is_active'), table_name='tenant_api_keys')
    op.drop_index(op.f('ix_tenant_api_keys_tenant_id'), table_name='tenant_api_keys')
    op.drop_table('tenant_api_keys')

    op.drop_index(op.f('ix_tenant_invitations_expires_at'), table_name='tenant_invitations')
    op.drop_index(op.f('ix_tenant_invitations_token'), table_name='tenant_invitations')
    op.drop_index(op.f('ix_tenant_invitations_email'), table_name='tenant_invitations')
    op.drop_index(op.f('ix_tenant_invitations_tenant_id'), table_name='tenant_invitations')
    op.drop_table('tenant_invitations')

    op.drop_index(op.f('ix_billing_subscriptions_current_period_end'), table_name='billing_subscriptions')
    op.drop_index(op.f('ix_billing_subscriptions_status'), table_name='billing_subscriptions')
    op.drop_index(op.f('ix_billing_subscriptions_tenant_id'), table_name='billing_subscriptions')
    op.drop_table('billing_subscriptions')

    op.drop_index(op.f('ix_billing_invoices_created_at'), table_name='billing_invoices')
    op.drop_index(op.f('ix_billing_invoices_due_date'), table_name='billing_invoices')
    op.drop_index(op.f('ix_billing_invoices_status'), table_name='billing_invoices')
    op.drop_index(op.f('ix_billing_invoices_tenant_id'), table_name='billing_invoices')
    op.drop_table('billing_invoices')

    op.drop_index(op.f('ix_tenant_metrics_metric_type'), table_name='tenant_metrics')
    op.drop_index(op.f('ix_tenant_metrics_metric_date'), table_name='tenant_metrics')
    op.drop_index(op.f('ix_tenant_metrics_tenant_id'), table_name='tenant_metrics')
    op.drop_table('tenant_metrics')

    op.drop_index(op.f('ix_tenant_events_severity'), table_name='tenant_events')
    op.drop_index(op.f('ix_tenant_events_created_at'), table_name='tenant_events')
    op.drop_index(op.f('ix_tenant_events_event_type'), table_name='tenant_events')
    op.drop_index(op.f('ix_tenant_events_tenant_id'), table_name='tenant_events')
    op.drop_table('tenant_events')