# 🐳 Docker Agent

<Badge type="warning" text="Pro" />

Containerization, Docker Compose, multi-stage builds, and orchestration.

## CLI Usage

```bash
luna run docker --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "docker", "context": "your input here"}'
```
