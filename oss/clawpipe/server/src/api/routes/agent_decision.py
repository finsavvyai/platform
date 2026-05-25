"""Agent governance decision endpoint."""

import json

from aiohttp import web

from src.core.logger import get_logger
from src.core.policy_engine import compile_and_evaluate
from src.core.safety_score import compute_safety_score

logger = get_logger()


async def handle_agent_decision(request):
    """HTTP route wrapper."""
    return await handle_agent_decision_for_gateway(request.app.get("gateway"), request)


async def handle_agent_decision_for_gateway(_gateway, request):
    """POST /v1/agent/decision - compile policy, score risk, return decision."""
    request_id = request.get("request_id", "unknown")
    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            return web.json_response(
                {"error": "Invalid request", "message": "JSON body must be an object"},
                status=400,
            )
        action = str(payload.get("action", "")).strip().lower()
        resource = str(payload.get("resource", "*")).strip() or "*"
        context = payload.get("context", {})
        if not action:
            return web.json_response(
                {"error": "Invalid request", "message": "Missing required field 'action'"},
                status=400,
            )
        if not isinstance(context, dict):
            return web.json_response(
                {"error": "Invalid request", "message": "'context' must be an object"},
                status=400,
            )

        compiled, decision = compile_and_evaluate(payload, action=action, resource=resource)
        safety = compute_safety_score(action=action, resource=resource, context=context)
        approval_required = decision.requires_approval or safety["requires_human_approval"]
        status = (
            "approved"
            if decision.allowed and not approval_required
            else "approval_required"
            if decision.allowed
            else "denied"
        )
        return web.json_response(
            {
                "request_id": request_id,
                "action": action,
                "resource": resource,
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
            },
            status=200,
        )
    except json.JSONDecodeError:
        return web.json_response(
            {"error": "Invalid JSON", "message": "Request body must be valid JSON"},
            status=400,
        )
    except Exception as exc:
        logger.error(
            "Agent decision handler failed",
            request_id=request_id,
            error=str(exc),
            error_type=type(exc).__name__,
        )
        return web.json_response(
            {
                "error": "Internal server error",
                "message": "Failed to evaluate policy and safety score",
                "request_id": request_id,
            },
            status=500,
        )
