"""
TEDDK Vulnerability Scanner - Scans Java/Maven dependencies against real vulnerability databases.

Focused scanner for the TEDDK project's Maven dependencies using OSV.dev (primary)
and NVD (secondary) as vulnerability data sources.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class VulnerabilityResult:
    """A single vulnerability finding."""

    id: str
    source: str  # "osv" or "nvd"
    aliases: list[str] = field(default_factory=list)
    summary: str = ""
    details: str = ""
    severity: str = "unknown"  # critical, high, medium, low, unknown
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    published: Optional[str] = None
    modified: Optional[str] = None
    references: list[str] = field(default_factory=list)
    fixed_versions: list[str] = field(default_factory=list)
    affected_ranges: list[dict[str, Any]] = field(default_factory=list)
    cwe_ids: list[str] = field(default_factory=list)
    package_name: str = ""
    package_version: str = ""


@dataclass
class PackageScanResult:
    """Scan result for a single package."""

    group_id: str
    artifact_id: str
    version: str
    vulnerabilities: list[VulnerabilityResult] = field(default_factory=list)
    scan_duration_ms: float = 0
    error: Optional[str] = None

    @property
    def name(self) -> str:
        return f"{self.group_id}:{self.artifact_id}"

    @property
    def critical_count(self) -> int:
        return sum(1 for v in self.vulnerabilities if v.severity == "critical")

    @property
    def high_count(self) -> int:
        return sum(1 for v in self.vulnerabilities if v.severity == "high")

    @property
    def medium_count(self) -> int:
        return sum(1 for v in self.vulnerabilities if v.severity == "medium")

    @property
    def low_count(self) -> int:
        return sum(1 for v in self.vulnerabilities if v.severity == "low")


@dataclass
class TEDDKScanReport:
    """Complete scan report for TEDDK project dependencies."""

    scan_id: str = ""
    scan_timestamp: str = ""
    total_packages: int = 0
    total_vulnerabilities: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    packages: list[PackageScanResult] = field(default_factory=list)
    scan_duration_ms: float = 0
    sources_used: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def risk_level(self) -> str:
        if self.critical_count > 0:
            return "critical"
        if self.high_count > 0:
            return "high"
        if self.medium_count > 0:
            return "medium"
        if self.low_count > 0:
            return "low"
        return "none"


class TEDDKVulnerabilityScanner:
    """
    Vulnerability scanner for TEDDK Maven dependencies.

    Uses OSV.dev (primary, free, no API key) and NVD (secondary, rate-limited)
    to scan Maven dependencies for known vulnerabilities.
    """

    OSV_API = "https://api.osv.dev/v1"
    NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0"

    def __init__(
        self,
        nvd_api_key: Optional[str] = None,
        timeout: float = 30.0,
        max_concurrent: int = 5,
        include_nvd: bool = True,
    ):
        self.nvd_api_key = nvd_api_key
        self.timeout = timeout
        self.max_concurrent = max_concurrent
        self.include_nvd = include_nvd

    async def scan_dependencies(
        self,
        dependencies: list[tuple[str, str, str]],
    ) -> TEDDKScanReport:
        """
        Scan a list of Maven dependencies for vulnerabilities.

        Args:
            dependencies: List of (groupId, artifactId, version) tuples

        Returns:
            TEDDKScanReport with all findings
        """
        scan_start = datetime.utcnow()
        report = TEDDKScanReport(
            scan_id=f"teddk-{scan_start.strftime('%Y%m%d%H%M%S')}",
            scan_timestamp=scan_start.isoformat(),
            total_packages=len(dependencies),
            sources_used=["osv"],
        )
        if self.include_nvd:
            report.sources_used.append("nvd")

        semaphore = asyncio.Semaphore(self.max_concurrent)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            tasks = []
            for group_id, artifact_id, version in dependencies:
                tasks.append(
                    self._scan_package(
                        client, semaphore, group_id, artifact_id, version
                    )
                )
            results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                group_id, artifact_id, version = dependencies[i]
                pkg = PackageScanResult(
                    group_id=group_id,
                    artifact_id=artifact_id,
                    version=version,
                    error=str(result),
                )
                report.packages.append(pkg)
                report.errors.append(f"{group_id}:{artifact_id}:{version} - {result}")
            else:
                report.packages.append(result)

        # Aggregate counts
        for pkg in report.packages:
            report.total_vulnerabilities += len(pkg.vulnerabilities)
            report.critical_count += pkg.critical_count
            report.high_count += pkg.high_count
            report.medium_count += pkg.medium_count
            report.low_count += pkg.low_count

        scan_end = datetime.utcnow()
        report.scan_duration_ms = (scan_end - scan_start).total_seconds() * 1000

        return report

    async def _scan_package(
        self,
        client: httpx.AsyncClient,
        semaphore: asyncio.Semaphore,
        group_id: str,
        artifact_id: str,
        version: str,
    ) -> PackageScanResult:
        """Scan a single package against all sources."""
        async with semaphore:
            start = datetime.utcnow()
            result = PackageScanResult(
                group_id=group_id, artifact_id=artifact_id, version=version
            )

            all_vulns: list[VulnerabilityResult] = []

            # Query OSV.dev (primary source)
            try:
                osv_vulns = await self._query_osv(
                    client, group_id, artifact_id, version
                )
                all_vulns.extend(osv_vulns)
            except Exception as e:
                logger.warning(
                    f"OSV query failed for {group_id}:{artifact_id}:{version}: {e}"
                )

            # Query NVD (secondary source)
            if self.include_nvd:
                try:
                    nvd_vulns = await self._query_nvd(
                        client, group_id, artifact_id, version
                    )
                    all_vulns.extend(nvd_vulns)
                except Exception as e:
                    logger.warning(
                        f"NVD query failed for {group_id}:{artifact_id}:{version}: {e}"
                    )

            # Deduplicate
            result.vulnerabilities = self._deduplicate(all_vulns)
            result.scan_duration_ms = (datetime.utcnow() - start).total_seconds() * 1000

            if result.vulnerabilities:
                logger.info(
                    f"Found {len(result.vulnerabilities)} vulnerabilities in "
                    f"{group_id}:{artifact_id}:{version}"
                )

            return result

    async def _query_osv(
        self,
        client: httpx.AsyncClient,
        group_id: str,
        artifact_id: str,
        version: str,
    ) -> list[VulnerabilityResult]:
        """Query OSV.dev for Maven package vulnerabilities."""
        payload = {
            "package": {
                "name": f"{group_id}:{artifact_id}",
                "ecosystem": "Maven",
            },
            "version": version,
        }

        response = await client.post(f"{self.OSV_API}/query", json=payload)
        response.raise_for_status()
        data = response.json()

        vulns = []
        for vuln_data in data.get("vulns", []):
            vuln = self._parse_osv_vuln(vuln_data, group_id, artifact_id, version)
            if vuln:
                vulns.append(vuln)

        return vulns

    def _parse_osv_vuln(
        self,
        data: dict[str, Any],
        group_id: str,
        artifact_id: str,
        version: str,
    ) -> Optional[VulnerabilityResult]:
        """Parse an OSV vulnerability entry."""
        try:
            vuln_id = data.get("id", "")
            aliases = data.get("aliases", [])

            # Extract severity from CVSS
            severity = "unknown"
            cvss_score = None
            cvss_vector = None
            for sev in data.get("severity", []):
                if sev.get("type") == "CVSS_V3":
                    cvss_vector = sev.get("score", "")
                    # Parse score from vector string
                    cvss_score = self._extract_cvss_score_from_vector(cvss_vector)
                    if cvss_score is not None:
                        severity = self._cvss_to_severity(cvss_score)

            # If no CVSS, try database_specific severity
            if severity == "unknown":
                db_specific = data.get("database_specific", {})
                if "severity" in db_specific:
                    severity = db_specific["severity"].lower()

            # Extract fixed versions
            fixed_versions = []
            affected_ranges = []
            for affected in data.get("affected", []):
                for rng in affected.get("ranges", []):
                    range_info = {
                        "type": rng.get("type", ""),
                        "events": rng.get("events", []),
                    }
                    affected_ranges.append(range_info)
                    for event in rng.get("events", []):
                        if "fixed" in event:
                            fixed_versions.append(event["fixed"])

            # Extract references
            references = [
                ref.get("url", "")
                for ref in data.get("references", [])
                if ref.get("url")
            ]

            # Extract CWE IDs
            cwe_ids = []
            for cwe in data.get("database_specific", {}).get("cwe_ids", []):
                if isinstance(cwe, str) and cwe.startswith("CWE-"):
                    cwe_ids.append(cwe)

            return VulnerabilityResult(
                id=vuln_id,
                source="osv",
                aliases=aliases,
                summary=data.get("summary", ""),
                details=data.get("details", ""),
                severity=severity,
                cvss_score=cvss_score,
                cvss_vector=cvss_vector,
                published=data.get("published"),
                modified=data.get("modified"),
                references=references,
                fixed_versions=fixed_versions,
                affected_ranges=affected_ranges,
                cwe_ids=cwe_ids,
                package_name=f"{group_id}:{artifact_id}",
                package_version=version,
            )
        except Exception as e:
            logger.error(f"Failed to parse OSV vulnerability: {e}")
            return None

    async def _query_nvd(
        self,
        client: httpx.AsyncClient,
        group_id: str,
        artifact_id: str,
        version: str,
    ) -> list[VulnerabilityResult]:
        """Query NVD for package vulnerabilities by keyword search."""
        headers = {}
        if self.nvd_api_key:
            headers["apiKey"] = self.nvd_api_key

        params = {
            "keywordSearch": artifact_id,
            "resultsPerPage": "20",
        }

        response = await client.get(self.NVD_API, params=params, headers=headers)

        # NVD rate limits: 5 requests/30s without key, 50/30s with key
        if response.status_code == 403:
            logger.warning("NVD rate limit hit, skipping")
            return []

        response.raise_for_status()
        data = response.json()

        vulns = []
        for vuln_item in data.get("vulnerabilities", []):
            vuln = self._parse_nvd_vuln(vuln_item, group_id, artifact_id, version)
            if vuln:
                vulns.append(vuln)

        return vulns

    def _parse_nvd_vuln(
        self,
        data: dict[str, Any],
        group_id: str,
        artifact_id: str,
        version: str,
    ) -> Optional[VulnerabilityResult]:
        """Parse an NVD CVE entry."""
        try:
            cve = data.get("cve", {})
            cve_id = cve.get("id", "")

            # Extract English description
            description = ""
            for desc in cve.get("descriptions", []):
                if desc.get("lang") == "en":
                    description = desc.get("value", "")
                    break

            # Extract CVSS v3.1 score
            cvss_score = None
            cvss_vector = None
            severity = "unknown"
            metrics = cve.get("metrics", {})
            for metric_key in ["cvssMetricV31", "cvssMetricV30"]:
                metric_list = metrics.get(metric_key, [])
                if metric_list:
                    cvss_data = metric_list[0].get("cvssData", {})
                    cvss_score = cvss_data.get("baseScore")
                    cvss_vector = cvss_data.get("vectorString")
                    if cvss_score is not None:
                        severity = self._cvss_to_severity(cvss_score)
                    break

            # Extract references
            references = [
                ref.get("url", "")
                for ref in cve.get("references", [])
                if ref.get("url")
            ]

            # Extract CWE IDs
            cwe_ids = []
            for weakness in cve.get("weaknesses", []):
                for desc in weakness.get("description", []):
                    if desc.get("lang") == "en":
                        val = desc.get("value", "")
                        if val.startswith("CWE-"):
                            cwe_ids.append(val)

            return VulnerabilityResult(
                id=cve_id,
                source="nvd",
                aliases=[],
                summary=description[:200] if description else "",
                details=description,
                severity=severity,
                cvss_score=cvss_score,
                cvss_vector=cvss_vector,
                published=cve.get("published"),
                modified=cve.get("lastModified"),
                references=references,
                cwe_ids=cwe_ids,
                package_name=f"{group_id}:{artifact_id}",
                package_version=version,
            )
        except Exception as e:
            logger.error(f"Failed to parse NVD vulnerability: {e}")
            return None

    def _deduplicate(
        self, vulns: list[VulnerabilityResult]
    ) -> list[VulnerabilityResult]:
        """Deduplicate vulnerabilities across sources using CVE IDs."""
        seen_ids = set()
        unique = []

        for vuln in vulns:
            # Build set of all IDs for this vuln (id + aliases)
            all_ids = {vuln.id} | set(vuln.aliases)

            # Check if any of these IDs were already seen
            if not all_ids & seen_ids:
                seen_ids.update(all_ids)
                unique.append(vuln)

        # Sort by severity
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "unknown": 4}
        unique.sort(key=lambda v: severity_order.get(v.severity, 4))

        return unique

    @staticmethod
    def _cvss_to_severity(score: float) -> str:
        """Convert CVSS score to severity string."""
        if score >= 9.0:
            return "critical"
        elif score >= 7.0:
            return "high"
        elif score >= 4.0:
            return "medium"
        elif score > 0:
            return "low"
        return "unknown"

    @staticmethod
    def _extract_cvss_score_from_vector(vector: str) -> Optional[float]:
        """Extract numeric CVSS score from vector string if it's a bare score, otherwise return None."""
        if not vector:
            return None
        try:
            return float(vector)
        except ValueError:
            # It's a CVSS vector string like "CVSS:3.1/AV:N/AC:L/..."
            # We can't easily compute the score from the vector alone
            return None


