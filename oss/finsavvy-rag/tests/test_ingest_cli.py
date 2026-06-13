"""
Tests for the ingest CLI (``services/rag/ingest.py``).

Exercises file hashing, the corpus glob + upsert loop, and the empty-corpus
guard. The encoder and SQLAlchemy engine are faked, so no model download or
Postgres connection is required.
"""

from __future__ import annotations

import json

import pytest
import sqlalchemy

from conftest import RAG_DIR, load_module_from
from _fakes import FakeEngine


@pytest.fixture()
def ingest_module(monkeypatch, fake_engine):
    monkeypatch.setattr(sqlalchemy, "create_engine", lambda *a, **k: fake_engine)
    mod = load_module_from("finsavvy_rag_ingest", RAG_DIR / "ingest.py")
    assert mod.engine is fake_engine
    return mod


def test_file_id_is_stable_sha1(ingest_module, tmp_path):
    p = tmp_path / "a.txt"
    p.write_text("hello", encoding="utf-8")
    first = ingest_module.file_id(str(p))
    second = ingest_module.file_id(str(p))
    assert first == second
    assert len(first) == 40  # sha1 hex digest


def test_main_ingests_txt_and_md(ingest_module, tmp_path, capsys):
    (tmp_path / "one.txt").write_text("first doc", encoding="utf-8")
    (tmp_path / "two.md").write_text("second doc", encoding="utf-8")
    (tmp_path / "ignored.pdf").write_text("nope", encoding="utf-8")

    ingest_module.main(str(tmp_path))

    calls = ingest_module.engine.calls
    assert len(calls) == 2  # txt + md only, pdf ignored
    for c in calls:
        assert "INSERT INTO documents" in c["sql"]
        assert "ON CONFLICT (doc_id) DO UPDATE" in c["sql"]
        assert len(c["params"]["doc_id"]) == 40
        assert isinstance(c["params"]["embedding"], list)
        meta = json.loads(c["params"]["meta"])
        assert "path" in meta

    out = capsys.readouterr().out
    assert "Ingested" in out


def test_main_empty_corpus_warns_and_skips(ingest_module, tmp_path, capsys):
    ingest_module.main(str(tmp_path))
    assert ingest_module.engine.calls == []
    assert "No .txt/.md files found" in capsys.readouterr().out
