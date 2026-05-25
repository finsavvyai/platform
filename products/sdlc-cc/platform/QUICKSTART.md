# SDLC Platform — Quickstart

One page that points at every shippable artifact. Each link goes straight to a working starting point.

## For application developers

| Want to… | Go here |
|----------|---------|
| Use the hosted gateway | [`api.sdlc.cc` — OpenAI-compat proxy](https://api.sdlc.cc/v1) |
| Sign up + get an API key | [`sdlc.cc/sign-up`](https://sdlc.cc/sign-up) |
| See pricing / plans | [`sdlc.cc/#pricing`](https://sdlc.cc/#pricing) |
| Redact PII inside ChatGPT / Claude / Gemini / Copilot | [`sdlc.cc/extension`](https://sdlc.cc/extension) |
| Read the API reference | `services/gateway/api/openapi.yaml` |

## For teams evaluating SDLC

| Want to… | Go here |
|----------|---------|
| Try the OSS gateway yourself | [`ghcr.io/finsavvyai/sdlc-gateway:latest`](https://github.com/finsavvyai/sdlc-gateway) — `docker pull` |
| Compare vs Portkey / Kong / Tyk / Helicone | [`sdlc-gateway-oss/COMPARISON.md`](./sdlc-gateway-oss/COMPARISON.md) |
| Plug into your existing Langfuse workflow | [`docs/integrations/langfuse.md`](./docs/integrations/langfuse.md) |
| Attack our guard model in public | [`sdlc.cc/arena`](https://sdlc.cc/arena) — try to bypass sdlc-guard |
| Download the prompt-injection classifier | [`huggingface.co/sdlc-ai/sdlc-guard-v1`](https://huggingface.co/sdlc-ai/sdlc-guard-v1) |

## For contributors

| Want to… | Go here |
|----------|---------|
| Run the whole platform locally | `docker-compose up` (see `docker-compose.yml`) |
| Hack on the OSS gateway | [`sdlc-gateway-oss/README.md`](./sdlc-gateway-oss/README.md) |
| Hack on the browser extension | [`sdlc-extension/README.md`](./sdlc-extension/README.md) — `npm install && npm run build` |
| Train the guard model | [`models/sdlc-guard/Makefile`](./models/sdlc-guard/Makefile) — `make setup data train eval` |
| Publish the OSS repo | [`docs/oss-release.md`](./docs/oss-release.md) |
| Read the engineering charter | [`CLAUDE.md`](./CLAUDE.md) |

## Five-minute smoke tests

### Pull the OSS gateway image

```bash
docker run --rm -p 8080:8080 ghcr.io/finsavvyai/sdlc-gateway:v0.1.0
curl localhost:8080/healthz
# → {"status":"ok"}
```

### Create a SCIM user via the OSS gateway

```bash
curl -X POST localhost:8080/scim/v2/Users \
  -H "X-Tenant-ID: acme" \
  -H "Content-Type: application/scim+json" \
  -d '{
    "schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],
    "userName":"alice@acme.test",
    "active":true
  }'
```

### Run the arena against the local guard heuristic

```bash
cd sdlc-arena/apps/web
npm install && npm run dev
# open http://localhost:3000
```

### Sideload the browser extension

```bash
cd sdlc-extension
npm install && npm run build
# chrome://extensions → Developer mode → Load unpacked → dist/
```

## Repo layout at a glance

```
sdlc-platform/
├── services/
│   ├── gateway/           enterprise gateway (Go) — OSS subset extracted to sdlc-gateway-oss/
│   ├── rag/               RAG pipeline (Python + pgvector)
│   ├── proxy-worker/      Cloudflare Worker — OpenAI + Anthropic compat, tier quotas
│   └── dlp/ embedding/ …  DLP, embedding, other platform services
├── sdlc-gateway-oss/      Apache-2.0 OSS extract — mirrored to github.com/finsavvyai/sdlc-gateway
├── sdlc-extension/        Chrome/Edge MV3 extension — PII redaction in AI chat UIs
├── sdlc-arena/            Next.js CTF + labelled dataset — sdlc.cc/arena
├── models/sdlc-guard/     HF-ready model card + training harness
├── landing-page/          Next.js 15 marketing + signup — sdlc.cc
├── packages/              Generated SDKs (Go, Python, TypeScript)
└── docs/                  Integration guides, architecture, release playbooks
```

## Support + community

- Issues: [github.com/finsavvyai/sdlc-platform/issues](https://github.com/finsavvyai/sdlc-platform/issues)
- Security: email `security@sdlc.cc` — do not open a public issue.
- Commercial / enterprise: [`sdlc.cc/contact`](https://sdlc.cc/contact) or `hello@sdlc.cc`.
