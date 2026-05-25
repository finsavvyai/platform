"""
Advanced Risk Assessment Engine for Universal Dependency Platform.

Implements sophisticated vulnerability analysis with exploitability assessment,
contextual risk scoring, vulnerability chaining analysis, and attack path visualization.
"""

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)


class AttackVector(Enum):
    """CVSS Attack Vector enumeration."""

    NETWORK = "NETWORK"
    ADJACENT = "ADJACENT"
    LOCAL = "LOCAL"
    PHYSICAL = "PHYSICAL"


class AttackComplexity(Enum):
    """CVSS Attack Complexity enumeration."""

    LOW = "LOW"
    HIGH = "HIGH"


class PrivilegesRequired(Enum):
    """CVSS Privileges Required enumeration."""

    NONE = "NONE"
    LOW = "LOW"
    HIGH = "HIGH"


class UserInteraction(Enum):
    """CVSS User Interaction enumeration."""

    NONE = "NONE"
    REQUIRED = "REQUIRED"


class Scope(Enum):
    """CVSS Scope enumeration."""

    UNCHANGED = "UNCHANGED"
    CHANGED = "CHANGED"


class ConfidentialityImpact(Enum):
    """CVSS Confidentiality Impact enumeration."""

    NONE = "NONE"
    LOW = "LOW"
    HIGH = "HIGH"


class IntegrityImpact(Enum):
    """CVSS Integrity Impact enumeration."""

    NONE = "NONE"
    LOW = "LOW"
    HIGH = "HIGH"


class AvailabilityImpact(Enum):
    """CVSS Availability Impact enumeration."""

    NONE = "NONE"
    LOW = "LOW"
    HIGH = "HIGH"


@dataclass
class ExploitabilityFactors:
    """Factors affecting exploitability assessment."""

    attack_vector: AttackVector
    attack_complexity: AttackComplexity
    privileges_required: PrivilegesRequired
    user_interaction: UserInteraction
    scope: Scope
    exploit_code_maturity: float = 0.0  # 0-1 based on real-world exploits
    remediation_level: float = 1.0  # 0-1 (1 = no fix available)
    confidence: float = 1.0  # 0-1 confidence in assessment
    weaponization: float = 0.0  # 0-1 likelihood of weaponization


@dataclass
class ContextualFactors:
    """Contextual factors affecting risk assessment."""

    project_exposure: str = "internal"  # internal, external, public
    data_sensitivity: str = "low"  # low, medium, high, critical
    user_base_size: int = 100  # Estimated number of users
    internet_facing: bool = False
    compliance_requirements: list[str] = field(default_factory=list)
    business_criticality: str = "low"  # low, medium, high, critical
    third_party_integrations: list[str] = field(default_factory=list)
    authentication_required: bool = True
    monitoring_level: str = "basic"  # basic, standard, advanced
    patch_frequency: str = "monthly"  # weekly, monthly, quarterly, adhoc


@dataclass
class VulnerabilityChain:
    """Represents a chain of vulnerabilities that can be exploited together."""

    chain_id: str
    vulnerabilities: list[str]  # List of vulnerability IDs
    attack_path: list[str]  # Step-by-step attack description
    overall_impact: float  # 0-100
    feasibility: float  # 0-100
    required_privileges: list[str]
    detection_difficulty: str  # easy, medium, hard


@dataclass
class RiskAssessmentResult:
    """Complete risk assessment result for a vulnerability."""

    vulnerability_id: str
    base_score: float
    exploitability_score: float
    impact_score: float
    contextual_risk_score: float
    overall_risk_score: float
    risk_level: str
    exploitability_factors: ExploitabilityFactors
    contextual_factors: ContextualFactors
    attack_vectors: list[str]
    potential_impacts: list[str]
    mitigation_strategies: list[str]
    chaining_potential: list[str]  # List of vulnerability IDs that can chain
    attack_paths: list[VulnerabilityChain]
    confidence: float
    assessment_date: datetime
    metadata: dict[str, Any] = field(default_factory=dict)


