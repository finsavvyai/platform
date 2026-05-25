"""
Provider factory for creating and managing embedding providers.

This module provides a factory pattern for creating embedding providers
with proper configuration and management.
"""

import uuid
from typing import Any, Dict, List, Optional, Type

from .base import BaseEmbeddingProvider, ProviderConfig
from .cohere_provider import CohereProvider
from .local_provider import LocalProvider
from .openai_provider import OpenAIProvider


class ProviderFactory:
    """Factory for creating embedding providers."""

    # Registry of available providers
    _providers: Dict[str, Type[BaseEmbeddingProvider]] = {
        "openai": OpenAIProvider,
        "cohere": CohereProvider,
        "local": LocalProvider,
    }

    @classmethod
    def register_provider(
        cls, name: str, provider_class: Type[BaseEmbeddingProvider]
    ) -> None:
        """
        Register a new provider class.

        Args:
            name: Provider name
            provider_class: Provider class
        """
        cls._providers[name.lower()] = provider_class

    @classmethod
    def create_provider(cls, config: ProviderConfig) -> BaseEmbeddingProvider:
        """
        Create a provider instance from configuration.

        Args:
            config: Provider configuration

        Returns:
            Provider instance

        Raises:
            ValueError: If provider type is not supported
        """
        provider_type = config.provider_type.lower()

        if provider_type not in cls._providers:
            raise ValueError(
                f"Unsupported provider type: {provider_type}. "
                f"Supported types: {list(cls._providers.keys())}"
            )

        provider_class = cls._providers[provider_type]
        return provider_class(config)

    @classmethod
    def create_openai_provider(
        cls,
        api_key: str,
        organization_id: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        **kwargs,
    ) -> OpenAIProvider:
        """
        Create OpenAI provider with common parameters.

        Args:
            api_key: OpenAI API key
            organization_id: OpenAI organization ID
            base_url: Custom base URL
            model: Default model
            **kwargs: Additional configuration

        Returns:
            OpenAI provider instance
        """
        config = ProviderConfig(
            name="openai",
            provider_type="openai",
            api_key=api_key,
            organization_id=organization_id,
            base_url=base_url,
            model=model,
            extra_config=kwargs,
        )

        return cls.create_provider(config)

    @classmethod
    def create_cohere_provider(
        cls,
        api_key: str,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        **kwargs,
    ) -> CohereProvider:
        """
        Create Cohere provider with common parameters.

        Args:
            api_key: Cohere API key
            base_url: Custom base URL
            model: Default model
            **kwargs: Additional configuration

        Returns:
            Cohere provider instance
        """
        config = ProviderConfig(
            name="cohere",
            provider_type="cohere",
            api_key=api_key,
            base_url=base_url,
            model=model,
            extra_config=kwargs,
        )

        return cls.create_provider(config)

    @classmethod
    def create_local_provider(
        cls,
        models_directory: str = "/app/models",
        device: str = "cpu",
        use_onnx: bool = False,
        model: Optional[str] = None,
        **kwargs,
    ) -> LocalProvider:
        """
        Create local provider with common parameters.

        Args:
            models_directory: Directory to cache models
            device: Device to run models on
            use_onnx: Whether to use ONNX runtime
            model: Default model
            **kwargs: Additional configuration

        Returns:
            Local provider instance
        """
        extra_config = {
            "models_directory": models_directory,
            "device": device,
            "use_onnx": use_onnx,
            **kwargs,
        }

        config = ProviderConfig(
            name="local",
            provider_type="local",
            model=model,
            extra_config=extra_config,
        )

        return cls.create_provider(config)

    @classmethod
    def list_available_providers(cls) -> List[str]:
        """
        Get list of available provider types.

        Returns:
            List of provider names
        """
        return list(cls._providers.keys())

    @classmethod
    def get_provider_info(cls, provider_type: str) -> Dict[str, Any]:
        """
        Get information about a provider type.

        Args:
            provider_type: Provider type

        Returns:
            Provider information
        """
        provider_type = provider_type.lower()

        if provider_type not in cls._providers:
            raise ValueError(f"Unknown provider type: {provider_type}")

        provider_class = cls._providers[provider_type]

        # Create a temporary config to get capabilities
        temp_config = ProviderConfig(
            name="temp",
            provider_type=provider_type,
        )

        temp_provider = provider_class(temp_config)

        return {
            "name": provider_type,
            "class_name": provider_class.__name__,
            "capabilities": temp_provider.capabilities,
            "description": provider_class.__doc__,
        }

    @classmethod
    def validate_config(cls, config: ProviderConfig) -> Dict[str, Any]:
        """
        Validate provider configuration.

        Args:
            config: Provider configuration

        Returns:
            Validation result
        """
        try:
            provider_type = config.provider_type.lower()

            if provider_type not in cls._providers:
                return {
                    "valid": False,
                    "errors": [f"Unsupported provider type: {provider_type}"],
                }

            # Create provider to validate configuration
            provider = cls.create_provider(config)

            # Basic validation based on provider type
            errors = []

            if provider_type == "openai":
                if not config.api_key:
                    errors.append("OpenAI API key is required")
            elif provider_type == "cohere":
                if not config.api_key:
                    errors.append("Cohere API key is required")
            elif provider_type == "local":
                # Local providers don't require API keys
                pass

            return {
                "valid": len(errors) == 0,
                "errors": errors,
                "provider_type": provider_type,
                "capabilities": provider.capabilities,
            }

        except Exception as e:
            return {
                "valid": False,
                "errors": [f"Configuration validation failed: {e}"],
            }

    @classmethod
    def create_provider_from_dict(
        cls, config_dict: Dict[str, Any]
    ) -> BaseEmbeddingProvider:
        """
        Create provider from dictionary configuration.

        Args:
            config_dict: Configuration dictionary

        Returns:
            Provider instance
        """
        # Extract required fields
        name = config_dict.get("name", str(uuid.uuid4()))
        provider_type = config_dict.get("provider_type")

        if not provider_type:
            raise ValueError("provider_type is required in configuration")

        # Create ProviderConfig
        config = ProviderConfig(
            name=name,
            provider_type=provider_type,
            api_key=config_dict.get("api_key"),
            base_url=config_dict.get("base_url"),
            api_version=config_dict.get("api_version", "v1"),
            timeout=config_dict.get("timeout", 60),
            max_retries=config_dict.get("max_retries", 3),
            retry_delay=config_dict.get("retry_delay", 1.0),
            model=config_dict.get("model"),
            organization_id=config_dict.get("organization_id"),
            extra_config=config_dict.get("extra_config", {}),
        )

        return cls.create_provider(config)

    @classmethod
    def get_default_configs(cls) -> Dict[str, Dict[str, Any]]:
        """
        Get default configurations for all providers.

        Returns:
            Dictionary of default configurations
        """
        return {
            "openai": {
                "name": "openai",
                "provider_type": "openai",
                "api_version": "v1",
                "timeout": 60,
                "max_retries": 3,
                "retry_delay": 1.0,
                "model": "text-embedding-3-small",
            },
            "cohere": {
                "name": "cohere",
                "provider_type": "cohere",
                "api_version": "v1",
                "timeout": 60,
                "max_retries": 3,
                "retry_delay": 1.0,
                "model": "embed-english-v3.0",
            },
            "local": {
                "name": "local",
                "provider_type": "local",
                "timeout": 300,
                "max_retries": 1,
                "retry_delay": 1.0,
                "model": "all-MiniLM-L6-v2",
                "extra_config": {
                    "models_directory": "/app/models",
                    "device": "cpu",
                    "use_onnx": False,
                    "cache_size": 3,
                },
            },
        }
