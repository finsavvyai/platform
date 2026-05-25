"""
Embedding Service

Main service class with multi-provider support, caching, and fallback.
"""

import logging
import time
from typing import Any, Dict, List
from uuid import uuid4
from ...core.config import get_settings
from ...models.document import DocumentStatus
from .models import (
    EmbeddingProvider, EmbeddingModel, EmbeddingRequest,
    EmbeddingResponse, EmbeddingMetrics, EmbeddingError, ValidationError,
)
from .providers import (
    OpenAIEmbeddingProvider, CohereEmbeddingProvider,
    SentenceTransformersProvider, ONNXEmbeddingProvider,
)
from .cache import EmbeddingCache

logger = logging.getLogger(__name__)

_PROVIDER_CLASSES = {
    EmbeddingProvider.OPENAI: OpenAIEmbeddingProvider,
    EmbeddingProvider.COHERE: CohereEmbeddingProvider,
    EmbeddingProvider.SENTENCE_TRANSFORMERS: SentenceTransformersProvider,
    EmbeddingProvider.ONNX: ONNXEmbeddingProvider,
}
_COST_PER_1K = {
    EmbeddingProvider.OPENAI: 0.0004,
    EmbeddingProvider.COHERE: 0.0001,
}


class EmbeddingService:
    """Comprehensive embedding service."""

    def __init__(self, config: Dict[str, Any] = None):
        self.settings = get_settings()
        self.config = config or {}
        self.providers: Dict[EmbeddingProvider, Any] = {}
        self._provider_cfgs = self._load_cfgs()
        cc = self.config.get("cache", {})
        cc.setdefault("redis_url", self.settings.redis_url)
        self.cache = EmbeddingCache(cc)
        self.metrics: List[EmbeddingMetrics] = []
        self.provider_priority = self.config.get("provider_priority", [
            EmbeddingProvider.SENTENCE_TRANSFORMERS,
            EmbeddingProvider.ONNX,
            EmbeddingProvider.OPENAI,
            EmbeddingProvider.COHERE,
        ])
        self.batch_size = self.config.get("batch_size", 100)

    def _load_cfgs(self):
        s = self.settings
        return {
            EmbeddingProvider.OPENAI: {"name": "openai", "api_key": s.openai_api_key, "organization": s.openai_organization},
            EmbeddingProvider.COHERE: {"name": "cohere", "api_key": self.config.get("cohere_api_key")},
            EmbeddingProvider.SENTENCE_TRANSFORMERS: {"name": "sentence_transformers", "model_name": s.sentence_transformer_model, "device": s.sentence_transformer_device},
            EmbeddingProvider.ONNX: {"name": "onnx", "model_path": self.config.get("onnx_model_path")},
        }

    async def initialize(self):
        await self.cache.initialize()
        for name, cfg in self._provider_cfgs.items():
            cls = _PROVIDER_CLASSES.get(name)
            if not cls:
                continue
            try:
                p = cls(cfg)
                await p.initialize()
                self.providers[name] = p
            except Exception as e:
                logger.warning(f"Failed to init {name}: {e}")
        logger.info(f"Embedding service: {len(self.providers)} providers")

    async def generate_embeddings(self, request: EmbeddingRequest) -> EmbeddingResponse:
        start = time.time()
        self._validate(request)
        cached, uncached_texts, uncached_idx = [], [], []
        for i, text in enumerate(request.texts):
            c = await self.cache.get(text, request.provider.value, request.model.value, request.tenant_id)
            (cached if c else uncached_texts).append((i, c) if c else None)
            if not c:
                uncached_texts.append(text)
                uncached_idx.append(i)
            else:
                cached.append((i, c))
        # fix: rebuild uncached_texts
        uncached_texts = [request.texts[i] for i in uncached_idx]

        new_embs, usage, errors = [], {"total_tokens": 0, "model": request.model.value}, 0
        if uncached_texts:
            new_embs, usage, errors = await self._gen_with_fallback(uncached_texts, request, usage)

        all_embs = [None] * len(request.texts)
        for idx, emb in cached:
            all_embs[idx] = emb
        for idx, emb in zip(uncached_idx, new_embs):
            all_embs[idx] = emb
        if any(e is None for e in all_embs):
            raise EmbeddingError("Failed to generate all embeddings")

        ms = int((time.time() - start) * 1000)
        cost = (usage.get("total_tokens", 0) / 1000) * _COST_PER_1K.get(request.provider, 0)
        resp = EmbeddingResponse(
            embeddings=all_embs, model=request.model.value, provider=request.provider.value,
            dimensions=len(all_embs[0]) if all_embs else 0, usage=usage,
            processing_time_ms=ms, cached_count=len(cached), error_count=errors,
            metadata={"cost_estimate_usd": cost, "tenant_id": str(request.tenant_id)},
        )
        self._log(request, resp)
        return resp

    async def _gen_with_fallback(self, texts, request, usage):
        errors = 0
        try:
            embs, pu = await self._gen(texts, request.provider, request.model)
            usage.update(pu)
            for t, e in zip(texts, embs):
                await self.cache.set(t, request.provider.value, request.model.value, request.tenant_id, e)
            return embs, usage, 0
        except Exception:
            errors = len(texts)
            for fb in self.provider_priority:
                if fb != request.provider and fb in self.providers:
                    try:
                        embs, pu = await self._gen(texts, fb, request.model)
                        usage.update(pu)
                        return embs, usage, errors
                    except Exception:
                        continue
            raise EmbeddingError("All providers failed")

    async def _gen(self, texts, provider, model):
        if provider not in self.providers:
            raise EmbeddingError(f"Provider {provider} not available")
        p = self.providers[provider]
        if len(texts) <= self.batch_size:
            return await p.generate_embeddings(texts, model.value)
        all_e, tu = [], {"total_tokens": 0, "model": model.value}
        for i in range(0, len(texts), self.batch_size):
            e, u = await p.generate_embeddings(texts[i:i + self.batch_size], model.value)
            all_e.extend(e)
            tu["total_tokens"] += u.get("total_tokens", 0)
        return all_e, tu

    def _validate(self, request):
        if not request.texts:
            raise ValidationError("No texts provided")
        if request.provider not in self.providers:
            raise ValidationError(f"Provider {request.provider} not available")

    def _log(self, request, response):
        m = EmbeddingMetrics(
            request_id=str(uuid4()), provider=response.provider, model=response.model,
            texts_count=len(request.texts), tokens_used=response.total_tokens,
            processing_time_ms=response.processing_time_ms,
            cache_hit_rate=response.cached_count / max(len(request.texts), 1),
            cost_usd=response.cost_estimate_usd,
            error_rate=response.error_count / max(len(request.texts), 1),
        )
        self.metrics.append(m)
        if len(self.metrics) > 1000:
            self.metrics = self.metrics[-1000:]

    async def process_document_chunks(self, chunks, provider=None, model=None, tenant_id=None):
        if not chunks:
            return []
        provider = provider or EmbeddingProvider.SENTENCE_TRANSFORMERS
        model = model or EmbeddingModel.SENTENCE_MINILM_L6_V2
        tid = tenant_id or chunks[0].tenant_id
        req = EmbeddingRequest(texts=[c.content for c in chunks], provider=provider, model=model, tenant_id=tid, batch_id=uuid4())
        resp = await self.generate_embeddings(req)
        for i, c in enumerate(chunks):
            if i < len(resp.embeddings):
                c.embedding = resp.embeddings[i]
                c.embedding_model = resp.model
                c.embedding_dimensions = resp.dimensions
                c.embedding_status = DocumentStatus.COMPLETED
            else:
                c.embedding_status = DocumentStatus.FAILED
        return chunks

    async def get_provider_status(self):
        status = {}
        for name, p in self.providers.items():
            try:
                status[name.value] = {"healthy": await p.health_check(), "supported_models": p.supported_models}
            except Exception as e:
                status[name.value] = {"healthy": False, "error": str(e)}
        status["cache"] = await self.cache.get_stats()
        return status

    def get_supported_providers(self):
        return [{"name": p.value, "available": p in self.providers} for p in EmbeddingProvider]
