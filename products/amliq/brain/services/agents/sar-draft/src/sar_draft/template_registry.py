"""Template registry — loads + validates SAR templates from disk.

Validation rules (release-blocking):
- Every entry in `_index.yaml` must have a corresponding `.j2` file.
- Every `.j2` file present on disk must be listed in `_index.yaml`
  (orphan templates are a misconfiguration risk).
- Templates MUST NOT use the `|safe` filter in v0 — autoescape is the
  only safety against template injection in this skeleton.

License: Apache-2.0
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from sar_draft.types import TemplateMeta

INDEX_FILE = "_index.yaml"
TEMPLATE_SUFFIX = ".j2"
# Forbidden in v0: explicit |safe filter in any template body.
_SAFE_FILTER_RE = re.compile(r"\|\s*safe\b")


class TemplateRegistryError(Exception):
    """Raised when the on-disk template set is malformed or inconsistent."""


class TemplateRegistry:
    """Read-only view over the SAR template library."""

    def __init__(self, root: Path) -> None:
        self._root = root
        self._by_id: dict[str, TemplateMeta] = {}
        self._by_alert_type: dict[str, TemplateMeta] = {}
        self._load()

    @classmethod
    def from_default(cls) -> TemplateRegistry:
        """Load from the in-package `templates/` directory."""
        return cls(Path(__file__).parent / "templates")

    def _load(self) -> None:
        index_path = self._root / INDEX_FILE
        if not index_path.is_file():
            raise TemplateRegistryError(f"missing index file: {index_path}")

        try:
            raw = yaml.safe_load(index_path.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            raise TemplateRegistryError(f"malformed yaml: {index_path}") from exc

        if not isinstance(raw, dict) or "templates" not in raw:
            raise TemplateRegistryError(f"index missing 'templates' key: {index_path}")

        entries: Any = raw["templates"]
        if not isinstance(entries, list):
            raise TemplateRegistryError(f"'templates' must be a list: {index_path}")

        listed_files: set[str] = set()
        for entry in entries:
            meta = self._parse_entry(entry, index_path)
            self._validate_template_file(meta)
            listed_files.add(meta.file)
            self._register(meta)

        self._check_no_orphans(listed_files)

    def _parse_entry(self, entry: Any, index_path: Path) -> TemplateMeta:
        if not isinstance(entry, dict):
            raise TemplateRegistryError(f"non-mapping template entry in {index_path}")
        try:
            return TemplateMeta(**entry)
        except ValidationError as exc:
            raise TemplateRegistryError(f"invalid template entry: {exc}") from exc

    def _validate_template_file(self, meta: TemplateMeta) -> None:
        file_path = self._root / meta.file
        if not file_path.is_file():
            raise TemplateRegistryError(
                f"template file missing for id={meta.id!r}: {file_path}"
            )
        body = file_path.read_text(encoding="utf-8")
        if _SAFE_FILTER_RE.search(body):
            raise TemplateRegistryError(
                f"template {meta.id!r} uses forbidden |safe filter in v0"
            )

    def _register(self, meta: TemplateMeta) -> None:
        if meta.id in self._by_id:
            raise TemplateRegistryError(f"duplicate template id: {meta.id!r}")
        self._by_id[meta.id] = meta
        for alert_type in meta.matches_alert_types:
            if alert_type in self._by_alert_type:
                raise TemplateRegistryError(
                    f"alert_type {alert_type!r} maps to multiple templates"
                )
            self._by_alert_type[alert_type] = meta

    def _check_no_orphans(self, listed_files: set[str]) -> None:
        on_disk = {p.name for p in self._root.glob(f"*{TEMPLATE_SUFFIX}")}
        orphans = on_disk - listed_files
        if orphans:
            raise TemplateRegistryError(
                f"orphan template files (not in index): {sorted(orphans)}"
            )

    @property
    def root(self) -> Path:
        return self._root

    def all(self) -> list[TemplateMeta]:
        return list(self._by_id.values())

    def get(self, template_id: str) -> TemplateMeta:
        try:
            return self._by_id[template_id]
        except KeyError as exc:
            raise TemplateRegistryError(f"unknown template id: {template_id!r}") from exc

    def for_alert_type(self, alert_type: str) -> TemplateMeta | None:
        """Return the (single) template matching this alert type, or None."""
        return self._by_alert_type.get(alert_type)

    def read_body(self, template_id: str) -> str:
        meta = self.get(template_id)
        return (self._root / meta.file).read_text(encoding="utf-8")
