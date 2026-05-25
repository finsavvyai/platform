# 🏗️ Design Architect Agent

<Badge type="tip" text="Free" />

System architecture design, component structure, and data flow planning.

## CLI Usage

```bash
luna run design-architect --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "design-architect", "context": "your input here"}'
```
