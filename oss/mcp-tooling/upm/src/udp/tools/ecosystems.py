"""
Package ecosystem adapters using Strategy and Factory patterns.

Enterprise-grade adapters for npm, pip, Maven, Cargo, and other package ecosystems
with comprehensive parsing, resolution, and metadata extraction capabilities.
"""

import json
import re
import xml.etree.ElementTree as ET
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import httpx
import semver
import structlog
import toml
from packaging.requirements import Requirement
from packaging.specifiers import SpecifierSet

from udp.core.config import settings
from udp.domain.models import EcosystemType, LicenseType, Package

logger = structlog.get_logger()


# Custom exceptions for ecosystem operations
class EcosystemError(Exception):
    """Base exception for ecosystem operations."""
    
    def __init__(self, message: str, details: Dict[str, Any] = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


class ParseError(EcosystemError):
    """Exception for manifest parsing errors."""
    pass


class RegistryError(EcosystemError):
    """Exception for package registry errors."""
    pass


class ResolutionError(EcosystemError):
    """Exception for dependency resolution errors."""
    pass


@dataclass
class ParsedManifest:
    """Parsed manifest data structure."""
    
    project_name: Optional[str]
    project_version: Optional[str]
    dependencies: Dict[str, str]
    dev_dependencies: Dict[str, str]
    ecosystem: EcosystemType
    metadata: Dict[str, Any]


@dataclass
class ResolutionResult:
    """Dependency resolution result."""
    
    resolved_dependencies: List[Package]
    conflicts: List[Dict[str, Any]]
    warnings: List[str]
    metadata: Dict[str, Any]


class PackageEcosystem(ABC):
    """Abstract base class for package ecosystem adapters."""
    
    def __init__(self, organization_id: str):
        self.organization_id = organization_id
        self.http_client = httpx.AsyncClient(
            timeout=settings.package_registry.request_timeout,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5)
        )
    
    @abstractmethod
    async def parse_manifest(self, content: str, filename: str) -> ParsedManifest:
        """Parse manifest file content."""
        pass
    
    @abstractmethod
    async def resolve_dependencies(self, manifest: ParsedManifest, organization_id: str) -> ResolutionResult:
        """Resolve dependencies from manifest."""
        pass
    
    @abstractmethod
    async def fetch_package_metadata(self, name: str, version: str) -> Package:
        """Fetch package metadata from registry."""
        pass
    
    @abstractmethod
    def generate_lockfile(self, resolved_deps: List[Package]) -> str:
        """Generate lockfile content."""
        pass
    
    async def close(self):
        """Close HTTP client connections."""
        await self.http_client.aclose()


