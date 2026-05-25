#!/usr/bin/env python3
"""
Load balancing for model routing with connection pooling and node caching.
"""

import time
from typing import Optional

import aiohttp

from src.core.config import ClusterConfig


class LoadBalancer:
    """Load balancing for model routing with connection pooling and node caching."""

    def __init__(self, master_url: str = None, cache_ttl: float = 15.0) -> None:
        if master_url is None:
            config = ClusterConfig()
            host = config.master_host or "localhost"
            port = config.master_port
            self.master_url = f"http://{host}:{port}"
        else:
            self.master_url = master_url
        self._session: Optional[aiohttp.ClientSession] = None
        self._nodes_cache: list = []
        self._cache_time: float = 0
        self._cache_ttl = cache_ttl

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create a persistent session with connection pooling."""
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=20, limit_per_host=10, ttl_dns_cache=300
            )
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=aiohttp.ClientTimeout(total=5, connect=2),
            )
        return self._session

    async def _fetch_nodes(self) -> list:
        """Fetch available nodes from master with caching."""
        now = time.monotonic()
        if self._nodes_cache and (now - self._cache_time) < self._cache_ttl:
            return self._nodes_cache

        try:
            session = await self._get_session()
            async with session.get(f"{self.master_url}/cluster/nodes") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self._nodes_cache = data.get("nodes", [])
                    self._cache_time = now
                    return self._nodes_cache
        except Exception:
            if self._nodes_cache:
                return self._nodes_cache
        return []

    async def get_worker_for_model(self, model_name: str) -> Optional[str]:
        """Get worker URL that has a specific model loaded."""
        nodes = await self._fetch_nodes()
        for node in nodes:
            if node.get("status") == "online" and model_name in node.get("models", []):
                return f"http://{node['host']}:{node['port']}"
        return None

    async def get_any_worker(self) -> str:
        """Get any available online worker as a fallback."""
        nodes = await self._fetch_nodes()
        for node in nodes:
            if node.get("status") == "online":
                return f"http://{node['host']}:{node['port']}"
        return "http://localhost:8001"

    async def close(self) -> None:
        """Close the persistent session."""
        if self._session and not self._session.closed:
            await self._session.close()
