"""OpenAPI path definitions for models, health, metrics, and compatibility."""

INFRA_PATHS = {
    "/v1/models": {
        "get": {
            "tags": ["Models"],
            "summary": "List models",
            "description": "Returns all models available across the cluster and configured cloud providers.",
            "operationId": "listModels",
            "responses": {
                "200": {
                    "description": "Model list",
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ModelList"}}},
                }
            },
        }
    },
    "/v1/compat": {
        "get": {
            "tags": ["Compatibility"],
            "summary": "OpenAI compatibility matrix",
            "description": (
                "Returns which OpenAI endpoints are supported, "
                "`coverage_percent`, and SDK compatibility info."
            ),
            "operationId": "getCompatMatrix",
            "responses": {
                "200": {
                    "description": "Compatibility matrix",
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/CompatMatrix"}}},
                }
            },
        }
    },
    "/health": {
        "get": {
            "tags": ["Health"],
            "summary": "Health check",
            "operationId": "getHealth",
            "parameters": [
                {
                    "name": "verbose",
                    "in": "query",
                    "schema": {"type": "boolean"},
                    "description": "Include setup completion percentage",
                }
            ],
            "responses": {
                "200": {"description": "Service is healthy"},
                "503": {"description": "Service degraded or unhealthy"},
            },
        }
    },
    "/metrics": {
        "get": {
            "tags": ["Observability"],
            "summary": "Prometheus metrics",
            "operationId": "getMetrics",
            "parameters": [
                {
                    "name": "format",
                    "in": "query",
                    "schema": {"type": "string", "enum": ["prometheus", "json"]},
                }
            ],
            "responses": {"200": {"description": "Metrics data"}},
        }
    },
}
