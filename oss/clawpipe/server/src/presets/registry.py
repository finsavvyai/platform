"""PresetRegistry — CRUD operations for role presets."""

from __future__ import annotations

from copy import deepcopy
from typing import Optional

from src.presets.defaults import DEFAULT_PRESETS


class PresetRegistry:
    """In-memory registry of role presets with CRUD support."""

    def __init__(self, load_defaults: bool = True) -> None:
        self._presets: dict[str, dict] = {}
        if load_defaults:
            for preset in DEFAULT_PRESETS:
                self._presets[preset["id"]] = deepcopy(preset)

    def get(self, preset_id: str) -> Optional[dict]:
        """Return a preset by ID, or None."""
        preset = self._presets.get(preset_id)
        return deepcopy(preset) if preset else None

    def list(self, category: str | None = None) -> list[dict]:
        """Return all presets, optionally filtered by category."""
        presets = list(self._presets.values())
        if category:
            presets = [p for p in presets if p.get("category") == category]
        return deepcopy(presets)

    def add(self, preset: dict) -> dict:
        """Add a new preset. Raises ValueError if ID already exists."""
        preset_id = preset.get("id")
        if not preset_id:
            raise ValueError("Preset must have an 'id' field")
        if preset_id in self._presets:
            raise ValueError(f"Preset '{preset_id}' already exists")
        self._validate(preset)
        self._presets[preset_id] = deepcopy(preset)
        return deepcopy(preset)

    def update(self, preset_id: str, updates: dict) -> dict:
        """Update an existing preset. Raises KeyError if not found."""
        if preset_id not in self._presets:
            raise KeyError(f"Preset '{preset_id}' not found")
        merged = {**self._presets[preset_id], **updates, "id": preset_id}
        self._validate(merged)
        self._presets[preset_id] = merged
        return deepcopy(merged)

    def delete(self, preset_id: str) -> bool:
        """Delete a preset by ID. Returns True if deleted."""
        if preset_id not in self._presets:
            raise KeyError(f"Preset '{preset_id}' not found")
        del self._presets[preset_id]
        return True

    def count(self) -> int:
        """Return the number of registered presets."""
        return len(self._presets)

    @staticmethod
    def _validate(preset: dict) -> None:
        """Validate required preset fields."""
        required = ("id", "name", "description", "system_prompt", "category")
        missing = [f for f in required if not preset.get(f)]
        if missing:
            raise ValueError(f"Missing required fields: {', '.join(missing)}")
