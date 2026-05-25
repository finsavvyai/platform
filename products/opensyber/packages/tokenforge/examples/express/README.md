# TokenForge + Express Example

Minimal Express server with TokenForge device-bound session security.

## Setup

```bash
npm install express @opensyber/tokenforge
npm install -D tsx @types/express
```

## Run

```bash
npx tsx index.ts
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Public (skips TokenForge) |
| GET | `/api/profile` | Protected — returns trust score |
| DELETE | `/api/account/delete` | Sensitive — requires trust >= 90 |

## How it works

1. `tokenForgeMiddleware` verifies `X-TF-*` headers on every request
2. `req.tf` is populated with `{ bound, trustScore, deviceId }`
3. Routes decide access based on trust score thresholds
