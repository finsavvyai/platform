"""
OPA (Open Policy Agent) Client for Python
Provides async and sync policy evaluation capabilities for the SDLC.ai platform
"""

import asyncio
import hashlib
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta

import aiohttp
import redis.asyncio as redis
from pydantic import BaseModel, Field

from ..core.config import get_settings

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
    """Response from policy evaluation"""

    decision: bool
    reason: str = ""
    result: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    execution_time_ms: int = 0
    cached: bool = False


@dataclass
class DecisionCacheValue:
    """Value stored in cache for policy decisions"""

    decision: bool
    reason: str
    result: Optional[Dict[str, Any]]
    execution_time_ms: int
    cached_at: datetime
    ttl: timedelta
    metadata: Optional[Dict[str, Any]] = None


class OPAConfig(BaseModel):
    """Configuration for OPA client"""

    base_url: str = Field(default="http://localhost:8181", description="OPA server URL")
    timeout: int = Field(default=5, description="Request timeout in seconds")
    cache_enabled: bool = Field(default=True, description="Enable decision caching")
    cache_ttl: int = Field(default=30, description="Cache TTL in seconds")
    retry_attempts: int = Field(default=3, description="Number of retry attempts")
    retry_delay: float = Field(default=0.1, description="Retry delay in seconds")
    enable_metrics: bool = Field(default=True, description="Enable metrics collection")
    log_level: str = Field(default="info", description="Log level")


