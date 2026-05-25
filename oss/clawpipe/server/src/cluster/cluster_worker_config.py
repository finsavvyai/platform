#!/usr/bin/env python3
"""
Cluster worker configuration and system utilities.

Contains WorkerConfig dataclass and system-level helpers
for GPU, memory, CPU detection, and IP discovery.

Extracted from cluster_worker.py.
"""

import logging
import socket
import sys
from dataclasses import dataclass
from typing import Dict, List

logger = logging.getLogger("finsavvyai.cluster.worker")


@dataclass
class WorkerConfig:
    """Worker configuration."""

    node_id: str
    name: str
    host: str
    port: int
    models: List[str]
    master_host: str
    master_port: int = 8000


def get_local_ip() -> str:
    """Get the local IP address of this machine."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def check_gpu_availability() -> Dict:
    """Check if GPU is available."""
    try:
        import torch

        if torch.cuda.is_available():
            return {"cuda": True, "devices": torch.cuda.device_count()}
    except ImportError:
        pass

    try:
        import subprocess

        result = subprocess.run(
            ["sysctl", "hw.optional.gpu"], capture_output=True, text=True
        )
        if result.returncode == 0 and "hw.optional.gpu: 1" in result.stdout:
            return {"apple_silicon": True}
    except Exception:
        pass

    return {"gpu": False}


def get_memory_info() -> Dict:
    """Get memory information."""
    try:
        import psutil

        return {
            "total": psutil.virtual_memory().total,
            "available": psutil.virtual_memory().available,
            "used": psutil.virtual_memory().used,
        }
    except ImportError:
        return {"total": 0, "available": 0, "used": 0}


def get_cpu_info() -> Dict:
    """Get CPU information."""
    try:
        import psutil

        return {
            "cores": psutil.cpu_count(),
            "usage_percent": psutil.cpu_percent(interval=1),
        }
    except ImportError:
        return {"cores": 0, "usage_percent": 0}
