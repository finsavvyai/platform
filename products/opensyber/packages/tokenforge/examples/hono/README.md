# TokenForge + Hono (Cloudflare Workers) Example

Minimal Hono app on Cloudflare Workers with D1 storage for TokenForge.

## Setup

```bash
npm install hono @opensyber/tokenforge
npm install -D wrangler
```

## Configure wrangler.toml

```toml
name = "tokenforge-demo"
main = "index.ts"
compatibility_date = "2025-02-18"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "tokenforge-demo"
database_id = "your-d1-id"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-id"
```

## Run

```bash
npx wrangler dev
```

## Deploy

```bash
npx wrangler deploy
```
