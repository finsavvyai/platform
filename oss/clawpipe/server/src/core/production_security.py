#!/usr/bin/env python3
"""
Production Security Auditor

Security audit for OpenClaw integration (Task 19.1).
"""

import logging
from typing import Any, Dict, List

logger = logging.getLogger("finsavvyai.production")


class SecurityAuditor:
    """Audit OpenClaw integration for security issues."""

    def __init__(self) -> None:
        self._findings: List[Dict[str, Any]] = []

    def audit_api_keys(self, config: Dict) -> List[Dict]:
        """Check for hardcoded or weak API keys."""
        findings: List[Dict] = []
        weak_keys = {"DEMO_API_KEY", "test", "password", "secret", "admin"}

        api_key = config.get("api_key", "")
        if api_key and api_key in weak_keys:
            findings.append(
                {
                    "severity": "critical",
                    "category": "api_key",
                    "message": "Weak or default API key detected",
                }
            )

        if not api_key:
            findings.append(
                {
                    "severity": "warning",
                    "category": "api_key",
                    "message": "No API key configured",
                }
            )

        self._findings.extend(findings)
        return findings

    def audit_data_flow(self, config: Dict) -> List[Dict]:
        """Check data flow security."""
        findings: List[Dict] = []

        openclaw_url = config.get("openclaw_url", "")
        if openclaw_url.startswith("http://") and "localhost" not in openclaw_url:
            findings.append(
                {
                    "severity": "critical",
                    "category": "data_flow",
                    "message": "OpenClaw URL uses HTTP (not HTTPS) for non-local connection",
                }
            )

        cors = config.get("cors_enabled", True)
        cors_origin = config.get("cors_origin", "*")
        if cors and cors_origin == "*":
            findings.append(
                {
                    "severity": "warning",
                    "category": "cors",
                    "message": "CORS allows all origins (*)",
                }
            )

        self._findings.extend(findings)
        return findings

    def audit_input_validation(self, config: Dict) -> List[Dict]:
        """Check input validation settings."""
        findings: List[Dict] = []

        max_tokens = config.get("max_tokens_limit")
        if max_tokens and max_tokens > 100000:
            findings.append(
                {
                    "severity": "warning",
                    "category": "input_validation",
                    "message": f"Very high max_tokens limit: {max_tokens}",
                }
            )

        if not config.get("rate_limit_enabled", False):
            findings.append(
                {
                    "severity": "warning",
                    "category": "rate_limiting",
                    "message": "Rate limiting is disabled",
                }
            )

        self._findings.extend(findings)
        return findings

    def run_full_audit(self, config: Dict) -> Dict[str, Any]:
        """Run all security audits."""
        self._findings = []
        self.audit_api_keys(config)
        self.audit_data_flow(config)
        self.audit_input_validation(config)

        critical = [f for f in self._findings if f["severity"] == "critical"]
        warnings = [f for f in self._findings if f["severity"] == "warning"]

        return {
            "passed": len(critical) == 0,
            "total_findings": len(self._findings),
            "critical": len(critical),
            "warnings": len(warnings),
            "findings": self._findings,
        }
