# TokenForge + Fastify Example

Minimal Fastify server with TokenForge device-bound session security.

## Setup

```bash
npm install fastify @opensyber/tokenforge
npm install -D tsx
```

## Run

```bash
npx tsx index.ts
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Public (skips TokenForge) |
| GET | `/profile` | Protected — returns trust score |

## How it works

1. `tokenForgePlugin` registers as a Fastify plugin via `fastify.register()`
2. `request.tf` is decorated with `{ bound, trustScore, deviceId }`
3. The plugin uses Fastify's `preHandler` hook for verification
