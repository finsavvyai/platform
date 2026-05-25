"""
FinSavvyAI Vision Pipeline Templates

Pre-built pipeline templates for common vision analysis workflows.
"""

from typing import Any, Dict, List

from src.core.structured_output import (
    DOCUMENT_FIELDS_SCHEMA,
    IMAGE_TAGS_SCHEMA,
    UI_ELEMENTS_SCHEMA,
)


class PipelineTemplates:
    """Pre-built pipeline templates for common vision tasks."""

    @staticmethod
    def document_analysis() -> List[Dict[str, Any]]:
        """OCR -> extract fields -> validate format."""
        return [
            {
                "name": "ocr",
                "prompt": (
                    "Extract all text from this document image. "
                    "Return only the text content."
                ),
            },
            {
                "name": "extract_fields",
                "prompt": (
                    "Given this document text:\n{ocr.output}\n\n"
                    "Extract structured fields as JSON with keys: "
                    "title, date, amount, currency, vendor, items."
                ),
                "output_schema": DOCUMENT_FIELDS_SCHEMA,
            },
        ]

    @staticmethod
    def ui_screenshot_analysis() -> List[Dict[str, Any]]:
        """Detect UI elements -> extract text -> describe layout."""
        return [
            {
                "name": "detect",
                "prompt": (
                    "List all UI elements in this screenshot "
                    "(buttons, inputs, labels, images, etc.) "
                    "as a JSON array with type, text, and position."
                ),
                "output_schema": UI_ELEMENTS_SCHEMA,
            },
            {
                "name": "describe",
                "prompt": (
                    "Given these UI elements:\n{detect.output}\n\n"
                    "Describe the overall layout and purpose of this screen."
                ),
            },
        ]

    @staticmethod
    def image_classification() -> List[Dict[str, Any]]:
        """Detect objects -> classify -> generate tags."""
        return [
            {
                "name": "detect",
                "prompt": (
                    "List all objects visible in this image as JSON "
                    "with keys: objects (array of strings), "
                    "description (string), scene_type (string), "
                    "tags (array of strings)."
                ),
                "output_schema": IMAGE_TAGS_SCHEMA,
            },
            {
                "name": "classify",
                "prompt": (
                    "Given these detected objects:\n{detect.output}\n\n"
                    "Provide a detailed classification of the scene "
                    "and suggest relevant categories."
                ),
            },
        ]
