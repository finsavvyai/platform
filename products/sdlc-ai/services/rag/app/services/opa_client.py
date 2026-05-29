"""
OPA Client Service for SDLC.ai Platform

This module provides a Python client for interacting with Open Policy Agent (OPA)
for policy evaluation with support for caching, batch processing, and comprehensive
error handling.
"""

import asyncio
import hashlib
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta

import aiohttp
import redis.asyncio as redis
from pydantic import BaseModel, Field

from ..core.config import settings


logger = logging.getLogger(__name__)


@dataclass
class PolicyEvaluationRequest:
    """Request for policy evaluation"""

    input: Dict[str, Any]
    policy: Optional[str] = None
    rule: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class PolicyEvaluationResponse:
    """Response from OPA policy evaluation"""

    result: Any
    decision: bool
    reason: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    execution_time_ms: Optional[int] = None


@dataclass
class BatchEvaluation:
    """Single evaluation in a batch request"""

    policy_path: str
    input: Dict[str, Any]


@dataclass
class DecisionCacheKey:
    """Cache key for policy decisions"""

    policy_id: str
    input_hash: str
    context: Dict[str, Any]


@dataclass
class DecisionCacheValue:
    """Cached decision value"""

    decision: bool
    reason: Optional[str]
    result: Any
    execution_time: timedelta
    cached_at: datetime
    ttl: timedelta
    metadata: Optional[Dict[str, Any]] = None


class OPAConfig(BaseModel):
    """Configuration for OPA client"""

    base_url: str = "http://localhost:8181"
    timeout: int = Field(default=5, description="Timeout in seconds")
    cache_enabled: bool = True
    cache_ttl: int = Field(default=30, description="Cache TTL in seconds")
    retry_attempts: int = 3
    retry_delay: float = 0.1
    enable_metrics: bool = True
    log_level: str = "INFO"
    max_connections: int = 100
    max_connections_per_host: int = 10


class OPAClientError(Exception):
    """Base exception for OPA client errors"""

    pass


class OPATimeoutError(OPAClientError):
    """Timeout error for OPA requests"""

    pass


class OPAApiError(OPAClientError):
    """API error from OPA"""

    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


