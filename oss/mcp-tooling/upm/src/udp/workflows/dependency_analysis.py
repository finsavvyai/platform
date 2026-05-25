"""
Core dependency analysis workflow using LangGraph.

Intelligent workflow orchestration for comprehensive dependency analysis
including security scanning, license compliance, and risk assessment.
"""

import time
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import uuid4

import structlog
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from udp.ai.complexity_predictor import WorkflowComplexityPredictor
from udp.ai.risk_predictor import MLRiskPredictor
from udp.ai.workflow_analyzer import AIWorkflowAnalyzer
from udp.core.config import settings
from udp.domain.models import (
    AIRecommendation,
    EcosystemType,
    SecurityLevel,
    WorkflowStatus,
)
from udp.services.universal_package_manager import UniversalPackageManagerService
from udp.tools.ecosystems import EcosystemFactory, ParseError, ResolutionError
from udp.workflows.checkpointer import PostgreSQLCheckpointSaver
from udp.workflows.state import (
    RISK_THRESHOLDS,
    DependencyAnalysisState,
    UniversalPackageManager,
)

logger = structlog.get_logger()


class DependencyAnalysisWorkflow:
    """
    LangGraph workflow for comprehensive dependency analysis.

    Orchestrates multi-step analysis including parsing, security scanning,
    license compliance, policy evaluation, and risk assessment.
    """

    def __init__(self, organization_id: Optional[str] = None):
        self.organization_id = organization_id
        self.checkpointer = None
        self.ump_service = None
        self.ai_analyzer = None
        self._initialize_checkpointer()
        self._initialize_upm_service()
        self._initialize_ai_analyzer()
        self.graph = self._build_workflow_graph()

    def _initialize_checkpointer(self):
        """Initialize workflow checkpointer for state persistence."""
        if settings.workflow.checkpoint_storage == "database" and self.organization_id:
            # Use PostgreSQL checkpointer with Universal Package Manager support
            from uuid import UUID

            org_uuid = (
                UUID(self.organization_id)
                if isinstance(self.organization_id, str)
                else self.organization_id
            )
            self.checkpointer = PostgreSQLCheckpointSaver(org_uuid)
        else:
            # Memory-based checkpointer for development
            self.checkpointer = MemorySaver()

    def _initialize_upm_service(self):
        """Initialize Universal Package Manager service."""
        if self.organization_id:
            from uuid import UUID

            org_uuid = (
                UUID(self.organization_id)
                if isinstance(self.organization_id, str)
                else self.organization_id
            )
            self.upm_service = UniversalPackageManagerService(org_uuid)

    def _initialize_ai_analyzer(self):
        """Initialize AI workflow analyzer."""
        self.ai_analyzer = AIWorkflowAnalyzer(self.organization_id)
        self.ml_risk_predictor = MLRiskPredictor(self.organization_id)
        self.complexity_predictor = WorkflowComplexityPredictor(self.organization_id)

    def _build_workflow_graph(self) -> StateGraph:
        """Build the LangGraph workflow graph."""
        workflow = StateGraph(DependencyAnalysisState)

        # Add workflow nodes
        workflow.add_node("validate_input", self._validate_input)
        workflow.add_node("predict_complexity", self._predict_complexity)
        workflow.add_node("parse_manifest", self._parse_manifest)
        workflow.add_node("resolve_dependencies", self._resolve_dependencies)
        workflow.add_node("analyze_cross_ecosystem", self._analyze_cross_ecosystem)
        workflow.add_node("analyze_security", self._analyze_security)
        workflow.add_node("check_licenses", self._check_licenses)
        workflow.add_node("evaluate_policies", self._evaluate_policies)
        workflow.add_node("assess_risk", self._assess_risk)
        workflow.add_node("generate_recommendations", self._generate_recommendations)
        workflow.add_node("require_approval", self._require_approval)
        workflow.add_node("finalize_analysis", self._finalize_analysis)

        # Define workflow edges
        workflow.add_edge("validate_input", "predict_complexity")
        workflow.add_edge("predict_complexity", "parse_manifest")
        workflow.add_edge("parse_manifest", "resolve_dependencies")
        workflow.add_edge("resolve_dependencies", "analyze_cross_ecosystem")
        workflow.add_edge("analyze_cross_ecosystem", "analyze_security")
        workflow.add_edge("analyze_security", "check_licenses")
        workflow.add_edge("check_licenses", "evaluate_policies")
        workflow.add_edge("evaluate_policies", "assess_risk")
        workflow.add_edge("assess_risk", "generate_recommendations")
        workflow.add_conditional_edges(
            "generate_recommendations",
            self._should_require_approval,
            {"approval_required": "require_approval", "proceed": "finalize_analysis"},
        )
        workflow.add_edge("require_approval", END)
        workflow.add_edge("finalize_analysis", END)

        # Set entry point
        workflow.set_entry_point("validate_input")

        return workflow.compile(checkpointer=self.checkpointer)

    async def _validate_input(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Validate input data and initialize workflow state."""
        logger.info(
            "Starting dependency analysis workflow",
            request_id=state["request_id"],
            organization_id=state["organization_id"],
        )

        try:
            # Validate required fields
            if not state.get("manifest_content"):
                raise ValueError("Manifest content is required")

            if not state.get("manifest_filename"):
                raise ValueError("Manifest filename is required")

            if not state.get("organization_id"):
                raise ValueError("Organization ID is required")

            # Initialize workflow state
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "validate_input",
                    "workflow_status": WorkflowStatus.IN_PROGRESS,
                    "completed_steps": ["validate_input"],
                    "failed_steps": [],
                    "created_at": datetime.utcnow(),
                    "analysis_complete": False,
                    "audit_log": [
                        {
                            "step": "validate_input",
                            "timestamp": datetime.utcnow(),
                            "status": "completed",
                            "message": "Input validation successful",
                        }
                    ],
                    "performance_metrics": {},
                }
            )

            logger.info(
                "Input validation completed successfully",
                request_id=state["request_id"],
            )
            return updated_state

        except Exception as e:
            logger.error(
                "Input validation failed", error=str(e), request_id=state["request_id"]
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "validate_input",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": ["validate_input"],
                    "error_message": f"Input validation failed: {str(e)}",
                }
            )
            return updated_state

    async def _predict_complexity(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Predict workflow complexity and resource requirements."""
        start_time = time.time()

        try:
            logger.info(
                "Starting workflow complexity prediction",
                request_id=state.get("request_id"),
                organization_id=state.get("organization_id"),
            )

            # Initial complexity prediction based on available data
            initial_complexity_prediction = None
            workflow_routing_recommendation = None
            estimated_execution_time = None

            if self.complexity_predictor:
                try:
                    # Get initial complexity prediction
                    initial_complexity_prediction = (
                        await self.complexity_predictor.predict_workflow_complexity(
                            state
                        )
                    )

                    # Get workflow routing recommendation
                    workflow_routing_recommendation = (
                        await self.complexity_predictor.recommend_workflow_routing(
                            state
                        )
                    )

                    # Get execution time estimate
                    (
                        estimated_time,
                        time_confidence,
                    ) = await self.complexity_predictor.predict_execution_time(state)
                    estimated_execution_time = {
                        "estimated_seconds": estimated_time,
                        "confidence": time_confidence,
                        "estimated_minutes": estimated_time / 60.0,
                    }

                    logger.info(
                        "Complexity prediction completed",
                        request_id=state.get("request_id"),
                        complexity_score=initial_complexity_prediction.complexity_score,
                        complexity_level=initial_complexity_prediction.complexity_level,
                        estimated_time_seconds=estimated_time,
                        routing_path=workflow_routing_recommendation.get(
                            "workflow_path"
                        ),
                    )

                except Exception as complexity_error:
                    logger.warning(
                        "Complexity prediction failed, using defaults",
                        error=str(complexity_error),
                        request_id=state.get("request_id"),
                    )

                    # Create minimal prediction for fallback
                    estimated_execution_time = {
                        "estimated_seconds": 120.0,
                        "confidence": 0.3,
                        "estimated_minutes": 2.0,
                    }
                    workflow_routing_recommendation = {
                        "workflow_path": "standard",
                        "confidence": 0.3,
                        "recommendations": [
                            "Complexity prediction failed - using standard path"
                        ],
                    }

            # Update state with complexity predictions
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "predict_complexity",
                    "initial_complexity_prediction": initial_complexity_prediction.dict()
                    if initial_complexity_prediction
                    else None,
                    "workflow_routing_recommendation": workflow_routing_recommendation,
                    "estimated_execution_time": estimated_execution_time,
                    "completed_steps": state.get("completed_steps", [])
                    + ["predict_complexity"],
                    "performance_metrics": {
                        **state.get("performance_metrics", {}),
                        "predict_complexity_duration": time.time() - start_time,
                    },
                }
            )

            updated_state["audit_log"] = state.get("audit_log", []) + [
                {
                    "step": "predict_complexity",
                    "timestamp": datetime.utcnow(),
                    "status": "completed",
                    "message": "Workflow complexity prediction completed",
                    "details": {
                        "complexity_score": initial_complexity_prediction.complexity_score
                        if initial_complexity_prediction
                        else None,
                        "complexity_level": initial_complexity_prediction.complexity_level
                        if initial_complexity_prediction
                        else None,
                        "estimated_time_seconds": estimated_execution_time.get(
                            "estimated_seconds"
                        )
                        if estimated_execution_time
                        else None,
                        "routing_path": workflow_routing_recommendation.get(
                            "workflow_path"
                        )
                        if workflow_routing_recommendation
                        else None,
                        "prediction_available": initial_complexity_prediction
                        is not None,
                    },
                }
            ]

            return updated_state

        except Exception as e:
            logger.error(
                "Complexity prediction failed",
                error=str(e),
                request_id=state.get("request_id"),
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "predict_complexity",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": state.get("failed_steps", [])
                    + ["predict_complexity"],
                    "error_message": f"Complexity prediction failed: {str(e)}",
                }
            )
            return updated_state

    async def _parse_manifest(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Parse manifest file content and extract dependencies."""
        start_time = time.time()

        try:
            # Determine ecosystem type
            from udp.tools.ecosystems import get_ecosystem_for_file

            ecosystem = get_ecosystem_for_file(state["manifest_filename"])

            if not ecosystem:
                raise ValueError(
                    f"Unsupported manifest file: {state['manifest_filename']}"
                )

            # Create ecosystem adapter
            adapter = EcosystemFactory.create_adapter(
                ecosystem, state["organization_id"]
            )

            # Parse manifest
            parsed_manifest = await adapter.parse_manifest(
                state["manifest_content"], state["manifest_filename"]
            )

            # Update state
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "parse_manifest",
                    "ecosystem": ecosystem,
                    "project_name": parsed_manifest.project_name,
                    "project_version": parsed_manifest.project_version,
                    "dependencies": parsed_manifest.dependencies,
                    "dev_dependencies": parsed_manifest.dev_dependencies,
                    "total_dependencies": len(parsed_manifest.dependencies)
                    + len(parsed_manifest.dev_dependencies),
                    "completed_steps": state["completed_steps"] + ["parse_manifest"],
                    "performance_metrics": {
                        **state.get("performance_metrics", {}),
                        "parse_manifest_duration": time.time() - start_time,
                    },
                }
            )

            updated_state["audit_log"].append(
                {
                    "step": "parse_manifest",
                    "timestamp": datetime.utcnow(),
                    "status": "completed",
                    "message": f"Parsed {updated_state['total_dependencies']} dependencies",
                    "details": {
                        "ecosystem": ecosystem.value,
                        "project_name": parsed_manifest.project_name,
                        "dependencies_count": len(parsed_manifest.dependencies),
                        "dev_dependencies_count": len(parsed_manifest.dev_dependencies),
                    },
                }
            )

            logger.info(
                "Manifest parsing completed",
                request_id=state["request_id"],
                ecosystem=ecosystem.value,
                total_dependencies=updated_state["total_dependencies"],
            )

            await adapter.close()
            return updated_state

        except ParseError as e:
            logger.error(
                "Manifest parsing failed",
                error=e.message,
                request_id=state["request_id"],
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "parse_manifest",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": state["failed_steps"] + ["parse_manifest"],
                    "error_message": f"Manifest parsing failed: {e.message}",
                }
            )
            return updated_state
        except Exception as e:
            logger.error(
                "Manifest parsing failed", error=str(e), request_id=state["request_id"]
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "parse_manifest",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": state["failed_steps"] + ["parse_manifest"],
                    "error_message": f"Manifest parsing failed: {str(e)}",
                }
            )
            return updated_state

    async def _resolve_dependencies(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Resolve dependencies and detect conflicts."""
        start_time = time.time()

        try:
            # Create ecosystem adapter
            adapter = EcosystemFactory.create_adapter(
                state["ecosystem"], state["organization_id"]
            )

            # Create ParsedManifest object for resolution
            from udp.tools.ecosystems import ParsedManifest

            parsed_manifest = ParsedManifest(
                project_name=state.get("project_name"),
                project_version=state.get("project_version"),
                dependencies=state["dependencies"],
                dev_dependencies=state["dev_dependencies"],
                ecosystem=state["ecosystem"],
                metadata={},
            )

            # Resolve dependencies
            resolution_result = await adapter.resolve_dependencies(
                parsed_manifest, state["organization_id"]
            )

            # Update state
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "resolve_dependencies",
                    "resolved_dependencies": [
                        pkg.dict() for pkg in resolution_result.resolved_dependencies
                    ],
                    "conflicts": resolution_result.conflicts,
                    "conflict_count": len(resolution_result.conflicts),
                    "completed_steps": state["completed_steps"]
                    + ["resolve_dependencies"],
                    "performance_metrics": {
                        **state.get("performance_metrics", {}),
                        "resolve_dependencies_duration": time.time() - start_time,
                    },
                }
            )

            updated_state["audit_log"].append(
                {
                    "step": "resolve_dependencies",
                    "timestamp": datetime.utcnow(),
                    "status": "completed",
                    "message": f"Resolved {len(resolution_result.resolved_dependencies)} dependencies",
                    "details": {
                        "resolved_count": len(resolution_result.resolved_dependencies),
                        "conflicts_count": len(resolution_result.conflicts),
                        "warnings_count": len(resolution_result.warnings),
                    },
                }
            )

            logger.info(
                "Dependency resolution completed",
                request_id=state["request_id"],
                resolved_count=len(resolution_result.resolved_dependencies),
                conflicts_count=len(resolution_result.conflicts),
            )

            await adapter.close()
            return updated_state

        except ResolutionError as e:
            logger.error(
                "Dependency resolution failed",
                error=e.message,
                request_id=state["request_id"],
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "resolve_dependencies",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": state["failed_steps"] + ["resolve_dependencies"],
                    "error_message": f"Dependency resolution failed: {e.message}",
                }
            )
            return updated_state
        except Exception as e:
            logger.error(
                "Dependency resolution failed",
                error=str(e),
                request_id=state["request_id"],
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "resolve_dependencies",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": state["failed_steps"] + ["resolve_dependencies"],
                    "error_message": f"Dependency resolution failed: {str(e)}",
                }
            )
            return updated_state

    async def _analyze_cross_ecosystem(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Analyze cross-ecosystem dependencies and polyglot project structure."""
        start_time = time.time()

        try:
            # Initialize Universal Package Manager analysis
            if not self.upm_service:
                logger.warning(
                    "UMP service not initialized, skipping cross-ecosystem analysis"
                )
                updated_state = state.copy()
                updated_state.update(
                    {
                        "current_step": "analyze_cross_ecosystem",
                        "completed_steps": state["completed_steps"]
                        + ["analyze_cross_ecosystem"],
                        "performance_metrics": {
                            **state.get("performance_metrics", {}),
                            "analyze_cross_ecosystem_duration": time.time()
                            - start_time,
                        },
                    }
                )
                return updated_state

            # Detect if this is a polyglot project
            manifest_files = state.get("manifest_files", [])
            ecosystems_detected = set()

            # Group manifest files by ecosystem
            from udp.tools.ecosystems.factory import EcosystemFactory

            ecosystem_manifests = EcosystemFactory.detect_polyglot_project(
                manifest_files
            )
            ecosystems_detected = set(ecosystem_manifests.keys())

            is_polyglot = len(ecosystems_detected) > 1

            # Initialize polyglot project state if needed
            polyglot_project_state = None
            cross_ecosystem_resolution = {}
            universal_packages = []

            if is_polyglot:
                logger.info(
                    "Detected polyglot project",
                    ecosystems=[eco.value for eco in ecosystems_detected],
                    request_id=state.get("request_id"),
                )

                # Create polyglot project state
                upm = UniversalPackageManager()
                polyglot_project_state = upm.initialize_polyglot_project(
                    list(ecosystems_detected), ecosystem_manifests
                )

                # Create universal package identifiers for resolved dependencies
                for dep_data in state.get("resolved_dependencies", []):
                    try:
                        ecosystem = dep_data.get("ecosystem")
                        if ecosystem:
                            universal_id = upm.create_universal_identifier(
                                EcosystemType(ecosystem),
                                dep_data["name"],
                                dep_data["version"],
                                dep_data.get("namespace"),
                            )
                            universal_packages.append(universal_id)
                    except Exception as e:
                        logger.warning(
                            "Failed to create universal identifier",
                            package=dep_data.get("name"),
                            error=str(e),
                        )

                # Perform cross-ecosystem analysis if we have manifest contents
                manifest_contents = state.get("manifest_contents", {})
                if manifest_contents:
                    try:
                        cross_ecosystem_resolution = (
                            await self.ump_service.resolve_polyglot_dependencies(
                                ecosystem_manifests, manifest_contents
                            )
                        )
                    except Exception as e:
                        logger.error(
                            "Cross-ecosystem resolution failed",
                            error=str(e),
                            request_id=state.get("request_id"),
                        )
                        cross_ecosystem_resolution = {
                            "error": str(e),
                            "ecosystems": [eco.value for eco in ecosystems_detected],
                            "resolution_strategy": "fallback_single_ecosystem",
                        }

            # Calculate ecosystem compatibility matrix
            ecosystem_compatibility_matrix = {}
            if len(ecosystems_detected) > 1:
                upm = UniversalPackageManager()
                ecosystems_list = list(ecosystems_detected)
                for i, eco1 in enumerate(ecosystems_list):
                    for j, eco2 in enumerate(ecosystems_list):
                        if i <= j:
                            compatibility = upm.calculate_ecosystem_compatibility(
                                eco1, eco2
                            )
                            ecosystem_compatibility_matrix[
                                f"{eco1.value}-{eco2.value}"
                            ] = compatibility

            # Update state with Universal Package Manager data
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "analyze_cross_ecosystem",
                    "polyglot_manifests": {
                        eco.value: files for eco, files in ecosystem_manifests.items()
                    },
                    "cross_ecosystem_dependencies": cross_ecosystem_resolution.get(
                        "cross_language_dependencies", []
                    ),
                    "universal_dependency_graph": cross_ecosystem_resolution.get(
                        "universal_lockfile"
                    ),
                    "ecosystem_compatibility_matrix": ecosystem_compatibility_matrix,
                    "universal_resolution_strategy": cross_ecosystem_resolution.get(
                        "resolution_strategy"
                    ),
                    "cross_language_conflicts": cross_ecosystem_resolution.get(
                        "conflicts", []
                    ),
                    "bridge_recommendations": cross_ecosystem_resolution.get(
                        "bridge_recommendations", []
                    ),
                    "universal_lockfile_data": cross_ecosystem_resolution.get(
                        "universal_lockfile"
                    ),
                    "completed_steps": state["completed_steps"]
                    + ["analyze_cross_ecosystem"],
                    "performance_metrics": {
                        **state.get("performance_metrics", {}),
                        "analyze_cross_ecosystem_duration": time.time() - start_time,
                    },
                }
            )

            # Add polyglot project data to workflow state
            if polyglot_project_state:
                updated_state["polyglot_project"] = polyglot_project_state
                updated_state["universal_packages"] = universal_packages
                updated_state["cross_ecosystem_resolution"] = cross_ecosystem_resolution

            updated_state["audit_log"].append(
                {
                    "step": "analyze_cross_ecosystem",
                    "timestamp": datetime.utcnow(),
                    "status": "completed",
                    "message": f"Cross-ecosystem analysis completed. Detected {len(ecosystems_detected)} ecosystems.",
                    "details": {
                        "is_polyglot": is_polyglot,
                        "ecosystems": [eco.value for eco in ecosystems_detected],
                        "universal_packages_count": len(universal_packages),
                        "cross_dependencies_count": len(
                            cross_ecosystem_resolution.get(
                                "cross_language_dependencies", []
                            )
                        ),
                        "conflicts_count": len(
                            cross_ecosystem_resolution.get("conflicts", [])
                        ),
                    },
                }
            )

            logger.info(
                "Cross-ecosystem analysis completed",
                request_id=state.get("request_id"),
                is_polyglot=is_polyglot,
                ecosystems=[eco.value for eco in ecosystems_detected],
                universal_packages=len(universal_packages),
            )

            return updated_state

        except Exception as e:
            logger.error(
                "Cross-ecosystem analysis failed",
                error=str(e),
                request_id=state.get("request_id"),
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "analyze_cross_ecosystem",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": state["failed_steps"] + ["analyze_cross_ecosystem"],
                    "error_message": f"Cross-ecosystem analysis failed: {str(e)}",
                }
            )
            return updated_state

    async def _analyze_security(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Analyze dependencies for security vulnerabilities."""
        start_time = time.time()

        try:
            # Mock security analysis - in production would integrate with security scanners
            vulnerabilities = []
            critical_count = 0
            high_count = 0

            # Simulate security scanning
            for dep in state.get("resolved_dependencies", []):
                # Mock vulnerability detection (would use real vulnerability databases)
                if "test" in dep.get("name", "").lower():
                    vulnerabilities.append(
                        {
                            "package_name": dep["name"],
                            "package_version": dep["version"],
                            "vulnerability_id": f"CVE-2024-{uuid4().hex[:8]}",
                            "severity": SecurityLevel.HIGH.value,
                            "description": f"Mock vulnerability in {dep['name']}",
                            "cvss_score": 7.5,
                            "fixed_version": None,
                        }
                    )
                    high_count += 1

            # Calculate security score
            total_packages = len(state.get("resolved_dependencies", []))
            if total_packages > 0:
                vulnerability_ratio = len(vulnerabilities) / total_packages
                security_score = max(0, 10 - (vulnerability_ratio * 10))
            else:
                security_score = 10.0

            # Generate security recommendation
            if critical_count > 0:
                security_recommendation = f"CRITICAL: {critical_count} critical vulnerabilities found. Immediate action required."
            elif high_count > 0:
                security_recommendation = f"HIGH RISK: {high_count} high-severity vulnerabilities found. Update recommended."
            else:
                security_recommendation = "No critical security issues found."

            # Update state
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "analyze_security",
                    "vulnerabilities": vulnerabilities,
                    "vulnerability_count": len(vulnerabilities),
                    "critical_vulnerabilities": critical_count,
                    "high_vulnerabilities": high_count,
                    "security_score": security_score,
                    "security_recommendation": security_recommendation,
                    "completed_steps": state["completed_steps"] + ["analyze_security"],
                    "performance_metrics": {
                        **state.get("performance_metrics", {}),
                        "analyze_security_duration": time.time() - start_time,
                    },
                }
            )

            updated_state["audit_log"].append(
                {
                    "step": "analyze_security",
                    "timestamp": datetime.utcnow(),
                    "status": "completed",
                    "message": f"Security analysis completed. Found {len(vulnerabilities)} vulnerabilities.",
                    "details": {
                        "total_vulnerabilities": len(vulnerabilities),
                        "critical_vulnerabilities": critical_count,
                        "high_vulnerabilities": high_count,
                        "security_score": security_score,
                    },
                }
            )

            logger.info(
                "Security analysis completed",
                request_id=state["request_id"],
                vulnerabilities_found=len(vulnerabilities),
                security_score=security_score,
            )

            return updated_state

        except Exception as e:
            logger.error(
                "Security analysis failed", error=str(e), request_id=state["request_id"]
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "analyze_security",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": state["failed_steps"] + ["analyze_security"],
                    "error_message": f"Security analysis failed: {str(e)}",
                }
            )
            return updated_state

    async def _check_licenses(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Check license compatibility and compliance."""
        start_time = time.time()

        try:
            # Mock license checking - in production would use license databases
            license_issues = []
            incompatible_licenses = []

            # Simulate license analysis
            for dep in state.get("resolved_dependencies", []):
                license_type = dep.get("license", "UNKNOWN")

                # Mock license compatibility check
                if license_type in ["GPL-3.0", "AGPL-3.0"]:
                    license_issues.append(
                        {
                            "package_name": dep["name"],
                            "package_version": dep["version"],
                            "license": license_type,
                            "issue": "Copyleft license may not be compatible with proprietary software",
                            "severity": "warning",
                        }
                    )
                    incompatible_licenses.append(license_type)

            # Determine license compliance
            license_compliance = (
                len([issue for issue in license_issues if issue["severity"] == "error"])
                == 0
            )

            # Generate license recommendation
            if not license_compliance:
                license_recommendation = (
                    "License compliance issues found. Review required."
                )
            elif license_issues:
                license_recommendation = (
                    f"Found {len(license_issues)} license warnings. Review recommended."
                )
            else:
                license_recommendation = "No license compliance issues found."

            # Update state
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "check_licenses",
                    "license_issues": license_issues,
                    "incompatible_licenses": list(set(incompatible_licenses)),
                    "license_compliance": license_compliance,
                    "license_recommendation": license_recommendation,
                    "completed_steps": state["completed_steps"] + ["check_licenses"],
                    "performance_metrics": {
                        **state.get("performance_metrics", {}),
                        "check_licenses_duration": time.time() - start_time,
                    },
                }
            )

            updated_state["audit_log"].append(
                {
                    "step": "check_licenses",
                    "timestamp": datetime.utcnow(),
                    "status": "completed",
                    "message": f"License check completed. Found {len(license_issues)} issues.",
                    "details": {
                        "license_issues_count": len(license_issues),
                        "incompatible_licenses": incompatible_licenses,
                        "license_compliance": license_compliance,
                    },
                }
            )

            logger.info(
                "License check completed",
                request_id=state["request_id"],
                license_issues=len(license_issues),
                compliance=license_compliance,
            )

            return updated_state

        except Exception as e:
            logger.error(
                "License check failed", error=str(e), request_id=state["request_id"]
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "check_licenses",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": state["failed_steps"] + ["check_licenses"],
                    "error_message": f"License check failed: {str(e)}",
                }
            )
            return updated_state

    async def _evaluate_policies(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Evaluate organizational policies against dependencies."""
        start_time = time.time()

        try:
            from udp.core.policy_engine import PolicyEvaluationContext, policy_engine
            from udp.domain.models import Package

            # Create packages from resolved dependencies
            packages = []
            for dep_data in state.get("resolved_dependencies", []):
                try:
                    package = Package(**dep_data)
                    packages.append(package)
                except Exception as e:
                    logger.warning(
                        f"Could not create package from data: {dep_data}, error: {e}"
                    )
                    continue

            # Create policy evaluation context
            context = PolicyEvaluationContext(
                organization_id=state["organization_id"],
                request_id=state["request_id"],
                evaluation_timestamp=datetime.utcnow(),
                packages=packages,
                vulnerabilities=state.get("vulnerabilities", []),
                metadata={"workflow_step": "policy_evaluation"},
            )

            # Evaluate policies for all packages
            all_policy_results = policy_engine.evaluate_policies(packages, context)

            # Process policy results
            policy_violations = []
            blocking_violations = []
            warning_violations = []

            for package_key, policy_results in all_policy_results.items():
                for result in policy_results:
                    if result.overall_result.value in ["fail", "warn"]:
                        violation = {
                            "package": package_key,
                            "policy_id": result.policy_id,
                            "policy_name": result.policy_name,
                            "result": result.overall_result.value,
                            "action": result.action.value,
                            "rule_violations": [
                                {
                                    "rule_id": rule.rule_id,
                                    "message": rule.message,
                                    "severity": rule.details.get("severity", "medium"),
                                }
                                for rule in result.rule_results
                                if rule.result.value in ["fail", "warn"]
                            ],
                        }
                        policy_violations.append(violation)

                        if result.action.value == "block":
                            blocking_violations.append(violation)
                        elif result.action.value in ["require_approval", "warn"]:
                            warning_violations.append(violation)

            # Determine if approval is required
            requires_approval = (
                len(blocking_violations) > 0
                or len(warning_violations) > 0
                or state.get("security_score", 10) < 7.0
                or not state.get("license_compliance", True)
            )

            approval_reasons = []
            if len(blocking_violations) > 0:
                approval_reasons.append(
                    f"{len(blocking_violations)} blocking policy violations"
                )
            if len(warning_violations) > 0:
                approval_reasons.append(
                    f"{len(warning_violations)} policy warnings require review"
                )
            if state.get("security_score", 10) < 7.0:
                approval_reasons.append("Low security score")
            if not state.get("license_compliance", True):
                approval_reasons.append("License compliance issues")

            # Update state
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "evaluate_policies",
                    "policy_violations": policy_violations,
                    "blocking_violations": blocking_violations,
                    "warning_violations": warning_violations,
                    "requires_approval": requires_approval,
                    "approval_reasons": approval_reasons,
                    "completed_steps": state["completed_steps"] + ["evaluate_policies"],
                    "performance_metrics": {
                        **state.get("performance_metrics", {}),
                        "evaluate_policies_duration": time.time() - start_time,
                    },
                }
            )

            updated_state["audit_log"].append(
                {
                    "step": "evaluate_policies",
                    "timestamp": datetime.utcnow(),
                    "status": "completed",
                    "message": f"Policy evaluation completed. Found {len(policy_violations)} violations.",
                    "details": {
                        "policy_violations": len(policy_violations),
                        "blocking_violations": len(blocking_violations),
                        "warning_violations": len(warning_violations),
                        "requires_approval": requires_approval,
                        "packages_evaluated": len(packages),
                        "policies_evaluated": len(policy_engine.policies),
                    },
                }
            )

            logger.info(
                "Policy evaluation completed",
                request_id=state["request_id"],
                violations=len(policy_violations),
                blocking=len(blocking_violations),
                warnings=len(warning_violations),
                requires_approval=requires_approval,
            )

            return updated_state

        except Exception as e:
            logger.error(
                "Policy evaluation failed", error=str(e), request_id=state["request_id"]
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "evaluate_policies",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": state["failed_steps"] + ["evaluate_policies"],
                    "error_message": f"Policy evaluation failed: {str(e)}",
                }
            )
            return updated_state

    async def _assess_risk(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Calculate overall risk score and assessment with ML-based predictions."""
        start_time = time.time()

        try:
            # Traditional risk calculation
            risk_factors = []
            traditional_risk_score = 0.0

            # Security risk
            security_score = state.get("security_score", 10)
            if security_score < 5:
                traditional_risk_score += 4.0
                risk_factors.append("Critical security vulnerabilities")
            elif security_score < 7:
                traditional_risk_score += 2.0
                risk_factors.append("High security vulnerabilities")

            # Conflict risk
            conflict_count = state.get("conflict_count", 0)
            if conflict_count > 0:
                conflict_risk = min(conflict_count * 0.5, 3.0)
                traditional_risk_score += conflict_risk
                risk_factors.append(f"{conflict_count} dependency conflicts")

            # License risk
            if not state.get("license_compliance", True):
                traditional_risk_score += 2.0
                risk_factors.append("License compliance issues")

            # Policy violation risk
            blocking_violations = len(state.get("blocking_violations", []))
            if blocking_violations > 0:
                traditional_risk_score += blocking_violations * 1.5
                risk_factors.append("Policy violations")

            # ML-based risk prediction
            ml_risk_predictions = {}
            ml_confidence_scores = {}
            enhanced_risk_score = traditional_risk_score
            security_prediction = None
            maintenance_prediction = None

            if self.ai_analyzer and self.ml_risk_predictor:
                try:
                    # Get AI analysis
                    (
                        ai_recommendations,
                        ai_confidence,
                    ) = await self.ai_analyzer.analyze_dependency_request(state)

                    # Get ML-based risk predictions
                    security_prediction = (
                        await self.ml_risk_predictor.predict_security_risk(state)
                    )
                    maintenance_prediction = (
                        await self.ml_risk_predictor.predict_maintenance_risk(state)
                    )

                    # Use ML predictions to enhance risk score
                    ml_security_score = security_prediction.overall_risk_score
                    ml_maintenance_score = maintenance_prediction.maintenance_score

                    # Weighted combination of traditional and ML scores
                    ml_weight = 0.7  # Give more weight to ML predictions
                    traditional_weight = 0.3

                    enhanced_risk_score = (
                        traditional_risk_score * traditional_weight
                        + ((ml_security_score + ml_maintenance_score) / 2.0) * ml_weight
                    )

                    # Extract ML risk predictions from AI analysis
                    for recommendation in ai_recommendations:
                        if recommendation.recommendation_type == "workflow_routing":
                            # Use AI confidence to adjust risk score
                            if recommendation.risk_level == SecurityLevel.CRITICAL:
                                enhanced_risk_score = max(enhanced_risk_score, 9.0)
                            elif recommendation.risk_level == SecurityLevel.HIGH:
                                enhanced_risk_score = max(enhanced_risk_score, 7.0)
                            elif recommendation.risk_level == SecurityLevel.MEDIUM:
                                enhanced_risk_score = max(enhanced_risk_score, 5.0)

                    # Store comprehensive ML predictions
                    ml_risk_predictions = {
                        "ai_recommendations": [
                            rec.dict() for rec in ai_recommendations
                        ],
                        "security_prediction": security_prediction.dict(),
                        "maintenance_prediction": maintenance_prediction.dict(),
                        "traditional_score": traditional_risk_score,
                        "ml_security_score": ml_security_score,
                        "ml_maintenance_score": ml_maintenance_score,
                        "enhanced_score": enhanced_risk_score,
                        "adjustment_factor": enhanced_risk_score
                        - traditional_risk_score,
                        "ml_weight": ml_weight,
                    }

                    # Combine confidence scores
                    ml_confidence_scores = {
                        **ai_confidence,
                        "security_confidence": security_prediction.confidence_score,
                        "maintenance_confidence": maintenance_prediction.confidence_score,
                        "combined_ml_confidence": (
                            security_prediction.confidence_score
                            + maintenance_prediction.confidence_score
                        )
                        / 2.0,
                    }

                    logger.info(
                        "Enhanced ML-based risk assessment completed",
                        request_id=state.get("request_id"),
                        traditional_score=traditional_risk_score,
                        ml_security_score=ml_security_score,
                        ml_maintenance_score=ml_maintenance_score,
                        enhanced_score=enhanced_risk_score,
                        ai_recommendations=len(ai_recommendations),
                    )

                except Exception as ai_error:
                    logger.warning(
                        "ML risk assessment failed, using traditional method",
                        error=str(ai_error),
                        request_id=state.get("request_id"),
                    )
                    enhanced_risk_score = traditional_risk_score
                    ml_risk_predictions = {"error": str(ai_error)}
                    ml_confidence_scores = {"fallback": 0.5}

            # Use enhanced risk score for final assessment
            final_risk_score = min(enhanced_risk_score, 10.0)

            # Determine risk level with dynamic thresholds
            risk_level = "low"
            adjusted_thresholds = {}

            # Dynamic threshold calculation using ML predictor
            if self.ml_risk_predictor:
                try:
                    adjusted_thresholds = (
                        await self.ml_risk_predictor.calculate_dynamic_thresholds(
                            state, RISK_THRESHOLDS
                        )
                    )

                    logger.info(
                        "Dynamic thresholds calculated",
                        request_id=state.get("request_id"),
                        original_thresholds=dict(RISK_THRESHOLDS),
                        adjusted_thresholds=adjusted_thresholds,
                    )

                except Exception as threshold_error:
                    logger.warning(
                        "Dynamic threshold calculation failed, using static thresholds",
                        error=str(threshold_error),
                        request_id=state.get("request_id"),
                    )
                    adjusted_thresholds = dict(RISK_THRESHOLDS)
            else:
                # Fallback: Basic dynamic threshold calculation based on ML confidence
                confidence_factor = ml_confidence_scores.get(
                    "combined_ml_confidence", 0.7
                )

                for level, (min_score, max_score) in RISK_THRESHOLDS.items():
                    # Adjust thresholds based on ML confidence
                    # Higher confidence = more sensitive thresholds
                    adjustment = (confidence_factor - 0.5) * 0.5  # -0.25 to +0.25
                    adjusted_min = max(0, min_score - adjustment)
                    adjusted_max = min(10, max_score - adjustment)
                    adjusted_thresholds[level] = (adjusted_min, adjusted_max)

            # Determine risk level using adjusted thresholds
            for level, (min_score, max_score) in adjusted_thresholds.items():
                if min_score <= final_risk_score < max_score:
                    risk_level = level
                    break

            # Update state with enhanced risk assessment
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "assess_risk",
                    "overall_risk_score": final_risk_score,
                    "traditional_risk_score": traditional_risk_score,
                    "risk_level": risk_level,
                    "risk_factors": risk_factors,
                    "ml_risk_predictions": ml_risk_predictions,
                    "ai_confidence_scores": ml_confidence_scores,
                    "dynamic_risk_thresholds": adjusted_thresholds,
                    "completed_steps": state["completed_steps"] + ["assess_risk"],
                    "performance_metrics": {
                        **state.get("performance_metrics", {}),
                        "assess_risk_duration": time.time() - start_time,
                    },
                }
            )

            updated_state["audit_log"].append(
                {
                    "step": "assess_risk",
                    "timestamp": datetime.utcnow(),
                    "status": "completed",
                    "message": f"Enhanced risk assessment completed. Risk level: {risk_level}",
                    "details": {
                        "traditional_risk_score": traditional_risk_score,
                        "enhanced_risk_score": final_risk_score,
                        "risk_level": risk_level,
                        "risk_factors": risk_factors,
                        "ml_predictions_available": bool(self.ai_analyzer),
                        "ai_confidence": ml_confidence_scores.get("overall", 0.0),
                    },
                }
            )

            logger.info(
                "Enhanced risk assessment completed",
                request_id=state.get("request_id"),
                traditional_score=traditional_risk_score,
                enhanced_score=final_risk_score,
                risk_level=risk_level,
                ml_enabled=bool(self.ai_analyzer),
            )

            return updated_state

        except Exception as e:
            logger.error(
                "Risk assessment failed",
                error=str(e),
                request_id=state.get("request_id"),
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "assess_risk",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": state["failed_steps"] + ["assess_risk"],
                    "error_message": f"Risk assessment failed: {str(e)}",
                }
            )
            return updated_state

    async def _generate_recommendations(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Generate actionable recommendations with AI-powered insights."""
        start_time = time.time()

        try:
            # Traditional recommendations
            traditional_recommendations = []
            suggested_actions = []
            auto_fix_available = False

            # Security recommendations
            if state.get("vulnerability_count", 0) > 0:
                traditional_recommendations.append(
                    {
                        "type": "security",
                        "priority": "high",
                        "description": f"Update {state['vulnerability_count']} vulnerable packages",
                        "details": "Consider updating to patched versions",
                        "source": "traditional",
                    }
                )
                suggested_actions.append("Update vulnerable dependencies")

            # Conflict recommendations
            if state.get("conflict_count", 0) > 0:
                traditional_recommendations.append(
                    {
                        "type": "conflicts",
                        "priority": "medium",
                        "description": f"Resolve {state['conflict_count']} dependency conflicts",
                        "details": "Review conflicting version requirements",
                        "source": "traditional",
                    }
                )
                suggested_actions.append("Resolve version conflicts")

            # License recommendations
            if not state.get("license_compliance", True):
                traditional_recommendations.append(
                    {
                        "type": "license",
                        "priority": "medium",
                        "description": "Review license compatibility issues",
                        "details": "Some licenses may not be compatible with your use case",
                        "source": "traditional",
                    }
                )
                suggested_actions.append("Review license compatibility")

            # Policy recommendations
            if state.get("policy_violations"):
                traditional_recommendations.append(
                    {
                        "type": "policy",
                        "priority": "high",
                        "description": "Address policy violations",
                        "details": "Several organizational policies are violated",
                        "source": "traditional",
                    }
                )
                suggested_actions.append("Address policy violations")

            # AI-powered recommendations
            ai_recommendations = []
            ai_decision_rationale = {}

            if self.ai_analyzer:
                try:
                    # Get AI recommendations (may have been calculated in assess_risk)
                    ml_predictions = state.get("ml_risk_predictions", {})

                    if "ai_recommendations" in ml_predictions:
                        # Use existing AI recommendations
                        ai_recs_data = ml_predictions["ai_recommendations"]
                        ai_recommendations = [
                            AIRecommendation(**rec_data) for rec_data in ai_recs_data
                        ]
                    else:
                        # Generate new AI recommendations
                        (
                            ai_recommendations,
                            ai_confidence,
                        ) = await self.ai_analyzer.analyze_dependency_request(state)

                    # Convert AI recommendations to traditional format and extract rationale
                    for ai_rec in ai_recommendations:
                        traditional_recommendations.append(
                            {
                                "type": ai_rec.recommendation_type,
                                "priority": "critical"
                                if ai_rec.is_critical
                                else ("high" if ai_rec.action_required else "medium"),
                                "description": ai_rec.title,
                                "details": ai_rec.description,
                                "confidence": ai_rec.confidence_score,
                                "source": "ai",
                                "rationale": ai_rec.rationale,
                                "automated_action": ai_rec.automated_action,
                                "human_review_required": ai_rec.human_review_required,
                            }
                        )

                        ai_decision_rationale[ai_rec.recommendation_type] = (
                            ai_rec.rationale
                        )

                        # Add AI-suggested actions
                        if ai_rec.automated_action:
                            suggested_actions.append(f"AI: {ai_rec.automated_action}")

                    logger.info(
                        "AI recommendations integrated",
                        request_id=state.get("request_id"),
                        ai_recommendations=len(ai_recommendations),
                        total_recommendations=len(traditional_recommendations),
                    )

                except Exception as ai_error:
                    logger.warning(
                        "AI recommendation generation failed, using traditional only",
                        error=str(ai_error),
                        request_id=state.get("request_id"),
                    )
                    ai_decision_rationale["ai_error"] = str(ai_error)

            # Determine if auto-fix is available (enhanced with AI input)
            auto_fix_available = (
                state.get("conflict_count", 0) == 0
                and state.get("vulnerability_count", 0) == 0
                and len(state.get("blocking_violations", [])) == 0
            )

            # AI can override auto-fix decision
            for rec in traditional_recommendations:
                if rec.get("source") == "ai" and rec.get("human_review_required"):
                    auto_fix_available = False
                    break

            # Update state with enhanced recommendations
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "generate_recommendations",
                    "recommendations": traditional_recommendations,
                    "ai_recommendations": [rec.dict() for rec in ai_recommendations],
                    "ai_decision_rationale": ai_decision_rationale,
                    "suggested_actions": suggested_actions,
                    "auto_fix_available": auto_fix_available,
                    "completed_steps": state["completed_steps"]
                    + ["generate_recommendations"],
                    "performance_metrics": {
                        **state.get("performance_metrics", {}),
                        "generate_recommendations_duration": time.time() - start_time,
                    },
                }
            )

            updated_state["audit_log"].append(
                {
                    "step": "generate_recommendations",
                    "timestamp": datetime.utcnow(),
                    "status": "completed",
                    "message": f"Generated {len(traditional_recommendations)} recommendations ({len(ai_recommendations)} from AI)",
                    "details": {
                        "total_recommendations": len(traditional_recommendations),
                        "ai_recommendations": len(ai_recommendations),
                        "traditional_recommendations": len(traditional_recommendations)
                        - len(ai_recommendations),
                        "suggested_actions": suggested_actions,
                        "auto_fix_available": auto_fix_available,
                        "ai_enabled": bool(self.ai_analyzer),
                    },
                }
            )

            logger.info(
                "Enhanced recommendations generated",
                request_id=state.get("request_id"),
                total_recommendations=len(traditional_recommendations),
                ai_recommendations=len(ai_recommendations),
                auto_fix_available=auto_fix_available,
            )

            return updated_state

        except Exception as e:
            logger.error(
                "Recommendation generation failed",
                error=str(e),
                request_id=state.get("request_id"),
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "generate_recommendations",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": state["failed_steps"]
                    + ["generate_recommendations"],
                    "error_message": f"Recommendation generation failed: {str(e)}",
                }
            )
            return updated_state

    def _should_require_approval(self, state: DependencyAnalysisState) -> str:
        """Determine if human approval is required."""
        if state.get("requires_approval", False):
            return "approval_required"
        return "proceed"

    async def _require_approval(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Set up human-in-the-loop approval process."""
        try:
            # Determine approval requirements
            approvers = []
            if state.get("security_score", 10) < 5:
                approvers.extend(["security-team", "engineering-manager"])
            elif state.get("security_score", 10) < 7:
                approvers.append("security-team")

            if not state.get("license_compliance", True):
                approvers.append("legal-team")

            if len(state.get("blocking_violations", [])) > 0:
                approvers.append("engineering-manager")

            # Set approval deadline
            approval_deadline = datetime.utcnow() + timedelta(
                hours=settings.workflow.approval_timeout_hours
            )

            # Update state
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "require_approval",
                    "workflow_status": WorkflowStatus.WAITING_FOR_APPROVAL,
                    "human_input_required": True,
                    "awaiting_approval_from": list(set(approvers)),
                    "approval_deadline": approval_deadline,
                    "approval_context": {
                        "risk_level": state.get("risk_level"),
                        "security_score": state.get("security_score"),
                        "vulnerability_count": state.get("vulnerability_count"),
                        "policy_violations": len(state.get("policy_violations", [])),
                        "recommendations": state.get("recommendations", []),
                    },
                    "completed_steps": state["completed_steps"] + ["require_approval"],
                }
            )

            updated_state["audit_log"].append(
                {
                    "step": "require_approval",
                    "timestamp": datetime.utcnow(),
                    "status": "waiting",
                    "message": f"Approval required from: {', '.join(approvers)}",
                    "details": {
                        "required_approvers": approvers,
                        "approval_deadline": approval_deadline.isoformat(),
                        "approval_reasons": state.get("approval_reasons", []),
                    },
                }
            )

            logger.info(
                "Approval required",
                request_id=state["request_id"],
                required_approvers=approvers,
                deadline=approval_deadline.isoformat(),
            )

            return updated_state

        except Exception as e:
            logger.error(
                "Approval setup failed", error=str(e), request_id=state["request_id"]
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "require_approval",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": state["failed_steps"] + ["require_approval"],
                    "error_message": f"Approval setup failed: {str(e)}",
                }
            )
            return updated_state

    async def _finalize_analysis(
        self, state: DependencyAnalysisState
    ) -> DependencyAnalysisState:
        """Finalize analysis and prepare results."""
        try:
            # Prepare final analysis result
            analysis_result = {
                "request_id": state["request_id"],
                "organization_id": state["organization_id"],
                "project_name": state.get("project_name"),
                "ecosystem": state["ecosystem"].value
                if isinstance(state["ecosystem"], EcosystemType)
                else state["ecosystem"],
                "total_dependencies": state.get("total_dependencies", 0),
                "resolved_dependencies": state.get("resolved_dependencies", []),
                "conflicts": state.get("conflicts", []),
                "vulnerabilities": state.get("vulnerabilities", []),
                "license_issues": state.get("license_issues", []),
                "policy_violations": state.get("policy_violations", []),
                "overall_risk_score": state.get("overall_risk_score", 0),
                "risk_level": state.get("risk_level", "low"),
                "recommendations": state.get("recommendations", []),
                "requires_approval": state.get("requires_approval", False),
                "analysis_complete": True,
                "completed_at": datetime.utcnow(),
            }

            # Update state
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "finalize_analysis",
                    "workflow_status": WorkflowStatus.COMPLETED,
                    "analysis_complete": True,
                    "analysis_result": analysis_result,
                    "completed_steps": state["completed_steps"] + ["finalize_analysis"],
                }
            )

            updated_state["audit_log"].append(
                {
                    "step": "finalize_analysis",
                    "timestamp": datetime.utcnow(),
                    "status": "completed",
                    "message": "Analysis finalized successfully",
                    "details": {
                        "total_dependencies": state.get("total_dependencies", 0),
                        "risk_level": state.get("risk_level"),
                        "requires_approval": state.get("requires_approval", False),
                    },
                }
            )

            logger.info(
                "Dependency analysis completed",
                request_id=state["request_id"],
                risk_level=state.get("risk_level"),
                total_dependencies=state.get("total_dependencies", 0),
            )

            return updated_state

        except Exception as e:
            logger.error(
                "Analysis finalization failed",
                error=str(e),
                request_id=state["request_id"],
            )
            updated_state = state.copy()
            updated_state.update(
                {
                    "current_step": "finalize_analysis",
                    "workflow_status": WorkflowStatus.FAILED,
                    "failed_steps": state["failed_steps"] + ["finalize_analysis"],
                    "error_message": f"Analysis finalization failed: {str(e)}",
                }
            )
            return updated_state

    async def execute(self, initial_state: dict[str, Any]) -> DependencyAnalysisState:
        """Execute the dependency analysis workflow."""
        try:
            # Add request ID if not provided
            if "request_id" not in initial_state:
                initial_state["request_id"] = str(uuid4())

            logger.info(
                "Executing dependency analysis workflow",
                request_id=initial_state["request_id"],
                organization_id=initial_state.get("organization_id"),
            )

            # Execute workflow
            result = await self.graph.ainvoke(initial_state)

            logger.info(
                "Workflow execution completed",
                request_id=initial_state["request_id"],
                status=result.get("workflow_status"),
                requires_approval=result.get("requires_approval", False),
            )

            return result

        except Exception as e:
            logger.error(
                "Workflow execution failed",
                request_id=initial_state.get("request_id"),
                error=str(e),
                exc_info=True,
            )
            raise


# Singleton instance
dependency_analysis_workflow = DependencyAnalysisWorkflow()
