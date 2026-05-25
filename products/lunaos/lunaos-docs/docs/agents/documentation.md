# 📝 Documentation Agent

<Badge type="tip" text="Free" />

Generate comprehensive documentation — JSDoc, README, API docs, and user guides.

## CLI Usage

```bash
luna run documentation --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "documentation", "context": "your input here"}'
```
