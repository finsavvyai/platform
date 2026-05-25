# 🔍 SEO Agent

<Badge type="warning" text="Pro" />

SEO optimization — meta tags, structured data, sitemap, robots.txt, and performance.

## CLI Usage

```bash
luna run seo --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "seo", "context": "your input here"}'
```
