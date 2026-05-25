# MCPOverflow Workers API

Cloudflare Workers-based API for MCPOverflow, using D1 for database, KV for sessions, and Cloudflare Access for authentication.

## Quick Start

```bash
# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Create D1 database
npx wrangler d1 create mcpoverflow
# Copy the database_id to wrangler.toml

# Run migrations
npm run db:migrate

# Start local development
npm run dev

# Deploy
npm run deploy
```

## Environment Setup

### Cloudflare Access Secrets

After deploying, set these secrets:

```bash
# Your Cloudflare Access team domain (e.g., yourteam.cloudflareaccess.com)
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN

# Your Access application audience tag
npx wrangler secret put CF_ACCESS_AUD
```

### Creating a Cloudflare Access Application

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Zero Trust → Access → Applications
2. Create a new application:
   - **Name**: MCPOverflow
   - **Session Duration**: 24 hours
   - **Application domain**: `api.mcpoverflow.com` (or your domain)
3. Configure identity providers:
   - Add GitHub login
   - Add Google login
4. Copy the **Application Audience (AUD) Tag** to use as `CF_ACCESS_AUD`

## API Endpoints

### Public (No Auth Required)
- `GET /api/health` - Health check
- `GET /api/connectors/public` - List public connectors

### Protected (Authenticated)
- `GET /api/connectors` - List user's connectors
- `POST /api/connectors` - Create connector
- `GET /api/connectors/:id` - Get connector
- `PATCH /api/connectors/:id` - Update connector
- `DELETE /api/connectors/:id` - Delete connector
- `GET /api/jobs` - List jobs
- `POST /api/jobs` - Create job
- `GET /api/users/me` - Get current user
- `POST /api/users/me/api-keys` - Create API key

## Authentication

The API supports two authentication methods:

1. **Cloudflare Access JWT** - Sent via `CF-Access-JWT-Assertion` header
2. **API Key** - Sent via `Authorization: Bearer mcp_...` header

## Project Structure

```
workers/
├── db/
│   └── schema.sql          # D1 SQLite schema
├── src/
│   ├── worker.ts           # Main entry point
│   ├── middleware/
│   │   └── auth.ts         # JWT/API key validation
│   └── routes/
│       ├── connectors.ts   # Connector CRUD
│       ├── jobs.ts         # Job management
│       └── users.ts        # User profiles & API keys
├── package.json
├── tsconfig.json
└── wrangler.toml           # Wrangler configuration
```

## Development

```bash
# Run local dev server (uses D1 local)
npm run dev

# Type check
npm run typecheck

# Run tests
npm test
```

## Deployment

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```
