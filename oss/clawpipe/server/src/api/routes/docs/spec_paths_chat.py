"""OpenAPI path definitions for chat, completions, and embeddings."""

CHAT_PATHS = {
    "/v1/chat/completions": {
        "post": {
            "tags": ["Chat"],
            "summary": "Create chat completion",
            "description": "OpenAI-compatible chat completions endpoint. Supports streaming.",
            "operationId": "createChatCompletion",
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/ChatCompletionRequest"},
                        "examples": {
                            "basic": {
                                "summary": "Basic request",
                                "value": {
                                    "model": "gpt-3.5-turbo",
                                    "messages": [{"role": "user", "content": "Hello!"}],
                                },
                            },
                            "local_model": {
                                "summary": "Local Ollama model",
                                "value": {
                                    "model": "llama3.2",
                                    "messages": [{"role": "user", "content": "Explain async Python"}],
                                    "max_tokens": 200,
                                },
                            },
                        },
                    }
                },
            },
            "responses": {
                "200": {
                    "description": "Chat completion response",
                    "headers": {
                        "openai-version": {"schema": {"type": "string"}, "description": "OpenAI API version"},
                        "openai-processing-ms": {"schema": {"type": "string"}, "description": "Processing time in ms"},
                        "x-request-id": {"schema": {"type": "string"}, "description": "Unique request ID"},
                    },
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ChatCompletionResponse"}}},
                },
                "400": {"description": "Invalid request body"},
                "401": {"description": "Unauthorized (auth enabled)"},
                "429": {"description": "Rate limit exceeded"},
                "503": {"description": "No provider available"},
            },
        }
    },
    "/v1/embeddings": {
        "post": {
            "tags": ["Embeddings"],
            "summary": "Create embeddings",
            "description": "Proxies to OpenAI when API key present; falls back to deterministic L2-normalised stub.",
            "operationId": "createEmbeddings",
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["input"],
                            "properties": {
                                "input": {
                                    "oneOf": [
                                        {"type": "string"},
                                        {"type": "array", "items": {"type": "string"}},
                                    ],
                                    "description": "Text or array of texts to embed",
                                },
                                "model": {"type": "string", "default": "text-embedding-ada-002"},
                                "encoding_format": {
                                    "type": "string",
                                    "enum": ["float", "base64"],
                                    "default": "float",
                                },
                            },
                        },
                        "examples": {
                            "string": {"summary": "Single string", "value": {"input": "FinSavvyAI is great"}},
                            "array": {"summary": "Array", "value": {"input": ["hello", "world"]}},
                        },
                    }
                },
            },
            "responses": {
                "200": {
                    "description": "Embedding vectors",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "object": {"type": "string", "example": "list"},
                                    "data": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "object": {"type": "string"},
                                                "index": {"type": "integer"},
                                                "embedding": {"type": "array", "items": {"type": "number"}},
                                            },
                                        },
                                    },
                                    "model": {"type": "string"},
                                    "usage": {
                                        "type": "object",
                                        "properties": {
                                            "prompt_tokens": {"type": "integer"},
                                            "total_tokens": {"type": "integer"},
                                        },
                                    },
                                },
                            }
                        }
                    },
                },
                "400": {"description": "Invalid request"},
            },
        }
    },
    "/v1/completions": {
        "post": {
            "tags": ["Legacy"],
            "summary": "Create text completion (legacy)",
            "description": (
                "Legacy `/v1/completions` shim. Wraps the prompt as a chat message "
                "and delegates to `/v1/chat/completions`."
            ),
            "operationId": "createCompletion",
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["prompt"],
                            "properties": {
                                "prompt": {
                                    "oneOf": [
                                        {"type": "string"},
                                        {"type": "array", "items": {"type": "string"}},
                                    ]
                                },
                                "model": {"type": "string", "default": "gpt-3.5-turbo"},
                                "max_tokens": {"type": "integer"},
                                "temperature": {"type": "number"},
                                "stop": {"oneOf": [{"type": "string"}, {"type": "array", "items": {"type": "string"}}]},
                            },
                        }
                    }
                },
            },
            "responses": {
                "200": {
                    "description": "Text completion",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "object": {"type": "string", "example": "text_completion"},
                                    "created": {"type": "integer"},
                                    "model": {"type": "string"},
                                    "choices": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "text": {"type": "string"},
                                                "index": {"type": "integer"},
                                                "finish_reason": {"type": "string"},
                                            },
                                        },
                                    },
                                    "usage": {"type": "object"},
                                },
                            }
                        }
                    },
                },
                "400": {"description": "Invalid request"},
            },
        }
    },
}
