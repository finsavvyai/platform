"""ClawPipe + ChromaDB RAG example.

Index documents, then ask questions with retrieval-augmented generation.
ClawPipe's pipeline caches repeated queries, compresses context, and
routes to the cheapest viable model -- cutting RAG costs 30-50%.

Usage:
    python main.py index ./docs/          # Index a directory of .txt/.md files
    python main.py ask "What is X?"       # Ask a question
    python main.py stats                  # Show pipeline cost savings
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import chromadb
from clawpipe import ClawPipe, ClawPipeConfig

COLLECTION_NAME = "documents"

pipe = ClawPipe(
    ClawPipeConfig(
        api_key=os.environ.get("CLAWPIPE_API_KEY", ""),
        project_id="python-rag",
        gateway_url=os.environ.get("CLAWPIPE_GATEWAY", None),
        enable_booster=True,
        enable_packer=True,
        enable_cache=True,
    )
)

chroma = chromadb.Client()
collection = chroma.get_or_create_collection(COLLECTION_NAME)


def index_directory(directory: str) -> None:
    """Index all .txt and .md files in a directory."""
    path = Path(directory)
    if not path.is_dir():
        print(f"Error: {directory} is not a directory")
        sys.exit(1)

    files = list(path.glob("**/*.txt")) + list(path.glob("**/*.md"))
    if not files:
        print(f"No .txt or .md files found in {directory}")
        return

    docs, ids, metas = [], [], []
    for f in files:
        content = f.read_text(encoding="utf-8")
        chunks = split_into_chunks(content, max_tokens=500)
        for i, chunk in enumerate(chunks):
            doc_id = f"{f.stem}_{i}"
            docs.append(chunk)
            ids.append(doc_id)
            metas.append({"source": str(f), "chunk": i})

    collection.add(documents=docs, ids=ids, metadatas=metas)
    print(f"Indexed {len(docs)} chunks from {len(files)} files.")


def split_into_chunks(text: str, max_tokens: int = 500) -> list[str]:
    """Split text into chunks of roughly max_tokens size."""
    words = text.split()
    chunks, current = [], []
    count = 0
    for word in words:
        current.append(word)
        count += 1
        if count >= max_tokens:
            chunks.append(" ".join(current))
            current, count = [], 0
    if current:
        chunks.append(" ".join(current))
    return chunks


def retrieve(query: str, n_results: int = 5) -> str:
    """Retrieve relevant chunks from ChromaDB."""
    results = collection.query(query_texts=[query], n_results=n_results)
    if not results["documents"] or not results["documents"][0]:
        return ""
    docs = results["documents"][0]
    return "\n\n".join(
        f"[{i + 1}] {doc}" for i, doc in enumerate(docs)
    )


async def ask(question: str) -> None:
    """Ask a question with RAG context through ClawPipe."""
    context = retrieve(question)
    if not context:
        print("No documents indexed. Run: python main.py index ./docs/")
        return

    prompt = (
        "Use the following context to answer the question.\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {question}"
    )

    result = await pipe.prompt(
        prompt,
        system="Answer based on the provided context. Cite sources as [1], [2], etc.",
        max_tokens=1024,
    )

    print(f"\n{result.text}\n")
    print(f"--- Pipeline Info ---")
    print(f"Model:     {result.meta.model or 'booster'}")
    print(f"Latency:   {result.meta.latency_ms}ms")
    print(f"Cost:      ${result.meta.estimated_cost_usd:.4f}")
    print(f"Cached:    {result.meta.cached}")
    print(f"Boosted:   {result.meta.boosted}")
    print(f"Savings:   {result.meta.context_savings}")


def show_stats() -> None:
    """Show aggregate pipeline statistics."""
    s = pipe.stats()
    print(f"\n--- ClawPipe Stats ---")
    print(f"Total requests:       {s.total_requests}")
    print(f"Total tokens in:      {s.total_tokens_in}")
    print(f"Total tokens out:     {s.total_tokens_out}")
    print(f"Total cost:           ${s.total_cost_usd:.4f}")
    print(f"Saved by cache:       {s.total_saved_by_cache} requests")
    print(f"Saved by booster:     {s.total_saved_by_booster} requests")
    print(f"Cache hit rate:       {s.cache_hit_rate}")
    print(f"Avg latency:          {s.avg_latency_ms:.0f}ms")


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    command = sys.argv[1]
    if command == "index" and len(sys.argv) >= 3:
        index_directory(sys.argv[2])
    elif command == "ask" and len(sys.argv) >= 3:
        asyncio.run(ask(" ".join(sys.argv[2:])))
    elif command == "stats":
        show_stats()
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
