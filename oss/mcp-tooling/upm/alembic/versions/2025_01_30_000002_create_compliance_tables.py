"""Create compliance framework tables

Revision ID: 2025_01_30_000002
Revises: 220840b8ae8d
Create Date: 2025-01-30 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2025_01_30_000002"
down_revision = "220840b8ae8d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create compliance_rules table
    op.create_table(
        "compliance_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False, comment="Rule name"),
        sa.Column("description", sa.Text(), nullable=True, comment="Rule description"),
        sa.Column(
            "rule_type", sa.String(length=50), nullable=False, comment="Type of rule"
        ),
        sa.Column(
            "conditions", sa.JSON(), nullable=False, comment="Rule conditions and logic"
        ),
        sa.Column(
            "actions",
            sa.JSON(),
            nullable=True,
            comment="Actions to take when rule is violated",
        ),
        sa.Column(
            "severity",
            sa.String(length=50),
            nullable=False,
            comment="Violation severity",
        ),
        sa.Column(
            "priority",
            sa.Integer(),
            nullable=False,
            default=50,
            comment="Rule priority (1-100)",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            default=True,
            comment="Whether rule is active",
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Organization scope",
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Project scope",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        comment="Compliance rule definitions",
    )
    op.create_index(
        "idx_compliance_rules_type_active",
        "compliance_rules",
        ["rule_type", "is_active"],
        unique=False,
    )
    op.create_index(
        "idx_compliance_rules_org_project",
        "compliance_rules",
        ["organization_id", "project_id"],
        unique=False,
    )
    op.create_index(
        "idx_compliance_rules_severity_priority",
        "compliance_rules",
        ["severity", "priority"],
        unique=False,
    )
    op.create_index(
        "idx_compliance_rules_name", "compliance_rules", ["name"], unique=False
    )

    # Create compliance_checks table
    op.create_table(
        "compliance_checks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "check_id",
            sa.String(length=100),
            nullable=False,
            comment="Unique check identifier",
        ),
        sa.Column(
            "rule_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Compliance rule being checked",
        ),
        sa.Column(
            "target_type",
            sa.String(length=50),
            nullable=False,
            comment="Type of target",
        ),
        sa.Column(
            "target_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="ID of target entity",
        ),
        sa.Column(
            "target_name",
            sa.String(length=255),
            nullable=True,
            comment="Human-readable target name",
        ),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            default="pending",
            comment="Compliance status",
        ),
        sa.Column(
            "violation_details",
            sa.JSON(),
            nullable=True,
            comment="Details of any violations",
        ),
        sa.Column(
            "violation_count",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Number of violations found",
        ),
        sa.Column(
            "context",
            sa.JSON(),
            nullable=True,
            comment="Additional context for the check",
        ),
        sa.Column(
            "check_metadata",
            sa.JSON(),
            nullable=True,
            comment="Metadata about the check execution",
        ),
        sa.Column(
            "scan_id",
            sa.String(length=100),
            nullable=True,
            comment="ID of the scan that triggered this check",
        ),
        sa.Column(
            "remediation_steps",
            sa.JSON(),
            nullable=True,
            comment="Recommended remediation steps",
        ),
        sa.Column(
            "auto_fixable",
            sa.Boolean(),
            nullable=False,
            default=False,
            comment="Whether violation can be auto-fixed",
        ),
        sa.ForeignKeyConstraint(
            ["rule_id"],
            ["compliance_rules.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        comment="Individual compliance check execution records",
    )
    op.create_index(
        "idx_compliance_checks_status",
        "compliance_checks",
        ["status", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_compliance_checks_rule_target",
        "compliance_checks",
        ["rule_id", "target_type", "target_id"],
        unique=False,
    )
    op.create_index(
        "idx_compliance_checks_scan",
        "compliance_checks",
        ["scan_id", "status"],
        unique=False,
    )
    op.create_index(
        "idx_compliance_checks_check_id", "compliance_checks", ["check_id"], unique=True
    )

    # Create compliance_reports table
    op.create_table(
        "compliance_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "report_id",
            sa.String(length=100),
            nullable=False,
            comment="Unique report identifier",
        ),
        sa.Column(
            "report_type", sa.String(length=50), nullable=False, comment="Report type"
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Organization scope",
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Project scope",
        ),
        sa.Column(
            "total_checks",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Total number of checks",
        ),
        sa.Column(
            "compliant_checks",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Number of compliant checks",
        ),
        sa.Column(
            "non_compliant_checks",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Number of non-compliant checks",
        ),
        sa.Column(
            "exempted_checks",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Number of exempted checks",
        ),
        sa.Column(
            "waived_checks",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Number of waived checks",
        ),
        sa.Column(
            "compliance_score",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Overall compliance score (0-100)",
        ),
        sa.Column(
            "report_data",
            sa.JSON(),
            nullable=True,
            comment="Detailed report data and charts",
        ),
        sa.Column(
            "recommendations",
            sa.JSON(),
            nullable=True,
            comment="Compliance improvement recommendations",
        ),
        sa.Column(
            "generated_by",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="User who generated the report",
        ),
        sa.Column(
            "generated_at",
            sa.String(length=50),
            nullable=False,
            comment="When report was generated",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        comment="Compliance report aggregating multiple checks",
    )
    op.create_index(
        "idx_compliance_reports_org_project",
        "compliance_reports",
        ["organization_id", "project_id"],
        unique=False,
    )
    op.create_index(
        "idx_compliance_reports_type_date",
        "compliance_reports",
        ["report_type", "generated_at"],
        unique=False,
    )
    op.create_index(
        "idx_compliance_reports_score",
        "compliance_reports",
        ["compliance_score"],
        unique=False,
    )
    op.create_index(
        "idx_compliance_reports_report_id",
        "compliance_reports",
        ["report_id"],
        unique=True,
    )

    # Add custom frameworks support to organizations settings
    op.execute("""
        ALTER TABLE organizations
        ALTER COLUMN settings TYPE JSONB USING settings::JSONB,
        ALTER COLUMN settings SET DEFAULT '{}',
        ALTER COLUMN settings SET NOT NULL
    """)

    # Create custom_frameworks table for storing custom compliance frameworks
    op.create_table(
        "custom_frameworks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "name", sa.String(length=255), nullable=False, comment="Framework name"
        ),
        sa.Column(
            "description", sa.Text(), nullable=True, comment="Framework description"
        ),
        sa.Column(
            "version",
            sa.String(length=50),
            nullable=False,
            default="1.0",
            comment="Framework version",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            default=True,
            comment="Whether framework is active",
        ),
        sa.Column(
            "rules", sa.JSON(), nullable=False, comment="Framework rules definition"
        ),
        sa.Column(
            "metadata",
            sa.JSON(),
            nullable=True,
            comment="Additional framework metadata",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        comment="Custom compliance frameworks",
    )
    op.create_index(
        "idx_custom_frameworks_org_active",
        "custom_frameworks",
        ["organization_id", "is_active"],
        unique=False,
    )
    op.create_index(
        "idx_custom_frameworks_name", "custom_frameworks", ["name"], unique=False
    )

    # Create compliance_violations table for tracking violations separately
    op.create_table(
        "compliance_violations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "violation_id",
            sa.String(length=100),
            nullable=False,
            comment="Unique violation identifier",
        ),
        sa.Column(
            "rule_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Violated rule ID",
        ),
        sa.Column(
            "framework",
            sa.String(length=50),
            nullable=False,
            comment="Associated compliance framework",
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "violation_type",
            sa.String(length=100),
            nullable=False,
            comment="Type of violation",
        ),
        sa.Column(
            "title", sa.String(length=500), nullable=False, comment="Violation title"
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=False,
            comment="Detailed violation description",
        ),
        sa.Column(
            "severity",
            sa.String(length=50),
            nullable=False,
            comment="Violation severity",
        ),
        sa.Column(
            "affected_packages",
            sa.JSON(),
            nullable=True,
            comment="Affected package names",
        ),
        sa.Column(
            "affected_resources", sa.JSON(), nullable=True, comment="Affected resources"
        ),
        sa.Column(
            "violation_context",
            sa.JSON(),
            nullable=True,
            comment="Violation context data",
        ),
        sa.Column(
            "detected_at",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="Detection timestamp",
        ),
        sa.Column(
            "detected_by",
            sa.String(length=100),
            nullable=False,
            comment="Detection source/system",
        ),
        sa.Column(
            "detection_method",
            sa.String(length=100),
            nullable=False,
            comment="Detection method",
        ),
        sa.Column(
            "remediation_status",
            sa.String(length=50),
            nullable=False,
            default="open",
            comment="Remediation status",
        ),
        sa.Column(
            "remediation_plan", sa.Text(), nullable=True, comment="Remediation plan"
        ),
        sa.Column(
            "remediation_deadline",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Remediation deadline",
        ),
        sa.Column(
            "remediation_assigned_to",
            sa.String(length=255),
            nullable=True,
            comment="Assigned remediation owner",
        ),
        sa.Column(
            "remediation_completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Remediation completion time",
        ),
        sa.Column(
            "risk_score",
            sa.Numeric(precision=5, scale=2),
            nullable=False,
            default=0.0,
            comment="Risk score",
        ),
        sa.Column(
            "business_impact",
            sa.String(length=50),
            nullable=False,
            default="medium",
            comment="Business impact level",
        ),
        sa.Column(
            "likelihood",
            sa.String(length=50),
            nullable=False,
            default="medium",
            comment="Likelihood of exploitation",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["rule_id"],
            ["compliance_rules.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        comment="Compliance violation records",
    )
    op.create_index(
        "idx_compliance_violations_org_framework",
        "compliance_violations",
        ["organization_id", "framework"],
        unique=False,
    )
    op.create_index(
        "idx_compliance_violations_severity",
        "compliance_violations",
        ["severity"],
        unique=False,
    )
    op.create_index(
        "idx_compliance_violations_status",
        "compliance_violations",
        ["remediation_status"],
        unique=False,
    )
    op.create_index(
        "idx_compliance_violations_detected",
        "compliance_violations",
        ["detected_at"],
        unique=False,
    )
    op.create_index(
        "idx_compliance_violations_violation_id",
        "compliance_violations",
        ["violation_id"],
        unique=True,
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("compliance_violations")
    op.drop_table("custom_frameworks")
    op.drop_table("compliance_reports")
    op.drop_table("compliance_checks")
    op.drop_table("compliance_rules")

    # Revert organizations settings column type
    op.execute("""
        ALTER TABLE organizations
        ALTER COLUMN settings TYPE JSONB USING settings::JSONB
    """)
