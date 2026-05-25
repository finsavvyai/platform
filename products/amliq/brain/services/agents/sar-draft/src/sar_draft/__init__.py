"""SAR Draft Agent — AMLIQ Brain (M2 W6 skeleton).

Public surface:
- types: AlertInput, SarDraft, Citation, SearchResult, RetrievalAdapter,
  AuditEmitter, TemplateMeta
- template_registry: TemplateRegistry
- context_fill: render, RenderError, MissingVariableError
- draft_agent: DraftAgent, AUDIT_EVENT, AuditReason

This package establishes the Python pattern for the FinsavvyAI agent
runtime. See README.md + DESIGN.md.
"""

from sar_draft.context_fill import MissingVariableError, RenderError, render
from sar_draft.draft_agent import AUDIT_EVENT, AuditReason, DraftAgent
from sar_draft.http_runtime import draft_response, handle_draft_payload
from sar_draft.template_registry import TemplateRegistry, TemplateRegistryError
from sar_draft.types import (
    AlertInput,
    AuditEmitter,
    Citation,
    RetrievalAdapter,
    SarDraft,
    SearchResult,
    TemplateMeta,
)

__all__ = [
    "AUDIT_EVENT",
    "AlertInput",
    "AuditEmitter",
    "AuditReason",
    "Citation",
    "DraftAgent",
    "MissingVariableError",
    "RenderError",
    "RetrievalAdapter",
    "SarDraft",
    "SearchResult",
    "TemplateMeta",
    "TemplateRegistry",
    "TemplateRegistryError",
    "draft_response",
    "handle_draft_payload",
    "render",
]

__version__ = "0.0.1"
