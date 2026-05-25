"""Offline screening mode — screen locally without API calls."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from amliq.models import ScreenResult


class OfflineScreener:
    """Screen entities against locally downloaded sanctions lists."""

    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.entities: list[dict] = []

    def load_lists(self) -> int:
        """Load all JSON list files from the data directory."""
        self.entities = []
        for f in self.data_dir.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
                if isinstance(data, list):
                    self.entities.extend(data)
        return len(self.entities)

    def screen(self, name: str, threshold: float = 0.75) -> list[ScreenResult]:
        """Screen a name against loaded entities using exact + fuzzy matching."""
        query = name.lower().strip()
        results = []
        for entity in self.entities:
            entity_name = entity.get("name", "").lower().strip()
            if not entity_name:
                continue
            score = self._similarity(query, entity_name)
            if score >= threshold:
                results.append(ScreenResult(
                    entity_id=entity.get("id", ""),
                    matched_name=entity.get("name", ""),
                    confidence=score,
                    list_id=entity.get("list_id", ""),
                ))
        results.sort(key=lambda r: r.confidence, reverse=True)
        return results[:50]

    def _similarity(self, a: str, b: str) -> float:
        """Simple Jaccard token similarity for offline mode."""
        tokens_a = set(a.split())
        tokens_b = set(b.split())
        if not tokens_a or not tokens_b:
            return 0.0
        intersection = tokens_a & tokens_b
        union = tokens_a | tokens_b
        return len(intersection) / len(union)


def download_lists(client, output_dir: str) -> int:
    """Download sanctions list snapshot from API for offline use."""
    os.makedirs(output_dir, exist_ok=True)
    data = client._get("/dataset/latest")
    path = Path(output_dir) / "sanctions.json"
    with open(path, "w") as f:
        json.dump(data.get("entities", []), f)
    return len(data.get("entities", []))
