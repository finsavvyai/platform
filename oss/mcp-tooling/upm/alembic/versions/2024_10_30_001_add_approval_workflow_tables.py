"""Add approval workflow tables

Revision ID: 2024_10_30_001
Revises: 2024_10_24_001_add_core_models
Create Date: 2024-10-30 14:30:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2024_10_30_001"
down_revision = "2024_10_24_001_add_core_models"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create approval workflow tables."""

    # Create approval_workflows table
    op.create_table(
        "approval_workflows",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("workflow_type", sa.String(length=100), nullable=False),
        sa.Column("request_type", sa.String(length=100), nullable=False),
        sa.Column(
            "request_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_role", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("current_step", sa.String(length=100), nullable=False),
        sa.Column(
            "approval_requirements",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "approval_workflow", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "current_approvers", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "approver_roles", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "stakeholder_hierarchy",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "stakeholder_responses",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("sla_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sla_status", sa.String(length=50), nullable=False),
        sa.Column("escalation_level", sa.Integer(), nullable=False),
        sa.Column(
            "escalation_policies",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "escalation_history",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("final_decision", sa.String(length=50), nullable=True),
        sa.Column("decision_rationale", sa.Text(), nullable=True),
        sa.Column("decision_confidence", sa.Integer(), nullable=True),
        sa.Column(
            "audit_trail", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
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
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "status IN ('pending', 'in_progress', 'waiting_for_approval', 'approved', 'rejected', 'completed', 'failed', 'cancelled')",
            name="check_approval_workflow_status",
        ),
        sa.CheckConstraint(
            "sla_status IN ('on_time', 'at_risk', 'overdue')", name="check_sla_status"
        ),
        sa.CheckConstraint(
            "escalation_level >= 0", name="check_escalation_level_positive"
        ),
    )

    # Create indexes for approval_workflows
    op.create_index(
        op.f("ix_approval_workflows_id"), "approval_workflows", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_approval_workflows_organization_id"),
        "approval_workflows",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_workflows_project_id"),
        "approval_workflows",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_workflows_request_type"),
        "approval_workflows",
        ["request_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_workflows_status"),
        "approval_workflows",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_workflows_requester_id"),
        "approval_workflows",
        ["requester_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_workflows_sla_deadline"),
        "approval_workflows",
        ["sla_deadline"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_workflows_completed_at"),
        "approval_workflows",
        ["completed_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_workflows_created_at"),
        "approval_workflows",
        ["created_at"],
        unique=False,
    )

    # Create composite indexes
    op.create_index(
        "idx_approval_workflow_org_status",
        "approval_workflows",
        ["organization_id", "status"],
        unique=False,
    )
    op.create_index(
        "idx_approval_workflow_requester",
        "approval_workflows",
        ["requester_id", "status"],
        unique=False,
    )
    op.create_index(
        "idx_approval_workflow_sla",
        "approval_workflows",
        ["sla_deadline", "sla_status"],
        unique=False,
    )
    op.create_index(
        "idx_approval_workflow_type_status",
        "approval_workflows",
        ["request_type", "status"],
        unique=False,
    )

    # Create approval_requirements table
    op.create_table(
        "approval_requirements",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approver_role", sa.String(length=100), nullable=False),
        sa.Column("approver_email", sa.String(length=255), nullable=True),
        sa.Column("approver_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approval_type", sa.String(length=100), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("approval_status", sa.String(length=50), nullable=False),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("escalation_count", sa.Integer(), nullable=False),
        sa.Column("last_escalated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "escalation_policy", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "stakeholder_hierarchy",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("context", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "dependencies", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "auto_approval_conditions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "rejection_conditions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
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
            ["workflow_id"], ["approval_workflows.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "approval_status IN ('pending', 'approved', 'rejected', 'conditional', 'delegated', 'escalated', 'expired', 'cancelled')",
            name="check_approval_requirement_status",
        ),
        sa.CheckConstraint(
            "escalation_count >= 0", name="check_escalation_count_positive"
        ),
    )

    # Create indexes for approval_requirements
    op.create_index(
        op.f("ix_approval_requirements_id"),
        "approval_requirements",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_requirements_workflow_id"),
        "approval_requirements",
        ["workflow_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_requirements_approver_role"),
        "approval_requirements",
        ["approver_role"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_requirements_approver_user_id"),
        "approval_requirements",
        ["approver_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_requirements_approval_status"),
        "approval_requirements",
        ["approval_status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_requirements_priority"),
        "approval_requirements",
        ["priority"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_requirements_deadline"),
        "approval_requirements",
        ["deadline"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_requirements_approved_by"),
        "approval_requirements",
        ["approved_by"],
        unique=False,
    )

    # Create composite indexes
    op.create_index(
        "idx_approval_requirement_workflow_status",
        "approval_requirements",
        ["workflow_id", "approval_status"],
        unique=False,
    )
    op.create_index(
        "idx_approval_requirement_role_status",
        "approval_requirements",
        ["approver_role", "approval_status"],
        unique=False,
    )

    # Create approval_responses table
    op.create_table(
        "approval_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requirement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approver_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approver_email", sa.String(length=255), nullable=False),
        sa.Column("approver_role", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column(
            "conditions", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "risk_assessment", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "alternative_suggestions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("confidence_level", sa.String(length=50), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("session_id", sa.String(length=100), nullable=True),
        sa.Column("digital_signature", sa.Text(), nullable=True),
        sa.Column(
            "responded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(
            ["requirement_id"], ["approval_requirements.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["workflow_id"], ["approval_workflows.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "status IN ('approved', 'rejected', 'conditional', 'delegated', 'escalated')",
            name="check_approval_response_status",
        ),
        sa.CheckConstraint(
            "confidence_level IN ('low', 'medium', 'high') OR confidence_level IS NULL",
            name="check_confidence_level",
        ),
    )

    # Create indexes for approval_responses
    op.create_index(
        op.f("ix_approval_responses_id"), "approval_responses", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_approval_responses_requirement_id"),
        "approval_responses",
        ["requirement_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_responses_workflow_id"),
        "approval_responses",
        ["workflow_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_responses_approver_id"),
        "approval_responses",
        ["approver_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_responses_approver_role"),
        "approval_responses",
        ["approver_role"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_responses_status"),
        "approval_responses",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_responses_responded_at"),
        "approval_responses",
        ["responded_at"],
        unique=False,
    )

    # Create composite indexes
    op.create_index(
        "idx_approval_response_requirement",
        "approval_responses",
        ["requirement_id", "status"],
        unique=False,
    )
    op.create_index(
        "idx_approval_response_approver",
        "approval_responses",
        ["approver_id", "responded_at"],
        unique=False,
    )
    op.create_index(
        "idx_approval_response_workflow",
        "approval_responses",
        ["workflow_id", "status"],
        unique=False,
    )
    op.create_index(
        "idx_approval_response_timestamp",
        "approval_responses",
        ["responded_at"],
        unique=False,
    )

    # Create approval_audit_logs table
    op.create_table(
        "approval_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column(
            "event_timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "event_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_role", sa.String(length=100), nullable=True),
        sa.Column("actor_email", sa.String(length=255), nullable=True),
        sa.Column(
            "previous_state", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column("new_state", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("session_id", sa.String(length=100), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(
            ["workflow_id"], ["approval_workflows.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for approval_audit_logs
    op.create_index(
        op.f("ix_approval_audit_logs_id"), "approval_audit_logs", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_approval_audit_logs_workflow_id"),
        "approval_audit_logs",
        ["workflow_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_audit_logs_event_type"),
        "approval_audit_logs",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_audit_logs_event_timestamp"),
        "approval_audit_logs",
        ["event_timestamp"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_audit_logs_actor_id"),
        "approval_audit_logs",
        ["actor_id"],
        unique=False,
    )

    # Create composite indexes
    op.create_index(
        "idx_approval_audit_workflow_event",
        "approval_audit_logs",
        ["workflow_id", "event_type"],
        unique=False,
    )
    op.create_index(
        "idx_approval_audit_timestamp",
        "approval_audit_logs",
        ["event_timestamp"],
        unique=False,
    )
    op.create_index(
        "idx_approval_audit_actor",
        "approval_audit_logs",
        ["actor_id", "event_timestamp"],
        unique=False,
    )
    op.create_index(
        "idx_approval_audit_event_type",
        "approval_audit_logs",
        ["event_type", "event_timestamp"],
        unique=False,
    )

    # Create approval_templates table
    op.create_table(
        "approval_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("request_type", sa.String(length=100), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_global", sa.Boolean(), nullable=False),
        sa.Column(
            "approval_stages", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "stakeholder_configuration",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "escalation_policies",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "sla_configuration", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "auto_approval_conditions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "routing_rules", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "validation_rules", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
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
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for approval_templates
    op.create_index(
        op.f("ix_approval_templates_id"), "approval_templates", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_approval_templates_name"), "approval_templates", ["name"], unique=False
    )
    op.create_index(
        op.f("ix_approval_templates_request_type"),
        "approval_templates",
        ["request_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_templates_organization_id"),
        "approval_templates",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_templates_is_global"),
        "approval_templates",
        ["is_global"],
        unique=False,
    )
    op.create_index(
        op.f("ix_approval_templates_is_active"),
        "approval_templates",
        ["is_active"],
        unique=False,
    )

    # Create composite indexes
    op.create_index(
        "idx_approval_template_org_type",
        "approval_templates",
        ["organization_id", "request_type"],
        unique=False,
    )
    op.create_index(
        "idx_approval_template_active",
        "approval_templates",
        ["is_active", "request_type"],
        unique=False,
    )

    # Create trigger for updated_at columns
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    """)

    # Create triggers for each table
    op.execute("""
        CREATE TRIGGER update_approval_workflows_updated_at
            BEFORE UPDATE ON approval_workflows
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    """)

    op.execute("""
        CREATE TRIGGER update_approval_requirements_updated_at
            BEFORE UPDATE ON approval_requirements
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    """)

    op.execute("""
        CREATE TRIGGER update_approval_templates_updated_at
            BEFORE UPDATE ON approval_templates
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    """)


def downgrade() -> None:
    """Drop approval workflow tables."""

    # Drop triggers
    op.execute(
        "DROP TRIGGER IF EXISTS update_approval_workflows_updated_at ON approval_workflows"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS update_approval_requirements_updated_at ON approval_requirements"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS update_approval_templates_updated_at ON approval_templates"
    )

    # Drop tables
    op.drop_table("approval_templates")
    op.drop_table("approval_audit_logs")
    op.drop_table("approval_responses")
    op.drop_table("approval_requirements")
    op.drop_table("approval_workflows")

    # Drop function
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")
