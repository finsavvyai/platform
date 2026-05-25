"""Repository layer for data access abstractions."""

from .dependencies import DependencyRepository
from .organizations import OrganizationRepository

__all__ = ["DependencyRepository", "OrganizationRepository"]
