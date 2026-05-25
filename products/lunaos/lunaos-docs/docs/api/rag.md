# RAG API

The RAG (Retrieval-Augmented Generation) pipeline lets you index your codebase and give agents deep contextual understanding of your project.

## Index Code

Upload code to the RAG pipeline for vectorization.

```http
POST /rag/index
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "files": [
    {
      "path": "src/auth.ts",
      "content": "export function authenticate(token: string) { ... }"
    },
    {
      "path": "src/database.ts",
      "content": "export class Database { ... }"
    }
  ],
  "repository": "my-project"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array | ✅ | Array of `{path, content}` objects |
| `repository` | string | ❌ | Repository identifier for grouping |

**Response (200):**

```json
{
  "indexed": 2,
  "vectors": 15,
  "repository": "my-project",
  "message": "2 files indexed (15 vectors)"
}
```

---

## Search Code

Query the indexed codebase using semantic search.

```http
POST /rag/search
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "query": "How does authentication work?",
  "repository": "my-project",
  "limit": 5
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | ✅ | Natural language search query |
| `repository` | string | ❌ | Filter by repository |
| `limit` | number | ❌ | Max results (default: 5, max: 20) |

**Response (200):**

```json
{
  "results": [
    {
      "path": "src/auth.ts",
      "content": "export function authenticate(token: string) {\n  const decoded = jwt.verify(token, SECRET);\n  return decoded;\n}",
      "score": 0.92,
      "chunk": 3
    },
    {
      "path": "src/middleware/auth.ts",
      "content": "export const requireAuth = async (req, res, next) => {\n  const token = req.headers.authorization?.split(' ')[1];\n  ...\n}",
      "score": 0.87,
      "chunk": 1
    }
  ],
  "query": "How does authentication work?",
  "total": 2
}
```

---

## Using RAG with Agents

Combine RAG context with agent execution for codebase-aware analysis:

```bash
# 1. Index your codebase
find src -name "*.ts" | while read f; do
  echo "{\"path\":\"$f\",\"content\":$(cat "$f" | jq -Rs .)}"
done | jq -s '{files: .}' | \
curl -X POST https://api.lunaos.ai/rag/index \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @-

# 2. Search for relevant context
CONTEXT=$(curl -s -X POST https://api.lunaos.ai/rag/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication flow"}' \
  | jq -r '.results[].content' | head -c 4000)

# 3. Run agent with RAG context
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agent\": \"code-review\", \"context\": \"$CONTEXT\"}"
```

## How RAG Works

1. **Chunking**: Files are split into semantic chunks (functions, classes, blocks)
2. **Embedding**: Each chunk is converted to a vector using Workers AI
3. **Storage**: Vectors are stored in Cloudflare Vectorize
4. **Retrieval**: Queries are embedded and matched against stored vectors using cosine similarity
5. **Augmentation**: Retrieved chunks are injected into the agent's context for grounded responses