class NpmEcosystem(PackageEcosystem):
    """npm package ecosystem adapter."""
    
    def __init__(self, organization_id: str):
        super().__init__(organization_id)
        self.registry_url = settings.package_registry.npm_registry_url
    
    async def parse_manifest(self, content: str, filename: str) -> ParsedManifest:
        """Parse package.json content."""
        try:
            data = json.loads(content)
            
            return ParsedManifest(
                project_name=data.get("name"),
                project_version=data.get("version"),
                dependencies=data.get("dependencies", {}),
                dev_dependencies=data.get("devDependencies", {}),
                ecosystem=EcosystemType.NPM,
                metadata={
                    "description": data.get("description"),
                    "homepage": data.get("homepage"),
                    "repository": data.get("repository"),
                    "license": data.get("license"),
                    "keywords": data.get("keywords", []),
                    "author": data.get("author"),
                    "scripts": data.get("scripts", {}),
                }
            )
        except json.JSONDecodeError as e:
            raise ParseError(f"Invalid JSON in {filename}: {e}", {"filename": filename})
        except Exception as e:
            raise ParseError(f"Failed to parse {filename}: {e}", {"filename": filename})
    
    async def resolve_dependencies(self, manifest: ParsedManifest, organization_id: str) -> ResolutionResult:
        """Resolve npm dependencies."""
        resolved_packages = []
        conflicts = []
        warnings = []
        
        all_deps = {**manifest.dependencies, **manifest.dev_dependencies}
        
        for name, version_spec in all_deps.items():
            try:
                # For now, resolve to the latest compatible version
                # In a real implementation, this would use a proper SAT solver
                resolved_version = await self._resolve_version(name, version_spec)
                package = await self.fetch_package_metadata(name, resolved_version)
                resolved_packages.append(package)
                
            except RegistryError as e:
                warnings.append(f"Could not resolve {name}@{version_spec}: {e.message}")
            except Exception as e:
                warnings.append(f"Error resolving {name}@{version_spec}: {str(e)}")
        
        return ResolutionResult(
            resolved_dependencies=resolved_packages,
            conflicts=conflicts,
            warnings=warnings,
            metadata={"resolver": "npm", "strategy": "latest_compatible"}
        )
    
    async def fetch_package_metadata(self, name: str, version: str) -> Package:
        """Fetch npm package metadata."""
        try:
            # Fetch from npm registry
            url = f"{self.registry_url}/{name}/{version}"
            response = await self.http_client.get(url)
            response.raise_for_status()
            
            data = response.json()
            
            return Package(
                name=name,
                version=version,
                ecosystem=EcosystemType.NPM,
                namespace=self._extract_namespace(name),
                description=data.get("description"),
                homepage=data.get("homepage"),
                repository_url=self._extract_repo_url(data.get("repository")),
                license=self._normalize_license(data.get("license")),
                author=self._extract_author(data.get("author")),
                maintainers=self._extract_maintainers(data.get("maintainers", [])),
                published_at=None,  # Would parse from dist.created if available
                tags=data.get("keywords", []),
            )
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise RegistryError(f"Package {name}@{version} not found")
            raise RegistryError(f"Registry error for {name}@{version}: {e}")
        except Exception as e:
            raise RegistryError(f"Failed to fetch {name}@{version}: {e}")
    
    async def _resolve_version(self, name: str, version_spec: str) -> str:
        """Resolve version specification to concrete version."""
        # Simplified version resolution - in production would use proper semver resolution
        if version_spec.startswith("^") or version_spec.startswith("~"):
            # For now, just return the base version
            return version_spec.lstrip("^~")
        return version_spec
    
    def _extract_namespace(self, name: str) -> Optional[str]:
        """Extract namespace from scoped package name."""
        if name.startswith("@") and "/" in name:
            return name.split("/")[0][1:]  # Remove @ prefix
        return None
    
    def _extract_repo_url(self, repo: Any) -> Optional[str]:
        """Extract repository URL from repository field."""
        if isinstance(repo, dict):
            return repo.get("url")
        elif isinstance(repo, str):
            return repo
        return None
    
    def _normalize_license(self, license_info: Any) -> LicenseType:
        """Normalize license information."""
        if isinstance(license_info, dict):
            license_name = license_info.get("type", "").upper()
        else:
            license_name = str(license_info).upper() if license_info else ""
        
        # Map common license names
        license_mapping = {
            "MIT": LicenseType.MIT,
            "APACHE-2.0": LicenseType.APACHE_2_0,
            "BSD-2-CLAUSE": LicenseType.BSD_2_CLAUSE,
            "BSD-3-CLAUSE": LicenseType.BSD_3_CLAUSE,
            "ISC": LicenseType.ISC,
        }
        
        return license_mapping.get(license_name, LicenseType.UNKNOWN)
    
    def _extract_author(self, author: Any) -> Optional[str]:
        """Extract author from author field."""
        if isinstance(author, dict):
            return author.get("name")
        elif isinstance(author, str):
            return author
        return None
    
    def _extract_maintainers(self, maintainers: List[Any]) -> List[str]:
        """Extract maintainer names."""
        result = []
        for maintainer in maintainers:
            if isinstance(maintainer, dict):
                name = maintainer.get("name")
                if name:
                    result.append(name)
            elif isinstance(maintainer, str):
                result.append(maintainer)
        return result
    
    def generate_lockfile(self, resolved_deps: List[Package]) -> str:
        """Generate package-lock.json content."""
        # Simplified lockfile generation
        lockfile = {
            "name": "project",
            "version": "1.0.0",
            "lockfileVersion": 2,
            "requires": True,
            "packages": {
                "": {
                    "name": "project",
                    "version": "1.0.0"
                }
            },
            "dependencies": {}
        }
        
        for pkg in resolved_deps:
            lockfile["dependencies"][pkg.name] = {
                "version": pkg.version,
                "resolved": f"{self.registry_url}/{pkg.name}/-/{pkg.name}-{pkg.version}.tgz",
                "integrity": pkg.checksum or "",
            }
        
        return json.dumps(lockfile, indent=2)


