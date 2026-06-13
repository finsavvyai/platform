"""
Shared pytest fixtures and import-time stubs for the finsavvy-rag suite.

The RAG service (`services/rag/app.py`) and the ingest CLI
(`services/rag/ingest.py`) both instantiate a `SentenceTransformer` model
and a SQLAlchemy engine at *module import time*. A real model download or a
live Postgres are neither available nor desirable in CI, so this conftest:

  1. Installs a lightweight fake `sentence_transformers` module into
     ``sys.modules`` *before* the app is imported. The fake returns a
     deterministic unit vector instead of running a transformer.
  2. Points the service at a SQLite URL so SQLAlchemy can build an engine
     object without a Postgres server. The engine is never actually used to
     touch a DB in unit tests — the connection layer is monkeypatched per
     test via the helpers in ``tests/_fakes.py``.

These stubs keep the suite hermetic: no network, no GPU, no Postgres.
"""

from __future__ import annotations

import os
import sys
import types
from pathlib import Path

import pytest

# --- repo paths -----------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[1]
RAG_DIR = REPO_ROOT / "services" / "rag"
GATEWAY_DIR = REPO_ROOT / "services" / "gateway"
TESTS_DIR = Path(__file__).resolve().parent

# Only the tests dir goes on sys.path (for ``_fakes``). The two service apps
# are both named ``app.py``; importing them by name would collide, so they
# are loaded from explicit file paths via ``load_module_from`` below.
if str(TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(TESTS_DIR))


def load_module_from(name: str, path: Path):
    """Import a module from an explicit file path under a unique name.

    Avoids the ``app.py`` name collision between the rag and gateway
    services by registering each under a distinct module name.
    """
    import importlib.util

    sys.modules.pop(name, None)
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


# --- fake sentence_transformers ------------------------------------------
class _FakeEncoder:
    """Deterministic stand-in for ``SentenceTransformer``.

    ``encode`` returns a small fixed-dimension numpy array per input text so
    callers that do ``encoder.encode([text], ...)[0].tolist()`` get a stable,
    JSON-serialisable vector without loading a real model.
    """

    DIM = 8

    def __init__(self, *_args, **_kwargs) -> None:  # noqa: D401 - mimic ctor
        self.name = "fake-encoder"

    def encode(self, texts, convert_to_numpy=True, normalize_embeddings=True):
        import numpy as np

        rows = []
        for t in texts:
            # Cheap deterministic embedding: hash chars into DIM buckets.
            vec = np.zeros(self.DIM, dtype="float32")
            for i, ch in enumerate(str(t)):
                vec[i % self.DIM] += (ord(ch) % 17) + 1
            norm = float(np.linalg.norm(vec)) or 1.0
            rows.append(vec / norm)
        return np.array(rows, dtype="float32")


def _install_fake_sentence_transformers() -> None:
    if "sentence_transformers" in sys.modules:
        return
    mod = types.ModuleType("sentence_transformers")
    mod.SentenceTransformer = _FakeEncoder  # type: ignore[attr-defined]
    sys.modules["sentence_transformers"] = mod


# Force a SQLite URL so create_engine() succeeds without psycopg2/Postgres.
# Individual tests monkeypatch engine.connect/.begin, so the URL is inert.
os.environ.setdefault("EMBED_MODEL", "fake-encoder")
_install_fake_sentence_transformers()


@pytest.fixture()
def fake_engine():
    """A fresh in-memory fake SQLAlchemy engine per test."""
    from _fakes import FakeEngine

    return FakeEngine()


@pytest.fixture()
def rag_module(monkeypatch, fake_engine):
    """Import ``services/rag/app.py`` fresh with stubbed deps.

    ``sqlalchemy.create_engine`` is patched to hand back the per-test
    :class:`FakeEngine` so importing the app never reaches a real Postgres
    (no psycopg2 connection, no driver requirement). The fake encoder from
    the module-level stub supplies deterministic embeddings.

    Returns the imported module so a test can read ``module.engine.calls`` or
    re-script ``module.engine.result_for``.
    """
    monkeypatch.setenv("PGDATABASE", "finsavvy_rag_test")

    import sqlalchemy

    monkeypatch.setattr(sqlalchemy, "create_engine", lambda *a, **k: fake_engine)

    rag_app = load_module_from("finsavvy_rag_app", RAG_DIR / "app.py")
    # The module captured the patched create_engine result at import time.
    assert rag_app.engine is fake_engine
    return rag_app
