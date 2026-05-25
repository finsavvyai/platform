"""
AI-powered workflow analyzer for intelligent dependency management.

Provides machine learning-based analysis, risk assessment, and
recommendation generation for dependency workflows.
"""

from typing import Any, Optional

import structlog
from pydantic import BaseModel, Field
from udp.domain.models import AIRecommendation, SecurityLevel
from udp.workflows.state import DependencyAnalysisState

logger = structlog.get_logger()


class RiskFactors(BaseModel):
    """Risk factors for ML-based risk assessment."""

    vulnerability_count: int = Field(default=0, ge=0)
    critical_vulnerabilities: int = Field(default=0, ge=0)
    high_vulnerabilities: int = Field(default=0, ge=0)
    package_age_days: int = Field(default=0, ge=0)
    maintainer_activity: float = Field(default=0.5, ge=0.0, le=1.0)
    download_popularity: float = Field(default=0.5, ge=0.0, le=1.0)
    license_risk_score: float = Field(default=0.0, ge=0.0, le=10.0)
    dependency_depth: int = Field(default=0, ge=0)
    ecosystem_maturity: float = Field(default=0.5, ge=0.0, le=1.0)
    cross_ecosystem_complexity: float = Field(default=0.0, ge=0.0, le=1.0)


class ComplexityMetrics(BaseModel):
    """Workflow complexity prediction metrics."""

    total_packages: int = Field(default=0, ge=0)
    unique_ecosystems: int = Field(default=1, ge=1)
    dependency_conflicts: int = Field(default=0, ge=0)
    cross_language_dependencies: int = Field(default=0, ge=0)
    policy_violations: int = Field(default=0, ge=0)
    approval_requirements: int = Field(default=0, ge=0)
    estimated_processing_time: float = Field(default=0.0, ge=0.0)
    resource_requirements: dict[str, float] = Field(default_factory=dict)


