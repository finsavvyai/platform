"""
NeMo Guardrails integration for the SDLC RAG service.

Provides a pluggable safety layer on top of every LLM call:

- Topical rails: keep responses on SDLC / secure-AI topics.
- Safety rails: block harmful content and PII leakage in outputs.
- Moderation rails: screen input and output for toxicity / jailbreaks.

The whole layer is opt-in via the ``GUARDRAILS_ENABLED`` env var and is a
complete no-op when disabled, so merging this module has zero runtime cost.

Public surface
==============

- :class:`GuardrailsEngine` — low-level wrapper around ``nemoguardrails``.
- :class:`GuardrailsService` — high-level, LLM-facing service used by the
  RAG pipeline.
- :class:`GuardrailResult` — outcome of an input or output check.
- :class:`GuardrailViolation` — single rail failure with reason + severity.
- :class:`TenantGuardrailConfig` — per-tenant override descriptor.
"""

from .engine import GuardrailsEngine
from .service import GuardrailsService
from .types import (
    GuardrailResult,
    GuardrailViolation,
    GuardrailSeverity,
    GuardrailAction,
    TenantGuardrailConfig,
)

__all__ = [
    "GuardrailsEngine",
    "GuardrailsService",
    "GuardrailResult",
    "GuardrailViolation",
    "GuardrailSeverity",
    "GuardrailAction",
    "TenantGuardrailConfig",
]
