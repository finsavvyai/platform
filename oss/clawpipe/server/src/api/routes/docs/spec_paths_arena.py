"""OpenAPI path definitions for Model Arena endpoints."""

ARENA_PATHS = {
    "/v1/arena/models": {
        "get": {
            "tags": ["Arena"],
            "summary": "List arena-eligible models",
            "operationId": "listArenaModels",
            "responses": {
                "200": {
                    "description": "Arena model list",
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ModelList"}}},
                }
            },
        }
    },
    "/v1/arena/battle": {
        "post": {
            "tags": ["Arena"],
            "summary": "Start a blind A/B battle",
            "description": (
                "Submit a prompt, receive two anonymised responses (A and B). "
                "Models are randomly assigned to slots."
            ),
            "operationId": "startArenaBattle",
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["prompt"],
                            "properties": {
                                "prompt": {"type": "string"},
                                "models": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "Optional: specify exactly 2 models. Defaults to random pair.",
                                },
                                "max_tokens": {"type": "integer", "default": 300},
                            },
                        },
                        "examples": {
                            "basic": {
                                "summary": "Random model pair",
                                "value": {"prompt": "Explain quantum entanglement simply"},
                            },
                            "specific": {
                                "summary": "Specific models",
                                "value": {
                                    "prompt": "Write a Python hello world",
                                    "models": ["gpt-4", "llama3.2"],
                                },
                            },
                        },
                    }
                },
            },
            "responses": {
                "200": {
                    "description": "Battle created with two anonymised responses",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "battle_id": {"type": "string"},
                                    "prompt": {"type": "string"},
                                    "responses": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "slot": {"type": "string", "enum": ["A", "B"]},
                                                "content": {"type": "string"},
                                            },
                                        },
                                    },
                                    "instructions": {"type": "string"},
                                },
                            }
                        }
                    },
                },
                "400": {"description": "Missing prompt"},
            },
        }
    },
    "/v1/arena/vote": {
        "post": {
            "tags": ["Arena"],
            "summary": "Vote on a battle",
            "description": "Cast a vote for response A, B, or tie. Updates ELO ratings.",
            "operationId": "submitArenaVote",
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["battle_id", "winner"],
                            "properties": {
                                "battle_id": {"type": "string"},
                                "winner": {"type": "string", "enum": ["A", "B", "tie"]},
                            },
                        }
                    }
                },
            },
            "responses": {
                "200": {
                    "description": "Vote recorded — reveals which model was which",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "battle_id": {"type": "string"},
                                    "winner": {"type": "string"},
                                    "revealed": {
                                        "type": "object",
                                        "properties": {
                                            "A": {"type": "string"},
                                            "B": {"type": "string"},
                                        },
                                    },
                                    "elo": {"type": "object"},
                                },
                            }
                        }
                    },
                },
                "400": {"description": "Invalid request"},
                "404": {"description": "Battle not found"},
                "409": {"description": "Already voted on this battle"},
            },
        }
    },
    "/v1/arena/leaderboard": {
        "get": {
            "tags": ["Arena"],
            "summary": "ELO leaderboard",
            "description": (
                "Returns ELO rankings for all models that have participated "
                "in at least one battle."
            ),
            "operationId": "getArenaLeaderboard",
            "responses": {
                "200": {
                    "description": "Leaderboard",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "object": {"type": "string", "example": "arena.leaderboard"},
                                    "total_battles": {"type": "integer"},
                                    "total_votes": {"type": "integer"},
                                    "rankings": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "rank": {"type": "integer"},
                                                "model": {"type": "string"},
                                                "elo": {"type": "number"},
                                                "battles": {"type": "integer"},
                                                "win_rate": {"type": "number"},
                                            },
                                        },
                                    },
                                },
                            }
                        }
                    },
                }
            },
        }
    },
}
