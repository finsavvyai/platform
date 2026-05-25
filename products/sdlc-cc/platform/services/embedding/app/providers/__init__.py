"""
Embedding providers package.

This package contains implementations for various embedding providers
including OpenAI, Cohere, and local models, with a unified interface.
"""

from .base import BaseEmbeddingProvider, ProviderConfig, ProviderCapabilities
from .openai_provider import OpenAIProvider
from .cohere_provider import CohereProvider
from .local_provider import LocalProvider
from .factory import ProviderFactory
from .manager import ProviderManager

__all__ = [
    "BaseEmbeddingProvider",
    "ProviderConfig",
    "ProviderCapabilities",
    "OpenAIProvider",
    "CohereProvider",
    "LocalProvider",
    "ProviderFactory",
    "ProviderManager",
]
