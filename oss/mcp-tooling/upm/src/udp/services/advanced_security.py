"""
Advanced Security Service for Universal Dependency Platform.

Extends basic security scanning with sophisticated vulnerability analysis,
exploitability assessment, contextual risk scoring, and attack path analysis.
Integrates with LangGraph workflows for intelligent security analysis.
"""

import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..core.models.project import Project
from ..core.models.vulnerability import (
    ProjectVulnerabilityModel as ProjectVulnerability,
)
from ..core.models.vulnerability import (
    Vulnerability,
    VulnerabilityScanModel,
)
from ..core.risk_assessment import (
    AdvancedRiskAssessmentEngine,
    ContextualFactors,
    RiskAssessmentResult,
    VulnerabilityChain,
)
from ..core.services import (
    NotFoundError,
    ServiceException,
)
from .base import BaseService
from .security_service import SecurityScanningService

logger = logging.getLogger(__name__)


class AdvancedSecurityService(BaseService):
    """
    Advanced security service providing sophisticated vulnerability analysis
    with exploitability assessment, contextual risk scoring, and attack path analysis.
    """

    model_class = Vulnerability

    def __init__(self, db_session: AsyncSession):
        super().__init__(db_session)
        self.risk_engine = AdvancedRiskAssessmentEngine()
        self.base_security_service = SecurityScanningService(db_session)
        self.exploit_intelligence_sources = [
            "exploitdb",
            "metasploit",
            "cisa_kev",
            "threat_intelligence",
        ]

    async def get_service_dependencies(self) -> dict:
        """Define service dependencies."""
        return {
            "dependency_service": "DependencyService",
            "package_service": "PackageService",
            "project_service": "ProjectService",
            "threat_intelligence_service": "ThreatIntelligenceService",
        }

    async def advanced_vulnerability_scan(
        self,
        project_id: str,
        scan_config: Optional[dict[str, Any]] = None,
        include_attack_paths: bool = True,
        include_exploitability: bool = True,
        contextual_factors: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Perform advanced vulnerability scan with comprehensive risk assessment.

        Args:
            project_id: Project to scan
            scan_config: Scan configuration options
            include_attack_paths: Whether to analyze vulnerability chains
            include_exploitability: Whether to assess exploitability
            contextual_factors: Project-specific context factors

        Returns:
            Comprehensive scan results with risk assessments and attack paths
        """
        try:
            logger.info(
                f"Starting advanced vulnerability scan for project {project_id}"
            )

            # Get project information
            project_service = await self._get_dependency("project_service")
            project = await project_service.get(project_id)
            if not project:
                raise NotFoundError(f"Project {project_id} not found")

            # Get project dependencies
            dependency_service = await self._get_dependency("dependency_service")
            dependencies = await dependency_service.get_project_dependencies(
                project_id, include_transitive=True
            )

            # Perform basic vulnerability scan
            basic_scan = await self.base_security_service.scan_project_vulnerabilities(
                project_id=project_id,
                force_rescan=scan_config.get("force_rescan", False)
                if scan_config
                else False,
                include_transitive=True,
                severity_threshold="low",
            )

            # Get contextual factors
            context = await self._build_contextual_factors(
                project, contextual_factors or {}
            )

            # Get exploit intelligence
            exploit_intelligence = {}
            if include_exploitability:
                exploit_intelligence = await self._gather_exploit_intelligence(
                    basic_scan.get("vulnerabilities", [])
                )

            # Perform advanced risk assessment for each vulnerability
            advanced_assessments = []
            for vuln in basic_scan.get("vulnerabilities", []):
                assessment = await self.risk_engine.assess_vulnerability_risk(
                    vulnerability=vuln,
                    project_context=context,
                    project_dependencies=dependencies.get("dependencies", []),
                    exploit_intelligence=exploit_intelligence.get(vuln.get("id")),
                    all_vulnerabilities=basic_scan.get("vulnerabilities", []),
                )
                advanced_assessments.append(assessment)

            # Analyze vulnerability chains and attack paths
            attack_paths = []
            attack_graph = None
            if include_attack_paths and basic_scan.get("vulnerabilities"):
                chains = self.risk_engine.chain_analyzer.analyze_vulnerability_chains(
                    vulnerabilities=basic_scan.get("vulnerabilities", []),
                    project_dependencies=dependencies.get("dependencies", []),
                    project_context=context,
                )
                attack_paths = chains
                attack_graph = self.risk_engine.visualizer.generate_attack_graph(
                    chains, basic_scan.get("vulnerabilities", [])
                )

            # Generate comprehensive report
            report = await self._generate_advanced_report(
                project_id=project_id,
                basic_scan=basic_scan,
                advanced_assessments=advanced_assessments,
                attack_paths=attack_paths,
                attack_graph=attack_graph,
                context=context,
                scan_config=scan_config or {},
            )

            # Store advanced scan results
            await self._store_advanced_scan_results(project_id, report)

            logger.info(
                f"Completed advanced vulnerability scan for project {project_id}",
                total_vulnerabilities=len(advanced_assessments),
                attack_paths_found=len(attack_paths),
            )

            return report

        except Exception as e:
            logger.error(f"Failed to perform advanced vulnerability scan: {e}")
            raise ServiceException(
                f"Advanced vulnerability scan failed: {str(e)}",
                error_code="ADVANCED_SCAN_FAILED",
            )

    async def assess_exploitability(
        self,
        vulnerability_id: str,
        additional_intelligence: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Assess exploitability of a specific vulnerability.

        Args:
            vulnerability_id: Vulnerability to assess
            additional_intelligence: Additional exploit intelligence

        Returns:
            Detailed exploitability assessment
        """
        try:
            # Get vulnerability details
            vulnerability = await self.get_vulnerability_by_id(vulnerability_id)
            if not vulnerability:
                raise NotFoundError(f"Vulnerability {vulnerability_id} not found")

            # Get exploit intelligence
            exploit_intelligence = await self._gather_exploit_intelligence(
                [vulnerability]
            )
            vuln_intelligence = exploit_intelligence.get(vulnerability_id, {})

            # Merge with additional intelligence
            if additional_intelligence:
                vuln_intelligence.update(additional_intelligence)

            # Assess exploitability
            exploitability = (
                self.risk_engine.exploitability_assessor.assess_exploitability(
                    vulnerability, vuln_intelligence
                )
            )

            # Generate exploitability report
            report = {
                "vulnerability_id": vulnerability_id,
                "exploitability_assessment": {
                    "attack_vector": exploitability.attack_vector.value,
                    "attack_complexity": exploitability.attack_complexity.value,
                    "privileges_required": exploitability.privileges_required.value,
                    "user_interaction": exploitability.user_interaction.value,
                    "scope": exploitability.scope.value,
                    "exploit_code_maturity": exploitability.exploit_code_maturity,
                    "remediation_level": exploitability.remediation_level,
                    "confidence": exploitability.confidence,
                    "weaponization": exploitability.weaponization,
                },
                "exploitability_score": self.risk_engine._calculate_exploitability_score(
                    exploitability
                ),
                "exploit_intelligence": vuln_intelligence,
                "recommendations": self._generate_exploitability_recommendations(
                    exploitability
                ),
                "assessment_date": datetime.utcnow().isoformat(),
            }

            return report

        except Exception as e:
            logger.error(f"Failed to assess exploitability: {e}")
            raise ServiceException(
                f"Exploitability assessment failed: {str(e)}",
                error_code="EXPLOITABILITY_ASSESSMENT_FAILED",
            )

    async def analyze_attack_paths(
        self,
        project_id: str,
        max_paths: int = 10,
        min_impact_threshold: float = 40.0,
    ) -> dict[str, Any]:
        """
        Analyze potential attack paths in a project.

        Args:
            project_id: Project to analyze
            max_paths: Maximum number of attack paths to return
            min_impact_threshold: Minimum impact threshold for attack paths

        Returns:
            Attack path analysis results
        """
        try:
            # Get project and dependencies
            project_service = await self._get_dependency("project_service")
            project = await project_service.get(project_id)
            if not project:
                raise NotFoundError(f"Project {project_id} not found")

            dependency_service = await self._get_dependency("dependency_service")
            dependencies = await dependency_service.get_project_dependencies(
                project_id, include_transitive=True
            )

            # Get all vulnerabilities in the project
            vulnerabilities = await self._get_project_vulnerabilities(project_id)

            if not vulnerabilities:
                return {
                    "project_id": project_id,
                    "attack_paths": [],
                    "summary": {
                        "total_paths": 0,
                        "high_impact_paths": 0,
                        "critical_paths": 0,
                    },
                    "recommendations": [
                        "No vulnerabilities found - continue regular security monitoring"
                    ],
                }

            # Build contextual factors
            context = await self._build_contextual_factors(project, {})

            # Analyze vulnerability chains
            chains = self.risk_engine.chain_analyzer.analyze_vulnerability_chains(
                vulnerabilities=vulnerabilities,
                project_dependencies=dependencies.get("dependencies", []),
                project_context=context,
            )

            # Filter by impact threshold
            filtered_chains = [
                c for c in chains if c.overall_impact >= min_impact_threshold
            ]

            # Sort by impact and limit results
            filtered_chains.sort(key=lambda c: c.overall_impact, reverse=True)
            selected_chains = filtered_chains[:max_paths]

            # Generate visualizations
            attack_graph = self.risk_engine.visualizer.generate_attack_graph(
                selected_chains, vulnerabilities
            )

            # Generate summaries
            chain_summaries = self.risk_engine.visualizer.generate_chain_summary(
                selected_chains
            )

            # Calculate statistics
            critical_paths = len([c for c in selected_chains if c.overall_impact >= 70])
            high_impact_paths = len(
                [c for c in selected_chains if 50 <= c.overall_impact < 70]
            )

            # Generate recommendations
            recommendations = self._generate_attack_path_recommendations(
                selected_chains, context
            )

            return {
                "project_id": project_id,
                "attack_paths": [
                    {
                        "chain_id": chain.chain_id,
                        "vulnerabilities": chain.vulnerabilities,
                        "attack_steps": chain.attack_path,
                        "overall_impact": chain.overall_impact,
                        "feasibility": chain.feasibility,
                        "risk_level": self._calculate_chain_risk_level(chain),
                        "required_privileges": chain.required_privileges,
                        "detection_difficulty": chain.detection_difficulty,
                    }
                    for chain in selected_chains
                ],
                "attack_graph": attack_graph,
                "summary": {
                    "total_paths": len(selected_chains),
                    "high_impact_paths": high_impact_paths,
                    "critical_paths": critical_paths,
                    "highest_impact": max([c.overall_impact for c in selected_chains])
                    if selected_chains
                    else 0,
                    "average_impact": sum([c.overall_impact for c in selected_chains])
                    / len(selected_chains)
                    if selected_chains
                    else 0,
                },
                "chain_summaries": chain_summaries,
                "recommendations": recommendations,
                "analysis_date": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Failed to analyze attack paths: {e}")
            raise ServiceException(
                f"Attack path analysis failed: {str(e)}",
                error_code="ATTACK_PATH_ANALYSIS_FAILED",
            )

    async def contextual_risk_assessment(
        self,
        vulnerability_ids: list[str],
        project_context: dict[str, Any],
        prioritize_by: str = "overall_risk",
    ) -> dict[str, Any]:
        """
        Perform contextual risk assessment for multiple vulnerabilities.

        Args:
            vulnerability_ids: List of vulnerability IDs to assess
            project_context: Project context information
            prioritize_by: Risk prioritization method

        Returns:
            Contextual risk assessment results
        """
        try:
            # Build contextual factors
            context = ContextualFactors(
                project_exposure=project_context.get("project_exposure", "internal"),
                data_sensitivity=project_context.get("data_sensitivity", "low"),
                user_base_size=project_context.get("user_base_size", 100),
                internet_facing=project_context.get("internet_facing", False),
                compliance_requirements=project_context.get(
                    "compliance_requirements", []
                ),
                business_criticality=project_context.get("business_criticality", "low"),
                third_party_integrations=project_context.get(
                    "third_party_integrations", []
                ),
                authentication_required=project_context.get(
                    "authentication_required", True
                ),
                monitoring_level=project_context.get("monitoring_level", "basic"),
                patch_frequency=project_context.get("patch_frequency", "monthly"),
            )

            # Get vulnerability details
            vulnerabilities = []
            for vuln_id in vulnerability_ids:
                vuln = await self.get_vulnerability_by_id(vuln_id)
                if vuln:
                    vulnerabilities.append(
                        {
                            "id": vuln.id,
                            "title": vuln.title,
                            "description": vuln.description,
                            "severity": vuln.severity,
                            "score": vuln.score,
                            "vector": vuln.vector,
                            "source": vuln.source,
                            "package_name": vuln.metadata_json.get(
                                "package_name", "unknown"
                            ),
                        }
                    )

            # Get exploit intelligence
            exploit_intelligence = await self._gather_exploit_intelligence(
                vulnerabilities
            )

            # Assess each vulnerability
            assessments = []
            for vuln in vulnerabilities:
                assessment = await self.risk_engine.assess_vulnerability_risk(
                    vulnerability=vuln,
                    project_context=context,
                    project_dependencies=[],  # Not needed for individual assessment
                    exploit_intelligence=exploit_intelligence.get(vuln["id"]),
                    all_vulnerabilities=vulnerabilities,
                )
                assessments.append(assessment)

            # Prioritize assessments
            if prioritize_by == "overall_risk":
                assessments.sort(key=lambda a: a.overall_risk_score, reverse=True)
            elif prioritize_by == "exploitability":
                assessments.sort(key=lambda a: a.exploitability_score, reverse=True)
            elif prioritize_by == "impact":
                assessments.sort(key=lambda a: a.impact_score, reverse=True)
            elif prioritize_by == "contextual":
                assessments.sort(key=lambda a: a.contextual_risk_score, reverse=True)

            # Generate summary statistics
            risk_distribution = self._calculate_risk_distribution(assessments)

            # Generate prioritized recommendations
            recommendations = self._generate_prioritized_recommendations(
                assessments, context
            )

            return {
                "contextual_factors": {
                    "project_exposure": context.project_exposure,
                    "data_sensitivity": context.data_sensitivity,
                    "user_base_size": context.user_base_size,
                    "internet_facing": context.internet_facing,
                    "compliance_requirements": context.compliance_requirements,
                    "business_criticality": context.business_criticality,
                },
                "assessments": [
                    {
                        "vulnerability_id": a.vulnerability_id,
                        "base_score": a.base_score,
                        "exploitability_score": a.exploitability_score,
                        "impact_score": a.impact_score,
                        "contextual_risk_score": a.contextual_risk_score,
                        "overall_risk_score": a.overall_risk_score,
                        "risk_level": a.risk_level,
                        "attack_vectors": a.attack_vectors,
                        "potential_impacts": a.potential_impacts,
                        "mitigation_strategies": a.mitigation_strategies,
                        "chaining_potential": a.chaining_potential,
                        "confidence": a.confidence,
                    }
                    for a in assessments
                ],
                "risk_distribution": risk_distribution,
                "recommendations": recommendations,
                "assessment_date": datetime.utcnow().isoformat(),
                "total_assessed": len(assessments),
            }

        except Exception as e:
            logger.error(f"Failed to perform contextual risk assessment: {e}")
            raise ServiceException(
                f"Contextual risk assessment failed: {str(e)}",
                error_code="CONTEXTUAL_RISK_ASSESSMENT_FAILED",
            )

    async def _build_contextual_factors(
        self, project: Project, additional_factors: dict[str, Any]
    ) -> ContextualFactors:
        """Build contextual factors from project and additional information."""
        return ContextualFactors(
            project_exposure=additional_factors.get("project_exposure", "internal"),
            data_sensitivity=additional_factors.get("data_sensitivity", "low"),
            user_base_size=additional_factors.get("user_base_size", 100),
            internet_facing=additional_factors.get("internet_facing", False),
            compliance_requirements=additional_factors.get(
                "compliance_requirements", []
            ),
            business_criticality=additional_factors.get("business_criticality", "low"),
            third_party_integrations=additional_factors.get(
                "third_party_integrations", []
            ),
            authentication_required=additional_factors.get(
                "authentication_required", True
            ),
            monitoring_level=additional_factors.get("monitoring_level", "basic"),
            patch_frequency=additional_factors.get("patch_frequency", "monthly"),
        )

    async def _gather_exploit_intelligence(
        self, vulnerabilities: list[dict[str, Any]]
    ) -> dict[str, dict[str, Any]]:
        """Gather exploit intelligence for vulnerabilities."""
        intelligence = {}

        try:
            # Try to get threat intelligence service
            threat_service = None
            try:
                threat_service = await self._get_dependency(
                    "threat_intelligence_service"
                )
            except:
                logger.debug("Threat intelligence service not available")

            for vuln in vulnerabilities:
                vuln_id = vuln.get("id")
                if not vuln_id:
                    continue

                vuln_intelligence = {
                    "sources": [],
                    "exploit_available": False,
                    "poc_available": False,
                    "verified_exploit": False,
                    "active_exploitation": False,
                    "used_in_malware": False,
                }

                # Gather from threat intelligence service if available
                if threat_service:
                    try:
                        threat_data = await threat_service.get_exploit_intelligence(
                            vuln_id
                        )
                        if threat_data:
                            vuln_intelligence.update(threat_data)
                            vuln_intelligence["sources"].append("threat_intelligence")
                    except Exception as e:
                        logger.debug(
                            f"Failed to get threat intelligence for {vuln_id}: {e}"
                        )

                # Basic analysis based on vulnerability data
                description = vuln.get("description", "").lower()

                # Check for common exploit indicators
                if any(
                    term in description for term in ["exploit", "remote code", "rce"]
                ):
                    vuln_intelligence["exploit_available"] = True

                if "proof of concept" in description or "poc" in description:
                    vuln_intelligence["poc_available"] = True

                # Check severity
                if vuln.get("severity") == "critical":
                    vuln_intelligence["exploit_available"] = True
                    vuln_intelligence["verified_exploit"] = True

                intelligence[vuln_id] = vuln_intelligence

        except Exception as e:
            logger.error(f"Error gathering exploit intelligence: {e}")

        return intelligence

    async def _get_project_vulnerabilities(
        self, project_id: str
    ) -> list[dict[str, Any]]:
        """Get all vulnerabilities for a project."""
        try:
            # Query project vulnerabilities
            query = (
                select(ProjectVulnerability)
                .options(selectinload(ProjectVulnerability.vulnerability))
                .where(ProjectVulnerability.project_id == UUID(project_id))
                .where(ProjectVulnerability.status == "open")
            )

            result = await self._execute_query(query)
            project_vulns = result.scalars().all()

            # Convert to dictionary format
            vulnerabilities = []
            for pv in project_vulns:
                if pv.vulnerability:
                    vulnerabilities.append(
                        {
                            "id": pv.vulnerability.id,
                            "title": pv.vulnerability.title,
                            "description": pv.vulnerability.description,
                            "severity": pv.vulnerability.severity,
                            "score": pv.vulnerability.score,
                            "vector": pv.vulnerability.vector,
                            "source": pv.vulnerability.source,
                            "package_name": pv.vulnerability.metadata_json.get(
                                "package_name", "unknown"
                            ),
                            "ecosystem": pv.vulnerability.metadata_json.get(
                                "ecosystem", "unknown"
                            ),
                        }
                    )

            return vulnerabilities

        except Exception as e:
            logger.error(f"Failed to get project vulnerabilities: {e}")
            return []

    async def _generate_advanced_report(
        self,
        project_id: str,
        basic_scan: dict[str, Any],
        advanced_assessments: list[RiskAssessmentResult],
        attack_paths: list[VulnerabilityChain],
        attack_graph: Optional[dict[str, Any]],
        context: ContextualFactors,
        scan_config: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate comprehensive advanced security report."""

        # Calculate advanced statistics
        advanced_stats = self._calculate_advanced_statistics(advanced_assessments)

        # Identify critical vulnerabilities
        critical_vulns = [
            a
            for a in advanced_assessments
            if a.risk_level == "critical" or a.overall_risk_score >= 90
        ]

        # Identify high-risk chains
        high_risk_chains = [
            c for c in attack_paths if c.overall_impact >= 70 and c.feasibility >= 60
        ]

        # Generate prioritized actions
        prioritized_actions = self._generate_prioritized_actions(
            advanced_assessments, attack_paths, context
        )

        # Calculate compliance impact
        compliance_impact = self._calculate_compliance_impact(
            advanced_assessments, context.compliance_requirements
        )

        return {
            "project_id": project_id,
            "scan_type": "advanced",
            "scan_date": datetime.utcnow().isoformat(),
            "scan_config": scan_config,
            # Basic scan results
            "basic_summary": basic_scan.get("summary", {}),
            "total_dependencies": basic_scan.get("total_dependencies", 0),
            # Advanced analysis results
            "advanced_statistics": advanced_stats,
            "risk_assessments": [
                {
                    "vulnerability_id": a.vulnerability_id,
                    "base_score": a.base_score,
                    "exploitability_score": a.exploitability_score,
                    "impact_score": a.impact_score,
                    "contextual_risk_score": a.contextual_risk_score,
                    "overall_risk_score": a.overall_risk_score,
                    "risk_level": a.risk_level,
                    "confidence": a.confidence,
                    "attack_vectors": a.attack_vectors,
                    "potential_impacts": a.potential_impacts,
                    "mitigation_strategies": a.mitigation_strategies,
                    "has_chaining_potential": len(a.chaining_potential) > 0,
                }
                for a in advanced_assessments
            ],
            # Attack path analysis
            "attack_path_analysis": {
                "total_attack_paths": len(attack_paths),
                "high_risk_paths": len(high_risk_chains),
                "attack_graph": attack_graph,
                "chain_summaries": self.risk_engine.visualizer.generate_chain_summary(
                    attack_paths
                ),
            },
            # Critical findings
            "critical_vulnerabilities": [
                {
                    "id": cv.vulnerability_id,
                    "overall_risk_score": cv.overall_risk_score,
                    "risk_level": cv.risk_level,
                    "primary_concerns": cv.potential_impacts[:3],
                }
                for cv in critical_vulns
            ],
            "high_risk_chains": [
                {
                    "chain_id": hrc.chain_id,
                    "overall_impact": hrc.overall_impact,
                    "feasibility": hrc.feasibility,
                    "vulnerability_count": len(hrc.vulnerabilities),
                    "first_step": hrc.attack_path[0] if hrc.attack_path else "Unknown",
                }
                for hrc in high_risk_chains
            ],
            # Context and recommendations
            "contextual_factors": {
                "project_exposure": context.project_exposure,
                "data_sensitivity": context.data_sensitivity,
                "business_criticality": context.business_criticality,
                "internet_facing": context.internet_facing,
            },
            "compliance_impact": compliance_impact,
            "prioritized_actions": prioritized_actions,
            # Executive summary
            "executive_summary": {
                "overall_risk_level": self._calculate_overall_project_risk(
                    advanced_assessments
                ),
                "immediate_actions_required": len(critical_vulns),
                "attack_surface_reduction": self._calculate_attack_surface_reduction(
                    advanced_assessments
                ),
                "compliance_status": self._assess_compliance_status(
                    compliance_impact, context.compliance_requirements
                ),
            },
        }

    def _calculate_advanced_statistics(
        self, assessments: list[RiskAssessmentResult]
    ) -> dict[str, Any]:
        """Calculate advanced statistics from risk assessments."""
        if not assessments:
            return {
                "total_assessed": 0,
                "average_overall_risk": 0,
                "highest_risk_score": 0,
                "risk_distribution": {},
                "exploitability_distribution": {},
                "chaining_potential_count": 0,
            }

        total = len(assessments)
        total_risk = sum(a.overall_risk_score for a in assessments)
        highest_risk = max(a.overall_risk_score for a in assessments)

        # Risk level distribution
        risk_dist = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for a in assessments:
            risk_dist[a.risk_level] += 1

        # Exploitability distribution
        exploit_dist = {"high": 0, "medium": 0, "low": 0}
        for a in assessments:
            if a.exploitability_score >= 70:
                exploit_dist["high"] += 1
            elif a.exploitability_score >= 40:
                exploit_dist["medium"] += 1
            else:
                exploit_dist["low"] += 1

        # Chaining potential
        chaining_count = len([a for a in assessments if a.chaining_potential])

        return {
            "total_assessed": total,
            "average_overall_risk": round(total_risk / total, 2),
            "highest_risk_score": highest_risk,
            "risk_distribution": risk_dist,
            "exploitability_distribution": exploit_dist,
            "chaining_potential_count": chaining_count,
            "chaining_percentage": round((chaining_count / total) * 100, 1),
        }

    def _generate_prioritized_actions(
        self,
        assessments: list[RiskAssessmentResult],
        attack_paths: list[VulnerabilityChain],
        context: ContextualFactors,
    ) -> list[dict[str, Any]]:
        """Generate prioritized remediation actions."""
        actions = []

        # Critical vulnerabilities
        critical_vulns = [a for a in assessments if a.risk_level == "critical"]
        for cv in critical_vulns[:5]:  # Top 5 critical
            actions.append(
                {
                    "priority": "critical",
                    "type": "vulnerability_remediation",
                    "target": cv.vulnerability_id,
                    "title": f"Fix Critical Vulnerability {cv.vulnerability_id}",
                    "description": f"Overall risk score: {cv.overall_risk_score}",
                    "estimated_effort": self._estimate_remediation_effort(cv),
                    "deadline": "Immediate",
                }
            )

        # High-impact attack chains
        high_risk_chains = [
            c for c in attack_paths if c.overall_impact >= 70 and c.feasibility >= 60
        ]
        for chain in high_risk_chains[:3]:  # Top 3 chains
            actions.append(
                {
                    "priority": "high",
                    "type": "attack_chain_break",
                    "target": chain.chain_id,
                    "title": f"Break Attack Chain {chain.chain_id}",
                    "description": f"Impact: {chain.overall_impact}%, Feasibility: {chain.feasibility}%",
                    "estimated_effort": "Medium",
                    "deadline": "Within 7 days",
                    "recommended_action": "Fix first vulnerability in chain",
                }
            )

        # Context-specific recommendations
        if context.internet_facing:
            actions.append(
                {
                    "priority": "high",
                    "type": "infrastructure_hardening",
                    "target": "perimeter",
                    "title": "Strengthen Internet-Facing Security",
                    "description": "Implement WAF, rate limiting, and network segmentation",
                    "estimated_effort": "Medium",
                    "deadline": "Within 14 days",
                }
            )

        if context.data_sensitivity in ["high", "critical"]:
            actions.append(
                {
                    "priority": "high",
                    "type": "data_protection",
                    "target": "sensitive_data",
                    "title": "Enhance Data Protection Controls",
                    "description": "Implement encryption and access controls",
                    "estimated_effort": "High",
                    "deadline": "Within 30 days",
                }
            )

        # Monitoring improvements
        if context.monitoring_level == "basic":
            actions.append(
                {
                    "priority": "medium",
                    "type": "monitoring_enhancement",
                    "target": "security_monitoring",
                    "title": "Upgrade Security Monitoring",
                    "description": "Implement advanced threat detection and response",
                    "estimated_effort": "Medium",
                    "deadline": "Within 60 days",
                }
            )

        return actions

    def _estimate_remediation_effort(self, assessment: RiskAssessmentResult) -> str:
        """Estimate remediation effort based on vulnerability characteristics."""
        # Simple heuristic based on mitigation strategies
        if "Update to fixed version" in assessment.mitigation_strategies:
            return "Low"
        elif "Apply security patch" in assessment.mitigation_strategies:
            return "Low"
        elif "network segmentation" in assessment.mitigation_strategies:
            return "Medium"
        else:
            return "High"

    def _calculate_compliance_impact(
        self, assessments: list[RiskAssessmentResult], requirements: list[str]
    ) -> dict[str, Any]:
        """Calculate impact on compliance requirements."""
        impact = {
            "total_requirements": len(requirements),
            "affected_requirements": 0,
            "compliance_score": 100,
            "violations": [],
        }

        if not requirements:
            return impact

        for req in requirements:
            req_lower = req.lower()
            affected_vulns = []

            for assessment in assessments:
                if assessment.risk_level in ["critical", "high"]:
                    # Check if vulnerability affects this compliance requirement
                    if self._vulnerability_affects_compliance(assessment, req_lower):
                        affected_vulns.append(assessment.vulnerability_id)

            if affected_vulns:
                impact["affected_requirements"] += 1
                impact["violations"].append(
                    {
                        "requirement": req,
                        "affected_vulnerabilities": affected_vulns,
                        "severity": "high" if len(affected_vulns) > 2 else "medium",
                    }
                )

        # Calculate compliance score
        if impact["total_requirements"] > 0:
            impact["compliance_score"] = max(
                0,
                100
                - (
                    impact["affected_requirements"] / impact["total_requirements"] * 100
                ),
            )

        return impact

    def _vulnerability_affects_compliance(
        self, assessment: RiskAssessmentResult, requirement: str
    ) -> bool:
        """Check if vulnerability affects a specific compliance requirement."""
        description = " ".join(assessment.potential_impacts).lower()

        # Map requirements to vulnerability impacts
        compliance_map = {
            "pci-dss": ["card", "payment", "financial", "data exposure"],
            "hipaa": ["health", "medical", "phi", "patient", "data"],
            "gdpr": ["personal", "privacy", "data", "eu", "regulation"],
            "sox": ["financial", "reporting", "audit", "integrity"],
        }

        req_key = requirement.replace("-", "").replace("_", "")
        for key, impacts in compliance_map.items():
            if key in req_key:
                return any(impact in description for impact in impacts)

        return False

    def _assess_compliance_status(
        self, impact: dict[str, Any], requirements: list[str]
    ) -> str:
        """Assess overall compliance status."""
        if not requirements:
            return "Not Applicable"

        score = impact["compliance_score"]

        if score >= 95:
            return "Compliant"
        elif score >= 80:
            return "Minor Issues"
        elif score >= 60:
            return "Significant Issues"
        else:
            return "Non-Compliant"

    def _calculate_overall_project_risk(
        self, assessments: list[RiskAssessmentResult]
    ) -> str:
        """Calculate overall project risk level."""
        if not assessments:
            return "Low"

        # Weighted average risk score
        total_weighted = 0
        total_weight = 0

        for a in assessments:
            weight = a.confidence
            total_weighted += a.overall_risk_score * weight
            total_weight += weight

        if total_weight > 0:
            avg_risk = total_weighted / total_weight
        else:
            avg_risk = sum(a.overall_risk_score for a in assessments) / len(assessments)

        if avg_risk >= 80:
            return "Critical"
        elif avg_risk >= 60:
            return "High"
        elif avg_risk >= 40:
            return "Medium"
        else:
            return "Low"

    def _calculate_attack_surface_reduction(
        self, assessments: list[RiskAssessmentResult]
    ) -> dict[str, Any]:
        """Calculate potential attack surface reduction."""
        total_risk = sum(a.overall_risk_score for a in assessments)

        # Simulate reduction by addressing top 20% of vulnerabilities
        sorted_assessments = sorted(
            assessments, key=lambda a: a.overall_risk_score, reverse=True
        )
        top_count = max(1, len(assessments) // 5)

        risk_reduction = sum(
            a.overall_risk_score for a in sorted_assessments[:top_count]
        )
        reduction_percentage = (
            (risk_reduction / total_risk * 100) if total_risk > 0 else 0
        )

        return {
            "current_risk_score": round(total_risk, 2),
            "potential_reduction": round(risk_reduction, 2),
            "reduction_percentage": round(reduction_percentage, 1),
            "vulnerabilities_to_address": top_count,
        }

    def _calculate_chain_risk_level(self, chain: VulnerabilityChain) -> str:
        """Calculate risk level for attack chain."""
        combined_score = (chain.overall_impact + chain.feasibility) / 2

        if combined_score >= 80:
            return "critical"
        elif combined_score >= 60:
            return "high"
        elif combined_score >= 40:
            return "medium"
        else:
            return "low"

    def _generate_exploitability_recommendations(self, exploitability) -> list[str]:
        """Generate recommendations based on exploitability assessment."""
        recommendations = []

        if exploitability.exploit_code_maturity > 0.7:
            recommendations.append(
                "Active exploits detected - immediate patching required"
            )

        if exploitability.attack_vector.value == "NETWORK":
            recommendations.append(
                "Network-based attack - implement network segmentation"
            )

        if exploitability.attack_complexity.value == "LOW":
            recommendations.append(
                "Low complexity - easy to exploit - prioritize remediation"
            )

        if exploitability.user_interaction.value == "NONE":
            recommendations.append(
                "No user interaction required - can be exploited automatically"
            )

        if exploitability.weaponization > 0.7:
            recommendations.append(
                "High weaponization potential - implement threat hunting"
            )

        return recommendations

    def _calculate_risk_distribution(
        self, assessments: list[RiskAssessmentResult]
    ) -> dict[str, Any]:
        """Calculate distribution of risk levels."""
        distribution = {"critical": 0, "high": 0, "medium": 0, "low": 0}

        for a in assessments:
            distribution[a.risk_level] += 1

        total = len(assessments)
        if total > 0:
            for key in distribution:
                distribution[key] = {
                    "count": distribution[key],
                    "percentage": round((distribution[key] / total) * 100, 1),
                }

        return distribution

    def _generate_prioritized_recommendations(
        self, assessments: list[RiskAssessmentResult], context: ContextualFactors
    ) -> list[dict[str, Any]]:
        """Generate prioritized recommendations."""
        recommendations = []

        # Group by risk level
        critical = [a for a in assessments if a.risk_level == "critical"]
        high = [a for a in assessments if a.risk_level == "high"]

        # Critical recommendations
        if critical:
            recommendations.append(
                {
                    "priority": "critical",
                    "category": "immediate_action",
                    "title": "Address Critical Vulnerabilities",
                    "description": f"{len(critical)} critical vulnerabilities require immediate attention",
                    "actions": [f"Fix {cv.vulnerability_id}" for cv in critical[:5]],
                }
            )

        # High-risk recommendations
        if high:
            recommendations.append(
                {
                    "priority": "high",
                    "category": "planned_action",
                    "title": "Address High-Risk Vulnerabilities",
                    "description": f"{len(high)} high-risk vulnerabilities should be addressed within 7 days",
                    "actions": [
                        f"Schedule fix for {hv.vulnerability_id}" for hv in high[:5]
                    ],
                }
            )

        # Context-specific recommendations
        if context.internet_facing:
            recommendations.append(
                {
                    "priority": "high",
                    "category": "infrastructure",
                    "title": "Strengthen Perimeter Security",
                    "description": "Internet-facing application requires additional security controls",
                    "actions": [
                        "Implement WAF",
                        "Enable rate limiting",
                        "Add DDoS protection",
                    ],
                }
            )

        return recommendations

    def _generate_attack_path_recommendations(
        self, chains: list[VulnerabilityChain], context: ContextualFactors
    ) -> list[str]:
        """Generate recommendations based on attack path analysis."""
        recommendations = []

        if not chains:
            return ["No attack paths detected - maintain regular security monitoring"]

        # General recommendations
        recommendations.append("Implement defense-in-depth strategy")
        recommendations.append("Regular security training for development team")
        recommendations.append("Implement automated security testing in CI/CD")

        # Chain-specific recommendations
        high_feasibility = [c for c in chains if c.feasibility >= 60]
        if high_feasibility:
            recommendations.append(
                f"Priority: Break {len(high_feasibility)} high-feasibility attack chains"
            )

        multi_step = [c for c in chains if len(c.vulnerabilities) > 2]
        if multi_step:
            recommendations.append(
                "Review dependency graph to reduce multi-step attack paths"
            )

        return recommendations

    async def _store_advanced_scan_results(
        self, project_id: str, report: dict[str, Any]
    ) -> None:
        """Store advanced scan results in database."""
        try:
            # Create scan record
            scan_record = VulnerabilityScanModel(
                project_id=UUID(project_id),
                status="completed",
                total_dependencies=report.get("total_dependencies", 0),
                total_vulnerabilities=len(report.get("risk_assessments", [])),
                critical_vulnerabilities=len(
                    [
                        a
                        for a in report.get("risk_assessments", [])
                        if a["risk_level"] == "critical"
                    ]
                ),
                high_vulnerabilities=len(
                    [
                        a
                        for a in report.get("risk_assessments", [])
                        if a["risk_level"] == "high"
                    ]
                ),
                medium_vulnerabilities=len(
                    [
                        a
                        for a in report.get("risk_assessments", [])
                        if a["risk_level"] == "medium"
                    ]
                ),
                low_vulnerabilities=len(
                    [
                        a
                        for a in report.get("risk_assessments", [])
                        if a["risk_level"] == "low"
                    ]
                ),
                overall_risk_score=report.get("advanced_statistics", {}).get(
                    "average_overall_risk", 0
                ),
                overall_risk_level=report.get("executive_summary", {}).get(
                    "overall_risk_level", "low"
                ),
                scan_results=report,
                completed_at=datetime.utcnow(),
            )

            await self._create(scan_record)

        except Exception as e:
            logger.error(f"Failed to store advanced scan results: {e}")
            # Don't raise - scan results are still returned to user

    async def get_vulnerability_by_id(
        self, vulnerability_id: str
    ) -> Optional[Vulnerability]:
        """Get vulnerability by ID."""
        query = select(Vulnerability).where(Vulnerability.id == vulnerability_id)
        result = await self._execute_query(query)
        return result.scalar_one_or_none()

    def _log_operation(self, operation: str, details: dict[str, Any]) -> None:
        """Log advanced security service operations."""
        logger.info(f"AdvancedSecurityService.{operation}", **details)