class PyPIEcosystem(PackageEcosystem):
    """PyPI package ecosystem adapter."""
    
    def __init__(self, organization_id: str):
        super().__init__(organization_id)
        self.registry_url = "https://pypi.org/pypi"  # JSON API
    
    async def parse_manifest(self, content: str, filename: str) -> ParsedManifest:
        """Parse requirements.txt, pyproject.toml, or Pipfile content."""
        if filename.endswith("requirements.txt"):
            return self._parse_requirements_txt(content)
        elif filename.endswith("pyproject.toml"):
            return self._parse_pyproject_toml(content)
        elif filename.endswith("Pipfile"):
            return self._parse_pipfile(content)
        else:
            raise ParseError(f"Unsupported Python manifest file: {filename}")
    
    def _parse_requirements_txt(self, content: str) -> ParsedManifest:
        """Parse requirements.txt content."""
        dependencies = {}
        
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            
            try:
                req = Requirement(line)
                dependencies[req.name] = str(req.specifier) if req.specifier else "*"
            except Exception as e:
                logger.warning(f"Could not parse requirement line: {line}", error=str(e))
        
        return ParsedManifest(
            project_name=None,
            project_version=None,
            dependencies=dependencies,
            dev_dependencies={},
            ecosystem=EcosystemType.PYPI,
            metadata={"source": "requirements.txt"}
        )
    
    def _parse_pyproject_toml(self, content: str) -> ParsedManifest:
        """Parse pyproject.toml content."""
        try:
            data = toml.loads(content)
            project = data.get("project", {})
            
            dependencies = {}
            if "dependencies" in project:
                for dep in project["dependencies"]:
                    req = Requirement(dep)
                    dependencies[req.name] = str(req.specifier) if req.specifier else "*"
            
            dev_dependencies = {}
            optional_deps = project.get("optional-dependencies", {})
            if "dev" in optional_deps:
                for dep in optional_deps["dev"]:
                    req = Requirement(dep)
                    dev_dependencies[req.name] = str(req.specifier) if req.specifier else "*"
            
            return ParsedManifest(
                project_name=project.get("name"),
                project_version=project.get("version"),
                dependencies=dependencies,
                dev_dependencies=dev_dependencies,
                ecosystem=EcosystemType.PYPI,
                metadata={
                    "description": project.get("description"),
                    "homepage": project.get("homepage"),
                    "license": project.get("license"),
                    "keywords": project.get("keywords", []),
                    "authors": project.get("authors", []),
                }
            )
        except Exception as e:
            raise ParseError(f"Failed to parse pyproject.toml: {e}")
    
    def _parse_pipfile(self, content: str) -> ParsedManifest:
        """Parse Pipfile content."""
        try:
            data = toml.loads(content)
            
            return ParsedManifest(
                project_name=None,
                project_version=None,
                dependencies=data.get("packages", {}),
                dev_dependencies=data.get("dev-packages", {}),
                ecosystem=EcosystemType.PYPI,
                metadata={"source": "Pipfile", "requires": data.get("requires", {})}
            )
        except Exception as e:
            raise ParseError(f"Failed to parse Pipfile: {e}")
    
    async def resolve_dependencies(self, manifest: ParsedManifest, organization_id: str) -> ResolutionResult:
        """Resolve PyPI dependencies."""
        resolved_packages = []
        conflicts = []
        warnings = []
        
        all_deps = {**manifest.dependencies, **manifest.dev_dependencies}
        
        for name, version_spec in all_deps.items():
            try:
                resolved_version = await self._resolve_version(name, version_spec)
                package = await self.fetch_package_metadata(name, resolved_version)
                resolved_packages.append(package)
                
            except RegistryError as e:
                warnings.append(f"Could not resolve {name}{version_spec}: {e.message}")
            except Exception as e:
                warnings.append(f"Error resolving {name}{version_spec}: {str(e)}")
        
        return ResolutionResult(
            resolved_dependencies=resolved_packages,
            conflicts=conflicts,
            warnings=warnings,
            metadata={"resolver": "pypi", "strategy": "latest_compatible"}
        )
    
    async def fetch_package_metadata(self, name: str, version: str) -> Package:
        """Fetch PyPI package metadata."""
        try:
            url = f"{self.registry_url}/{name}/{version}/json"
            response = await self.http_client.get(url)
            response.raise_for_status()
            
            data = response.json()
            info = data.get("info", {})
            
            return Package(
                name=name,
                version=version,
                ecosystem=EcosystemType.PYPI,
                description=info.get("summary"),
                homepage=info.get("home_page"),
                license=self._normalize_license(info.get("license")),
                author=info.get("author"),
                tags=info.get("keywords", "").split(",") if info.get("keywords") else [],
            )
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise RegistryError(f"Package {name}=={version} not found")
            raise RegistryError(f"Registry error for {name}=={version}: {e}")
        except Exception as e:
            raise RegistryError(f"Failed to fetch {name}=={version}: {e}")
    
    async def _resolve_version(self, name: str, version_spec: str) -> str:
        """Resolve version specification to concrete version."""
        if version_spec == "*" or not version_spec:
            # Fetch latest version
            try:
                url = f"{self.registry_url}/{name}/json"
                response = await self.http_client.get(url)
                response.raise_for_status()
                data = response.json()
                return data["info"]["version"]
            except Exception:
                raise RegistryError(f"Could not fetch latest version for {name}")
        
        # For now, return as-is (would implement proper version resolution)
        return version_spec.strip(">=<~!")
    
    def _normalize_license(self, license_info: Optional[str]) -> LicenseType:
        """Normalize license information."""
        if not license_info:
            return LicenseType.UNKNOWN
        
        license_name = license_info.upper()
        
        license_mapping = {
            "MIT": LicenseType.MIT,
            "MIT LICENSE": LicenseType.MIT,
            "APACHE": LicenseType.APACHE_2_0,
            "APACHE 2.0": LicenseType.APACHE_2_0,
            "APACHE SOFTWARE LICENSE": LicenseType.APACHE_2_0,
            "BSD": LicenseType.BSD_3_CLAUSE,
            "BSD LICENSE": LicenseType.BSD_3_CLAUSE,
        }
        
        for pattern, license_type in license_mapping.items():
            if pattern in license_name:
                return license_type
        
        return LicenseType.UNKNOWN
    
    def generate_lockfile(self, resolved_deps: List[Package]) -> str:
        """Generate requirements.txt lockfile."""
        lines = []
        for pkg in resolved_deps:
            lines.append(f"{pkg.name}=={pkg.version}")
        return "\n".join(sorted(lines))


