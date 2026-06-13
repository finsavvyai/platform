"""
Tests for the RAG FastAPI service (``services/rag/app.py``).

Covers request/response and validation paths for ``/healthz``, ``/ingest``
and ``/search``. The DB and embedding model are faked (see conftest), so no
Postgres or model download is required.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from _fakes import FakeResult


@pytest.fixture()
def client(rag_module):
    return TestClient(rag_module.app)


# --- /healthz -------------------------------------------------------------
def test_healthz_reports_ok_and_model(client, rag_module):
    res = client.get("/healthz")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["db"] is True  # FakeEngine SELECT 1 -> scalar 1 -> bool True
    assert body["model"] == rag_module.EMBED_MODEL
    # Exactly one SELECT 1 issued.
    assert any("SELECT 1" in c["sql"] for c in rag_module.engine.calls)


def test_healthz_db_false_when_scalar_zero(client, rag_module):
    rag_module.engine.result_for = lambda sql, params: FakeResult(scalar=0)
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json()["db"] is False


# --- /ingest --------------------------------------------------------------
def test_ingest_single_item_upserts_and_counts(client, rag_module):
    payload = [{"doc_id": "d1", "content": "hello world", "meta": {"k": "v"}}]
    res = client.post("/ingest", json=payload)
    assert res.status_code == 200
    assert res.json() == {"ok": True, "count": 1}

    calls = rag_module.engine.calls
    assert len(calls) == 1
    assert "INSERT INTO documents" in calls[0]["sql"]
    assert "ON CONFLICT (doc_id) DO UPDATE" in calls[0]["sql"]
    params = calls[0]["params"]
    assert params["doc_id"] == "d1"
    assert params["content"] == "hello world"
    # meta serialised to JSON string; embedding is a list of floats.
    assert json.loads(params["meta"]) == {"k": "v"}
    assert isinstance(params["embedding"], list)
    assert len(params["embedding"]) == 8  # fake encoder DIM


def test_ingest_multiple_items(client, rag_module):
    payload = [
        {"doc_id": "a", "content": "alpha"},
        {"doc_id": "b", "content": "beta"},
        {"doc_id": "c", "content": "gamma"},
    ]
    res = client.post("/ingest", json=payload)
    assert res.status_code == 200
    assert res.json() == {"ok": True, "count": 3}
    assert len(rag_module.engine.calls) == 3


def test_ingest_defaults_meta_to_empty_object(client, rag_module):
    payload = [{"doc_id": "d", "content": "no meta"}]
    res = client.post("/ingest", json=payload)
    assert res.status_code == 200
    params = rag_module.engine.calls[0]["params"]
    assert json.loads(params["meta"]) == {}


def test_ingest_empty_list_is_valid_zero_count(client, rag_module):
    res = client.post("/ingest", json=[])
    assert res.status_code == 200
    assert res.json() == {"ok": True, "count": 0}
    assert rag_module.engine.calls == []


def test_ingest_missing_required_field_is_422(client):
    # 'content' is required by IngestItem.
    res = client.post("/ingest", json=[{"doc_id": "x"}])
    assert res.status_code == 422


def test_ingest_rejects_non_list_body(client):
    # Endpoint expects a list; an object should fail validation.
    res = client.post("/ingest", json={"doc_id": "x", "content": "y"})
    assert res.status_code == 422


# --- /search --------------------------------------------------------------
def test_search_returns_scored_rows(client, rag_module):
    rows = [
        {"doc_id": "d1", "content": "first", "meta": {"path": "p1"}, "score": 0.92},
        {"doc_id": "d2", "content": "second", "meta": {"path": "p2"}, "score": 0.41},
    ]

    def result_for(sql, params):
        assert "embedding <=> :qvec::vector" in sql  # cosine score select
        assert params["k"] == 2
        assert isinstance(params["qvec"], list)
        return FakeResult(rows=rows)

    rag_module.engine.result_for = result_for

    res = client.post("/search", json={"query": "find me", "k": 2})
    assert res.status_code == 200
    body = res.json()
    assert body["results"] == rows


def test_search_defaults_k_to_5(client, rag_module):
    seen = {}

    def result_for(sql, params):
        seen["k"] = params["k"]
        return FakeResult(rows=[])

    rag_module.engine.result_for = result_for
    res = client.post("/search", json={"query": "q"})
    assert res.status_code == 200
    assert seen["k"] == 5
    assert res.json() == {"results": []}


def test_search_missing_query_is_422(client):
    res = client.post("/search", json={"k": 3})
    assert res.status_code == 422


def test_search_wrong_type_k_is_422(client):
    res = client.post("/search", json={"query": "q", "k": "not-an-int"})
    assert res.status_code == 422