def format_scan_report(report: TEDDKScanReport) -> str:
    """Format a scan report as human-readable text."""
    lines = [
        f"{'=' * 60}",
        "TEDDK Vulnerability Scan Report",
        f"{'=' * 60}",
        f"Scan ID:    {report.scan_id}",
        f"Timestamp:  {report.scan_timestamp}",
        f"Duration:   {report.scan_duration_ms:.0f}ms",
        f"Sources:    {', '.join(report.sources_used)}",
        "",
        "SUMMARY",
        f"{'-' * 60}",
        f"Packages scanned:  {report.total_packages}",
        f"Vulnerabilities:   {report.total_vulnerabilities}",
        f"  Critical:        {report.critical_count}",
        f"  High:            {report.high_count}",
        f"  Medium:          {report.medium_count}",
        f"  Low:             {report.low_count}",
        f"Risk Level:        {report.risk_level.upper()}",
        "",
    ]

    # Per-package details
    vulnerable_packages = [p for p in report.packages if p.vulnerabilities]
    if vulnerable_packages:
        lines.append(f"VULNERABLE PACKAGES ({len(vulnerable_packages)})")
        lines.append(f"{'-' * 60}")
        for pkg in vulnerable_packages:
            lines.append("")
            lines.append(f"  {pkg.name}:{pkg.version}")
            lines.append(f"  Vulnerabilities: {len(pkg.vulnerabilities)}")
            for vuln in pkg.vulnerabilities:
                score_str = f" (CVSS {vuln.cvss_score})" if vuln.cvss_score else ""
                fixed_str = (
                    f" -> fix: {', '.join(vuln.fixed_versions)}"
                    if vuln.fixed_versions
                    else ""
                )
                lines.append(
                    f"    [{vuln.severity.upper():8s}] {vuln.id}{score_str}{fixed_str}"
                )
                if vuln.summary:
                    lines.append(f"             {vuln.summary[:100]}")
    else:
        lines.append("No vulnerabilities found!")

    if report.errors:
        lines.append("")
        lines.append(f"ERRORS ({len(report.errors)})")
        lines.append(f"{'-' * 60}")
        for error in report.errors:
            lines.append(f"  {error}")

    lines.append("")
    lines.append(f"{'=' * 60}")
    return "\n".join(lines)


