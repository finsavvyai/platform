"""Structured LLM outputs for the DLP service.

Thin wrapper over the `instructor` library that lets DLP policy and
classification components request validated Pydantic models from LLM
providers. All functionality is opt-in via the
``STRUCTURED_OUTPUTS_ENABLED`` environment variable.
"""

from .client import (
    StructuredLLMClient,
    get_structured_client,
    is_structured_enabled,
)
from .extractors import (
    classify_sensitivity,
    evaluate_policy,
    plan_masking,
)
from .models import (
    ClassificationResult,
    DlpSensitivity,
    MaskingOperation,
    MaskingPlan,
    PolicyAction,
    PolicyDecision,
)

__all__ = [
    "ClassificationResult",
    "DlpSensitivity",
    "MaskingOperation",
    "MaskingPlan",
    "PolicyAction",
    "PolicyDecision",
    "StructuredLLMClient",
    "get_structured_client",
    "is_structured_enabled",
    "classify_sensitivity",
    "evaluate_policy",
    "plan_masking",
]
