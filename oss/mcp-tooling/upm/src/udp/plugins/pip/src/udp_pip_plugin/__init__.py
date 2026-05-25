"""
UDP Pip Plugin - Universal Dependency Platform integration for Python projects

This plugin provides cross-language dependency management capabilities for Python projects,
allowing seamless integration with dependencies from other ecosystems like Java, JavaScript,
Rust, and more.

Features:
- Cross-language dependency resolution via udp.yml
- Bridge code generation for multi-ecosystem integration
- Integration with pip and setuptools
- Build lifecycle integration
- Security scanning and license compliance
"""

__version__ = "1.0.0"
__author__ = "UDP Team"
__email__ = "team@universaldependency.com"

from .bridges import BridgeManager
from .config import UdpConfig
from .manager import UdpManager

__all__ = ["UdpManager", "UdpConfig", "BridgeManager"]
