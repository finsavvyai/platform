"""Provider registry - routes model names to the correct LLM provider."""

import re
from typing import Dict, List, Optional, Tuple

from src.providers.base import BaseProvider, ModelInfo

# Model name patterns mapped to provider names
MODEL_PATTERNS: List[Tuple[str, str]] = [
    # OpenAI models
    (r"^gpt-", "openai"),
    (r"^o[134]-", "openai"),
    (r"^chatgpt-", "openai"),
    # Anthropic models
    (r"^claude-", "anthropic"),
    # OpenHands models (explicit namespace)
    (r"^openhands([:/_-].*|$)", "openhands"),
    # LM Studio models (explicit namespace)
    (r"^lmstudio([:/_-].*|$)", "lmstudio"),
    # Ollama / local models (catch-all for known open models)
    (r"^llama", "ollama"),
    (r"^mistral", "ollama"),
    (r"^mixtral", "ollama"),
    (r"^phi", "ollama"),
    (r"^gemma", "ollama"),
    (r"^qwen", "ollama"),
    (r"^codellama", "ollama"),
    (r"^deepseek", "ollama"),
    (r"^vicuna", "ollama"),
    (r"^command-r", "ollama"),
    (r"^starcoder", "ollama"),
]


class ProviderRegistry:
    """Manages registered LLM providers and routes models to them."""

    def __init__(self):
        self._providers: Dict[str, BaseProvider] = {}

    def register(self, name: str, provider: BaseProvider):
        self._providers[name] = provider

    def unregister(self, name: str):
        self._providers.pop(name, None)

    def get_provider(self, name: str) -> Optional[BaseProvider]:
        return self._providers.get(name)

    @property
    def providers(self) -> Dict[str, BaseProvider]:
        return dict(self._providers)

    def resolve_provider(self, model: str) -> Optional[BaseProvider]:
        """Find the right provider for a model name."""
        for pattern, provider_name in MODEL_PATTERNS:
            if re.match(pattern, model, re.IGNORECASE):
                provider = self._providers.get(provider_name)
                if provider:
                    return provider
        # Fallback: check if any provider claims this model via explicit mapping
        # If only one provider is registered, use it
        if len(self._providers) == 1:
            return next(iter(self._providers.values()))
        return None

    def resolve_provider_chain(self, model: str) -> List[BaseProvider]:
        """Return ordered list of providers to try for a model.

        First match from MODEL_PATTERNS, then any other registered
        providers as fallbacks.
        """
        primary = self.resolve_provider(model)
        if not primary:
            return []
        chain = [primary]
        for _name, provider in self._providers.items():
            if provider is not primary:
                chain.append(provider)
        return chain

    async def list_all_models(self) -> List[ModelInfo]:
        """Aggregate models from all registered providers."""
        all_models = []
        for provider in self._providers.values():
            try:
                models = await provider.list_models()
                all_models.extend(models)
            except Exception:
                pass
        return all_models

    async def health_check_all(self) -> Dict[str, bool]:
        """Check health of all registered providers."""
        results = {}
        for name, provider in self._providers.items():
            try:
                results[name] = await provider.health_check()
            except Exception:
                results[name] = False
        return results


# Singleton registry
_registry = ProviderRegistry()


def get_registry() -> ProviderRegistry:
    return _registry
