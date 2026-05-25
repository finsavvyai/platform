# 🔎 RAG Agent

<Badge type="warning" text="Pro" />

Implement RAG pipelines — chunking, embedding, vector storage, and retrieval.

## CLI Usage

```bash
luna run rag --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "rag", "context": "your input here"}'
```
