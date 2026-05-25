"""Provider-agnostic governance gate for all chat requests."""

import json
import logging
from typing import Any, Dict, List, Optional, Tuple

from aiohttp import web

from src.core.policy_engine import compile_and_evaluate
from src.core.safety_score import compute_safety_score

logger = logging.getLogger("finsavvyai.governance")


def evaluate_request_governance(
    data: Dict[str, Any],
    messages: List[Dict],
    request_id: str,
    provider_name: str = "",
) -> Tuple[Optional[web.Response], Dict[str, Any]]:
    """Evaluate governance for any provider request.

    Returns (blocked_response, report) tuple.
    blocked_response is None if request is allowed.
    """
    governance = _extract_governance(data)
    action = infer_action(data, messages)
    resource = str(data.get("resource", "repo/*")).strip() or "repo/*"

    compiled, decision = compile_and_evaluate(
        governance, action=action, resource=resource,
    )

    context = _build_context(governance)
    safety = compute_safety_score(
        action=action, resource=resource, context=context,
    )

    strict = {"deploy", "delete", "payment", "admin", "execute"}
    approval_required = decision.requires_approval or (
        action in strict and safety["requires_human_approval"]
    )
    status = _compute_status(decision.allowed, approval_required)

    report = {
        "action": action,
        "resource": resource,
        "provider": provider_name,
        "execution_status": status,
        "executable_now": status == "approved",
        "approval_required": status == "approval_required",
        "policy": {
            "decision": decision.to_dict(),
            "default_effect": compiled.default_effect,
            "rules_count": len(compiled.rules),
            "compile_errors": compiled.errors,
        },
        "safety": safety,
    }

    if status == "denied":
        return (
            web.json_response(
                {
                    "error": "Governance denied",
                    "message": f"Action denied by policy for {provider_name or 'provider'}",
                    "request_id": request_id,
                    "governance": report,
                },
                status=403,
            ),
            report,
        )
    if status == "approval_required":
        return (
            web.json_response(
                {
                    "error": "Approval required",
                    "message": f"Action requires human approval for {provider_name or 'provider'}",
                    "request_id": request_id,
                    "governance": report,
                },
                status=202,
            ),
            report,
        )
    return None, report


def _extract_governance(data: Dict) -> Dict:
    """Extract governance config from request data."""
    governance = data.get("governance", {})
    if not isinstance(governance, dict):
        governance = {}
    governance = dict(governance)
    for key in ("policy_text", "policy_rules", "policy", "default_effect"):
        if key in data and key not in governance:
            governance[key] = data[key]
    if not any(k in governance for k in ("policy_text", "policy_rules", "policy")):
        governance.setdefault("default_effect", "allow")
    return governance


def _build_context(governance: Dict) -> Dict:
    """Build safety-score context with defaults."""
    context = governance.get("context", {})
    if not isinstance(context, dict):
        context = {}
    context = dict(context)
    context.setdefault("data_sensitivity", "internal")
    context.setdefault("blast_radius", "small")
    context.setdefault("autonomy_level", "assisted")
    context.setdefault("actor_trust", 0.75)
    context.setdefault("model_confidence", 0.8)
    return context


def _compute_status(allowed: bool, approval_required: bool) -> str:
    """Determine final governance status from policy decision flags."""
    if not allowed:
        return "denied"
    if approval_required:
        return "approval_required"
    return "approved"


def infer_action(data: Dict, messages: List[Dict]) -> str:
    """Infer action type from explicit fields or message text."""
    explicit = (
        data.get("governance_action")
        or data.get("action")
        or data.get("task_type")
        or ""
    )
    explicit = str(explicit).strip().lower()
    valid = {
        "read", "search", "write", "edit", "execute",
        "deploy", "delete", "payment", "admin",
    }
    if explicit in valid:
        return explicit
    return _infer_from_text(messages)


def _infer_from_text(messages: List[Dict]) -> str:
    """Infer action from user message content."""
    text = _extract_user_text(messages)
    checks = [
        (("deploy", "release", "production rollout"), "deploy"),
        (("delete", "drop table", "destroy", "rm -rf"), "delete"),
        (("sudo ", "shell command", "run command", "execute script"), "execute"),
        (("create", "write", "refactor", "fix", "implement", "modify"), "write"),
    ]
    for keywords, action in checks:
        if any(k in text for k in keywords):
            return action
    return "read"


def _extract_user_text(messages: List[Dict]) -> str:
    """Extract all user-role text from chat messages."""
    parts: list[str] = []
    for msg in messages:
        if msg.get("role") != "user":
            continue
        content = msg.get("content", "")
        if isinstance(content, str):
            parts.append(content)
        else:
            try:
                parts.append(json.dumps(content))
            except TypeError:
                parts.append(str(content))
    return "\n".join(parts).lower()
