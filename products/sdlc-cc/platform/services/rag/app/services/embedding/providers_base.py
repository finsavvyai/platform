"""
Base Embedding Provider and OpenAI/Cohere implementations.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Tuple

from .models import (
    EmbeddingModel,
    EmbeddingError,
    RateLimitError,
)

try:
    import openai
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import cohere
    COHERE_AVAILABLE = True
except ImportError:
    COHERE_AVAILABLE = False

logger = logging.getLogger(__name__)


class EmbeddingProviderABC(ABC):
    """Abstract base class for embedding providers."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.provider_name = config.get("name", self.__class__.__name__.lower())

    @abstractmethod
    async def initialize(self) -> None: pass

    @abstractmethod
    async def generate_embeddings(
        self, texts: List[str], model: str, **kw
    ) -> Tuple[List[List[float]], Dict[str, Any]]: pass

    @abstractmethod
    async def health_check(self) -> bool: pass

    @abstractmethod
    def get_model_info(self, model: str) -> Dict[str, Any]: pass

    @property
    @abstractmethod
    def supported_models(self) -> List[str]: pass


class OpenAIEmbeddingProvider(EmbeddingProviderABC):
    """OpenAI embedding provider."""

    def __init__(self, config):
        super().__init__(config)
        self.client = None
        self.api_key = config.get("api_key")
        self.organization = config.get("organization")

    async def initialize(self):
        if not OPENAI_AVAILABLE:
            raise EmbeddingError("OpenAI not installed", self.provider_name)
        if not self.api_key:
            raise EmbeddingError("OpenAI API key not provided", self.provider_name)
        self.client = AsyncOpenAI(
            api_key=self.api_key, organization=self.organization
        )

    async def generate_embeddings(self, texts, model, **kw):
        if not self.client:
            await self.initialize()
        try:
            resp = await self.client.embeddings.create(
                model=model, input=texts, **kw
            )
            embs = [d.embedding for d in resp.data]
            usage = {
                "prompt_tokens": resp.usage.prompt_tokens,
                "total_tokens": resp.usage.total_tokens,
                "model": model,
            }
            return embs, usage
        except openai.RateLimitError as e:
            raise RateLimitError(str(e), self.provider_name, model)
        except Exception as e:
            raise EmbeddingError(str(e), self.provider_name, model)

    async def health_check(self):
        try:
            if not self.client:
                await self.initialize()
            await self.client.embeddings.create(
                model=EmbeddingModel.OPENAI_ADA_002.value,
                input=["health check"],
            )
            return True
        except Exception:
            return False

    def get_model_info(self, model):
        configs = {
            EmbeddingModel.OPENAI_ADA_002.value: {
                "dimensions": 1536, "max_tokens": 8191, "cost_per_1k_tokens": 0.0004,
            },
            EmbeddingModel.OPENAI_SMALL_3.value: {
                "dimensions": 1536, "max_tokens": 8191, "cost_per_1k_tokens": 0.00002,
            },
            EmbeddingModel.OPENAI_LARGE_3.value: {
                "dimensions": 3072, "max_tokens": 8191, "cost_per_1k_tokens": 0.00013,
            },
        }
        return configs.get(model, {})

    @property
    def supported_models(self):
        return [
            EmbeddingModel.OPENAI_ADA_002.value,
            EmbeddingModel.OPENAI_SMALL_3.value,
            EmbeddingModel.OPENAI_LARGE_3.value,
        ]


class CohereEmbeddingProvider(EmbeddingProviderABC):
    """Cohere embedding provider."""

    def __init__(self, config):
        super().__init__(config)
        self.client = None
        self.api_key = config.get("api_key")

    async def initialize(self):
        if not COHERE_AVAILABLE:
            raise EmbeddingError("Cohere not installed", self.provider_name)
        if not self.api_key:
            raise EmbeddingError("Cohere API key not provided", self.provider_name)
        self.client = cohere.AsyncClient(api_key=self.api_key)

    async def generate_embeddings(self, texts, model, **kw):
        if not self.client:
            await self.initialize()
        try:
            resp = await self.client.embed(texts=texts, model=model, **kw)
            usage = {
                "prompt_tokens": resp.meta.billed_units.input_tokens,
                "total_tokens": resp.meta.billed_units.input_tokens,
                "model": model,
            }
            return resp.embeddings, usage
        except Exception as e:
            raise EmbeddingError(str(e), self.provider_name, model)

    async def health_check(self):
        try:
            if not self.client:
                await self.initialize()
            await self.client.embed(
                texts=["health check"],
                model=EmbeddingModel.COHERE_EMBED_EN_V3.value,
            )
            return True
        except Exception:
            return False

    def get_model_info(self, model):
        return {
            EmbeddingModel.COHERE_EMBED_EN_V3.value: {
                "dimensions": 1024, "max_tokens": 512, "cost_per_1k_tokens": 0.0001,
            },
        }.get(model, {})

    @property
    def supported_models(self):
        return [
            EmbeddingModel.COHERE_EMBED_EN_V3.value,
            EmbeddingModel.COHERE_EMBED_MULTILANG_V3.value,
        ]
