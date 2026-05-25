"""System info helpers and interactive setup for cluster worker."""

import socket
import sys
from dataclasses import dataclass
from typing import Dict, List


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

        mem = psutil.virtual_memory()
        return {"total": mem.total, "available": mem.available, "used": mem.used}
    except ImportError:
        return {"total": 0, "available": 0, "used": 0}


def get_cpu_info() -> Dict:
    """Get CPU information."""
    try:
        import psutil

        return {"cores": psutil.cpu_count(), "usage_percent": psutil.cpu_percent(interval=1)}
    except ImportError:
        return {"cores": 0, "usage_percent": 0}


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


def interactive_setup() -> WorkerConfig:
    """Interactive setup for worker configuration."""
    print("FinSavvyAI Worker Node Setup")
    print("=" * 40)

    local_ip = get_local_ip()
    print(f"Detected your IP: {local_ip}")
    print("\nWorker Configuration:")
    print("-" * 20)

    node_id = input("Node ID (e.g., laptop-mbp): ").strip() or f"laptop-{local_ip.split('.')[-1]}"
    name = input("Node Name (e.g., MacBook Pro): ").strip() or f"Worker-{node_id}"

    print("\nAvailable models to host:")
    print("1. gpt-3.5-turbo\n2. gpt-4\n3. claude-3-sonnet\n4. llama-2-7b\n5. custom")

    model_choice = input("Choose models (e.g., 1,3,5): ").strip()
    model_map = {
        "1": ["gpt-3.5-turbo"], "2": ["gpt-4"],
        "3": ["claude-3-sonnet"], "4": ["llama-2-7b"], "5": [],
    }

    models: List[str] = []
    for choice in model_choice.split(","):
        choice = choice.strip()
        if choice in model_map:
            models.extend(model_map[choice])
        elif choice == "5":
            custom = input("Enter custom models (comma-separated): ").strip()
            models.extend([m.strip() for m in custom.split(",")])

    if not models:
        models = ["gpt-3.5-turbo"]

    port = int(input("Port (default 8001): ").strip() or "8001")
    master_host = input("Master host IP (default localhost): ").strip() or "localhost"
    master_port = int(input("Master port (default 8000): ").strip() or "8000")

    return WorkerConfig(
        node_id=node_id, name=name, host=local_ip, port=port,
        models=models, master_host=master_host, master_port=master_port,
    )
