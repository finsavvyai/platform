"""
Dataclasses and enums shared across the guardrails layer.

Kept dependency-free so they can be imported from anywhere (tests,
metrics exporters, observability glue) without pulling in
``nemoguardrails``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class GuardrailSeverity(str, Enum):
    """Severity of a single rail violation."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class GuardrailAction(str, Enum):
    """What the engine did when a violation was detected."""

    ALLOW = "allow"        # passed all rails
    WARN = "warn"          # logged but pass-through
    REWRITE = "rewrite"    # content was modified by the rail
    BLOCK = "block"        # request/response refused


@dataclass
class GuardrailViolation:
    """Single rail failure."""

    rail_name: str
    reason: str
    severity: GuardrailSeverity = GuardrailSeverity.MEDIUM
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rail_name": self.rail_name,
            "reason": self.reason,
            "severity": self.severity.value,
            "metadata": dict(self.metadata),
        }


@dataclass
class GuardrailResult:
    """
    Outcome of :meth:`GuardrailsEngine.check_input` /
    :meth:`GuardrailsEngine.check_output`.

    ``passed`` is ``True`` when *no blocking* violation was raised.
    ``rewritten_content`` holds the sanitized text when a rail rewrote
    the input/output (e.g. PII masking).
    """

    passed: bool
    action: GuardrailAction = GuardrailAction.ALLOW
    violations: List[GuardrailViolation] = field(default_factory=list)
    rewritten_content: Optional[str] = None
    latency_ms: float = 0.0
    engine_version: Optional[str] = None

    @property
    def blocked(self) -> bool:
        return self.action is GuardrailAction.BLOCK

    @property
    def rewritten(self) -> bool:
        return self.rewritten_content is not None

    def merge(self, other: "GuardrailResult") -> "GuardrailResult":
        """Combine two results (e.g. input check + output check)."""
        return GuardrailResult(
            passed=self.passed and other.passed,
            action=_strongest_action(self.action, other.action),
            violations=[*self.violations, *other.violations],
            rewritten_content=other.rewritten_content or self.rewritten_content,
            latency_ms=self.latency_ms + other.latency_ms,
            engine_version=self.engine_version or other.engine_version,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "action": self.action.value,
            "violations": [v.to_dict() for v in self.violations],
            "rewritten_content": self.rewritten_content,
            "latency_ms": self.latency_ms,
            "engine_version": self.engine_version,
        }


@dataclass
class TenantGuardrailConfig:
    """
    Per-tenant override for the default guardrails config.

    Tenants can disable specific rails, tighten severity thresholds, or
    point at a tenant-scoped Colang bundle stored on disk (e.g.
    ``/etc/sdlc/guardrails/tenant-<id>``).
    """

    tenant_id: str
    enabled: bool = True
    config_path: Optional[str] = None
    disabled_rails: List[str] = field(default_factory=list)
    min_block_severity: GuardrailSeverity = GuardrailSeverity.HIGH
    extra_instructions: Optional[str] = None

    def is_rail_enabled(self, rail_name: str) -> bool:
        return self.enabled and rail_name not in self.disabled_rails


_ACTION_RANK = {
    GuardrailAction.ALLOW: 0,
    GuardrailAction.WARN: 1,
    GuardrailAction.REWRITE: 2,
    GuardrailAction.BLOCK: 3,
}


def _strongest_action(a: GuardrailAction, b: GuardrailAction) -> GuardrailAction:
    return a if _ACTION_RANK[a] >= _ACTION_RANK[b] else b
