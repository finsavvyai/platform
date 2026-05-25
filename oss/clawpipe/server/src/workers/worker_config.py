"""Worker node configuration."""

import os
import platform
import socket
import time
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class WorkerConfig:
    """Configuration for worker node."""

    master_host: str = "localhost"
    master_port: int = 8000
    worker_id: str = None
    worker_name: str = None
    host: str = "0.0.0.0"
    port: int = None
    models: List[str] = None
    openclaw_enabled: bool = False
    openclaw_url: str = "http://localhost:11434"
    openclaw_api_key: str = None

    def __post_init__(self):
        if self.worker_id is None:
            self.worker_id = f"worker-{socket.gethostname().lower()}-{int(time.time())}"
        if self.worker_name is None:
            self.worker_name = f"{platform.node()} Worker"
        if self.port is None:
            self.port = self._find_available_port()
        if self.models is None:
            self.models = ["gpt-3.5-turbo-sim"]
        if os.environ.get("OPENCLAW_ENABLED", "false").lower() == "true":
            self.openclaw_enabled = True
            self.openclaw_url = os.environ.get("OPENCLAW_URL", "http://localhost:11434")
            self.openclaw_api_key = os.environ.get("OPENCLAW_API_KEY")

    def _find_available_port(self) -> int:
        """Find an available port starting from 8001."""
        for port in range(8001, 8010):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(("", port))
                    return port
            except OSError:
                continue
        return 8001
