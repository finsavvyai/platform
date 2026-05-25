#!/usr/bin/env python3
"""
Skill manifest builder for FinSavvyAI.

Builds an AgentSkills.io-compatible manifest describing all
available FinSavvyAI skills.

Sprint 14 — Task 14.1
Extracted from skill_registry.py.
"""

from typing import Any, Dict


def build_skill_manifest(
    agent_id: str = "finsavvy-ai",
    base_url: str = "http://localhost:8001",
    version: str = "1.0.0",
) -> Dict[str, Any]:
    """Build AgentSkills.io-format manifest (Task 14.1)."""
    return {
        "schema_version": "1.0",
        "agent_id": agent_id,
        "name": "FinSavvyAI",
        "description": "Distributed AI inference cluster with multi-model support",
        "version": version,
        "base_url": base_url,
        "auth": {"type": "api_key", "header": "X-API-Key"},
        "skills": [
            {
                "id": "inference",
                "name": "AI Inference",
                "description": "Run chat completions via local or cloud models",
                "endpoint": "/v1/chat/completions",
                "method": "POST",
                "parameters": {
                    "model": {
                        "type": "string",
                        "required": False,
                        "default": "default",
                    },
                    "messages": {"type": "array", "required": True},
                    "max_tokens": {
                        "type": "integer",
                        "required": False,
                        "default": 512,
                    },
                    "temperature": {
                        "type": "number",
                        "required": False,
                        "default": 0.7,
                    },
                    "stream": {
                        "type": "boolean",
                        "required": False,
                        "default": False,
                    },
                },
            },
            {
                "id": "vision",
                "name": "Vision Analysis",
                "description": "Analyze images via vision pipeline",
                "endpoint": "/v1/vision/pipeline",
                "method": "POST",
                "parameters": {
                    "image": {
                        "type": "string",
                        "required": True,
                        "description": "Base64 or URL",
                    },
                    "pipeline": {"type": "string", "required": True},
                    "model": {
                        "type": "string",
                        "required": False,
                        "default": "default",
                    },
                },
            },
            {
                "id": "models",
                "name": "Model Management",
                "description": "List, load, and manage inference models",
                "endpoint": "/v1/models",
                "method": "GET",
                "parameters": {},
            },
            {
                "id": "cluster-status",
                "name": "Cluster Status",
                "description": "Get cluster health and status information",
                "endpoint": "/health",
                "method": "GET",
                "parameters": {},
            },
            {
                "id": "benchmark",
                "name": "Performance Benchmark",
                "description": "Run performance benchmarks on demand",
                "endpoint": "/v1/skills/benchmark",
                "method": "POST",
                "parameters": {
                    "model": {
                        "type": "string",
                        "required": False,
                        "default": "default",
                    },
                    "prompt": {
                        "type": "string",
                        "required": False,
                        "default": "Hello!",
                    },
                    "iterations": {
                        "type": "integer",
                        "required": False,
                        "default": 5,
                    },
                },
            },
        ],
    }
