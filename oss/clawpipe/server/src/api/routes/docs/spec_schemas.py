"""OpenAPI component schemas and security definitions."""

COMPONENTS = {
    "schemas": {
        "ChatMessage": {
            "type": "object",
            "required": ["role", "content"],
            "properties": {
                "role": {"type": "string", "enum": ["system", "user", "assistant", "tool"]},
                "content": {"type": "string"},
            },
        },
        "ChatCompletionRequest": {
            "type": "object",
            "required": ["model", "messages"],
            "properties": {
                "model": {"type": "string", "example": "gpt-3.5-turbo"},
                "messages": {"type": "array", "items": {"$ref": "#/components/schemas/ChatMessage"}},
                "max_tokens": {"type": "integer", "example": 256},
                "temperature": {"type": "number", "minimum": 0, "maximum": 2, "example": 0.7},
                "stream": {"type": "boolean", "default": False},
                "backend": {"type": "string", "description": "Force a specific provider backend"},
            },
        },
        "ChatCompletionResponse": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "object": {"type": "string", "example": "chat.completion"},
                "created": {"type": "integer"},
                "model": {"type": "string"},
                "choices": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "index": {"type": "integer"},
                            "message": {"$ref": "#/components/schemas/ChatMessage"},
                            "finish_reason": {"type": "string"},
                        },
                    },
                },
                "usage": {
                    "type": "object",
                    "properties": {
                        "prompt_tokens": {"type": "integer"},
                        "completion_tokens": {"type": "integer"},
                        "total_tokens": {"type": "integer"},
                    },
                },
            },
        },
        "ModelList": {
            "type": "object",
            "properties": {
                "object": {"type": "string", "example": "list"},
                "data": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "object": {"type": "string", "example": "model"},
                            "created": {"type": "integer"},
                            "owned_by": {"type": "string"},
                        },
                    },
                },
            },
        },
        "CompatMatrix": {
            "type": "object",
            "properties": {
                "coverage_percent": {"type": "number"},
                "endpoints": {"type": "array", "items": {"type": "object"}},
                "sdk_compatibility": {"type": "object"},
                "roadmap": {"type": "array", "items": {"type": "string"}},
            },
        },
    },
    "securitySchemes": {
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": "Bearer token. Only required when FINSAVVYAI_AUTH_ENABLED=true.",
        }
    },
}
