"""Create RBAC tables

Revision ID: 000001
Revises:
Create Date: 2024-01-30 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create RBAC tables and related indexes."""

    # Create permissions table
    op.create_table(
        "permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "scope",
            sa.Enum(
                "SYSTEM", "ORGANIZATION", "PROJECT", "RESOURCE", name="permissionscope"
            ),
            nullable=False,
        ),
        sa.Column(
            "resource_type",
            sa.Enum(
                "SYSTEM",
                "USER",
                "ROLE",
                "POLICY",
                "ORGANIZATION",
                "ORG_MEMBER",
                "PROJECT",
                "DEPENDENCY",
                "VULNERABILITY",
                "ANALYSIS",
                "BUILD",
                "REPOSITORY",
                "CONFIGURATION",
                "INTEGRATION",
                name="resourcetype",
            ),
            nullable=False,
        ),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False),
        sa.Column("is_sensitive", sa.Boolean(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(
        op.f("ix_permissions_action"), "permissions", ["action"], unique=False
    )
    op.create_index(
        op.f("ix_permissions_category"), "permissions", ["category"], unique=False
    )
    op.create_index(
        op.f("ix_permissions_resource_type"),
        "permissions",
        ["resource_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_permissions_scope"), "permissions", ["scope"], unique=False
    )

    # Create roles table
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_privileged", sa.Boolean(), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("parent_role_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["parent_role_id"], ["roles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "(organization_id IS NULL) OR (code IS NOT NULL)",
            name="uq_roles_system_code",
        ),
        sa.UniqueConstraint("organization_id", "code", name="uq_roles_org_code"),
    )
    op.create_index(op.f("ix_roles_active"), "roles", ["is_active"], unique=False)
    op.create_index(op.f("ix_roles_level"), "roles", ["level"], unique=False)
    op.create_index(
        op.f("ix_roles_organization"), "roles", ["organization_id"], unique=False
    )
    op.create_index(op.f("ix_roles_system"), "roles", ["is_system"], unique=False)

    # Create role_permissions association table
    op.create_table(
        "role_permissions",
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["permission_id"], ["permissions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("role_id", "permission_id"),
    )
    op.create_index(
        op.f("ix_role_permissions_permission"),
        "role_permissions",
        ["permission_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_role_permissions_role"), "role_permissions", ["role_id"], unique=False
    )

    # Create user_role_assignments table
    op.create_table(
        "user_role_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["assigned_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "role_id",
            "organization_id",
            "project_id",
            name="uq_user_role_assignment",
        ),
    )
    op.create_index(
        op.f("ix_user_role_assignments_active"),
        "user_role_assignments",
        ["is_active"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_role_assignments_expires"),
        "user_role_assignments",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_role_assignments_org"),
        "user_role_assignments",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_role_assignments_project"),
        "user_role_assignments",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_role_assignments_role"),
        "user_role_assignments",
        ["role_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_role_assignments_user"),
        "user_role_assignments",
        ["user_id"],
        unique=False,
    )

    # Create resource_permissions table
    op.create_table(
        "resource_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "resource_type",
            sa.Enum(
                "SYSTEM",
                "USER",
                "ROLE",
                "POLICY",
                "ORGANIZATION",
                "ORG_MEMBER",
                "PROJECT",
                "DEPENDENCY",
                "VULNERABILITY",
                "ANALYSIS",
                "BUILD",
                "REPOSITORY",
                "CONFIGURATION",
                "INTEGRATION",
                name="resourcetype",
            ),
            nullable=False,
        ),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_granted", sa.Boolean(), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("granted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["granted_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["permission_id"], ["permissions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "permission_id",
            "resource_type",
            "resource_id",
            name="uq_resource_permission",
        ),
    )
    op.create_index(
        op.f("ix_resource_permissions_expires"),
        "resource_permissions",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resource_permissions_granted"),
        "resource_permissions",
        ["is_granted"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resource_permissions_permission"),
        "resource_permissions",
        ["permission_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resource_permissions_resource"),
        "resource_permissions",
        ["resource_type", "resource_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resource_permissions_user"),
        "resource_permissions",
        ["user_id"],
        unique=False,
    )

    # Create role_templates table
    op.create_table(
        "role_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column(
            "scope",
            sa.Enum(
                "SYSTEM", "ORGANIZATION", "PROJECT", "RESOURCE", name="permissionscope"
            ),
            nullable=False,
        ),
        sa.Column("is_system", sa.Boolean(), nullable=False),
        sa.Column("permissions", sa.JSON(), nullable=True),
        sa.Column("default_settings", sa.JSON(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(
        op.f("ix_role_templates_category"), "role_templates", ["category"], unique=False
    )
    op.create_index(
        op.f("ix_role_templates_scope"), "role_templates", ["scope"], unique=False
    )
    op.create_index(
        op.f("ix_role_templates_system"), "role_templates", ["is_system"], unique=False
    )

    # Update users table to add missing columns for RBAC
    op.add_column("users", sa.Column("preferences", sa.JSON(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "email_verified", sa.Boolean(), nullable=False, server_default="false"
        ),
    )
    op.add_column(
        "users",
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "users", sa.Column("mfa_secret", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column(
            "failed_login_attempts", sa.Integer(), nullable=False, server_default="0"
        ),
    )
    op.add_column(
        "users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column(
            "password_changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.add_column(
        "users", sa.Column("password_reset_token", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("password_reset_expires", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users", sa.Column("avatar_url", sa.String(length=500), nullable=True)
    )
    op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "timezone", sa.String(length=50), nullable=False, server_default="UTC"
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "locale", sa.String(length=10), nullable=False, server_default="en-US"
        ),
    )
    op.add_column(
        "users", sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_users_created_by",
        "users",
        "users",
        ["created_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Drop RBAC tables and columns."""

    # Drop foreign key from users
    op.drop_constraint("fk_users_created_by", "users", type_="foreignkey")

    # Drop columns from users table
    op.drop_column("users", "created_by")
    op.drop_column("users", "locale")
    op.drop_column("users", "timezone")
    op.drop_column("users", "bio")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "password_reset_expires")
    op.drop_column("users", "password_reset_token")
    op.drop_column("users", "password_changed_at")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")
    op.drop_column("users", "mfa_secret")
    op.drop_column("users", "mfa_enabled")
    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "email_verified")
    op.drop_column("users", "preferences")

    # Drop role_templates table
    op.drop_index(op.f("ix_role_templates_system"), table_name="role_templates")
    op.drop_index(op.f("ix_role_templates_scope"), table_name="role_templates")
    op.drop_index(op.f("ix_role_templates_category"), table_name="role_templates")
    op.drop_constraint(
        "uq_role_templates_name", table_name="role_templates", type_="unique"
    )
    op.drop_constraint(
        "uq_role_templates_code", table_name="role_templates", type_="unique"
    )
    op.drop_table("role_templates")

    # Drop resource_permissions table
    op.drop_index(
        op.f("ix_resource_permissions_user"), table_name="resource_permissions"
    )
    op.drop_index(
        op.f("ix_resource_permissions_resource"), table_name="resource_permissions"
    )
    op.drop_index(
        op.f("ix_resource_permissions_permission"), table_name="resource_permissions"
    )
    op.drop_index(
        op.f("ix_resource_permissions_granted"), table_name="resource_permissions"
    )
    op.drop_index(
        op.f("ix_resource_permissions_expires"), table_name="resource_permissions"
    )
    op.drop_constraint(
        "uq_resource_permission", table_name="resource_permissions", type_="unique"
    )
    op.drop_table("resource_permissions")

    # Drop user_role_assignments table
    op.drop_index(
        op.f("ix_user_role_assignments_user"), table_name="user_role_assignments"
    )
    op.drop_index(
        op.f("ix_user_role_assignments_role"), table_name="user_role_assignments"
    )
    op.drop_index(
        op.f("ix_user_role_assignments_project"), table_name="user_role_assignments"
    )
    op.drop_index(
        op.f("ix_user_role_assignments_org"), table_name="user_role_assignments"
    )
    op.drop_index(
        op.f("ix_user_role_assignments_expires"), table_name="user_role_assignments"
    )
    op.drop_index(
        op.f("ix_user_role_assignments_active"), table_name="user_role_assignments"
    )
    op.drop_constraint(
        "uq_user_role_assignment", table_name="user_role_assignments", type_="unique"
    )
    op.drop_table("user_role_assignments")

    # Drop role_permissions table
    op.drop_index(op.f("ix_role_permissions_role"), table_name="role_permissions")
    op.drop_index(op.f("ix_role_permissions_permission"), table_name="role_permissions")
    op.drop_table("role_permissions")

    # Drop roles table
    op.drop_index(op.f("ix_roles_system"), table_name="roles")
    op.drop_index(op.f("ix_roles_organization"), table_name="roles")
    op.drop_index(op.f("ix_roles_level"), table_name="roles")
    op.drop_index(op.f("ix_roles_active"), table_name="roles")
    op.drop_constraint("uq_roles_org_code", table_name="roles", type_="unique")
    op.drop_constraint("uq_roles_system_code", table_name="roles", type_="unique")
    op.drop_table("roles")

    # Drop permissions table
    op.drop_index(op.f("ix_permissions_scope"), table_name="permissions")
    op.drop_index(op.f("ix_permissions_resource_type"), table_name="permissions")
    op.drop_index(op.f("ix_permissions_category"), table_name="permissions")
    op.drop_index(op.f("ix_permissions_action"), table_name="permissions")
    op.drop_constraint("uq_permissions_code", table_name="permissions", type_="unique")
    op.drop_table("permissions")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS resourcetype")
    op.execute("DROP TYPE IF EXISTS permissionscope")
