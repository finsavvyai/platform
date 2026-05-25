"""Validation and discovery helpers for chat requests."""

from aiohttp import web


def validate_chat_payload(data):
    """Validate base payload shape and return (messages, model, error_response)."""
    if not isinstance(data, dict):
        return (
            None,
            None,
            web.json_response(
                {"error": "Invalid request", "message": "Request body must be a JSON object"},
                status=400,
            ),
        )

    if "messages" not in data:
        return (
            None,
            None,
            web.json_response(
                {"error": "Invalid request", "message": "Missing 'messages' field"},
                status=400,
            ),
        )

    messages = data.get("messages", [])
    if not isinstance(messages, list):
        return (
            None,
            None,
            web.json_response(
                {"error": "Invalid request", "message": "'messages' must be an array"},
                status=400,
            ),
        )
    if not messages:
        return (
            None,
            None,
            web.json_response(
                {"error": "Invalid request", "message": "'messages' array cannot be empty"},
                status=400,
            ),
        )

    for idx, msg in enumerate(messages):
        if not isinstance(msg, dict):
            return (
                None,
                None,
                web.json_response(
                    {
                        "error": "Invalid request",
                        "message": f"Message at index {idx} must be an object",
                    },
                    status=400,
                ),
            )
        if "role" not in msg or "content" not in msg:
            return (
                None,
                None,
                web.json_response(
                    {
                        "error": "Invalid request",
                        "message": f"Message at index {idx} must have 'role' and 'content' fields",
                    },
                    status=400,
                ),
            )

    model = data.get("model", None)
    if model and not isinstance(model, str):
        return (
            None,
            None,
            web.json_response(
                {"error": "Invalid request", "message": "'model' must be a string"},
                status=400,
            ),
        )
    if model and len(model) > 100:
        return (
            None,
            None,
            web.json_response(
                {"error": "Invalid request", "message": "'model' name too long"},
                status=400,
            ),
        )

    return messages, model, None


async def find_preferred_worker_url(gateway, model):
    """Return worker URL for a model if cluster has that model online."""
    if not model or not gateway.session:
        return None

    try:
        async with gateway.session.get(f"{gateway.master_url}/cluster/nodes") as resp:
            if resp.status != 200:
                return None
            nodes_resp = await resp.json()
    except Exception:
        return None

    for node in nodes_resp.get("nodes", []):
        if model in node.get("models", []):
            return f"http://{node['host']}:{node['port']}"
    return None
