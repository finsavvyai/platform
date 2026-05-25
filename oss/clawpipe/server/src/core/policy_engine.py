#!/usr/bin/env python3
"""Policy compiler and evaluator for agent actions.

Models live in policy_models.py.
"""

import re
from fnmatch import fnmatch
from typing import Any, Dict, List, Tuple

from src.core.policy_models import (  # noqa: F401
    VALID_EFFECTS,
    CompiledPolicy,
    PolicyDecision,
    PolicyRule,
)

_LINE_RE = re.compile(
    r"^\s*(allow|deny|require[_\-\s]?approval)\s+([A-Za-z0-9_\-\*]+)\s+(.+?)\s*$",
    re.IGNORECASE,
)


def _normalize_effect(value: str) -> str:
    effect = value.strip().lower().replace("-", "_").replace(" ", "_")
    if effect == "requireapproval":
        effect = "require_approval"
    return effect


def compile_policy_text(policy_text: str, default_effect: str = "deny") -> CompiledPolicy:
    """Compile policy rules from plain-text lines."""
    compiled = CompiledPolicy(default_effect=_normalize_effect(default_effect))
    if compiled.default_effect not in VALID_EFFECTS:
        compiled.default_effect = "deny"
        compiled.errors.append("Invalid default_effect provided; fallback to 'deny'")
    for idx, raw_line in enumerate((policy_text or "").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        match = _LINE_RE.match(line)
        if not match:
            compiled.errors.append(f"Line {idx}: invalid rule syntax '{raw_line.strip()}'")
            continue
        effect, action, resource = match.groups()
        normalized = _normalize_effect(effect)
        if normalized not in VALID_EFFECTS:
            compiled.errors.append(f"Line {idx}: invalid effect '{effect}'")
            continue
        compiled.rules.append(PolicyRule(
            effect=normalized, action=action.strip().lower(),
            resource=resource.strip(), rule_id=f"rule-{idx}", reason=f"Matched line {idx}"))
    return compiled


def compile_policy_rules(rules: List[Dict[str, Any]], default_effect: str = "deny") -> CompiledPolicy:
    """Compile policy from structured dict rules."""
    compiled = CompiledPolicy(default_effect=_normalize_effect(default_effect))
    if compiled.default_effect not in VALID_EFFECTS:
        compiled.default_effect = "deny"
        compiled.errors.append("Invalid default_effect provided; fallback to 'deny'")
    for idx, rule in enumerate(rules or [], start=1):
        if not isinstance(rule, dict):
            compiled.errors.append(f"Rule {idx}: rule must be an object")
            continue
        effect = _normalize_effect(str(rule.get("effect", "")))
        action = str(rule.get("action", "*")).strip().lower()
        resource = str(rule.get("resource", "*")).strip()
        reason = str(rule.get("reason", "")).strip()
        if effect not in VALID_EFFECTS:
            compiled.errors.append(f"Rule {idx}: invalid effect '{effect}'")
            continue
        compiled.rules.append(PolicyRule(
            effect=effect, action=action, resource=resource,
            reason=reason or f"Matched rule {idx}", rule_id=str(rule.get("id", f"rule-{idx}"))))
    return compiled


def compile_policy(payload: Dict[str, Any]) -> CompiledPolicy:
    """Compile policy from API payload."""
    if not isinstance(payload, dict):
        return CompiledPolicy(errors=["Payload must be an object"])
    default_effect = str(payload.get("default_effect", "deny"))
    if "policy_rules" in payload:
        return compile_policy_rules(payload.get("policy_rules"), default_effect)
    if "policy_text" in payload:
        return compile_policy_text(str(payload.get("policy_text", "")), default_effect)
    if "policy" in payload and isinstance(payload["policy"], dict):
        obj = payload["policy"]
        if "rules" in obj:
            return compile_policy_rules(obj.get("rules", []), str(obj.get("default_effect", default_effect)))
        if "text" in obj:
            return compile_policy_text(str(obj.get("text", "")), str(obj.get("default_effect", default_effect)))
    return CompiledPolicy(default_effect=_normalize_effect(default_effect))


def _rule_matches(rule: PolicyRule, action: str, resource: str) -> bool:
    if rule.action not in ("*", action.lower()):
        return False
    return fnmatch(resource, rule.resource)


def evaluate_policy(compiled_policy: CompiledPolicy, action: str, resource: str) -> PolicyDecision:
    """Evaluate action/resource against compiled rules."""
    a = (action or "").strip().lower() or "*"
    r = (resource or "").strip() or "*"
    for rule in compiled_policy.rules:
        if _rule_matches(rule, a, r):
            if rule.effect == "allow":
                return PolicyDecision(True, False, "allow", rule.rule_id, rule.reason or "Allowed by policy")
            if rule.effect == "require_approval":
                return PolicyDecision(True, True, "require_approval", rule.rule_id, rule.reason or "Approval required")
            return PolicyDecision(False, False, rule.effect, rule.rule_id, rule.reason or "Denied by policy")
    fb = compiled_policy.default_effect
    if fb == "allow":
        return PolicyDecision(True, False, "allow", reason="Allowed by default policy")
    if fb == "require_approval":
        return PolicyDecision(True, True, "require_approval", reason="Approval required by default policy")
    return PolicyDecision(False, False, "deny", reason="Denied by default policy")


def compile_and_evaluate(payload: Dict[str, Any], action: str, resource: str) -> Tuple[CompiledPolicy, PolicyDecision]:
    """Compile policy and evaluate requested action."""
    compiled = compile_policy(payload or {})
    return compiled, evaluate_policy(compiled, action, resource)
