"""
Shared pytest fixtures for the RAG service.

The Postgres+pgvector fixture spins up a real database in a container so
integration tests run against the same engine production uses. Mark tests
that need it with ``@pytest.mark.integration``; unit tests that don't
import this fixture do not pay the container cost.
"""

from __future__ import annotations

import os
from collections.abc import Generator

import pytest


@pytest.fixture(scope="session")
def pg_container() -> Generator[dict[str, str], None, None]:
    """Spin a pgvector-enabled Postgres container for the test session.

    Yields a dict with connection details. Skips the test if Docker is not
    available on the host (so CI without Docker still runs unit tests).
    """
    try:
        from testcontainers.postgres import PostgresContainer
    except ImportError:
        pytest.skip("testcontainers not installed; pip install -r requirements-dev.txt")

    image = os.environ.get("PGVECTOR_IMAGE", "pgvector/pgvector:pg16")
    try:
        container = PostgresContainer(image=image)
        container.start()
    except Exception as exc:  # docker daemon missing or unreachable
        pytest.skip(f"could not start pgvector container ({exc})")

    try:
        yield {
            "host": container.get_container_host_ip(),
            "port": str(container.get_exposed_port(5432)),
            "user": container.username,
            "password": container.password,
            "database": container.dbname,
            "url": container.get_connection_url(),
        }
    finally:
        container.stop()


@pytest.fixture(scope="session")
def pg_url(pg_container: dict[str, str]) -> str:
    """Convenience: just the SQLAlchemy URL."""
    # testcontainers default URL uses psycopg2; switch to asyncpg for
    # async SQLAlchemy engines used in the RAG service.
    return pg_container["url"].replace("psycopg2", "asyncpg", 1)
