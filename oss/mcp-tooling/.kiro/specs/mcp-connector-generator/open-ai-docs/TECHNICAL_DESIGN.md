# MCPoverflow — Technical Design Guidelines

## A) Architecture Overview
Cloudflare-native distributed design:
- **Frontend**: Next.js 15 on Cloudflare Pages.
- **Backend**: Go Control Plane Worker (TinyGo → WASM).
- **Generator Engine**: Go library using kin-openapi.
- **Storage**: R2 bucket for artifacts, KV/D1 for metadata.

## B) API Endpoints
| Method | Route | Description |
|--------|--------|--------------|
| POST | /generate | Upload API spec and trigger generation |
| GET | /status/:id | Job progress and logs |
| POST | /deploy | Deploy generated connector |
| GET | /connectors/:id | Fetch connector metadata |

## C) Templates
- manifest.hbs
- handler.ts.hbs
- handler.go.hbs

## D) Performance Targets
| Metric | Target |
|---------|--------|
| API Latency | <200ms |
| Generation | <8s for <2MB spec |
| Cold Deploy | <10s |
| Uptime | 99.9% |

## E) Security
- HTTPS enforced, Cloudflare SSL.
- Secrets stored in Cloudflare Secrets.
- Redacted logging and PII scrubbing.
