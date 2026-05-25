"""
OpenClaw Policy Enforcement

This module provides security policies specifically designed for OpenClaw AI agent skills,
based on lessons learned from the ClawHavoc supply chain attack (February 2026).

The attack demonstrated:
- 341 malicious skills on ClawHub
- Atomic Stealer malware distribution
- Credential harvesting from keychains, SSH keys, crypto wallets
- Data exfiltration via external network calls
- Base64 obfuscation of malicious payloads
"""

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set

from ..ecosystems.openclaw import CodeSecurityIssue, OpenClawAdapter


class PolicyAction(Enum):
    """Actions to take when a policy is violated."""

    BLOCK = "block"  # Prevent installation/use
    WARN = "warn"  # Show warning but allow
    ALLOW = "allow"  # No action needed


@dataclass
class OpenClawPolicy:
    """A security policy for OpenClaw skills."""

    id: str
    name: str
    description: str
    action: PolicyAction
    severity: str = "medium"
    enabled: bool = True
    patterns: List[str] = field(default_factory=list)
    check_function: Optional[str] = None


@dataclass
class OpenClawPolicyViolation:
    """Lightweight policy violation record for OpenClaw scans."""

    id: str
    policy_id: str
    policy_name: str
    severity: str
    description: str
    affected_dependencies: List[str] = field(default_factory=list)
    recommendation: str = ""
    auto_fixable: bool = False


