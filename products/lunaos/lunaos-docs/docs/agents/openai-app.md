# 🤖 OpenAI App Agent

<Badge type="warning" text="Pro" />

OpenAI API integration patterns, function calling, and embedding workflows.

## CLI Usage

```bash
luna run openai-app --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "openai-app", "context": "your input here"}'
```
