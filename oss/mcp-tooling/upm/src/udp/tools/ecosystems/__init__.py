"""
Package ecosystem adapters.

This module provides adapters for different package ecosystems (npm, pip, maven, etc.)
using the Strategy pattern for parsing manifests, resolving dependencies, and
integrating with ecosystem registries.
"""

from udp.tools.ecosystems.base import (
    DependencyInfo,
    EcosystemAdapter,
    ParsedManifest,
    ParseError,
    RegistryError,
    ResolutionError,
    ResolutionResult,
)
from udp.tools.ecosystems.factory import (
    EcosystemFactory,
    get_ecosystem_adapter,
    get_ecosystem_for_file,
    get_supported_ecosystems,
    get_supported_extensions,
    register_ecosystem_adapter,
)

# Import adapters to register them
from udp.tools.ecosystems import npm, pip, maven, cargo

__all__ = [
    # Base classes
    "DependencyInfo",
    "EcosystemAdapter", 
    "ParsedManifest",
    "ParseError",
    "RegistryError",
    "ResolutionError",
    "ResolutionResult",
    
    # Factory functions
    "EcosystemFactory",
    "get_ecosystem_adapter",
    "get_ecosystem_for_file", 
    "get_supported_ecosystems",
    "get_supported_extensions",
    "register_ecosystem_adapter",
]