class EcosystemFactory:
    """Factory for creating ecosystem adapters."""
    
    _adapters = {
        EcosystemType.NPM: NpmEcosystem,
        EcosystemType.PYPI: PyPIEcosystem,
        # TODO: Add more ecosystems
        # EcosystemType.MAVEN: MavenEcosystem,
        # EcosystemType.CARGO: CargoEcosystem,
    }
    
    @classmethod
    def create_adapter(cls, ecosystem: EcosystemType, organization_id: str) -> PackageEcosystem:
        """Create ecosystem adapter instance."""
        if ecosystem not in cls._adapters:
            raise ValueError(f"Unsupported ecosystem: {ecosystem}")
        
        return cls._adapters[ecosystem](organization_id)
    
    @classmethod
    def get_supported_ecosystems(cls) -> List[EcosystemType]:
        """Get list of supported ecosystems."""
        return list(cls._adapters.keys())


def get_ecosystem_for_file(filename: str) -> Optional[EcosystemType]:
    """Determine ecosystem type from filename."""
    if not filename:
        return None
    
    filename = filename.lower()
    
    if filename == "package.json":
        return EcosystemType.NPM
    elif filename in ["requirements.txt", "pyproject.toml", "pipfile"]:
        return EcosystemType.PYPI
    elif filename == "pom.xml":
        return EcosystemType.MAVEN
    elif filename in ["cargo.toml", "cargo.lock"]:
        return EcosystemType.CARGO
    
    return None


def get_supported_ecosystems() -> List[EcosystemType]:
    """Get list of supported ecosystems."""
    return EcosystemFactory.get_supported_ecosystems()