class ExploitabilityAssessor:
    """Assesses exploitability of vulnerabilities based on CVSS and additional factors."""

    def __init__(self):
        self.exploit_db_weights = {
            "metasploit": 0.9,
            "exploitdb": 0.8,
            "poc_available": 0.6,
            "theoretical": 0.3,
        }
        self.weaponization_indicators = [
            "ransomware",
            "cryptomining",
            "data_exfiltration",
            "lateral_movement",
            "persistence",
        ]

    def assess_exploitability(
        self,
        vulnerability: dict[str, Any],
        exploit_intelligence: Optional[dict[str, Any]] = None,
    ) -> ExploitabilityFactors:
        """
        Assess exploitability based on CVSS metrics and additional intelligence.

        Args:
            vulnerability: Vulnerability data with CVSS metrics
            exploit_intelligence: Additional exploit intelligence data

        Returns:
            ExploitabilityFactors object with detailed assessment
        """
        try:
            # Parse CVSS vector string if available
            cvss_vector = vulnerability.get("vector", "")
            cvss_metrics = self._parse_cvss_vector(cvss_vector)

            # Extract base CVSS metrics
            attack_vector = AttackVector(cvss_metrics.get("AV", "NETWORK"))
            attack_complexity = AttackComplexity(cvss_metrics.get("AC", "HIGH"))
            privileges_required = PrivilegesRequired(cvss_metrics.get("PR", "NONE"))
            user_interaction = UserInteraction(cvss_metrics.get("UI", "REQUIRED"))
            scope = Scope(cvss_metrics.get("S", "UNCHANGED"))

            # Assess exploit code maturity
            exploit_code_maturity = self._assess_exploit_code_maturity(
                vulnerability, exploit_intelligence
            )

            # Assess remediation level
            remediation_level = self._assess_remediation_level(vulnerability)

            # Assess confidence
            confidence = self._assess_confidence(vulnerability, exploit_intelligence)

            # Assess weaponization potential
            weaponization = self._assess_weaponization_potential(
                vulnerability, exploit_intelligence
            )

            return ExploitabilityFactors(
                attack_vector=attack_vector,
                attack_complexity=attack_complexity,
                privileges_required=privileges_required,
                user_interaction=user_interaction,
                scope=scope,
                exploit_code_maturity=exploit_code_maturity,
                remediation_level=remediation_level,
                confidence=confidence,
                weaponization=weaponization,
            )

        except Exception as e:
            logger.error(f"Error assessing exploitability: {e}")
            # Return default factors
            return ExploitabilityFactors(
                attack_vector=AttackVector.NETWORK,
                attack_complexity=AttackComplexity.HIGH,
                privileges_required=PrivilegesRequired.NONE,
                user_interaction=UserInteraction.NONE,
                scope=Scope.UNCHANGED,
            )

    def _parse_cvss_vector(self, vector_string: str) -> dict[str, str]:
        """Parse CVSS vector string into components."""
        metrics = {}
        if vector_string:
            # Extract individual metrics from vector string
            pattern = r"([A-Z]+):([A-Z_]+)"
            matches = re.findall(pattern, vector_string)
            for metric, value in matches:
                metrics[metric] = value
        return metrics

    def _assess_exploit_code_maturity(
        self,
        vulnerability: dict[str, Any],
        exploit_intelligence: Optional[dict[str, Any]],
    ) -> float:
        """Assess exploit code maturity based on available exploits."""
        maturity = 0.0

        if not exploit_intelligence:
            return maturity

        # Check for known exploits
        if exploit_intelligence.get("metasploit_module"):
            maturity = max(maturity, self.exploit_db_weights["metasploit"])
        elif exploit_intelligence.get("exploitdb_id"):
            maturity = max(maturity, self.exploit_db_weights["exploitdb"])
        elif exploit_intelligence.get("poc_available"):
            maturity = max(maturity, self.exploit_db_weights["poc_available"])
        else:
            maturity = self.exploit_db_weights["theoretical"]

        # Adjust based on exploit publication date
        if exploit_intelligence.get("exploit_published_date"):
            pub_date = datetime.fromisoformat(
                exploit_intelligence["exploit_published_date"]
            )
            days_since = (datetime.utcnow() - pub_date).days
            # Older exploits are more mature
            maturity += min(0.2, days_since / 365 * 0.2)

        return min(1.0, maturity)

    def _assess_remediation_level(self, vulnerability: dict[str, Any]) -> float:
        """Assess remediation level (1.0 = no fix, 0.0 = official fix)."""
        remediation_level = 1.0

        # Check for fixed versions
        if vulnerability.get("fixed_versions"):
            remediation_level = 0.0
        elif vulnerability.get("patch_available"):
            remediation_level = 0.3
        elif vulnerability.get("workaround_available"):
            remediation_level = 0.6

        return remediation_level

    def _assess_confidence(
        self,
        vulnerability: dict[str, Any],
        exploit_intelligence: Optional[dict[str, Any]],
    ) -> float:
        """Assess confidence in the vulnerability assessment."""
        confidence = 0.5  # Base confidence

        # Increase confidence with more data sources
        sources = set()
        if vulnerability.get("source"):
            sources.add(vulnerability["source"])
        if exploit_intelligence:
            sources.update(exploit_intelligence.get("sources", []))

        confidence += len(sources) * 0.1

        # Increase confidence with detailed CVSS vector
        if vulnerability.get("vector"):
            confidence += 0.2

        # Increase confidence with exploit verification
        if exploit_intelligence and exploit_intelligence.get("verified_exploit"):
            confidence += 0.2

        return min(1.0, confidence)

    def _assess_weaponization_potential(
        self,
        vulnerability: dict[str, Any],
        exploit_intelligence: Optional[dict[str, Any]],
    ) -> float:
        """Assess likelihood of vulnerability being weaponized."""
        weaponization = 0.0

        # Check vulnerability type and characteristics
        description = vulnerability.get("description", "").lower()
        title = vulnerability.get("title", "").lower()

        for indicator in self.weaponization_indicators:
            if indicator in description or indicator in title:
                weaponization += 0.2

        # Check for remote execution capabilities
        if any(
            term in description for term in ["remote code", "rce", "remote execution"]
        ):
            weaponization += 0.3

        # Check for privilege escalation
        if any(
            term in description
            for term in ["privilege escalation", "elevation", "sudo"]
        ):
            weaponization += 0.2

        # Check exploit intelligence for weaponization indicators
        if exploit_intelligence:
            if exploit_intelligence.get("used_in_malware"):
                weaponization += 0.4
            if exploit_intelligence.get("active_exploitation"):
                weaponization += 0.3

        return min(1.0, weaponization)


