"""
Security Scanning Service for Universal Dependency Platform.

Provides comprehensive vulnerability scanning using NVD database integration,
vulnerability matching logic, severity classification, and report generation.
Supports multiple vulnerability sources and automated vulnerability assessment.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import UUID, uuid4

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.models.vulnerability import Vulnerability
from ..core.services import (
    ServiceException,
)
from .base import BaseService

logger = logging.getLogger(__name__)


class SecurityScanningService(BaseService):
    """
    Service for comprehensive security scanning and vulnerability management.

    Integrates with NVD database and other vulnerability sources to provide
    automated vulnerability detection, classification, and reporting.
    """

    model_class = Vulnerability

    def __init__(self, db_session: AsyncSession):
        super().__init__(db_session)
        self.nvd_api_base = "https://services.nvd.nist.gov/rest/json/cves/2.0"
        self.github_advisories_api = "https://api.github.com/advisories"
        self.osv_api = "https://osv.dev/api/v1/query"
        self.cache_ttl = timedelta(hours=24)
        self.request_timeout = 30
        self.rate_limit_delay = 0.1  # 100ms between requests to respect rate limits

    async def get_service_dependencies(self) -> dict:
        """Define service dependencies."""
        return {
            "dependency_service": "DependencyService",
            "package_service": "PackageService",
        }

    async def scan_project_vulnerabilities(
        self,
        project_id: str,
        force_rescan: bool = False,
        include_transitive: bool = True,
        severity_threshold: str = "low",
        scanned_by: Optional[UUID] = None,
    ) -> dict[str, Any]:
        """
        Perform comprehensive vulnerability scan for a project.

        Args:
            project_id: Project to scan
            force_rescan: Force re-scan even if recent scan exists
            include_transitive: Include transitive dependencies
            severity_threshold: Minimum severity to report (low, medium, high, critical)
            scanned_by: User requesting the scan

        Returns:
            Scan results with vulnerability information and recommendations
        """
        try:
            logger.info(f"Starting vulnerability scan for project {project_id}")

            # Get project dependencies
            dependency_service = await self._get_dependency("dependency_service")
            dependencies = await dependency_service.get_project_dependencies(
                project_id, include_transitive=include_transitive
            )

            if not dependencies.get("dependencies"):
                logger.info(f"No dependencies found for project {project_id}")
                return {
                    "project_id": project_id,
                    "scan_id": str(uuid4()),
                    "total_dependencies": 0,
                    "vulnerabilities": [],
                    "summary": {
                        "total": 0,
                        "critical": 0,
                        "high": 0,
                        "medium": 0,
                        "low": 0,
                    },
                }

            # Check if recent scan exists
            if not force_rescan:
                recent_scan = await self._get_recent_scan(project_id, hours=24)
                if recent_scan:
                    logger.info(f"Using recent scan for project {project_id}")
                    return recent_scan

            # Create scan record
            scan_id = uuid4()
            scan_start_time = datetime.utcnow()

            # Scan each dependency for vulnerabilities
            all_vulnerabilities = []
            dependency_service = await self._get_dependency("dependency_service")

            for dep in dependencies["dependencies"]:
                package_info = dep["package"]
                vulnerabilities = await self.scan_package_vulnerabilities(
                    package_info["name"],
                    package_info["ecosystem"],
                    package_info["version"],
                )

                # Filter by severity threshold
                filtered_vulns = self._filter_vulnerabilities_by_severity(
                    vulnerabilities, severity_threshold
                )

                # Add project context
                for vuln in filtered_vulns:
                    vuln["dependency_id"] = dep["id"]
                    vuln["is_direct"] = dep["is_direct"]
                    vuln["is_dev_dependency"] = dep.get("is_dev_dependency", False)

                all_vulnerabilities.extend(filtered_vulns)

            # Classify and prioritize vulnerabilities
            classified_vulns = await self._classify_vulnerabilities(all_vulnerabilities)

            # Generate vulnerability report
            report = await self._generate_vulnerability_report(
                project_id, scan_id, classified_vulns, dependencies, scan_start_time
            )

            # Store scan results
            await self._store_scan_results(project_id, scan_id, report, scanned_by)

            logger.info(
                f"Completed vulnerability scan for project {project_id}",
                total_vulnerabilities=len(classified_vulns),
                scan_duration_seconds=(
                    datetime.utcnow() - scan_start_time
                ).total_seconds(),
            )

            return report

        except Exception as e:
            logger.error(f"Failed to scan project vulnerabilities: {e}")
            raise ServiceException(
                f"Vulnerability scan failed: {str(e)}",
                error_code="SCAN_FAILED",
            )

    async def scan_package_vulnerabilities(
        self, package_name: str, ecosystem: str, version: str
    ) -> list[dict[str, Any]]:
        """
        Scan a specific package for vulnerabilities.

        Args:
            package_name: Package name
            ecosystem: Package ecosystem (npm, pip, maven, etc.)
            version: Package version

        Returns:
            List of vulnerabilities found for the package
        """
        try:
            logger.debug(f"Scanning package {package_name}@{version} ({ecosystem})")

            vulnerabilities = []

            # Query NVD database
            nvd_vulns = await self._query_nvd_database(package_name, ecosystem, version)
            vulnerabilities.extend(nvd_vulns)

            # Query GitHub Advisory Database
            github_vulns = await self._query_github_advisories(
                package_name, ecosystem, version
            )
            vulnerabilities.extend(github_vulns)

            # Query OSV.dev
            osv_vulns = await self._query_osv_database(package_name, ecosystem, version)
            vulnerabilities.extend(osv_vulns)

            # Deduplicate vulnerabilities
            unique_vulns = self._deduplicate_vulnerabilities(vulnerabilities)

            logger.debug(
                f"Found {len(unique_vulns)} vulnerabilities for {package_name}@{version}"
            )

            return unique_vulns

        except Exception as e:
            logger.error(f"Failed to scan package {package_name}@{version}: {e}")
            return []

    async def _query_nvd_database(
        self, package_name: str, ecosystem: str, version: str
    ) -> list[dict[str, Any]]:
        """
        Query NVD database for package vulnerabilities.

        Args:
            package_name: Package name
            ecosystem: Package ecosystem
            version: Package version

        Returns:
            List of NVD vulnerabilities
        """
        try:
            vulnerabilities = []

            # Build search query for NVD API
            search_params = self._build_nvd_search_params(
                package_name, ecosystem, version
            )

            async with httpx.AsyncClient(timeout=self.request_timeout) as client:
                response = await client.get(self.nvd_api_base, params=search_params)
                response.raise_for_status()

                data = response.json()

                if "vulnerabilities" in data:
                    for vuln_data in data["vulnerabilities"]:
                        vulnerability = self._parse_nvd_vulnerability(
                            vuln_data, package_name, version
                        )
                        if vulnerability:
                            vulnerabilities.append(vulnerability)

            # Respect rate limiting
            await asyncio.sleep(self.rate_limit_delay)

            return vulnerabilities

        except httpx.HTTPError as e:
            logger.warning(f"NVD API request failed: {e}")
            return []
        except Exception as e:
            logger.error(f"Error querying NVD database: {e}")
            return []

    async def _query_github_advisories(
        self, package_name: str, ecosystem: str, version: str
    ) -> list[dict[str, Any]]:
        """
        Query GitHub Advisory Database for vulnerabilities.

        Args:
            package_name: Package name
            ecosystem: Package ecosystem
            version: Package version

        Returns:
            List of GitHub Advisory vulnerabilities
        """
        try:
            vulnerabilities = []

            # Map ecosystem to GitHub ecosystem names
            ecosystem_map = {
                "npm": "npm",
                "pip": "pip",
                "maven": "maven",
                "cargo": "cargo",
                "nuget": "nuget",
                "composer": "composer",
                "rubygems": "rubygems",
                "go": "go",
            }

            github_ecosystem = ecosystem_map.get(ecosystem.lower())
            if not github_ecosystem:
                return vulnerabilities

            # Build query for GitHub API
            query = f"package:{github_ecosystem}/{package_name} version:{version}"
            params = {
                "type": "vulnerability",
                "state": "published",
                "q": query,
                "per_page": 100,
            }

            async with httpx.AsyncClient(timeout=self.request_timeout) as client:
                response = await client.get(self.github_advisories_api, params=params)
                response.raise_for_status()

                data = response.json()

                if "items" in data:
                    for advisory in data["items"]:
                        vulnerability = self._parse_github_advisory(
                            advisory, package_name, version
                        )
                        if vulnerability:
                            vulnerabilities.append(vulnerability)

            # Respect rate limiting
            await asyncio.sleep(self.rate_limit_delay)

            return vulnerabilities

        except httpx.HTTPError as e:
            logger.warning(f"GitHub Advisory API request failed: {e}")
            return []
        except Exception as e:
            logger.error(f"Error querying GitHub Advisory Database: {e}")
            return []

    async def _query_osv_database(
        self, package_name: str, ecosystem: str, version: str
    ) -> list[dict[str, Any]]:
        """
        Query OSV.dev database for vulnerabilities.

        Args:
            package_name: Package name
            ecosystem: Package ecosystem
            version: Package version

        Returns:
            List of OSV vulnerabilities
        """
        try:
            vulnerabilities = []

            # Build query for OSV API
            query = {
                "package": {
                    "name": package_name,
                    "ecosystem": self._osv_ecosystem(ecosystem),
                    "version": version,
                }
            }

            async with httpx.AsyncClient(timeout=self.request_timeout) as client:
                response = await client.post(self.osv_api, json=query)
                response.raise_for_status()

                data = response.json()

                if "vulns" in data:
                    for vuln in data["vulns"]:
                        vulnerability = self._parse_osv_vulnerability(
                            vuln, package_name, version
                        )
                        if vulnerability:
                            vulnerabilities.append(vulnerability)

            # Respect rate limiting
            await asyncio.sleep(self.rate_limit_delay)

            return vulnerabilities

        except httpx.HTTPError as e:
            logger.warning(f"OSV API request failed: {e}")
            return []
        except Exception as e:
            logger.error(f"Error querying OSV database: {e}")
            return []

    @staticmethod
    def _osv_ecosystem(ecosystem: str) -> str:
        """Map ecosystem name to OSV-expected format."""
        mapping = {
            "maven": "Maven",
            "npm": "npm",
            "pip": "PyPI",
            "pypi": "PyPI",
            "cargo": "crates.io",
            "nuget": "NuGet",
            "composer": "Packagist",
            "rubygems": "RubyGems",
            "go": "Go",
            "hex": "Hex",
        }
        return mapping.get(ecosystem.lower(), ecosystem)

    def _build_nvd_search_params(
        self, package_name: str, ecosystem: str, version: str
    ) -> dict[str, str]:
        """Build search parameters for NVD API."""
        # For Maven, package_name is groupId:artifactId - use the artifactId for keyword search
        if ":" in package_name:
            search_name = package_name.split(":")[-1]
        else:
            search_name = package_name

        return {
            "keywordSearch": search_name,
            "resultsPerPage": "20",
        }

    def _parse_nvd_vulnerability(
        self, vuln_data: dict[str, Any], package_name: str, version: str
    ) -> Optional[dict[str, Any]]:
        """Parse NVD vulnerability data into standard format."""
        try:
            cve = vuln_data.get("cve", {})
            cve_id = cve.get("id", "")

            # Extract description
            descriptions = cve.get("descriptions", [])
            description = ""
            for desc in descriptions:
                if desc.get("lang") == "en":
                    description = desc.get("value", "")
                    break

            # Extract CVSS scores
            cvss_v3 = (
                cve.get("metrics", {}).get("cvssMetricV31", [{}])[0].get("cvssData", {})
            )
            cvss_score = cvss_v3.get("baseScore", 0)
            cvss_vector = cvss_v3.get("vectorString", "")

            # Determine severity
            severity = self._classify_cvss_severity(cvss_score)

            # Extract references
            references = []
            for ref in cve.get("references", []):
                if ref.get("url"):
                    references.append(
                        {
                            "url": ref["url"],
                            "source": ref.get("source", ""),
                            "tags": ref.get("tags", []),
                        }
                    )

            # Extract modified/published dates
            published_date = cve.get("published", "")
            modified_date = cve.get("lastModified", "")

            return {
                "id": cve_id,
                "source": "nvd",
                "title": cve_id,
                "description": description,
                "severity": severity,
                "score": cvss_score,
                "vector": cvss_vector,
                "published_at": published_date,
                "modified_at": modified_date,
                "references": references,
                "affected_versions": [version],
                "package_name": package_name,
                "ecosystem": ecosystem,
            }

        except Exception as e:
            logger.error(f"Error parsing NVD vulnerability: {e}")
            return None

    async def _parse_github_advisory(
        self, advisory: dict[str, Any], package_name: str, version: str
    ) -> Optional[dict[str, Any]]:
        """Parse GitHub Advisory data into standard format."""
        try:
            advisory_data = advisory.get("advisory", {})

            ghsa_id = advisory_data.get("ghsa_id", "")
            severity = advisory_data.get("severity", "unknown").upper()

            # Map GitHub severity to our classification
            severity_map = {
                "CRITICAL": "critical",
                "HIGH": "high",
                "MEDIUM": "medium",
                "LOW": "low",
                "UNKNOWN": "unknown",
            }

            classified_severity = severity_map.get(severity, "unknown")

            # Extract CVE if available
            cve_id = None
            for ident in advisory_data.get("identifiers", []):
                if ident.get("type") == "CVE":
                    cve_id = ident.get("value")
                    break

            # Get CVE score if available (from NVD)
            score = 0
            if cve_id:
                score = await self._get_cve_score(cve_id)

            return {
                "id": ghsa_id,
                "cve_id": cve_id,
                "source": "github",
                "title": advisory_data.get("summary", ""),
                "description": advisory_data.get("description", ""),
                "severity": classified_severity,
                "score": score,
                "published_at": advisory_data.get("published_at", ""),
                "modified_at": advisory_data.get("updated_at", ""),
                "references": advisory_data.get("references", []),
                "affected_versions": [version],
                "package_name": package_name,
                "ecosystem": ecosystem,
            }

        except Exception as e:
            logger.error(f"Error parsing GitHub Advisory: {e}")
            return None

    def _parse_osv_vulnerability(
        self, vuln: dict[str, Any], package_name: str, version: str
    ) -> Optional[dict[str, Any]]:
        """Parse OSV vulnerability data into standard format."""
        try:
            vuln_id = vuln.get("id", "")

            # Extract summary/description
            summary = vuln.get("summary", "")
            details = vuln.get("details", "")
            description = summary if summary else details

            # Get severity and score from CVSS
            severity = "unknown"
            score = 0

            for severity_item in vuln.get("severity", []):
                if severity_item.get("type") == "CVSS_V3":
                    score = severity_item.get("score", 0)
                    severity = self._classify_cvss_severity(score)
                    break

            # Get dates
            published = vuln.get("published", "")
            modified = vuln.get("modified", "")

            # Get references
            references = []
            for ref in vuln.get("references", []):
                references.append(
                    {
                        "url": ref.get("url", ""),
                        "type": ref.get("type", ""),
                    }
                )

            return {
                "id": vuln_id,
                "source": "osv",
                "title": vuln_id,
                "description": description,
                "severity": severity,
                "score": score,
                "published_at": published,
                "modified_at": modified,
                "references": references,
                "affected_versions": [version],
                "package_name": package_name,
                "ecosystem": ecosystem,
            }

        except Exception as e:
            logger.error(f"Error parsing OSV vulnerability: {e}")
            return None

    def _classify_cvss_severity(self, score: float) -> str:
        """Classify CVSS score to severity level."""
        if score >= 9.0:
            return "critical"
        elif score >= 7.0:
            return "high"
        elif score >= 4.0:
            return "medium"
        elif score > 0:
            return "low"
        else:
            return "unknown"

    def _deduplicate_vulnerabilities(
        self, vulnerabilities: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Deduplicate vulnerabilities from multiple sources."""
        seen = set()
        unique_vulns = []

        for vuln in vulnerabilities:
            # Create a unique key based on CVE ID or title
            key = vuln.get("cve_id") or vuln.get("id") or vuln.get("title")

            if key and key not in seen:
                seen.add(key)
                unique_vulns.append(vuln)

        return unique_vulns

    def _filter_vulnerabilities_by_severity(
        self, vulnerabilities: list[dict[str, Any]], threshold: str
    ) -> list[dict[str, Any]]:
        """Filter vulnerabilities by severity threshold."""
        severity_order = {"low": 0, "medium": 1, "high": 2, "critical": 3}
        threshold_value = severity_order.get(threshold.lower(), 0)

        filtered = []
        for vuln in vulnerabilities:
            severity = vuln.get("severity", "unknown").lower()
            severity_value = severity_order.get(severity, 0)

            if severity_value >= threshold_value:
                filtered.append(vuln)

        return filtered

    async def _classify_vulnerabilities(
        self, vulnerabilities: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Classify and prioritize vulnerabilities."""
        for vuln in vulnerabilities:
            # Add risk assessment
            vuln["risk_assessment"] = await self._assess_vulnerability_risk(vuln)

            # Add remediation suggestions
            vuln["remediation"] = await self._generate_remediation_suggestions(vuln)

        # Sort by severity and score
        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "unknown": 0}
        vulnerabilities.sort(
            key=lambda v: (
                severity_order.get(v.get("severity", "unknown"), 0),
                v.get("score", 0),
            ),
            reverse=True,
        )

        return vulnerabilities

    async def _assess_vulnerability_risk(
        self, vulnerability: dict[str, Any]
    ) -> dict[str, Any]:
        """Assess risk level and impact of vulnerability."""
        severity = vulnerability.get("severity", "unknown")
        score = vulnerability.get("score", 0)

        # Risk factors
        risk_factors = {
            "severity": severity,
            "score": score,
            "age_days": 0,  # Would calculate based on published date
            "exploit_available": False,  # Would check exploit databases
            "has_fix": True,  # Would check if fixed version exists
        }

        # Calculate overall risk score (0-100)
        risk_score = min(100, score * 10)  # Convert CVSS 0-10 to 0-100

        # Adjust for additional factors
        if risk_factors["exploit_available"]:
            risk_score = min(100, risk_score + 20)

        if not risk_factors["has_fix"]:
            risk_score = min(100, risk_score + 15)

        risk_level = "low"
        if risk_score >= 80:
            risk_level = "critical"
        elif risk_score >= 60:
            risk_level = "high"
        elif risk_score >= 40:
            risk_level = "medium"

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "factors": risk_factors,
        }

    async def _generate_remediation_suggestions(
        self, vulnerability: dict[str, Any]
    ) -> dict[str, Any]:
        """Generate remediation suggestions for vulnerability."""
        severity = vulnerability.get("severity", "unknown")
        package_name = vulnerability.get("package_name", "")
        ecosystem = vulnerability.get("ecosystem", "")

        suggestions = {
            "action": "upgrade",
            "priority": "medium",
            "estimated_effort": "low",
            "recommendations": [],
        }

        # Generate recommendations based on severity
        if severity == "critical":
            suggestions["priority"] = "immediate"
            suggestions["recommendations"] = [
                "Upgrade to the latest patched version immediately",
                "Apply temporary mitigations if upgrade is not possible",
                "Monitor for exploitation attempts",
                "Consider removing the dependency if not essential",
            ]
        elif severity == "high":
            suggestions["priority"] = "high"
            suggestions["recommendations"] = [
                "Upgrade to patched version within 7 days",
                "Review alternative packages if upgrade not possible",
                "Apply additional security controls",
            ]
        elif severity == "medium":
            suggestions["priority"] = "medium"
            suggestions["recommendations"] = [
                "Schedule upgrade in next release cycle",
                "Monitor for security updates",
                "Consider risk vs. upgrade effort",
            ]
        else:  # low
            suggestions["priority"] = "low"
            suggestions["recommendations"] = [
                "Upgrade when convenient",
                "Monitor for changes in severity",
            ]

        # Add ecosystem-specific recommendations
        ecosystem_suggestions = self._get_ecosystem_remediation_suggestions(ecosystem)
        suggestions["recommendations"].extend(ecosystem_suggestions)

        return suggestions

    def _get_ecosystem_remediation_suggestions(self, ecosystem: str) -> list[str]:
        """Get ecosystem-specific remediation suggestions."""
        suggestions = []

        if ecosystem.lower() == "npm":
            suggestions.extend(
                [
                    "Run `npm audit fix` to automatically fix vulnerabilities",
                    "Consider using `package-lock.json` for consistent versions",
                    "Review npm audit recommendations carefully",
                ]
            )
        elif ecosystem.lower() == "pip":
            suggestions.extend(
                [
                    "Use `pip install --upgrade` to update packages",
                    "Consider using virtual environments for isolation",
                    "Review `pip-audit` output for additional context",
                ]
            )
        elif ecosystem.lower() == "maven":
            suggestions.extend(
                [
                    "Use Maven dependency management to control versions",
                    "Review Maven Central for security updates",
                    "Consider using dependency check Maven plugin",
                ]
            )

        return suggestions

    async def _generate_vulnerability_report(
        self,
        project_id: str,
        scan_id: UUID,
        vulnerabilities: list[dict[str, Any]],
        dependencies: dict[str, Any],
        scan_start_time: datetime,
    ) -> dict[str, Any]:
        """Generate comprehensive vulnerability report."""
        scan_end_time = datetime.utcnow()
        scan_duration = (scan_end_time - scan_start_time).total_seconds()

        # Calculate summary statistics
        summary = {
            "total": len(vulnerabilities),
            "critical": len(
                [v for v in vulnerabilities if v.get("severity") == "critical"]
            ),
            "high": len([v for v in vulnerabilities if v.get("severity") == "high"]),
            "medium": len(
                [v for v in vulnerabilities if v.get("severity") == "medium"]
            ),
            "low": len([v for v in vulnerabilities if v.get("severity") == "low"]),
        }

        # Group vulnerabilities by package
        vulnerabilities_by_package = {}
        for vuln in vulnerabilities:
            package_key = f"{vuln.get('package_name', 'unknown')}@{vuln.get('ecosystem', 'unknown')}"
            if package_key not in vulnerabilities_by_package:
                vulnerabilities_by_package[package_key] = []
            vulnerabilities_by_package[package_key].append(vuln)

        # Generate risk metrics
        risk_metrics = self._calculate_risk_metrics(vulnerabilities)

        # Generate recommendations
        recommendations = self._generate_project_recommendations(
            vulnerabilities, dependencies
        )

        report = {
            "project_id": project_id,
            "scan_id": str(scan_id),
            "scan_date": scan_start_time.isoformat(),
            "scan_duration_seconds": scan_duration,
            "total_dependencies": dependencies.get("total_dependencies", 0),
            "summary": summary,
            "vulnerabilities": vulnerabilities,
            "vulnerabilities_by_package": vulnerabilities_by_package,
            "risk_metrics": risk_metrics,
            "recommendations": recommendations,
        }

        return report

    def _calculate_risk_metrics(
        self, vulnerabilities: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Calculate risk metrics for the project."""
        total_vulns = len(vulnerabilities)
        if total_vulns == 0:
            return {
                "overall_risk_score": 0,
                "overall_risk_level": "low",
                "high_risk_count": 0,
                "medium_risk_count": 0,
                "low_risk_count": 0,
            }

        risk_scores = [
            vuln.get("risk_assessment", {}).get("risk_score", 0)
            for vuln in vulnerabilities
        ]

        # Calculate average risk score
        avg_risk_score = sum(risk_scores) / len(risk_scores)

        # Determine overall risk level
        overall_risk_level = "low"
        if avg_risk_score >= 80:
            overall_risk_level = "critical"
        elif avg_risk_score >= 60:
            overall_risk_level = "high"
        elif avg_risk_score >= 40:
            overall_risk_level = "medium"

        # Count risk levels
        high_risk_count = len([score for score in risk_scores if score >= 60])
        medium_risk_count = len([score for score in risk_scores if 40 <= score < 60])
        low_risk_count = len([score for score in risk_scores if score < 40])

        return {
            "overall_risk_score": round(avg_risk_score, 2),
            "overall_risk_level": overall_risk_level,
            "high_risk_count": high_risk_count,
            "medium_risk_count": medium_risk_count,
            "low_risk_count": low_risk_count,
        }

    def _generate_project_recommendations(
        self, vulnerabilities: list[dict[str, Any]], dependencies: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Generate project-level recommendations."""
        recommendations = []

        if not vulnerabilities:
            recommendations.append(
                {
                    "type": "security",
                    "priority": "info",
                    "title": "No Vulnerabilities Found",
                    "description": "Great job! No vulnerabilities were detected in your dependencies.",
                    "action": "Continue regular security scanning",
                }
            )
            return recommendations

        # Critical vulnerabilities recommendation
        critical_vulns = [v for v in vulnerabilities if v.get("severity") == "critical"]
        if critical_vulns:
            recommendations.append(
                {
                    "type": "security",
                    "priority": "critical",
                    "title": "Critical Vulnerabilities Require Immediate Attention",
                    "description": f"Found {len(critical_vulns)} critical vulnerabilities that should be addressed immediately.",
                    "action": "Upgrade or replace affected packages immediately",
                    "affected_packages": list(
                        set(v.get("package_name") for v in critical_vulns)
                    ),
                }
            )

        # High severity recommendation
        high_vulns = [v for v in vulnerabilities if v.get("severity") == "high"]
        if high_vulns:
            recommendations.append(
                {
                    "type": "security",
                    "priority": "high",
                    "title": "High Severity Vulnerabilities",
                    "description": f"Found {len(high_vulns)} high severity vulnerabilities.",
                    "action": "Schedule upgrades within the next week",
                    "affected_packages": list(
                        set(v.get("package_name") for v in high_vulns)
                    ),
                }
            )

        # Dependency management recommendation
        if dependencies.get("total_dependencies", 0) > 100:
            recommendations.append(
                {
                    "type": "maintenance",
                    "priority": "medium",
                    "title": "Consider Reducing Dependency Count",
                    "description": f"Project has {dependencies.get('total_dependencies')} dependencies. Consider removing unused dependencies.",
                    "action": "Audit and remove unnecessary dependencies",
                }
            )

        # Regular scanning recommendation
        recommendations.append(
            {
                "type": "process",
                "priority": "medium",
                "title": "Implement Regular Security Scanning",
                "description": "Set up automated security scanning in your CI/CD pipeline.",
                "action": "Configure regular vulnerability scans and notifications",
            }
        )

        return recommendations

    async def _store_scan_results(
        self,
        project_id: str,
        scan_id: UUID,
        report: dict[str, Any],
        scanned_by: Optional[UUID],
    ) -> None:
        """Store scan results in database."""
        try:
            # Store individual vulnerabilities
            for vuln in report.get("vulnerabilities", []):
                # Create or update vulnerability record
                await self._store_vulnerability(vuln)

                # Create project-vulnerability relationship
                await self._create_project_vulnerability_relationship(
                    project_id, vuln, scanned_by
                )

            # Store scan metadata (could be a separate scan_results table)
            logger.info(f"Stored scan results for project {project_id}, scan {scan_id}")

        except Exception as e:
            logger.error(f"Failed to store scan results: {e}")
            # Don't raise error - scan results are still returned to user

    async def _store_vulnerability(self, vulnerability_data: dict[str, Any]) -> None:
        """Store vulnerability in database."""
        try:
            # Check if vulnerability already exists
            existing_vuln = await self.get_vulnerability_by_id(vulnerability_data["id"])

            if existing_vuln:
                # Update existing vulnerability
                update_data = {
                    "description": vulnerability_data.get("description"),
                    "severity": vulnerability_data.get("severity"),
                    "score": vulnerability_data.get("score"),
                    "modified_at": datetime.utcnow(),
                }
                await self.update(existing_vuln.id, update_data)
            else:
                # Create new vulnerability
                create_data = {
                    "id": vulnerability_data["id"],
                    "cve_id": vulnerability_data.get("cve_id"),
                    "title": vulnerability_data.get("title"),
                    "description": vulnerability_data.get("description"),
                    "severity": vulnerability_data.get("severity"),
                    "score": vulnerability_data.get("score"),
                    "vector": vulnerability_data.get("vector"),
                    "source": vulnerability_data.get("source"),
                    "published_at": vulnerability_data.get("published_at"),
                    "modified_at": vulnerability_data.get("modified_at"),
                    "references": vulnerability_data.get("references", []),
                    "affected_packages": vulnerability_data.get(
                        "affected_versions", []
                    ),
                }
                await self.create(create_data)

        except Exception as e:
            logger.error(
                f"Failed to store vulnerability {vulnerability_data.get('id')}: {e}"
            )

    async def _create_project_vulnerability_relationship(
        self,
        project_id: str,
        vulnerability_data: dict[str, Any],
        scanned_by: Optional[UUID],
    ) -> None:
        """Create relationship between project and vulnerability."""
        try:
            # This would create a record in project_vulnerabilities table
            # For now, just log the relationship
            logger.debug(
                f"Project {project_id} affected by vulnerability {vulnerability_data.get('id')}"
            )
        except Exception as e:
            logger.error(f"Failed to create project-vulnerability relationship: {e}")

    async def get_vulnerability_by_id(
        self, vulnerability_id: str
    ) -> Optional[Vulnerability]:
        """Get vulnerability by ID."""
        query = select(Vulnerability).where(Vulnerability.id == vulnerability_id)
        result = await self._execute_query(query)
        return result.scalar_one_or_none()

    async def _get_recent_scan(
        self, project_id: str, hours: int = 24
    ) -> Optional[dict[str, Any]]:
        """Get recent scan results for project if available."""
        # This would query scan_results table for recent scans
        # For now, return None to trigger new scan
        return None

    async def get_cve_score(self, cve_id: str) -> float:
        """Get CVE score from NVD database."""
        try:
            # Query NVD API for specific CVE
            params = {"cveId": cve_id}

            async with httpx.AsyncClient(timeout=self.request_timeout) as client:
                response = await client.get(f"{self.nvd_api_base}?cveId={cve_id}")
                response.raise_for_status()

                data = response.json()

                if "vulnerabilities" in data and data["vulnerabilities"]:
                    vuln_data = data["vulnerabilities"][0]
                    cvss_v3 = (
                        vuln_data.get("cve", {})
                        .get("metrics", {})
                        .get("cvssMetricV31", [{}])[0]
                        .get("cvssData", {})
                    )
                    return cvss_v3.get("baseScore", 0)

        except Exception as e:
            logger.error(f"Failed to get CVE score for {cve_id}: {e}")

        return 0

    def _log_operation(self, operation: str, details: dict[str, Any]) -> None:
        """Log security service operations."""
        logger.info(f"SecurityService.{operation}", **details)
