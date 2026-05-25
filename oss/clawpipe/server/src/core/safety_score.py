#!/usr/bin/env python3
"""Safety scoring for autonomous agent actions."""

from typing import Any, Dict


ACTION_RISK = {
    "read": 5,
    "search": 8,
    "write": 20,
    "edit": 22,
    "execute": 28,
    "deploy": 35,
    "delete": 45,
    "payment": 50,
    "admin": 55,
}

SENSITIVITY_RISK = {
    "public": 0,
    "internal": 10,
    "confidential": 25,
    "restricted": 40,
}

BLAST_RADIUS_RISK = {
    "tiny": 3,
    "small": 8,
    "medium": 16,
    "large": 28,
    "global": 38,
}

AUTONOMY_RISK = {
    "manual": 0,
    "assisted": 8,
    "autonomous": 20,
    "fully_autonomous": 30,
}


def _float_in_range(value: Any, default: float = 0.5) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return default
    return max(0.0, min(1.0, numeric))


def compute_safety_score(
    action: str, resource: str = "", context: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Compute 0-100 safety score (higher is safer)."""
    ctx = context or {}

    action_key = (action or "read").strip().lower()
    sensitivity_key = str(ctx.get("data_sensitivity", "internal")).strip().lower()
    blast_key = str(ctx.get("blast_radius", "small")).strip().lower()
    autonomy_key = str(ctx.get("autonomy_level", "assisted")).strip().lower()
    actor_trust = _float_in_range(ctx.get("actor_trust", 0.5), default=0.5)
    model_confidence = _float_in_range(ctx.get("model_confidence", 0.7), default=0.7)

    action_risk = ACTION_RISK.get(action_key, 15)
    sensitivity_risk = SENSITIVITY_RISK.get(sensitivity_key, 15)
    blast_risk = BLAST_RADIUS_RISK.get(blast_key, 10)
    autonomy_risk = AUTONOMY_RISK.get(autonomy_key, 8)

    trust_risk = int(round((1.0 - actor_trust) * 25))
    confidence_risk = int(round((1.0 - model_confidence) * 15))

    total_risk = min(
        100,
        action_risk
        + sensitivity_risk
        + blast_risk
        + autonomy_risk
        + trust_risk
        + confidence_risk,
    )
    safety_score = max(0, 100 - total_risk)

    if safety_score >= 80:
        level = "low_risk"
    elif safety_score >= 60:
        level = "moderate_risk"
    elif safety_score >= 40:
        level = "high_risk"
    else:
        level = "critical_risk"

    requires_human_approval = safety_score < 65

    return {
        "action": action_key,
        "resource": resource,
        "safety_score": safety_score,
        "risk_score": total_risk,
        "risk_level": level,
        "requires_human_approval": requires_human_approval,
        "factors": {
            "action_risk": action_risk,
            "sensitivity_risk": sensitivity_risk,
            "blast_radius_risk": blast_risk,
            "autonomy_risk": autonomy_risk,
            "trust_risk": trust_risk,
            "confidence_risk": confidence_risk,
        },
    }
