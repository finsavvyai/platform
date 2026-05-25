# ⚙️ Task Executor Agent

<Badge type="warning" text="Pro" />

Execute planned tasks step-by-step with code generation and validation.

## CLI Usage

```bash
luna run task-executor --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "task-executor", "context": "your input here"}'
```
