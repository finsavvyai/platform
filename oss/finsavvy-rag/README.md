# finsavvy-rag

A small, self-hostable distributed RAG (retrieval-augmented generation) toolkit
built on PostgreSQL + [pgvector](https://github.com/pgvector/pgvector),
[FastAPI](https://fastapi.tiangolo.com/), and an OpenAI-compatible gateway that
can load-balance across multiple local inference nodes (e.g. vLLM laptops).

It is designed to be:

- **Boring to operate** — Postgres + a couple of Python services + Caddy/Nginx.
- **Safe by default** — parameterised SQL, no string concat, no hidden secrets.
- **Audit-friendly** — pluggable port for tamper-evident audit logging (see below).
- **Apache 2.0** — use it commercially, fork it, embed it.

> Status: v0.1. APIs may change. Hash-chain audit integration is an interface
> (`src/types/audit-port.ts`) and is wired in by the caller.

## What's in the box

- **`services/rag/`** — FastAPI service exposing `/ingest` and `/search` against
  a pgvector store. Uses `sentence-transformers/all-MiniLM-L6-v2` (384-dim) by
  default; configurable via `EMBED_MODEL`.
- **`services/gateway/`** — Thin OpenAI-compatible reverse proxy that routes
  `/v1/*` either to a local inference server or to a Caddy/Nginx pool.
- **`configs/caddy/`, `configs/nginx/`** — Reference load-balancer configs.
- **`docker/compose.yml`, `docker/init.sql`** — Postgres + pgvector schema
  (`documents(doc_id, content, meta, embedding)` with ivfflat + GIN indexes).
- **`src/types/`** — Public TypeScript interfaces consumers integrate against
  (no Python runtime dep; types are for downstream TS consumers).

## Quick start (Docker)

```bash
# 1. Configure
cp .env.example .env
# Edit .env — set PGPASSWORD, embedding model, upstreams.

# 2. Bring up Postgres + pgvector
docker compose -f docker/compose.yml --env-file .env up -d

# 3. Run the RAG API
python3 -m venv .venv && source .venv/bin/activate
pip install -r services/rag/requirements.txt
uvicorn services.rag.app:app --host 127.0.0.1 --port 9100

# 4. Ingest sample docs
python services/rag/ingest.py services/rag/corpus

# 5. Search
curl -s -X POST http://127.0.0.1:9100/search \
  -H 'content-type: application/json' \
  -d '{"query":"how to start vllm on mac","k":3}'
```

Gateway (optional):

```bash
pip install -r services/gateway/requirements.txt
uvicorn services.gateway.app:app --host 127.0.0.1 --port 9000
curl http://127.0.0.1:9000/v1/models
```

## Architecture

```
        +--------------+        +---------------------+
client -| gateway:9000 |--/v1/--| local vLLM :8000    |
        +------+-------+        |  or LB (caddy/nginx)|
               |                +---------------------+
               |
        +------v-------+        +--------------------+
        | rag:9100     |--SQL--3| postgres + pgvector|
        | /ingest /search       | documents(embedding)|
        +--------------+        +--------------------+
```

Three pieces, each independently runnable. The gateway and RAG service share
no state; pgvector is the only durable store.

## Hardening notes

- **Parameterised queries everywhere.** Every SQL statement in
  `services/rag/app.py` and `services/rag/ingest.py` uses SQLAlchemy's
  `text(...)` with bound parameters (`:doc_id`, `:embedding`, `:qvec`, `:k`).
  No SQL is built via string concatenation or f-strings. Auditors: grep for
  `f"..."` and `+ "` near `text(` — there should be no hits.
- **No secrets in repo.** `.env.example` contains placeholders only. Real
  credentials live in `.env` (gitignored) or your secret manager.
- **CORS in reference configs is permissive (`*`)** for dev. Tighten before
  production.
- **Embedding dimension is pinned to 384** in `docker/init.sql`. If you swap
  `EMBED_MODEL` to a different dimensionality, update the schema and rebuild
  the index.
- **Input validation** is via Pydantic models on the FastAPI handlers; downstream
  consumers should still rate-limit and authenticate at the gateway edge.

## Integration with tamper-evident audit log

This package does **not** bundle an audit-log implementation. Instead it defines
a TypeScript port (`src/types/audit-port.ts`) that callers inject:

```ts
import type { AuditPort } from "finsavvy-rag/types/audit-port";

const audit: AuditPort = makeYourHashChainImpl();
await audit.chainAppend(prevHash, { kind: "rag.search", query, k });
```

The contract — `chainAppend(prevHash, record) -> {hash, sig}` and
`verifyChain(records) -> {ok, breakIndex?}` — is intentionally minimal so any
hash-chain + signature implementation can satisfy it. A reference
implementation lives outside this OSS package; consumers are free to bring
their own.

## Compliance document shape

If you are indexing regulatory or compliance documents, conform to the
`ComplianceDoc` interface in `src/types/compliance-doc.ts`:

```ts
interface ComplianceDoc {
  source: string;       // e.g. "fincen", "ffiec"
  jurisdiction: string; // e.g. "US", "UK"
  doc_id: string;       // stable upstream id
  title: string;
  published_at: string; // ISO 8601
  sha256: string;       // hash of body
  body: string;         // plain text
}
```

`doc_id` maps directly to the pgvector `documents.doc_id` upsert key.

## License

Apache License 2.0. See [LICENSE](./LICENSE).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
