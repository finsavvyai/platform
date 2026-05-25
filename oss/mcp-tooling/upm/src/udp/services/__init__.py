"""
UPM service layer.

Provides all business logic services including project management,
dependency analysis, security scanning, workflow orchestration, and more.
"""

from .base import BaseAsyncService, BaseService, ServiceRegistry

__all__ = [
    # Base service classes
    "BaseService",
    "BaseAsyncService",
    "ServiceRegistry",
]


def __getattr__(name):
    """Lazy-load services to avoid circular import cascades."""
    _lazy_imports = {
        "UserService": (".user", "UserService"),
        "OrganizationService": (".organization", "OrganizationService"),
        "ProjectService": (".project", "ProjectService"),
        "DependencyService": (".dependency", "DependencyService"),
        "SecurityService": (".security", "SecurityService"),
        "WorkflowService": (".workflow", "WorkflowService"),
        "SBOMService": (".sbom_service", "SBOMService"),
        "SBOMFormat": (".sbom_service", "SBOMFormat"),
        "SBOMDiffResult": (".sbom_service", "SBOMDiffResult"),
    }
    if name in _lazy_imports:
        module_path, attr = _lazy_imports[name]
        import importlib

        mod = importlib.import_module(module_path, __package__)
        val = getattr(mod, attr)
        globals()[name] = val
        return val
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