class OPAClient:
    """Async OPA client with caching and retry capabilities"""

    def __init__(
        self,
        config: Optional[OPAConfig] = None,
        redis_client: Optional[redis.Redis] = None,
    ):
        """
        Initialize OPA client

        Args:
            config: OPA configuration
            redis_client: Redis client for caching
        """
        self.config = config or OPAConfig()
        self.redis = redis_client

        # Configure logging
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        self.logger.setLevel(getattr(logging, self.config.log_level.upper()))

        # HTTP client configuration
        self.timeout = aiohttp.ClientTimeout(total=self.config.timeout)
        self.session: Optional[aiohttp.ClientSession] = None

        # Metrics
        self.metrics = {
            "evaluations_total": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "errors_total": 0,
            "avg_execution_time_ms": 0,
        }

    async def __aenter__(self):
        """Async context manager entry"""
        await self._ensure_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()

    async def close(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None

    async def _ensure_session(self):
        """Ensure HTTP session exists"""
        if not self.session or self.session.closed:
            connector = aiohttp.TCPConnector(
                limit=100,
                limit_per_host=10,
                keepalive_timeout=30,
                enable_cleanup_closed=True,
            )
            self.session = aiohttp.ClientSession(
                connector=connector,
                timeout=self.timeout,
            )

    async def evaluate_policy(
        self,
        policy_path: str,
        input_data: Dict[str, Any],
        use_cache: Optional[bool] = None,
    ) -> PolicyEvaluationResponse:
        """
        Evaluate a policy with the given input data

        Args:
            policy_path: Path to the policy (e.g., "sdlc.data.access")
            input_data: Input data for policy evaluation
            use_cache: Override cache setting

        Returns:
            Policy evaluation response
        """
        start_time = time.time()
        use_cache = use_cache if use_cache is not None else self.config.cache_enabled

        # Check cache first
        if use_cache and self.redis:
            cache_key = self._generate_cache_key(policy_path, input_data)
            cached_response = await self._get_cached_decision(cache_key)
            if cached_response:
                self.metrics["cache_hits"] += 1
                cached_response.cached = True
                self.logger.debug(
                    f"Policy evaluation served from cache: {policy_path}",
                    extra={"policy": policy_path, "cached": True},
                )
                return cached_response

        # Cache miss - evaluate policy
        if use_cache and self.redis:
            self.metrics["cache_misses"] += 1

        try:
            response = await self._evaluate_with_retry(policy_path, input_data)

            # Cache the result
            if use_cache and self.redis:
                cache_key = self._generate_cache_key(policy_path, input_data)
                cache_value = DecisionCacheValue(
                    decision=response.decision,
                    reason=response.reason,
                    result=response.result,
                    execution_time_ms=response.execution_time_ms,
                    cached_at=datetime.utcnow(),
                    ttl=timedelta(seconds=self.config.cache_ttl),
                    metadata=response.metrics,
                )
                await self._cache_decision(cache_key, cache_value)

            # Update metrics
            execution_time = (time.time() - start_time) * 1000
            self.metrics["evaluations_total"] += 1
            self._update_avg_execution_time(execution_time)

            self.logger.info(
                f"Policy evaluation completed: {policy_path}",
                extra={
                    "policy": policy_path,
                    "decision": response.decision,
                    "execution_time_ms": execution_time,
                    "cached": False,
                },
            )

            return response

        except Exception as e:
            self.metrics["errors_total"] += 1
            self.logger.error(
                f"Policy evaluation failed: {policy_path}",
                extra={"policy": policy_path, "error": str(e)},
                exc_info=True,
            )
            raise

    async def evaluate_data_policy(
        self,
        tenant_id: str,
        user_id: str,
        action: str,
        resource: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> PolicyEvaluationResponse:
        """
        Evaluate a data access policy

        Args:
            tenant_id: Tenant ID
            user_id: User ID
            action: Action being performed
            resource: Resource being accessed
            data: Additional data context

        Returns:
            Policy evaluation response
        """
        input_data = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "action": action,
            "resource": resource,
            "data": data or {},
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": str(time.time()),  # Simple request ID
        }

        return await self.evaluate_policy("sdlc.data.access", input_data)

    async def evaluate_auth_policy(
        self,
        auth_context: Dict[str, Any],
    ) -> PolicyEvaluationResponse:
        """
        Evaluate an authentication policy

        Args:
            auth_context: Authentication context

        Returns:
            Policy evaluation response
        """
        input_data = {
            "authentication": auth_context,
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": str(time.time()),
        }

        return await self.evaluate_policy("sdlc.auth.policy", input_data)

    async def evaluate_dlp_policy(
        self,
        content: str,
        user_context: Dict[str, Any],
        dlp_scanned: bool = False,
        detected_pii: Optional[List[Dict[str, Any]]] = None,
    ) -> PolicyEvaluationResponse:
        """
        Evaluate a DLP policy

        Args:
            content: Content to check
            user_context: User context
            dlp_scanned: Whether content has been DLP scanned
            detected_pii: List of detected PII items

        Returns:
            Policy evaluation response
        """
        input_data = {
            "content": content,
            "user": user_context,
            "dlp_scanned": dlp_scanned,
            "detected_pii": detected_pii or [],
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": str(time.time()),
        }

        return await self.evaluate_policy("sdlc.dlp.policy", input_data)

    async def evaluate_resource_policy(
        self,
        policy_content: str,
        input_data: Dict[str, Any],
        policy_context: Optional[Dict[str, Any]] = None,
    ) -> PolicyEvaluationResponse:
        """
        Evaluate a policy with raw Rego content

        Args:
            policy_content: Raw Rego policy content
            input_data: Input data for evaluation
            policy_context: Additional policy context

        Returns:
            Policy evaluation response
        """
        # Add policy context to input
        enhanced_input = {
            "input": input_data,
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": str(time.time()),
        }

        if policy_context:
            enhanced_input.update(policy_context)

        return await self._evaluate_raw_policy(policy_content, enhanced_input)

    async def batch_evaluate_policies(
        self,
        evaluations: List[Tuple[str, Dict[str, Any]]],
    ) -> List[PolicyEvaluationResponse]:
        """
        Evaluate multiple policies in parallel

        Args:
            evaluations: List of (policy_path, input_data) tuples

        Returns:
            List of policy evaluation responses
        """
        tasks = [
            self.evaluate_policy(policy_path, input_data)
            for policy_path, input_data in evaluations
        ]

        return await asyncio.gather(*tasks, return_exceptions=False)

    async def list_policies(self) -> List[str]:
        """
        List available policies from OPA

        Returns:
            List of policy paths
        """
        await self._ensure_session()

        url = f"{self.config.base_url}/v1/data"

        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    raise Exception(f"OPA returned status {response.status}")

                result = await response.json()
                policies = []

                if "result" in result and isinstance(result["result"], dict):
                    for key in result["result"].keys():
                        policies.append(key)

                return policies

        except Exception as e:
            self.logger.error(f"Failed to list policies: {e}")
            raise

    async def get_policy_info(self, policy_path: str) -> Dict[str, Any]:
        """
        Get information about a specific policy

        Args:
            policy_path: Path to the policy

        Returns:
            Policy information
        """
        await self._ensure_session()

        url = f"{self.config.base_url}/v1/data/{policy_path}"

        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    raise Exception(f"OPA returned status {response.status}")

                return await response.json()

        except Exception as e:
            self.logger.error(f"Failed to get policy info for {policy_path}: {e}")
            raise

    async def health_check(self) -> bool:
        """
        Check OPA health

        Returns:
            True if OPA is healthy
        """
        await self._ensure_session()

        url = f"{self.config.base_url}/health"

        try:
            async with self.session.get(url) as response:
                return response.status == 200

        except Exception as e:
            self.logger.error(f"OPA health check failed: {e}")
            return False

    def get_metrics(self) -> Dict[str, Any]:
        """
        Get client metrics

        Returns:
            Metrics dictionary
        """
        return self.metrics.copy()

    def reset_metrics(self):
        """Reset metrics"""
        self.metrics = {
            "evaluations_total": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "errors_total": 0,
            "avg_execution_time_ms": 0,
        }

    # Private methods

    async def _evaluate_with_retry(
        self,
        policy_path: str,
        input_data: Dict[str, Any],
    ) -> PolicyEvaluationResponse:
        """Evaluate policy with retry logic"""
        last_error = None

        for attempt in range(self.config.retry_attempts + 1):
            if attempt > 0:
                await asyncio.sleep(self.config.retry_delay * attempt)

            try:
                return await self._evaluate_policy_direct(policy_path, input_data)

            except Exception as e:
                last_error = e
                self.logger.warning(
                    f"Policy evaluation failed (attempt {attempt + 1}): {policy_path}",
                    extra={
                        "policy": policy_path,
                        "attempt": attempt + 1,
                        "error": str(e),
                    },
                )

        raise Exception(f"All retry attempts failed: {last_error}")

    async def _evaluate_policy_direct(
        self,
        policy_path: str,
        input_data: Dict[str, Any],
    ) -> PolicyEvaluationResponse:
        """Direct policy evaluation without retry"""
        await self._ensure_session()

        url = f"{self.config.base_url}/v1/data/{policy_path}"
        request_data = {"input": input_data}

        start_time = time.time()

        async with self.session.post(
            url,
            json=request_data,
            headers={"Content-Type": "application/json"},
        ) as response:
            execution_time = (time.time() - start_time) * 1000

            if response.status != 200:
                error_text = await response.text()
                raise Exception(f"OPA returned status {response.status}: {error_text}")

            result = await response.json()

            # Extract decision and reason
            decision = False
            reason = ""

            if "result" in result and isinstance(result["result"], dict):
                decision = result["result"].get("allow", False)

                # Extract reason if available
                decision_reasons = result["result"].get("decision_reason", [])
                if decision_reasons and len(decision_reasons) > 0:
                    reason = str(decision_reasons[0])

            return PolicyEvaluationResponse(
                decision=decision,
                reason=reason,
                result=result.get("result"),
                execution_time_ms=int(execution_time),
            )

    async def _evaluate_raw_policy(
        self,
        policy_content: str,
        input_data: Dict[str, Any],
    ) -> PolicyEvaluationResponse:
        """Evaluate raw Rego policy content"""
        # This would require OPA's ad-hoc evaluation endpoint
        # For now, we'll implement a basic version
        await self._ensure_session()

        url = f"{self.config.base_url}/v1/data"
        request_data = {
            "input": input_data,
            "policy": policy_content,
        }

        start_time = time.time()

        async with self.session.post(
            url,
            json=request_data,
            headers={"Content-Type": "application/json"},
        ) as response:
            execution_time = (time.time() - start_time) * 1000

            if response.status != 200:
                error_text = await response.text()
                raise Exception(f"OPA returned status {response.status}: {error_text}")

            result = await response.json()

            # Extract decision and reason
            decision = False
            reason = ""

            if "result" in result and isinstance(result["result"], dict):
                decision = result["result"].get("allow", False)

                # Extract reason if available
                decision_reasons = result["result"].get("decision_reason", [])
                if decision_reasons and len(decision_reasons) > 0:
                    reason = str(decision_reasons[0])

            return PolicyEvaluationResponse(
                decision=decision,
                reason=reason,
                result=result.get("result"),
                execution_time_ms=int(execution_time),
            )

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
                decision=cache_dict["decision"],
                reason=cache_dict["reason"],
                result=cache_dict["result"],
                execution_time_ms=cache_dict["execution_time_ms"],
                cached=True,
            )

        except Exception as e:
            self.logger.error(f"Failed to get cached decision: {e}")
            return None

    async def _cache_decision(self, cache_key: str, cache_value: DecisionCacheValue):
        """Cache policy decision in Redis"""
        if not self.redis:
            return

        try:
            cache_dict = asdict(cache_value)
            cache_dict["cached_at"] = cache_value.cached_at.isoformat()
            cache_dict["ttl"] = int(cache_value.ttl.total_seconds())

            await self.redis.setex(
                cache_key,
                int(cache_value.ttl.total_seconds()),
                json.dumps(cache_dict, default=str),
            )

        except Exception as e:
            self.logger.error(f"Failed to cache decision: {e}")

    def _update_avg_execution_time(self, execution_time: float):
        """Update average execution time metric"""
        if self.metrics["evaluations_total"] == 1:
            self.metrics["avg_execution_time_ms"] = execution_time
        else:
            current_avg = self.metrics["avg_execution_time_ms"]
            count = self.metrics["evaluations_total"]
            new_avg = ((current_avg * (count - 1)) + execution_time) / count
            self.metrics["avg_execution_time_ms"] = new_avg