class OpenClawPolicyEnforcer:
    """
    Enforce security policies for OpenClaw AI agent skills.

    Policies are designed to prevent the types of attacks seen in
    ClawHavoc while allowing legitimate skill functionality.
    """

    # Default policies based on ClawHavoc attack analysis
    DEFAULT_POLICIES: List[Dict[str, Any]] = [
        {
            "id": "no_credential_harvesting",
            "name": "No Credential Harvesting",
            "description": "Skills must not harvest credentials, keys, or passwords",
            "action": PolicyAction.BLOCK,
            "severity": "critical",
            "patterns": [
                # Keychain access (macOS)
                r"Keychain\.Item\.CopyPassword",
                r"Security\.SecKeychainItemCopyContent",
                r"from\s+Foundation\s+import.*Keychain",
                # Windows credentials
                r"win32crypt\.CryptUnprotectData",
                r"pywin32\.credential_manager",
                # SSH keys
                r"\.ssh/id_[a-z]+",
                r"read.*\.ssh/.*private",
                # Crypto wallets
                r"wallet\.dat",
                r"keystore/.*\.json",
                r"\.ethereum/keystore",
                # Browser credentials
                r"cookies\.sqlite",
                r"Login\s+Data",
                r"Credential\s+Manager",
                # Generic patterns
                r"getpassword\(\)",
                r"getpass\.getpass",
                r"keyring\.get_password",
            ],
        },
        {
            "id": "no_data_exfiltration",
            "name": "No Data Exfiltration",
            "description": "Skills must not send data to external servers without disclosure",
            "action": PolicyAction.BLOCK,
            "severity": "critical",
            "patterns": [
                # External HTTP POST with data
                r"requests\.post\(['\"]https?://(?!api\.openclaw\.ai|localhost)",
                r"urllib\.request\.urlopen.*external",
                r"http\.client\.HTTPConnection.*send",
                # Webhook exfiltration
                r"webhook.*send\(",
                r"discord\.Webhook\.send",
                # DNS tunneling indicators
                r"socket\.gethostbyname.*\.\w{20,}",
            ],
        },
        {
            "id": "no_obfuscated_malware",
            "name": "No Obfuscated Malware",
            "description": "Skills must not contain obfuscated code or large encoded payloads",
            "action": PolicyAction.BLOCK,
            "severity": "critical",
            "patterns": [
                # Large base64 payloads (common in Atomic Stealer)
                r"base64\.b64decode\(['\"][A-Za-z0-9+/=]{200,}['\"]",
                # Chained encoding/decoding
                r"decode\(\)\.decode\(\)",
                r"eval\(.*b64decode",
                r"exec\(.*decode",
                # Compressed/encrypted payloads
                r'zlib\.decompress(["\'].*["\'])',
                r'gzip\.decompress(["\'].*["\'])',
            ],
        },
        {
            "id": "no_dynamic_code_execution",
            "name": "No Dynamic Code Execution",
            "description": "Skills must not execute dynamic code from external sources",
            "action": PolicyAction.BLOCK,
            "severity": "high",
            "patterns": [
                # Direct execution
                r"eval\(",
                r"exec\(",
                r"__import__\s*\(\s*[^'\"]+",  # dynamic imports
                # Compile + exec pattern
                r"compile\([^)]+\)\s*,\s*exec",
                # Import from external module
                r"importlib\.import_module\(.*user_input",
            ],
        },
        {
            "id": "no_undeclared_network_access",
            "name": "Declared Network Access Only",
            "description": "Network access must be declared in skill manifest",
            "action": PolicyAction.WARN,
            "severity": "medium",
            "check_function": "check_network_usage",
        },
        {
            "id": "require_sbom",
            "name": "Require SBOM",
            "description": "Skills must provide a Software Bill of Materials",
            "action": PolicyAction.BLOCK,
            "severity": "medium",
            "check_function": "check_sbom_exists",
        },
        {
            "id": "limit_filesystem_access",
            "name": "Limit Filesystem Access",
            "description": "Skills should only access their own directory and declared paths",
            "action": PolicyAction.WARN,
            "severity": "medium",
            "patterns": [
                r"os\.walk\(['\"]/",
                r"os\.listdir\(['\"]/",
                r"glob\.glob\(['\"]/",
                r"pathlib\.Path\(['\"]/",
            ],
        },
        {
            "id": "no_suspicious_imports",
            "name": "No Suspicious Imports",
            "description": "Block skills importing known malware/weaponization libraries",
            "action": PolicyAction.BLOCK,
            "severity": "critical",
            "patterns": [
                # Known malicious/suspicious packages
                r"from\s+suspect",
                r"import\s+backdoor",
                r"import\s+keylogger",
                r"import\s+stealer",
                # Process injection (Windows)
                r"import\s+pywin32.*process",
                r"ctypes\.windll\.kernel32\.WriteProcessMemory",
                # Keylogging
                r"pynput.*keyboard",
                r"keyboard.*record\(",
            ],
        },
        {
            "id": "verify_code_signing",
            "name": "Verify Code Signing",
            "description": "Skills should be digitally signed by trusted authors",
            "action": PolicyAction.WARN,
            "severity": "low",
            "check_function": "check_signature",
        },
        {
            "id": "no_clipboard_theft",
            "name": "No Clipboard Theft",
            "description": "Skills must not steal clipboard contents",
            "action": PolicyAction.BLOCK,
            "severity": "high",
            "patterns": [
                r"pyperclip\.paste\(",
                r"Tkinter\.clipboard\.get\(",
                r"win32clipboard\.GetClipboardData",
            ],
        },
        {
            "id": "no_antivm_evasion",
            "name": "No Anti-VM/Evasion Techniques",
            "description": "Skills must not detect or evade analysis environments",
            "action": PolicyAction.BLOCK,
            "severity": "high",
            "patterns": [
                # VM detection
                r"hypervisor.*detection",
                r"vmware.*detect",
                r"virtualbox.*detect",
                # Debugger detection
                r"IsDebuggerPresent",
                r"ptrace.*TRACEME",
                # Timing-based evasion
                r"time\.sleep.*random",
            ],
        },
        {
            "id": "require_transparency",
            "name": "Require Transparency",
            "description": "Skills must have clear documentation and declared functionality",
            "action": PolicyAction.WARN,
            "severity": "low",
            "check_function": "check_documentation",
        },
    ]

    def __init__(self, custom_policies: Optional[List[Dict[str, Any]]] = None):
        """
        Initialize the policy enforcer.

        Args:
            custom_policies: Optional custom policies to add/override defaults
        """
        self.adapter = OpenClawAdapter()
        self.policies: List[OpenClawPolicy] = []
        self._init_policies(custom_policies)

    def _init_policies(
        self, custom_policies: Optional[List[Dict[str, Any]]] = None
    ) -> None:
        """Initialize policies from defaults and custom input."""
        # Load default policies
        for policy_dict in self.DEFAULT_POLICIES:
            self.policies.append(OpenClawPolicy(**policy_dict))

        # Add/override with custom policies
        if custom_policies:
            for policy_dict in custom_policies:
                policy_dict["action"] = PolicyAction(policy_dict["action"])
                self.policies.append(OpenClawPolicy(**policy_dict))

    async def validate_skill(
        self, skill_path: str, manifest: Optional[Dict[str, Any]] = None
    ) -> List[OpenClawPolicyViolation]:
        """
        Validate an OpenClaw skill against all security policies.

        Args:
            skill_path: Path to the skill directory
            manifest: Optional pre-parsed manifest data

        Returns:
            List of policy violations (empty if skill is compliant)
        """
        violations = []

        # Get security issues from code scan
        security_issues = await self.adapter.scan_skill_code(skill_path)

        # Check each policy
        for policy in self.policies:
            if not policy.enabled:
                continue

            policy_violations = await self._check_policy(
                policy, skill_path, security_issues, manifest
            )
            violations.extend(policy_violations)

        return violations

    async def _check_policy(
        self,
        policy: OpenClawPolicy,
        skill_path: str,
        security_issues: List[CodeSecurityIssue],
        manifest: Optional[Dict[str, Any]],
    ) -> List[OpenClawPolicyViolation]:
        """Check if a specific policy is violated."""
        violations = []

        if policy.patterns:
            # Check code patterns
            matching_issues = [
                issue
                for issue in security_issues
                if issue.category in self._get_categories_for_policy(policy.id)
            ]

            for issue in matching_issues:
                violations.append(
                    OpenClawPolicyViolation(
                        id=f"{policy.id}_{issue.line_number}",
                        policy_id=policy.id,
                        policy_name=policy.name,
                        severity=policy.severity,
                        description=f"{policy.description}: {issue.description}",
                        affected_dependencies=[f"{skill_path}:{issue.line_number}"],
                        recommendation=self._get_recommendation(policy.id),
                        auto_fixable=False,
                    )
                )

        if policy.check_function:
            # Run custom check function
            check_result = await self._run_check_function(
                policy.check_function, skill_path, manifest
            )

            if check_result["violated"]:
                violations.append(
                    OpenClawPolicyViolation(
                        id=policy.id,
                        policy_id=policy.id,
                        policy_name=policy.name,
                        severity=policy.severity,
                        description=check_result["message"],
                        affected_dependencies=check_result.get("affected", []),
                        recommendation=self._get_recommendation(policy.id),
                        auto_fixable=False,
                    )
                )

        return violations

    def _get_categories_for_policy(self, policy_id: str) -> Set[str]:
        """Map policy IDs to security issue categories."""
        mapping = {
            "no_credential_harvesting": {"credential_harvesting"},
            "no_data_exfiltration": {"data_exfiltration"},
            "no_obfuscated_malware": {"obfuscated_code"},
            "no_dynamic_code_execution": {"unsafe_builtin", "suspicious_import"},
            "no_suspicious_imports": {"suspicious_import"},
            "no_clipboard_theft": {"clipboard_theft"},
            "no_antivm_evasion": {"antivm_evasion"},
        }
        return mapping.get(policy_id, set())

    async def _run_check_function(
        self, function_name: str, skill_path: str, manifest: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Run a policy check function."""
        check_methods = {
            "check_network_usage": self._check_network_usage,
            "check_sbom_exists": self._check_sbom_exists,
            "check_signature": self._check_signature,
            "check_documentation": self._check_documentation,
        }

        method = check_methods.get(function_name)
        if method:
            return await method(skill_path, manifest)

        return {"violated": False, "message": ""}

    async def _check_network_usage(
        self, skill_path: str, manifest: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Check if network usage is declared in manifest."""
        from pathlib import Path

        path = Path(skill_path)

        # Check for network usage in code
        uses_network = False
        for py_file in path.rglob("*.py"):
            try:
                with open(py_file, "r") as f:
                    content = f.read().lower()
                    if "requests." in content or "urllib." in content:
                        uses_network = True
                        break
            except Exception:
                continue

        if uses_network and manifest:
            permissions = manifest.get("permissions", {})
            if isinstance(permissions, list):
                declared_network = "network" in permissions
            elif isinstance(permissions, dict):
                declared_network = bool(permissions.get("network", False))
            else:
                declared_network = False
            if not declared_network:
                return {
                    "violated": True,
                    "message": "Skill uses network but doesn't declare it in permissions",
                    "affected": ["permissions"],
                }

        return {"violated": False, "message": ""}

    async def _check_sbom_exists(
        self, skill_path: str, manifest: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Check if SBOM file exists."""
        from pathlib import Path

        path = Path(skill_path)
        sbom_files = ["sbom.json", "sbom.xml", "bom.json"]

        has_sbom = any((path / f).exists() for f in sbom_files)

        if not has_sbom:
            return {
                "violated": True,
                "message": "Skill does not include an SBOM file",
                "affected": ["sbom"],
            }

        return {"violated": False, "message": ""}

    async def _check_signature(
        self, skill_path: str, manifest: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Check if skill is code signed."""
        from pathlib import Path

        path = Path(skill_path)
        sig_files = ["signature.sig", "signature.p7s", "skill.sig"]

        has_signature = any((path / f).exists() for f in sig_files)

        if not has_signature:
            return {
                "violated": True,
                "message": "Skill is not digitally signed",
                "affected": ["signature"],
            }

        # TODO: Verify signature against trusted certificates
        return {"violated": False, "message": ""}

    async def _check_documentation(
        self, skill_path: str, manifest: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Check if skill has proper documentation."""
        from pathlib import Path

        path = Path(skill_path)
        doc_files = ["README.md", "README.rst", "docs/", "documentation/"]

        has_docs = any(
            (path / f).exists() if not f.endswith("/") else (path / f).is_dir()
            for f in doc_files
        )

        if not has_docs:
            return {
                "violated": True,
                "message": "Skill lacks documentation",
                "affected": ["documentation"],
            }

        return {"violated": False, "message": ""}

    def _get_recommendation(self, policy_id: str) -> str:
        """Get recommendation for fixing a policy violation."""
        recommendations = {
            "no_credential_harvesting": "Remove any code that accesses credentials, keychains, or sensitive data",
            "no_data_exfiltration": "Declare all external network endpoints in manifest or remove external calls",
            "no_obfuscated_malware": "Remove obfuscated code and use clear, readable code",
            "no_dynamic_code_execution": "Replace dynamic code execution with static code or properly sandboxed execution",
            "no_undeclared_network_access": "Add network permission to skill manifest",
            "require_sbom": "Generate and include an SBOM file (sbom.json or sbom.xml)",
            "limit_filesystem_access": "Restrict file access to skill directory only",
            "no_suspicious_imports": "Remove suspicious imports or replace with safe alternatives",
            "verify_code_signing": "Sign the skill with a trusted code signing certificate",
            "no_clipboard_theft": "Remove clipboard access or clearly document its use",
            "no_antivm_evasion": "Remove any VM detection or anti-analysis code",
            "require_transparency": "Add comprehensive README.md documenting all skill features",
        }
        return recommendations.get(
            policy_id, "Review and modify the skill to comply with security policies"
        )

    async def get_compliance_report(self, skill_path: str) -> Dict[str, Any]:
        """
        Generate a comprehensive compliance report for a skill.

        Returns:
            Dict with compliance status, violations, score, and recommendations
        """
        violations = await self.validate_skill(skill_path)

        # Calculate compliance score
        total_policies = len([p for p in self.policies if p.enabled])
        blocking_violations = len([v for v in violations if v.severity == "critical"])
        warning_violations = len(
            [v for v in violations if v.severity in ["high", "medium"]]
        )

        # Score calculation (0-100)
        score = 100 - (blocking_violations * 25) - (warning_violations * 10)
        score = max(0, score)

        # Determine status
        if blocking_violations > 0:
            status = "blocked"
        elif warning_violations > 0:
            status = "warning"
        else:
            status = "compliant"

        return {
            "skill_path": skill_path,
            "status": status,
            "compliance_score": score,
            "total_policies_checked": total_policies,
            "violations": [
                {
                    "id": v.id,
                    "policy": v.policy_name,
                    "severity": v.severity,
                    "description": v.description,
                    "recommendation": v.recommendation,
                }
                for v in violations
            ],
            "summary": {
                "critical": len([v for v in violations if v.severity == "critical"]),
                "high": len([v for v in violations if v.severity == "high"]),
                "medium": len([v for v in violations if v.severity == "medium"]),
                "low": len([v for v in violations if v.severity == "low"]),
            },
            "recommendations": [v.recommendation for v in violations],
        }

    def enable_policy(self, policy_id: str) -> bool:
        """Enable a specific policy."""
        for policy in self.policies:
            if policy.id == policy_id:
                policy.enabled = True
                return True
        return False

    def disable_policy(self, policy_id: str) -> bool:
        """Disable a specific policy."""
        for policy in self.policies:
            if policy.id == policy_id:
                policy.enabled = False
                return True
        return False

    def list_policies(self) -> List[Dict[str, Any]]:
        """List all policies with their status."""
        return [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "action": p.action.value,
                "severity": p.severity,
                "enabled": p.enabled,
            }
            for p in self.policies
        ]


# Factory function
def create_openclaw_policy_enforcer(
    custom_policies: Optional[List[Dict[str, Any]]] = None,
) -> OpenClawPolicyEnforcer:
    """Factory function to create OpenClaw policy enforcer."""
    return OpenClawPolicyEnforcer(custom_policies)
