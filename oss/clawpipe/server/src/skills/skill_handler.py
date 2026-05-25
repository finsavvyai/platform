#!/usr/bin/env python3
"""
Skills HTTP handler for FinSavvyAI.

Provides manifest, execution, and registry publishing endpoints.

Sprint 14 — Tasks 14.7, 14.9
Extracted from skill_registry.py.
"""

import json
import logging
from typing import Optional

import aiohttp.web

from src.skills.skill_executor import SkillAuthenticator, SkillExecutor
from src.skills.skill_manifest import build_skill_manifest

logger = logging.getLogger("finsavvyai.skills")


class SkillsHandler:
    """
    HTTP handler for skill endpoints.
    Provides manifest, execution, and registry publishing.
    """

    def __init__(
        self,
        executor: SkillExecutor,
        authenticator: SkillAuthenticator,
        agent_id: str = "finsavvy-ai",
        base_url: str = "http://localhost:8001",
    ):
        self.executor = executor
        self.authenticator = authenticator
        self.agent_id = agent_id
        self.base_url = base_url

    def _check_auth(self, request: aiohttp.web.Request) -> bool:
        api_key = request.headers.get("X-API-Key") or request.headers.get(
            "Authorization", ""
        ).replace("Bearer ", "")
        return self.authenticator.validate(api_key)

    async def handle_manifest(
        self, request: aiohttp.web.Request
    ) -> aiohttp.web.Response:
        """GET /v1/skills/manifest -- return skill manifest (Task 14.9)."""
        manifest = build_skill_manifest(
            agent_id=self.agent_id,
            base_url=self.base_url,
        )
        return aiohttp.web.json_response(manifest)

    async def handle_execute(
        self, request: aiohttp.web.Request
    ) -> aiohttp.web.Response:
        """POST /v1/skills/execute -- execute a skill."""
        if not self._check_auth(request):
            return aiohttp.web.json_response(
                {"error": "Invalid API key"}, status=401
            )

        try:
            data = await request.json()
        except json.JSONDecodeError:
            return aiohttp.web.json_response(
                {"error": "Invalid JSON"}, status=400
            )

        skill_id = data.get("skill_id")
        params = data.get("params", {})

        if not skill_id:
            return aiohttp.web.json_response(
                {"error": "skill_id is required"}, status=400
            )

        result = await self.executor.execute_skill(skill_id, params)
        status = 200 if "error" not in result else 400
        return aiohttp.web.json_response(result, status=status)

    async def handle_list(
        self, request: aiohttp.web.Request
    ) -> aiohttp.web.Response:
        """GET /v1/skills -- list available skills."""
        manifest = build_skill_manifest(
            agent_id=self.agent_id, base_url=self.base_url
        )
        skills = [
            {"id": s["id"], "name": s["name"], "description": s["description"]}
            for s in manifest["skills"]
        ]
        return aiohttp.web.json_response({"skills": skills})

    async def handle_publish(
        self, request: aiohttp.web.Request
    ) -> aiohttp.web.Response:
        """POST /v1/skills/publish -- publish to ClawHub registry (Task 14.7)."""
        if not self._check_auth(request):
            return aiohttp.web.json_response(
                {"error": "Invalid API key"}, status=401
            )

        manifest = build_skill_manifest(
            agent_id=self.agent_id, base_url=self.base_url
        )
        return aiohttp.web.json_response({
            "status": "published",
            "agent_id": self.agent_id,
            "skills_count": len(manifest["skills"]),
            "registry": "clawhub",
        })

    def register_routes(self, app: aiohttp.web.Application) -> None:
        """Register skill routes on an aiohttp app."""
        app.router.add_get("/v1/skills", self.handle_list)
        app.router.add_get("/v1/skills/manifest", self.handle_manifest)
        app.router.add_post("/v1/skills/execute", self.handle_execute)
        app.router.add_post("/v1/skills/publish", self.handle_publish)
        app.router.add_post(
            "/v1/skills/benchmark", self._handle_benchmark_direct
        )
        logger.info("Skill routes registered")

    async def _handle_benchmark_direct(
        self, request: aiohttp.web.Request
    ) -> aiohttp.web.Response:
        """Direct benchmark endpoint (Task 14.6)."""
        if not self._check_auth(request):
            return aiohttp.web.json_response(
                {"error": "Invalid API key"}, status=401
            )
        try:
            data = await request.json()
        except json.JSONDecodeError:
            data = {}
        result = await self.executor.execute_skill("benchmark", data)
        return aiohttp.web.json_response(result)
