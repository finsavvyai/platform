# MCPOverflow Deployment Runbook

**Version**: 1.0
**Last Updated**: 2026-01-11

## 1. Prerequisites

Before deploying, ensure you have:
- **Docker & Docker Compose** installed on the target server.
- **Git** installed.
- Access to the **Container Registry** (if using private images).
- **Environment Variables** prepared (see `.env.example`).
- **Cloudflare Account** access (for frontend deployment).

## 2. Environment Configuration

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/mcpoverflow/mcpoverflow.git
    cd mcpoverflow
    ```

2.  **Configure Production Environment**:
    Create a `.env.production` file based on `.env.example`.
    **CRITICAL**: Ensure the following secure variables are set:
    - `ENVIRONMENT=production`
    - `DB_PASSWORD` (Strong, unique)
    - `JWT_SECRET` (Min 32 chars)
    - `SENTRY_DSN`
    - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (For backups)

## 3. Backend Deployment (Docker)

We use Docker Compose for the backend services (API, Postgres, Redis, Worker).

1.  **Build and Start Services**:
    ```bash
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
    ```

2.  **Verify Services**:
    ```bash
    docker-compose ps
    ```
    Ensure `api`, `worker`, `db`, `redis`, and `backup` services are `Up`.

3.  **Run Database Migrations**:
    The API service attempts to run migrations on startup. To run manually:
    ```bash
    docker-compose exec api ./main migrate
    ```

## 4. Frontend Deployment (Cloudflare Pages)

We deploy the Next.js applications to Cloudflare Pages.

1.  **Connect GitHub Repo**:
    - Go to Cloudflare Dashboard > Pages.
    - Create a new project > Connect to Git.
    - Select `mcpoverflow` repo.

2.  **Build Settings**:
    - **Framework Preset**: Next.js
    - **Build Command**: `npm run build`
    - **Output Directory**: `.next` (or specific export folder if static)

3.  **Environment Variables**:
    - Add `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SENTRY_DSN`, etc., in Cloudflare Project Settings.

## 5. Rollback Procedures

### Backend Rollback
If a deployment fails:
1.  Revert the docker image tag in `docker-compose.yml` to the previous version.
2.  Restart services:
    ```bash
    docker-compose up -d
    ```

### Database Rollback
If a bad migration occurs:
1.  **Stop the API**: `docker-compose stop api`
2.  **Restore from Backup**:
    refer to [Disaster Recovery Guide](./disaster_recovery.md).
    ```bash
    ./scripts/restore.sh --latest
    ```

## 6. Post-Deployment Verification

1.  **Check Health Endpoint**:
    `curl https://api.mcpoverflow.io/health` -> Should return `200 OK`.
2.  **Check Sentry**: Ensure no new error spikes.
3.  **Check Logs**:
    ```bash
    docker-compose logs -f api --tail=100
    ```
