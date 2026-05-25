---
name: ll-smart-search
displayName: Luna Smart Search
description: Multi-engine search — combines RAG, Nexa embeddings, and grep for the best code search results
version: 1.0.0
category: ai
agent: luna-rag-enhanced
parameters:
  - name: query
    type: string
    description: Natural language question or search query
    required: true
    prompt: true
workflow:
  - parse_query_intent
  - search_rag_embeddings
  - search_nexa_semantic
  - search_text_grep
  - rank_and_merge_results
  - generate_answer
output: []
prerequisites: []
---

# Luna Smart Search

The best code search — combines three engines for comprehensive results.

## What This Command Does

1. **Parse Intent** — understands if you're looking for code, concepts, or patterns
2. **RAG Search** — Cloudflare Vectorize embeddings for documentation-level search
3. **Nexa Search** — ChromaDB semantic embeddings for code-level search
4. **Text Search** — ripgrep for exact matches and regex patterns
5. **Rank & Merge** — combines results, removes duplicates, ranks by relevance
6. **Answer** — generates a natural language answer with code references

## Usage

```
/search "how does authentication work in this project?"
/search "where is the billing webhook handler?"
/search "what components use the useAuth hook?"
/search "find all API endpoints that require admin role"
```

## Search Engines

| Engine | Best For |
|--------|---------|
| **RAG** | Conceptual questions, architecture, "how does X work" |
| **Nexa** | Semantic code similarity, "code that does X" |
| **Grep** | Exact matches, function names, import paths |

## Differs from /q

- `/q` uses RAG only (single engine)
- `/search` combines RAG + Nexa + grep (multi-engine, better results)