class OPAClient:
    """Async OPA client with caching and retry support"""

    def __init__(
        self,
        config: Optional[OPAConfig] = None,
        redis_client: Optional[redis.Redis] = None,
    ):
        self.config = config or OPAConfig()
        self.redis = redis_client
        self.logger = self._setup_logger()

        # Setup HTTP client
        self.connector = aiohttp.TCPConnector(
            limit=self.config.max_connections,
            limit_per_host=self.config.max_connections_per_host,
            ttl_dns_cache=300,
            ttl_dns_cache_per_host=300,
            use_dns_cache=True,
            keepalive_timeout=60,
            enable_cleanup_closed=True,
        )

        self.timeout = aiohttp.ClientTimeout(total=self.config.timeout)
        self.session: Optional[aiohttp.ClientSession] = None

    def _setup_logger(self) -> logging.Logger:
        """Setup logger with configured level"""
        logger = logging.getLogger("opa_client")
        logger.setLevel(getattr(logging, self.config.log_level.upper()))

        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)

        return logger

    async def __aenter__(self):
        """Async context manager entry"""
        await self._ensure_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()

    async def _ensure_session(self):
        """Ensure HTTP session is created"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                connector=self.connector,
                timeout=self.timeout,
                headers={"Content-Type": "application/json"},
            )

    async def close(self):
        """Close the client and cleanup resources"""
        if self.session and not self.session.closed:
            await self.session.close()
        if self.connector:
            await self.connector.close()

    async def evaluate_policy(
        self,
        policy_path: str,
        input_data: Dict[str, Any],
        use_cache: Optional[bool] = None,
    ) -> PolicyEvaluationResponse:
        """
        Evaluate a policy with the given input data

        Args:
            policy_path: Path to the policy in OPA
            input_data: Input data for policy evaluation
            use_cache: Whether to use caching (overrides config)

        Returns:
            PolicyEvaluationResponse with decision and metadata

        Raises:
            OPAClientError: If evaluation fails
        """
        start_time = time.time()
        use_cache = use_cache if use_cache is not None else self.config.cache_enabled

        # Check cache first
        if use_cache and self.redis:
            cache_key = self._generate_cache_key(policy_path, input_data)
            cached_response = await self._get_cached_decision(cache_key)
            if cached_response:
                self.logger.debug(
                    f"Policy evaluation served from cache: {policy_path}",
                    extra={"execution_time_ms": int((time.time() - start_time) * 1000)},
                )
                return cached_response

        # Evaluate policy
        await self._ensure_session()
        response = await self._evaluate_with_retry(policy_path, input_data)

        # Cache the result
        if use_cache and self.redis:
            cache_key = self._generate_cache_key(policy_path, input_data)
            cache_value = DecisionCacheValue(
                decision=response.decision,
                reason=response.reason,
                result=response.result,
                execution_time=timedelta(seconds=time.time() - start_time),
                cached_at=datetime.utcnow(),
                ttl=timedelta(seconds=self.config.cache_ttl),
                metadata=response.metrics,
            )
            await self._cache_decision(cache_key, cache_value)

        # Log metrics
        execution_time = (time.time() - start_time) * 1000
        self.logger.info(
            f"Policy evaluation completed: {policy_path}",
            extra={
                "policy": policy_path,
                "decision": response.decision,
                "execution_time_ms": int(execution_time),
                "cached": False,
            },
        )

        response.execution_time_ms = int(execution_time)
        return response

    async def evaluate_data_policy(
        self, tenant_id: str, user_id: str, action: str, resource: str, data: Any
    ) -> PolicyEvaluationResponse:
        """Evaluate a data access policy"""
        input_data = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "action": action,
            "resource": resource,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": str(uuid.uuid4()),  # Would need import
        }
        return await self.evaluate_policy("sdlc.data.access", input_data)

    async def evaluate_auth_policy(
        self, auth_context: Dict[str, Any]
    ) -> PolicyEvaluationResponse:
        """Evaluate an authentication policy"""
        input_data = {
            "authentication": auth_context,
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": str(uuid.uuid4()),  # Would need import
        }
        return await self.evaluate_policy("sdlc.auth.policy", input_data)

    async def evaluate_dlp_policy(
        self, content: str, user_context: Dict[str, Any], dlp_scanned: bool = False
    ) -> PolicyEvaluationResponse:
        """Evaluate a DLP policy"""
        input_data = {
            "content": content,
            "user": user_context,
            "dlp_scanned": dlp_scanned,
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": str(uuid.uuid4()),  # Would need import
        }
        return await self.evaluate_policy("sdlc.dlp.policy", input_data)

    async def evaluate_rag_policy(
        self, query: str, user_context: Dict[str, Any], documents: List[Dict[str, Any]]
    ) -> PolicyEvaluationResponse:
        """Evaluate a RAG policy"""
        input_data = {
            "query": query,
            "user": user_context,
            "documents": documents,
            "action": "retrieve",
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": str(uuid.uuid4()),  # Would need import
        }
        return await self.evaluate_policy("sdlc.rag.policy", input_data)

    async def batch_evaluate_policies(
        self, evaluations: List[BatchEvaluation], max_concurrency: int = 10
    ) -> List[PolicyEvaluationResponse]:
        """
        Evaluate multiple policies in parallel

        Args:
            evaluations: List of batch evaluations
            max_concurrency: Maximum number of concurrent evaluations

        Returns:
            List of policy evaluation responses

        Raises:
            OPAClientError: If any evaluation fails
        """
        semaphore = asyncio.Semaphore(max_concurrency)

        async def evaluate_single(
            index: int, evaluation: BatchEvaluation
        ) -> Tuple[int, PolicyEvaluationResponse]:
            async with semaphore:
                response = await self.evaluate_policy(
                    evaluation.policy_path, evaluation.input
                )
                return index, response

        # Run evaluations concurrently
        tasks = [
            evaluate_single(idx, eval_item) for idx, eval_item in enumerate(evaluations)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        responses = [None] * len(evaluations)
        errors = []

        for result in results:
            if isinstance(result, Exception):
                errors.append(result)
            else:
                index, response = result
                responses[index] = response

        if errors:
            raise OPAClientError(f"Batch evaluation failed: {errors}")

        return responses

    async def list_policies(self) -> List[str]:
        """List available policies from OPA"""
        await self._ensure_session()

        url = f"{self.config.base_url}/v1/data"

        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    raise OPAApiError(
                        f"Failed to list policies: HTTP {response.status}",
                        response.status,
                    )

                data = await response.json()
                policies = []

                if "result" in data and isinstance(data["result"], dict):
                    for key in data["result"].keys():
                        policies.append(key)

                return policies

        except aiohttp.ClientError as e:
            raise OPAClientError(f"HTTP request failed: {str(e)}")

    async def get_policy_info(self, policy_path: str) -> Dict[str, Any]:
        """Get information about a specific policy"""
        await self._ensure_session()

        url = f"{self.config.base_url}/v1/data/{policy_path}"

        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    raise OPAApiError(
                        f"Failed to get policy info: HTTP {response.status}",
                        response.status,
                    )

                return await response.json()

        except aiohttp.ClientError as e:
            raise OPAClientError(f"HTTP request failed: {str(e)}")

    async def health_check(self) -> bool:
        """Check if OPA is healthy"""
        await self._ensure_session()

        url = f"{self.config.base_url}/health"

        try:
            async with self.session.get(
                url, timeout=aiohttp.ClientTimeout(total=2)
            ) as response:
                return response.status == 200
        except (aiohttp.ClientError, asyncio.TimeoutError):
            return False

    # Private methods

    async def _evaluate_with_retry(
        self, policy_path: str, input_data: Dict[str, Any]
    ) -> PolicyEvaluationResponse:
        """Evaluate policy with retry logic"""
        last_error = None

        for attempt in range(self.config.retry_attempts + 1):
            if attempt > 0:
                delay = self.config.retry_delay * (2 ** (attempt - 1))
                await asyncio.sleep(delay)

            try:
                return await self._evaluate_raw_policy(policy_path, input_data)
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                last_error = e
                self.logger.warning(
                    f"Policy evaluation failed (attempt {attempt + 1}): {policy_path}",
                    extra={"error": str(e), "attempt": attempt + 1},
                )
            except OPAApiError as e:
                # Don't retry API errors (4xx status codes)
                raise e

        raise OPAClientError(f"All retry attempts failed: {str(last_error)}")

    async def _evaluate_raw_policy(
        self, policy_path: str, input_data: Dict[str, Any]
    ) -> PolicyEvaluationResponse:
        """Raw policy evaluation against OPA"""
        url = f"{self.config.base_url}/v1/data/{policy_path}"

        request_body = {"input": input_data}

        try:
            async with self.session.post(url, json=request_body) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise OPAApiError(
                        f"OPA returned HTTP {response.status}: {error_text}",
                        response.status,
                    )

                result = await response.json()
                return self._parse_opa_response(result)

        except asyncio.TimeoutError as e:
            raise OPATimeoutError(f"Policy evaluation timed out: {str(e)}")
        except aiohttp.ClientError as e:
            raise OPAClientError(f"HTTP request failed: {str(e)}")

    def _parse_opa_response(self, result: Dict[str, Any]) -> PolicyEvaluationResponse:
        """Parse OPA response into our format"""
        response = PolicyEvaluationResponse(result=result, decision=False)

        if "result" in result and isinstance(result["result"], dict):
            result_data = result["result"]

            # Extract decision
            if "allow" in result_data:
                response.decision = bool(result_data["allow"])

            # Extract reason
            if "decision_reason" in result_data and isinstance(
                result_data["decision_reason"], list
            ):
                reasons = [str(r) for r in result_data["decision_reason"] if r]
                response.reason = "; ".join(reasons) if reasons else None

            # Store full result
            response.result = result_data

        return response

    def _generate_cache_key(self, policy_path: str, input_data: Dict[str, Any]) -> str:
        """Generate cache key for policy decision"""
        input_str = json.dumps(input_data, sort_keys=True)
        input_hash = hashlib.sha256(input_str.encode()).hexdigest()[:16]
        return f"opa:decision:{policy_path}:{input_hash}"

    async def _get_cached_decision(
        self, cache_key: str
    ) -> Optional[PolicyEvaluationResponse]:
        """Get cached decision from Redis"""
        if not self.redis:
            return None

        try:
            cached_data = await self.redis.get(cache_key)
            if not cached_data:
                return None

            cache_dict = json.loads(cached_data)
            cached_at = datetime.fromisoformat(cache_dict["cached_at"])
            ttl = timedelta(seconds=cache_dict["ttl"])

            # Check if cache is still valid
            if datetime.utcnow() - cached_at > ttl:
                await self.redis.delete(cache_key)
                return None

            return PolicyEvaluationResponse(
                result=cache_dict["result"],
                decision=cache_dict["decision"],
                reason=cache_dict.get("reason"),
                metrics=cache_dict.get("metadata"),
            )

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            self.logger.error(f"Failed to parse cached decision: {e}")
            await self.redis.delete(cache_key)
            return None

    async def _cache_decision(self, cache_key: str, cache_value: DecisionCacheValue):
        """Cache policy decision in Redis"""
        if not self.redis:
            return

        try:
            cache_dict = {
                "decision": cache_value.decision,
                "reason": cache_value.reason,
                "result": cache_value.result,
                "cached_at": cache_value.cached_at.isoformat(),
                "ttl": int(cache_value.ttl.total_seconds()),
                "metadata": cache_value.metadata,
            }

            await self.redis.setex(
                cache_key, int(cache_value.ttl.total_seconds()), json.dumps(cache_dict)
            )

        except Exception as e:
            self.logger.error(f"Failed to cache decision: {e}")


# Factory function
async def create_opa_client(
    config: Optional[OPAConfig] = None, redis_url: Optional[str] = None
) -> OPAClient:
    """
    Create and configure OPA client

    Args:
        config: OPA client configuration
        redis_url: Redis URL for caching

    Returns:
        Configured OPA client
    """
    client_config = config or OPAConfig()

    # Setup Redis if URL provided
    redis_client = None
    if redis_url and client_config.cache_enabled:
        redis_client = redis.from_url(redis_url, decode_responses=True)

    return OPAClient(config=client_config, redis_client=redis_client)
