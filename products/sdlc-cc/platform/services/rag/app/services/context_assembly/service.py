"""Context Assembly Service — orchestrates the assembly pipeline."""

import logging
from copy import copy
from datetime import datetime
from typing import Dict, Any

import tiktoken
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer

from app.core.config import get_settings
from app.context_packer import PackingConfig, pack_and_compress

from .models import (
    AssemblyRequest, AssemblyResult, AssemblyStrategy,
    CompressionLevel, RedundancyStrategy,
)
from .preprocessing import preprocess_chunks
from .redundancy import apply_redundancy_removal
from .compression import apply_compression
from .sorting import sort_chunks_by_strategy
from .assembly import assemble_context_window, generate_citations
from .metrics import (
    calculate_quality_metrics, analyze_coverage, calculate_compression_stats,
)
from .fallback import fallback_assembly

logger = logging.getLogger(__name__)
settings = get_settings()


class ContextAssemblyService:
    """Advanced context assembly service"""

    def __init__(self):
        self._tokenizers: Dict[str, Any] = {}
        self._initialize_tokenizers()
        self._sentence_model = None
        self._tfidf_vectorizer = None
        self._initialize_models()
        self._assembly_cache: Dict[int, Dict[str, Any]] = {}
        self._packing_config = PackingConfig(
            enabled=settings.context_packing_enabled,
            max_tokens=settings.context_packing_max_tokens,
            similarity_threshold=settings.context_packing_similarity_threshold,
        )
        logger.info("Context Assembly Service initialized")

    def _initialize_tokenizers(self) -> None:
        try:
            enc = tiktoken.get_encoding("cl100k_base")
            for name in ["gpt-3.5-turbo", "gpt-4", "claude", "default"]:
                self._tokenizers[name] = enc
            logger.info("Tokenizers initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize tokenizers: {e}")

    def _initialize_models(self) -> None:
        try:
            self._sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
            self._tfidf_vectorizer = TfidfVectorizer(
                max_features=1000, stop_words="english",
                ngram_range=(1, 2), min_df=1,
            )
            logger.info("Models initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize models: {e}")

    def _count_tokens(self, text: str, context_window_type: str) -> int:
        if not text:
            return 0
        try:
            tok = self._tokenizers.get(
                context_window_type, self._tokenizers["default"]
            )
            return len(tok.encode(text))
        except Exception:
            return len(text) // 4

    async def assemble_context(
        self, request: AssemblyRequest
    ) -> AssemblyResult:
        start_time = datetime.now()
        try:
            processed = await preprocess_chunks(
                request.chunks, request, self._count_tokens
            )
            deduped = await apply_redundancy_removal(
                processed, request, self._sentence_model
            )
            compressed = await apply_compression(
                deduped, request, self._count_tokens
            )
            compressed = self._apply_context_packing(
                compressed, request
            )
            sorted_chunks = sort_chunks_by_strategy(compressed, request)
            assembled_ctx, ctx_chunks = await assemble_context_window(
                sorted_chunks, request, self._count_tokens
            )
            citations = []
            if request.include_citations:
                citations = generate_citations(ctx_chunks, request)
            ms = (datetime.now() - start_time).total_seconds() * 1000
            quality = calculate_quality_metrics(ctx_chunks, request)
            coverage = analyze_coverage(ctx_chunks, request)
            comp_stats = calculate_compression_stats(
                processed, ctx_chunks, request
            )
            result = AssemblyResult(
                assembled_context=assembled_ctx,
                context_chunks=ctx_chunks,
                total_tokens=self._count_tokens(
                    assembled_ctx, request.context_window_type
                ),
                assembly_strategy=request.assembly_strategy,
                compression_level=request.compression_level,
                assembly_time_ms=ms,
                compression_time_ms=0.0,
                redundancy_removal_time_ms=0.0,
                quality_metrics=quality,
                citations=citations,
                truncated_chunks=[
                    c.original_chunk.id
                    for c in ctx_chunks if c.truncation_applied
                ],
                compression_stats=comp_stats,
                coverage_analysis=coverage,
                assembly_metadata={
                    "total_chunks_processed": len(request.chunks),
                    "chunks_included": len(ctx_chunks),
                    "chunks_removed": len(request.chunks) - len(ctx_chunks),
                    "avg_chunk_importance": float(
                        np.mean([c.importance_score for c in ctx_chunks])
                    ) if ctx_chunks else 0.0,
                },
            )
            self._cache_result(request, result)
            logger.info(
                f"Context assembled: {len(ctx_chunks)} chunks, "
                f"{result.total_tokens} tokens"
            )
            return result
        except Exception as e:
            logger.error(f"Context assembly failed: {e}")
            return await fallback_assembly(request, self._count_tokens)

    def _apply_context_packing(self, chunks: list, request: AssemblyRequest) -> list:
        """Apply context packing to compress chunk content."""
        if not self._packing_config.enabled:
            return chunks
        texts = [c.processed_content for c in chunks]
        cfg = PackingConfig(
            enabled=True, max_tokens=request.max_tokens,
            similarity_threshold=self._packing_config.similarity_threshold,
        )
        def token_fn(t):
            return self._count_tokens(t, request.context_window_type)
        packed_texts = pack_and_compress(texts, config=cfg, token_fn=token_fn)
        result = []
        for i, chunk in enumerate(chunks):
            if i < len(packed_texts):
                new_chunk = copy(chunk)
                new_chunk.processed_content = packed_texts[i]
                new_chunk.token_count = self._count_tokens(
                    packed_texts[i], request.context_window_type
                )
                result.append(new_chunk)
        return result if result else chunks

    def _cache_result(self, request, result):
        ids = [c.id for c in request.chunks]
        key = hash((
            tuple(sorted(ids)), request.assembly_strategy,
            request.compression_level, request.max_tokens,
            request.redundancy_strategy,
        ))
        self._assembly_cache[key] = {
            "result": result, "timestamp": datetime.now(),
        }
        if len(self._assembly_cache) > 500:
            oldest = min(
                self._assembly_cache,
                key=lambda k: self._assembly_cache[k]["timestamp"],
            )
            del self._assembly_cache[oldest]

    def get_service_metrics(self) -> Dict[str, Any]:
        return {
            "assembly_cache_size": len(self._assembly_cache),
            "tokenizers_loaded": list(self._tokenizers.keys()),
            "sentence_model_loaded": self._sentence_model is not None,
            "strategies": [s.value for s in AssemblyStrategy],
            "compression_levels": [l.value for l in CompressionLevel],
            "redundancy_strategies": [s.value for s in RedundancyStrategy],
        }
