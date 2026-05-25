"""OpenAPI 3.1 specification assembly."""

from src.api.routes.docs.spec_paths_chat import CHAT_PATHS
from src.api.routes.docs.spec_paths_arena import ARENA_PATHS
from src.api.routes.docs.spec_paths_infra import INFRA_PATHS
from src.api.routes.docs.spec_schemas import COMPONENTS

OPENAPI_SPEC = {
    "openapi": "3.1.0",
    "info": {
        "title": "FinSavvyAI Gateway",
        "version": "1.0.0",
        "description": (
            "Self-hosted distributed AI gateway with full OpenAI API compatibility. "
            "Change one line of code — route to any model, anywhere."
        ),
        "contact": {"email": "support@finsavvyai.com"},
        "license": {"name": "MIT", "url": "https://opensource.org/licenses/MIT"},
        "x-logo": {"url": "https://raw.githubusercontent.com/finsavvyai/finsavvyai/main/docs/assets/logo.png"},
    },
    "servers": [
        {"url": "http://localhost:8080", "description": "Local gateway"},
        {"url": "https://demo.finsavvyai.com", "description": "Public demo"},
    ],
    "tags": [
        {"name": "Chat", "description": "OpenAI-compatible chat completions"},
        {"name": "Models", "description": "Model discovery"},
        {"name": "Health", "description": "Health and readiness probes"},
        {"name": "Observability", "description": "Metrics and tracing"},
        {"name": "Compatibility", "description": "OpenAI compatibility matrix"},
        {"name": "Arena", "description": "Model Arena — blind A/B ELO leaderboard"},
        {"name": "Embeddings", "description": "OpenAI-compatible text embeddings"},
        {"name": "Legacy", "description": "Legacy /v1/completions text completions shim"},
    ],
    "paths": {**CHAT_PATHS, **INFRA_PATHS, **ARENA_PATHS},
    "components": COMPONENTS,
    "security": [{"ApiKeyAuth": []}],
}
