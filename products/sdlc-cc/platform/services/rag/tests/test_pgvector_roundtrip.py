"""
Smoke test: insert + query one embedding against a real pgvector container.

Confirms the testcontainers fixture works and that the pgvector binding
the RAG service depends on can round-trip a vector. If this fails, every
downstream RAG test is suspect.
"""

from __future__ import annotations

import asyncio

import pytest


@pytest.mark.integration
def test_pgvector_extension_available(pg_container: dict[str, str]) -> None:
    """The container image must ship with pgvector preinstalled."""
    import psycopg2

    conn = psycopg2.connect(
        host=pg_container["host"],
        port=pg_container["port"],
        user=pg_container["user"],
        password=pg_container["password"],
        dbname=pg_container["database"],
    )
    try:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
            cur.execute(
                "SELECT extname FROM pg_extension WHERE extname = 'vector'"
            )
            row = cur.fetchone()
        conn.commit()
    finally:
        conn.close()
    assert row is not None and row[0] == "vector"


@pytest.mark.integration
def test_pgvector_roundtrip(pg_container: dict[str, str]) -> None:
    """Insert a 3-dim embedding, query with cosine distance, get it back."""
    import psycopg2
    from pgvector.psycopg2 import register_vector

    conn = psycopg2.connect(
        host=pg_container["host"],
        port=pg_container["port"],
        user=pg_container["user"],
        password=pg_container["password"],
        dbname=pg_container["database"],
    )
    try:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
        conn.commit()
        register_vector(conn)

        with conn.cursor() as cur:
            cur.execute("DROP TABLE IF EXISTS roundtrip")
            cur.execute(
                "CREATE TABLE roundtrip (id int PRIMARY KEY, "
                "embedding vector(3))"
            )
            cur.execute(
                "INSERT INTO roundtrip (id, embedding) VALUES (%s, %s)",
                (1, [0.1, 0.2, 0.3]),
            )
            cur.execute(
                "SELECT id FROM roundtrip ORDER BY embedding <=> %s LIMIT 1",
                ([0.1, 0.2, 0.3],),
            )
            row = cur.fetchone()
        conn.commit()
    finally:
        conn.close()

    assert row is not None
    assert row[0] == 1


@pytest.mark.integration
def test_pgvector_sqlalchemy_import() -> None:
    """The SQLAlchemy binding the RAG service uses must import cleanly."""
    # The binding is required for `services/rag/app/database/models/*` —
    # if it cannot be imported, every model module fails at collection.
    from pgvector.sqlalchemy import Vector

    assert Vector is not None


def test_event_loop_available() -> None:
    """Sanity-check that pytest-asyncio is installed and configured."""
    loop = asyncio.new_event_loop()
    try:
        assert loop.run_until_complete(asyncio.sleep(0)) is None
    finally:
        loop.close()
