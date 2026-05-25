"""Arena battle handlers — model invocation and voting."""

import asyncio
import random
import time
import uuid

from aiohttp import web

from src.api.routes.arena.elo import _battles, _elo, _update_elo, _votes


async def _call_model_direct(
    gateway: object,
    model: str,
    messages: list,
    max_tokens: int = 300,
) -> str:
    """Invoke a model via the provider registry without an HTTP round-trip.

    Falls back to a labelled stub when no provider is available so battles
    always return two responses regardless of cluster state.
    """
    if not gateway:
        return f"[simulated response from {model}]"
    try:
        registry = getattr(gateway, "provider_registry", None)
        if not registry:
            return f"[simulated response from {model}]"

        try:
            from src.providers.base import ChatMessage, ChatRequest

            provider = registry.resolve_provider(model)
            if not provider:
                return f"[no provider available for {model}]"
            chat_msgs = [
                ChatMessage(role=m["role"], content=m.get("content", ""))
                for m in messages
            ]
            req = ChatRequest(
                messages=chat_msgs,
                model=model,
                max_tokens=max_tokens,
                stream=False,
            )
            result = await provider.chat(req)
            return result.content
        except ImportError:
            return f"[simulated response from {model}]"
    except Exception as exc:
        return f"[error from {model}: {exc}]"


async def handle_arena_battle(request: web.Request) -> web.Response:
    """POST /v1/arena/battle — submit a prompt, receive two anonymised responses."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON"}, status=400)

    prompt = body.get("prompt") or body.get("message")
    if not prompt:
        return web.json_response({"error": "prompt is required"}, status=400)

    models = body.get("models")
    gateway = request.app.get("gateway")

    available = ["gpt-3.5-turbo", "gpt-4", "claude-3-haiku-20240307", "llama3.2"]
    if models and isinstance(models, list) and len(models) >= 2:
        model_a, model_b = models[0], models[1]
    else:
        chosen = random.sample(available, 2)
        model_a, model_b = chosen[0], chosen[1]

    messages = [{"role": "user", "content": prompt}]
    max_tokens = body.get("max_tokens", 300)

    response_a, response_b = await asyncio.gather(
        _call_model_direct(gateway, model_a, messages, max_tokens),
        _call_model_direct(gateway, model_b, messages, max_tokens),
    )

    battle_id = f"battle_{uuid.uuid4().hex[:12]}"

    shuffled = [
        {"slot": "A", "model": model_a, "response": response_a},
        {"slot": "B", "model": model_b, "response": response_b},
    ]
    random.shuffle(shuffled)
    slot_map = {item["slot"]: item["model"] for item in shuffled}

    _battles[battle_id] = {
        "id": battle_id,
        "prompt": prompt,
        "slot_map": slot_map,
        "created": int(time.time()),
        "voted": False,
    }

    return web.json_response(
        {
            "battle_id": battle_id,
            "prompt": prompt,
            "responses": [
                {"slot": item["slot"], "content": item["response"]}
                for item in shuffled
            ],
            "instructions": (
                "Vote via POST /v1/arena/vote with "
                "battle_id and winner='A'|'B'|'tie'"
            ),
        }
    )


async def handle_arena_vote(request: web.Request) -> web.Response:
    """POST /v1/arena/vote — cast a vote."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON"}, status=400)

    battle_id = body.get("battle_id")
    winner_slot = body.get("winner", "").upper()

    if not battle_id:
        return web.json_response(
            {"error": "battle_id is required"}, status=400,
        )
    if winner_slot not in ("A", "B", "TIE"):
        return web.json_response(
            {"error": "winner must be 'A', 'B', or 'tie'"}, status=400,
        )

    battle = _battles.get(battle_id)
    if not battle:
        return web.json_response({"error": "battle not found"}, status=404)
    if battle["voted"]:
        return web.json_response(
            {"error": "already voted on this battle"}, status=409,
        )

    slot_map = battle["slot_map"]
    model_a = slot_map["A"]
    model_b = slot_map["B"]

    if winner_slot == "A":
        _update_elo(model_a, model_b, tie=False)
        winner_model, loser_model = model_a, model_b
    elif winner_slot == "B":
        _update_elo(model_b, model_a, tie=False)
        winner_model, loser_model = model_b, model_a
    else:
        _update_elo(model_a, model_b, tie=True)
        winner_model = loser_model = "tie"

    battle["voted"] = True
    _votes.append(
        {
            "battle_id": battle_id,
            "winner_slot": winner_slot,
            "winner_model": winner_model,
            "model_a": model_a,
            "model_b": model_b,
            "ts": int(time.time()),
        }
    )

    return web.json_response(
        {
            "battle_id": battle_id,
            "winner": winner_slot,
            "revealed": {"A": model_a, "B": model_b},
            "elo": {
                model_a: round(_elo[model_a], 1),
                model_b: round(_elo[model_b], 1),
            },
        }
    )
