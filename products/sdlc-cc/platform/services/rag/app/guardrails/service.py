"""
High-level guardrails service used by the RAG pipeline.

:class:`GuardrailsService` wraps the full LLM call path with:

1. ``pre_check`` of the user message (input rails).
2. The actual LLM completion (delegated to a caller-supplied async fn).
3. ``post_check`` of the generated response (output rails).

Violations are forwarded to Langfuse when available and surfaced via
in-process Prometheus counters / gauges. On ``GuardrailsAction.BLOCK``
the service raises :class:`GuardrailBlockedError` so upstream handlers
can return a clean HTTP 4xx.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from .engine import GuardrailsEngine
from .types import (
    GuardrailAction,
    GuardrailResult,
    GuardrailSeverity,
    TenantGuardrailConfig,
)

logger = logging.getLogger(__name__)


LLMCaller = Callable[[str, Optional[List[Any]]], Awaitable[str]]


class GuardrailBlockedError(RuntimeError):
    """Raised when a rail refuses the request or the response."""

    def __init__(self, result: GuardrailResult, *, stage: str) -> None:
        reasons = ", ".join(v.reason for v in result.violations) or "blocked"
        super().__init__(f"guardrails {stage} blocked: {reasons}")
        self.result = result
        self.stage = stage


class GuardrailsService:
    """High-level async wrapper around :class:`GuardrailsEngine`."""

    def __init__(
        self,
        engine: Optional[GuardrailsEngine] = None,
        *,
        tenant_configs: Optional[Dict[str, TenantGuardrailConfig]] = None,
        langfuse_logger: Optional[Callable[..., None]] = None,
    ) -> None:
        self.engine = engine or GuardrailsEngine()
        self._tenant_configs = dict(tenant_configs or {})
        self._langfuse_logger = langfuse_logger or _default_langfuse_logger()
        self._violation_counts: Dict[Tuple[str, str], int] = defaultdict(int)

    @property
    def enabled(self) -> bool:
        return self.engine.enabled

    def set_tenant_config(self, cfg: TenantGuardrailConfig) -> None:
        self._tenant_configs[cfg.tenant_id] = cfg

    def get_tenant_config(self, tenant_id: Optional[str]) -> Optional[TenantGuardrailConfig]:
        if not tenant_id:
            return None
        return self._tenant_configs.get(tenant_id)

    async def pre_check(
        self,
        user_message: str,
        *,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> GuardrailResult:
        result = await self.engine.check_input(
            user_message,
            tenant_id=tenant_id,
            tenant_config=self.get_tenant_config(tenant_id),
        )
        self._record(result, tenant_id=tenant_id, user_id=user_id, stage="input", payload=user_message)
        if result.action is GuardrailAction.BLOCK:
            raise GuardrailBlockedError(result, stage="input")
        return result

    async def post_check(
        self,
        llm_response: str,
        sources: Optional[List[Any]] = None,
        *,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> GuardrailResult:
        result = await self.engine.check_output(
            llm_response,
            sources=sources,
            tenant_id=tenant_id,
            tenant_config=self.get_tenant_config(tenant_id),
        )
        self._record(result, tenant_id=tenant_id, user_id=user_id, stage="output", payload=llm_response)
        if result.action is GuardrailAction.BLOCK:
            raise GuardrailBlockedError(result, stage="output")
        return result

    async def guarded_complete(
        self,
        user_message: str,
        llm_call: LLMCaller,
        *,
        sources: Optional[List[Any]] = None,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Tuple[str, GuardrailResult]:
        """Run ``llm_call`` between input and output rails.

        Returns the (possibly rewritten) final response along with the
        merged :class:`GuardrailResult` covering both checks.
        """
        pre = await self.pre_check(user_message, tenant_id=tenant_id, user_id=user_id)
        message = pre.rewritten_content or user_message
        raw_response = await llm_call(message, sources)
        post = await self.post_check(
            raw_response,
            sources=sources,
            tenant_id=tenant_id,
            user_id=user_id,
        )
        final = post.rewritten_content or raw_response
        return final, pre.merge(post)

    # ------------------------------------------------------------------
    # Observability
    # ------------------------------------------------------------------

    def violation_counts(self) -> Dict[Tuple[str, str], int]:
        """Return {(tenant_id, rail_name): count} snapshot for metrics."""
        return dict(self._violation_counts)

    def _record(
        self,
        result: GuardrailResult,
        *,
        tenant_id: Optional[str],
        user_id: Optional[str],
        stage: str,
        payload: str,
    ) -> None:
        tenant_key = tenant_id or "default"
        for violation in result.violations:
            self._violation_counts[(tenant_key, violation.rail_name)] += 1
            if violation.severity in (GuardrailSeverity.HIGH, GuardrailSeverity.CRITICAL):
                logger.warning(
                    "guardrail.%s tenant=%s rail=%s severity=%s reason=%s",
                    stage,
                    tenant_key,
                    violation.rail_name,
                    violation.severity.value,
                    violation.reason,
                )
        if result.violations or result.action is not GuardrailAction.ALLOW:
            try:
                self._langfuse_logger(
                    name=f"rag.guardrails.{stage}",
                    input=payload,
                    output=result.rewritten_content,
                    metadata={
                        "action": result.action.value,
                        "violations": [v.to_dict() for v in result.violations],
                        "latency_ms": result.latency_ms,
                        "engine_version": result.engine_version,
                    },
                    user_id=user_id,
                    tenant_id=tenant_id,
                    model="guardrails",
                )
            except Exception as exc:  # pragma: no cover - defensive
                logger.debug("Langfuse guardrails log skipped: %s", exc)


def _default_langfuse_logger() -> Callable[..., None]:
    try:
        from app.observability.langfuse_client import trace_llm_call  # type: ignore
        return trace_llm_call
    except Exception:
        def _noop(*_args: Any, **_kwargs: Any) -> None:
            return None
        return _noop
