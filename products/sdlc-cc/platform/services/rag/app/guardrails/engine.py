"""
Low-level wrapper around NVIDIA NeMo Guardrails.

Owns the ``LLMRails`` lifecycle and converts native ``nemoguardrails``
responses into framework-agnostic :class:`GuardrailResult` objects.
``nemoguardrails`` is imported lazily so the module stays importable
even when the package is not installed.
"""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from .types import (
    GuardrailAction,
    GuardrailResult,
    GuardrailSeverity,
    GuardrailViolation,
    TenantGuardrailConfig,
)

logger = logging.getLogger(__name__)

_DEFAULT_CONFIG_DIR = Path(__file__).parent / "config"
_ENV_FLAG = "GUARDRAILS_ENABLED"
_TRUTHY = {"1", "true", "yes", "on"}
_REFUSAL_HINTS = ("i'm sorry, i can't", "i cannot help", "i can't help", "refuse")


def _is_enabled() -> bool:
    return os.getenv(_ENV_FLAG, "false").strip().lower() in _TRUTHY


class GuardrailsEngine:
    """Thin async wrapper around ``nemoguardrails.LLMRails``."""

    def __init__(
        self,
        config_dir: Optional[Path] = None,
        default_tenant_config: Optional[TenantGuardrailConfig] = None,
    ) -> None:
        self.config_dir = Path(config_dir or _DEFAULT_CONFIG_DIR)
        self.default_tenant_config = default_tenant_config
        self._enabled = _is_enabled()
        self._rails_cache: Dict[str, Any] = {}
        self._version: Optional[str] = None
        if not self._enabled:
            logger.info("Guardrails disabled (set %s=1 to enable)", _ENV_FLAG)

    @property
    def enabled(self) -> bool:
        return self._enabled

    async def check_input(
        self,
        user_message: str,
        tenant_id: Optional[str] = None,
        tenant_config: Optional[TenantGuardrailConfig] = None,
    ) -> GuardrailResult:
        """Validate a user message before it reaches the LLM."""
        if not self._enabled or not user_message:
            return GuardrailResult(passed=True, action=GuardrailAction.ALLOW)
        msgs = [{"role": "user", "content": user_message}]
        return await self._run(msgs, ["input"], user_message, tenant_id, tenant_config)

    async def check_output(
        self,
        llm_response: str,
        sources: Optional[List[Any]] = None,
        tenant_id: Optional[str] = None,
        tenant_config: Optional[TenantGuardrailConfig] = None,
    ) -> GuardrailResult:
        """Validate an LLM response before it is returned to the caller."""
        if not self._enabled or not llm_response:
            return GuardrailResult(passed=True, action=GuardrailAction.ALLOW)
        msgs = [
            {"role": "assistant", "content": llm_response},
            {"role": "context", "content": {"sources": sources or []}},
        ]
        return await self._run(msgs, ["output"], llm_response, tenant_id, tenant_config)

    async def _run(
        self,
        messages: List[Dict[str, Any]],
        rails: List[str],
        source: str,
        tenant_id: Optional[str],
        tenant_config: Optional[TenantGuardrailConfig],
    ) -> GuardrailResult:
        start = time.perf_counter()
        rails_obj = self._get_rails(tenant_id, tenant_config)
        if rails_obj is None:
            return GuardrailResult(passed=True, action=GuardrailAction.ALLOW)
        try:
            raw = await rails_obj.generate_async(messages=messages, options={"rails": rails})
            return self._convert(raw, start, source=source)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Guardrails check failed (rails=%s): %s", rails, exc)
            return self._fail_open(exc, start)

    def _get_rails(
        self,
        tenant_id: Optional[str],
        tenant_config: Optional[TenantGuardrailConfig],
    ) -> Any:
        cfg = tenant_config or self.default_tenant_config
        cache_key = f"{tenant_id or 'default'}:{cfg.config_path if cfg else ''}"
        if cache_key in self._rails_cache:
            return self._rails_cache[cache_key]
        try:
            from nemoguardrails import LLMRails, RailsConfig  # type: ignore
        except Exception as exc:
            logger.warning("nemoguardrails not installed: %s", exc)
            self._enabled = False
            return None
        config_path = Path(cfg.config_path) if cfg and cfg.config_path else self.config_dir
        try:
            rails_config = RailsConfig.from_path(str(config_path))
            rails = LLMRails(rails_config)
            self._version = getattr(rails_config, "version", None) or "unknown"
            self._rails_cache[cache_key] = rails
            logger.info("Loaded guardrails config for %s from %s", cache_key, config_path)
            return rails
        except Exception as exc:
            logger.error("Failed to load guardrails config at %s: %s", config_path, exc)
            return None

    def _convert(self, raw: Any, start: float, *, source: str) -> GuardrailResult:
        latency_ms = (time.perf_counter() - start) * 1000.0
        content = _extract_content(raw)
        rewritten = content if (content and content != source) else None
        violations = _to_violations(_extract_violations(raw))
        if _is_refusal(raw, content):
            action = GuardrailAction.BLOCK
        elif rewritten is not None:
            action = GuardrailAction.REWRITE
        elif violations:
            action = GuardrailAction.WARN
        else:
            action = GuardrailAction.ALLOW
        return GuardrailResult(
            passed=action is not GuardrailAction.BLOCK,
            action=action,
            violations=violations,
            rewritten_content=rewritten,
            latency_ms=latency_ms,
            engine_version=self._version,
        )

    def _fail_open(self, exc: Exception, start: float) -> GuardrailResult:
        return GuardrailResult(
            passed=True,
            action=GuardrailAction.WARN,
            violations=[GuardrailViolation("engine", f"engine_error: {exc}", GuardrailSeverity.LOW)],
            latency_ms=(time.perf_counter() - start) * 1000.0,
            engine_version=self._version,
        )


def _extract_content(raw: Any) -> Optional[str]:
    return raw.get("content") if isinstance(raw, dict) else getattr(raw, "content", None)


def _extract_violations(raw: Any) -> list:
    src = raw.get("violations") if isinstance(raw, dict) else getattr(raw, "violations", None)
    return list(src or [])


def _to_violations(items: list) -> List[GuardrailViolation]:
    return [
        GuardrailViolation(
            rail_name=i.get("rail", "unknown"),
            reason=i.get("reason", "violation"),
            severity=GuardrailSeverity(i.get("severity", "medium")),
            metadata={k: v for k, v in i.items() if k not in {"rail", "reason", "severity"}},
        )
        for i in items
    ]


def _is_refusal(raw: Any, content: Optional[str]) -> bool:
    if isinstance(raw, dict) and raw.get("refused"):
        return True
    if not content:
        return False
    lowered = content.lower()
    return any(hint in lowered for hint in _REFUSAL_HINTS)
