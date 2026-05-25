"""GET /v1/compat - OpenAI compatibility matrix endpoint."""

from aiohttp import web

COMPAT_MATRIX = {
    "version": "2020-10-01",
    "base_url_hint": "Change base_url to http://<host>:8080/v1 and keep your api_key",
    "endpoints": [
        {
            "endpoint": "/v1/chat/completions",
            "method": "POST",
            "openai_compatible": True,
            "streaming": True,
            "notes": "Supports stream=true via SSE",
        },
        {
            "endpoint": "/v1/models",
            "method": "GET",
            "openai_compatible": True,
            "streaming": False,
            "notes": "Returns aggregated models from all connected workers and cloud providers",
        },
        {
            "endpoint": "/v1/compat",
            "method": "GET",
            "openai_compatible": False,
            "streaming": False,
            "notes": "FinSavvyAI extension — compatibility matrix",
        },
        {
            "endpoint": "/docs",
            "method": "GET",
            "openai_compatible": False,
            "streaming": False,
            "notes": "Interactive API playground (Redoc)",
        },
        {
            "endpoint": "/openapi.json",
            "method": "GET",
            "openai_compatible": False,
            "streaming": False,
            "notes": "OpenAPI 3.1 specification",
        },
        {
            "endpoint": "/v1/completions",
            "method": "POST",
            "openai_compatible": True,
            "streaming": False,
            "notes": "Legacy text completions shim — wraps prompt as chat message",
        },
        {
            "endpoint": "/v1/embeddings",
            "method": "POST",
            "openai_compatible": True,
            "streaming": False,
            "notes": "Proxies to OpenAI when key is present; deterministic stub fallback",
        },
        {
            "endpoint": "/v1/images/generations",
            "method": "POST",
            "openai_compatible": False,
            "streaming": False,
            "notes": "Planned for S44 multimodal sprint",
        },
        {
            "endpoint": "/v1/audio/transcriptions",
            "method": "POST",
            "openai_compatible": False,
            "streaming": False,
            "notes": "Planned for S45 audio/speech sprint",
        },
    ],
    "response_headers": {
        "openai-version": "present on all responses",
        "openai-processing-ms": "present on all responses",
        "x-request-id": "present on all responses",
        "x-ratelimit-limit-requests": "present when rate limiting is active",
        "x-ratelimit-remaining-requests": "present when rate limiting is active",
    },
    "sdk_compatibility": {
        "openai_python": {
            "tested": True,
            "minimum_version": "1.0.0",
            "example": (
                "from openai import OpenAI\n"
                "client = OpenAI(base_url='http://localhost:8080/v1', api_key='any')\n"
                "resp = client.chat.completions.create(model='gpt-3.5-turbo', messages=[...])"
            ),
        },
        "openai_node": {
            "tested": False,
            "minimum_version": "4.0.0",
            "example": (
                "import OpenAI from 'openai';\n"
                "const client = new OpenAI({ baseURL: 'http://localhost:8080/v1', apiKey: 'any' });"
            ),
        },
        "langchain": {
            "tested": False,
            "minimum_version": "0.1.0",
            "example": "ChatOpenAI(base_url='http://localhost:8080/v1', api_key='any')",
        },
    },
    "coverage_percent": 40,
    "roadmap_url": "https://github.com/finsavvyai/finsavvyai#roadmap",
}


async def handle_compat(request):
    """GET /v1/compat - returns OpenAI API compatibility matrix."""
    compatible_count = sum(1 for e in COMPAT_MATRIX["endpoints"] if e["openai_compatible"])
    total_count = len(COMPAT_MATRIX["endpoints"])
    payload = {
        **COMPAT_MATRIX,
        "summary": {
            "compatible_endpoints": compatible_count,
            "total_endpoints": total_count,
            "coverage_percent": round(compatible_count / total_count * 100),
        },
    }
    return web.json_response(payload)
