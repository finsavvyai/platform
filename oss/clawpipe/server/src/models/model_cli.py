#!/usr/bin/env python3
"""
CLI interface for the FinSavvyAI Model Download Manager.

Extracted from download_models.py.
"""

import asyncio
import logging
import sys
import time

from src.models.model_operations import ModelDownloadManager

logger = logging.getLogger("finsavvyai.models.cli")


async def main() -> None:
    """Command line interface for the model download manager."""
    manager = ModelDownloadManager()

    if len(sys.argv) < 2:
        _print_usage(manager)
        return

    command = sys.argv[1].lower()

    if command == "list":
        _cmd_list(manager)
    elif command == "downloaded":
        _cmd_downloaded(manager)
    elif command == "download":
        await _cmd_download(manager)
    elif command == "delete":
        _cmd_delete(manager)
    elif command == "info":
        _cmd_info(manager)
    else:
        logger.error("Unknown command: %s", command)


def _print_usage(manager: ModelDownloadManager) -> None:
    """Print usage information and available models."""
    logger.info("FinSavvyAI Model Download Manager")
    logger.info("Usage:")
    logger.info("  download_models.py list          - List available models")
    logger.info("  download_models.py downloaded     - List downloaded models")
    logger.info("  download_models.py download <m>   - Download a model")
    logger.info("  download_models.py delete <m>     - Delete a model")
    logger.info("  download_models.py info <m>       - Get model info")

    for name, info in manager.list_available_models().items():
        downloaded = manager.list_downloaded_models()
        status = "downloaded" if name in downloaded else "available"
        logger.info("  [%s] %s - %s (%s)", status, name, info["description"], info["size"])


def _cmd_list(manager: ModelDownloadManager) -> None:
    """List available models."""
    for name, info in manager.list_available_models().items():
        logger.info(
            "%s: %s | Size: %s | Type: %s",
            name, info["description"], info["size"], info["type"],
        )
        if info.get("requires_auth"):
            logger.info("  Requires Hugging Face authentication")


def _cmd_downloaded(manager: ModelDownloadManager) -> None:
    """List downloaded models."""
    downloaded = manager.list_downloaded_models()
    if not downloaded:
        logger.info("No models downloaded yet")
        return

    for name in downloaded:
        size_bytes = manager.get_model_size(name)
        size_gb = size_bytes / (1024**3)
        info = manager.get_model_info(name)
        logger.info("%s: %.2fGB", name, size_gb)
        if info and info.get("downloaded_at"):
            downloaded_time = time.ctime(info["downloaded_at"])
            logger.info("  Downloaded: %s", downloaded_time)


async def _cmd_download(manager: ModelDownloadManager) -> None:
    """Download a model."""
    if len(sys.argv) < 3:
        logger.error("Please specify a model to download")
        return

    model_name = sys.argv[2]
    if model_name not in manager.list_available_models():
        logger.error("Unknown model: %s", model_name)
        return

    disk_info = manager.get_disk_space()
    logger.info("Available disk space: %.1fGB", disk_info["free_gb"])

    if disk_info["free_gb"] < 5:
        logger.warning("Low disk space! Need at least 5GB free")
        return

    success = await manager.download_model_git(model_name)
    if not success:
        logger.info("Trying huggingface-hub download...")
        success = await manager.download_model_hf(model_name)

    if success:
        logger.info("Model %s is ready to use", model_name)
    else:
        logger.error("Failed to download %s", model_name)


def _cmd_delete(manager: ModelDownloadManager) -> None:
    """Delete a model."""
    if len(sys.argv) < 3:
        logger.error("Please specify a model to delete")
        return
    manager.delete_model(sys.argv[2])


def _cmd_info(manager: ModelDownloadManager) -> None:
    """Show model info."""
    if len(sys.argv) < 3:
        logger.error("Please specify a model")
        return

    model_name = sys.argv[2]
    info = manager.get_model_info(model_name)

    if info:
        logger.info("Model: %s", model_name)
        logger.info("Description: %s", info["description"])
        logger.info("Size: %s", info["size"])
        logger.info("Type: %s", info["type"])
        logger.info("Repository: %s", info["repo_id"])
        logger.info("Downloaded: %s", "Yes" if info["downloaded"] else "No")
        if info["downloaded"]:
            size_gb = info["size_bytes"] / (1024**3)
            logger.info("Actual Size: %.2fGB", size_gb)
    else:
        logger.error("Unknown model: %s", model_name)


if __name__ == "__main__":
    asyncio.run(main())
