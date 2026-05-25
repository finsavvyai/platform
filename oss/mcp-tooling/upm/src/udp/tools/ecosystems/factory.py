"""
Ecosystem adapter factory and registry.

Provides factory methods for creating ecosystem adapters and
manages the registry of available adapters.
"""

from typing import Dict, List, Optional, Type, Tuple
from uuid import UUID

from udp.domain.models import EcosystemType
from udp.tools.ecosystems.base import EcosystemAdapter


class EcosystemRegistry:
    """Registry for ecosystem adapters."""
    
    def __init__(self):
        self._adapters: Dict[EcosystemType, Type[EcosystemAdapter]] = {}
        self._file_extensions: Dict[str, EcosystemType] = {}
    
    def register_adapter(
        self, 
        ecosystem_type: EcosystemType, 
        adapter_class: Type[EcosystemAdapter],
        file_extensions: List[str]
    ) -> None:
        """
        Register an ecosystem adapter.
        
        Args:
            ecosystem_type: The ecosystem type
            adapter_class: The adapter class
            file_extensions: Supported file extensions
        """
        self._adapters[ecosystem_type] = adapter_class
        
        # Register file extensions
        for ext in file_extensions:
            if ext in self._file_extensions:
                raise ValueError(f"File extension {ext} already registered for {self._file_extensions[ext]}")
            self._file_extensions[ext] = ecosystem_type
    
    def get_adapter(self, ecosystem_type: EcosystemType, organization_id: UUID) -> EcosystemAdapter:
        """
        Get an ecosystem adapter instance.
        
        Args:
            ecosystem_type: The ecosystem type
            organization_id: Organization ID
            
        Returns:
            Ecosystem adapter instance
            
        Raises:
            ValueError: If adapter not found
        """
        if ecosystem_type not in self._adapters:
            raise ValueError(f"No adapter registered for ecosystem: {ecosystem_type}")
        
        adapter_class = self._adapters[ecosystem_type]
        return adapter_class(organization_id)
    
    def get_ecosystem_for_file(self, file_path: str) -> Optional[EcosystemType]:
        """
        Get ecosystem type for a file path.
        
        Args:
            file_path: Path to the file
            
        Returns:
            Ecosystem type or None if not recognized
        """
        from pathlib import Path
        file_path_obj = Path(file_path)
        filename = file_path_obj.name.lower()
        
        # Check for specific filenames first
        if filename == "cargo.toml" or filename == "cargo.lock":
            return EcosystemType.CARGO
        elif filename == "pom.xml":
            return EcosystemType.MAVEN
        elif filename == "package.json" or filename == "package-lock.json":
            return EcosystemType.NPM
        elif filename in ["requirements.txt", "pipfile", "pipfile.lock", "pyproject.toml"]:
            return EcosystemType.PYPI
        
        # Fall back to extension-based detection
        if '.' not in file_path:
            return None
        
        extension = file_path.split('.')[-1].lower()
        return self._file_extensions.get(extension)
    
    def get_supported_ecosystems(self) -> List[EcosystemType]:
        """Get list of supported ecosystem types."""
        return list(self._adapters.keys())
    
    def get_supported_extensions(self) -> List[str]:
        """Get list of supported file extensions."""
        return list(self._file_extensions.keys())


# Global registry instance
_ecosystem_registry = EcosystemRegistry()


def register_ecosystem_adapter(
    ecosystem_type: EcosystemType,
    file_extensions: List[str]
):
    """
    Decorator to register an ecosystem adapter.
    
    Args:
        ecosystem_type: The ecosystem type
        file_extensions: Supported file extensions
    """
    def decorator(adapter_class: Type[EcosystemAdapter]):
        _ecosystem_registry.register_adapter(ecosystem_type, adapter_class, file_extensions)
        return adapter_class
    return decorator


def get_ecosystem_adapter(ecosystem_type: EcosystemType, organization_id: UUID) -> EcosystemAdapter:
    """
    Get an ecosystem adapter instance.
    
    Args:
        ecosystem_type: The ecosystem type
        organization_id: Organization ID
        
    Returns:
        Ecosystem adapter instance
    """
    return _ecosystem_registry.get_adapter(ecosystem_type, organization_id)


