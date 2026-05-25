"""Add workflow persistence models

Revision ID: 009_add_workflow_persistence_models
Revises: 008_add_advanced_analytics_tables
Create Date: 2025-01-07 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '009_add_workflow_persistence_models'
down_revision = '008_add_advanced_analytics_tables'
branch_labels = None
depends_on = None


def upgrade():
    """Create workflow persistence tables."""
    
    # Create workflow_definitions_v2 table
    op.create_table('workflow_definitions_v2',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('parent_version_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('nodes', sa.JSON(), nullable=False),
        sa.Column('connections', sa.JSON(), nullable=False),
        sa.Column('variables', sa.JSON(), nullable=True),
        sa.Column('settings', sa.JSON(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.Enum('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'DEPRECATED', 'MIGRATING', name='workflowstatus'), nullable=True),
        sa.Column('is_template', sa.Boolean(), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=True),
        sa.Column('execution_count', sa.Integer(), nullable=True),
        sa.Column('success_count', sa.Integer(), nullable=True),
        sa.Column('failure_count', sa.Integer(), nullable=True),
        sa.Column('success_rate', sa.Float(), nullable=True),
        sa.Column('avg_execution_time_ms', sa.Float(), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=True),
        sa.Column('encryption_enabled', sa.Boolean(), nullable=True),
        sa.Column('compliance_tags', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('access_control', sa.JSON(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.CheckConstraint('priority >= 1 AND priority <= 10', name='check_priority_range'),
        sa.CheckConstraint('success_rate >= 0.0 AND success_rate <= 100.0', name='check_success_rate_range'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['deleted_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['parent_version_id'], ['workflow_definitions_v2.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for workflow_definitions_v2
    op.create_index('idx_workflow_owner_status', 'workflow_definitions_v2', ['created_by', 'status'])
    op.create_index('idx_workflow_created_at', 'workflow_definitions_v2', ['created_at'])
    op.create_index('idx_workflow_execution_count', 'workflow_definitions_v2', ['execution_count'])
    op.create_index('idx_workflow_success_rate', 'workflow_definitions_v2', ['success_rate'])
    op.create_index('idx_workflow_category_priority', 'workflow_definitions_v2', ['category', 'priority'])
    op.create_index('idx_workflow_version_chain', 'workflow_definitions_v2', ['parent_version_id', 'version'])
    op.create_index(op.f('ix_workflow_definitions_v2_name'), 'workflow_definitions_v2', ['name'])
    op.create_index(op.f('ix_workflow_definitions_v2_created_by'), 'workflow_definitions_v2', ['created_by'])
    op.create_index(op.f('ix_workflow_definitions_v2_is_active'), 'workflow_definitions_v2', ['is_active'])
    op.create_index(op.f('ix_workflow_definitions_v2_status'), 'workflow_definitions_v2', ['status'])
    op.create_index(op.f('ix_workflow_definitions_v2_is_template'), 'workflow_definitions_v2', ['is_template'])
    op.create_index(op.f('ix_workflow_definitions_v2_category'), 'workflow_definitions_v2', ['category'])
    
    # Create workflow_executions_v2 table
    op.create_table('workflow_executions_v2',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_version', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'RETRYING', 'PAUSED', 'RECOVERING', name='executionstatus'), nullable=True),
        sa.Column('progress_percentage', sa.Float(), nullable=True),
        sa.Column('current_nodes', sa.JSON(), nullable=True),
        sa.Column('completed_nodes', sa.JSON(), nullable=True),
        sa.Column('failed_nodes', sa.JSON(), nullable=True),
        sa.Column('input_data', sa.JSON(), nullable=True),
        sa.Column('output_data', sa.JSON(), nullable=True),
        sa.Column('execution_context', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paused_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('execution_time_ms', sa.Float(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_details', sa.JSON(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=True),
        sa.Column('max_retries', sa.Integer(), nullable=True),
        sa.Column('next_retry_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('started_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('session_id', sa.String(length=255), nullable=True),
        sa.Column('resource_usage', sa.JSON(), nullable=True),
        sa.Column('performance_metrics', sa.JSON(), nullable=True),
        sa.Column('audit_log', sa.JSON(), nullable=True),
        sa.Column('compliance_data', sa.JSON(), nullable=True),
        sa.Column('external_trigger_data', sa.JSON(), nullable=True),
        sa.Column('webhook_responses', sa.JSON(), nullable=True),
        sa.CheckConstraint('progress_percentage >= 0.0 AND progress_percentage <= 100.0', name='check_progress_range'),
        sa.ForeignKeyConstraint(['started_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflow_definitions_v2.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for workflow_executions_v2
    op.create_index('idx_execution_workflow_status', 'workflow_executions_v2', ['workflow_id', 'status'])
    op.create_index('idx_execution_started_at', 'workflow_executions_v2', ['started_at'])
    op.create_index('idx_execution_user_status', 'workflow_executions_v2', ['started_by', 'status'])
    op.create_index('idx_execution_session', 'workflow_executions_v2', ['session_id'])
    op.create_index('idx_execution_retry', 'workflow_executions_v2', ['next_retry_at'])
    op.create_index(op.f('ix_workflow_executions_v2_workflow_id'), 'workflow_executions_v2', ['workflow_id'])
    op.create_index(op.f('ix_workflow_executions_v2_status'), 'workflow_executions_v2', ['status'])
    op.create_index(op.f('ix_workflow_executions_v2_started_by'), 'workflow_executions_v2', ['started_by'])
    op.create_index(op.f('ix_workflow_executions_v2_session_id'), 'workflow_executions_v2', ['session_id'])
    
    # Create node_executions_v2 table
    op.create_table('node_executions_v2',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('execution_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('node_id', sa.String(length=255), nullable=False),
        sa.Column('node_type', sa.String(length=100), nullable=False),
        sa.Column('node_name', sa.String(length=255), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED', 'TIMEOUT', 'RETRYING', name='nodestatus'), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('execution_time_ms', sa.Float(), nullable=True),
        sa.Column('input_data', sa.JSON(), nullable=True),
        sa.Column('output_data', sa.JSON(), nullable=True),
        sa.Column('result_storage_ref', sa.String(length=500), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_details', sa.JSON(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=True),
        sa.Column('resource_usage', sa.JSON(), nullable=True),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('execution_log', sa.JSON(), nullable=True),
        sa.Column('dependencies_met', sa.JSON(), nullable=True),
        sa.Column('conditions_evaluated', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
        sa.ForeignKeyConstraint(['execution_id'], ['workflow_executions_v2.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for node_executions_v2
    op.create_index('idx_node_execution_lookup', 'node_executions_v2', ['execution_id', 'node_id'])
    op.create_index('idx_node_execution_status', 'node_executions_v2', ['status', 'started_at'])
    op.create_index('idx_node_execution_agent', 'node_executions_v2', ['agent_id'])
    op.create_index('idx_node_execution_timing', 'node_executions_v2', ['started_at', 'completed_at'])
    op.create_index(op.f('ix_node_executions_v2_execution_id'), 'node_executions_v2', ['execution_id'])
    op.create_index(op.f('ix_node_executions_v2_node_id'), 'node_executions_v2', ['node_id'])
    op.create_index(op.f('ix_node_executions_v2_status'), 'node_executions_v2', ['status'])
    
    # Create execution_audit_logs table
    op.create_table('execution_audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('execution_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.Enum('WORKFLOW_CREATED', 'WORKFLOW_UPDATED', 'WORKFLOW_DELETED', 'WORKFLOW_ACTIVATED', 'WORKFLOW_DEACTIVATED', 'EXECUTION_STARTED', 'EXECUTION_COMPLETED', 'EXECUTION_FAILED', 'EXECUTION_CANCELLED', 'EXECUTION_PAUSED', 'EXECUTION_RESUMED', 'NODE_STARTED', 'NODE_COMPLETED', 'NODE_FAILED', 'NODE_RETRIED', 'DATA_ACCESSED', 'PERMISSION_CHANGED', 'VERSION_CREATED', 'MIGRATION_STARTED', 'MIGRATION_COMPLETED', name='auditeventtype'), nullable=False),
        sa.Column('event_timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('session_id', sa.String(length=255), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('node_id', sa.String(length=255), nullable=True),
        sa.Column('event_data', sa.JSON(), nullable=False),
        sa.Column('before_state', sa.JSON(), nullable=True),
        sa.Column('after_state', sa.JSON(), nullable=True),
        sa.Column('checksum', sa.String(length=64), nullable=False),
        sa.Column('compliance_tags', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('retention_until', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['execution_id'], ['workflow_executions_v2.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for execution_audit_logs
    op.create_index('idx_audit_execution_event', 'execution_audit_logs', ['execution_id', 'event_type'])
    op.create_index('idx_audit_timestamp', 'execution_audit_logs', ['event_timestamp'])
    op.create_index('idx_audit_user_time', 'execution_audit_logs', ['user_id', 'event_timestamp'])
    op.create_index('idx_audit_node_event', 'execution_audit_logs', ['node_id', 'event_type'])
    op.create_index(op.f('ix_execution_audit_logs_execution_id'), 'execution_audit_logs', ['execution_id'])
    op.create_index(op.f('ix_execution_audit_logs_event_type'), 'execution_audit_logs', ['event_type'])
    op.create_index(op.f('ix_execution_audit_logs_user_id'), 'execution_audit_logs', ['user_id'])
    
    # Create workflow_versions table
    op.create_table('workflow_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('change_summary', sa.JSON(), nullable=True),
        sa.Column('parent_version_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('is_deprecated', sa.Boolean(), nullable=True),
        sa.Column('migration_status', sa.String(length=50), nullable=True),
        sa.Column('migration_path', sa.JSON(), nullable=True),
        sa.Column('compatibility_info', sa.JSON(), nullable=True),
        sa.Column('changes', sa.JSON(), nullable=True),
        sa.Column('breaking_changes', sa.JSON(), nullable=True),
        sa.Column('migration_notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['parent_version_id'], ['workflow_versions.id'], ),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflow_definitions_v2.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('workflow_id', 'version_number', name='uq_workflow_version')
    )
    
    # Create indexes for workflow_versions
    op.create_index('idx_version_workflow_number', 'workflow_versions', ['workflow_id', 'version_number'])
    op.create_index('idx_version_created_at', 'workflow_versions', ['created_at'])
    op.create_index('idx_version_active', 'workflow_versions', ['is_active'])
    op.create_index(op.f('ix_workflow_versions_workflow_id'), 'workflow_versions', ['workflow_id'])


def downgrade():
    """Drop workflow persistence tables."""
    
    # Drop indexes first
    op.drop_index('idx_version_active', table_name='workflow_versions')
    op.drop_index('idx_version_created_at', table_name='workflow_versions')
    op.drop_index('idx_version_workflow_number', table_name='workflow_versions')
    op.drop_index(op.f('ix_workflow_versions_workflow_id'), table_name='workflow_versions')
    
    op.drop_index('idx_audit_node_event', table_name='execution_audit_logs')
    op.drop_index('idx_audit_user_time', table_name='execution_audit_logs')
    op.drop_index('idx_audit_timestamp', table_name='execution_audit_logs')
    op.drop_index('idx_audit_execution_event', table_name='execution_audit_logs')
    op.drop_index(op.f('ix_execution_audit_logs_user_id'), table_name='execution_audit_logs')
    op.drop_index(op.f('ix_execution_audit_logs_event_type'), table_name='execution_audit_logs')
    op.drop_index(op.f('ix_execution_audit_logs_execution_id'), table_name='execution_audit_logs')
    
    op.drop_index('idx_node_execution_timing', table_name='node_executions_v2')
    op.drop_index('idx_node_execution_agent', table_name='node_executions_v2')
    op.drop_index('idx_node_execution_status', table_name='node_executions_v2')
    op.drop_index('idx_node_execution_lookup', table_name='node_executions_v2')
    op.drop_index(op.f('ix_node_executions_v2_status'), table_name='node_executions_v2')
    op.drop_index(op.f('ix_node_executions_v2_node_id'), table_name='node_executions_v2')
    op.drop_index(op.f('ix_node_executions_v2_execution_id'), table_name='node_executions_v2')
    
    op.drop_index('idx_execution_retry', table_name='workflow_executions_v2')
    op.drop_index('idx_execution_session', table_name='workflow_executions_v2')
    op.drop_index('idx_execution_user_status', table_name='workflow_executions_v2')
    op.drop_index('idx_execution_started_at', table_name='workflow_executions_v2')
    op.drop_index('idx_execution_workflow_status', table_name='workflow_executions_v2')
    op.drop_index(op.f('ix_workflow_executions_v2_session_id'), table_name='workflow_executions_v2')
    op.drop_index(op.f('ix_workflow_executions_v2_started_by'), table_name='workflow_executions_v2')
    op.drop_index(op.f('ix_workflow_executions_v2_status'), table_name='workflow_executions_v2')
    op.drop_index(op.f('ix_workflow_executions_v2_workflow_id'), table_name='workflow_executions_v2')
    
    op.drop_index('idx_workflow_version_chain', table_name='workflow_definitions_v2')
    op.drop_index('idx_workflow_category_priority', table_name='workflow_definitions_v2')
    op.drop_index('idx_workflow_success_rate', table_name='workflow_definitions_v2')
    op.drop_index('idx_workflow_execution_count', table_name='workflow_definitions_v2')
    op.drop_index('idx_workflow_created_at', table_name='workflow_definitions_v2')
    op.drop_index('idx_workflow_owner_status', table_name='workflow_definitions_v2')
    op.drop_index(op.f('ix_workflow_definitions_v2_category'), table_name='workflow_definitions_v2')
    op.drop_index(op.f('ix_workflow_definitions_v2_is_template'), table_name='workflow_definitions_v2')
    op.drop_index(op.f('ix_workflow_definitions_v2_status'), table_name='workflow_definitions_v2')
    op.drop_index(op.f('ix_workflow_definitions_v2_is_active'), table_name='workflow_definitions_v2')
    op.drop_index(op.f('ix_workflow_definitions_v2_created_by'), table_name='workflow_definitions_v2')
    op.drop_index(op.f('ix_workflow_definitions_v2_name'), table_name='workflow_definitions_v2')
    
    # Drop tables
    op.drop_table('workflow_versions')
    op.drop_table('execution_audit_logs')
    op.drop_table('node_executions_v2')
    op.drop_table('workflow_executions_v2')
    op.drop_table('workflow_definitions_v2')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS auditeventtype')
    op.execute('DROP TYPE IF EXISTS nodestatus')
    op.execute('DROP TYPE IF EXISTS executionstatus')
    op.execute('DROP TYPE IF EXISTS workflowstatus')