#!/usr/bin/env python3
"""
Policy Engine Data Models

Dataclasses and constants for the policy engine.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


VALID_EFFECTS = {"allow", "deny", "require_approval"}


@dataclass
class PolicyRule:
    """Single compiled rule."""

    effect: str
    action: str
    resource: str
    reason: str = ""
    rule_id: str = ""


@dataclass
class CompiledPolicy:
    """Compiled policy bundle."""

    rules: List[PolicyRule] = field(default_factory=list)
    default_effect: str = "deny"
    errors: List[str] = field(default_factory=list)


@dataclass
class PolicyDecision:
    """Policy evaluation result."""

    allowed: bool
    requires_approval: bool
    effect: str
    matched_rule_id: Optional[str] = None
    reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "allowed": self.allowed,
            "requires_approval": self.requires_approval,
            "effect": self.effect,
            "matched_rule_id": self.matched_rule_id,
            "reason": self.reason,
        }