def get_ecosystem_for_file(file_path: str) -> Optional[EcosystemType]:
    """
    Get ecosystem type for a file path.
    
    Args:
        file_path: Path to the file
        
    Returns:
        Ecosystem type or None if not recognized
    """
    return _ecosystem_registry.get_ecosystem_for_file(file_path)


def get_supported_ecosystems() -> List[EcosystemType]:
    """Get list of supported ecosystem types."""
    return _ecosystem_registry.get_supported_ecosystems()


def get_supported_extensions() -> List[str]:
    """Get list of supported file extensions."""
    return _ecosystem_registry.get_supported_extensions()


class EcosystemFactory:
    """Factory for creating ecosystem adapters with Universal Package Manager support."""
    
    @staticmethod
    def create_adapter(ecosystem_type: EcosystemType, organization_id: UUID) -> EcosystemAdapter:
        """
        Create an ecosystem adapter instance.
        
        Args:
            ecosystem_type: The ecosystem type
            organization_id: Organization ID
            
        Returns:
            Ecosystem adapter instance
        """
        return get_ecosystem_adapter(ecosystem_type, organization_id)
    
    @staticmethod
    def create_adapter_for_file(file_path: str, organization_id: UUID) -> Optional[EcosystemAdapter]:
        """
        Create an ecosystem adapter for a specific file.
        
        Args:
            file_path: Path to the file
            organization_id: Organization ID
            
        Returns:
            Ecosystem adapter instance or None if not supported
        """
        ecosystem_type = get_ecosystem_for_file(file_path)
        if ecosystem_type:
            return get_ecosystem_adapter(ecosystem_type, organization_id)
        return None
    
    @staticmethod
    def get_available_adapters() -> List[EcosystemType]:
        """Get list of available ecosystem adapters."""
        return get_supported_ecosystems()
    
    @staticmethod
    def create_universal_adapters(
        ecosystems: List[EcosystemType], 
        organization_id: UUID
    ) -> Dict[EcosystemType, EcosystemAdapter]:
        """
        Create multiple ecosystem adapters for Universal Package Manager operations.
        
        Args:
            ecosystems: List of ecosystem types
            organization_id: Organization ID
            
        Returns:
            Dictionary mapping ecosystem types to adapter instances
        """
        adapters = {}
        for ecosystem in ecosystems:
            try:
                adapters[ecosystem] = get_ecosystem_adapter(ecosystem, organization_id)
            except ValueError as e:
                # Log warning but continue with other ecosystems
                import structlog
                logger = structlog.get_logger()
                logger.warning(
                    "Failed to create adapter for ecosystem",
                    ecosystem=ecosystem.value,
                    error=str(e)
                )
        return adapters
    
    @staticmethod
    def detect_polyglot_project(file_paths: List[str]) -> Dict[EcosystemType, List[str]]:
        """
        Detect ecosystems and group manifest files for a polyglot project.
        
        Args:
            file_paths: List of manifest file paths
            
        Returns:
            Dictionary mapping ecosystem types to their manifest files
        """
        ecosystem_files = {}
        
        for file_path in file_paths:
            ecosystem = get_ecosystem_for_file(file_path)
            if ecosystem:
                if ecosystem not in ecosystem_files:
                    ecosystem_files[ecosystem] = []
                ecosystem_files[ecosystem].append(file_path)
        
        return ecosystem_files
    
    @staticmethod
    def get_ecosystem_compatibility_matrix() -> Dict[Tuple[EcosystemType, EcosystemType], float]:
        """
        Get compatibility matrix for all supported ecosystems.
        
        Returns:
            Dictionary mapping ecosystem pairs to compatibility scores
        """
        from udp.workflows.state import UniversalPackageManager
        
        ecosystems = get_supported_ecosystems()
        compatibility_matrix = {}
        upm = UniversalPackageManager()
        
        for eco1 in ecosystems:
            for eco2 in ecosystems:
                compatibility = upm.calculate_ecosystem_compatibility(eco1, eco2)
                compatibility_matrix[(eco1, eco2)] = compatibility
        
        return compatibility_matrix

