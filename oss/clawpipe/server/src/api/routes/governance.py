"""OpenHands governance helpers used by chat routing.

Delegates to the provider-agnostic governance_gate module.
Kept for backward compatibility.
"""

from src.api.routes.governance_gate import (
    _extract_user_text as extract_user_text,
    evaluate_request_governance,
    infer_action,
)


def infer_openhands_action(data, messages):
    """Infer action type from explicit fields or message text.

    Delegates to the generic infer_action.
    """
    return infer_action(data, messages)


def evaluate_openhands_governance(data, messages, request_id):
    """Run policy and safety checks for OpenHands requests.

    Delegates to the generic governance gate.
    """
    return evaluate_request_governance(
        data=data,
        messages=messages,
        request_id=request_id,
        provider_name="openhands",
    )
