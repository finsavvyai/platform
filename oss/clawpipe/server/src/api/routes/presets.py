"""API routes for role presets."""

from aiohttp import web

from src.core.logger import get_logger
from src.presets import get_preset, list_presets

logger = get_logger()


async def handle_list_presets(request: web.Request) -> web.Response:
    """GET /v1/presets — list all presets, optional ?category= filter."""
    category = request.rel_url.query.get("category")
    presets = list_presets(category=category)
    return web.json_response({"presets": presets, "count": len(presets)})


async def handle_get_preset(request: web.Request) -> web.Response:
    """GET /v1/presets/{preset_id} — get a specific preset."""
    preset_id = request.match_info["preset_id"]
    preset = get_preset(preset_id)
    if not preset:
        return web.json_response(
            {
                "error": {
                    "type": "not_found",
                    "message": f"Preset '{preset_id}' not found",
                    "code": 404,
                }
            },
            status=404,
        )
    return web.json_response(preset)


def apply_preset_to_messages(
    data: dict, messages: list[dict],
) -> list[dict]:
    """If data contains a 'preset' field, prepend the preset's system_prompt.

    Returns the (possibly modified) messages list.
    """
    preset_id = data.get("preset")
    if not preset_id:
        return messages

    preset = get_preset(preset_id)
    if not preset:
        return messages

    system_msg = {"role": "system", "content": preset["system_prompt"]}
    has_system = any(m.get("role") == "system" for m in messages)
    if has_system:
        return messages
    return [system_msg, *messages]


def setup_preset_routes(app: web.Application) -> None:
    """Register preset routes on the application."""
    app.router.add_get("/v1/presets", handle_list_presets)
    app.router.add_get("/v1/presets/{preset_id}", handle_get_preset)
