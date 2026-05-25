# MCPoverflow Deployment Guide (Cloudflare Workers)

## Pre-requisites
- Go 1.23
- Wrangler CLI (`npm i -g wrangler`)
- Cloudflare Account

## Env Vars
```
LEMONSQUEEZY_API_KEY=your-key
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret
JWT_SECRET=your-secret
```

## Deploy
```bash
go build -o mcpoverflow
wrangler deploy
```

## Health Check
```bash
curl https://mcpoverflow.com/health
```

## Rollback
```bash
wrangler rollback
```
