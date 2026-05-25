"""Bridge code generation templates for cross-language interoperability."""

from .base import (
    BridgeConfig,
    BridgeTemplate,
    BridgeType,
    InterfaceDefinition,
    Language,
    MethodSignature,
    Parameter,
)
from .generator import (
    BridgeGenerator,
    create_config,
    create_interface,
    generate_bridge_from_config,
)
from .py4j_template import Py4JTemplate
from .rest_template import RestApiTemplate

__all__ = [
    "BridgeTemplate",
    "BridgeConfig",
    "BridgeType",
    "InterfaceDefinition",
    "Language",
    "MethodSignature",
    "Parameter",
    "Py4JTemplate",
    "RestApiTemplate",
    "BridgeGenerator",
    "generate_bridge_from_config",
    "create_config",
    "create_interface",
]
