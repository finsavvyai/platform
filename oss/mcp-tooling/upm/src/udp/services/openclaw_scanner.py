"""
OpenClaw Skill Scanner

Scans OpenClaw AI agent skills for security vulnerabilities and policy violations.
This is the main service that orchestrates skill analysis.
"""

import asyncio
import hashlib
import logging
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from ..ecosystems.openclaw import CodeSecurityIssue, OpenClawAdapter
from ..services.openclaw_policy_enforcer import OpenClawPolicyEnforcer

try:
    from ..monitoring.workflow_logger import log_event
except ImportError:

    async def log_event(event_name: str, payload: dict[str, Any]) -> None:
        logging.getLogger(__name__).info(
            "OpenClaw event: %s payload=%s", event_name, payload
        )


@dataclass
class ScanResult:
    """Result of scanning an OpenClaw skill."""

    skill_id: str
    skill_name: str
    version: str
    scanned_at: str
    dependencies: list[Any]  # Dependency objects
    vulnerabilities: list[Any]  # Vulnerability objects
    policy_violations: list[Any]  # PolicyViolation objects
    security_issues: list[CodeSecurityIssue]
    risk_score: int  # 0-100, higher = more risky
    recommendations: list[str]
    metadata: dict[str, Any] = field(default_factory=dict)


