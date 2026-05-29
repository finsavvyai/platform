# QueryFlux Cloudflare Worker

Cloudflare Workers backend for QueryFlux - global edge deployment.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

Create a Neon PostgreSQL database:
1. Go to https://neon.tech
2. Create new project
3. Copy connection string

### 3. Configure Secrets

```bash
# Set DATABASE_URL
wrangler secret put DATABASE_URL
# Paste: postgres://user:password@ep-xxx.us-east-1.aws.neon.tech/queryflux?sslmode=require

# Set JWT_SECRET
wrangler secret put JWT_SECRET
# Paste: (generate with: openssl rand -base64 32)

# Optional: OpenAI API Key
wrangler secret put OPENAI_API_KEY
# Paste: sk-...
```

### 4. Deploy

```bash
# Development
npm run dev

# Production
npm run deploy:prod
```

## Features

- ✅ Global edge deployment (300+ locations)
- ✅ < 10ms cold start
- ✅ Auto-scaling
- ✅ Built-in DDoS protection
- ✅ Free tier: 100,000 requests/day

## API Endpoints

### Auth
- `POST /auth/login` - Login with email/password
- `POST /auth/refresh` - Refresh access token

### Query
- `POST /api/v1/query/execute` - Execute SQL (protected)
- `POST /api/v1/schema` - Get database schema (protected)
- `POST /api/v1/query/natural-language` - NLP to SQL (protected)

### Health
- `GET /health` - Health check

## Environment Variables

Set via `wrangler secret put`:
- `DATABASE_URL` - Neon PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `OPENAI_API_KEY` - OpenAI API key (optional)

## Cost

- Free: 100,000 requests/day
- Paid: $5 per 10 million requests
- Typical cost: **$15-30/month** for production

## Performance

- P50 latency: < 50ms
- P99 latency: < 200ms
- Global: Served from nearest location

