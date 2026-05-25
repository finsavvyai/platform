import os
import json
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sentence_transformers import SentenceTransformer
import numpy as np

PGHOST = os.getenv("PGHOST", "127.0.0.1")
PGPORT = os.getenv("PGPORT", "5432")
PGDATABASE = os.getenv("PGDATABASE", "finsavvy_rag")
PGUSER = os.getenv("PGUSER", "postgres")
PGPASSWORD = os.getenv("PGPASSWORD", "postgres")

DB_URL = f"postgresql://{PGUSER}:{PGPASSWORD}@{PGHOST}:{PGPORT}/{PGDATABASE}"
engine = create_engine(DB_URL, pool_pre_ping=True)

EMBED_MODEL = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
encoder = SentenceTransformer(EMBED_MODEL)

app = FastAPI(title="FinSavvyAI RAG API")

class IngestItem(BaseModel):
    doc_id: str
    content: str
    meta: Optional[Dict[str, Any]] = None

class SearchQuery(BaseModel):
    query: str
    k: int = 5

@app.get("/healthz")
def healthz():
    with engine.connect() as conn:
        r = conn.execute(text("SELECT 1")).scalar()
    return {"ok": True, "db": bool(r), "model": EMBED_MODEL}

@app.post("/ingest")
def ingest(items: List[IngestItem]):
    # insert or upsert documents with embeddings
    with engine.begin() as conn:
        for it in items:
            vec = encoder.encode([it.content], convert_to_numpy=True, normalize_embeddings=True)[0]
            meta = json.dumps(it.meta or {})
            # upsert by doc_id
            conn.execute(text("""
                INSERT INTO documents (doc_id, content, meta, embedding)
                VALUES (:doc_id, :content, :meta, :embedding)
                ON CONFLICT (doc_id) DO UPDATE
                  SET content = EXCLUDED.content,
                      meta    = EXCLUDED.meta,
                      embedding = EXCLUDED.embedding
            """), {
                "doc_id": it.doc_id,
                "content": it.content,
                "meta": meta,
                "embedding": vec.tolist()
            })
    return {"ok": True, "count": len(items)}

@app.post("/search")
def search(q: SearchQuery):
    qvec = encoder.encode([q.query], convert_to_numpy=True, normalize_embeddings=True)[0].tolist()
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT doc_id, content, meta,
                   1 - (embedding <=> :qvec::vector) AS score
            FROM documents
            ORDER BY embedding <-> :qvec::vector
            LIMIT :k
        """), {"qvec": qvec, "k": q.k}).mappings().all()
    return {"results": [dict(r) for r in rows]}
