#!/usr/bin/env python3
"""
Model download, delete, and query operations for FinSavvyAI.

Contains the ModelDownloadManager class which handles downloading,
listing, and managing LLM models from Hugging Face.

Extracted from download_models.py.
"""

import json
import logging
import os
import time
from pathlib import Path
from typing import Dict, List, Optional

import requests

from src.models.model_catalog import get_available_models, get_gguf_models
from src.models.model_downloads import (
    download_model_git as _download_model_git,
    download_model_hf as _download_model_hf,
    download_gguf as _download_gguf,
)

logger = logging.getLogger("finsavvyai.models")


class ModelDownloadManager:
    """Manages downloading and organizing LLM models."""

    def __init__(self, models_dir: Optional[str] = None):
        if models_dir is None:
            self.models_dir = Path.home() / "finsavvyai-models"
        else:
            self.models_dir = Path(models_dir)

        self.models_dir.mkdir(exist_ok=True)
        self.config_file = self.models_dir / "models.json"
        self.load_config()

        self.gguf_models = get_gguf_models()
        self.available_models = get_available_models()

    def load_config(self) -> None:
        """Load models configuration from file."""
        if self.config_file.exists():
            try:
                with open(self.config_file, "r") as f:
                    self.downloaded_models: Dict = json.load(f)
            except Exception:
                self.downloaded_models = {}
        else:
            self.downloaded_models = {}

    def save_config(self) -> None:
        """Save models configuration to file."""
        with open(self.config_file, "w") as f:
            json.dump(self.downloaded_models, f, indent=2)

    def list_available_models(self) -> Dict:
        """List all available models for download."""
        return self.available_models

    def list_downloaded_models(self) -> List[str]:
        """List all downloaded models."""
        return [
            name
            for name in self.downloaded_models
            if (self.models_dir / name).exists()
        ]

    def get_model_size(self, model_name: str) -> int:
        """Get model directory size in bytes."""
        model_path = self.models_dir / model_name
        if not model_path.exists():
            return 0
        return sum(
            fp.stat().st_size for fp in model_path.rglob("*") if fp.is_file()
        )

    def get_disk_space(self) -> Dict:
        """Get available disk space."""
        stat = os.statvfs(self.models_dir)
        total = stat.f_frsize * stat.f_blocks
        free = stat.f_frsize * stat.f_bavail
        return {
            "total": total,
            "free": free,
            "used": total - free,
            "free_gb": free / (1024**3),
        }

    async def check_hf_access(self, model_name: str) -> bool:
        """Check if we can access the Hugging Face model."""
        if model_name not in self.available_models:
            return False
        repo_id = self.available_models[model_name]["repo_id"]
        try:
            response = requests.get(
                f"https://huggingface.co/{repo_id}", timeout=10
            )
            return response.status_code == 200
        except Exception:
            return False

    async def download_model_git(
        self, model_name: str, progress_callback: Optional[object] = None,
    ) -> bool:
        """Download model using git clone (recommended)."""
        return await _download_model_git(self, model_name, progress_callback)

    async def download_model_hf(
        self, model_name: str, progress_callback: Optional[object] = None,
    ) -> bool:
        """Download model using huggingface-hub library."""
        return await _download_model_hf(self, model_name, progress_callback)

    async def download_gguf(
        self, gguf_name: str, progress_callback: Optional[object] = None,
    ) -> Optional[str]:
        """Download a GGUF model file. Returns local path or None."""
        return await _download_gguf(self, gguf_name, progress_callback)

    def list_gguf_models(self) -> Dict:
        """List available GGUF models for download."""
        return self.gguf_models

    def list_local_gguf(self) -> List[Dict]:
        """List GGUF files already downloaded."""
        files = []
        for path in self.models_dir.glob("*.gguf"):
            stat = path.stat()
            files.append({
                "path": str(path),
                "name": path.stem,
                "filename": path.name,
                "size_bytes": stat.st_size,
                "size_gb": round(stat.st_size / (1024**3), 2),
            })
        return sorted(files, key=lambda f: f["name"])

    def delete_model(self, model_name: str) -> bool:
        """Delete a downloaded model."""
        import shutil

        model_path = self.models_dir / model_name
        if not model_path.exists():
            logger.warning("Model %s not found", model_name)
            return False

        try:
            shutil.rmtree(model_path)
            if model_name in self.downloaded_models:
                del self.downloaded_models[model_name]
                self.save_config()
            logger.info("Deleted model %s", model_name)
            return True
        except Exception as e:
            logger.error("Failed to delete %s: %s", model_name, e)
            return False

    def get_model_info(self, model_name: str) -> Optional[Dict]:
        """Get information about a specific model."""
        if model_name in self.available_models:
            info = self.available_models[model_name].copy()
            info["name"] = model_name
            if model_name in self.downloaded_models:
                info["downloaded"] = True
                info["size_bytes"] = self.get_model_size(model_name)
                info["downloaded_at"] = self.downloaded_models[model_name][
                    "downloaded_at"
                ]
            else:
                info["downloaded"] = False
            return info
        return None
