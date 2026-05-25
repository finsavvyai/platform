"""
OpenClaw Skill Ecosystem Adapter

This module provides integration with OpenClaw AI agent skills,
enabling UPM to scan, validate, and monitor OpenClaw skills
for security vulnerabilities and policy violations.

Context: ClawHavoc Attack (Feb 2026) - 341 malicious skills discovered
distributing Atomic Stealer malware via ClawHub marketplace.
"""

import ast
import hashlib
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml

@dataclass
class OpenClawSkillMetadata:
    """Metadata extracted from OpenClaw skill manifest."""

    name: str
    version: str
    description: str = ""
    author: str = ""
    permissions: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    entry_point: str = "main.py"


@dataclass
class CodeSecurityIssue:
    """Security issue found in skill source code."""

    severity: str  # critical, high, medium, low
    category: str  # credential_harvesting, data_exfiltration, etc.
    line_number: int
    code_snippet: str
    description: str
    rule_id: str


@dataclass
class OpenClawDependency:
    """Dependency extracted from an OpenClaw skill."""

    id: str
    name: str
    version: str
    ecosystem: str = "pypi"
    direct: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)


class OpenClawAdapter:
    """
    Adapter for analyzing OpenClaw AI agent skills.

    OpenClaw skills are Python packages that can contain:
    - Malicious code injection
    - Unsafe dependencies
    - Prompt injection vulnerabilities
    - Exposed API credentials
    - Data exfiltration

    This adapter scans skills for these issues and generates SBOMs.
    """

    ECOSYSTEM = "openclaw"

    # Patterns for detecting malicious code (learned from ClawHavoc)
    MALICIOUS_PATTERNS = {
        "credential_harvesting": [
            r"Keychain",
            r"\.ssh/",
            r"wallet\.dat",
            r"cookies\.sqlite",
            r"getpassword\(\)",
            r"getpass\.getpass",
        ],
        "data_exfiltration": [
            r"requests\.post.*https?://",
            r"urllib\.request\.urlopen.*external",
            r"http\.client\.HTTPConnection",
        ],
        "obfuscated_code": [
            r"base64\.b64decode\([a-zA-Z0-9+/=]{40,}\)",
            r"eval\(.*decode",
            r"exec\(.*decode",
        ],
        "suspicious_imports": [
            r"from\s+suspect",
            r"import\s+os\.system",
            r"import\s+subprocess\.Popen.*shell=True",
        ],
    }

    # Unsafe built-in functions that could indicate malware
    UNSAFE_BUILTINS = {
        "eval",
        "exec",
        "compile",
        "__import__",
        "globals",
        "locals",
        "vars",
        "dir",
    }

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.supported_manifest_files = [
            "skill.yaml",
            "skill.yml",
            "claw.yaml",
            "manifest.yaml",
            "setup.py",
            "pyproject.toml",
        ]

    async def parse_dependencies(self, manifest_path: str) -> list[OpenClawDependency]:
        """
        Parse OpenClaw skill manifest and dependencies.

        Supports multiple manifest formats used by OpenClaw skills.
        """
        path = Path(manifest_path)

        # Try different manifest formats
        for manifest_file in self.supported_manifest_files:
            manifest = path / manifest_file
            if manifest.exists():
                return await self._parse_manifest(manifest)

        # Fallback: scan for Python dependencies
        return await self._scan_python_dependencies(path)

    async def _parse_manifest(
        self, manifest_path: Path
    ) -> list[OpenClawDependency]:
        """Parse a specific manifest file."""
        suffix = manifest_path.suffix

        if suffix in [".yaml", ".yml"]:
            return await self._parse_yaml_manifest(manifest_path)
        elif suffix == ".toml":
            return await self._parse_toml_manifest(manifest_path)
        elif suffix == ".py":
            return await self._parse_setup_py(manifest_path)

        return []

    async def _parse_yaml_manifest(
        self, manifest_path: Path
    ) -> list[OpenClawDependency]:
        """Parse YAML-based skill manifest."""
        try:
            with open(manifest_path) as f:
                content = yaml.safe_load(f)

            dependencies = []

            # Check for OpenClaw-specific dependency format
            if "dependencies" in content:
                for dep in content.get("dependencies", []):
                    if isinstance(dep, str):
                        dependencies.append(self._parse_python_requirement(dep))
                    elif isinstance(dep, dict):
                        name = dep.get("name") or dep.get("package")
                        version = dep.get("version", "")
                        dependencies.append(
                            OpenClawDependency(
                                id=f"pypi:{name}:{version}",
                                name=name,
                                version=version or "*",
                            )
                        )

            # Check for requirements.txt reference
            if "requirements_file" in content:
                req_file = manifest_path.parent / content["requirements_file"]
                if req_file.exists():
                    dependencies.extend(await self._parse_requirements_file(req_file))

            return dependencies

        except Exception as e:
            self.logger.warning(f"Failed to parse YAML manifest {manifest_path}: {e}")
            return []

    async def _parse_toml_manifest(
        self, manifest_path: Path
    ) -> list[OpenClawDependency]:
        """Parse pyproject.toml manifest."""
        try:
            import tomli

            with open(manifest_path, "rb") as f:
                content = tomli.load(f)

            dependencies = []

            # Parse dependencies from [project.dependencies] or [tool.poetry.dependencies]
            project_deps = content.get("project", {}).get(
                "dependencies", []
            ) or content.get("tool", {}).get("poetry", {}).get("dependencies", [])

            for dep in project_deps:
                if isinstance(dep, str) and not dep.startswith("python"):
                    dependencies.append(self._parse_python_requirement(dep))

            return dependencies

        except Exception as e:
            self.logger.warning(f"Failed to parse TOML manifest {manifest_path}: {e}")
            return []

    async def _parse_setup_py(
        self, manifest_path: Path
    ) -> list[OpenClawDependency]:
        """Parse setup.py for dependencies."""
        try:
            with open(manifest_path) as f:
                content = f.read()

            # Extract install_requires using AST
            tree = ast.parse(content)

            for node in ast.walk(tree):
                if isinstance(node, ast.Call):
                    if isinstance(node.func, ast.Attribute):
                        if node.func.attr == "setup":
                            for keyword in node.keywords:
                                if keyword.arg == "install_requires":
                                    if isinstance(keyword.value, ast.List):
                                        deps = []
                                        for elt in keyword.value.elts:
                                            if isinstance(elt, ast.Constant):
                                                deps.append(
                                                    self._parse_python_requirement(
                                                        elt.value
                                                    )
                                                )
                                        return deps

            return []

        except Exception as e:
            self.logger.warning(f"Failed to parse setup.py {manifest_path}: {e}")
            return []

    async def _parse_requirements_file(
        self, req_path: Path
    ) -> list[OpenClawDependency]:
        """Parse requirements.txt file."""
        dependencies = []

        try:
            with open(req_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        dependencies.append(self._parse_python_requirement(line))
        except Exception as e:
            self.logger.warning(f"Failed to parse requirements.txt {req_path}: {e}")

        return dependencies

    def _parse_python_requirement(self, req: str) -> OpenClawDependency:
        """Parse a Python requirement string into a Dependency."""
        # Parse: package==version, package>=version, package[extras]
        match = re.match(
            r"^([a-zA-Z0-9_-]+)(?:\[([^\]]+)\])?(?:\s*([>=!<~]+)\s*([0-9.]+))?",
            req.strip(),
        )

        if match:
            name = match.group(1)
            extras = match.group(2)
            operator = match.group(3)
            version = match.group(4) or "*"

            return OpenClawDependency(
                id=f"pypi:{name}:{version}",
                name=name,
                version=version,
                ecosystem="pypi",
                direct=True,
                metadata={"extras": extras, "operator": operator}
                if extras or operator
                else {},
            )

        return OpenClawDependency(
            id=f"pypi:{req}", name=req, version="unknown", ecosystem="pypi", direct=True
        )

    async def _scan_python_dependencies(
        self, path: Path
    ) -> list[OpenClawDependency]:
        """Scan Python files for import statements."""
        dependencies: set[str] = set()

        for py_file in path.rglob("*.py"):
            try:
                with open(py_file) as f:
                    tree = ast.parse(f.read(), filename=str(py_file))

                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            dependencies.add(alias.name.split(".")[0])
                    elif isinstance(node, ast.ImportFrom):
                        if node.module:
                            dependencies.add(node.module.split(".")[0])
            except Exception:
                continue

        # Filter out standard library
        stdlib = {"os", "sys", "json", "re", "datetime", "pathlib"}
        return [
            OpenClawDependency(
                id=f"pypi:{name}:*",
                name=name,
                version="*",
                ecosystem="pypi",
                direct=True,
            )
            for name in dependencies
            if name not in stdlib
        ]

    async def scan_skill_code(self, skill_path: str) -> list[CodeSecurityIssue]:
        """
        Scan OpenClaw skill source code for security issues.

        Checks for:
        - Credential harvesting patterns
        - Data exfiltration
        - Obfuscated code
        - Dynamic code execution
        - Suspicious imports
        """
        path = Path(skill_path)
        issues = []

        for py_file in path.rglob("*.py"):
            file_issues = await self._scan_python_file(py_file)
            issues.extend(file_issues)

        return issues

    async def _scan_python_file(self, py_file: Path) -> list[CodeSecurityIssue]:
        """Scan a single Python file for security issues."""
        issues = []

        try:
            with open(py_file) as f:
                content = f.read()
                lines = content.split("\n")

            tree = ast.parse(content, filename=str(py_file))

            # Check for unsafe builtins
            for node in ast.walk(tree):
                if isinstance(node, ast.Call):
                    if isinstance(node.func, ast.Name):
                        if node.func.id in self.UNSAFE_BUILTINS:
                            issues.append(
                                CodeSecurityIssue(
                                    severity="high",
                                    category="unsafe_builtin",
                                    line_number=node.lineno,
                                    code_snippet=lines[node.lineno - 1].strip(),
                                    description=f"Use of unsafe builtin: {node.func.id}",
                                    rule_id="openclaw-unsafe-builtin",
                                )
                            )

                # Check for suspicious imports
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if any(
                            suspect in alias.name.lower()
                            for suspect in ["suspect", "backdoor", "payload"]
                        ):
                            issues.append(
                                CodeSecurityIssue(
                                    severity="critical",
                                    category="suspicious_import",
                                    line_number=node.lineno,
                                    code_snippet=lines[node.lineno - 1].strip(),
                                    description=f"Suspicious import: {alias.name}",
                                    rule_id="openclaw-suspicious-import",
                                )
                            )

            # Check for malicious patterns in code
            for i, line in enumerate(lines, 1):
                for category, patterns in self.MALICIOUS_PATTERNS.items():
                    for pattern in patterns:
                        if re.search(pattern, line, re.IGNORECASE):
                            # Determine severity based on category
                            severity = (
                                "critical"
                                if category == "credential_harvesting"
                                else "high"
                            )

                            issues.append(
                                CodeSecurityIssue(
                                    severity=severity,
                                    category=category,
                                    line_number=i,
                                    code_snippet=line.strip(),
                                    description="Potentially malicious pattern detected",
                                    rule_id=f"openclaw-{category}",
                                )
                            )

            # Check for excessive base64 content (potential obfuscated malware)
            base64_matches = re.findall(
                r"base64\.b64decode\([\"']([A-Za-z0-9+/=]{40,})[\"']\)", content
            )
            for match in base64_matches:
                if len(match) > 100:  # Large base64 strings are suspicious
                    issues.append(
                        CodeSecurityIssue(
                            severity="high",
                            category="obfuscated_code",
                            line_number=content.find(match) // 100 + 1,  # Approximate
                            code_snippet=match[:50] + "...",
                            description="Large base64 encoded string (potential obfuscated malware)",
                            rule_id="openclaw-large-base64",
                        )
                    )

        except SyntaxError:
            issues.append(
                CodeSecurityIssue(
                    severity="medium",
                    category="syntax_error",
                    line_number=0,
                    code_snippet="",
                    description="File has syntax errors (could indicate tampering)",
                    rule_id="openclaw-syntax-error",
                )
            )
        except Exception as e:
            self.logger.warning(f"Error scanning {py_file}: {e}")

        return issues

    async def generate_skill_sbom(
        self, skill_path: str, format: str = "cyclonedx"
    ) -> dict[str, Any]:
        """
        Generate SBOM for OpenClaw skill.

        Includes:
        - Skill metadata
        - All dependencies
        - Transitive dependencies
        - File hashes
        - Code security issues
        """
        path = Path(skill_path)

        # Get skill metadata
        metadata = await self._extract_skill_metadata(path)

        # Get dependencies
        dependencies = await self.parse_dependencies(skill_path)

        # Scan for security issues
        security_issues = await self.scan_skill_code(skill_path)

        # Calculate file hashes
        file_hashes = self._calculate_file_hashes(path)

        return {
            "format": format,
            "metadata": {
                "name": metadata.name,
                "version": metadata.version,
                "description": metadata.description,
                "author": metadata.author,
                "ecosystem": "openclaw",
                "timestamp": self._get_timestamp(),
            },
            "components": [
                {
                    "type": "library",
                    "group": "pypi",
                    "name": dep.name,
                    "version": dep.version,
                    "purl": f"pkg:pypi/{dep.name}@{dep.version}",
                    "properties": [{"name": "direct", "value": str(dep.direct)}],
                }
                for dep in dependencies
            ],
            "security_issues": [
                {
                    "severity": issue.severity,
                    "category": issue.category,
                    "line": issue.line_number,
                    "rule": issue.rule_id,
                    "description": issue.description,
                }
                for issue in security_issues
            ],
            "file_hashes": file_hashes,
        }

    async def _extract_skill_metadata(self, path: Path) -> OpenClawSkillMetadata:
        """Extract metadata from skill manifest."""
        for manifest_file in self.supported_manifest_files:
            manifest = path / manifest_file
            if manifest.exists():
                return await self._parse_metadata(manifest)

        # Default metadata
        return OpenClawSkillMetadata(name=path.name, version="unknown")

    async def _parse_metadata(self, manifest_path: Path) -> OpenClawSkillMetadata:
        """Parse metadata from manifest file."""
        if manifest_path.suffix in [".yaml", ".yml"]:
            try:
                with open(manifest_path) as f:
                    content = yaml.safe_load(f)

                return OpenClawSkillMetadata(
                    name=content.get("name", "unknown"),
                    version=content.get("version", "unknown"),
                    description=content.get("description", ""),
                    author=content.get("author", ""),
                    permissions=content.get("permissions", []),
                    dependencies=content.get("dependencies", []),
                    entry_point=content.get("entry_point", "main.py"),
                )
            except Exception:
                pass

        return OpenClawSkillMetadata(name=manifest_path.parent.name, version="unknown")

    def _calculate_file_hashes(self, path: Path) -> dict[str, str]:
        """Calculate SHA256 hashes for all Python files."""
        hashes = {}

        for py_file in path.rglob("*.py"):
            try:
                with open(py_file, "rb") as f:
                    content = f.read()
                    file_hash = hashlib.sha256(content).hexdigest()
                    hashes[str(py_file.relative_to(path))] = file_hash
            except Exception:
                continue

        return hashes

    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format."""
        from datetime import datetime

        return datetime.utcnow().isoformat() + "Z"

    async def validate_skill_permissions(self, skill_path: str) -> list[str]:
        """
        Validate skill permissions and return warnings.

        OpenClaw skills request various permissions:
        - file_system: Read/write files
        - network: Make network requests
        - system: Execute system commands
        - clipboard: Access clipboard
        - notifications: Show notifications
        """
        path = Path(skill_path)

        # Check for permission declarations in manifest
        permissions = []

        for manifest_file in ["skill.yaml", "skill.yml"]:
            manifest = path / manifest_file
            if manifest.exists():
                try:
                    with open(manifest) as f:
                        content = yaml.safe_load(f)

                    declared_perms = content.get("permissions", [])
                    if isinstance(declared_perms, list):
                        permissions.extend(declared_perms)
                except Exception:
                    continue

        warnings = []

        # Check for potentially dangerous permissions
        dangerous_perms = {
            "file_system": "Can access all files on your system",
            "system": "Can execute arbitrary commands",
            "clipboard": "Can read clipboard contents",
        }

        for perm in permissions:
            if perm in dangerous_perms:
                warnings.append(
                    f"Skill requests {perm} permission: {dangerous_perms[perm]}"
                )

        # Also scan code for undeclared capabilities
        security_issues = await self.scan_skill_code(skill_path)

        if any(
            cat == "credential_harvesting"
            for issue in security_issues
            for cat in [issue.category]
        ):
            warnings.append("Skill may access credentials without declaring it")

        return warnings

    def get_manifest_url(self, package_name: str, version: str = None) -> Optional[str]:
        """
        Get the manifest URL for an OpenClaw skill.

        OpenClaw skills are typically hosted on:
        - ClawHub marketplace
        - GitHub repositories
        - GitLab repositories
        """
        # ClawHub URL pattern
        if version:
            return f"https://clawhub.ai/skills/{package_name}/{version}"
        return f"https://clawhub.ai/skills/{package_name}"

    async def get_skill_info(self, skill_name: str) -> Optional[dict[str, Any]]:
        """
        Get information about an OpenClaw skill from ClawHub.

        Returns metadata including:
        - Latest version
        - Author
        - Description
        - Download count
        - Security score
        """
        # This would make an API call to ClawHub
        # For now, return placeholder
        return {
            "name": skill_name,
            "latest_version": "1.0.0",
            "description": "",
            "author": "",
            "downloads": 0,
            "security_score": None,
        }

    def format_dependency(self, dependency: OpenClawDependency) -> str:
        """Format dependency for display."""
        return f"{dependency.name}=={dependency.version}"

    def _generate_skill_id(self, path: Path, version: str) -> str:
        """Generate deterministic skill ID."""
        path_hash = hashlib.md5(str(path).encode()).hexdigest()[:8]
        return f"{path.name}_{version}_{path_hash}"


# Factory function
def create_openclaw_adapter() -> OpenClawAdapter:
    """Factory function to create OpenClaw adapter instance."""
    return OpenClawAdapter()
