"""
FinSavvyAI Structured Output Parser

Parse and validate vision model output against JSON schemas.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger("finsavvyai.structured_output")

# --------------------------------------------------------------------------
# Built-in JSON schemas for common vision tasks
# --------------------------------------------------------------------------

DOCUMENT_FIELDS_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "date": {"type": "string"},
        "amount": {"type": "number"},
        "currency": {"type": "string"},
        "vendor": {"type": "string"},
        "items": {"type": "array", "items": {"type": "object"}},
    },
    "required": ["title"],
}

UI_ELEMENTS_SCHEMA = {
    "type": "object",
    "properties": {
        "elements": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string"},
                    "text": {"type": "string"},
                    "position": {"type": "string"},
                },
            },
        },
        "layout": {"type": "string"},
        "description": {"type": "string"},
    },
    "required": ["elements"],
}

IMAGE_TAGS_SCHEMA = {
    "type": "object",
    "properties": {
        "objects": {"type": "array", "items": {"type": "string"}},
        "tags": {"type": "array", "items": {"type": "string"}},
        "description": {"type": "string"},
        "scene_type": {"type": "string"},
    },
    "required": ["objects", "description"],
}

_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*\n([\s\S]*?)\n\s*```", re.MULTILINE)
_RAW_JSON_RE = re.compile(r"(\{[\s\S]*\})")


class StructuredOutputParser:
    """Parse and validate vision model output against JSON schemas.

    Extracts JSON from free-form text (including markdown code blocks)
    and validates it against a lightweight schema (no external deps).
    """

    def parse_response(self, text: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Parse vision response into structured format.

        Returns:
            {"data": {...}, "valid": bool, "errors": [...], "raw_text": str}
        """
        extracted = self.extract_json(text)
        if extracted is None:
            return {
                "data": None,
                "valid": False,
                "errors": ["No JSON found in response"],
                "raw_text": text,
            }
        errors = self.validate_schema(extracted, schema)
        return {
            "data": extracted,
            "valid": len(errors) == 0,
            "errors": errors,
            "raw_text": text,
        }

    @staticmethod
    def extract_json(text: str) -> Optional[Dict[str, Any]]:
        """Extract a JSON object from text.

        Tries markdown fenced blocks first, then raw braces.
        """
        match = _JSON_BLOCK_RE.search(text)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                pass

        match = _RAW_JSON_RE.search(text)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            return None

    @staticmethod
    def validate_schema(data: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
        """Validate data against a JSON schema (lightweight).

        Checks required fields and basic type matching.
        Returns list of error strings (empty == valid).
        """
        errors: List[str] = []

        if schema.get("type") == "object" and not isinstance(data, dict):
            errors.append(f"Expected object, got {type(data).__name__}")
            return errors

        for field in schema.get("required", []):
            if field not in data:
                errors.append(f"Missing required field: {field}")

        properties = schema.get("properties", {})
        type_map = {
            "string": str,
            "number": (int, float),
            "integer": int,
            "boolean": bool,
            "array": list,
            "object": dict,
        }
        for key, prop_schema in properties.items():
            if key not in data:
                continue
            expected_type = prop_schema.get("type")
            if expected_type and expected_type in type_map:
                py_type = type_map[expected_type]
                if not isinstance(data[key], py_type):
                    errors.append(
                        f"Field '{key}': expected {expected_type}, "
                        f"got {type(data[key]).__name__}"
                    )

        return errors
