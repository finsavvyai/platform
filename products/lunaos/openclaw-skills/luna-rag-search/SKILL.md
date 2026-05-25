---
name: luna-rag-search
description: Semantic search across your indexed codebase using LunaOS RAG — find relevant code, patterns, and implementations
homepage: https://agents.lunaos.ai
---

# Luna RAG Search

When the user wants to search their codebase semantically (not just grep), use this skill. It searches across code that was previously indexed with `luna index`.

## How to use

1. Take the user's natural language query.

2. Search the indexed codebase:

```bash
curl -s "https://api.lunaos.ai/rag/search?q=$(echo '<user query>' | jq -sRr @uri)" \
  -H "Authorization: Bearer $LUNAOS_API_KEY"
```

3. The response contains:
   - `query` — the original query
   - `answer` — AI-generated answer with context
   - `sources` — array of matching code snippets with paths and relevance scores
   - `confidence` — 0-1 confidence score

4. Present the sources sorted by relevance score. Show the file path and relevant code snippet.

## Indexing (first-time setup)

If the user hasn't indexed their project yet, tell them to run:

```bash
# Install Luna CLI
npm install -g @luna-agents/cli

# Index the current project
luna index --cloud
```

Or index via API:

```bash
curl -s -X POST https://api.lunaos.ai/rag/index \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      { "path": "src/index.ts", "content": "..." }
    ],
    "repoName": "my-project"
  }'
```

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key

## When to use

- User asks "where is X implemented?"
- User asks "how does Y work in my codebase?"
- User wants to find related code patterns
- User asks "who uses this function?"

## When NOT to use

- Exact string search (use grep/ripgrep directly)
- Searching external code (use web_search)
