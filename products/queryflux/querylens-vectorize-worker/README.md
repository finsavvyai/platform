# QueryLens Vectorize Worker

Cloudflare Worker for managing schema embeddings using Vectorize vector database.

## Overview

This Worker provides REST API endpoints for:
- **Indexing** database schemas (tables, columns) with embeddings
- **Searching** semantically similar schema elements
- **Managing** vector embeddings in Vectorize

## Architecture

```
QueryLens Spring Boot (Java) → Vectorize Worker (Cloudflare) → Vectorize DB
                            ↓
                         REST API (HTTP)
```

## Setup

### 1. Create Vectorize Index

```bash
# Create production index
wrangler vectorize create querylens-schema-index \
  --dimensions=1536 \
  --metric=cosine \
  --metadata-fields=type,database,tableName,columnName,text

# Create development index
wrangler vectorize create querylens-schema-index-dev \
  --dimensions=1536 \
  --metric=cosine \
  --metadata-fields=type,database,tableName,columnName,text
```

### 2. Set OpenAI API Key

```bash
# Production
wrangler secret put OPENAI_API_KEY
# Enter your key when prompted

# Development
wrangler secret put OPENAI_API_KEY --env development
```

### 3. Deploy Worker

```bash
# Development
wrangler dev

# Production
wrangler deploy
```

### 4. Configure Spring Backend

Add to `application.yml`:

```yaml
vectorize:
  worker:
    url: https://querylens-vectorize-worker.workers.dev
```

## API Endpoints

### Health Check
```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "vectorize": "connected"
}
```

### Index Schema
```http
POST /schema
Content-Type: application/json

{
  "database": "ecommerce",
  "tables": [
    {
      "name": "users",
      "description": "User accounts",
      "columns": [
        { "name": "id", "type": "INT", "description": "Primary key" },
        { "name": "email", "type": "VARCHAR", "description": "User email" }
      ]
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "mutationId": "xxx-xxx-xxx",
  "count": 3,
  "message": "Schema indexed with 3 vectors"
}
```

### Search
```http
POST /search
Content-Type: application/json

{
  "query": "find user email addresses",
  "topK": 5
}
```

Response:
```json
{
  "matches": [
    {
      "id": "ecommerce:users:column",
      "score": 0.89,
      "metadata": {
        "type": "column",
        "tableName": "users",
        "columnName": "email",
        "text": "Column: email. Type: VARCHAR..."
      }
    }
  ],
  "query": "find user email addresses",
  "count": 1
}
```

### Insert Embeddings
```http
POST /embeddings
Content-Type: application/json

{
  "items": [
    {
      "id": "custom-1",
      "text": "Custom text to embed",
      "type": "custom",
      "metadata": { "key": "value" }
    }
  ]
}
```

### List Vectors
```http
GET /vectors?limit=100
```

### Delete Vector
```http
DELETE /vectors/{id}
```

## Embedding Model

Uses Cloudflare's OpenAI text-embedding-ada-002 model:
- **Dimensions**: 1536
- **Cost**: Included with Workers AI (no additional API cost)
- **Latency**: ~50-100ms per embedding

## Cost Estimates

| Operation | Vectors | Cost |
|-----------|---------|------|
| Small DB (10 tables, 100 columns) | 110 | ~$0 |
| Medium DB (50 tables, 500 columns) | 550 | ~$0 |
| Large DB (200 tables, 2000 columns) | 2200 | ~$0 |

*Embeddings via Workers AI are included in Cloudflare Workers bundle*

## Testing

```bash
# Health check
curl https://querylens-vectorize-worker.workers.dev/health

# Search test
curl -X POST https://querylens-vectorize-worker.workers.dev/search \
  -H "Content-Type: application/json" \
  -d '{"query":"user email","topK":5}'
```

## Troubleshooting

### Worker returns 401
- Check OPENAI_API_KEY is set: `wrangler secret list`

### Vectors not found
- Check index name in wrangler.toml matches deployed index
- Use `wrangler vectorize list` to see available indexes

### Slow embeddings
- Check Workers AI quota
- Consider batching inserts for large schemas

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Run tests
npm test

# Deploy to development
wrangler deploy --env development

# Deploy to production
wrangler deploy
```

## Related Files

- `src/index.js` - Worker implementation
- `wrangler.toml` - Worker configuration
- `../querylens-api/src/main/java/.../VectorizeClient.java` - Java client

---

*Part of QueryLens NLP-to-SQL Engine*
*Last updated: March 4, 2026*
