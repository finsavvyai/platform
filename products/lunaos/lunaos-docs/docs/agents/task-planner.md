# 🎯 Task Planner Agent

<Badge type="warning" text="Pro" />

Break down features into structured, actionable development tasks.

## CLI Usage

```bash
luna run task-planner --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "task-planner", "context": "your input here"}'
```
