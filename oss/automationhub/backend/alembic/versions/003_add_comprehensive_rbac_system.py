"""Add comprehensive RBAC system with hierarchical roles and granular permissions

Revision ID: 003
Revises: 002
Create Date: 2025-01-06 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop existing simple RBAC tables
    op.drop_table('user_roles')
    op.drop_table('role_permissions')
    op.drop_table('roles')

    # Create comprehensive permissions table
    op.create_table('permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('resource_type', sa.String(length=50), nullable=False),
        sa.Column('scope', sa.String(length=20), nullable=True),
        sa.Column('conditions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('constraints', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=False),
        sa.Column('is_sensitive', sa.Boolean(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('idx_permission_action_resource', 'permissions', ['action', 'resource_type'], unique=False)
    op.create_index('idx_permission_category_scope', 'permissions', ['category', 'scope'], unique=False)
    op.create_index('idx_permission_active_system', 'permissions', ['is_active', 'is_system'], unique=False)

    # Create comprehensive roles table
    op.create_table('roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('display_name', sa.String(length=200), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('parent_role_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('level', sa.Integer(), nullable=False),
        sa.Column('inherits_from_parent', sa.Boolean(), nullable=False),
        sa.Column('is_system_role', sa.Boolean(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_assignable', sa.Boolean(), nullable=False),
        sa.Column('max_assignments', sa.Integer(), nullable=True),
        sa.Column('valid_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('scope_constraints', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('role_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['parent_role_id'], ['roles.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
        sa.UniqueConstraint('organization_id', 'name', name='uq_role_org_name'),
        sa.CheckConstraint('level >= 0', name='check_level_non_negative')
    )
    op.create_index('idx_role_name_active', 'roles', ['name', 'is_active'], unique=False)
    op.create_index('idx_role_category_level', 'roles', ['category', 'level'], unique=False)
    op.create_index('idx_role_parent_level', 'roles', ['parent_role_id', 'level'], unique=False)
    op.create_index('idx_role_system_assignable', 'roles', ['is_system_role', 'is_assignable'], unique=False)
    op.create_index('idx_role_validity', 'roles', ['valid_from', 'valid_until'], unique=False)

    # Create enhanced role_permissions table
    op.create_table('role_permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('permission_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_granted', sa.Boolean(), nullable=False),
        sa.Column('conditions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('constraints', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('assigned_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['assigned_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('role_id', 'permission_id', name='uq_role_permission')
    )
    op.create_index('idx_role_perm_role_granted', 'role_permissions', ['role_id', 'is_granted'], unique=False)
    op.create_index('idx_role_perm_permission_granted', 'role_permissions', ['permission_id', 'is_granted'], unique=False)
    op.create_index('idx_role_perm_expires', 'role_permissions', ['expires_at'], unique=False)
    op.create_index('idx_role_perm_assigned', 'role_permissions', ['assigned_at', 'assigned_by'], unique=False)

    # Create enhanced user_role_assignments table
    op.create_table('user_role_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assigned_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('context', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('scope_constraints', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('conditions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['assigned_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'role_id', name='uq_user_role')
    )
    op.create_index('idx_user_role_user', 'user_role_assignments', ['user_id', 'is_active'], unique=False)
    op.create_index('idx_user_role_role', 'user_role_assignments', ['role_id', 'is_active'], unique=False)
    op.create_index('idx_user_role_expires', 'user_role_assignments', ['expires_at', 'is_active'], unique=False)
    op.create_index('idx_user_role_assigned', 'user_role_assignments', ['assigned_at', 'assigned_by'], unique=False)
    op.create_index('idx_user_role_approver', 'user_role_assignments', ['approved_by', 'approved_at'], unique=False)

    # Create resource_permissions table
    op.create_table('resource_permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('resource_type', sa.String(length=50), nullable=False),
        sa.Column('resource_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('permission_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_granted', sa.Boolean(), nullable=False),
        sa.Column('conditions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('constraints', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('granted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['granted_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('(user_id IS NOT NULL) OR (role_id IS NOT NULL)', name='check_user_or_role')
    )
    op.create_index('idx_resource_perm_resource', 'resource_permissions', ['resource_type', 'resource_id'], unique=False)
    op.create_index('idx_resource_perm_user', 'resource_permissions', ['user_id', 'is_granted'], unique=False)
    op.create_index('idx_resource_perm_role', 'resource_permissions', ['role_id', 'is_granted'], unique=False)
    op.create_index('idx_resource_perm_permission', 'resource_permissions', ['permission_id', 'is_granted'], unique=False)
    op.create_index('idx_resource_perm_expires', 'resource_permissions', ['expires_at'], unique=False)
    op.create_index('idx_resource_perm_granted', 'resource_permissions', ['granted_at', 'granted_by'], unique=False)

    # Create permission_audit_logs table
    op.create_table('permission_audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('target_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('old_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('new_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('audit_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('request_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['target_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_audit_entity', 'permission_audit_logs', ['entity_type', 'entity_id', 'created_at'], unique=False)
    op.create_index('idx_audit_actor', 'permission_audit_logs', ['actor_id', 'created_at'], unique=False)
    op.create_index('idx_audit_target_user', 'permission_audit_logs', ['target_user_id', 'created_at'], unique=False)
    op.create_index('idx_audit_event_type', 'permission_audit_logs', ['event_type', 'created_at'], unique=False)
    op.create_index('idx_audit_ip', 'permission_audit_logs', ['ip_address', 'created_at'], unique=False)

    # Add constraints to permissions table
    op.create_check_constraint(
        'check_action',
        "action IN ('create', 'read', 'update', 'delete', 'execute', 'manage', 'approve', 'export', 'import', 'share')"
    )
    op.create_check_constraint(
        'check_scope',
        "scope IN ('system', 'organization', 'team', 'resource', 'self')"
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('permission_audit_logs')
    op.drop_table('resource_permissions')
    op.drop_table('user_role_assignments')
    op.drop_table('role_permissions')
    op.drop_table('roles')
    op.drop_table('permissions')

    # Recreate simple RBAC tables (original state)
    op.create_table('roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('is_system_role', sa.Boolean(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    op.create_table('role_permissions',
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('permission', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.PrimaryKeyConstraint('role_id', 'permission')
    )

    op.create_table('user_roles',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('user_id', 'role_id')
    )