# 👁️ GLM Vision Agent

<Badge type="warning" text="Pro" />

Visual reasoning — analyze screenshots, diagrams, and UI mockups.

## CLI Usage

```bash
luna run glm-vision --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "glm-vision", "context": "your input here"}'
```
