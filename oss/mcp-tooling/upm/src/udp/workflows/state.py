"""
Workflow state management for LangGraph workflows.

Defines TypedDict state classes for workflow orchestration
and state persistence across workflow steps.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional, TypedDict
from uuid import UUID

from udp.domain.models import (
    AIRecommendation,
    DependencyGraph,
    EcosystemType,
    Package,
    PolicyViolation,
    SecurityLevel,
    Vulnerability,
    WorkflowStatus,
)


class WorkflowStepStatus(str, Enum):
    """Status of individual workflow steps."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class UniversalPackageIdentifier(TypedDict):
    """Universal package identifier across all ecosystems."""

    ecosystem: EcosystemType
    namespace: Optional[str]
    name: str
    version: str
    registry_key: str  # Format: ecosystem:namespace/name@version


class CrossLanguageDependency(TypedDict):
    """Cross-language dependency relationship."""

    source_package: UniversalPackageIdentifier
    target_package: UniversalPackageIdentifier
    relationship_type: str  # "runtime", "build", "bridge", "interop"
    bridge_mechanism: Optional[str]  # "ffi", "wasm", "rest", "grpc"
    compatibility_score: float
    metadata: dict[str, Any]


class PolyglotProjectState(TypedDict):
    """State for polyglot project management."""

    project_languages: list[EcosystemType]
    manifest_files: dict[EcosystemType, list[str]]
    cross_language_dependencies: list[CrossLanguageDependency]
    language_bridges: dict[str, dict[str, Any]]
    universal_lockfile: Optional[dict[str, Any]]
    polyglot_conflicts: list[dict[str, Any]]
    interop_requirements: list[dict[str, Any]]


class WorkflowState(TypedDict):
    """Base workflow state interface with Universal Package Manager support."""

    # Workflow identification
    workflow_id: str
    workflow_type: str
    organization_id: UUID
    project_id: Optional[str]

    # Workflow execution
    status: WorkflowStatus
    current_step: str
    started_at: datetime
    completed_at: Optional[datetime]

    # Error handling
    error_message: Optional[str]
    retry_count: int
    max_retries: int

    # Audit and logging
    audit_log: list[dict[str, Any]]
    performance_metrics: dict[str, Any]

    # Human-in-the-loop
    requires_human_approval: bool
    approval_requests: list[dict[str, Any]]
    approval_responses: list[dict[str, Any]]

    # Universal Package Manager Core
    polyglot_project: Optional[PolyglotProjectState]
    universal_packages: list[UniversalPackageIdentifier]
    cross_ecosystem_resolution: dict[str, Any]
    universal_audit_trail: list[dict[str, Any]]

    # Workflow metadata
    metadata: dict[str, Any]


class DependencyAnalysisState(WorkflowState):
    """State for dependency analysis workflow with Universal Package Manager support."""

    # Input data
    manifest_files: list[str]
    ecosystem_types: list[EcosystemType]
    analysis_options: dict[str, Any]

    # Universal Package Manager Analysis
    polyglot_manifests: dict[EcosystemType, dict[str, Any]]
    cross_ecosystem_dependencies: list[CrossLanguageDependency]
    universal_dependency_graph: Optional[dict[str, Any]]
    ecosystem_compatibility_matrix: dict[str, dict[str, float]]

    # Analysis results
    parsed_manifests: dict[str, Any]
    dependency_graphs: list[DependencyGraph]
    resolved_packages: list[Package]

    # Security analysis
    vulnerabilities: list[Vulnerability]
    security_scan_results: dict[str, Any]
    risk_assessment: dict[str, Any]

    # License analysis
    license_analysis: dict[str, Any]
    license_violations: list[PolicyViolation]

    # Policy evaluation
    policy_evaluations: list[dict[str, Any]]
    policy_violations: list[PolicyViolation]

    # Universal Package Resolution
    universal_resolution_strategy: Optional[str]
    cross_language_conflicts: list[dict[str, Any]]
    bridge_recommendations: list[dict[str, Any]]

    # AI-powered recommendations
    ai_recommendations: list[AIRecommendation]
    ai_confidence_scores: dict[str, float]
    ai_decision_rationale: dict[str, str]
    ml_risk_predictions: dict[str, dict[str, Any]]

    # Recommendations
    recommendations: list[dict[str, Any]]
    suggested_actions: list[dict[str, Any]]

    # Output generation
    sbom_data: Optional[dict[str, Any]]
    compliance_report: Optional[dict[str, Any]]
    security_report: Optional[dict[str, Any]]
    universal_lockfile_data: Optional[dict[str, Any]]