class ContextualRiskScorer:
    """Calculates contextual risk scores based on project-specific factors."""

    def __init__(self):
        self.exposure_weights = {
            "internal": 0.5,
            "external": 0.7,
            "public": 1.0,
        }
        self.sensitivity_weights = {
            "low": 0.3,
            "medium": 0.6,
            "high": 0.8,
            "critical": 1.0,
        }
        self.criticality_weights = {
            "low": 0.4,
            "medium": 0.6,
            "high": 0.8,
            "critical": 1.0,
        }

    def calculate_contextual_risk(
        self,
        vulnerability: dict[str, Any],
        exploitability: ExploitabilityFactors,
        context: ContextualFactors,
        project_dependencies: list[dict[str, Any]],
    ) -> float:
        """
        Calculate contextual risk score based on project-specific factors.

        Args:
            vulnerability: Vulnerability data
            exploitability: Exploitability assessment
            context: Project context
            project_dependencies: List of project dependencies

        Returns:
            Contextual risk score (0-100)
        """
        try:
            base_score = vulnerability.get("score", 0) * 10  # Convert to 0-100

            # Apply exposure factor
            exposure_factor = self.exposure_weights.get(context.project_exposure, 0.5)

            # Apply data sensitivity factor
            sensitivity_factor = self.sensitivity_weights.get(
                context.data_sensitivity, 0.3
            )

            # Apply business criticality factor
            criticality_factor = self.criticality_weights.get(
                context.business_criticality, 0.4
            )

            # Calculate dependency impact
            dependency_factor = self._calculate_dependency_impact(
                vulnerability, project_dependencies
            )

            # Calculate compliance impact
            compliance_factor = self._calculate_compliance_impact(
                vulnerability, context.compliance_requirements
            )

            # Calculate access factor
            access_factor = self._calculate_access_factor(exploitability, context)

            # Calculate user impact factor
            user_factor = self._calculate_user_impact(context)

            # Combine all factors
            contextual_score = (
                base_score * 0.3  # Base CVSS score
                + exposure_factor * 10 * 0.2  # Exposure
                + sensitivity_factor * 10 * 0.15  # Data sensitivity
                + criticality_factor * 10 * 0.15  # Business criticality
                + dependency_factor * 0.1  # Dependency impact
                + compliance_factor * 0.05  # Compliance requirements
                + access_factor * 0.03  # Access requirements
                + user_factor * 0.02  # User impact
            )

            # Apply exploitability multiplier
            exploitability_multiplier = 1.0 + (
                exploitability.exploit_code_maturity * 0.5
            )

            final_score = min(100, contextual_score * exploitability_multiplier)

            return round(final_score, 2)

        except Exception as e:
            logger.error(f"Error calculating contextual risk: {e}")
            return vulnerability.get("score", 0) * 10

    def _calculate_dependency_impact(
        self, vulnerability: dict[str, Any], project_dependencies: list[dict[str, Any]]
    ) -> float:
        """Calculate impact based on dependency usage."""
        package_name = vulnerability.get("package_name", "")

        # Find the dependency in project
        dep_usage = None
        for dep in project_dependencies:
            if dep.get("package", {}).get("name") == package_name:
                dep_usage = dep
                break

        if not dep_usage:
            return 0.0

        impact = 0.0

        # Direct dependency impact
        if dep_usage.get("is_direct"):
            impact += 5.0
        else:
            impact += 2.0

        # Production dependency impact
        if not dep_usage.get("is_dev_dependency", False):
            impact += 3.0

        # Usage frequency (if available)
        usage_count = dep_usage.get("usage_count", 0)
        if usage_count > 100:
            impact += 2.0
        elif usage_count > 10:
            impact += 1.0

        return min(10, impact)

    def _calculate_compliance_impact(
        self, vulnerability: dict[str, Any], compliance_requirements: list[str]
    ) -> float:
        """Calculate impact based on compliance requirements."""
        if not compliance_requirements:
            return 0.0

        impact = 0.0

        # Check severity against compliance requirements
        severity = vulnerability.get("severity", "low").lower()

        if severity == "critical":
            for req in compliance_requirements:
                if req.lower() in ["pci-dss", "hipaa", "sox"]:
                    impact += 10.0
                elif req.lower() in ["gdpr"]:
                    impact += 8.0
                else:
                    impact += 5.0
        elif severity == "high":
            for req in compliance_requirements:
                impact += 5.0

        return min(10, impact)

    def _calculate_access_factor(
        self, exploitability: ExploitabilityFactors, context: ContextualFactors
    ) -> float:
        """Calculate access-based risk factor."""
        factor = 0.0

        # Internet-facing applications are at higher risk
        if context.internet_facing:
            factor += 5.0

        # Public applications without authentication
        if context.project_exposure == "public" and not context.authentication_required:
            factor += 3.0

        # Network-based exploits are more dangerous for internet-facing apps
        if (
            exploitability.attack_vector == AttackVector.NETWORK
            and context.internet_facing
        ):
            factor += 2.0

        # Low complexity exploits
        if exploitability.attack_complexity == AttackComplexity.LOW:
            factor += 1.0

        # No user interaction required
        if exploitability.user_interaction == UserInteraction.NONE:
            factor += 1.0

        return factor

    def _calculate_user_impact(self, context: ContextualFactors) -> float:
        """Calculate user-based impact factor."""
        factor = 0.0

        # Scale impact based on user base size
        if context.user_base_size > 100000:
            factor += 2.0
        elif context.user_base_size > 10000:
            factor += 1.5
        elif context.user_base_size > 1000:
            factor += 1.0

        # External users have higher impact
        if context.project_exposure == "public":
            factor += 1.0
        elif context.project_exposure == "external":
            factor += 0.5

        return factor


