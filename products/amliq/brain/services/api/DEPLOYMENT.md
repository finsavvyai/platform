# AMLIQ Brain API Deployment

The core API is runtime-agnostic. Deployable hosts should import
`createBrainWorkerFetch()` from `@finsavvyai/amliq-brain/api` or the built
`services/api/dist/worker.js` entrypoint.

## Required bindings / env

| Name | Required | Purpose |
|---|---:|---|
| `VERSION` | no | Version surfaced by `/health`. |
| `BRAIN_JWT_HS256_SECRET` | yes for JWT auth | HS256 secret for the Worker-local JWT verifier. Requires issuer and audience below. |
| `BRAIN_JWT_ISSUER` | yes for JWT auth | Expected JWT `iss`. |
| `BRAIN_JWT_AUDIENCE` | yes for JWT auth | Expected JWT `aud` string or member of an `aud` array. |
| `BRAIN_AUTH_TOKEN` | dev fallback | Shared bearer token accepted only when JWT env is incomplete. Use for local smoke tests, not production. |
| `BRAIN_REQUIRED_ROLE` | no | Defaults to `aml:decision:write`. |
| `BRAIN_SEARCH_ENDPOINT` | no | If set, mounts `POST /v1/search` through the HTTP RAG adapter. |
| `BRAIN_SEARCH_AUTHORIZATION` | no | Authorization header forwarded to the RAG runtime. |
| `BRAIN_SEARCH_TIMEOUT_MS` | no | RAG runtime timeout. Defaults to 10000ms. |
| `BRAIN_SEARCH_DEFAULT_TOP_K` | no | Default result count for `/v1/search`. |
| `BRAIN_SEARCH_MAX_TOP_K` | no | Maximum result count for `/v1/search`. |
| `BRAIN_SAR_DRAFT_ENDPOINT` | no | If set, mounts `POST /v1/brain/sar-draft` through the HTTP SAR runtime adapter. |
| `BRAIN_SAR_DRAFT_AUTHORIZATION` | no | Authorization header forwarded to the SAR runtime. |
| `BRAIN_SAR_DRAFT_TIMEOUT_MS` | no | SAR runtime timeout. Defaults to 15000ms. |
| `AUDIT_LOG_BUCKET` | no | R2-like binding. If present, API audit records are written as JSON. |

## Routes

| Route | Auth | Notes |
|---|---|---|
| `GET /health` | no | Hono health snapshot. |
| `POST /v1/brain/ping` | yes | Smoke endpoint, audited. |
| `POST /v1/search` | yes | Mounted only when `BRAIN_SEARCH_ENDPOINT` is configured. |
| `POST /v1/brain/sar-draft` | yes | Mounted only when `BRAIN_SAR_DRAFT_ENDPOINT` is configured. |

## Auth mode

The Worker shell builds the API `AuthVerifier` from explicit env bindings:

- If `BRAIN_JWT_HS256_SECRET`, `BRAIN_JWT_ISSUER`, and
  `BRAIN_JWT_AUDIENCE` are all configured, protected routes require a valid
  HS256 JWT with matching `iss`, matching `aud`, unexpired `exp`, and the
  configured role in `roles`.
- If JWT env is incomplete, the shell falls back to `BRAIN_AUTH_TOKEN` for
  local smoke tests. The fallback emits static claims with
  `BRAIN_REQUIRED_ROLE`.

This keeps Brain deployable without importing shared workspace packages from
`products/*`. A future platform host can still inject an RS256/JWKS verifier
through `createBrainHostApp()`.

## RAG runtime contract

The RAG runtime receives:

```json
{"query": "fincen advisory", "k": 3, "tenant_id": "tenant-a"}
```

It returns the `oss/finsavvy-rag` shape:

```json
{"results": [{"doc_id": "d1", "content": "...", "score": 0.91, "meta": {"source": "fincen_rss", "jurisdiction": "US", "title": "Advisory", "published_at": "2026-05-25T00:00:00Z", "sha256": "..."}}]}
```

The adapter also accepts `hits` instead of `results` and JSON-string `meta`.
Unknown source/jurisdiction values are normalized to `internal` / `OTHER`.

## SAR runtime contract

The SAR runtime receives:

```json
{"alert": {"alert_id": "A-1", "tenant_id": "tenant-a", "alert_type": "structuring"}}
```

It returns either:

```json
{"ok": true, "draft": {"alert_id": "A-1", "template_id": "structuring", "filled_text": "...", "citations": [], "confidence": 0.6, "human_review_required": true}}
```

or:

```json
{"ok": false, "error": "agent_error"}
```

`human_review_required` must be `true`; the TS adapter rejects any response
that disables human review.
