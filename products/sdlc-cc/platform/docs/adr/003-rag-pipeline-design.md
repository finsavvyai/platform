# ADR-003: RAG Pipeline Design

## Status
Accepted

## Date
2025-08-15

## Context
Enterprise customers need accurate, citation-backed answers from their proprietary documents. The RAG pipeline must support multiple document formats, languages, and LLM providers while maintaining low latency and high accuracy.

## Decision
Multi-stage RAG pipeline:
1. **Ingestion**: Async document processing (PDF, DOCX, HTML, Markdown) with OCR fallback
2. **Chunking**: Semantic chunking with overlap, respecting document structure (headings, tables)
3. **Embedding**: OpenAI text-embedding-3-large (1536 dims), with fallback to local sentence-transformers
4. **Storage**: pgvector for vector storage with IVFFlat indexing
5. **Retrieval**: Hybrid search (vector similarity + BM25 keyword), re-ranking with cross-encoder
6. **Generation**: Multi-provider LLM support (OpenAI, Anthropic) with streaming responses
7. **Citation**: Source attribution with chunk-level references

## Consequences
- **Positive**: High accuracy, provider flexibility, audit trail for citations
- **Negative**: Higher latency than simple keyword search, embedding cost at scale
- **Mitigations**: Embedding caching in Redis, async batch processing, tiered storage

## Alternatives Considered
1. **Elasticsearch-only** — Good for keyword search but lacks semantic understanding
2. **Pinecone/Weaviate** — External vector DB adds vendor lock-in and network latency
3. **Local-only models** — Insufficient quality for enterprise use cases
