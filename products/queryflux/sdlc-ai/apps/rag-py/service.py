from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
try:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("all-MiniLM-L6-v2")
except Exception:
    model = None

app = FastAPI(title="SDLC RAG Service")

class IndexRequest(BaseModel):
    tenant: str
    namespace: str
    texts: List[str]

class RetrieveRequest(BaseModel):
    tenant: str
    namespace: str
    query: str
    top_k: int = 8

@app.get("/v1/health")
async def health():
    return {"status":"ok", "model_loaded": model is not None}

@app.post("/v1/index")
async def index_docs(req: IndexRequest):
    # TODO: DLP sanitize + store embeddings
    return {"status": "queued", "count": len(req.texts)}

@app.post("/v1/retrieve")
async def retrieve(req: RetrieveRequest):
    # TODO: hybrid (BM25 + vectors)
    return {"chunks": [], "citations": []}