class VulnerabilityChainAnalyzer:
    """Analyzes vulnerability chains and attack paths."""

    def __init__(self):
        self.privilege_levels = ["none", "user", "admin", "system", "root"]

    def analyze_vulnerability_chains(
        self,
        vulnerabilities: list[dict[str, Any]],
        project_dependencies: list[dict[str, Any]],
        project_context: ContextualFactors,
    ) -> list[VulnerabilityChain]:
        """
        Analyze potential vulnerability chains in the project.

        Args:
            vulnerabilities: List of vulnerabilities in the project
            project_dependencies: Project dependency structure
            project_context: Project context information

        Returns:
            List of potential vulnerability chains
        """
        chains = []

        try:
            # Group vulnerabilities by package and component
            vuln_by_package = self._group_vulnerabilities_by_package(vulnerabilities)

            # Build attack graph
            attack_graph = self._build_attack_graph(
                vuln_by_package, project_dependencies
            )

            # Find attack paths through the graph
            attack_paths = self._find_attack_paths(attack_graph, project_context)

            # Convert attack paths to vulnerability chains
            for path in attack_paths:
                chain = self._create_vulnerability_chain(path, vulnerabilities)
                if chain:
                    chains.append(chain)

            # Sort chains by overall impact
            chains.sort(key=lambda c: c.overall_impact, reverse=True)

        except Exception as e:
            logger.error(f"Error analyzing vulnerability chains: {e}")

        return chains

    def _group_vulnerabilities_by_package(
        self, vulnerabilities: list[dict[str, Any]]
    ) -> dict[str, list[dict[str, Any]]]:
        """Group vulnerabilities by package name."""
        grouped = {}
        for vuln in vulnerabilities:
            package = vuln.get("package_name", "unknown")
            if package not in grouped:
                grouped[package] = []
            grouped[package].append(vuln)
        return grouped

    def _build_attack_graph(
        self,
        vuln_by_package: dict[str, list[dict[str, Any]]],
        dependencies: list[dict[str, Any]],
    ) -> dict[str, dict[str, Any]]:
        """Build attack graph showing vulnerability relationships."""
        graph = {}

        # Add nodes for each vulnerability
        for package, vulns in vuln_by_package.items():
            for vuln in vulns:
                vuln_id = vuln.get("id")
                graph[vuln_id] = {
                    "vulnerability": vuln,
                    "package": package,
                    "privileges_gained": self._determine_privileges_gained(vuln),
                    "dependencies": [],
                }

        # Add edges based on dependency relationships
        for dep in dependencies:
            dep_package = dep.get("package", {}).get("name", "")
            if dep_package in vuln_by_package:
                # Find vulnerabilities that this dependency enables
                for vuln in vuln_by_package[dep_package]:
                    vuln_id = vuln.get("id")
                    if vuln_id in graph:
                        # Link to vulnerabilities in dependent packages
                        dependents = self._find_dependent_packages(
                            dep_package, dependencies
                        )
                        for dependent in dependents:
                            if dependent in vuln_by_package:
                                for dependent_vuln in vuln_by_package[dependent]:
                                    dep_vuln_id = dependent_vuln.get("id")
                                    if dep_vuln_id in graph:
                                        graph[vuln_id]["dependencies"].append(
                                            dep_vuln_id
                                        )

        return graph

    def _determine_privileges_gained(self, vulnerability: dict[str, Any]) -> str:
        """Determine what privileges can be gained from exploiting this vulnerability."""
        description = vulnerability.get("description", "").lower()

        if any(
            term in description for term in ["root", "system", "nt authority\\system"]
        ):
            return "system"
        elif any(term in description for term in ["admin", "administrator", "sudo"]):
            return "admin"
        elif any(term in description for term in ["user", "privilege escalation"]):
            return "user"
        else:
            return "none"

    def _find_dependent_packages(
        self, package: str, dependencies: list[dict[str, Any]]
    ) -> list[str]:
        """Find packages that depend on the given package."""
        dependents = []
        package_lower = package.lower()

        for dep in dependencies:
            dep_name = dep.get("package", {}).get("name", "").lower()
            # This is simplified - would need proper dependency graph in real implementation
            if package_lower in dep_name or dep_name in package_lower:
                dependents.append(dep.get("package", {}).get("name", ""))

        return list(set(dependents))

    def _find_attack_paths(
        self, attack_graph: dict[str, dict[str, Any]], context: ContextualFactors
    ) -> list[list[str]]:
        """Find potential attack paths through the vulnerability graph."""
        paths = []

        # Find starting points (vulnerabilities with no prerequisites)
        starting_points = [
            vuln_id
            for vuln_id, data in attack_graph.items()
            if not self._has_prerequisites(attack_graph, vuln_id, context)
        ]

        # For each starting point, find paths to high-impact vulnerabilities
        for start in starting_points:
            visited = set()
            current_path = [start]
            self._explore_paths(
                attack_graph, start, visited, current_path, paths, context
            )

        return paths

    def _has_prerequisites(
        self, graph: dict[str, dict[str, Any]], vuln_id: str, context: ContextualFactors
    ) -> bool:
        """Check if vulnerability has prerequisites for exploitation."""
        vuln_data = graph[vuln_id]["vulnerability"]

        # Check if authentication is required
        if context.authentication_required and not self._can_bypass_auth(vuln_data):
            return True

        # Check if local access is required for remote application
        if vuln_data.get("attack_vector") == "LOCAL" and context.internet_facing:
            return True

        return False

    def _can_bypass_auth(self, vulnerability: dict[str, Any]) -> bool:
        """Check if vulnerability allows bypassing authentication."""
        description = vulnerability.get("description", "").lower()
        return any(
            term in description
            for term in ["authentication bypass", "auth bypass", "login bypass"]
        )

    def _explore_paths(
        self,
        graph: dict[str, dict[str, Any]],
        current: str,
        visited: set[str],
        current_path: list[str],
        all_paths: list[list[str]],
        context: ContextualConstraints,
        max_depth: int = 5,
    ):
        """Recursively explore attack paths."""
        if len(current_path) >= max_depth:
            return

        visited.add(current)

        # Check if current path is high-impact
        if self._is_high_impact_path(current_path, graph, context):
            all_paths.append(current_path.copy())

        # Explore dependencies
        for dep in graph[current]["dependencies"]:
            if dep not in visited:
                current_path.append(dep)
                self._explore_paths(
                    graph, dep, visited, current_path, all_paths, context, max_depth
                )
                current_path.pop()

        visited.remove(current)

    def _is_high_impact_path(
        self,
        path: list[str],
        graph: dict[str, dict[str, Any]],
        context: ContextualFactors,
    ) -> bool:
        """Check if attack path has high impact."""
        if not path:
            return False

        # Check if any vulnerability in path provides system privileges
        for vuln_id in path:
            if graph[vuln_id]["privileges_gained"] in ["system", "root"]:
                return True

        # Check if path affects critical data
        if context.data_sensitivity in ["high", "critical"]:
            return True

        # Check if path length indicates multiple steps (more complex but possible)
        if len(path) >= 3:
            return True

        return False

    def _create_vulnerability_chain(
        self, path: list[str], vulnerabilities: list[dict[str, Any]]
    ) -> Optional[VulnerabilityChain]:
        """Create a VulnerabilityChain from an attack path."""
        if not path:
            return None

        # Calculate overall impact and feasibility
        overall_impact = self._calculate_chain_impact(path, vulnerabilities)
        feasibility = self._calculate_chain_feasibility(path, vulnerabilities)

        # Generate attack path description
        attack_path = self._generate_attack_description(path, vulnerabilities)

        # Determine required privileges
        required_privileges = self._determine_required_privileges(path, vulnerabilities)

        # Assess detection difficulty
        detection_difficulty = self._assess_detection_difficulty(path, vulnerabilities)

        return VulnerabilityChain(
            chain_id=f"chain_{len(path)}_{hash(''.join(path)) % 10000}",
            vulnerabilities=path,
            attack_path=attack_path,
            overall_impact=overall_impact,
            feasibility=feasibility,
            required_privileges=required_privileges,
            detection_difficulty=detection_difficulty,
        )

    def _calculate_chain_impact(
        self, path: list[str], vulnerabilities: list[dict[str, Any]]
    ) -> float:
        """Calculate overall impact of the vulnerability chain."""
        if not path:
            return 0.0

        # Get vulnerabilities in the path
        path_vulns = [v for v in vulnerabilities if v.get("id") in path]

        if not path_vulns:
            return 0.0

        # Calculate combined impact (not just sum - consider multiplicative effect)
        base_impact = sum(v.get("score", 0) for v in path_vulns)

        # Add bonus for chain length (longer chains can be more impactful)
        chain_bonus = len(path) * 2.0

        # Add bonus for privilege escalation
        privilege_bonus = 0.0
        for vuln in path_vulns:
            if "privilege" in vuln.get("description", "").lower():
                privilege_bonus += 5.0

        total_impact = min(100, base_impact + chain_bonus + privilege_bonus)

        return round(total_impact, 2)

    def _calculate_chain_feasibility(
        self, path: list[str], vulnerabilities: list[dict[str, Any]]
    ) -> float:
        """Calculate feasibility of executing the vulnerability chain."""
        if not path:
            return 0.0

        # Base feasibility decreases with chain length
        base_feasibility = max(20, 100 - (len(path) - 1) * 15)

        # Adjust based on exploit availability
        path_vulns = [v for v in vulnerabilities if v.get("id") in path]

        for vuln in path_vulns:
            if vuln.get("exploit_available"):
                base_feasibility += 10
            elif vuln.get("poc_available"):
                base_feasibility += 5
            else:
                base_feasibility -= 10

        # Adjust based on attack complexity
        for vuln in path_vulns:
            if vuln.get("attack_complexity") == "low":
                base_feasibility += 5
            elif vuln.get("attack_complexity") == "high":
                base_feasibility -= 10

        return min(100, max(0, base_feasibility))

    def _generate_attack_description(
        self, path: list[str], vulnerabilities: list[dict[str, Any]]
    ) -> list[str]:
        """Generate step-by-step attack description."""
        description = []

        for i, vuln_id in enumerate(path):
            vuln = next((v for v in vulnerabilities if v.get("id") == vuln_id), None)
            if vuln:
                step = f"Step {i + 1}: Exploit {vuln.get('id', 'Unknown')} in {vuln.get('package_name', 'Unknown')}"
                if vuln.get("description"):
                    # Extract key information from description
                    desc = vuln["description"][:100]
                    step += f" - {desc}..."
                description.append(step)

        return description

    def _determine_required_privileges(
        self, path: list[str], vulnerabilities: list[dict[str, Any]]
    ) -> list[str]:
        """Determine privileges required at each step of the chain."""
        privileges = []

        for vuln_id in path:
            vuln = next((v for v in vulnerabilities if v.get("id") == vuln_id), None)
            if vuln:
                req_priv = self._extract_required_privileges(vuln)
                privileges.append(req_priv)

        return privileges

    def _extract_required_privileges(self, vulnerability: dict[str, Any]) -> str:
        """Extract required privileges from vulnerability description."""
        description = vulnerability.get("description", "").lower()

        if "unauthenticated" in description or "no authentication" in description:
            return "none"
        elif "user" in description and "privilege" in description:
            return "user"
        elif "admin" in description or "administrator" in description:
            return "admin"
        else:
            return "unknown"

    def _assess_detection_difficulty(
        self, path: list[str], vulnerabilities: list[dict[str, Any]]
    ) -> str:
        """Assess how difficult the attack chain would be to detect."""
        score = 0

        for vuln_id in path:
            vuln = next((v for v in vulnerabilities if v.get("id") == vuln_id), None)
            if vuln:
                # Check for stealthy characteristics
                description = vuln.get("description", "").lower()

                if (
                    "memory corruption" in description
                    or "use-after-free" in description
                ):
                    score += 2  # Harder to detect
                elif "injection" in description:
                    score += 1  # Medium difficulty
                elif "dos" in description or "denial of service" in description:
                    score -= 1  # Easier to detect
                elif "remote code" in description:
                    score += 1  # Medium difficulty

        if score >= 3:
            return "hard"
        elif score >= 1:
            return "medium"
        else:
            return "easy"


