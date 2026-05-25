# 🧠 RAG Enhanced Agent

<Badge type="warning" text="Pro" />

Context-aware code analysis using RAG pipeline for deep project understanding.

## CLI Usage

```bash
luna run rag-enhanced --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "rag-enhanced", "context": "your input here"}'
```
