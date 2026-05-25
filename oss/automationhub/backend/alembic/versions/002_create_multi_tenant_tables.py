"""Create multi-tenant architecture tables

Revision ID: 002_create_multi_tenant_tables
Revises: 001_create_initial_tables
Create Date: 2024-11-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_create_multi_tenant_tables'
down_revision = '001_create_initial_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create multi-tenant tables with proper isolation"""

    # Create tenants table
    op.create_table(
        'tenants',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('slug', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('display_name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('website', sa.String(length=500), nullable=True),
        sa.Column('address_line1', sa.String(length=255), nullable=True),
        sa.Column('address_line2', sa.String(length=255), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('postal_code', sa.String(length=20), nullable=True),
        sa.Column('industry', sa.String(length=100), nullable=True),
        sa.Column('company_size', sa.String(length=50), nullable=True),
        sa.Column('revenue_tier', sa.String(length=50), nullable=True),
        sa.Column('domain', sa.String(length=255), nullable=True),
        sa.Column('subdomain', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('tier', sa.String(length=50), nullable=False),
        sa.Column('plan', sa.String(length=50), nullable=False),
        sa.Column('max_users', sa.Integer(), nullable=False),
        sa.Column('max_storage_gb', sa.Integer(), nullable=False),
        sa.Column('max_api_calls_per_month', sa.Integer(), nullable=False),
        sa.Column('max_workflows', sa.Integer(), nullable=False),
        sa.Column('max_agents', sa.Integer(), nullable=False),
        sa.Column('current_users', sa.Integer(), nullable=False),
        sa.Column('current_storage_gb', sa.Integer(), nullable=False),
        sa.Column('current_api_calls_month', sa.Integer(), nullable=False),
        sa.Column('current_workflows', sa.Integer(), nullable=False),
        sa.Column('current_agents', sa.Integer(), nullable=False),
        sa.Column('billing_email', sa.String(length=255), nullable=True),
        sa.Column('billing_address', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('billing_cycle', sa.String(length=20), nullable=False),
        sa.Column('settings', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('preferences', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('integrations', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('two_factor_required', sa.Boolean(), nullable=False),
        sa.Column('session_timeout_minutes', sa.Integer(), nullable=False),
        sa.Column('password_policy', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('allowed_ips', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('features', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('beta_features', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('trial_ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('subscription_starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('subscription_ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('last_activity_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
        sa.UniqueConstraint('subdomain'),
        sa.UniqueConstraint('domain'),
        sa.UniqueConstraint('email'),
        sa.CheckConstraint('slug ~ \'^[a-z0-9]+(-[a-z0-9]+)*$\'', name='ck_tenant_slug_format'),
        sa.CheckConstraint('subdomain ~ \'^[a-z0-9]+(-[a-z0-9]+)*$\'', name='ck_tenant_subdomain_format'),
        sa.CheckConstraint('status IN (\'active\', \'suspended\', \'trial\', \'cancelled\', \'pending\')', name='ck_tenant_status'),
        sa.CheckConstraint('tier IN (\'basic\', \'professional\', \'enterprise\', \'custom\')', name='ck_tenant_tier'),
        sa.CheckConstraint('plan IN (\'free\', \'starter\', \'professional\', \'enterprise\')', name='ck_tenant_plan'),
        sa.CheckConstraint('company_size IN (\'startup\', \'small\', \'medium\', \'large\', \'enterprise\')', name='ck_tenant_company_size'),
        comment='Multi-tenant organization registry'
    )
    op.create_index(op.f('ix_tenants_id'), 'tenants', ['id'], unique=False)
    op.create_index(op.f('ix_tenants_slug'), 'tenants', ['slug'], unique=False)
    op.create_index(op.f('ix_tenants_email'), 'tenants', ['email'], unique=False)
    op.create_index(op.f('ix_tenants_subdomain'), 'tenants', ['subdomain'], unique=False)
    op.create_index(op.f('ix_tenants_status'), 'tenants', ['status'], unique=False)
    op.create_index(op.f('ix_tenants_tier'), 'tenants', ['tier'], unique=False)
    op.create_index(op.f('ix_tenants_plan'), 'tenants', ['plan'], unique=False)
    op.create_index(op.f('ix_tenants_created_at'), 'tenants', ['created_at'], unique=False)

    # Create tenant_configurations table
    op.create_table(
        'tenant_configurations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('key', sa.String(length=255), nullable=False),
        sa.Column('value', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_encrypted', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'category', 'key', name='uq_tenant_config'),
        comment='Advanced tenant configurations'
    )
    op.create_index(op.f('ix_tenant_configurations_tenant_id'), 'tenant_configurations', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_tenant_configurations_category'), 'tenant_configurations', ['category'], unique=False)

    # Create tenant_usage_logs table
    op.create_table(
        'tenant_usage_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('users_count', sa.Integer(), nullable=False),
        sa.Column('storage_gb', sa.Integer(), nullable=False),
        sa.Column('api_calls', sa.Integer(), nullable=False),
        sa.Column('workflows_count', sa.Integer(), nullable=False),
        sa.Column('agents_count', sa.Integer(), nullable=False),
        sa.Column('avg_response_time_ms', sa.Integer(), nullable=True),
        sa.Column('error_rate_percentage', sa.Integer(), nullable=True),
        sa.Column('uptime_percentage', sa.Integer(), nullable=True),
        sa.Column('estimated_cost_usd', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'date', name='uq_tenant_usage_date'),
        comment='Daily tenant usage tracking'
    )
    op.create_index(op.f('ix_tenant_usage_logs_tenant_id'), 'tenant_usage_logs', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_tenant_usage_logs_date'), 'tenant_usage_logs', ['date'], unique=False)

    # Add tenant_id to existing tables for multi-tenancy
    # Note: This assumes existing tables exist from migration 001

    # Add tenant_id to users table
    try:
        op.add_column('users', sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            'fk_users_tenant_id', 'users', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE'
        )
        op.create_index(op.f('ix_users_tenant_id'), 'users', ['tenant_id'], unique=False)
    except Exception as e:
        print(f"Note: Could not add tenant_id to users table: {e}")

    # Add tenant_id to workflows table
    try:
        op.add_column('workflows', sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            'fk_workflows_tenant_id', 'workflows', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE'
        )
        op.create_index(op.f('ix_workflows_tenant_id'), 'workflows', ['tenant_id'], unique=False)
    except Exception as e:
        print(f"Note: Could not add tenant_id to workflows table: {e}")

    # Add tenant_id to agents table
    try:
        op.add_column('agents', sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            'fk_agents_tenant_id', 'agents', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE'
        )
        op.create_index(op.f('ix_agents_tenant_id'), 'agents', ['tenant_id'], unique=False)
    except Exception as e:
        print(f"Note: Could not add tenant_id to agents table: {e}")

    # Add tenant_id to api_keys table
    try:
        op.add_column('api_keys', sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            'fk_api_keys_tenant_id', 'api_keys', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE'
        )
        op.create_index(op.f('ix_api_keys_tenant_id'), 'api_keys', ['tenant_id'], unique=False)
    except Exception as e:
        print(f"Note: Could not add tenant_id to api_keys table: {e}")

    # Add tenant_id to webhooks table
    try:
        op.add_column('webhooks', sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            'fk_webhooks_tenant_id', 'webhooks', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE'
        )
        op.create_index(op.f('ix_webhooks_tenant_id'), 'webhooks', ['tenant_id'], unique=False)
    except Exception as e:
        print(f"Note: Could not add tenant_id to webhooks table: {e}")

    # Add tenant_id to audit_logs table
    try:
        op.add_column('audit_logs', sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            'fk_audit_logs_tenant_id', 'audit_logs', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE'
        )
        op.create_index(op.f('ix_audit_logs_tenant_id'), 'audit_logs', ['tenant_id'], unique=False)
    except Exception as e:
        print(f"Note: Could not add tenant_id to audit_logs table: {e}")

    # Create Row Level Security (RLS) policies
    # Enable RLS on key tables
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE workflows ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE agents ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY")

    # Create RLS policies for tenant isolation
    # Users can only access their own tenant's data
    op.execute("""
        CREATE POLICY tenant_isolation_users ON users
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_workflows ON workflows
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_agents ON agents
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_api_keys ON api_keys
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_webhooks ON webhooks
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_audit_logs ON audit_logs
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    # Create function to set tenant context
    op.execute("""
        CREATE OR REPLACE FUNCTION set_tenant_context()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                NEW.tenant_id = COALESCE(
                    NEW.tenant_id,
                    current_setting('app.current_tenant_id', true)::UUID
                );
                RETURN NEW;
            ELSIF TG_OP = 'UPDATE' THEN
                -- Prevent tenant_id from being changed
                NEW.tenant_id = OLD.tenant_id;
                RETURN NEW;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)

    # Create triggers to enforce tenant context
    op.execute("""
        CREATE TRIGGER enforce_tenant_context_users
        BEFORE INSERT OR UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_workflows
        BEFORE INSERT OR UPDATE ON workflows
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_agents
        BEFORE INSERT OR UPDATE ON agents
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_api_keys
        BEFORE INSERT OR UPDATE ON api_keys
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_webhooks
        BEFORE INSERT OR UPDATE ON webhooks
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_audit_logs
        BEFORE INSERT OR UPDATE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)


def downgrade() -> None:
    """Remove multi-tenant tables and isolation"""

    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_users ON users")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_workflows ON workflows")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_agents ON agents")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_api_keys ON api_keys")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_webhooks ON webhooks")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_audit_logs ON audit_logs")

    # Drop function
    op.execute("DROP FUNCTION IF EXISTS set_tenant_context()")

    # Drop RLS policies
    op.execute("DROP POLICY IF EXISTS tenant_isolation_users ON users")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_workflows ON workflows")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_agents ON agents")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_api_keys ON api_keys")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_webhooks ON webhooks")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs")

    # Disable RLS
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE workflows DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE agents DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE api_keys DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE webhooks DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY")

    # Drop indexes and foreign keys for tenant_id columns
    try:
        op.drop_index(op.f('ix_users_tenant_id'), table_name='users')
        op.drop_constraint('fk_users_tenant_id', table_name='users', type_='foreignkey')
        op.drop_column('users', 'tenant_id')
    except Exception:
        pass

    try:
        op.drop_index(op.f('ix_workflows_tenant_id'), table_name='workflows')
        op.drop_constraint('fk_workflows_tenant_id', table_name='workflows', type_='foreignkey')
        op.drop_column('workflows', 'tenant_id')
    except Exception:
        pass

    try:
        op.drop_index(op.f('ix_agents_tenant_id'), table_name='agents')
        op.drop_constraint('fk_agents_tenant_id', table_name='agents', type_='foreignkey')
        op.drop_column('agents', 'tenant_id')
    except Exception:
        pass

    try:
        op.drop_index(op.f('ix_api_keys_tenant_id'), table_name='api_keys')
        op.drop_constraint('fk_api_keys_tenant_id', table_name='api_keys', type_='foreignkey')
        op.drop_column('api_keys', 'tenant_id')
    except Exception:
        pass

    try:
        op.drop_index(op.f('ix_webhooks_tenant_id'), table_name='webhooks')
        op.drop_constraint('fk_webhooks_tenant_id', table_name='webhooks', type_='foreignkey')
        op.drop_column('webhooks', 'tenant_id')
    except Exception:
        pass

    try:
        op.drop_index(op.f('ix_audit_logs_tenant_id'), table_name='audit_logs')
        op.drop_constraint('fk_audit_logs_tenant_id', table_name='audit_logs', type_='foreignkey')
        op.drop_column('audit_logs', 'tenant_id')
    except Exception:
        pass

    # Drop tables
    op.drop_index(op.f('ix_tenant_usage_logs_date'), table_name='tenant_usage_logs')
    op.drop_index(op.f('ix_tenant_usage_logs_tenant_id'), table_name='tenant_usage_logs')
    op.drop_table('tenant_usage_logs')

    op.drop_index(op.f('ix_tenant_configurations_category'), table_name='tenant_configurations')
    op.drop_index(op.f('ix_tenant_configurations_tenant_id'), table_name='tenant_configurations')
    op.drop_table('tenant_configurations')

    op.drop_index(op.f('ix_tenants_created_at'), table_name='tenants')
    op.drop_index(op.f('ix_tenants_plan'), table_name='tenants')
    op.drop_index(op.f('ix_tenants_tier'), table_name='tenants')
    op.drop_index(op.f('ix_tenants_status'), table_name='tenants')
    op.drop_index(op.f('ix_tenants_subdomain'), table_name='tenants')
    op.drop_index(op.f('ix_tenants_email'), table_name='tenants')
    op.drop_index(op.f('ix_tenants_slug'), table_name='tenants')
    op.drop_index(op.f('ix_tenants_id'), table_name='tenants')
    op.drop_table('tenants')