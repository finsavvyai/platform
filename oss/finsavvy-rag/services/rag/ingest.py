import os, sys, json, glob, hashlib
from sqlalchemy import create_engine, text
from sentence_transformers import SentenceTransformer

PGHOST = os.getenv("PGHOST", "127.0.0.1")
PGPORT = os.getenv("PGPORT", "5432")
PGDATABASE = os.getenv("PGDATABASE", "finsavvy_rag")
PGUSER = os.getenv("PGUSER", "postgres")
PGPASSWORD = os.getenv("PGPASSWORD", "postgres")
DB_URL = f"postgresql://{PGUSER}:{PGPASSWORD}@{PGHOST}:{PGPORT}/{PGDATABASE}"

EMBED_MODEL = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
encoder = SentenceTransformer(EMBED_MODEL)
engine = create_engine(DB_URL, pool_pre_ping=True)

def file_id(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        while True:
            b = f.read(8192)
            if not b: break
            h.update(b)
    return h.hexdigest()

def main(corpus_dir):
    paths = []
    for ext in ("*.txt","*.md"):
        paths.extend(glob.glob(os.path.join(corpus_dir, ext)))
    if not paths:
        print("No .txt/.md files found in", corpus_dir)
        return

    with engine.begin() as conn:
        for p in paths:
            with open(p, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            fid = file_id(p)
            vec = encoder.encode([content], convert_to_numpy=True, normalize_embeddings=True)[0].tolist()
            meta = {"path": p}
            conn.execute(text("""
                INSERT INTO documents (doc_id, content, meta, embedding)
                VALUES (:doc_id, :content, :meta, :embedding)
                ON CONFLICT (doc_id) DO UPDATE
                  SET content = EXCLUDED.content,
                      meta    = EXCLUDED.meta,
                      embedding = EXCLUDED.embedding
            """), {
                "doc_id": fid,
                "content": content,
                "meta": json.dumps(meta),
                "embedding": vec
            })
            print("Ingested", p)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python services/rag/ingest.py <corpus_dir>")
        sys.exit(1)
    main(sys.argv[1])
