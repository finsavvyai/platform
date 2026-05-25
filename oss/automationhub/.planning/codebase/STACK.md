# Technology Stack

**Analysis Date:** 2026-04-21

## Languages

**Primary:**
- Python >=3.10 - Backend application and domain logic in `src/automationhub/*.py`, `backend/app/**/*.py`, and package metadata in `pyproject.toml`.

**Secondary:**
- TypeScript - Frontend and Workers implementation in `frontend/src/**/*.{ts,tsx}` and `cloudflare-workers/src/**/*.ts`.
- JavaScript - Worker entrypoint and Node scripts in `cloudflare-workers/src/index.js`, `frontend/package.json`, and `cloudflare-workers/package.json`.
- SQL - Schema/migration assets in `migrations/*.sql`.

## Runtime

**Environment:**
- Python runtime is declared as `>=3.10` in `pyproject.toml`.
- Node.js runtime is declared as `>=18.0.0` in `cloudflare-workers/package.json` and used in `frontend/Dockerfile`.
- Cloudflare Worker runtime is pinned by `compatibility_date` in `wrangler.toml` and `cloudflare-workers/wrangler.toml`.

**Package Manager:**
- Python uses pip requirement manifests in `backend/requirements.txt` and `mcp-servers/requirements.txt` (build backend is Poetry Core in `pyproject.toml`).
- JavaScript/TypeScript uses npm manifests in `frontend/package.json` and `cloudflare-workers/package.json`.
- Lockfile: present for frontend npm (`frontend/package-lock.json`), missing for root Python packaging (`poetry.lock` not detected).

## Frameworks

**Core:**
- FastAPI - Backend web API framework (`backend/requirements.txt`, `backend/app/main.py`).
- SQLAlchemy - Async ORM/database layer (`backend/requirements.txt`, `backend/app/core/database.py`).
- React + TypeScript - Frontend SPA stack (`frontend/package.json`, `frontend/src/index.tsx`).
- Hono - Cloudflare Worker HTTP framework (`cloudflare-workers/package.json`, `cloudflare-workers/src/index.ts`).

**Testing:**
- Pytest + pytest-asyncio + pytest-cov - Python testing and coverage (`pyproject.toml`, `backend/requirements.txt`, `backend/pytest.ini`).
- React Testing Library + Jest DOM - Frontend tests (`frontend/package.json`).
- Vitest - Worker tests (`cloudflare-workers/package.json`).

**Build/Dev:**
- Uvicorn - ASGI app server (`pyproject.toml`, `backend/requirements.txt`).
- Wrangler - Cloudflare dev/deploy toolchain (`cloudflare-workers/package.json`, `wrangler.toml`).
- React Scripts - Frontend dev/build/test runner (`frontend/package.json`).
- Webpack - Worker production bundling (`cloudflare-workers/package.json`).

## Key Dependencies

**Critical:**
- `fastapi`, `uvicorn`, `pydantic`, `pydantic-settings` - API runtime and settings validation (`pyproject.toml`, `backend/requirements.txt`, `backend/app/core/config.py`).
- `sqlalchemy`, `alembic`, `asyncpg`, `psycopg2-binary` - Relational data layer and migrations (`backend/requirements.txt`, `backend/app/core/database.py`).
- `redis`, `celery`, `flower` - Queueing, cache-backed async processing, and worker monitoring (`backend/requirements.txt`, `backend/app/core/celery.py`).
- `openai`, `anthropic`, `langchain`, `langchain-openai` - LLM provider and orchestration libraries (`backend/requirements.txt`).
- `chromadb`, `sentence-transformers` - Vector storage and embedding workflows (`backend/requirements.txt`).

**Infrastructure:**
- `playwright`, `selenium`, `browser-use` - Browser automation stack (`backend/requirements.txt`, `backend/Dockerfile`).
- `ansible`, `ansible-runner`, `paramiko` - Infrastructure automation tooling (`backend/requirements.txt`).
- `mcp`, `websockets` - MCP communication stack (`backend/requirements.txt`).
- `prometheus-client`, `structlog`, `sentry-sdk[fastapi]` - Metrics, logging, and error tracking (`backend/requirements.txt`).
- `hono`, `zod`, `@cloudflare/kv-asset-handler` - Cloudflare Worker routing and validation (`cloudflare-workers/package.json`, `cloudflare-workers/src/index.ts`).

## Configuration

**Environment:**
- Application settings load from environment variables via `BaseSettings` in `backend/app/core/config.py`.
- Default local service URLs are configured in `backend/app/core/config.py` (`DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`).
- Worker environment and bindings are configured in `wrangler.toml` and `cloudflare-workers/wrangler.toml`.
- `.env` files are present (`backend/.env`, `mcp-servers/.env`, `build/extension/.env`) and treated as secret-bearing configuration.

**Build:**
- Python package/build metadata: `pyproject.toml`.
- Backend container build: `backend/Dockerfile`.
- Frontend container build: `frontend/Dockerfile`.
- Unified root container build: `Dockerfile`.
- Edge deployment config: `wrangler.toml` and `cloudflare-workers/wrangler.toml`.

## Platform Requirements

**Development:**
- Python >=3.10 and Node >=18 for backend/frontend/worker development (`pyproject.toml`, `cloudflare-workers/package.json`).
- Docker is used for containerized local and production-like runs (`Dockerfile`, `backend/Dockerfile`, `frontend/Dockerfile`).
- Backend expects Redis and SQL database endpoints via environment config (`backend/app/core/config.py`, `backend/app/core/database.py`).

**Production:**
- Backend runs as ASGI service with `uvicorn` entrypoint in containers (`Dockerfile`, `backend/Dockerfile`).
- Frontend ships as static assets served by Nginx container (`frontend/Dockerfile`).
- Edge routing, KV, D1, and AI bindings are deployed through Cloudflare Workers configs (`wrangler.toml`, `cloudflare-workers/wrangler.toml`).

---

*Stack analysis: 2026-04-21*
