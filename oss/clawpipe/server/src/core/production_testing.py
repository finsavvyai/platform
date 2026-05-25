#!/usr/bin/env python3
"""
Production Testing Harnesses

Integration test runner (Task 19.2) and load test harness (Task 19.3).
"""

import asyncio
import logging
import time
from typing import Any, Callable, Dict, List, Optional

import aiohttp

logger = logging.getLogger("finsavvyai.production")


class IntegrationTestRunner:
    """Run end-to-end integration tests."""

    def __init__(self) -> None:
        self._tests: List[Dict] = []
        self._results: List[Dict] = []

    def add_test(
        self, name: str, test_fn: Callable, description: str = ""
    ) -> None:
        """Register an integration test."""
        self._tests.append(
            {"name": name, "test_fn": test_fn, "description": description}
        )

    async def run_all(self) -> Dict[str, Any]:
        """Run all integration tests."""
        self._results = []

        for test in self._tests:
            start = time.monotonic()
            try:
                result = test["test_fn"]()
                if asyncio.iscoroutine(result):
                    result = await result
                elapsed = (time.monotonic() - start) * 1000
                self._results.append(
                    {
                        "name": test["name"],
                        "status": "pass",
                        "duration_ms": round(elapsed, 2),
                    }
                )
            except Exception as e:
                elapsed = (time.monotonic() - start) * 1000
                self._results.append(
                    {
                        "name": test["name"],
                        "status": "fail",
                        "error": str(e),
                        "duration_ms": round(elapsed, 2),
                    }
                )

        passed = sum(1 for r in self._results if r["status"] == "pass")
        failed = sum(1 for r in self._results if r["status"] == "fail")

        return {
            "total": len(self._results),
            "passed": passed,
            "failed": failed,
            "success_rate": round(passed / len(self._results) * 100, 1)
            if self._results
            else 0,
            "results": self._results,
        }


class LoadTestHarness:
    """Simple load testing for hybrid architecture."""

    def __init__(self, target_url: str = "http://localhost:8001") -> None:
        self.target_url = target_url.rstrip("/")

    async def run_load_test(
        self,
        endpoint: str = "/v1/chat/completions",
        payload: Optional[Dict] = None,
        concurrent: int = 10,
        total_requests: int = 50,
    ) -> Dict[str, Any]:
        """Run concurrent load test."""
        if payload is None:
            payload = {
                "model": "default",
                "messages": [{"role": "user", "content": "Hello"}],
                "max_tokens": 50,
            }

        semaphore = asyncio.Semaphore(concurrent)
        results: List[Dict] = []

        async def _request(i: int) -> None:
            async with semaphore:
                start = time.monotonic()
                try:
                    async with aiohttp.ClientSession(
                        timeout=aiohttp.ClientTimeout(total=30)
                    ) as session:
                        async with session.post(
                            f"{self.target_url}{endpoint}",
                            json=payload,
                        ) as resp:
                            elapsed = (time.monotonic() - start) * 1000
                            results.append(
                                {
                                    "request_id": i,
                                    "status": resp.status,
                                    "latency_ms": round(elapsed, 2),
                                    "success": resp.status == 200,
                                }
                            )
                except Exception as e:
                    elapsed = (time.monotonic() - start) * 1000
                    results.append(
                        {
                            "request_id": i,
                            "error": str(e),
                            "latency_ms": round(elapsed, 2),
                            "success": False,
                        }
                    )

        await asyncio.gather(*[_request(i) for i in range(total_requests)])

        successes = [r for r in results if r["success"]]
        latencies = [r["latency_ms"] for r in successes]

        return {
            "total_requests": total_requests,
            "concurrent": concurrent,
            "successful": len(successes),
            "failed": total_requests - len(successes),
            "avg_latency_ms": round(sum(latencies) / len(latencies), 2)
            if latencies
            else 0,
            "min_latency_ms": round(min(latencies), 2) if latencies else 0,
            "max_latency_ms": round(max(latencies), 2) if latencies else 0,
            "p95_latency_ms": round(
                sorted(latencies)[int(len(latencies) * 0.95)]
                if latencies
                else 0,
                2,
            ),
            "rps": round(
                len(successes) / (max(r["latency_ms"] for r in results) / 1000),
                2,
            )
            if results
            else 0,
        }