# Common TEDDK dependencies for quick scanning
TEDDK_SAMPLE_DEPENDENCIES = [
    ("org.springframework.boot", "spring-boot-starter-web", "2.7.0"),
    ("org.springframework.boot", "spring-boot-starter-data-jpa", "2.7.0"),
    ("org.springframework.boot", "spring-boot-starter-security", "2.7.0"),
    ("org.springframework", "spring-core", "5.3.20"),
    ("org.springframework", "spring-web", "5.3.20"),
    ("com.fasterxml.jackson.core", "jackson-databind", "2.13.3"),
    ("org.apache.logging.log4j", "log4j-core", "2.17.1"),
    ("org.apache.logging.log4j", "log4j-api", "2.17.1"),
    ("commons-io", "commons-io", "2.11.0"),
    ("org.apache.commons", "commons-lang3", "3.12.0"),
    ("org.apache.httpcomponents", "httpclient", "4.5.13"),
    ("com.google.guava", "guava", "31.1-jre"),
    ("org.postgresql", "postgresql", "42.3.6"),
    ("io.jsonwebtoken", "jjwt", "0.9.1"),
    ("org.yaml", "snakeyaml", "1.30"),
]


async def scan_teddk_dependencies(
    dependencies: Optional[list[tuple[str, str, str]]] = None,
    nvd_api_key: Optional[str] = None,
    include_nvd: bool = True,
) -> TEDDKScanReport:
    """
    Convenience function to scan TEDDK Maven dependencies.

    Args:
        dependencies: List of (groupId, artifactId, version) tuples.
                     Uses TEDDK_SAMPLE_DEPENDENCIES if None.
        nvd_api_key: Optional NVD API key for higher rate limits.
        include_nvd: Whether to include NVD as a source (slower due to rate limits).

    Returns:
        TEDDKScanReport with all findings.
    """
    if dependencies is None:
        dependencies = TEDDK_SAMPLE_DEPENDENCIES

    scanner = TEDDKVulnerabilityScanner(
        nvd_api_key=nvd_api_key,
        include_nvd=include_nvd,
    )
    return await scanner.scan_dependencies(dependencies)