class AIWorkflowAnalyzer:
    """
    AI-powered analyzer for intelligent workflow decisions.

    Uses machine learning models and heuristics to analyze dependency
    requests and determine optimal workflow paths with confidence scoring.
    """

    def __init__(self, organization_id: Optional[str] = None):
        self.organization_id = organization_id
        self.logger = logger.bind(component="ai_workflow_analyzer")

        # ML model weights (in production, these would be trained models)
        self.risk_weights = {
            "vulnerability_score": 0.35,
            "license_risk": 0.15,
            "package_maturity": 0.20,
            "ecosystem_stability": 0.15,
            "cross_ecosystem_complexity": 0.15
        }

        self.complexity_weights = {
            "package_count": 0.25,
            "ecosystem_diversity": 0.20,
            "conflict_resolution": 0.25,
            "policy_compliance": 0.15,
            "approval_overhead": 0.15
        }

    async def analyze_dependency_request(
        self,
        state: DependencyAnalysisState
    ) -> tuple[list[AIRecommendation], dict[str, float]]:
        """
        Comprehensive AI analysis of dependency request.

        Returns AI recommendations and confidence scores for workflow decisions.
        """
        self.logger.info(
            "Starting AI analysis of dependency request",
            workflow_id=state.get("workflow_id"),
            organization_id=self.organization_id
        )

        try:
            # Extract risk factors
            risk_factors = await self._extract_risk_factors(state)

            # Calculate ML-based risk scores
            risk_scores = await self._calculate_ml_risk_scores(risk_factors, state)

            # Generate AI recommendations
            recommendations = await self._generate_ai_recommendations(
                state, risk_factors, risk_scores
            )

            # Calculate confidence scores
            confidence_scores = await self._calculate_confidence_scores(
                state, risk_factors, recommendations
            )

            self.logger.info(
                "AI analysis completed",
                workflow_id=state.get("workflow_id"),
                recommendations_count=len(recommendations),
                avg_confidence=sum(confidence_scores.values()) / len(confidence_scores) if confidence_scores else 0
            )

            return recommendations, confidence_scores

        except Exception as e:
            self.logger.error(
                "AI analysis failed",
                error=str(e),
                workflow_id=state.get("workflow_id")
            )

            # Return fallback recommendation
            fallback_recommendation = AIRecommendation(
                recommendation_type="fallback",
                title="Manual Review Required",
                description="AI analysis failed, manual review recommended",
                confidence_score=0.1,
                risk_level=SecurityLevel.MEDIUM,
                action_required=True,
                human_review_required=True,
                rationale="AI analysis encountered an error, defaulting to manual review",
                workflow_id=state.get("workflow_id")
            )

            return [fallback_recommendation], {"fallback": 0.1}

    async def predict_workflow_complexity(
        self,
        state: DependencyAnalysisState
    ) -> ComplexityMetrics:
        """
        Predict workflow complexity and resource requirements.

        Uses ML models to estimate processing time and resource needs.
        """
        try:
            # Extract complexity indicators
            total_packages = len(state.get("resolved_packages", []))
            unique_ecosystems = len(set(
                pkg.get("ecosystem") for pkg in state.get("resolved_packages", [])
                if pkg.get("ecosystem")
            ))

            dependency_conflicts = len(state.get("cross_language_conflicts", []))
            cross_language_deps = len(state.get("cross_ecosystem_dependencies", []))
            policy_violations = len(state.get("policy_violations", []))

            # Calculate complexity score using weighted factors
            complexity_score = (
                (total_packages / 100) * self.complexity_weights["package_count"] +
                (unique_ecosystems / 5) * self.complexity_weights["ecosystem_diversity"] +
                (dependency_conflicts / 10) * self.complexity_weights["conflict_resolution"] +
                (policy_violations / 5) * self.complexity_weights["policy_compliance"]
            )

            # Estimate processing time (base + complexity factors)
            base_time = 30.0  # 30 seconds base
            complexity_time = complexity_score * 60.0  # Up to 60 seconds for complexity
            estimated_time = base_time + complexity_time

            # Estimate resource requirements
            cpu_factor = min(1.0 + (complexity_score * 0.5), 2.0)
            memory_factor = min(1.0 + (total_packages / 1000), 3.0)

            # Determine approval requirements
            approval_count = 0
            if policy_violations > 0:
                approval_count += 1
            if any(vuln.get("severity") == SecurityLevel.CRITICAL.value
                   for vuln in state.get("vulnerabilities", [])):
                approval_count += 1
            if cross_language_deps > 0:
                approval_count += 1

            return ComplexityMetrics(
                total_packages=total_packages,
                unique_ecosystems=unique_ecosystems,
                dependency_conflicts=dependency_conflicts,
                cross_language_dependencies=cross_language_deps,
                policy_violations=policy_violations,
                approval_requirements=approval_count,
                estimated_processing_time=estimated_time,
                resource_requirements={
                    "cpu_factor": cpu_factor,
                    "memory_factor": memory_factor,
                    "io_factor": 1.0 + (total_packages / 500)
                }
            )

        except Exception as e:
            self.logger.error(
                "Complexity prediction failed",
                error=str(e),
                workflow_id=state.get("workflow_id")
            )

            # Return default complexity metrics
            return ComplexityMetrics()

    async def recommend_resolution_strategy(
        self,
        conflicts: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """
        Recommend optimal conflict resolution strategy using AI.

        Analyzes conflicts and suggests resolution approaches with confidence.
        """
        if not conflicts:
            return {
                "strategy": "no_conflicts",
                "confidence": 1.0,
                "rationale": "No conflicts detected"
            }

        try:
            # Analyze conflict types and severity
            conflict_types = {}
            severity_scores = []

            for conflict in conflicts:
                conflict_type = conflict.get("type", "unknown")
                conflict_types[conflict_type] = conflict_types.get(conflict_type, 0) + 1

                # Calculate severity based on impact
                severity = self._calculate_conflict_severity(conflict)
                severity_scores.append(severity)

            avg_severity = sum(severity_scores) / len(severity_scores)
            max_severity = max(severity_scores)

            # Determine resolution strategy
            if max_severity >= 8.0:
                strategy = "manual_resolution"
                confidence = 0.9
                rationale = "High-severity conflicts require manual intervention"
            elif avg_severity >= 6.0:
                strategy = "guided_resolution"
                confidence = 0.8
                rationale = "Medium-severity conflicts benefit from guided resolution"
            elif len(conflicts) > 10:
                strategy = "batch_resolution"
                confidence = 0.7
                rationale = "Large number of conflicts suggest batch processing"
            else:
                strategy = "automated_resolution"
                confidence = 0.85
                rationale = "Low-complexity conflicts can be resolved automatically"

            return {
                "strategy": strategy,
                "confidence": confidence,
                "rationale": rationale,
                "conflict_analysis": {
                    "total_conflicts": len(conflicts),
                    "conflict_types": conflict_types,
                    "avg_severity": avg_severity,
                    "max_severity": max_severity
                }
            }

        except Exception as e:
            self.logger.error("Resolution strategy recommendation failed", error=str(e))
            return {
                "strategy": "manual_resolution",
                "confidence": 0.5,
                "rationale": f"Analysis failed: {str(e)}"
            }

    async def _extract_risk_factors(self, state: DependencyAnalysisState) -> RiskFactors:
        """Extract risk factors from workflow state."""
        vulnerabilities = state.get("vulnerabilities", [])
        resolved_packages = state.get("resolved_packages", [])

        # Count vulnerabilities by severity
        critical_count = sum(1 for v in vulnerabilities
                           if v.get("severity") == SecurityLevel.CRITICAL.value)
        high_count = sum(1 for v in vulnerabilities
                        if v.get("severity") == SecurityLevel.HIGH.value)

        # Calculate average package age (mock calculation)
        avg_age_days = 365  # Default to 1 year
        if resolved_packages:
            # In production, this would use actual package metadata
            avg_age_days = sum(
                self._estimate_package_age(pkg) for pkg in resolved_packages
            ) / len(resolved_packages)

        # Calculate cross-ecosystem complexity
        ecosystems = set(pkg.get("ecosystem") for pkg in resolved_packages
                        if pkg.get("ecosystem"))
        cross_ecosystem_complexity = min(len(ecosystems) / 5.0, 1.0)

        return RiskFactors(
            vulnerability_count=len(vulnerabilities),
            critical_vulnerabilities=critical_count,
            high_vulnerabilities=high_count,
            package_age_days=int(avg_age_days),
            cross_ecosystem_complexity=cross_ecosystem_complexity,
            dependency_depth=self._calculate_dependency_depth(state)
        )

    async def _calculate_ml_risk_scores(
        self,
        risk_factors: RiskFactors,
        state: DependencyAnalysisState
    ) -> dict[str, float]:
        """Calculate ML-based risk scores."""
        # Vulnerability risk score
        vuln_score = min(
            (risk_factors.critical_vulnerabilities * 3.0 +
             risk_factors.high_vulnerabilities * 1.5) / 10.0 * 10.0,
            10.0
        )

        # License risk score (from existing analysis)
        license_score = risk_factors.license_risk_score

        # Package maturity score (inverse of age and activity)
        maturity_score = max(
            10.0 - (risk_factors.package_age_days / 365.0) * 2.0 -
            (1.0 - risk_factors.maintainer_activity) * 3.0,
            0.0
        )

        # Ecosystem stability score
        ecosystem_score = 10.0 - (risk_factors.cross_ecosystem_complexity * 4.0)

        # Cross-ecosystem complexity score
        complexity_score = risk_factors.cross_ecosystem_complexity * 10.0

        # Calculate weighted overall risk
        overall_risk = (
            vuln_score * self.risk_weights["vulnerability_score"] +
            license_score * self.risk_weights["license_risk"] +
            (10.0 - maturity_score) * self.risk_weights["package_maturity"] +
            (10.0 - ecosystem_score) * self.risk_weights["ecosystem_stability"] +
            complexity_score * self.risk_weights["cross_ecosystem_complexity"]
        )

        return {
            "vulnerability_risk": vuln_score,
            "license_risk": license_score,
            "maturity_risk": 10.0 - maturity_score,
            "ecosystem_risk": 10.0 - ecosystem_score,
            "complexity_risk": complexity_score,
            "overall_risk": overall_risk
        }

    async def _generate_ai_recommendations(
        self,
        state: DependencyAnalysisState,
        risk_factors: RiskFactors,
        risk_scores: dict[str, float]
    ) -> list[AIRecommendation]:
        """Generate AI-powered recommendations."""
        recommendations = []
        workflow_id = state.get("workflow_id")

        overall_risk = risk_scores["overall_risk"]

        # Risk-based workflow routing recommendation
        if overall_risk >= 8.0:
            recommendations.append(AIRecommendation(
                recommendation_type="workflow_routing",
                title="High-Risk Dependencies Detected",
                description="Multiple high-risk factors detected. Recommend security team review.",
                confidence_score=0.9,
                risk_level=SecurityLevel.HIGH,
                action_required=True,
                human_review_required=True,
                rationale=f"Overall risk score {overall_risk:.1f}/10 exceeds threshold",
                supporting_data={"risk_scores": risk_scores},
                workflow_id=workflow_id
            ))
        elif overall_risk >= 5.0:
            recommendations.append(AIRecommendation(
                recommendation_type="workflow_routing",
                title="Medium-Risk Dependencies",
                description="Some risk factors present. Recommend enhanced monitoring.",
                confidence_score=0.8,
                risk_level=SecurityLevel.MEDIUM,
                action_required=False,
                human_review_required=False,
                rationale=f"Overall risk score {overall_risk:.1f}/10 in medium range",
                supporting_data={"risk_scores": risk_scores},
                workflow_id=workflow_id
            ))

        # Vulnerability-specific recommendations
        if risk_factors.critical_vulnerabilities > 0:
            recommendations.append(AIRecommendation(
                recommendation_type="security_action",
                title="Critical Vulnerabilities Found",
                description=f"Found {risk_factors.critical_vulnerabilities} critical vulnerabilities requiring immediate attention.",
                confidence_score=0.95,
                risk_level=SecurityLevel.CRITICAL,
                action_required=True,
                automated_action="block_deployment",
                human_review_required=True,
                rationale="Critical vulnerabilities pose immediate security risk",
                supporting_data={"critical_count": risk_factors.critical_vulnerabilities},
                workflow_id=workflow_id
            ))

        # Cross-ecosystem recommendations
        if risk_factors.cross_ecosystem_complexity > 0.5:
            recommendations.append(AIRecommendation(
                recommendation_type="architecture_guidance",
                title="Complex Cross-Ecosystem Dependencies",
                description="High cross-ecosystem complexity detected. Consider architecture review.",
                confidence_score=0.75,
                risk_level=SecurityLevel.MEDIUM,
                action_required=False,
                human_review_required=True,
                rationale="Cross-ecosystem dependencies increase maintenance complexity",
                supporting_data={"complexity_score": risk_factors.cross_ecosystem_complexity},
                workflow_id=workflow_id
            ))

        # License compliance recommendations
        if risk_scores["license_risk"] > 6.0:
            recommendations.append(AIRecommendation(
                recommendation_type="compliance_action",
                title="License Compliance Issues",
                description="Potential license compliance issues detected.",
                confidence_score=0.85,
                risk_level=SecurityLevel.MEDIUM,
                action_required=True,
                human_review_required=True,
                rationale="License risk score exceeds acceptable threshold",
                supporting_data={"license_risk": risk_scores["license_risk"]},
                workflow_id=workflow_id
            ))

        return recommendations

    async def _calculate_confidence_scores(
        self,
        state: DependencyAnalysisState,
        risk_factors: RiskFactors,
        recommendations: list[AIRecommendation]
    ) -> dict[str, float]:
        """Calculate confidence scores for AI decisions."""
        confidence_scores = {}

        # Base confidence on data quality and completeness
        data_completeness = self._assess_data_completeness(state)
        base_confidence = min(data_completeness, 0.9)

        # Adjust confidence based on risk factor certainty
        risk_certainty = self._assess_risk_certainty(risk_factors)

        for recommendation in recommendations:
            # Start with base confidence
            confidence = base_confidence

            # Adjust based on recommendation type
            if recommendation.recommendation_type == "security_action":
                # High confidence for security decisions with clear data
                confidence = min(confidence * 1.1, 0.95)
            elif recommendation.recommendation_type == "workflow_routing":
                # Medium confidence for routing decisions
                confidence = min(confidence * 1.0, 0.9)
            elif recommendation.recommendation_type == "architecture_guidance":
                # Lower confidence for architectural recommendations
                confidence = min(confidence * 0.9, 0.8)

            # Adjust based on supporting data quality
            if recommendation.supporting_data:
                confidence = min(confidence * 1.05, 0.95)

            confidence_scores[recommendation.recommendation_type] = confidence

        # Overall workflow confidence
        if recommendations:
            confidence_scores["overall"] = sum(confidence_scores.values()) / len(confidence_scores)
        else:
            confidence_scores["overall"] = base_confidence

        return confidence_scores

    def _estimate_package_age(self, package: dict[str, Any]) -> int:
        """Estimate package age in days (mock implementation)."""
        # In production, this would use actual package metadata
        return 365  # Default to 1 year

    def _calculate_dependency_depth(self, state: DependencyAnalysisState) -> int:
        """Calculate maximum dependency depth."""
        # Mock implementation - in production would analyze dependency tree
        return min(len(state.get("resolved_packages", [])) // 10, 10)

    def _calculate_conflict_severity(self, conflict: dict[str, Any]) -> float:
        """Calculate conflict severity score (0-10)."""
        # Mock severity calculation based on conflict type
        conflict_type = conflict.get("type", "unknown")

        severity_map = {
            "version_conflict": 6.0,
            "license_conflict": 8.0,
            "security_conflict": 9.0,
            "cross_ecosystem_conflict": 7.0,
            "unknown": 5.0
        }

        return severity_map.get(conflict_type, 5.0)

    def _assess_data_completeness(self, state: DependencyAnalysisState) -> float:
        """Assess completeness of data for confidence calculation."""
        completeness_factors = []

        # Check if we have resolved packages
        if state.get("resolved_packages"):
            completeness_factors.append(1.0)
        else:
            completeness_factors.append(0.3)

        # Check if we have vulnerability data
        if "vulnerabilities" in state:
            completeness_factors.append(1.0)
        else:
            completeness_factors.append(0.7)

        # Check if we have license analysis
        if state.get("license_analysis"):
            completeness_factors.append(1.0)
        else:
            completeness_factors.append(0.8)

        return sum(completeness_factors) / len(completeness_factors)

    def _assess_risk_certainty(self, risk_factors: RiskFactors) -> float:
        """Assess certainty of risk factor calculations."""
        # Higher certainty with more concrete data points
        certainty = 0.7  # Base certainty

        if risk_factors.vulnerability_count > 0:
            certainty += 0.1

        if risk_factors.package_age_days > 0:
            certainty += 0.1

        if risk_factors.dependency_depth > 0:
            certainty += 0.1

        return min(certainty, 1.0)
