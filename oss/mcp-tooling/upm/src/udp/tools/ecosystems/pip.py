"""
pip ecosystem adapter.

Handles parsing of requirements.txt, Pipfile, Pipfile.lock, and pyproject.toml files,
dependency resolution, and PyPI registry integration.
"""

import json
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID

import httpx
import toml
from packaging import version, specifiers

from udp.domain.models import EcosystemType, LicenseType, Package
from udp.tools.ecosystems.base import (
    DependencyInfo,
    EcosystemAdapter,
    ParsedManifest,
    ParseError,
    RegistryError,
    ResolutionError,
    ResolutionResult,
)
from udp.tools.ecosystems.factory import register_ecosystem_adapter


@register_ecosystem_adapter(EcosystemType.PYPI, ["txt", "toml", "cfg", "ini"])
class PipAdapter(EcosystemAdapter):
    """pip ecosystem adapter."""
    
    def __init__(self, organization_id: UUID):
        super().__init__(organization_id)
        self._http_client: Optional[httpx.AsyncClient] = None
    
    @property
    def ecosystem_type(self) -> EcosystemType:
        return EcosystemType.PYPI
    
    @property
    def supported_file_extensions(self) -> List[str]:
        return ["txt", "toml", "cfg", "ini"]
    
    @property
    def registry_url(self) -> str:
        return "https://pypi.org"
    
    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get HTTP client for registry requests."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                headers={"User-Agent": "UDP/1.0"}
            )
        return self._http_client
    
    async def parse_manifest(self, manifest_content: str, file_path: str) -> ParsedManifest:
        """Parse Python manifest file (requirements.txt, Pipfile, pyproject.toml)."""
        file_extension = file_path.split('.')[-1].lower()
        
        if file_extension == "txt":
            return await self._parse_requirements_txt(manifest_content, file_path)
        elif file_extension == "toml":
            return await self._parse_toml_file(manifest_content, file_path)
        else:
            raise ParseError(f"Unsupported file type: {file_extension}", file_path)
    
    async def _parse_requirements_txt(self, content: str, file_path: str) -> ParsedManifest:
        """Parse requirements.txt file."""
        dependencies = []
        dev_dependencies = []
        
        lines = content.strip().split('\n')
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            
            # Skip empty lines and comments
            if not line or line.startswith('#'):
                continue
            
            # Parse dependency line
            dep_info = self._parse_requirement_line(line)
            if dep_info:
                if dep_info.is_dev_dependency:
                    dev_dependencies.append(dep_info)
                else:
                    dependencies.append(dep_info)
        
        return ParsedManifest(
            ecosystem=self.ecosystem_type,
            project_name="requirements-project",
            project_version="1.0.0",
            dependencies=dependencies,
            dev_dependencies=dev_dependencies,
            metadata={"source": "requirements.txt"}
        )
    
    async def _parse_toml_file(self, content: str, file_path: str) -> ParsedManifest:
        """Parse TOML file (Pipfile or pyproject.toml)."""
        try:
            data = toml.loads(content)
        except toml.TomlDecodeError as e:
            raise ParseError(f"Invalid TOML: {e}", file_path)
        
        # Check if it's a Pipfile
        if "packages" in data or "dev-packages" in data:
            return await self._parse_pipfile(data, file_path)
        # Check if it's a pyproject.toml
        elif "project" in data or "tool" in data:
            return await self._parse_pyproject_toml(data, file_path)
        else:
            raise ParseError("Unknown TOML format", file_path)
    
    async def _parse_pipfile(self, data: Dict[str, Any], file_path: str) -> ParsedManifest:
        """Parse Pipfile."""
        dependencies = []
        dev_dependencies = []
        
        # Regular packages
        packages = data.get("packages", {})
        for name, version_constraint in packages.items():
            dep_info = DependencyInfo(
                name=await self.normalize_package_name(name),
                version_constraint=str(version_constraint) if version_constraint != "*" else ">=0.0.0",
                ecosystem=self.ecosystem_type,
                is_dev_dependency=False,
                metadata={"source": "packages"}
            )
            dependencies.append(dep_info)
        
        # Development packages
        dev_packages = data.get("dev-packages", {})
        for name, version_constraint in dev_packages.items():
            dep_info = DependencyInfo(
                name=await self.normalize_package_name(name),
                version_constraint=str(version_constraint) if version_constraint != "*" else ">=0.0.0",
                ecosystem=self.ecosystem_type,
                is_dev_dependency=True,
                metadata={"source": "dev-packages"}
            )
            dev_dependencies.append(dep_info)
        
        # Extract project info
        project_name = data.get("name", "pipfile-project")
        project_version = data.get("version", "1.0.0")
        
        return ParsedManifest(
            ecosystem=self.ecosystem_type,
            project_name=project_name,
            project_version=project_version,
            dependencies=dependencies,
            dev_dependencies=dev_dependencies,
            metadata={
                "source": "Pipfile",
                "python_version": data.get("requires", {}).get("python_version"),
                "pipenv_version": data.get("pipenv", {}).get("version"),
            }
        )
    
    async def _parse_pyproject_toml(self, data: Dict[str, Any], file_path: str) -> ParsedManifest:
        """Parse pyproject.toml file."""
        dependencies = []
        dev_dependencies = []
        
        # Extract project info
        project_data = data.get("project", {})
        project_name = project_data.get("name", "pyproject-project")
        project_version = project_data.get("version", "1.0.0")
        
        # Dependencies
        deps = project_data.get("dependencies", [])
        for dep in deps:
            dep_info = self._parse_requirement_line(dep)
            if dep_info:
                dependencies.append(dep_info)
        
        # Optional dependencies (dev dependencies)
        optional_deps = project_data.get("optional-dependencies", {})
        for group_name, group_deps in optional_deps.items():
            for dep in group_deps:
                dep_info = self._parse_requirement_line(dep)
                if dep_info:
                    dep_info.is_dev_dependency = True
                    dep_info.metadata["optional_group"] = group_name
                    dev_dependencies.append(dep_info)
        
        return ParsedManifest(
            ecosystem=self.ecosystem_type,
            project_name=project_name,
            project_version=project_version,
            dependencies=dependencies,
            dev_dependencies=dev_dependencies,
            metadata={
                "source": "pyproject.toml",
                "description": project_data.get("description"),
                "authors": project_data.get("authors", []),
                "license": project_data.get("license"),
                "readme": project_data.get("readme"),
                "requires_python": project_data.get("requires-python"),
            }
        )
    
    def _parse_requirement_line(self, line: str) -> Optional[DependencyInfo]:
        """Parse a single requirement line."""
        line = line.strip()
        if not line or line.startswith('#'):
            return None
        
        # Handle different requirement formats
        # Examples: package==1.0.0, package>=1.0.0, package[extra], package @ git+https://...
        
        # Extract package name and version constraint
        if ' @ ' in line:
            # URL or path requirement
            name_part, url_part = line.split(' @ ', 1)
            name = name_part.strip()
            version_constraint = url_part.strip()
            source = url_part
        elif '[' in line and ']' in line:
            # Package with extras
            name_part = line.split('[')[0]
            name = name_part.strip()
            version_constraint = line[len(name):].strip()
            source = None
        else:
            # Regular requirement
            parts = re.split(r'([><=!]+)', line, 1)
            name = parts[0].strip()
            if len(parts) > 1:
                version_constraint = (parts[1] + parts[2]).strip() if len(parts) > 2 else parts[1].strip()
            else:
                version_constraint = ">=0.0.0"
            source = None
        
        # Determine if it's a dev dependency (heuristic)
        is_dev = any(keyword in name.lower() for keyword in ['test', 'dev', 'debug', 'lint'])
        
        return DependencyInfo(
            name=name,
            version_constraint=version_constraint,
            ecosystem=self.ecosystem_type,
            is_dev_dependency=is_dev,
            source=source,
            metadata={"original_line": line}
        )
    
    async def parse_lock_file(self, lock_content: str, file_path: str) -> Dict[str, Any]:
        """Parse lock file (Pipfile.lock or poetry.lock)."""
        file_extension = file_path.split('.')[-1].lower()
        
        if file_extension == "lock":
            if "pipfile" in file_path.lower():
                return await self._parse_pipfile_lock(lock_content, file_path)
            else:
                return await self._parse_poetry_lock(lock_content, file_path)
        else:
            raise ParseError(f"Unsupported lock file type: {file_extension}", file_path)
    
    async def _parse_pipfile_lock(self, content: str, file_path: str) -> Dict[str, Any]:
        """Parse Pipfile.lock file."""
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            raise ParseError(f"Invalid JSON: {e}", file_path)
        
        resolved_deps = {}
        
        # Default packages
        default_packages = data.get("default", {})
        for name, package_info in default_packages.items():
            resolved_deps[name] = {
                "version": package_info.get("version"),
                "hashes": package_info.get("hashes", []),
                "index": package_info.get("index", "pypi"),
                "markers": package_info.get("markers"),
            }
        
        # Development packages
        develop_packages = data.get("develop", {})
        for name, package_info in develop_packages.items():
            resolved_deps[name] = {
                "version": package_info.get("version"),
                "hashes": package_info.get("hashes", []),
                "index": package_info.get("index", "pypi"),
                "markers": package_info.get("markers"),
                "dev": True,
            }
        
        return {
            "lockfile_version": data.get("_meta", {}).get("hash", {}).get("sha256"),
            "resolved_dependencies": resolved_deps,
            "metadata": {
                "pipfile_spec": data.get("_meta", {}).get("pipfile-spec"),
                "requires": data.get("_meta", {}).get("requires", {}),
            }
        }
    
    async def _parse_poetry_lock(self, content: str, file_path: str) -> Dict[str, Any]:
        """Parse poetry.lock file."""
        try:
            data = toml.loads(content)
        except toml.TomlDecodeError as e:
            raise ParseError(f"Invalid TOML: {e}", file_path)
        
        resolved_deps = {}
        
        # Poetry lock format
        packages = data.get("package", [])
        for package in packages:
            name = package.get("name")
            if name:
                resolved_deps[name] = {
                    "version": package.get("version"),
                    "description": package.get("description"),
                    "category": package.get("category"),
                    "optional": package.get("optional", False),
                    "python_versions": package.get("python-versions"),
                    "dependencies": package.get("dependencies", {}),
                }
        
        return {
            "lockfile_version": data.get("metadata", {}).get("lock-version"),
            "resolved_dependencies": resolved_deps,
            "metadata": {
                "content_hash": data.get("metadata", {}).get("content-hash"),
                "python_versions": data.get("metadata", {}).get("python-versions"),
            }
        }
    
    async def resolve_dependencies(
        self, 
        parsed_manifest: ParsedManifest,
        organization_id: UUID
    ) -> ResolutionResult:
        """Resolve dependencies for Python project."""
        resolved_packages = []
        conflicts = []
        warnings = []
        
        # Combine all dependencies
        all_deps = parsed_manifest.dependencies + parsed_manifest.dev_dependencies
        
        # Track version conflicts
        package_versions: Dict[str, Set[str]] = {}
        
        for dep_info in all_deps:
            try:
                # Resolve version constraint
                resolved_version = await self._resolve_version_constraint(
                    dep_info.name, 
                    dep_info.version_constraint
                )
                
                if resolved_version:
                    # Check for conflicts
                    if dep_info.name in package_versions:
                        existing_versions = package_versions[dep_info.name]
                        if resolved_version not in existing_versions:
                            conflicts.append({
                                "package": dep_info.name,
                                "conflicting_versions": list(existing_versions) + [resolved_version],
                                "constraints": [dep_info.version_constraint]
                            })
                    else:
                        package_versions[dep_info.name] = {resolved_version}
                    
                    # Fetch package metadata
                    package = await self.fetch_package_metadata(dep_info.name, resolved_version)
                    if package:
                        resolved_packages.append(package)
                    else:
                        warnings.append(f"Could not fetch metadata for {dep_info.name}@{resolved_version}")
                else:
                    warnings.append(f"Could not resolve version for {dep_info.name} with constraint {dep_info.version_constraint}")
                    
            except Exception as e:
                warnings.append(f"Error resolving {dep_info.name}: {str(e)}")
        
        return ResolutionResult(
            resolved_dependencies=resolved_packages,
            conflicts=conflicts,
            warnings=warnings,
            metadata={
                "total_dependencies": len(all_deps),
                "resolved_count": len(resolved_packages),
                "conflict_count": len(conflicts),
                "warning_count": len(warnings),
            }
        )
    
    async def fetch_package_metadata(self, package_name: str, version: str) -> Optional[Package]:
        """Fetch package metadata from PyPI."""
        try:
            client = await self._get_http_client()
            
            # Check cache first
            cache_key = f"package:{package_name}:{version}"
            cached = await self._get_cached(cache_key)
            if cached:
                return Package(**cached)
            
            # Fetch from PyPI JSON API
            url = f"{self.registry_url}/pypi/{package_name}/{version}/json"
            response = await client.get(url)
            
            if response.status_code == 404:
                return None
            elif response.status_code != 200:
                raise RegistryError(
                    f"Registry request failed: {response.status_code}",
                    self.registry_url,
                    response.status_code
                )
            
            data = response.json()
            info = data.get("info", {})
            urls = data.get("urls", [])
            
            # Find the source distribution URL
            download_url = None
            size_bytes = None
            for url_info in urls:
                if url_info.get("packagetype") == "sdist":
                    download_url = url_info.get("url")
                    size_bytes = url_info.get("size")
                    break
            
            # Convert to Package model
            package = Package(
                name=await self.normalize_package_name(info.get("name", package_name)),
                version=info.get("version", version),
                ecosystem=self.ecosystem_type,
                description=info.get("summary"),
                homepage=info.get("home_page"),
                repository_url=self._extract_repository_url(info.get("project_urls", {})),
                license=self._parse_license(info.get("license")),
                author=self._extract_author(info.get("author")),
                maintainers=self._extract_maintainers(info.get("maintainer", "")),
                published_at=self._parse_date(info.get("upload_time")),
                download_url=download_url,
                size_bytes=size_bytes,
                tags=set(info.get("keywords", "").split(",") if info.get("keywords") else []),
                metadata={
                    "registry_url": url,
                    "classifiers": info.get("classifiers", []),
                    "requires_dist": info.get("requires_dist", []),
                    "requires_python": info.get("requires_python"),
                    "project_urls": info.get("project_urls", {}),
                }
            )
            
            # Cache the result
            await self._set_cached(cache_key, package.dict())
            
            return package
            
        except httpx.RequestError as e:
            raise RegistryError(f"Network error: {e}", self.registry_url)
        except Exception as e:
            raise RegistryError(f"Unexpected error: {e}", self.registry_url)
    
    async def generate_lock_file(
        self, 
        resolved_dependencies: List[Package],
        output_format: str = "json"
    ) -> str:
        """Generate lock file."""
        if output_format == "json":
            # Generate Pipfile.lock format
            lock_data = {
                "_meta": {
                    "hash": {"sha256": "generated"},
                    "pipfile-spec": 6,
                    "requires": {"python_version": "3.11"}
                },
                "default": {},
                "develop": {}
            }
            
            for package in resolved_dependencies:
                package_data = {
                    "version": f"=={package.version}",
                    "hashes": [package.checksum] if package.checksum else [],
                    "index": "pypi"
                }
                
                if package.metadata.get("dev"):
                    lock_data["develop"][package.name] = package_data
                else:
                    lock_data["default"][package.name] = package_data
            
            return json.dumps(lock_data, indent=2)
        else:
            raise ValueError(f"Unsupported output format: {output_format}")
    
    async def validate_version_constraint(self, constraint: str) -> bool:
        """Validate pip version constraint."""
        if not constraint or not constraint.strip():
            return False
        
        try:
            # Use packaging library to validate
            specifiers.SpecifierSet(constraint)
            return True
        except (specifiers.InvalidSpecifier, specifiers.InvalidVersion):
            return False
    
    async def normalize_package_name(self, name: str) -> str:
        """Normalize Python package name."""
        if not name:
            return name
        
        # Python package names are lowercase with hyphens converted to underscores
        normalized = name.strip().lower()
        
        # Remove extras (e.g., package[extra] -> package)
        if '[' in normalized:
            normalized = normalized.split('[')[0]
        
        return normalized
    
    def _extract_repository_url(self, project_urls: Dict[str, str]) -> Optional[str]:
        """Extract repository URL from project URLs."""
        for key in ["Source", "Repository", "Homepage"]:
            if key in project_urls:
                return project_urls[key]
        return None
    
    def _parse_license(self, license_data: Any) -> LicenseType:
        """Parse license information."""
        if isinstance(license_data, str):
            license_type = license_data
        else:
            license_type = "Unknown"
        
        # Map common licenses
        license_mapping = {
            "MIT": LicenseType.MIT,
            "Apache-2.0": LicenseType.APACHE_2_0,
            "Apache Software License": LicenseType.APACHE_2_0,
            "BSD-2-Clause": LicenseType.BSD_2_CLAUSE,
            "BSD-3-Clause": LicenseType.BSD_3_CLAUSE,
            "GPL-2.0": LicenseType.GPL_2_0,
            "GPL-3.0": LicenseType.GPL_3_0,
            "LGPL-2.1": LicenseType.LGPL_2_1,
            "LGPL-3.0": LicenseType.LGPL_3_0,
            "ISC": LicenseType.ISC,
            "Unlicense": LicenseType.UNLICENSE,
        }
        
        return license_mapping.get(license_type, LicenseType.UNKNOWN)
    
    def _extract_author(self, author_data: Any) -> Optional[str]:
        """Extract author information."""
        if isinstance(author_data, str):
            return author_data
        return None
    
    def _extract_maintainers(self, maintainer_data: str) -> List[str]:
        """Extract maintainer information."""
        if maintainer_data:
            return [maintainer.strip() for maintainer in maintainer_data.split(",")]
        return []
    
    def _parse_date(self, date_str: Optional[str]) -> Optional[str]:
        """Parse date string."""
        if not date_str:
            return None
        # Return as-is for now, could add proper date parsing
        return date_str
    
    async def _resolve_version_constraint(self, package_name: str, constraint: str) -> Optional[str]:
        """Resolve version constraint to specific version."""
        try:
            # For now, implement basic resolution
            # In production, this would query PyPI for available versions
            
            # Handle special cases
            if constraint.startswith("git+"):
                return "0.0.0"  # Placeholder for git dependencies
            
            # Try to parse as version
            if re.match(r'^[\d]+\.[\d]+\.[\d]+$', constraint):
                return constraint
            
            # For other constraints, would need to query PyPI
            # This is a simplified implementation
            return "1.0.0"  # Placeholder
            
        except Exception:
            return None
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

