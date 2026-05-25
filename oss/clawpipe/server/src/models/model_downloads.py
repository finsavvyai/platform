"""Download methods for LLM models (git, huggingface-hub, GGUF)."""

import logging
import os
import subprocess
import time
from pathlib import Path
from typing import Dict, Optional

import requests

logger = logging.getLogger("finsavvyai.models")


async def download_model_git(
    manager: "ModelDownloadManager",
    model_name: str,
    progress_callback: Optional[object] = None,
) -> bool:
    """Download model using git clone (recommended)."""
    if model_name not in manager.available_models:
        logger.warning("Unknown model: %s", model_name)
        return False

    model_info = manager.available_models[model_name]
    repo_id = model_info["repo_id"]
    model_path = manager.models_dir / model_name

    if model_path.exists():
        logger.info("Model %s already exists", model_name)
        return True

    logger.info("Downloading %s from %s", model_name, repo_id)

    try:
        cmd = ["git", "clone", f"https://huggingface.co/{repo_id}", str(model_path)]

        if model_info.get("requires_auth"):
            hf_token = os.getenv("HF_TOKEN")
            if hf_token:
                cmd = [
                    "git", "clone",
                    f"https://user:{hf_token}@huggingface.co/{repo_id}",
                    str(model_path),
                ]

        process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, universal_newlines=True,
        )

        while True:
            output = process.stdout.readline()
            if output == "" and process.poll() is not None:
                break
            if output and progress_callback:
                progress_callback(output.strip())

        if process.returncode == 0:
            logger.info("Successfully downloaded %s", model_name)
            manager.downloaded_models[model_name] = {
                "repo_id": repo_id,
                "downloaded_at": time.time(),
                "size": manager.get_model_size(model_name),
                "path": str(model_path),
            }
            manager.save_config()
            return True

        logger.error("Failed to download %s", model_name)
        return False

    except Exception as e:
        logger.error("Download error for %s: %s", model_name, e)
        return False


async def download_model_hf(
    manager: "ModelDownloadManager",
    model_name: str,
    progress_callback: Optional[object] = None,
) -> bool:
    """Download model using huggingface-hub library."""
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        logger.error("huggingface-hub not installed")
        return False

    if model_name not in manager.available_models:
        logger.warning("Unknown model: %s", model_name)
        return False

    model_info = manager.available_models[model_name]
    repo_id = model_info["repo_id"]
    model_path = manager.models_dir / model_name

    if model_path.exists():
        logger.info("Model %s already exists", model_name)
        return True

    logger.info("Downloading %s using huggingface-hub", model_name)

    try:
        downloaded_path = snapshot_download(
            repo_id=repo_id, local_dir=str(model_path), local_dir_use_symlinks=False,
        )
        logger.info("Successfully downloaded %s", model_name)
        manager.downloaded_models[model_name] = {
            "repo_id": repo_id,
            "downloaded_at": time.time(),
            "size": manager.get_model_size(model_name),
            "path": downloaded_path,
        }
        manager.save_config()
        return True

    except Exception as e:
        logger.error("Download failed for %s: %s", model_name, e)
        return False


async def download_gguf(
    manager: "ModelDownloadManager",
    gguf_name: str,
    progress_callback: Optional[object] = None,
) -> Optional[str]:
    """Download a GGUF model file. Returns local path or None."""
    if gguf_name not in manager.gguf_models:
        logger.warning("Unknown GGUF model: %s", gguf_name)
        return None

    info = manager.gguf_models[gguf_name]
    repo_id = info["repo_id"]
    filename = info["filename"]
    dest_path = manager.models_dir / filename

    if dest_path.exists():
        logger.info("GGUF model already downloaded: %s", dest_path)
        return str(dest_path)

    logger.info("Downloading %s (%s)...", gguf_name, info["size"])

    url = f"https://huggingface.co/{repo_id}/resolve/main/{filename}"
    hf_token = os.getenv("HF_TOKEN")
    headers = {}
    if hf_token:
        headers["Authorization"] = f"Bearer {hf_token}"

    try:
        response = requests.get(url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()

        total_size = int(response.headers.get("content-length", 0))
        downloaded = 0
        chunk_size = 8 * 1024 * 1024

        with open(dest_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=chunk_size):
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0 and progress_callback:
                    progress_callback(downloaded, total_size)

        manager.downloaded_models[gguf_name] = {
            "repo_id": repo_id,
            "filename": filename,
            "model_id": info["model_id"],
            "downloaded_at": time.time(),
            "size": dest_path.stat().st_size,
            "path": str(dest_path),
            "quantization": info["quantization"],
        }
        manager.save_config()
        logger.info("Downloaded GGUF: %s", dest_path)
        return str(dest_path)

    except Exception as e:
        logger.error("GGUF download failed: %s", e)
        if dest_path.exists():
            dest_path.unlink()
        return None
