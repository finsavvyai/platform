"""
Local Embedding Providers

Sentence Transformers and ONNX implementations.
"""

import asyncio
import logging

import numpy as np

from .models import EmbeddingModel, EmbeddingError
from .providers_base import EmbeddingProviderABC

try:
    import onnxruntime as ort
    from sentence_transformers import SentenceTransformer
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

logger = logging.getLogger(__name__)


class SentenceTransformersProvider(EmbeddingProviderABC):
    """Sentence Transformers embedding provider."""

    def __init__(self, config):
        super().__init__(config)
        self.model = None
        self.model_name = config.get(
            "model_name", EmbeddingModel.SENTENCE_MINILM_L6_V2.value
        )
        self.device = config.get("device", "cpu")

    async def initialize(self):
        if not TRANSFORMERS_AVAILABLE:
            raise EmbeddingError(
                "Transformers not installed", self.provider_name
            )
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: setattr(
                self, "model",
                SentenceTransformer(self.model_name, device=self.device),
            ),
        )

    async def generate_embeddings(self, texts, model, **kw):
        if not self.model:
            await self.initialize()
        loop = asyncio.get_event_loop()
        embs = await loop.run_in_executor(
            None,
            lambda: self.model.encode(
                texts,
                batch_size=kw.get("batch_size", 32),
                show_progress_bar=False,
                convert_to_numpy=True,
            ),
        )
        lists = [e.tolist() for e in embs]
        tokens = sum(len(t) for t in texts) // 4
        return lists, {
            "prompt_tokens": tokens,
            "total_tokens": tokens,
            "model": model,
            "local_processing": True,
        }

    async def health_check(self):
        try:
            if not self.model:
                await self.initialize()
            await self.generate_embeddings(["health check"], self.model_name)
            return True
        except Exception:
            return False

    def get_model_info(self, model):
        return {
            EmbeddingModel.SENTENCE_MINILM_L6_V2.value: {
                "dimensions": 384, "max_tokens": 512, "cost_per_1k_tokens": 0.0,
            },
            EmbeddingModel.SENTENCE_MPNET_BASE_V2.value: {
                "dimensions": 768, "max_tokens": 512, "cost_per_1k_tokens": 0.0,
            },
        }.get(model, {})

    @property
    def supported_models(self):
        return [
            EmbeddingModel.SENTENCE_MINILM_L6_V2.value,
            EmbeddingModel.SENTENCE_MPNET_BASE_V2.value,
            EmbeddingModel.SENTENCE_BERT_BASE_NLI_MEAN_TOKENS.value,
        ]


class ONNXEmbeddingProvider(EmbeddingProviderABC):
    """ONNX-optimized embedding provider."""

    def __init__(self, config):
        super().__init__(config)
        self.session = None
        self.tokenizer = None
        self.model_path = config.get("model_path")

    async def initialize(self):
        if not TRANSFORMERS_AVAILABLE:
            raise EmbeddingError(
                "Transformers not installed", self.provider_name
            )

        def load():
            self.session = ort.InferenceSession(
                self.model_path, providers=["CPUExecutionProvider"]
            )
            from transformers import AutoTokenizer
            name = self.model_path.split("/")[-1].replace("-onnx", "")
            self.tokenizer = AutoTokenizer.from_pretrained(name)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, load)

    async def generate_embeddings(self, texts, model, **kw):
        if not self.session:
            await self.initialize()

        def encode():
            inputs = self.tokenizer(
                texts, padding=True, truncation=True,
                max_length=512, return_tensors="np",
            )
            outputs = self.session.run(None, {
                "input_ids": inputs["input_ids"],
                "attention_mask": inputs["attention_mask"],
            })
            embs = outputs[0]
            mask = np.expand_dims(inputs["attention_mask"], axis=-1)
            return (
                np.sum(embs * mask, axis=1)
                / np.maximum(np.sum(mask, axis=1), 1e-9)
            ).tolist()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, encode)
        tokens = sum(len(t) for t in texts) // 4
        return result, {
            "total_tokens": tokens, "model": model, "onnx_optimized": True,
        }

    async def health_check(self):
        try:
            if not self.session:
                await self.initialize()
            await self.generate_embeddings(["health check"], "onnx_model")
            return True
        except Exception:
            return False

    def get_model_info(self, model):
        return {
            EmbeddingModel.ONNX_MINILM_L6_V2.value: {
                "dimensions": 384, "max_tokens": 512, "cost_per_1k_tokens": 0.0,
            },
            EmbeddingModel.ONNX_MPNET_BASE_V2.value: {
                "dimensions": 768, "max_tokens": 512, "cost_per_1k_tokens": 0.0,
            },
        }.get(model, {})

    @property
    def supported_models(self):
        return [
            EmbeddingModel.ONNX_MINILM_L6_V2.value,
            EmbeddingModel.ONNX_MPNET_BASE_V2.value,
        ]