class AttackPathVisualizer:
    """Generates visual representations of attack paths."""

    def __init__(self):
        self.node_colors = {
            "critical": "#ff4444",
            "high": "#ff8800",
            "medium": "#ffaa00",
            "low": "#00aaff",
        }

    def generate_attack_graph(
        self, chains: list[VulnerabilityChain], vulnerabilities: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """
        Generate a visual representation of attack paths.

        Returns:
            Dictionary containing graph data for visualization
        """
        graph = {
            "nodes": [],
            "edges": [],
            "metadata": {
                "total_chains": len(chains),
                "highest_impact": max([c.overall_impact for c in chains])
                if chains
                else 0,
                "generated_at": datetime.utcnow().isoformat(),
            },
        }

        # Add nodes for each vulnerability
        added_nodes = set()
        for chain in chains:
            for vuln_id in chain.vulnerabilities:
                if vuln_id not in added_nodes:
                    vuln = next(
                        (v for v in vulnerabilities if v.get("id") == vuln_id), None
                    )
                    if vuln:
                        node = {
                            "id": vuln_id,
                            "label": f"{vuln.get('package_name', 'Unknown')}\\n{vuln_id}",
                            "color": self.node_colors.get(
                                vuln.get("severity", "low"), "#999999"
                            ),
                            "size": 20 + (vuln.get("score", 0) * 2),
                            "metadata": {
                                "severity": vuln.get("severity"),
                                "score": vuln.get("score"),
                                "description": vuln.get("description", "")[:200],
                            },
                        }
                        graph["nodes"].append(node)
                        added_nodes.add(vuln_id)

        # Add edges for each chain
        for chain in chains:
            for i in range(len(chain.vulnerabilities) - 1):
                edge = {
                    "source": chain.vulnerabilities[i],
                    "target": chain.vulnerabilities[i + 1],
                    "label": f"Chain Impact: {chain.overall_impact}%",
                    "width": max(1, chain.overall_impact / 20),
                    "color": "#ff0000" if chain.overall_impact > 70 else "#ff8800",
                    "metadata": {
                        "chain_id": chain.chain_id,
                        "feasibility": chain.feasibility,
                        "detection_difficulty": chain.detection_difficulty,
                    },
                }
                graph["edges"].append(edge)

        return graph

    def generate_chain_summary(
        self, chains: list[VulnerabilityChain]
    ) -> list[dict[str, Any]]:
        """Generate a summary of all vulnerability chains."""
        summary = []

        for chain in chains:
            summary.append(
                {
                    "chain_id": chain.chain_id,
                    "vulnerability_count": len(chain.vulnerabilities),
                    "overall_impact": chain.overall_impact,
                    "feasibility": chain.feasibility,
                    "risk_level": self._calculate_chain_risk_level(chain),
                    "attack_steps": chain.attack_path,
                    "required_privileges": chain.required_privileges,
                    "detection_difficulty": chain.detection_difficulty,
                    "recommendations": self._generate_chain_recommendations(chain),
                }
            )

        # Sort by overall impact
        summary.sort(key=lambda s: s["overall_impact"], reverse=True)

        return summary

    def _calculate_chain_risk_level(self, chain: VulnerabilityChain) -> str:
        """Calculate risk level for the entire chain."""
        risk_score = (chain.overall_impact + chain.feasibility) / 2

        if risk_score >= 80:
            return "critical"
        elif risk_score >= 60:
            return "high"
        elif risk_score >= 40:
            return "medium"
        else:
            return "low"

    def _generate_chain_recommendations(self, chain: VulnerabilityChain) -> list[str]:
        """Generate recommendations for mitigating the attack chain."""
        recommendations = []

        # General recommendations based on chain characteristics
        if chain.overall_impact >= 70:
            recommendations.append(
                "This is a high-impact attack chain - prioritize fixing the first vulnerability"
            )

        if chain.feasibility >= 60:
            recommendations.append(
                "High feasibility indicates this chain could be exploited - implement immediate mitigations"
            )

        if len(chain.vulnerabilities) > 2:
            recommendations.append(
                "Multi-step attack detected - breaking any single step will prevent the chain"
            )

        if (
            "admin" in chain.required_privileges
            or "system" in chain.required_privileges
        ):
            recommendations.append(
                "Chain can lead to privilege escalation - implement strict access controls"
            )

        if chain.detection_difficulty == "hard":
            recommendations.append(
                "Difficult to detect attack - implement behavioral monitoring and anomaly detection"
            )

        return recommendations


class AdvancedRiskAssessmentEngine:
    """Main engine for advanced vulnerability risk assessment."""

    def __init__(self):
        self.exploitability_assessor = ExploitabilityAssessor()
        self.contextual_scorer = ContextualRiskScorer()
        self.chain_analyzer = VulnerabilityChainAnalyzer()
        self.visualizer = AttackPathVisualizer()

    async def assess_vulnerability_risk(
        self,
        vulnerability: dict[str, Any],
        project_context: ContextualFactors,
        project_dependencies: list[dict[str, Any]],
        exploit_intelligence: Optional[dict[str, Any]] = None,
        all_vulnerabilities: Optional[list[dict[str, Any]]] = None,
    ) -> RiskAssessmentResult:
        """
        Perform comprehensive risk assessment for a vulnerability.

        Args:
            vulnerability: Vulnerability data
            project_context: Project-specific context
            project_dependencies: List of project dependencies
            exploit_intelligence: Additional exploit intelligence
            all_vulnerabilities: All vulnerabilities in the project for chaining analysis

        Returns:
            Complete risk assessment result
        """
        try:
            # Assess exploitability
            exploitability = self.exploitability_assessor.assess_exploitability(
                vulnerability, exploit_intelligence
            )

            # Calculate contextual risk score
            contextual_score = self.contextual_scorer.calculate_contextual_risk(
                vulnerability, exploitability, project_context, project_dependencies
            )

            # Calculate exploitability score
            exploitability_score = self._calculate_exploitability_score(exploitability)

            # Calculate impact score
            impact_score = self._calculate_impact_score(vulnerability)

            # Calculate overall risk score
            overall_score = self._calculate_overall_risk_score(
                contextual_score, exploitability_score, impact_score
            )

            # Determine risk level
            risk_level = self._determine_risk_level(overall_score)

            # Generate attack vectors
            attack_vectors = self._generate_attack_vectors(exploitability)

            # Generate potential impacts
            potential_impacts = self._generate_potential_impacts(
                vulnerability, project_context
            )

            # Generate mitigation strategies
            mitigation_strategies = self._generate_mitigation_strategies(
                vulnerability, exploitability, project_context
            )

            # Analyze chaining potential
            chaining_potential = []
            attack_paths = []
            if all_vulnerabilities:
                chains = self.chain_analyzer.analyze_vulnerability_chains(
                    all_vulnerabilities, project_dependencies, project_context
                )
                # Find chains that include this vulnerability
                for chain in chains:
                    if vulnerability.get("id") in chain.vulnerabilities:
                        chaining_potential.extend(
                            [
                                v
                                for v in chain.vulnerabilities
                                if v != vulnerability.get("id")
                            ]
                        )
                        attack_paths.append(chain)
                chaining_potential = list(set(chaining_potential))

            return RiskAssessmentResult(
                vulnerability_id=vulnerability.get("id", "unknown"),
                base_score=vulnerability.get("score", 0),
                exploitability_score=exploitability_score,
                impact_score=impact_score,
                contextual_risk_score=contextual_score,
                overall_risk_score=overall_score,
                risk_level=risk_level,
                exploitability_factors=exploitability,
                contextual_factors=project_context,
                attack_vectors=attack_vectors,
                potential_impacts=potential_impacts,
                mitigation_strategies=mitigation_strategies,
                chaining_potential=chaining_potential,
                attack_paths=attack_paths,
                confidence=exploitability.confidence,
                assessment_date=datetime.utcnow(),
                metadata={
                    "exploit_intelligence": exploit_intelligence or {},
                    "assessment_version": "1.0",
                },
            )

        except Exception as e:
            logger.error(f"Error in vulnerability risk assessment: {e}")
            raise

    def _calculate_exploitability_score(
        self, exploitability: ExploitabilityFactors
    ) -> float:
        """Calculate exploitability score from factors."""
        score = 50.0  # Base score

        # Adjust based on attack vector
        if exploitability.attack_vector == AttackVector.NETWORK:
            score += 20
        elif exploitability.attack_vector == AttackVector.ADJACENT:
            score += 15
        elif exploitability.attack_vector == AttackVector.LOCAL:
            score += 10
        else:
            score += 5

        # Adjust based on attack complexity
        if exploitability.attack_complexity == AttackComplexity.LOW:
            score += 15
        else:
            score -= 10

        # Adjust based on privileges required
        if exploitability.privileges_required == PrivilegesRequired.NONE:
            score += 20
        elif exploitability.privileges_required == PrivilegesRequired.LOW:
            score += 10
        else:
            score -= 5

        # Adjust based on user interaction
        if exploitability.user_interaction == UserInteraction.NONE:
            score += 10
        else:
            score -= 5

        # Adjust based on exploit code maturity
        score += exploitability.exploit_code_maturity * 20

        # Adjust based on remediation level
        score -= exploitability.remediation_level * 10

        return min(100, max(0, score))

    def _calculate_impact_score(self, vulnerability: dict[str, Any]) -> float:
        """Calculate impact score from vulnerability characteristics."""
        base_score = vulnerability.get("score", 0) * 10

        # Adjust based on CVSS impact metrics if available
        description = vulnerability.get("description", "").lower()

        # Check for remote code execution
        if any(
            term in description
            for term in ["remote code execution", "rce", "arbitrary code"]
        ):
            base_score = min(100, base_score + 20)

        # Check for data exposure
        if any(
            term in description
            for term in ["information disclosure", "data leak", "sensitive data"]
        ):
            base_score = min(100, base_score + 15)

        # Check for denial of service
        if any(
            term in description for term in ["denial of service", "dos", "availability"]
        ):
            base_score = min(100, base_score + 10)

        return base_score

    def _calculate_overall_risk_score(
        self, contextual: float, exploitability: float, impact: float
    ) -> float:
        """Calculate overall risk score combining all factors."""
        # Weighted combination
        overall = contextual * 0.4 + exploitability * 0.3 + impact * 0.3

        return round(min(100, overall), 2)

    def _determine_risk_level(self, score: float) -> str:
        """Determine risk level from score."""
        if score >= 90:
            return "critical"
        elif score >= 70:
            return "high"
        elif score >= 40:
            return "medium"
        else:
            return "low"

    def _generate_attack_vectors(
        self, exploitability: ExploitabilityFactors
    ) -> list[str]:
        """Generate list of possible attack vectors."""
        vectors = []

        if exploitability.attack_vector == AttackVector.NETWORK:
            vectors.append("Network-based attack")
        elif exploitability.attack_vector == AttackVector.ADJACENT:
            vectors.append("Adjacent network attack")
        elif exploitability.attack_vector == AttackVector.LOCAL:
            vectors.append("Local attack")
        else:
            vectors.append("Physical access required")

        if exploitability.scope == Scope.CHANGED:
            vectors.append("Can escape security boundaries")

        if exploitability.privileges_required == PrivilegesRequired.NONE:
            vectors.append("No privileges required")
        elif exploitability.privileges_required == PrivilegesRequired.LOW:
            vectors.append("Low privileges required")
        else:
            vectors.append("High privileges required")

        return vectors

    def _generate_potential_impacts(
        self, vulnerability: dict[str, Any], context: ContextualFactors
    ) -> list[str]:
        """Generate list of potential impacts."""
        impacts = []
        description = vulnerability.get("description", "").lower()

        # Security impacts
        if any(term in description for term in ["remote code", "arbitrary code"]):
            impacts.append("Complete system compromise")

        if "privilege escalation" in description:
            impacts.append("Privilege escalation")

        if "information disclosure" in description or "data leak" in description:
            impacts.append("Sensitive data exposure")

        if "denial of service" in description:
            impacts.append("Service disruption")

        # Business impacts based on context
        if context.business_criticality in ["high", "critical"]:
            impacts.append("Business operations impact")

        if context.data_sensitivity in ["high", "critical"]:
            impacts.append("Regulatory compliance violation")

        if context.user_base_size > 10000:
            impacts.append("Wide user impact")

        return list(set(impacts))

    def _generate_mitigation_strategies(
        self,
        vulnerability: dict[str, Any],
        exploitability: ExploitabilityFactors,
        context: ContextualFactors,
    ) -> list[str]:
        """Generate mitigation strategies."""
        strategies = []

        # Primary mitigation
        if vulnerability.get("fixed_versions"):
            strategies.append("Update to fixed version")
        elif vulnerability.get("patch_available"):
            strategies.append("Apply security patch")
        else:
            strategies.append("Monitor for security updates")

        # Compensating controls based on exploitability
        if exploitability.attack_vector == AttackVector.NETWORK:
            strategies.append("Implement network segmentation")
            strategies.append("Restrict network access with firewalls")

        if exploitability.user_interaction == UserInteraction.REQUIRED:
            strategies.append("Implement user awareness training")
            strategies.append("Add security warnings for suspicious actions")

        if exploitability.privileges_required != PrivilegesRequired.NONE:
            strategies.append("Implement principle of least privilege")
            strategies.append("Review and restrict user permissions")

        # Context-specific mitigations
        if context.internet_facing:
            strategies.append("Implement Web Application Firewall (WAF)")
            strategies.append("Enable DDoS protection")

        if context.data_sensitivity in ["high", "critical"]:
            strategies.append("Implement data encryption at rest and in transit")
            strategies.append("Enable detailed audit logging")

        # Monitoring and detection
        strategies.append("Implement security monitoring and alerting")
        strategies.append("Regular vulnerability scanning")

        return list(set(strategies))