class ApprovalState(WorkflowState):
    """State for multi-stakeholder approval workflow with enterprise features."""

    # Approval request
    request_type: str  # "dependency_update", "policy_exception", "security_override"
    request_data: dict[str, Any]
    requester_id: UUID
    requester_role: str

    # Enhanced approval workflow with intelligent routing
    approval_workflow: list[dict[str, Any]]
    current_approver: Optional[dict[str, Any]]
    approval_history: list[dict[str, Any]]
    approval_requirements: list[dict[str, Any]]  # List of ApprovalRequirement data
    approval_dependency_graph: dict[str, list[str]]  # Dependency relationships between approvals

    # Enhanced stakeholder management with hierarchy
    stakeholders: list[dict[str, Any]]
    stakeholder_hierarchy: dict[str, list[dict[str, Any]]]  # Role-based hierarchy for escalation
    stakeholder_responses: dict[str, dict[str, Any]]
    stakeholder_availability: dict[str, dict[str, Any]]  # Availability and backup information

    # Enhanced SLA tracking and escalation
    sla_deadline: Optional[datetime]
    sla_status: str  # "on_time", "at_risk", "overdue"
    escalation_level: int
    escalation_history: list[dict[str, Any]]  # Track all escalation events
    escalation_policies: dict[str, dict[str, Any]]  # Role-specific escalation policies
    auto_escalation_enabled: bool

    # Intelligent decision making
    auto_approval_eligible: bool
    auto_approval_reason: Optional[str]
    auto_approval_conditions: dict[str, Any]
    risk_based_routing: dict[str, Any]  # Risk-based approval routing configuration
    ai_routing_recommendations: list[dict[str, Any]]  # AI-generated routing suggestions
    final_decision: Optional[str]
    decision_rationale: Optional[str]
    decision_confidence: Optional[float]

    # Enhanced notifications and communication
    notifications_sent: list[dict[str, Any]]
    notification_responses: list[dict[str, Any]]
    notification_preferences: dict[str, dict[str, Any]]  # Per-stakeholder notification preferences
    communication_channels: dict[str, list[str]]  # Available communication channels per stakeholder

    # Approval routing intelligence
    routing_strategy: str  # "sequential", "parallel", "conditional", "risk_based"
    routing_rules: list[dict[str, Any]]  # Intelligent routing rules
    approval_path_optimization: dict[str, Any]  # Optimized approval paths

    # Enterprise compliance and audit
    compliance_requirements: list[str]  # Required compliance frameworks
    audit_trail_enhanced: list[dict[str, Any]]  # Enhanced audit trail with digital signatures
    regulatory_approvals: dict[str, dict[str, Any]]  # Regulatory-specific approval tracking

    # Performance and analytics
    approval_metrics: dict[str, Any]  # Performance metrics for approval process
    bottleneck_analysis: dict[str, Any]  # Analysis of approval bottlenecks
    stakeholder_performance: dict[str, dict[str, Any]]  # Individual stakeholder performance metrics


class SecurityAnalysisState(WorkflowState):
    """State for security analysis workflow."""

    # Input packages
    packages_to_scan: list[Package]
    scan_scope: str  # "full", "incremental", "targeted"

    # Vulnerability data
    vulnerability_sources: list[str]
    cve_database: dict[str, Any]
    security_advisories: list[dict[str, Any]]

    # Scan results
    scan_results: dict[str, Any]
    vulnerability_matches: list[dict[str, Any]]
    false_positives: list[dict[str, Any]]

    # Risk assessment
    risk_scores: dict[str, float]
    risk_categories: dict[str, list[str]]
    mitigation_strategies: list[dict[str, Any]]

    # Compliance
    compliance_frameworks: list[str]
    compliance_results: dict[str, Any]
    compliance_gaps: list[dict[str, Any]]


class PolicyEvaluationState(WorkflowState):
    """State for policy evaluation workflow."""

    # Policy context
    policy_rules: list[dict[str, Any]]
    policy_context: dict[str, Any]
    evaluation_scope: str

    # Evaluation targets
    packages_to_evaluate: list[Package]
    dependencies_to_evaluate: list[dict[str, Any]]

    # Evaluation results
    policy_results: list[dict[str, Any]]
    violations: list[PolicyViolation]
    exceptions: list[dict[str, Any]]

    # Decision support
    violation_severity: dict[str, SecurityLevel]
    remediation_options: list[dict[str, Any]]
    approval_requirements: list[dict[str, Any]]


class ComplianceReportingState(WorkflowState):
    """State for compliance reporting workflow."""

    # Reporting requirements
    report_types: list[str]  # "sbom", "security", "license", "audit"
    compliance_frameworks: list[str]
    report_format: str  # "json", "xml", "pdf", "csv"

    # Data collection
    collected_data: dict[str, Any]
    data_sources: list[str]
    data_validation: dict[str, Any]

    # Report generation
    report_sections: list[dict[str, Any]]
    report_metadata: dict[str, Any]
    report_attachments: list[dict[str, Any]]

    # Distribution
    distribution_list: list[dict[str, Any]]
    delivery_methods: list[str]
    delivery_status: dict[str, str]


class WorkflowCheckpoint(TypedDict):
    """Workflow checkpoint for state persistence."""

    checkpoint_id: str
    workflow_id: str
    step_name: str
    timestamp: datetime
    state_data: dict[str, Any]
    checkpoint_type: str  # "auto", "manual", "error_recovery"
    metadata: dict[str, Any]


