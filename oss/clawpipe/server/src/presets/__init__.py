"""Role presets — reusable AI persona configurations."""

from src.presets.registry import PresetRegistry

_default_registry = PresetRegistry()


def get_preset(preset_id: str) -> dict | None:
    """Return a preset by ID, or None if not found."""
    return _default_registry.get(preset_id)


def list_presets(category: str | None = None) -> list[dict]:
    """Return all presets, optionally filtered by category."""
    return _default_registry.list(category=category)


__all__ = ["get_preset", "list_presets", "PresetRegistry"]
