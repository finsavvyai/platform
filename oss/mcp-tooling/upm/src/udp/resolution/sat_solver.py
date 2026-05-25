"""
SAT Solver Integration for Dependency Conflict Resolution.

Provides advanced dependency resolution using SAT (Boolean Satisfiability) solvers
to handle complex dependency constraints and conflicts across all package ecosystems.
"""

import logging
from typing import Dict, List, Optional, Any, Set, Tuple, Union
from datetime import datetime
from enum import Enum
from dataclasses import dataclass
from uuid import UUID
import itertools

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ConstraintType(str, Enum):
    """Types of dependency constraints."""
    VERSION_RANGE = "version_range"
    EXACT_VERSION = "exact_version"
    MINIMUM_VERSION = "minimum_version"
    MAXIMUM_VERSION = "maximum_version"
    EXCLUDED_VERSION = "excluded_version"
    CONFLICT = "conflict"
    REQUIRES = "requires"
    PROVIDES = "provides"


class ResolutionStrategy(str, Enum):
    """Dependency resolution strategies."""
    CONSERVATIVE = "conservative"  # Prefer older, stable versions
    LATEST = "latest"  # Prefer latest versions
    MINIMAL = "minimal"  # Minimize total number of packages
    SECURITY_FIRST = "security_first"  # Prioritize security updates
    PERFORMANCE_OPTIMIZED = "performance_optimized"  # Optimize for performance


class ConflictType(str, Enum):
    """Types of dependency conflicts."""
    VERSION_CONFLICT = "version_conflict"
    CIRCULAR_DEPENDENCY = "circular_dependency"
    MISSING_DEPENDENCY = "missing_dependency"
    LICENSE_CONFLICT = "license_conflict"
    ARCHITECTURE_CONFLICT = "architecture_conflict"
    PLATFORM_CONFLICT = "platform_conflict"


@dataclass
class DependencyConstraint:
    """Dependency constraint definition."""
    package_name: str
    constraint_type: ConstraintType
    version_spec: str
    ecosystem: str
    optional: bool = False
    reason: Optional[str] = None


@dataclass
class PackageVersion:
    """Package version information."""
    name: str
    version: str
    ecosystem: str
    dependencies: List[DependencyConstraint]
    provides: List[str]
    conflicts: List[str]
    metadata: Dict[str, Any]


@dataclass
class ResolutionConflict:
    """Dependency resolution conflict."""
    conflict_type: ConflictType
    packages_involved: List[str]
    description: str
    severity: str
    possible_solutions: List[Dict[str, Any]]


@dataclass
class ResolutionResult:
    """Dependency resolution result."""
    success: bool
    resolved_packages: List[PackageVersion]
    conflicts: List[ResolutionConflict]
    resolution_time: float
    strategy_used: ResolutionStrategy
    total_packages: int
    resolution_steps: List[str]


