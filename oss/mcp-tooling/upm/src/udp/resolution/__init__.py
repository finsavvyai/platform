"""
Dependency Resolution Module.

Provides advanced dependency resolution capabilities including SAT solver integration,
conflict resolution, and optimization strategies for complex dependency graphs.
"""

from .sat_solver import (
    SATSolver,
    DependencyConstraint,
    PackageVersion,
    ResolutionResult,
    ResolutionConflict,
    ResolutionStrategy,
    ConstraintType,
    ConflictType
)

__all__ = [
    "SATSolver",
    "DependencyConstraint",
    "PackageVersion", 
    "ResolutionResult",
    "ResolutionConflict",
    "ResolutionStrategy",
    "ConstraintType",
    "ConflictType"
]