class WorkflowMetrics(TypedDict):
    """Performance metrics for workflow execution."""

    workflow_id: str
    step_metrics: dict[str, dict[str, Any]]
    total_duration: float
    step_durations: dict[str, float]
    resource_usage: dict[str, Any]
    error_rates: dict[str, float]
    success_rate: float


# Workflow step constants
DEPENDENCY_ANALYSIS_STEPS = [
    "validate_input",
    "parse_manifest",
    "resolve_dependencies",
    "analyze_cross_ecosystem",
    "analyze_security",
    "check_licenses",
    "evaluate_policies",
    "assess_risk",
    "generate_recommendations",
    "require_approval",
    "finalize_analysis"
]

# Risk assessment thresholds
RISK_THRESHOLDS = {
    "low": (0.0, 3.0),
    "medium": (3.0, 6.0),
    "high": (6.0, 8.0),
    "critical": (8.0, 10.0)
}

# Universal Package Manager utilities
class UniversalPackageManager:
    """Utilities for Universal Package Manager operations."""

    @staticmethod
    def create_universal_identifier(
        ecosystem: EcosystemType,
        name: str,
        version: str,
        namespace: Optional[str] = None
    ) -> UniversalPackageIdentifier:
        """Create a universal package identifier."""
        registry_key = f"{ecosystem.value}:"
        if namespace:
            registry_key += f"{namespace}/"
        registry_key += f"{name}@{version}"

        return UniversalPackageIdentifier(
            ecosystem=ecosystem,
            namespace=namespace,
            name=name,
            version=version,
            registry_key=registry_key
        )

    @staticmethod
    def parse_universal_identifier(registry_key: str) -> UniversalPackageIdentifier:
        """Parse a universal package identifier from registry key."""
        # Format: ecosystem:namespace/name@version or ecosystem:name@version
        try:
            ecosystem_part, name_version = registry_key.split(":", 1)
            ecosystem = EcosystemType(ecosystem_part)

            name_part, version = name_version.rsplit("@", 1)

            if "/" in name_part:
                namespace, name = name_part.rsplit("/", 1)
            else:
                namespace = None
                name = name_part

            return UniversalPackageManager.create_universal_identifier(
                ecosystem, name, version, namespace
            )
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Invalid universal package identifier: {registry_key}") from e

    @staticmethod
    def create_cross_language_dependency(
        source: UniversalPackageIdentifier,
        target: UniversalPackageIdentifier,
        relationship_type: str = "runtime",
        bridge_mechanism: Optional[str] = None,
        compatibility_score: float = 1.0
    ) -> CrossLanguageDependency:
        """Create a cross-language dependency relationship."""
        return CrossLanguageDependency(
            source_package=source,
            target_package=target,
            relationship_type=relationship_type,
            bridge_mechanism=bridge_mechanism,
            compatibility_score=compatibility_score,
            metadata={}
        )

    @staticmethod
    def initialize_polyglot_project(
        languages: list[EcosystemType],
        manifest_files: dict[EcosystemType, list[str]]
    ) -> PolyglotProjectState:
        """Initialize polyglot project state."""
        return PolyglotProjectState(
            project_languages=languages,
            manifest_files=manifest_files,
            cross_language_dependencies=[],
            language_bridges={},
            universal_lockfile=None,
            polyglot_conflicts=[],
            interop_requirements=[]
        )

    @staticmethod
    def calculate_ecosystem_compatibility(
        ecosystem1: EcosystemType,
        ecosystem2: EcosystemType
    ) -> float:
        """Calculate compatibility score between ecosystems."""
        # Compatibility matrix based on interoperability capabilities
        compatibility_matrix = {
            (EcosystemType.NPM, EcosystemType.PYPI): 0.8,  # Node.js can call Python via child_process
            (EcosystemType.PYPI, EcosystemType.NPM): 0.8,  # Python can call Node.js via subprocess
            (EcosystemType.CARGO, EcosystemType.PYPI): 0.9,  # Rust has excellent Python FFI
            (EcosystemType.PYPI, EcosystemType.CARGO): 0.9,  # Python can use Rust via PyO3
            (EcosystemType.MAVEN, EcosystemType.NPM): 0.7,  # Java can use Node.js via Nashorn/GraalVM
            (EcosystemType.NPM, EcosystemType.MAVEN): 0.7,  # Node.js can call Java via JNI bridges
            (EcosystemType.CARGO, EcosystemType.NPM): 0.8,  # Rust can compile to WASM for Node.js
            (EcosystemType.NPM, EcosystemType.CARGO): 0.8,  # Node.js can use Rust WASM modules
            (EcosystemType.MAVEN, EcosystemType.PYPI): 0.6,  # Java-Python interop via Jython/Py4J
            (EcosystemType.PYPI, EcosystemType.MAVEN): 0.6,  # Python-Java interop via JPype
            (EcosystemType.CARGO, EcosystemType.MAVEN): 0.5,  # Rust-Java interop limited
            (EcosystemType.MAVEN, EcosystemType.CARGO): 0.5,  # Java-Rust interop limited
        }

        if ecosystem1 == ecosystem2:
            return 1.0

        return compatibility_matrix.get((ecosystem1, ecosystem2), 0.3)  # Default low compatibility
