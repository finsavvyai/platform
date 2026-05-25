"""
Cargo ecosystem adapter for Universal Dependency Platform.

Handles parsing of Rust Cargo.toml and Cargo.lock files.
"""

import toml
import json
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
import logging

from .base import EcosystemAdapter, DependencyInfo, EcosystemType
from udp.domain.models import Package
from .factory import register_ecosystem_adapter

logger = logging.getLogger(__name__)


@register_ecosystem_adapter(EcosystemType.CARGO, ["lock"])
class CargoAdapter(EcosystemAdapter):
    """Cargo ecosystem adapter for Rust dependency management."""
    
    def __init__(self):
        super().__init__()
        self.ecosystem_type = EcosystemType.CARGO
        self.supported_extensions = ["toml", "lock"]
        self.manifest_files = ["Cargo.toml"]
        self.lock_files = ["Cargo.lock"]
    
    @property
    def registry_url(self) -> str:
        """Crates.io registry URL."""
        return "https://crates.io"
    
    def detect_ecosystem(self, project_path: Path) -> bool:
        """Detect if this is a Cargo project."""
        cargo_toml = project_path / "Cargo.toml"
        return cargo_toml.exists()
    
    def parse_manifest(self, manifest_path: Path) -> Dict[str, Any]:
        """Parse Cargo.toml file."""
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest_data = toml.load(f)
            
            # Extract package information
            package_info = manifest_data.get('package', {})
            project_info = {
                'name': package_info.get('name', ''),
                'version': package_info.get('version', ''),
                'edition': package_info.get('edition', '2018'),
                'authors': package_info.get('authors', []),
                'description': package_info.get('description', ''),
                'license': package_info.get('license', ''),
                'license_file': package_info.get('license-file', ''),
                'homepage': package_info.get('homepage', ''),
                'repository': package_info.get('repository', ''),
                'documentation': package_info.get('documentation', ''),
                'readme': package_info.get('readme', ''),
                'keywords': package_info.get('keywords', []),
                'categories': package_info.get('categories', []),
                'exclude': package_info.get('exclude', []),
                'include': package_info.get('include', []),
                'publish': package_info.get('publish', True),
                'workspace': package_info.get('workspace', ''),
                'build': package_info.get('build', ''),
                'links': package_info.get('links', ''),
                'metadata': package_info.get('metadata', {}),
                'dependencies': self._parse_dependencies(manifest_data.get('dependencies', {})),
                'dev_dependencies': self._parse_dependencies(manifest_data.get('dev-dependencies', {})),
                'build_dependencies': self._parse_dependencies(manifest_data.get('build-dependencies', {})),
                'workspace': self._parse_workspace(manifest_data.get('workspace', {})),
                'features': self._parse_features(manifest_data.get('features', {})),
                'target': self._parse_targets(manifest_data.get('target', {})),
                'patch': self._parse_patches(manifest_data.get('patch', {})),
                'replace': self._parse_replacements(manifest_data.get('replace', {})),
                'profile': self._parse_profiles(manifest_data.get('profile', {}))
            }
            
            logger.info(f"Successfully parsed Cargo.toml: {project_info['name']} v{project_info['version']}")
            return project_info
            
        except toml.TomlDecodeError as e:
            logger.error(f"Failed to parse Cargo.toml: {e}")
            raise ValueError(f"Invalid Cargo.toml file: {e}")
        except Exception as e:
            logger.error(f"Error parsing Cargo manifest: {e}")
            raise
    
    def _parse_dependencies(self, deps_section: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse dependencies section."""
        dependencies = []
        
        for name, spec in deps_section.items():
            if isinstance(spec, str):
                # Simple version string
                dependency = {
                    'name': name,
                    'version': spec,
                    'source': 'crates-io',
                    'optional': False,
                    'default_features': True,
                    'features': []
                }
            elif isinstance(spec, dict):
                # Detailed dependency specification
                dependency = {
                    'name': name,
                    'version': spec.get('version', '*'),
                    'source': spec.get('source', 'crates-io'),
                    'optional': spec.get('optional', False),
                    'default_features': spec.get('default-features', True),
                    'features': spec.get('features', []),
                    'path': spec.get('path'),
                    'git': spec.get('git'),
                    'branch': spec.get('branch'),
                    'tag': spec.get('tag'),
                    'rev': spec.get('rev'),
                    'registry': spec.get('registry'),
                    'package': spec.get('package')
                }
            else:
                continue
            
            dependencies.append(dependency)
        
        return dependencies
    
    def _parse_workspace(self, workspace_section: Dict[str, Any]) -> Dict[str, Any]:
        """Parse workspace section."""
        return {
            'members': workspace_section.get('members', []),
            'exclude': workspace_section.get('exclude', []),
            'default_members': workspace_section.get('default-members', []),
            'resolver': workspace_section.get('resolver', '1'),
            'metadata': workspace_section.get('metadata', {})
        }
    
    def _parse_features(self, features_section: Dict[str, Any]) -> Dict[str, List[str]]:
        """Parse features section."""
        return dict(features_section)
    
    def _parse_targets(self, targets_section: Dict[str, Any]) -> Dict[str, Any]:
        """Parse target-specific configurations."""
        targets = {}
        
        for target_name, target_config in targets_section.items():
            if target_name.startswith('cfg('):
                # Configuration-specific target
                targets[target_name] = {
                    'dependencies': self._parse_dependencies(target_config.get('dependencies', {})),
                    'dev_dependencies': self._parse_dependencies(target_config.get('dev-dependencies', {})),
                    'build_dependencies': self._parse_dependencies(target_config.get('build-dependencies', {}))
                }
            else:
                # Platform-specific target
                targets[target_name] = {
                    'dependencies': self._parse_dependencies(target_config.get('dependencies', {})),
                    'dev_dependencies': self._parse_dependencies(target_config.get('dev-dependencies', {})),
                    'build_dependencies': self._parse_dependencies(target_config.get('build-dependencies', {}))
                }
        
        return targets
    
    def _parse_patches(self, patches_section: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        """Parse patch section for dependency overrides."""
        patches = {}
        
        for source, patches_list in patches_section.items():
            patches[source] = []
            for patch in patches_list:
                patches[source].append({
                    'name': patch.get('name'),
                    'version': patch.get('version'),
                    'path': patch.get('path'),
                    'git': patch.get('git'),
                    'branch': patch.get('branch'),
                    'tag': patch.get('tag'),
                    'rev': patch.get('rev')
                })
        
        return patches
    
    def _parse_replacements(self, replace_section: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse replace section for dependency replacements."""
        replacements = []
        
        for name, replacement in replace_section.items():
            replacements.append({
                'name': name,
                'version': replacement.get('version'),
                'path': replacement.get('path'),
                'git': replacement.get('git'),
                'branch': replacement.get('branch'),
                'tag': replacement.get('tag'),
                'rev': replacement.get('rev')
            })
        
        return replacements
    
    def _parse_profiles(self, profiles_section: Dict[str, Any]) -> Dict[str, Any]:
        """Parse profile section for build configurations."""
        return dict(profiles_section)
    
    def parse_lockfile(self, lockfile_path: Path) -> Dict[str, Any]:
        """Parse Cargo.lock file."""
        try:
            with open(lockfile_path, 'r', encoding='utf-8') as f:
                lockfile_data = toml.load(f)
            
            # Extract package information from lockfile
            packages = []
            for package in lockfile_data.get('package', []):
                package_info = {
                    'name': package.get('name', ''),
                    'version': package.get('version', ''),
                    'source': package.get('source', ''),
                    'checksum': package.get('checksum', ''),
                    'dependencies': package.get('dependencies', []),
                    'replace': package.get('replace', [])
                }
                packages.append(package_info)
            
            lockfile_info = {
                'version': lockfile_data.get('version', '3'),
                'packages': packages,
                'metadata': lockfile_data.get('metadata', {})
            }
            
            logger.info(f"Successfully parsed Cargo.lock with {len(packages)} packages")
            return lockfile_info
            
        except toml.TomlDecodeError as e:
            logger.error(f"Failed to parse Cargo.lock: {e}")
            raise ValueError(f"Invalid Cargo.lock file: {e}")
        except Exception as e:
            logger.error(f"Error parsing Cargo lockfile: {e}")
            raise
    
    def extract_dependencies(self, manifest_data: Dict[str, Any]) -> List[DependencyInfo]:
        """Extract dependency information from parsed Cargo manifest."""
        dependencies = []
        
        # Process regular dependencies
        for dep in manifest_data.get('dependencies', []):
            dependency = DependencyInfo(
                name=dep['name'],
                version=dep['version'],
                ecosystem=self.ecosystem_type.value,
                scope='compile',
                optional=dep.get('optional', False),
                metadata={
                    'source': dep.get('source', 'crates-io'),
                    'default_features': dep.get('default_features', True),
                    'features': dep.get('features', []),
                    'path': dep.get('path'),
                    'git': dep.get('git'),
                    'branch': dep.get('branch'),
                    'tag': dep.get('tag'),
                    'rev': dep.get('rev'),
                    'registry': dep.get('registry'),
                    'package': dep.get('package')
                }
            )
            dependencies.append(dependency)
        
        # Process dev dependencies
        for dep in manifest_data.get('dev_dependencies', []):
            dependency = DependencyInfo(
                name=dep['name'],
                version=dep['version'],
                ecosystem=self.ecosystem_type.value,
                scope='dev',
                optional=dep.get('optional', False),
                metadata={
                    'source': dep.get('source', 'crates-io'),
                    'default_features': dep.get('default_features', True),
                    'features': dep.get('features', []),
                    'path': dep.get('path'),
                    'git': dep.get('git'),
                    'branch': dep.get('branch'),
                    'tag': dep.get('tag'),
                    'rev': dep.get('rev'),
                    'registry': dep.get('registry'),
                    'package': dep.get('package')
                }
            )
            dependencies.append(dependency)
        
        # Process build dependencies
        for dep in manifest_data.get('build_dependencies', []):
            dependency = DependencyInfo(
                name=dep['name'],
                version=dep['version'],
                ecosystem=self.ecosystem_type.value,
                scope='build',
                optional=dep.get('optional', False),
                metadata={
                    'source': dep.get('source', 'crates-io'),
                    'default_features': dep.get('default_features', True),
                    'features': dep.get('features', []),
                    'path': dep.get('path'),
                    'git': dep.get('git'),
                    'branch': dep.get('branch'),
                    'tag': dep.get('tag'),
                    'rev': dep.get('rev'),
                    'registry': dep.get('registry'),
                    'package': dep.get('package')
                }
            )
            dependencies.append(dependency)
        
        return dependencies
    
    def resolve_dependencies(self, dependencies: List[DependencyInfo]) -> List[DependencyInfo]:
        """Resolve Cargo dependencies with transitive dependencies."""
        resolved = []
        
        for dep in dependencies:
            # Add the direct dependency
            resolved.append(dep)
            
            # In a real implementation, we would:
            # 1. Use Cargo's dependency resolution
            # 2. Parse Cargo.lock if available
            # 3. Handle feature resolution
            # 4. Resolve version conflicts
            
            # For demonstration, add some common transitive dependencies
            if 'serde' in dep.name:
                # Add common serde transitive dependencies
                transitive_deps = [
                    'serde_derive',
                    'serde_json',
                    'serde_yaml'
                ]
                
                for trans_dep in transitive_deps:
                    transitive = DependencyInfo(
                        name=trans_dep,
                        version='1.0.0',  # Example version
                        ecosystem=self.ecosystem_type.value,
                        scope=dep.scope,
                        optional=False,
                        metadata={'transitive': True, 'parent': dep.name}
                    )
                    resolved.append(transitive)
        
        return resolved
    
    def get_package_info(self, package_name: str, version: str) -> Optional[Package]:
        """Get package information from crates.io."""
        try:
            # In a real implementation, we would:
            # 1. Query crates.io API
            # 2. Fetch package metadata
            # 3. Parse license information
            # 4. Get security advisories
            
            # For demonstration, return mock data
            return Package(
                name=package_name,
                version=version,
                ecosystem=self.ecosystem_type,
                description=f"Rust crate {package_name}",
                license="MIT OR Apache-2.0",  # Common Rust license
                homepage=f"https://crates.io/crates/{package_name}",
                repository_url=f"https://github.com/{package_name}",
                metadata={
                    'crates_io_url': f"https://crates.io/crates/{package_name}",
                    'documentation_url': f"https://docs.rs/{package_name}",
                    'downloads': 1000,  # Mock download count
                    'recent_downloads': 100  # Mock recent downloads
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to get package info for {package_name}:{version}: {e}")
            return None
    
    def generate_lockfile(self, resolved_dependencies: List[DependencyInfo]) -> str:
        """Generate Cargo.lock content."""
        lockfile_content = []
        lockfile_content.append("# This file is automatically generated by Universal Dependency Platform")
        lockfile_content.append("version = 3")
        lockfile_content.append("")
        lockfile_content.append("[[package]]")
        lockfile_content.append('name = "root"')
        lockfile_content.append('version = "0.1.0"')
        lockfile_content.append("")
        
        for dep in resolved_dependencies:
            lockfile_content.append("[[package]]")
            lockfile_content.append(f'name = "{dep.name}"')
            lockfile_content.append(f'version = "{dep.version}"')
            lockfile_content.append(f'source = "registry+https://github.com/rust-lang/crates.io-index"')
            lockfile_content.append("")
        
        return "\n".join(lockfile_content)
    
    def validate_manifest(self, manifest_path: Path) -> List[str]:
        """Validate Cargo.toml file."""
        errors = []
        
        try:
            manifest_data = self.parse_manifest(manifest_path)
            
            # Check required fields
            if not manifest_data.get('name'):
                errors.append("Missing required field: name")
            if not manifest_data.get('version'):
                errors.append("Missing required field: version")
            
            # Validate dependencies
            for dep in manifest_data.get('dependencies', []):
                if not dep.get('name'):
                    errors.append("Dependency missing name")
                if not dep.get('version'):
                    errors.append(f"Dependency {dep.get('name', 'unknown')} missing version")
            
            # Check for common issues
            if manifest_data.get('version') and '0.0.0' in manifest_data['version']:
                errors.append("Warning: Using placeholder version 0.0.0")
            
            # Validate workspace members
            workspace = manifest_data.get('workspace', {})
            for member in workspace.get('members', []):
                member_path = manifest_path.parent / member / "Cargo.toml"
                if not member_path.exists():
                    errors.append(f"Workspace member {member} not found")
            
        except Exception as e:
            errors.append(f"Failed to parse Cargo.toml: {e}")
        
        return errors
    
    def get_workspace_members(self, manifest_path: Path) -> List[Path]:
        """Get list of workspace member paths."""
        try:
            manifest_data = self.parse_manifest(manifest_path)
            workspace = manifest_data.get('workspace', {})
            members = workspace.get('members', [])
            
            member_paths = []
            for member in members:
                member_path = manifest_path.parent / member
                if member_path.exists():
                    member_paths.append(member_path)
            
            return member_paths
            
        except Exception as e:
            logger.error(f"Failed to get workspace members: {e}")
            return []
