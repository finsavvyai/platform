#!/usr/bin/env python3
"""Skill execution engine and authenticator for FinSavvyAI."""

import logging
import time
from typing import Any, Dict, List, Optional

import aiohttp

from src.core.request_queue import RequestQueue
from src.skills.skill_retry import execute_with_retry

logger = logging.getLogger("finsavvyai.skills")


class SkillExecutor:
    """
    Executes skills by proxying to the local cluster endpoints.
    """

    def __init__(
        self,
        cluster_url: str = "http://localhost:8001",
        api_key: Optional[str] = None,
        queue: Optional[RequestQueue] = None,
        max_retries: int = 3,
    ):
        self.cluster_url = cluster_url.rstrip("/")
        self.api_key = api_key
        self._session: Optional[aiohttp.ClientSession] = None
        self._queue = queue
        self.max_retries = max_retries

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=60),
            )
        return self._session

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    async def execute_skill(
        self, skill_id: str, params: Dict[str, Any],
        priority: int = 0,
    ) -> Dict[str, Any]:
        """Route skill execution to the appropriate handler with retry."""
        handlers = {
            "inference": self._exec_inference,
            "vision": self._exec_vision,
            "models": self._exec_models,
            "cluster-status": self._exec_cluster_status,
            "benchmark": self._exec_benchmark,
        }
        handler = handlers.get(skill_id)
        if not handler:
            return {"error": f"Unknown skill: {skill_id}", "status": "not_found"}
        result = await execute_with_retry(
            handler=handler, params=params,
            max_retries=self.max_retries, skill_id=skill_id,
        )
        if result.get("status") == "max_retries_exceeded":
            result["status"] = "execution_error"
        return result

    async def _exec_inference(self, params: Dict) -> Dict:
        """Task 14.2 -- inference skill."""
        session = await self._get_session()
        body = {
            "model": params.get("model", "default"),
            "messages": params.get("messages", []),
            "max_tokens": params.get("max_tokens", 512),
            "temperature": params.get("temperature", 0.7),
            "stream": False,
        }
        async with session.post(
            f"{self.cluster_url}/v1/chat/completions",
            json=body,
            headers=self._get_headers(),
        ) as resp:
            return await resp.json()

    async def _exec_vision(self, params: Dict) -> Dict:
        """Task 14.3 -- vision skill."""
        session = await self._get_session()
        body = {
            "image": params.get("image", ""),
            "pipeline": params.get("pipeline", "document_analysis"),
            "model": params.get("model", "default"),
        }
        async with session.post(
            f"{self.cluster_url}/v1/vision/pipeline",
            json=body,
            headers=self._get_headers(),
        ) as resp:
            return await resp.json()

    async def _exec_models(self, params: Dict) -> Dict:
        """Task 14.4 -- models skill."""
        session = await self._get_session()
        async with session.get(
            f"{self.cluster_url}/v1/models",
            headers=self._get_headers(),
        ) as resp:
            return await resp.json()

    async def _exec_cluster_status(self, params: Dict) -> Dict:
        """Task 14.5 -- cluster status skill."""
        session = await self._get_session()
        async with session.get(
            f"{self.cluster_url}/health",
            headers=self._get_headers(),
        ) as resp:
            return await resp.json()

    async def _exec_benchmark(self, params: Dict) -> Dict:
        """Task 14.6 -- benchmark skill."""
        model = params.get("model", "default")
        prompt = params.get("prompt", "Hello, how are you?")
        iterations = min(params.get("iterations", 5), 20)

        session = await self._get_session()
        results: List[Dict] = []
        for i in range(iterations):
            start = time.monotonic()
            body = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 50,
                "stream": False,
            }
            try:
                async with session.post(
                    f"{self.cluster_url}/v1/chat/completions",
                    json=body,
                    headers=self._get_headers(),
                ) as resp:
                    elapsed = (time.monotonic() - start) * 1000
                    results.append({
                        "iteration": i + 1,
                        "latency_ms": round(elapsed, 2),
                        "status": resp.status,
                    })
            except Exception as e:
                elapsed = (time.monotonic() - start) * 1000
                results.append({
                    "iteration": i + 1,
                    "latency_ms": round(elapsed, 2),
                    "error": str(e),
                })

        latencies = [r["latency_ms"] for r in results if "error" not in r]
        return {
            "benchmark": {
                "model": model,
                "iterations": iterations,
                "results": results,
                "avg_latency_ms": round(sum(latencies) / len(latencies), 2)
                if latencies else 0,
                "min_latency_ms": round(min(latencies), 2) if latencies else 0,
                "max_latency_ms": round(max(latencies), 2) if latencies else 0,
                "success_rate": (
                    len(latencies) / len(results) * 100 if results else 0
                ),
            }
        }

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()


class SkillAuthenticator:
    """Validates API keys for incoming skill calls (Task 14.8)."""

    def __init__(self, valid_keys: Optional[List[str]] = None):
        self._valid_keys = set(valid_keys) if valid_keys else None

    def validate(self, api_key: Optional[str]) -> bool:
        if self._valid_keys is None:
            return True
        if not api_key:
            return False
        return api_key in self._valid_keys

    def add_key(self, key: str) -> None:
        if self._valid_keys is None:
            self._valid_keys = set()
        self._valid_keys.add(key)

    def remove_key(self, key: str) -> None:
        if self._valid_keys:
            self._valid_keys.discard(key)
