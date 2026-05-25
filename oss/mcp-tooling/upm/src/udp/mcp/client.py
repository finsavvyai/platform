# src/udp/mcp/client.py
"""
UPM MCP Client for Model Context Protocol Integration
Enables AI assistants to interact with UPM platform
"""

from typing import Any, Optional

import httpx


class UPMMCPClient:
    """
    MCP Client for UPM Platform integration.

    Enables AI assistants (Claude, GPT-4, etc.) to:
    - Query dependency information
    - Trigger scans and analysis
    - Generate remediation PRs
    - Access vulnerability intelligence
    """

    def __init__(self, api_key: str, base_url: str = "https://api.upm.io"):
        self.api_key = api_key
        self.base_url = base_url
        self.client = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {api_key}"}, timeout=30.0
        )

    async def get_project_info(self, project_id: str) -> dict[str, Any]:
        """Get comprehensive project information for AI context."""
        response = await self.client.get(
            f"{self.base_url}/api/v1/projects/{project_id}"
        )
        return response.json()

    async def get_vulnerabilities(
        self, project_id: str, severity: Optional[str] = None, state: str = "open"
    ) -> list[dict[str, Any]]:
        """Get vulnerabilities with full context for AI analysis."""
        params = {"state": state}
        if severity:
            params["severity"] = severity

        response = await self.client.get(
            f"{self.base_url}/api/v1/vulnerabilities",
            params={"project_id": project_id, **params},
        )
        return response.json().get("vulnerabilities", [])

    async def analyze_dependency(
        self, ecosystem: str, package_name: str, version: str
    ) -> dict[str, Any]:
        """Deep analyze a specific dependency for AI decision making."""
        response = await self.client.post(
            f"{self.base_url}/api/v1/dependencies/analyze",
            json={
                "ecosystem": ecosystem,
                "packages": [{"name": package_name, "version": version}],
            },
        )
        return response.json()

    async def get_remediation_suggestions(
        self, project_id: str, vulnerability_ids: Optional[list[str]] = None
    ) -> list[dict[str, Any]]:
        """Get AI-powered remediation suggestions."""
        response = await self.client.post(
            f"{self.base_url}/api/v1/remediation/suggest",
            json={"project_id": project_id, "vulnerability_ids": vulnerability_ids},
        )
        return response.json().get("suggestions", [])

    async def trigger_scan(
        self, project_id: str, scan_type: str = "full"
    ) -> dict[str, Any]:
        """Trigger a new scan and return task ID for polling."""
        response = await self.client.post(
            f"{self.base_url}/api/v1/vulnerabilities/scan",
            json={"project_id": project_id, "scan_type": scan_type},
        )
        return response.json()

    async def generate_sbom(
        self, project_id: str, format: str = "cyclonedx"
    ) -> dict[str, Any]:
        """Generate SBOM for compliance and AI analysis."""
        response = await self.client.post(
            f"{self.base_url}/api/v1/sbom/generate",
            json={"project_id": project_id, "format": format},
        )
        return response.json()

    async def get_compliance_status(self, project_id: str) -> dict[str, Any]:
        """Get compliance status for AI risk assessment."""
        response = await self.client.post(
            f"{self.base_url}/api/v1/policies/validate", json={"project_id": project_id}
        )
        return response.json()

    async def get_metrics(self, project_id: str, period: str = "30d") -> dict[str, Any]:
        """Get project metrics for AI insights."""
        response = await self.client.get(
            f"{self.base_url}/api/v1/dashboard/metrics",
            params={"project_id": project_id, "period": period},
        )
        return response.json()
