# 🗄️ Database Agent

<Badge type="warning" text="Pro" />

Schema design, migrations, query optimization, ORM setup, and database architecture.

## CLI Usage

```bash
luna run database --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "database", "context": "your input here"}'
```
