"""Create SBOM (Software Bill of Materials) tables

Revision ID: 2025_10_30_000001
Revises: 2025_01_30_000002
Create Date: 2025-10-30 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2025_10_30_000001"
down_revision = "2025_01_30_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create SBOM and related tables for comprehensive SBOM management."""

    # Create analysis table if it doesn't exist
    # Note: This might already exist from previous migrations
    op.create_table(
        "analysiss",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, default=False),
        sa.Column("metadata", sa.JSON(), nullable=True, default=dict),
        # Analysis identification
        sa.Column(
            "analysis_id",
            sa.String(length=100),
            nullable=False,
            comment="Unique analysis identifier",
        ),
        sa.Column(
            "name",
            sa.String(length=255),
            nullable=False,
            comment="Analysis name/description",
        ),
        sa.Column(
            "analysis_type",
            sa.String(length=50),
            nullable=False,
            index=True,
            comment="Type of analysis performed",
        ),
        # Target information
        sa.Column(
            "target_type",
            sa.String(length=50),
            nullable=False,
            index=True,
            comment="Type of target",
        ),
        sa.Column(
            "target_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            index=True,
            comment="ID of target entity",
        ),
        sa.Column(
            "target_version",
            sa.String(length=50),
            nullable=True,
            comment="Version/branch being analyzed",
        ),
        # Execution details
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            default="pending",
            comment="Analysis execution status",
        ),
        sa.Column(
            "started_at",
            sa.String(length=50),
            nullable=True,
            comment="When analysis started",
        ),
        sa.Column(
            "completed_at",
            sa.String(length=50),
            nullable=True,
            comment="When analysis completed",
        ),
        sa.Column(
            "duration_seconds",
            sa.Float(),
            nullable=True,
            comment="Analysis duration in seconds",
        ),
        # Analysis configuration
        sa.Column(
            "config",
            sa.JSON(),
            nullable=True,
            default=dict,
            comment="Analysis configuration and parameters",
        ),
        sa.Column(
            "scanner_version",
            sa.String(length=50),
            nullable=True,
            comment="Version of scanner/tool used",
        ),
        # Results summary
        sa.Column(
            "total_issues",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Total number of issues found",
        ),
        sa.Column(
            "critical_issues",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Number of critical issues",
        ),
        sa.Column(
            "high_issues",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Number of high severity issues",
        ),
        sa.Column(
            "medium_issues",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Number of medium severity issues",
        ),
        sa.Column(
            "low_issues",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Number of low severity issues",
        ),
        # Metadata and context
        sa.Column(
            "context",
            sa.JSON(),
            nullable=True,
            default=dict,
            comment="Additional context",
        ),
        sa.Column(
            "tags",
            sa.JSON(),
            nullable=True,
            default=list,
            comment="Tags for categorization",
        ),
        # Error information
        sa.Column(
            "error_message",
            sa.Text(),
            nullable=True,
            comment="Error message if analysis failed",
        ),
        sa.Column(
            "error_stacktrace", sa.Text(), nullable=True, comment="Error stacktrace"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("analysis_id"),
        comment="Analysis execution records",
    )

    # Create indexes for analysis table
    op.create_index(
        "idx_analysis_type_status",
        "analysiss",
        ["analysis_type", "status"],
        unique=False,
    )
    op.create_index(
        "idx_analysis_target_id",
        "analysiss",
        ["target_type", "target_id"],
        unique=False,
    )
    op.create_index(
        "idx_analysis_created_at",
        "analysiss",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "idx_analysis_severity_counts",
        "analysiss",
        ["critical_issues", "high_issues"],
        unique=False,
    )

    # Create analysis_results table
    op.create_table(
        "analysis_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, default=False),
        sa.Column("metadata", sa.JSON(), nullable=True, default=dict),
        # Result identification
        sa.Column(
            "result_id",
            sa.String(length=100),
            nullable=False,
            comment="Unique result identifier",
        ),
        sa.Column(
            "analysis_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            index=True,
            comment="Parent analysis ID",
        ),
        # Issue details
        sa.Column(
            "issue_type",
            sa.String(length=100),
            nullable=False,
            index=True,
            comment="Type of issue",
        ),
        sa.Column(
            "severity",
            sa.String(length=50),
            nullable=False,
            index=True,
            comment="Issue severity level",
        ),
        sa.Column(
            "confidence",
            sa.String(length=50),
            nullable=True,
            comment="Confidence level",
        ),
        # Description and details
        sa.Column(
            "title", sa.String(length=500), nullable=False, comment="Issue title"
        ),
        sa.Column(
            "description", sa.Text(), nullable=True, comment="Detailed description"
        ),
        # Location information
        sa.Column(
            "file_path",
            sa.String(length=1000),
            nullable=True,
            index=True,
            comment="File path",
        ),
        sa.Column("line_number", sa.Integer(), nullable=True, comment="Line number"),
        sa.Column("start_line", sa.Integer(), nullable=True, comment="Start line"),
        sa.Column("end_line", sa.Integer(), nullable=True, comment="End line"),
        # Component information
        sa.Column(
            "component_name",
            sa.String(length=255),
            nullable=True,
            index=True,
            comment="Component name",
        ),
        sa.Column(
            "component_version",
            sa.String(length=100),
            nullable=True,
            comment="Component version",
        ),
        sa.Column(
            "component_type",
            sa.String(length=50),
            nullable=True,
            comment="Component type",
        ),
        # Issue metadata
        sa.Column(
            "cve_id",
            sa.String(length=50),
            nullable=True,
            index=True,
            comment="CVE identifier",
        ),
        sa.Column(
            "cwe_id", sa.String(length=50), nullable=True, comment="CWE identifier"
        ),
        sa.Column(
            "owasp_category",
            sa.String(length=100),
            nullable=True,
            comment="OWASP category",
        ),
        # Recommendations and fixes
        sa.Column(
            "recommendation",
            sa.Text(),
            nullable=True,
            comment="Recommendation for fixing",
        ),
        sa.Column(
            "fix_available",
            sa.Boolean(),
            nullable=False,
            default=False,
            comment="Fix available",
        ),
        sa.Column(
            "fixed_version",
            sa.String(length=100),
            nullable=True,
            comment="Version that fixes issue",
        ),
        # External references
        sa.Column(
            "references",
            sa.JSON(),
            nullable=True,
            default=list,
            comment="External references",
        ),
        # Additional data
        sa.Column(
            "result_metadata",
            sa.JSON(),
            nullable=True,
            default=dict,
            comment="Additional metadata",
        ),
        # Status tracking
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            default="open",
            comment="Issue status",
        ),
        sa.Column(
            "assigned_to",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Assigned user",
        ),
        sa.Column(
            "resolution", sa.Text(), nullable=True, comment="Resolution description"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("result_id"),
        sa.ForeignKeyConstraint(["analysis_id"], ["analysiss.id"], ondelete="CASCADE"),
        comment="Detailed analysis results",
    )

    # Create indexes for analysis_results table
    op.create_index(
        "idx_analysis_results_severity",
        "analysis_results",
        ["severity", "status"],
        unique=False,
    )
    op.create_index(
        "idx_analysis_results_component",
        "analysis_results",
        ["component_name", "component_version"],
        unique=False,
    )
    op.create_index(
        "idx_analysis_results_cve",
        "analysis_results",
        ["cve_id"],
        unique=False,
    )
    op.create_index(
        "idx_analysis_results_file",
        "analysis_results",
        ["file_path", "line_number"],
        unique=False,
    )

    # Create sboms table
    op.create_table(
        "sboms",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, default=False),
        sa.Column("metadata", sa.JSON(), nullable=True, default=dict),
        # SBOM identification
        sa.Column(
            "sbom_id",
            sa.String(length=100),
            nullable=False,
            comment="Unique SBOM identifier",
        ),
        sa.Column(
            "format",
            sa.String(length=50),
            nullable=False,
            index=True,
            comment="SBOM format",
        ),
        sa.Column(
            "version",
            sa.String(length=20),
            nullable=False,
            comment="SBOM format version",
        ),
        # Target information
        sa.Column(
            "target_type",
            sa.String(length=50),
            nullable=False,
            index=True,
            comment="Target type",
        ),
        sa.Column(
            "target_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            index=True,
            comment="Target ID",
        ),
        sa.Column(
            "target_name", sa.String(length=255), nullable=True, comment="Target name"
        ),
        # SBOM content
        sa.Column("sbom_data", sa.JSON(), nullable=False, comment="Parsed SBOM data"),
        sa.Column("raw_content", sa.Text(), nullable=True, comment="Raw SBOM content"),
        # Component counts
        sa.Column(
            "total_components",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Total number of components",
        ),
        sa.Column(
            "direct_dependencies",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Number of direct dependencies",
        ),
        sa.Column(
            "transitive_dependencies",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Number of transitive dependencies",
        ),
        # Generation metadata
        sa.Column(
            "generated_at",
            sa.String(length=50),
            nullable=False,
            default=sa.text("now()::text"),
            comment="When SBOM was generated",
        ),
        sa.Column(
            "generator",
            sa.String(length=255),
            nullable=True,
            comment="Tool that generated SBOM",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sbom_id"),
        comment="Software Bill of Materials records",
    )

    # Create indexes for sboms table
    op.create_index(
        "idx_sbom_target_id",
        "sboms",
        ["target_type", "target_id"],
        unique=False,
    )
    op.create_index(
        "idx_sbom_format_version",
        "sboms",
        ["format", "version"],
        unique=False,
    )
    op.create_index(
        "idx_sbom_generated_at",
        "sboms",
        ["generated_at"],
        unique=False,
    )

    # Create sbom_comparisons table for tracking comparison history
    op.create_table(
        "sbom_comparisons",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, default=False),
        sa.Column("metadata", sa.JSON(), nullable=True, default=dict),
        # Comparison identification
        sa.Column(
            "comparison_id",
            sa.String(length=100),
            nullable=False,
            comment="Unique comparison ID",
        ),
        # SBOMs being compared
        sa.Column(
            "sbom1_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="First SBOM ID",
        ),
        sa.Column(
            "sbom2_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Second SBOM ID",
        ),
        # Comparison results
        sa.Column(
            "total_changes",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Total changes",
        ),
        sa.Column(
            "added_components",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Added components",
        ),
        sa.Column(
            "removed_components",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Removed components",
        ),
        sa.Column(
            "modified_components",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Modified components",
        ),
        sa.Column(
            "version_changes",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="Version changes",
        ),
        sa.Column(
            "license_changes",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="License changes",
        ),
        # Detailed comparison data
        sa.Column(
            "comparison_data",
            sa.JSON(),
            nullable=True,
            comment="Detailed comparison results",
        ),
        # Risk assessment
        sa.Column(
            "risk_score", sa.Float(), nullable=True, comment="Risk assessment score"
        ),
        sa.Column(
            "risk_level", sa.String(length=50), nullable=True, comment="Risk level"
        ),
        # Analysis settings
        sa.Column(
            "deep_analysis",
            sa.Boolean(),
            nullable=False,
            default=True,
            comment="Whether deep analysis was performed",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("comparison_id"),
        sa.ForeignKeyConstraint(["sbom1_id"], ["sboms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sbom2_id"], ["sboms.id"], ondelete="CASCADE"),
        comment="SBOM comparison history and results",
    )

    # Create indexes for sbom_comparisons table
    op.create_index(
        "idx_sbom_comparisons_sboms",
        "sbom_comparisons",
        ["sbom1_id", "sbom2_id"],
        unique=False,
    )
    op.create_index(
        "idx_sbom_comparisons_risk",
        "sbom_comparisons",
        ["risk_level", "risk_score"],
        unique=False,
    )


def downgrade() -> None:
    """Remove SBOM and related tables."""

    # Drop tables in reverse order of creation
    op.drop_table("sbom_comparisons")
    op.drop_table("sboms")
    op.drop_table("analysis_results")
    op.drop_table("analysiss")
