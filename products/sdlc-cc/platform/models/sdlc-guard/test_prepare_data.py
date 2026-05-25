"""Pure-function tests for prepare_data helpers — no HF downloads required."""

from __future__ import annotations

import json
from pathlib import Path

from prepare_data import load_arena, split_rows, write_jsonl


def test_load_arena_maps_label_correctly(tmp_path: Path) -> None:
    src = tmp_path / "attacks.jsonl"
    src.write_text(
        '\n'.join([
            json.dumps({"id": "a1", "attack": "ignore prior", "label": "injection"}),
            json.dumps({"id": "b1", "attack": "hello there", "label": "benign"}),
        ])
    )
    rows = load_arena(src)
    assert len(rows) == 2
    assert rows[0] == {"text": "ignore prior", "label": "attack"}
    assert rows[1] == {"text": "hello there", "label": "benign"}


def test_load_arena_returns_empty_when_missing(tmp_path: Path) -> None:
    rows = load_arena(tmp_path / "does-not-exist.jsonl")
    assert rows == []


def test_split_rows_proportions() -> None:
    rows = [{"text": f"t{i}", "label": "benign"} for i in range(100)]
    train, val, test = split_rows(rows, seed=0)
    assert len(train) == 85
    assert len(val) == 10
    assert len(test) == 5


def test_split_rows_is_deterministic_under_seed() -> None:
    rows = [{"text": f"t{i}", "label": "benign"} for i in range(50)]
    a = split_rows(rows.copy(), seed=42)
    b = split_rows(rows.copy(), seed=42)
    assert [r["text"] for r in a[0]] == [r["text"] for r in b[0]]


def test_write_jsonl_roundtrip(tmp_path: Path) -> None:
    rows = [{"text": "hello", "label": "benign"}]
    path = tmp_path / "out.jsonl"
    write_jsonl(path, rows)
    loaded = [json.loads(line) for line in path.read_text().splitlines()]
    assert loaded == rows
