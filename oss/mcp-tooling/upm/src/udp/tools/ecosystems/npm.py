"""
npm ecosystem adapter.

Handles parsing of package.json and package-lock.json files,
dependency resolution, and npm registry integration.
"""

import json
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID

import httpx
import semver
from packaging import version

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


@register_ecosystem_adapter(EcosystemType.NPM, ["json"])
class NpmAdapter(EcosystemAdapter):
    """npm ecosystem adapter."""
    
    def __init__(self, organization_id: UUID):
        super().__init__(organization_id)
        self._http_client: Optional[httpx.AsyncClient] = None
    
    @property
    def ecosystem_type(self) -> EcosystemType:
        return EcosystemType.NPM
    
    @property
    def supported_file_extensions(self) -> List[str]:
        return ["json"]
    
    @property
    def registry_url(self) -> str:
        return "https://registry.npmjs.org"
    
    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get HTTP client for registry requests."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                headers={"User-Agent": "UDP/1.0"}
            )
        return self._http_client
    
    async def parse_manifest(self, manifest_content: str, file_path: str) -> ParsedManifest:
        """Parse package.json file."""
        try:
            data = json.loads(manifest_content)
        except json.JSONDecodeError as e:
            raise ParseError(f"Invalid JSON: {e}", file_path)
        
        if not isinstance(data, dict):
            raise ParseError("Manifest must be a JSON object", file_path)
        
        # Extract basic project info
        project_name = data.get("name", "unknown")
        project_version = data.get("version", "1.0.0")
        
        # Parse dependencies
        dependencies = []
        dev_dependencies = []
        
        # Regular dependencies
        deps = data.get("dependencies", {})
        for name, version_constraint in deps.items():
            if isinstance(version_constraint, str):
                dep_info = DependencyInfo(
                    name=await self.normalize_package_name(name),
                    version_constraint=version_constraint,
                    ecosystem=self.ecosystem_type,
                    namespace=self._extract_namespace(name),
                    is_dev_dependency=False,
                    metadata={"source": "dependencies"}
                )
                dependencies.append(dep_info)
        
        # Development dependencies
        dev_deps = data.get("devDependencies", {})
        for name, version_constraint in dev_deps.items():
            if isinstance(version_constraint, str):
                dep_info = DependencyInfo(
                    name=await self.normalize_package_name(name),
                    version_constraint=version_constraint,
                    ecosystem=self.ecosystem_type,
                    namespace=self._extract_namespace(name),
                    is_dev_dependency=True,
                    metadata={"source": "devDependencies"}
                )
                dev_dependencies.append(dep_info)
        
        # Optional dependencies
        optional_deps = data.get("optionalDependencies", {})
        for name, version_constraint in optional_deps.items():
            if isinstance(version_constraint, str):
                dep_info = DependencyInfo(
                    name=await self.normalize_package_name(name),
                    version_constraint=version_constraint,
                    ecosystem=self.ecosystem_type,
                    namespace=self._extract_namespace(name),
                    is_optional=True,
                    metadata={"source": "optionalDependencies"}
                )
                dependencies.append(dep_info)
        
        return ParsedManifest(
            ecosystem=self.ecosystem_type,
            project_name=project_name,
            project_version=project_version,
            dependencies=dependencies,
            dev_dependencies=dev_dependencies,
            metadata={
                "description": data.get("description"),
                "author": data.get("author"),
                "license": data.get("license"),
                "repository": data.get("repository"),
                "homepage": data.get("homepage"),
                "keywords": data.get("keywords", []),
                "engines": data.get("engines", {}),
                "scripts": data.get("scripts", {}),
            }
        )
    
    async def parse_lock_file(self, lock_content: str, file_path: str) -> Dict[str, Any]:
        """Parse package-lock.json file."""
        try:
            data = json.loads(lock_content)
        except json.JSONDecodeError as e:
            raise ParseError(f"Invalid JSON: {e}", file_path)
        
        if not isinstance(data, dict):
            raise ParseError("Lock file must be a JSON object", file_path)
        
        # Extract resolved dependencies
        resolved_deps = {}
        
        # Handle different lock file formats
        if "packages" in data:
            # npm v7+ format
            packages = data.get("packages", {})
            for package_path, package_info in packages.items():
                if package_path and package_info.get("resolved"):
                    name = self._extract_package_name_from_path(package_path)
                    if name:
                        resolved_deps[name] = {
                            "version": package_info.get("version"),
                            "resolved": package_info.get("resolved"),
                            "integrity": package_info.get("integrity"),
                            "dependencies": package_info.get("dependencies", {}),
                        }
        elif "dependencies" in data:
            # npm v6 format
            deps = data.get("dependencies", {})
            for name, dep_info in deps.items():
                if isinstance(dep_info, dict) and "version" in dep_info:
                    resolved_deps[name] = {
                        "version": dep_info.get("version"),
                        "resolved": dep_info.get("resolved"),
                        "integrity": dep_info.get("integrity"),
                        "dependencies": dep_info.get("dependencies", {}),
                    }
        
        return {
            "lockfileVersion": data.get("lockfileVersion"),
            "resolved_dependencies": resolved_deps,
            "metadata": {
                "name": data.get("name"),
                "version": data.get("version"),
                "requires": data.get("requires", True),
            }
        }
    
    async def resolve_dependencies(
        self, 
        parsed_manifest: ParsedManifest,
        organization_id: UUID
    ) -> ResolutionResult:
        """Resolve dependencies for npm project."""
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
        """Fetch package metadata from npm registry."""
        try:
            client = await self._get_http_client()
            
            # Check cache first
            cache_key = f"package:{package_name}:{version}"
            cached = await self._get_cached(cache_key)
            if cached:
                return Package(**cached)
            
            # Fetch from registry
            url = f"{self.registry_url}/{package_name}/{version}"
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
            
            # Convert to Package model
            package = Package(
                name=await self.normalize_package_name(data.get("name", package_name)),
                version=data.get("version", version),
                ecosystem=self.ecosystem_type,
                namespace=self._extract_namespace(data.get("name", package_name)),
                description=data.get("description"),
                homepage=data.get("homepage"),
                repository_url=self._extract_repository_url(data.get("repository")),
                license=self._parse_license(data.get("license")),
                author=self._extract_author(data.get("author")),
                maintainers=self._extract_maintainers(data.get("maintainers", [])),
                published_at=self._parse_date(data.get("time", {}).get(version)),
                download_url=data.get("dist", {}).get("tarball"),
                size_bytes=data.get("dist", {}).get("unpackedSize"),
                checksum=data.get("dist", {}).get("integrity"),
                tags=set(data.get("keywords", [])),
                metadata={
                    "registry_url": url,
                    "deprecated": data.get("deprecated"),
                    "engines": data.get("engines", {}),
                    "peer_dependencies": data.get("peerDependencies", {}),
                    "peer_dependencies_meta": data.get("peerDependenciesMeta", {}),
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
        """Generate package-lock.json file."""
        if output_format != "json":
            raise ValueError("npm only supports JSON lock file format")
        
        lock_data = {
            "name": "generated-project",
            "version": "1.0.0",
            "lockfileVersion": 2,
            "requires": True,
            "packages": {}
        }
        
        for package in resolved_dependencies:
            package_key = f"node_modules/{package.name}"
            if package.namespace:
                package_key = f"node_modules/{package.namespace}/{package.name}"
            
            lock_data["packages"][package_key] = {
                "version": package.version,
                "resolved": package.download_url,
                "integrity": package.checksum,
                "dependencies": {}
            }
        
        return json.dumps(lock_data, indent=2)
    
    async def validate_version_constraint(self, constraint: str) -> bool:
        """Validate npm version constraint."""
        if not constraint or not constraint.strip():
            return False
        
        # npm supports various constraint formats
        # Examples: ^1.0.0, ~1.0.0, >=1.0.0, 1.0.0, latest, etc.
        constraint = constraint.strip()
        
        # Check for valid semver patterns
        semver_patterns = [
            r'^\^[\d]+\.[\d]+\.[\d]+',  # ^1.0.0
            r'^~[\d]+\.[\d]+\.[\d]+',  # ~1.0.0
            r'^>=?[\d]+\.[\d]+\.[\d]+',  # >=1.0.0, >1.0.0
            r'^<=?[\d]+\.[\d]+\.[\d]+',  # <=1.0.0, <1.0.0
            r'^[\d]+\.[\d]+\.[\d]+',  # 1.0.0
            r'^[\d]+\.[\d]+',  # 1.0
            r'^[\d]+',  # 1
            r'^latest$',  # latest
            r'^[\w\-\.]+$',  # tag names
        ]
        
        return any(re.match(pattern, constraint) for pattern in semver_patterns)
    
    async def normalize_package_name(self, name: str) -> str:
        """Normalize npm package name."""
        if not name:
            return name
        
        # npm package names are lowercase
        normalized = name.strip().lower()
        
        # Remove @scope/ prefix for normalization (we'll handle scopes separately)
        if normalized.startswith('@'):
            parts = normalized.split('/', 1)
            if len(parts) == 2:
                return parts[1]
        
        return normalized
    
    def _extract_namespace(self, name: str) -> Optional[str]:
        """Extract namespace from scoped package name."""
        if name.startswith('@'):
            parts = name.split('/', 1)
            if len(parts) == 2:
                return parts[0][1:]  # Remove @ prefix
        return None
    
    def _extract_package_name_from_path(self, path: str) -> Optional[str]:
        """Extract package name from node_modules path."""
        if not path or path == "":
            return None
        
        # Handle scoped packages
        if path.startswith("node_modules/"):
            path = path[13:]  # Remove "node_modules/" prefix
        
        # Handle scoped packages (@scope/package)
        if path.startswith("@"):
            parts = path.split("/", 2)
            if len(parts) >= 2:
                return f"@{parts[1]}"
        else:
            # Regular package
            parts = path.split("/")
            return parts[0] if parts else None
        
        return None
    
    def _extract_repository_url(self, repo_data: Any) -> Optional[str]:
        """Extract repository URL from npm package data."""
        if isinstance(repo_data, dict):
            return repo_data.get("url")
        elif isinstance(repo_data, str):
            return repo_data
        return None
    
    def _parse_license(self, license_data: Any) -> LicenseType:
        """Parse license information."""
        if isinstance(license_data, dict):
            license_type = license_data.get("type", "Unknown")
        elif isinstance(license_data, str):
            license_type = license_data
        else:
            license_type = "Unknown"
        
        # Map common licenses
        license_mapping = {
            "MIT": LicenseType.MIT,
            "Apache-2.0": LicenseType.APACHE_2_0,
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
        if isinstance(author_data, dict):
            return author_data.get("name")
        elif isinstance(author_data, str):
            return author_data
        return None
    
    def _extract_maintainers(self, maintainers_data: List[Any]) -> List[str]:
        """Extract maintainer information."""
        maintainers = []
        for maintainer in maintainers_data:
            if isinstance(maintainer, dict):
                name = maintainer.get("name")
                if name:
                    maintainers.append(name)
            elif isinstance(maintainer, str):
                maintainers.append(maintainer)
        return maintainers
    
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
            # In production, this would query the registry for available versions
            
            # Handle special cases
            if constraint == "latest":
                # Would fetch latest version from registry
                return "1.0.0"  # Placeholder
            
            # Try to parse as semver
            if re.match(r'^[\d]+\.[\d]+\.[\d]+$', constraint):
                return constraint
            
            # For other constraints, would need to query registry
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