class OpenClawScanner:
    """
    Scanner for OpenClaw AI agent skills.

    Coordinates multiple analysis types:
    - Dependency extraction and vulnerability scanning
    - Source code security analysis
    - Policy compliance checking
    - File integrity verification
    """

    # Known malicious skill hashes from ClawHavoc attack
    KNOWN_MALICIOUS_HASHES: set[str] = set()

    # Skill download patterns
    GITHUB_PATTERN = r"github\.com/([^/]+)/([^/]+)"
    CLAWHUB_PATTERN = r"clawhub\.ai/skills/([^/]+)"
    GITLAB_PATTERN = r"gitlab\.com/([^/]+)/([^/]+)"

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.adapter = OpenClawAdapter()
        self.policy_enforcer = OpenClawPolicyEnforcer()
        self._load_malicious_hashes()

    def _load_malicious_hashes(self) -> None:
        """Load known malicious skill hashes from database/config."""
        # In production, load from database or config file
        # For now, placeholder
        pass

    async def scan_skill(
        self,
        skill_path: str,
        depth: int = 3,
        scan_code: bool = True,
        check_policies: bool = True,
        scan_dependencies: bool = True,
    ) -> ScanResult:
        """
        Perform comprehensive scan of an OpenClaw skill.

        Args:
            skill_path: Path to skill directory
            depth: Dependency scan depth
            scan_code: Whether to scan source code
            check_policies: Whether to check policy compliance
            scan_dependencies: Whether to scan dependencies for vulnerabilities

        Returns:
            ScanResult with all findings
        """
        path = Path(skill_path)

        if not path.exists():
            raise FileNotFoundError(f"Skill path not found: {skill_path}")

        # Extract metadata
        metadata = await self.adapter._extract_skill_metadata(path)

        # Initialize result
        result = ScanResult(
            skill_id=self._generate_skill_id(path, metadata.version),
            skill_name=metadata.name,
            version=metadata.version,
            scanned_at=datetime.utcnow().isoformat(),
            dependencies=[],
            vulnerabilities=[],
            policy_violations=[],
            security_issues=[],
            risk_score=0,
            recommendations=[],
            metadata={
                "author": metadata.author,
                "description": metadata.description,
                "permissions": metadata.permissions,
            },
        )

        # 1. Scan dependencies
        if scan_dependencies:
            result.dependencies = await self.adapter.parse_dependencies(skill_path)

            # Scan for vulnerabilities in dependencies
            for dep in result.dependencies:
                vulns = await self._scan_dependency_vulnerabilities(dep)
                result.vulnerabilities.extend(vulns)

        # 2. Scan source code
        if scan_code:
            result.security_issues = await self.adapter.scan_skill_code(skill_path)

        # 3. Check policies
        if check_policies:
            result.policy_violations = await self.policy_enforcer.validate_skill(
                skill_path, result.metadata
            )

        # 4. Calculate risk score
        result.risk_score = self._calculate_risk_score(result)

        # 5. Generate recommendations
        result.recommendations = self._generate_recommendations(result)

        # 6. Check file hashes against known malicious
        if await self._is_malicious(path):
            result.risk_score = 100
            result.recommendations.insert(
                0,
                "CRITICAL: This skill matches known malicious hashes from ClawHavoc attack!",
            )

        # Log scan event
        await log_event(
            "openclaw_skill_scanned",
            {
                "skill_id": result.skill_id,
                "skill_name": result.skill_name,
                "risk_score": result.risk_score,
                "vulnerabilities": len(result.vulnerabilities),
                "violations": len(result.policy_violations),
                "security_issues": len(result.security_issues),
            },
        )

        return result

    async def _scan_dependency_vulnerabilities(self, dependency: Any) -> list[Any]:
        """Scan a single dependency for vulnerabilities."""
        # Keep behavior deterministic and dependency-free for now.
        # This hook can be replaced with OSV/NVD integrations later.
        name = getattr(dependency, "name", "").lower()
        if "critical" in name or "vulnerable" in name:
            return [
                {
                    "id": f"MOCK-{dependency.name.upper()}",
                    "title": f"Potentially vulnerable dependency: {dependency.name}",
                    "severity": "high",
                    "source": "openclaw-heuristic",
                }
            ]
        return []

    def _calculate_risk_score(self, result: ScanResult) -> int:
        """
        Calculate overall risk score (0-100).

        Scoring:
        - Critical vulns: +25 each
        - High vulns: +15 each
        - Medium vulns: +5 each
        - Low vulns: +1 each
        - Critical violations: +20 each
        - High violations: +10 each
        - Medium violations: +3 each
        - Critical security issues: +15 each
        - High security issues: +8 each
        """
        score = 0

        # Vulnerabilities
        for vuln in result.vulnerabilities:
            severity = (
                vuln.severity
                if hasattr(vuln, "severity")
                else str(vuln.get("severity", "low"))
            )
            if severity == "critical":
                score += 25
            elif severity == "high":
                score += 15
            elif severity == "medium":
                score += 5
            else:
                score += 1

        # Policy violations
        for violation in result.policy_violations:
            if violation.severity == "critical":
                score += 20
            elif violation.severity == "high":
                score += 10
            elif violation.severity == "medium":
                score += 3

        # Security issues
        for issue in result.security_issues:
            if issue.severity == "critical":
                score += 15
            elif issue.severity == "high":
                score += 8

        return min(100, score)

    def _generate_recommendations(self, result: ScanResult) -> list[str]:
        """Generate actionable recommendations based on scan results."""
        recommendations = []

        # Vulnerability recommendations
        if result.vulnerabilities:
            critical_vulns = [
                v
                for v in result.vulnerabilities
                if getattr(v, "severity", v.get("severity", "low")) == "critical"
            ]
            if critical_vulns:
                recommendations.append(
                    f"Update {len(critical_vulns)} dependencies with critical vulnerabilities"
                )

        # Policy violation recommendations
        for violation in result.policy_violations:
            if hasattr(violation, "recommendation"):
                recommendations.append(violation.recommendation)

        # Security issue recommendations
        credential_issues = [
            i for i in result.security_issues if i.category == "credential_harvesting"
        ]
        if credential_issues:
            recommendations.append("Remove all credential harvesting code immediately")

        exfiltration_issues = [
            i for i in result.security_issues if i.category == "data_exfiltration"
        ]
        if exfiltration_issues:
            recommendations.append(
                "Declare all external network endpoints in manifest or remove them"
            )

        # General recommendations
        if result.risk_score > 50:
            recommendations.append(
                "This skill has a high risk score. Review carefully before using."
            )

        if not recommendations:
            recommendations.append("No critical issues found. Skill appears safe.")

        return recommendations

    def _generate_skill_id(self, path: Path, version: str) -> str:
        """Generate unique skill ID."""
        # Use path hash + version
        path_hash = hashlib.md5(str(path).encode()).hexdigest()[:8]
        return f"{path.name}_{version}_{path_hash}"

    async def _is_malicious(self, path: Path) -> bool:
        """Check if skill matches known malicious hashes."""
        # Calculate file hashes for all Python files
        for py_file in path.rglob("*.py"):
            try:
                with open(py_file, "rb") as f:
                    content = f.read()
                    file_hash = hashlib.sha256(content).hexdigest()
                    if file_hash in self.KNOWN_MALICIOUS_HASHES:
                        return True
            except Exception:
                continue
        return False

    async def _download_skill(self, url: str) -> str:
        """
        Download OpenClaw skill from URL.

        Supports:
        - GitHub repositories
        - ClawHub marketplace
        - GitLab repositories
        - Direct URLs
        """
        import re
        import tempfile

        temp_dir = tempfile.mkdtemp(prefix="upm_openclaw_download_")

        # Detect URL type and download accordingly
        if re.search(self.GITHUB_PATTERN, url):
            # Clone GitHub repo
            import subprocess

            subprocess.run(
                ["git", "clone", url, temp_dir], check=True, capture_output=True
            )
        elif re.search(self.CLAWHUB_PATTERN, url):
            # Download from ClawHub (using their API)
            skill_name = re.search(self.CLAWHUB_PATTERN, url).group(1)
            await self._download_from_clawhub(skill_name, temp_dir)
        else:
            raise ValueError(f"Unsupported URL: {url}")

        return temp_dir

    async def _download_from_clawhub(self, skill_name: str, dest_dir: str) -> None:
        """Download skill from ClawHub marketplace."""
        import aiohttp

        # ClawHub API endpoint
        api_url = f"https://api.clawhub.ai/v1/skills/{skill_name}"

        async with aiohttp.ClientSession() as session:
            async with session.get(api_url) as resp:
                if resp.status != 200:
                    raise ValueError(f"Skill not found: {skill_name}")

                data = await resp.json()

                # Download skill archive
                download_url = data.get("download_url")
                if download_url:
                    async with session.get(download_url) as archive_resp:
                        if archive_resp.status == 200:
                            content = await archive_resp.read()

                            # Extract archive
                            import io
                            import zipfile

                            with zipfile.ZipFile(io.BytesIO(content)) as zip_ref:
                                zip_ref.extractall(dest_dir)

    async def scan_skill_from_event(self, event_data: dict[str, Any]) -> ScanResult:
        """
        Scan skill triggered by ClawHub webhook event.

        Used for real-time monitoring of marketplace.
        """
        skill_id = event_data.get("id")
        skill_url = event_data.get("download_url")

        if not skill_url:
            raise ValueError("No download URL in event data")

        # Download and scan
        skill_path = await self._download_skill(skill_url)

        try:
            return await self.scan_skill(skill_path)
        finally:
            # Cleanup
            shutil.rmtree(skill_path, ignore_errors=True)

    async def scan_and_store(
        self, skill_url: str, batch_id: Optional[str] = None
    ) -> str:
        """
        Scan skill and store results in database.

        Used for batch scanning operations.
        """
        # Download skill
        skill_path = await self._download_skill(skill_url)

        try:
            # Scan
            result = await self.scan_skill(skill_path)

            # Store in database (placeholder)
            scan_id = f"scan_{datetime.utcnow().timestamp()}"

            await log_event(
                "openclaw_scan_stored",
                {
                    "scan_id": scan_id,
                    "batch_id": batch_id,
                    "skill_id": result.skill_id,
                    "risk_score": result.risk_score,
                },
            )

            return scan_id

        finally:
            shutil.rmtree(skill_path, ignore_errors=True)

    async def batch_scan(self, skill_urls: list[str]) -> list[ScanResult]:
        """
        Scan multiple skills concurrently.

        Returns list of scan results.
        """
        tasks = []

        for url in skill_urls:
            task = self._scan_from_url(url)
            tasks.append(task)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out exceptions
        valid_results = [r for r in results if not isinstance(r, Exception)]

        return valid_results

    async def _scan_from_url(self, url: str) -> ScanResult:
        """Scan skill from URL with cleanup."""
        skill_path = await self._download_skill(url)

        try:
            return await self.scan_skill(skill_path)
        finally:
            shutil.rmtree(skill_path, ignore_errors=True)

    async def generate_scan_report(
        self, result: ScanResult, format: str = "json"
    ) -> str:
        """
        Generate human-readable scan report.

        Formats: json, markdown, html
        """
        if format == "json":
            import json

            return json.dumps(
                {
                    "skill": {
                        "id": result.skill_id,
                        "name": result.skill_name,
                        "version": result.version,
                    },
                    "scan": {
                        "timestamp": result.scanned_at,
                        "risk_score": result.risk_score,
                        "status": self._get_status_from_score(result.risk_score),
                    },
                    "findings": {
                        "vulnerabilities": len(result.vulnerabilities),
                        "violations": len(result.policy_violations),
                        "security_issues": len(result.security_issues),
                    },
                    "recommendations": result.recommendations,
                },
                indent=2,
            )

        elif format == "markdown":
            return self._generate_markdown_report(result)

        elif format == "html":
            return self._generate_html_report(result)

        else:
            raise ValueError(f"Unsupported format: {format}")

    def _get_status_from_score(self, score: int) -> str:
        """Get status label from risk score."""
        if score >= 75:
            return "BLOCKED"
        elif score >= 40:
            return "WARNING"
        else:
            return "PASSED"

    def _generate_markdown_report(self, result: ScanResult) -> str:
        """Generate Markdown report."""
        status = self._get_status_from_score(result.risk_score)
        status_emoji = (
            "🛑" if status == "BLOCKED" else "⚠️" if status == "WARNING" else "✅"
        )

        report = f"""# OpenClaw Skill Scan Report

{status_emoji} **Status**: {status} (Risk Score: {result.risk_score}/100)

## Skill Information

- **Name**: {result.skill_name}
- **Version**: {result.version}
- **ID**: {result.skill_id}
- **Scanned**: {result.scanned_at}

## Summary

| Category | Count |
|----------|-------|
| Vulnerabilities | {len(result.vulnerabilities)} |
| Policy Violations | {len(result.policy_violations)} |
| Security Issues | {len(result.security_issues)} |

"""

        if result.vulnerabilities:
            report += "## Vulnerabilities\n\n"
            for vuln in result.vulnerabilities[:10]:
                report += f"- **{vuln.id}**: {vuln.title} ({vuln.severity})\n"
            report += "\n"

        if result.policy_violations:
            report += "## Policy Violations\n\n"
            for violation in result.policy_violations[:10]:
                report += f"- **{violation.policy_name}**: {violation.description}\n"
            report += "\n"

        if result.security_issues:
            report += "## Security Issues\n\n"
            for issue in result.security_issues[:10]:
                report += f"- **{issue.category}** at line {issue.line_number}: {issue.description}\n"
            report += "\n"

        report += "## Recommendations\n\n"
        for rec in result.recommendations:
            report += f"- {rec}\n"

        return report

    def _generate_html_report(self, result: ScanResult) -> str:
        """Generate HTML report."""
        status = self._get_status_from_score(result.risk_score)
        status_color = (
            "red"
            if status == "BLOCKED"
            else "orange"
            if status == "WARNING"
            else "green"
        )

        return f"""<!DOCTYPE html>
<html>
<head>
    <title>OpenClaw Scan Report - {result.skill_name}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        .header {{ background: #f5f5f5; padding: 20px; border-radius: 8px; }}
        .status-{{status_color}} {{ color: {status_color}; font-weight: bold; font-size: 24px; }}
        .section {{ margin: 20px 0; }}
        .summary {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }}
        .summary-item {{ background: #f9f9f9; padding: 15px; border-radius: 4px; text-align: center; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background: #f0f0f0; }}
        .critical {{ background: #fee; }}
        .high {{ background: #fcc; }}
        .medium {{ background: #ffc; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>OpenClaw Skill Scan Report</h1>
        <p>Status: <span class="status-{status_color}">{status}</span></p>
        <p>Risk Score: {result.risk_score}/100</p>
    </div>

    <div class="section">
        <h2>Skill Information</h2>
        <p><strong>Name:</strong> {result.skill_name}</p>
        <p><strong>Version:</strong> {result.version}</p>
        <p><strong>ID:</strong> {result.skill_id}</p>
        <p><strong>Scanned:</strong> {result.scanned_at}</p>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <div class="summary">
            <div class="summary-item">
                <h3>{len(result.vulnerabilities)}</h3>
                <p>Vulnerabilities</p>
            </div>
            <div class="summary-item">
                <h3>{len(result.policy_violations)}</h3>
                <p>Violations</p>
            </div>
            <div class="summary-item">
                <h3>{len(result.security_issues)}</h3>
                <p>Security Issues</p>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            {"".join(f"<li>{rec}</li>" for rec in result.recommendations)}
        </ul>
    </div>
</body>
</html>"""


