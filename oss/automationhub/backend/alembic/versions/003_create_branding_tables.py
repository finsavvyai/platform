"""Create branding and white-labeling tables

Revision ID: 003_create_branding_tables
Revises: 002_create_multi_tenant_tables
Create Date: 2024-11-10 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003_create_branding_tables'
down_revision = '002_create_multi_tenant_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create branding and white-labeling tables"""

    # Create branding_configurations table
    op.create_table(
        'branding_configurations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('theme_name', sa.String(length=100), nullable=False),
        sa.Column('company_name', sa.String(length=255), nullable=False),
        sa.Column('tagline', sa.String(length=500), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('logo_url', sa.String(length=1000), nullable=True),
        sa.Column('logo_dark_url', sa.String(length=1000), nullable=True),
        sa.Column('favicon_url', sa.String(length=1000), nullable=True),
        sa.Column('primary_color', sa.String(length=7), nullable=False),
        sa.Column('secondary_color', sa.String(length=7), nullable=False),
        sa.Column('accent_color', sa.String(length=7), nullable=False),
        sa.Column('background_color', sa.String(length=7), nullable=False),
        sa.Column('surface_color', sa.String(length=7), nullable=False),
        sa.Column('text_color', sa.String(length=7), nullable=False),
        sa.Column('text_secondary_color', sa.String(length=7), nullable=False),
        sa.Column('border_color', sa.String(length=7), nullable=True),
        sa.Column('error_color', sa.String(length=7), nullable=False),
        sa.Column('warning_color', sa.String(length=7), nullable=False),
        sa.Column('success_color', sa.String(length=7), nullable=False),
        sa.Column('info_color', sa.String(length=7), nullable=False),
        sa.Column('font_family_primary', sa.String(length=255), nullable=False),
        sa.Column('font_family_secondary', sa.String(length=255), nullable=False),
        sa.Column('font_family_mono', sa.String(length=255), nullable=False),
        sa.Column('font_size_base', sa.Integer(), nullable=False),
        sa.Column('font_scale', sa.Float(), nullable=False),
        sa.Column('border_radius', sa.Integer(), nullable=False),
        sa.Column('spacing', sa.Integer(), nullable=False),
        sa.Column('sidebar_width', sa.Integer(), nullable=False),
        sa.Column('sidebar_style', sa.String(length=50), nullable=False),
        sa.Column('header_height', sa.Integer(), nullable=False),
        sa.Column('layout_style', sa.String(length=50), nullable=False),
        sa.Column('custom_css', sa.Text(), nullable=True),
        sa.Column('custom_js', sa.Text(), nullable=True),
        sa.Column('custom_domain', sa.String(length=255), nullable=True),
        sa.Column('custom_domain_verified', sa.Boolean(), nullable=False),
        sa.Column('ssl_enabled', sa.Boolean(), nullable=False),
        sa.Column('ssl_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('white_label_mode', sa.Boolean(), nullable=False),
        sa.Column('hide_upm_branding', sa.Boolean(), nullable=False),
        sa.Column('custom_login_page', sa.Boolean(), nullable=False),
        sa.Column('mobile_app_branding', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('email_templates', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('theme_presets', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('brand_colors', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('color_palette', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('typography', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('layout', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id'),
        sa.CheckConstraint('company_name IS NOT NULL AND length(company_name) >= 2', name='ck_branding_company_name'),
        sa.CheckConstraint('theme_name ~ \'^[a-z0-9]+(-[a-z0-9]+)*$\'', name='ck_branding_theme_name'),
        sa.CheckConstraint('primary_color ~ \'^#[0-9A-Fa-f]{6}$\'', name='ck_branding_primary_color'),
        sa.CheckConstraint('secondary_color ~ \'^#[0-9A-Fa-f]{6}$\'', name='ck_branding_secondary_color'),
        sa.CheckConstraint('font_size_base >= 12 AND font_size_base <= 24', name='ck_branding_font_size'),
        sa.CheckConstraint('font_scale >= 0.8 AND font_scale <= 1.5', name='ck_branding_font_scale'),
        sa.CheckConstraint('border_radius >= 0 AND border_radius <= 20', name='ck_branding_border_radius'),
        sa.CheckConstraint('spacing >= 4 AND spacing <= 16', name='ck_branding_spacing'),
        comment='Tenant branding configurations and themes'
    )
    op.create_index(op.f('ix_branding_configurations_tenant_id'), 'branding_configurations', ['tenant_id'], unique=True)
    op.create_index(op.f('ix_branding_configurations_theme_name'), 'branding_configurations', ['theme_name'], unique=False)
    op.create_index(op.f('ix_branding_configurations_is_active'), 'branding_configurations', ['is_active'], unique=False)

    # Create brand_assets table
    op.create_table(
        'brand_assets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('asset_type', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('file_name', sa.String(length=500), nullable=False),
        sa.Column('file_path', sa.String(length=1000), nullable=False),
        sa.Column('file_url', sa.String(length=1000), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('alt_text', sa.String(length=500), nullable=True),
        sa.Column('usage_context', sa.String(length=100), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'asset_type', 'name', name='uq_brand_asset'),
        sa.CheckConstraint('asset_type IN (\'logo\', \'logo_dark\', \'favicon\', \'icon\', \'banner\', \'background\', \'email_header\', \'email_footer\', \'custom\')', name='ck_brand_asset_type'),
        sa.CheckConstraint('file_size > 0 AND file_size <= 10485760', name='ck_brand_asset_size'), # 10MB max
        comment='Brand asset files and images'
    )
    op.create_index(op.f('ix_brand_assets_tenant_id'), 'brand_assets', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_brand_assets_asset_type'), 'brand_assets', ['asset_type'], unique=False)
    op.create_index(op.f('ix_brand_assets_is_active'), 'brand_assets', ['is_active'], unique=False)

    # Create email_templates table
    op.create_table(
        'email_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('template_type', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('subject', sa.String(length=500), nullable=False),
        sa.Column('html_content', sa.Text(), nullable=False),
        sa.Column('text_content', sa.Text(), nullable=True),
        sa.Column('variables', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('styles', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('language', sa.String(length=10), nullable=False),
        sa.Column('locale', sa.String(length=20), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'template_type', 'language', name='uq_email_template'),
        sa.CheckConstraint('template_type IN (\'welcome\', \'password_reset\', \'invitation\', \'notification\', \'marketing\', \'billing\', \'support\', \'custom\')', name='ck_email_template_type'),
        sa.CheckConstraint('language ~ \'^[a-z]{2}(-[A-Z]{2})?$\'', name='ck_email_template_language'),
        sa.CheckConstraint('version >= 1', name='ck_email_template_version'),
        comment='Custom email templates for tenant communications'
    )
    op.create_index(op.f('ix_email_templates_tenant_id'), 'email_templates', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_email_templates_template_type'), 'email_templates', ['template_type'], unique=False)
    op.create_index(op.f('ix_email_templates_is_active'), 'email_templates', ['is_active'], unique=False)

    # Create theme_presets table
    op.create_table(
        'theme_presets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),  # NULL for global presets
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('display_name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('colors', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('typography', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('layout', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('custom_properties', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_builtin', sa.Boolean(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('popularity_score', sa.Integer(), nullable=False),
        sa.Column('usage_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'name', name='uq_theme_preset'),
        sa.CheckConstraint('name ~ \'^[a-z0-9]+(-[a-z0-9]+)*$\'', name='ck_theme_preset_name'),
        sa.CheckConstraint('category IN (\'professional\', \'modern\', \"minimal\", \"colorful\", \"dark\", \"light\", \"custom\")', name='ck_theme_preset_category'),
        sa.CheckConstraint('popularity_score >= 0', name='ck_theme_preset_popularity'),
        sa.CheckConstraint('usage_count >= 0', name='ck_theme_preset_usage'),
        comment='Theme presets for quick branding setup'
    )
    op.create_index(op.f('ix_theme_presets_tenant_id'), 'theme_presets', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_theme_presets_category'), 'theme_presets', ['category'], unique=False)
    op.create_index(op.f('ix_theme_presets_is_builtin'), 'theme_presets', ['is_builtin'], unique=False)
    op.create_index(op.f('ix_theme_presets_popularity_score'), 'theme_presets', ['popularity_score'], unique=False)

    # Create domain_verifications table
    op.create_table(
        'domain_verifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('domain', sa.String(length=255), nullable=False),
        sa.Column('verification_method', sa.String(length=50), nullable=False),
        sa.Column('verification_token', sa.String(length=500), nullable=False),
        sa.Column('dns_record_type', sa.String(length=10), nullable=True),
        sa.Column('dns_record_name', sa.String(length=500), nullable=True),
        sa.Column('dns_record_value', sa.String(length=1000), nullable=True),
        sa.Column('verification_status', sa.String(length=20), nullable=False),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_attempts', sa.Integer(), nullable=False),
        sa.Column('last_attempt_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ssl_enabled', sa.Boolean(), nullable=False),
        sa.Column('ssl_certificate', sa.Text(), nullable=True),
        sa.Column('ssl_certificate_chain', sa.Text(), nullable=True),
        sa.Column('ssl_private_key', sa.Text(), nullable=True),
        sa.Column('ssl_issuer', sa.String(length=500), nullable=True),
        sa.Column('ssl_issued_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ssl_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('auto_renewal', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'domain', name='uq_domain_verification'),
        sa.CheckConstraint('domain ~ \'^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$\'', name='ck_domain_format'),
        sa.CheckConstraint('verification_method IN (\'dns\', \'file\', \'meta\', \'email\')', name='ck_verification_method'),
        sa.CheckConstraint('verification_status IN (\'pending\', \'verified\', \'failed\', \'expired\')', name='ck_verification_status'),
        sa.CheckConstraint('verification_attempts >= 0 AND verification_attempts <= 10', name='ck_verification_attempts'),
        comment='Custom domain verification and SSL certificates'
    )
    op.create_index(op.f('ix_domain_verifications_tenant_id'), 'domain_verifications', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_domain_verifications_domain'), 'domain_verifications', ['domain'], unique=False)
    op.create_index(op.f('ix_domain_verifications_status'), 'domain_verifications', ['verification_status'], unique=False)

    # Enable RLS on branding tables
    op.execute("ALTER TABLE branding_configurations ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE brand_assets ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE theme_presets ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE domain_verifications ENABLE ROW LEVEL SECURITY")

    # Create RLS policies for branding tables
    op.execute("""
        CREATE POLICY tenant_isolation_branding_configurations ON branding_configurations
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_brand_assets ON brand_assets
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_email_templates ON email_templates
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_theme_presets ON theme_presets
        USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_domain_verifications ON domain_verifications
        USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    """)

    # Create triggers for branding tables
    op.execute("""
        CREATE TRIGGER enforce_tenant_context_branding_configurations
        BEFORE INSERT OR UPDATE ON branding_configurations
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_brand_assets
        BEFORE INSERT OR UPDATE ON brand_assets
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_email_templates
        BEFORE INSERT OR UPDATE ON email_templates
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    op.execute("""
        CREATE TRIGGER enforce_tenant_context_domain_verifications
        BEFORE INSERT OR UPDATE ON domain_verifications
        FOR EACH ROW EXECUTE FUNCTION set_tenant_context();
    """)

    # Insert built-in theme presets
    op.execute("""
        INSERT INTO theme_presets (id, name, display_name, description, category, colors, typography, layout, is_builtin, is_active, popularity_score, usage_count)
        VALUES
            (gen_random_uuid(), 'modern-blue', 'Modern Blue', 'Clean professional blue theme', 'professional',
             '{"primary": "#2563eb", "secondary": "#64748b", "accent": "#f59e0b", "background": "#ffffff", "surface": "#f8fafc"}',
             '{"font_family_primary": "Inter, sans-serif", "font_family_secondary": "Inter, sans-serif", "font_size_base": 16}',
             '{"border_radius": 8, "sidebar_width": 280}',
             true, true, 100, 0),
            (gen_random_uuid(), 'minimal-gray', 'Minimal Gray', 'Minimalist gray theme', 'minimal',
             '{"primary": "#374151", "secondary": "#6b7280", "accent": "#10b981", "background": "#ffffff", "surface": "#f9fafb"}',
             '{"font_family_primary": "Inter, sans-serif", "font_family_secondary": "Inter, sans-serif", "font_size_base": 15}',
             '{"border_radius": 4, "sidebar_width": 260}',
             true, true, 85, 0),
            (gen_random_uuid(), 'dark-professional', 'Dark Professional', 'Professional dark theme', 'dark',
             '{"primary": "#3b82f6", "secondary": "#8b5cf6", "accent": "#f59e0b", "background": "#111827", "surface": "#1f2937"}',
             '{"font_family_primary": "Inter, sans-serif", "font_family_secondary": "Inter, sans-serif", "font_size_base": 16}',
             '{"border_radius": 12, "sidebar_width": 300}',
             true, true, 75, 0);
    """)


def downgrade() -> None:
    """Remove branding and white-labeling tables"""

    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_branding_configurations ON branding_configurations")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_brand_assets ON brand_assets")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_email_templates ON email_templates")
    op.execute("DROP TRIGGER IF EXISTS enforce_tenant_context_domain_verifications ON domain_verifications")

    # Drop RLS policies
    op.execute("DROP POLICY IF EXISTS tenant_isolation_branding_configurations ON branding_configurations")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_brand_assets ON brand_assets")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_email_templates ON email_templates")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_theme_presets ON theme_presets")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_domain_verifications ON domain_verifications")

    # Disable RLS
    op.execute("ALTER TABLE branding_configurations DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE brand_assets DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE email_templates DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE theme_presets DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE domain_verifications DISABLE ROW LEVEL SECURITY")

    # Drop indexes and tables
    op.drop_index(op.f('ix_domain_verifications_status'), table_name='domain_verifications')
    op.drop_index(op.f('ix_domain_verifications_domain'), table_name='domain_verifications')
    op.drop_index(op.f('ix_domain_verifications_tenant_id'), table_name='domain_verifications')
    op.drop_table('domain_verifications')

    op.drop_index(op.f('ix_theme_presets_popularity_score'), table_name='theme_presets')
    op.drop_index(op.f('ix_theme_presets_is_builtin'), table_name='theme_presets')
    op.drop_index(op.f('ix_theme_presets_category'), table_name='theme_presets')
    op.drop_index(op.f('ix_theme_presets_tenant_id'), table_name='theme_presets')
    op.drop_table('theme_presets')

    op.drop_index(op.f('ix_email_templates_is_active'), table_name='email_templates')
    op.drop_index(op.f('ix_email_templates_template_type'), table_name='email_templates')
    op.drop_index(op.f('ix_email_templates_tenant_id'), table_name='email_templates')
    op.drop_table('email_templates')

    op.drop_index(op.f('ix_brand_assets_is_active'), table_name='brand_assets')
    op.drop_index(op.f('ix_brand_assets_asset_type'), table_name='brand_assets')
    op.drop_index(op.f('ix_brand_assets_tenant_id'), table_name='brand_assets')
    op.drop_table('brand_assets')

    op.drop_index(op.f('ix_branding_configurations_is_active'), table_name='branding_configurations')
    op.drop_index(op.f('ix_branding_configurations_theme_name'), table_name='branding_configurations')
    op.drop_index(op.f('ix_branding_configurations_tenant_id'), table_name='branding_configurations')
    op.drop_table('branding_configurations')