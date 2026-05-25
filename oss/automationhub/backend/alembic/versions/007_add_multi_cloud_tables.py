"""Add Multi-Cloud Infrastructure Orchestration tables

Revision ID: 007_add_multi_cloud_tables
Revises: 006_add_cloudflare_tables
Create Date: 2024-01-01 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = '007_add_multi_cloud_tables'
down_revision = '006_add_cloudflare_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create multi_cloud_providers table
    op.create_table(
        'multi_cloud_providers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('provider_type', sa.String(20), nullable=False, index=True),
        sa.Column('description', sa.Text(), nullable=True),

        # Provider configuration
        sa.Column('credentials', sa.JSON(), nullable=False),  # Encrypted credentials
        sa.Column('configuration', sa.JSON(), nullable=True),
        sa.Column('region', sa.String(50), nullable=True),
        sa.Column('environment', sa.String(20), nullable=False, server_default='production'),

        # Provider capabilities
        sa.Column('supported_services', sa.JSON(), nullable=True, default=list),
        sa.Column('quotas', sa.JSON(), nullable=True, default=dict),

        # Connection and status
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true', index=True),
        sa.Column('is_connected', sa.Boolean(), nullable=False, server_default='false', index=True),
        sa.Column('last_connection_test', sa.DateTime(timezone=True), nullable=True),
        sa.Column('connection_error', sa.Text(), nullable=True),

        # Health and monitoring
        sa.Column('health_status', sa.String(20), nullable=False, server_default='unknown'),
        sa.Column('last_health_check', sa.DateTime(timezone=True), nullable=True),
        sa.Column('health_check_interval', sa.Integer(), nullable=True, server_default='300'),

        # Cost tracking
        sa.Column('cost_tracking_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('budget_alerts', sa.JSON(), nullable=True, default=dict),
        sa.Column('cost_center', sa.String(100), nullable=True),

        # Security settings
        sa.Column('security_policy_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cloud_security_policies.id'), nullable=True),
        sa.Column('encryption_at_rest', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('encryption_in_transit', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('access_logging', sa.Boolean(), nullable=False, server_default='true'),

        # Metadata
        sa.Column('tags', sa.JSON(), nullable=True, default=dict),
        sa.Column('metadata', sa.JSON(), nullable=True, default=dict),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),

        sa.Index('ix_multi_cloud_providers_tenant_id', 'tenant_id'),
        sa.Index('ix_multi_cloud_providers_provider_type', 'provider_type'),
        sa.Index('ix_multi_cloud_providers_is_active', 'is_active'),
        sa.Index('ix_multi_cloud_providers_is_connected', 'is_connected'),
        sa.Index('ix_multi_cloud_providers_name', 'name'),
        sa.UniqueConstraint('tenant_id', 'name', name='uq_multi_cloud_providers_tenant_name')
    )

    # Create cloud_resources table
    op.create_table(
        'cloud_resources',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('multi_cloud_providers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('deployment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cloud_deployments.id'), nullable=True, index=True),

        # Resource identification
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('type', sa.String(50), nullable=False, index=True),
        sa.Column('category', sa.String(50), nullable=True, index=True),
        sa.Column('provider_resource_id', sa.String(500), nullable=False, index=True),

        # Resource configuration
        sa.Column('configuration', sa.JSON(), nullable=False),
        sa.Column('provider_specific_data', sa.JSON(), nullable=True, default=dict),
        sa.Column('tags', sa.JSON(), nullable=True, default=dict),

        # Resource status and health
        sa.Column('status', sa.String(20), nullable=False, index=True, server_default='active'),
        sa.Column('health_status', sa.String(20), nullable=False, server_default='unknown'),
        sa.Column('last_health_check', sa.DateTime(timezone=True), nullable=True),

        # Resource metrics
        sa.Column('metrics', sa.JSON(), nullable=True, default=dict),
        sa.Column('cost_monthly', sa.Numeric(10, 2), nullable=True),
        sa.Column('performance_metrics', sa.JSON(), nullable=True, default=dict),

        # Dependencies and relationships
        sa.Column('depends_on', sa.JSON(), nullable=True, default=list),
        sa.Column('dependents', sa.JSON(), nullable=True, default=list),

        # Backup and disaster recovery
        sa.Column('backup_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('backup_retention_days', sa.Integer(), nullable=True),
        sa.Column('last_backup_at', sa.DateTime(timezone=True), nullable=True),

        # Security and compliance
        sa.Column('security_level', sa.String(20), nullable=False, server_default='standard'),
        sa.Column('compliance_tags', sa.JSON(), nullable=True, default=list),
        sa.Column('security_issues', sa.JSON(), nullable=True, default=list),

        # Lifecycle management
        sa.Column('auto_scaling_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('auto_scaling_config', sa.JSON(), nullable=True, default=dict),
        sa.Column('lifecycle_policy', sa.JSON(), nullable=True, default=dict),

        # Monitoring and alerting
        sa.Column('monitoring_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('alert_config', sa.JSON(), nullable=True, default=dict),
        sa.Column('last_alert_at', sa.DateTime(timezone=True), nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),  # Soft delete
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),

        sa.Index('ix_cloud_resources_tenant_id', 'tenant_id'),
        sa.Index('ix_cloud_resources_provider_id', 'provider_id'),
        sa.Index('ix_cloud_resources_deployment_id', 'deployment_id'),
        sa.Index('ix_cloud_resources_name', 'name'),
        sa.Index('ix_cloud_resources_type', 'type'),
        sa.Index('ix_cloud_resources_status', 'status'),
        sa.Index('ix_cloud_resources_provider_resource_id', 'provider_resource_id')
    )

    # Create cloud_deployments table
    op.create_table(
        'cloud_deployments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('multi_cloud_providers.id', ondelete='CASCADE'), nullable=False, index=True),

        # Deployment identification
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('deployment_type', sa.String(50), nullable=False, server_default='infrastructure'),

        # Deployment configuration
        sa.Column('resources', sa.JSON(), nullable=False),
        sa.Column('dependencies', sa.JSON(), nullable=True, default=dict),
        sa.Column('deployment_order', sa.JSON(), nullable=True, default=list),

        # Deployment status and tracking
        sa.Column('status', sa.String(20), nullable=False, index=True, server_default='pending'),
        sa.Column('current_step', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_steps', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('progress_percentage', sa.Float(), nullable=False, server_default='0.0'),

        # Deployment configuration
        sa.Column('deployment_config', sa.JSON(), nullable=True, default=dict),
        sa.Column('environment', sa.String(20), nullable=False, server_default='production'),
        sa.Column('region', sa.String(50), nullable=True),

        # Rollback configuration
        sa.Column('rollback_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('rollback_plan', sa.JSON(), nullable=True, default=dict),
        sa.Column('rollback_reason', sa.Text(), nullable=True),

        # Cost and duration estimates
        sa.Column('estimated_cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('actual_cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('estimated_duration_minutes', sa.Integer(), nullable=True),
        sa.Column('actual_duration_minutes', sa.Integer(), nullable=True),

        # Approval workflow
        sa.Column('approval_required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approval_notes', sa.Text(), nullable=True),

        # Deployment results
        sa.Column('deployment_results', sa.JSON(), nullable=True, default=list),
        sa.Column('error_details', sa.JSON(), nullable=True, default=dict),
        sa.Column('success_resources', sa.JSON(), nullable=True, default=list),
        sa.Column('failed_resources', sa.JSON(), nullable=True, default=list),

        # Monitoring and validation
        sa.Column('validation_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('validation_rules', sa.JSON(), nullable=True, default=list),
        sa.Column('health_checks', sa.JSON(), nullable=True, default=list),

        # Notifications
        sa.Column('notification_config', sa.JSON(), nullable=True, default=dict),
        sa.Column('notification_sent', sa.Boolean(), nullable=False, server_default='false'),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),

        sa.Index('ix_cloud_deployments_tenant_id', 'tenant_id'),
        sa.Index('ix_cloud_deployments_provider_id', 'provider_id'),
        sa.Index('ix_cloud_deployments_name', 'name'),
        sa.Index('ix_cloud_deployments_status', 'status'),
        sa.Index('ix_cloud_deployments_deployment_type', 'deployment_type')
    )

    # Create cloud_cost_trackers table
    op.create_table(
        'cloud_cost_trackers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('multi_cloud_providers.id', ondelete='CASCADE'), nullable=False, index=True),

        # Cost tracking period
        sa.Column('date', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),

        # Cost breakdown
        sa.Column('cost_amount', sa.Numeric(15, 4), nullable=False, server_default='0.0000'),
        sa.Column('forecast_amount', sa.Numeric(15, 4), nullable=True),
        sa.Column('usage_amount', sa.Numeric(15, 4), nullable=False, server_default='0.0000'),
        sa.Column('fixed_amount', sa.Numeric(15, 4), nullable=False, server_default='0.0000'),

        # Cost by service category
        sa.Column('compute_cost', sa.Numeric(12, 4), nullable=False, server_default='0.0000'),
        sa.Column('storage_cost', sa.Numeric(12, 4), nullable=False, server_default='0.0000'),
        sa.Column('network_cost', sa.Numeric(12, 4), nullable=False, server_default='0.0000'),
        sa.Column('database_cost', sa.Numeric(12, 4), nullable=False, server_default='0.0000'),
        sa.Column('serverless_cost', sa.Numeric(12, 4), nullable=False, server_default='0.0000'),
        sa.Column('other_cost', sa.Numeric(12, 4), nullable=False, server_default='0.0000'),

        # Cost by resource
        sa.Column('resource_costs', sa.JSON(), nullable=True, default=dict),

        # Budget tracking
        sa.Column('budget_amount', sa.Numeric(15, 4), nullable=True),
        sa.Column('budget_usage_percentage', sa.Float(), nullable=True),
        sa.Column('budget_alert_threshold', sa.Float(), nullable=False, server_default='80.0'),
        sa.Column('budget_alert_sent', sa.Boolean(), nullable=False, server_default='false'),

        # Usage metrics
        sa.Column('compute_hours', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('storage_gb', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('data_transfer_gb', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('requests_count', sa.BigInteger(), nullable=False, server_default='0'),

        # Cost optimization
        sa.Column('optimization_suggestions', sa.JSON(), nullable=True, default=list),
        sa.Column('potential_savings', sa.Numeric(12, 4), nullable=True),
        sa.Column('implemented_optimizations', sa.JSON(), nullable=True, default=list),

        # Metadata
        sa.Column('cost_center', sa.String(100), nullable=True),
        sa.Column('project_code', sa.String(100), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True, default=dict),

        # Data source and quality
        sa.Column('data_source', sa.String(50), nullable=False, server_default='api'),
        sa.Column('last_updated', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('data_quality_score', sa.Float(), nullable=True),

        sa.Index('ix_cloud_cost_trackers_tenant_id', 'tenant_id'),
        sa.Index('ix_cloud_cost_trackers_provider_id', 'provider_id'),
        sa.Index('ix_cloud_cost_trackers_date', 'date')
    )

    # Create cloud_security_policies table
    op.create_table(
        'cloud_security_policies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),

        # Policy identification
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('policy_type', sa.String(50), nullable=False),
        sa.Column('category', sa.String(50), nullable=True),

        # Policy configuration
        sa.Column('rules', sa.JSON(), nullable=False),
        sa.Column('exceptions', sa.JSON(), nullable=True, default=list),
        sa.Column('remediation_actions', sa.JSON(), nullable=True, default=list),

        # Compliance frameworks
        sa.Column('compliance_frameworks', sa.JSON(), nullable=True, default=list),
        sa.Column('compliance_status', sa.String(20), nullable=False, server_default='non_compliant'),
        sa.Column('last_compliance_check', sa.DateTime(timezone=True), nullable=True),

        # Policy enforcement
        sa.Column('enforcement_mode', sa.String(20), nullable=False, server_default='monitor'),
        sa.Column('auto_remediation_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('violation_alerts_enabled', sa.Boolean(), nullable=False, server_default='true'),

        # Risk assessment
        sa.Column('risk_level', sa.String(20), nullable=False, server_default='medium'),
        sa.Column('risk_score', sa.Float(), nullable=True),
        sa.Column('risk_factors', sa.JSON(), nullable=True, default=list),

        # Policy effectiveness
        sa.Column('violations_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('remediations_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('effectiveness_score', sa.Float(), nullable=True),

        # Review and approval
        sa.Column('reviewer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('next_review_date', sa.DateTime(timezone=True), nullable=True),

        # Policy versioning
        sa.Column('version', sa.String(20), nullable=False, server_default='1.0'),
        sa.Column('parent_policy_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cloud_security_policies.id'), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),

        sa.Index('ix_cloud_security_policies_tenant_id', 'tenant_id'),
        sa.Index('ix_cloud_security_policies_name', 'name'),
        sa.Index('ix_cloud_security_policies_policy_type', 'policy_type'),
        sa.Index('ix_cloud_security_policies_is_active', 'is_active')
    )

    # Create cloud_resource_groups table
    op.create_table(
        'cloud_resource_groups',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),

        # Group identification
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('group_type', sa.String(50), nullable=False, server_default='custom'),

        # Group configuration
        sa.Column('resource_ids', sa.JSON(), nullable=False, default=list),
        sa.Column('tags', sa.JSON(), nullable=True, default=dict),
        sa.Column('metadata', sa.JSON(), nullable=True, default=dict),

        # Group policies
        sa.Column('security_policy_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cloud_security_policies.id'), nullable=True),
        sa.Column('cost_budget', sa.Numeric(12, 2), nullable=True),
        sa.Column('access_control', sa.JSON(), nullable=True, default=dict),

        # Monitoring and alerting
        sa.Column('monitoring_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('alert_config', sa.JSON(), nullable=True, default=dict),

        # Lifecycle management
        sa.Column('auto_cleanup', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('cleanup_after_days', sa.Integer(), nullable=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),

        sa.Index('ix_cloud_resource_groups_tenant_id', 'tenant_id'),
        sa.Index('ix_cloud_resource_groups_name', 'name'),
        sa.Index('ix_cloud_resource_groups_group_type', 'group_type')
    )

    # Create cloud_templates table
    op.create_table(
        'cloud_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),

        # Template identification
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('template_type', sa.String(50), nullable=False),
        sa.Column('category', sa.String(50), nullable=True),

        # Template content
        sa.Column('template_content', sa.Text(), nullable=False),
        sa.Column('variables', sa.JSON(), nullable=True, default=dict),
        sa.Column('outputs', sa.JSON(), nullable=True, default=dict),

        # Supported providers
        sa.Column('supported_providers', sa.JSON(), nullable=True, default=list),
        sa.Column('provider_mappings', sa.JSON(), nullable=True, default=dict),

        # Template metadata
        sa.Column('version', sa.String(20), nullable=False, server_default='1.0'),
        sa.Column('author', sa.String(255), nullable=True),
        sa.Column('documentation_url', sa.String(500), nullable=True),
        sa.Column('repository_url', sa.String(500), nullable=True),

        # Usage tracking
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_used', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rating', sa.Float(), nullable=True),
        sa.Column('user_reviews', sa.JSON(), nullable=True, default=list),

        # Validation and testing
        sa.Column('validation_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('test_results', sa.JSON(), nullable=True, default=dict),
        sa.Column('security_scan_results', sa.JSON(), nullable=True, default=dict),

        # Template lifecycle
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('deprecated', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deprecation_date', sa.DateTime(timezone=True), nullable=True),

        # Dependencies
        sa.Column('dependencies', sa.JSON(), nullable=True, default=list),
        sa.Column('resource_requirements', sa.JSON(), nullable=True, default=dict),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),

        sa.Index('ix_cloud_templates_tenant_id', 'tenant_id'),
        sa.Index('ix_cloud_templates_name', 'name'),
        sa.Index('ix_cloud_templates_template_type', 'template_type'),
        sa.Index('ix_cloud_templates_is_public', 'is_public'),
        sa.Index('ix_cloud_templates_is_active', 'is_active')
    )


def downgrade() -> None:
    # Drop tables in reverse order due to foreign key constraints
    op.drop_table('cloud_templates')
    op.drop_table('cloud_resource_groups')
    op.drop_table('cloud_security_policies')
    op.drop_table('cloud_cost_trackers')
    op.drop_table('cloud_deployments')
    op.drop_table('cloud_resources')
    op.drop_table('multi_cloud_providers')