class MarketplaceMonitor:
    """
    Monitor ClawHub marketplace for new and updated skills.

    Provides real-time monitoring capabilities.
    """

    def __init__(self):
        self.scanner = OpenClawScanner()
        self._monitored_skills: set[str] = set()

    async def monitor_skills(
        self,
        skills: list[str],
        interval_seconds: int,
        webhook_url: Optional[str] = None,
    ) -> None:
        """
        Continuously monitor skills for changes.

        This would run as a background task.
        """
        import asyncio

        while True:
            for skill in skills:
                try:
                    # Check for updates
                    has_update = await self._check_for_updates(skill)

                    if has_update:
                        # Scan updated skill
                        result = await self.scanner.scan_and_store(skill)

                        # Send webhook notification
                        if webhook_url:
                            await self._send_webhook(webhook_url, result)

                        await log_event(
                            "openclaw_skill_updated",
                            {"skill": skill, "risk_score": result.risk_score},
                        )

                except Exception as e:
                    await log_event(
                        "openclaw_monitor_error", {"skill": skill, "error": str(e)}
                    )

            await asyncio.sleep(interval_seconds)

    async def _check_for_updates(self, skill: str) -> bool:
        """Check if skill has been updated since last check."""
        # In production, would check against database or API
        return False

    async def _send_webhook(self, webhook_url: str, result: ScanResult) -> None:
        """Send webhook notification with scan results."""
        import aiohttp

        payload = {
            "event": "skill_scanned",
            "skill_id": result.skill_id,
            "skill_name": result.skill_name,
            "version": result.version,
            "risk_score": result.risk_score,
            "vulnerabilities": len(result.vulnerabilities),
            "violations": len(result.policy_violations),
            "timestamp": datetime.utcnow().isoformat(),
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=payload) as resp:
                if resp.status not in [200, 201, 202]:
                    await log_event(
                        "webhook_failed", {"url": webhook_url, "status": resp.status}
                    )


# Factory function
def create_openclaw_scanner() -> OpenClawScanner:
    """Factory function to create scanner instance."""
    return OpenClawScanner()
