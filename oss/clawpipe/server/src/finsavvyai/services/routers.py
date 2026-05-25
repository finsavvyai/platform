"""Minimal router stubs for legacy tests."""


class _OpenAIChatCompletion:
    @staticmethod
    def create():
        return {"choices": [{"message": {"content": "ok"}}]}


class _AnthropicMessage:
    @staticmethod
    def create():
        return {"content": [{"text": "ok"}]}


class openai_client:
    ChatCompletion = _OpenAIChatCompletion


class anthropic_client:
    Message = _AnthropicMessage


async def route_request(*_args, **_kwargs):
    """Return a generic routed response."""
    return {"content": "ok"}


async def call_provider(*_args, **_kwargs):
    """Return a generic provider response."""
    return {"content": "ok"}