class SyncOPAClient:
    """Synchronous wrapper for OPA client"""

    def __init__(
        self,
        config: Optional[OPAConfig] = None,
        redis_client: Optional[redis.Redis] = None,
    ):
        """
        Initialize sync OPA client

        Args:
            config: OPA configuration
            redis_client: Redis client for caching
        """
        self.config = config or OPAConfig()
        self.redis = redis_client
        self._loop = None

    def _get_loop(self):
        """Get or create event loop"""
        try:
            return asyncio.get_running_loop()
        except RuntimeError:
            if self._loop is None or self._loop.is_closed():
                self._loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self._loop)
            return self._loop

    def evaluate_policy(
        self,
        policy_path: str,
        input_data: Dict[str, Any],
        use_cache: Optional[bool] = None,
    ) -> PolicyEvaluationResponse:
        """Synchronous policy evaluation"""
        loop = self._get_loop()

        async def _evaluate():
            async with OPAClient(self.config, self.redis) as client:
                return await client.evaluate_policy(policy_path, input_data, use_cache)

        return loop.run_until_complete(_evaluate())

    def evaluate_data_policy(
        self,
        tenant_id: str,
        user_id: str,
        action: str,
        resource: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> PolicyEvaluationResponse:
        """Synchronous data policy evaluation"""
        loop = self._get_loop()

        async def _evaluate():
            async with OPAClient(self.config, self.redis) as client:
                return await client.evaluate_data_policy(
                    tenant_id, user_id, action, resource, data
                )

        return loop.run_until_complete(_evaluate())

    def evaluate_dlp_policy(
        self,
        content: str,
        user_context: Dict[str, Any],
        dlp_scanned: bool = False,
        detected_pii: Optional[List[Dict[str, Any]]] = None,
    ) -> PolicyEvaluationResponse:
        """Synchronous DLP policy evaluation"""
        loop = self._get_loop()

        async def _evaluate():
            async with OPAClient(self.config, self.redis) as client:
                return await client.evaluate_dlp_policy(
                    content, user_context, dlp_scanned, detected_pii
                )

        return loop.run_until_complete(_evaluate())

    def health_check(self) -> bool:
        """Synchronous health check"""
        loop = self._get_loop()

        async def _check():
            async with OPAClient(self.config, self.redis) as client:
                return await client.health_check()

        return loop.run_until_complete(_check())

    def get_metrics(self) -> Dict[str, Any]:
        """Get client metrics"""
        loop = self._get_loop()

        async def _get_metrics():
            async with OPAClient(self.config, self.redis) as client:
                return client.get_metrics()

        return loop.run_until_complete(_get_metrics())


# Factory functions


def create_opa_client(
    config: Optional[OPAConfig] = None,
    redis_client: Optional[redis.Redis] = None,
) -> OPAClient:
    """Create async OPA client"""
    settings = get_settings()

    if config is None:
        config = OPAConfig(
            base_url=settings.opa_url,
            timeout=settings.opa_timeout,
            cache_enabled=settings.opa_cache_enabled,
            cache_ttl=settings.opa_cache_ttl,
        )

    return OPAClient(config, redis_client)


def create_sync_opa_client(
    config: Optional[OPAConfig] = None,
    redis_client: Optional[redis.Redis] = None,
) -> SyncOPAClient:
    """Create sync OPA client"""
    settings = get_settings()

    if config is None:
        config = OPAConfig(
            base_url=settings.opa_url,
            timeout=settings.opa_timeout,
            cache_enabled=settings.opa_cache_enabled,
            cache_ttl=settings.opa_cache_ttl,
        )

    return SyncOPAClient(config, redis_client)
