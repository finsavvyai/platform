"""Interactive API docs — /docs (Redoc) and /openapi.json."""

from src.api.routes.docs.handlers import handle_docs, handle_openapi_spec

__all__ = ["handle_docs", "handle_openapi_spec"]