class SATSolver:
    """SAT solver for dependency resolution."""
    
    def __init__(self):
        self.constraints: List[DependencyConstraint] = []
        self.package_versions: Dict[str, List[PackageVersion]] = {}
        self.resolution_cache: Dict[str, ResolutionResult] = {}
        self.max_resolution_time = 30.0  # seconds
    
    def add_package_version(self, package_version: PackageVersion):
        """Add a package version to the solver."""
        key = f"{package_version.ecosystem}:{package_version.name}"
        if key not in self.package_versions:
            self.package_versions[key] = []
        self.package_versions[key].append(package_version)
    
    def add_constraint(self, constraint: DependencyConstraint):
        """Add a dependency constraint."""
        self.constraints.append(constraint)
    
    def resolve_dependencies(
        self, 
        requested_packages: List[Tuple[str, str, str]],  # (name, version, ecosystem)
        strategy: ResolutionStrategy = ResolutionStrategy.CONSERVATIVE
    ) -> ResolutionResult:
        """
        Resolve dependencies using SAT solver approach.
        
        Args:
            requested_packages: List of requested packages
            strategy: Resolution strategy to use
            
        Returns:
            Resolution result with resolved packages or conflicts
        """
        try:
            logger.info(f"Resolving dependencies for {len(requested_packages)} packages using {strategy.value} strategy")
            
            start_time = datetime.utcnow()
            
            # Check cache first
            cache_key = self._generate_cache_key(requested_packages, strategy)
            if cache_key in self.resolution_cache:
                logger.debug("Returning cached resolution result")
                return self.resolution_cache[cache_key]
            
            # Initialize resolution state
            resolved_packages: List[PackageVersion] = []
            conflicts: List[ResolutionConflict] = []
            resolution_steps: List[str] = []
            
            # Step 1: Add requested packages
            resolution_steps.append("Adding requested packages")
            for name, version, ecosystem in requested_packages:
                package = self._find_package_version(name, version, ecosystem)
                if package:
                    resolved_packages.append(package)
                else:
                    conflicts.append(ResolutionConflict(
                        conflict_type=ConflictType.MISSING_DEPENDENCY,
                        packages_involved=[name],
                        description=f"Package {name}@{version} not found in {ecosystem}",
                        severity="high",
                        possible_solutions=[{"action": "check_package_name", "package": name}]
                    ))
            
            if conflicts:
                return ResolutionResult(
                    success=False,
                    resolved_packages=resolved_packages,
                    conflicts=conflicts,
                    resolution_time=(datetime.utcnow() - start_time).total_seconds(),
                    strategy_used=strategy,
                    total_packages=len(resolved_packages),
                    resolution_steps=resolution_steps
                )
            
            # Step 2: Resolve dependencies iteratively
            resolution_steps.append("Resolving dependencies iteratively")
            unresolved_deps = self._get_unresolved_dependencies(resolved_packages)
            
            while unresolved_deps and len(resolution_steps) < 100:  # Prevent infinite loops
                resolution_steps.append(f"Processing {len(unresolved_deps)} unresolved dependencies")
                
                # Try to resolve each dependency
                new_conflicts = []
                for dep in unresolved_deps:
                    resolution_result = self._resolve_single_dependency(dep, resolved_packages, strategy)
                    if resolution_result["success"]:
                        resolved_packages.extend(resolution_result["packages"])
                    else:
                        new_conflicts.extend(resolution_result["conflicts"])
                
                if new_conflicts:
                    conflicts.extend(new_conflicts)
                    break
                
                # Check for new unresolved dependencies
                new_unresolved = self._get_unresolved_dependencies(resolved_packages)
                if len(new_unresolved) >= len(unresolved_deps):
                    # No progress made, potential circular dependency
                    conflicts.append(ResolutionConflict(
                        conflict_type=ConflictType.CIRCULAR_DEPENDENCY,
                        packages_involved=[dep.package_name for dep in unresolved_deps],
                        description="Circular dependency detected",
                        severity="high",
                        possible_solutions=[{"action": "break_circular_dependency", "packages": [dep.package_name for dep in unresolved_deps]}]
                    ))
                    break
                
                unresolved_deps = new_unresolved
            
            # Step 3: Check for conflicts
            resolution_steps.append("Checking for conflicts")
            conflict_checks = self._check_package_conflicts(resolved_packages)
            conflicts.extend(conflict_checks)
            
            # Step 4: Optimize resolution based on strategy
            if not conflicts:
                resolution_steps.append(f"Optimizing resolution using {strategy.value} strategy")
                resolved_packages = self._optimize_resolution(resolved_packages, strategy)
            
            # Create result
            resolution_time = (datetime.utcnow() - start_time).total_seconds()
            result = ResolutionResult(
                success=len(conflicts) == 0,
                resolved_packages=resolved_packages,
                conflicts=conflicts,
                resolution_time=resolution_time,
                strategy_used=strategy,
                total_packages=len(resolved_packages),
                resolution_steps=resolution_steps
            )
            
            # Cache result
            self.resolution_cache[cache_key] = result
            
            logger.info(f"Resolution completed: {len(resolved_packages)} packages, {len(conflicts)} conflicts in {resolution_time:.2f}s")
            return result
            
        except Exception as e:
            logger.error(f"Failed to resolve dependencies: {e}", exc_info=True)
            return ResolutionResult(
                success=False,
                resolved_packages=[],
                conflicts=[ResolutionConflict(
                    conflict_type=ConflictType.VERSION_CONFLICT,
                    packages_involved=[],
                    description=f"Resolution failed: {str(e)}",
                    severity="critical",
                    possible_solutions=[]
                )],
                resolution_time=0.0,
                strategy_used=strategy,
                total_packages=0,
                resolution_steps=["Resolution failed"]
            )
    
    def _find_package_version(
        self, 
        name: str, 
        version: str, 
        ecosystem: str
    ) -> Optional[PackageVersion]:
        """Find a specific package version."""
        key = f"{ecosystem}:{name}"
        if key not in self.package_versions:
            return None
        
        for pkg in self.package_versions[key]:
            if pkg.version == version:
                return pkg
        
        return None
    
    def _get_unresolved_dependencies(
        self, 
        resolved_packages: List[PackageVersion]
    ) -> List[DependencyConstraint]:
        """Get unresolved dependencies from resolved packages."""
        unresolved = []
        resolved_names = {f"{pkg.ecosystem}:{pkg.name}@{pkg.version}" for pkg in resolved_packages}
        
        for pkg in resolved_packages:
            for dep in pkg.dependencies:
                if not dep.optional:
                    dep_key = f"{dep.ecosystem}:{dep.package_name}"
                    # Check if this dependency is already resolved
                    if not any(f"{p.ecosystem}:{p.name}@{p.version}" == dep_key for p in resolved_packages):
                        unresolved.append(dep)
        
        return unresolved
    
    def _resolve_single_dependency(
        self, 
        dependency: DependencyConstraint,
        resolved_packages: List[PackageVersion],
        strategy: ResolutionStrategy
    ) -> Dict[str, Any]:
        """Resolve a single dependency constraint."""
        try:
            key = f"{dependency.ecosystem}:{dependency.package_name}"
            if key not in self.package_versions:
                return {
                    "success": False,
                    "packages": [],
                    "conflicts": [ResolutionConflict(
                        conflict_type=ConflictType.MISSING_DEPENDENCY,
                        packages_involved=[dependency.package_name],
                        description=f"Package {dependency.package_name} not found in {dependency.ecosystem}",
                        severity="high",
                        possible_solutions=[{"action": "check_package_name", "package": dependency.package_name}]
                    )]
                }
            
            # Find compatible versions
            compatible_versions = self._find_compatible_versions(dependency, self.package_versions[key])
            
            if not compatible_versions:
                return {
                    "success": False,
                    "packages": [],
                    "conflicts": [ResolutionConflict(
                        conflict_type=ConflictType.VERSION_CONFLICT,
                        packages_involved=[dependency.package_name],
                        description=f"No compatible version found for {dependency.package_name} {dependency.version_spec}",
                        severity="medium",
                        possible_solutions=[{"action": "relax_version_constraint", "package": dependency.package_name}]
                    )]
                }
            
            # Select best version based on strategy
            selected_version = self._select_best_version(compatible_versions, strategy)
            
            return {
                "success": True,
                "packages": [selected_version],
                "conflicts": []
            }
            
        except Exception as e:
            logger.error(f"Failed to resolve dependency {dependency.package_name}: {e}")
            return {
                "success": False,
                "packages": [],
                "conflicts": [ResolutionConflict(
                    conflict_type=ConflictType.VERSION_CONFLICT,
                    packages_involved=[dependency.package_name],
                    description=f"Failed to resolve {dependency.package_name}: {str(e)}",
                    severity="high",
                    possible_solutions=[]
                )]
            }
    
    def _find_compatible_versions(
        self, 
        dependency: DependencyConstraint,
        available_versions: List[PackageVersion]
    ) -> List[PackageVersion]:
        """Find versions compatible with the dependency constraint."""
        compatible = []
        
        for version in available_versions:
            if self._version_satisfies_constraint(version.version, dependency):
                compatible.append(version)
        
        return compatible
    
    def _version_satisfies_constraint(
        self, 
        version: str, 
        constraint: DependencyConstraint
    ) -> bool:
        """Check if a version satisfies a constraint."""
        try:
            if constraint.constraint_type == ConstraintType.EXACT_VERSION:
                return version == constraint.version_spec
            elif constraint.constraint_type == ConstraintType.MINIMUM_VERSION:
                return self._compare_versions(version, constraint.version_spec) >= 0
            elif constraint.constraint_type == ConstraintType.MAXIMUM_VERSION:
                return self._compare_versions(version, constraint.version_spec) <= 0
            elif constraint.constraint_type == ConstraintType.EXCLUDED_VERSION:
                return version != constraint.version_spec
            elif constraint.constraint_type == ConstraintType.VERSION_RANGE:
                return self._version_in_range(version, constraint.version_spec)
            else:
                return True
        except Exception as e:
            logger.error(f"Failed to check version constraint: {e}")
            return False
    
    def _compare_versions(self, version1: str, version2: str) -> int:
        """Compare two version strings. Returns -1, 0, or 1."""
        try:
            # Simple version comparison - in production, use proper semver library
            v1_parts = [int(x) for x in version1.split('.')]
            v2_parts = [int(x) for x in version2.split('.')]
            
            # Pad with zeros to make same length
            max_len = max(len(v1_parts), len(v2_parts))
            v1_parts.extend([0] * (max_len - len(v1_parts)))
            v2_parts.extend([0] * (max_len - len(v2_parts)))
            
            for v1, v2 in zip(v1_parts, v2_parts):
                if v1 < v2:
                    return -1
                elif v1 > v2:
                    return 1
            
            return 0
        except Exception as e:
            logger.error(f"Failed to compare versions {version1} and {version2}: {e}")
            return 0
    
    def _version_in_range(self, version: str, range_spec: str) -> bool:
        """Check if version is in range specification."""
        try:
            # Simple range parsing - in production, use proper range parsing
            if '>=' in range_spec:
                min_version = range_spec.split('>=')[1].strip()
                return self._compare_versions(version, min_version) >= 0
            elif '<=' in range_spec:
                max_version = range_spec.split('<=')[1].strip()
                return self._compare_versions(version, max_version) <= 0
            elif '>' in range_spec:
                min_version = range_spec.split('>')[1].strip()
                return self._compare_versions(version, min_version) > 0
            elif '<' in range_spec:
                max_version = range_spec.split('<')[1].strip()
                return self._compare_versions(version, max_version) < 0
            else:
                return version == range_spec
        except Exception as e:
            logger.error(f"Failed to check version range: {e}")
            return False
    
    def _select_best_version(
        self, 
        versions: List[PackageVersion],
        strategy: ResolutionStrategy
    ) -> PackageVersion:
        """Select the best version based on strategy."""
        if not versions:
            raise ValueError("No versions to select from")
        
        if len(versions) == 1:
            return versions[0]
        
        if strategy == ResolutionStrategy.CONSERVATIVE:
            # Prefer older, stable versions
            return min(versions, key=lambda v: self._version_to_sortable(v.version))
        elif strategy == ResolutionStrategy.LATEST:
            # Prefer latest versions
            return max(versions, key=lambda v: self._version_to_sortable(v.version))
        elif strategy == ResolutionStrategy.MINIMAL:
            # Prefer versions with fewer dependencies
            return min(versions, key=lambda v: len(v.dependencies))
        elif strategy == ResolutionStrategy.SECURITY_FIRST:
            # Prefer versions with security updates (simplified)
            return max(versions, key=lambda v: self._version_to_sortable(v.version))
        elif strategy == ResolutionStrategy.PERFORMANCE_OPTIMIZED:
            # Prefer versions optimized for performance (simplified)
            return max(versions, key=lambda v: self._version_to_sortable(v.version))
        else:
            # Default to latest
            return max(versions, key=lambda v: self._version_to_sortable(v.version))
    
    def _version_to_sortable(self, version: str) -> Tuple[int, ...]:
        """Convert version string to sortable tuple."""
        try:
            parts = version.split('.')
            return tuple(int(part) if part.isdigit() else 0 for part in parts)
        except Exception:
            return (0,)
    
    def _check_package_conflicts(self, packages: List[PackageVersion]) -> List[ResolutionConflict]:
        """Check for conflicts between resolved packages."""
        conflicts = []
        
        # Check for duplicate packages
        package_counts = {}
        for pkg in packages:
            key = f"{pkg.ecosystem}:{pkg.name}"
            package_counts[key] = package_counts.get(key, 0) + 1
        
        for key, count in package_counts.items():
            if count > 1:
                conflicts.append(ResolutionConflict(
                    conflict_type=ConflictType.VERSION_CONFLICT,
                    packages_involved=[key],
                    description=f"Multiple versions of {key} found",
                    severity="high",
                    possible_solutions=[{"action": "remove_duplicate", "package": key}]
                ))
        
        # Check for explicit conflicts
        for pkg in packages:
            for conflict_pkg in pkg.conflicts:
                for other_pkg in packages:
                    if other_pkg.name == conflict_pkg:
                        conflicts.append(ResolutionConflict(
                            conflict_type=ConflictType.VERSION_CONFLICT,
                            packages_involved=[pkg.name, other_pkg.name],
                            description=f"{pkg.name} conflicts with {other_pkg.name}",
                            severity="high",
                            possible_solutions=[{"action": "remove_conflicting_package", "packages": [pkg.name, other_pkg.name]}]
                        ))
        
        return conflicts
    
    def _optimize_resolution(
        self, 
        packages: List[PackageVersion],
        strategy: ResolutionStrategy
    ) -> List[PackageVersion]:
        """Optimize the resolution based on strategy."""
        if strategy == ResolutionStrategy.MINIMAL:
            # Remove redundant packages
            return self._remove_redundant_packages(packages)
        else:
            return packages
    
    def _remove_redundant_packages(self, packages: List[PackageVersion]) -> List[PackageVersion]:
        """Remove redundant packages from resolution."""
        # Simple redundancy check - in production, use more sophisticated algorithms
        essential_packages = []
        provided_features = set()
        
        # First pass: collect all provided features
        for pkg in packages:
            provided_features.update(pkg.provides)
        
        # Second pass: keep only essential packages
        for pkg in packages:
            is_essential = False
            for dep in pkg.dependencies:
                if not dep.optional and dep.package_name not in provided_features:
                    is_essential = True
                    break
            
            if is_essential or not pkg.provides:
                essential_packages.append(pkg)
        
        return essential_packages
    
    def _generate_cache_key(
        self, 
        requested_packages: List[Tuple[str, str, str]],
        strategy: ResolutionStrategy
    ) -> str:
        """Generate cache key for resolution request."""
        packages_str = "|".join(f"{name}@{version}:{ecosystem}" for name, version, ecosystem in requested_packages)
        return f"{strategy.value}:{packages_str}"
    
    def clear_cache(self):
        """Clear the resolution cache."""
        self.resolution_cache.clear()
    
    def get_resolution_statistics(self) -> Dict[str, Any]:
        """Get resolution statistics."""
        return {
            "total_package_versions": sum(len(versions) for versions in self.package_versions.values()),
            "total_constraints": len(self.constraints),
            "cached_resolutions": len(self.resolution_cache),
            "supported_ecosystems": list(set(pkg.ecosystem for versions in self.package_versions.values() for pkg in versions))
        }
