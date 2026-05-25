"""
FinSavvyAI Vision Pipeline

Multi-step vision analysis workflows with caching and structured output.

Templates live in vision_pipeline_templates.py.
"""

import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

from src.core.structured_output import StructuredOutputParser
from src.core.vision_pipeline_templates import PipelineTemplates  # noqa: F401

logger = logging.getLogger("finsavvyai.vision_pipeline")


class VisionPipeline:
    """Multi-step vision analysis pipeline.

    Chains vision calls sequentially, passing context between steps.
    Supports caching per-step and optional structured output parsing.
    """

    def __init__(self, openclaw_client, preprocessor=None, cache=None, rate_limiter=None):
        self.openclaw = openclaw_client
        self.preprocessor = preprocessor
        self.cache = cache
        self.rate_limiter = rate_limiter
        self.parser = StructuredOutputParser()

    async def execute(self, image_data: str, steps: List[Dict[str, Any]],
                      model: str = "default") -> Dict[str, Any]:
        """Execute a multi-step vision pipeline."""
        pipeline_id = str(uuid.uuid4())[:8]
        start = time.monotonic()
        context: Dict[str, Any] = {}
        step_results: List[Dict[str, Any]] = []
        if self.preprocessor:
            preprocessed = await self.preprocessor.preprocess(image_data)
            image_data = preprocessed["data"]
        for step_config in steps:
            result = await self._execute_step(step_config, context, image_data, model)
            step_results.append(result)
            context[step_config["name"]] = result
        total_duration = round(time.monotonic() - start, 3)
        final_output = step_results[-1]["output"] if step_results else None
        logger.info("Pipeline %s completed: %d steps in %ss", pipeline_id, len(steps), total_duration)
        return {"pipeline_id": pipeline_id, "steps": step_results,
                "final_output": final_output, "total_duration": total_duration}

    async def _execute_step(self, step_config: Dict[str, Any], context: Dict[str, Any],
                            image_data: str, model: str) -> Dict[str, Any]:
        """Execute a single pipeline step."""
        name = step_config["name"]
        prompt = self._resolve_template(step_config["prompt"], context)
        output_schema = step_config.get("output_schema")
        start = time.monotonic()
        messages = [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": image_data}},
        ]}]
        # Check cache
        if self.cache:
            cached_result = await self.cache.get(image_data, model, messages)
            if cached_result:
                return self._build_cached_result(name, cached_result, output_schema, start)
        # Rate limit + API call
        try:
            response = await self._call_api(messages, model)
            output = self._extract_text(response)
            if self.cache:
                await self.cache.set(image_data, model, messages, output)
        except Exception as e:
            logger.error("Pipeline step '%s' failed: %s", name, e)
            return {"name": name, "status": "failed", "output": None,
                    "error": str(e), "duration": round(time.monotonic() - start, 3), "cached": False}
        duration = round(time.monotonic() - start, 3)
        result: Dict[str, Any] = {"name": name, "status": "completed",
                                   "output": output, "duration": duration, "cached": False}
        if output_schema and isinstance(output, str):
            parsed = self.parser.parse_response(output, output_schema)
            result["structured"] = parsed
            if parsed["valid"]:
                result["output"] = parsed["data"]
        return result

    def _build_cached_result(self, name: str, cached: Dict, schema: Any, start: float) -> Dict[str, Any]:
        output = cached.get("text", "")
        result: Dict[str, Any] = {"name": name, "status": "completed", "output": output,
                                   "duration": round(time.monotonic() - start, 3), "cached": True}
        if schema:
            parsed = self.parser.parse_response(output, schema)
            result["structured"] = parsed
            if parsed["valid"]:
                result["output"] = parsed["data"]
        return result

    async def _call_api(self, messages: List[Dict], model: str) -> Dict[str, Any]:
        if self.rate_limiter:
            async with self.rate_limiter.throttle():
                return await self.openclaw.complete_vision(messages=messages, model=model)
        return await self.openclaw.complete_vision(messages=messages, model=model)

    @staticmethod
    def _resolve_template(template: str, context: Dict[str, Any]) -> str:
        """Resolve {step_name.output} references in prompt template."""
        for step_name, step_result in context.items():
            output = step_result.get("output", "")
            if isinstance(output, dict):
                output = json.dumps(output)
            template = template.replace("{" + f"{step_name}.output" + "}", str(output))
        return template

    @staticmethod
    def _extract_text(response: Dict[str, Any]) -> str:
        """Extract text from OpenClaw vision response."""
        if isinstance(response, dict):
            choices = response.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
            if "text" in response:
                return response["text"]
        return str(response)
