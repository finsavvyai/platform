# SDLC.ai Proxy Worker

**Week 1 MVP**: Simple Cloudflare Worker that proxies requests to OpenAI with API key validation and usage logging.

## Features (Week 1)

- ✅ API key validation (KV store)
- ✅ OpenAI API passthrough
- ✅ Usage logging (D1 database)
- ✅ CORS handling
- ✅ Health check endpoint

## Features (Week 2+)

- ⏳ PII detection (12+ types)
- ⏳ PII redaction
- ⏳ Rate limiting
- ⏳ Quota enforcement
- ⏳ Multi-provider support (Anthropic, Google)
- ⏳ Compliance audit logs

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set secrets

```bash
# Your OpenAI API key (for proxying)
wrangler secret put OPENAI_API_KEY

# Secret for API key HMAC (optional)
wrangler secret put API_KEY_SECRET
```

### 3. Create D1 database

```bash
# Create database
wrangler d1 create sdlc-production

# Update wrangler.toml with the database_id from output
# Then create tables:
wrangler d1 execute sdlc-production --file=./schema.sql
```

### 4. Create KV namespace

```bash
# Create KV namespace
wrangler kv:namespace create "API_KEYS"

# Update wrangler.toml with the id from output
```

## Development

```bash
# Run locally
npm run dev

# Test health endpoint
curl http://localhost:8787/health

# Test proxy (need valid API key in KV first)
curl http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer sk-sdlc-test-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Deployment

```bash
# Deploy to production
npm run deploy

# View logs
npm run tail
```

## Usage

Replace OpenAI base URL:

```python
# Python
import openai
openai.api_base = "https://api.sdlc.finsavvyai.com/v1"
openai.api_key = "sk-sdlc-your-key-here"
```

```javascript
// JavaScript
const openai = new OpenAI({
  baseURL: 'https://api.sdlc.finsavvyai.com/v1',
  apiKey: 'sk-sdlc-your-key-here'
});
```

## Architecture

```
User Code
  ↓ (HTTPS)
Cloudflare Worker (Edge)
  ↓ (Validate API key → KV)
  ↓ (Log usage → D1)
  ↓ (Proxy → OpenAI)
OpenAI API
```

## Database Schema

See `schema.sql` for D1 tables:
- `usage_logs`: Request/response logging
- `api_keys`: API key metadata (for dashboard)

## API Key Format

```
sk-sdlc-[user_id]-[random]
```

Example: `sk-sdlc-usr_abc123-xK9mP2nL7qR4`

## License

AGPL-3.0-or-later (commercial license available — see [COMMERCIAL.md](../../COMMERCIAL.md))
