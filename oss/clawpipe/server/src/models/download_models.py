#!/usr/bin/env python3
"""
Model Download Manager for FinSavvyAI — re-export hub.

Backward-compatible module that re-exports all public symbols from
the decomposed sub-modules:
  - model_catalog: GGUF and HF model registries
  - model_operations: ModelDownloadManager class
  - model_cli: CLI entry point
"""

from src.models.model_catalog import get_available_models, get_gguf_models
from src.models.model_cli import main
from src.models.model_operations import ModelDownloadManager

__all__ = [
    "ModelDownloadManager",
    "get_gguf_models",
    "get_available_models",
    "main",
]

if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
