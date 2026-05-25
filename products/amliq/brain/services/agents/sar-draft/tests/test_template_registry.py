"""Tests for `template_registry`.

Covers: happy-path loading from default location, validation of index vs
on-disk files, orphan detection, malformed YAML, missing template files,
the v0 |safe-filter prohibition, and duplicate id detection.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from sar_draft.template_registry import TemplateRegistry, TemplateRegistryError


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _make_minimal_registry(tmp_path: Path) -> Path:
    """Create a small valid registry on disk; return its root."""
    root = tmp_path / "templates"
    _write(
        root / "_index.yaml",
        "templates:\n"
        "  - id: structuring\n"
        "    file: structuring.j2\n"
        "    title: t\n"
        "    required_vars: [alert_id]\n"
        "    matches_alert_types: [structuring]\n",
    )
    _write(root / "structuring.j2", "Alert: {{ alert_id }}\n")
    return root


def test_default_registry_loads() -> None:
    reg = TemplateRegistry.from_default()
    ids = {m.id for m in reg.all()}
    assert {"structuring", "unusual_activity", "insider_trading", "sanctions_evasion"} <= ids


def test_default_registry_alert_type_routing() -> None:
    reg = TemplateRegistry.from_default()
    meta = reg.for_alert_type("structuring")
    assert meta is not None
    assert meta.id == "structuring"
    assert reg.for_alert_type("does_not_exist") is None


def test_minimal_registry_round_trip(tmp_path: Path) -> None:
    root = _make_minimal_registry(tmp_path)
    reg = TemplateRegistry(root)
    assert reg.get("structuring").file == "structuring.j2"
    assert "{{ alert_id }}" in reg.read_body("structuring")


def test_missing_index_raises(tmp_path: Path) -> None:
    with pytest.raises(TemplateRegistryError, match="missing index file"):
        TemplateRegistry(tmp_path / "nope")


def test_malformed_yaml_raises(tmp_path: Path) -> None:
    root = tmp_path / "t"
    _write(root / "_index.yaml", "templates: [\nunterminated")
    with pytest.raises(TemplateRegistryError, match="malformed yaml"):
        TemplateRegistry(root)


def test_index_missing_templates_key(tmp_path: Path) -> None:
    root = tmp_path / "t"
    _write(root / "_index.yaml", "other: 1\n")
    with pytest.raises(TemplateRegistryError, match="missing 'templates' key"):
        TemplateRegistry(root)


def test_index_templates_not_a_list(tmp_path: Path) -> None:
    root = tmp_path / "t"
    _write(root / "_index.yaml", "templates: 5\n")
    with pytest.raises(TemplateRegistryError, match="must be a list"):
        TemplateRegistry(root)


def test_invalid_entry_shape(tmp_path: Path) -> None:
    root = tmp_path / "t"
    _write(root / "_index.yaml", "templates:\n  - 'not a mapping'\n")
    with pytest.raises(TemplateRegistryError, match="non-mapping"):
        TemplateRegistry(root)


def test_entry_validation_error(tmp_path: Path) -> None:
    root = tmp_path / "t"
    _write(
        root / "_index.yaml",
        "templates:\n  - id: ''\n    file: x.j2\n    title: t\n",
    )
    with pytest.raises(TemplateRegistryError, match="invalid template entry"):
        TemplateRegistry(root)


def test_missing_template_file_raises(tmp_path: Path) -> None:
    root = tmp_path / "t"
    _write(
        root / "_index.yaml",
        "templates:\n  - id: a\n    file: a.j2\n    title: t\n",
    )
    with pytest.raises(TemplateRegistryError, match="template file missing"):
        TemplateRegistry(root)


def test_no_safe_filter_in_templates(tmp_path: Path) -> None:
    """v0 forbids the |safe filter in any template body."""
    root = tmp_path / "t"
    _write(
        root / "_index.yaml",
        "templates:\n  - id: bad\n    file: bad.j2\n    title: t\n",
    )
    _write(root / "bad.j2", "Hello {{ name|safe }}\n")
    with pytest.raises(TemplateRegistryError, match="forbidden \\|safe filter"):
        TemplateRegistry(root)


def test_orphan_file_raises(tmp_path: Path) -> None:
    root = _make_minimal_registry(tmp_path)
    _write(root / "orphan.j2", "orphan\n")
    with pytest.raises(TemplateRegistryError, match="orphan template files"):
        TemplateRegistry(root)


def test_duplicate_id_raises(tmp_path: Path) -> None:
    root = tmp_path / "t"
    _write(
        root / "_index.yaml",
        "templates:\n"
        "  - id: a\n    file: a.j2\n    title: t\n"
        "  - id: a\n    file: b.j2\n    title: t\n",
    )
    _write(root / "a.j2", "a\n")
    _write(root / "b.j2", "b\n")
    with pytest.raises(TemplateRegistryError, match="duplicate template id"):
        TemplateRegistry(root)


def test_alert_type_collision_raises(tmp_path: Path) -> None:
    root = tmp_path / "t"
    _write(
        root / "_index.yaml",
        "templates:\n"
        "  - id: a\n    file: a.j2\n    title: t\n    matches_alert_types: [x]\n"
        "  - id: b\n    file: b.j2\n    title: t\n    matches_alert_types: [x]\n",
    )
    _write(root / "a.j2", "a\n")
    _write(root / "b.j2", "b\n")
    with pytest.raises(TemplateRegistryError, match="maps to multiple templates"):
        TemplateRegistry(root)


def test_get_unknown_template_raises() -> None:
    reg = TemplateRegistry.from_default()
    with pytest.raises(TemplateRegistryError, match="unknown template id"):
        reg.get("does_not_exist")


def test_root_property_exposes_path() -> None:
    reg = TemplateRegistry.from_default()
    assert reg.root.is_dir()
