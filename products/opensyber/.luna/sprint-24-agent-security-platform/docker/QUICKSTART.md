# OpenSyber Docker Quick Start Guide

## Prerequisites

- Docker Desktop installed and running
- pnpm installed globally
- Git

## Initial Setup

### 1. Install Dependencies

```bash
# From project root
pnpm install
```

### 2. Configure Environment

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
# Edit .env.local with your actual keys
```

Minimum required for development:

```bash
# Clerk Authentication (get from https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Development
ENVIRONMENT=development
NODE_ENV=development

# Encryption (generate random 32 chars)
ENCRYPTION_KEY=your-random-32-character-encryption-key-here
```

### 3. Setup Mock API

The mock API simulates Cloudflare Workers endpoints for local development:

```bash
cd .luna/sprint-24-agent-security-platform/docker
npm init -y
npm install express cors
cp mock-server.js .
```

## Running Services

### Option 1: Using Make (Recommended)

```bash
cd .luna/sprint-24-agent-security-platform/docker

# Start all services
make dev

# Start only web app
make dev-web

# Start with mock API
make dev
make dev-mock
```

### Option 2: Using Docker Compose Directly

```bash
cd .luna/sprint-24-agent-security-platform/docker

# Build and start all services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Build and start in detached mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f
```

## Accessing Services

Once running, services are available at:

- **OpenSyber Web**: http://localhost:3000
- **TokenForge Web**: http://localhost:3001
- **Mock API**: http://localhost:8787

## Development Workflow

### 1. Start Services

```bash
make dev
```

### 2. Make Code Changes

Changes in `apps/web/` or `packages/` will hot-reload automatically.

### 3. Run Tests

```bash
# Run all tests
make test

# Run web tests only
make test-web

# Run API tests
make test-api

# Run E2E tests
make test-e2e
```

### 4. Stop Services

```bash
make down
```

## Common Tasks

### Rebuild After Dependency Changes

```bash
make build
make dev
```

### Clean Everything

```bash
make clean
```

### Access Container Shell

```bash
# Web container
make shell-web

# Mock API container
make shell-mock
```

### View Service Health

```bash
make health
```

## Troubleshooting

### Port Already in Use

```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill

# Or change port in docker-compose.yml
```

### Containers Not Starting

```bash
# Check logs
docker-compose logs web

# Rebuild without cache
docker-compose build --no-cache web

# Clean and restart
make clean
make dev
```

### Hot Reload Not Working

1. Ensure you're using the dev compose file:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
   ```

2. Check volume mounts are correct:
   ```bash
   docker-compose exec web ls -la /app/apps/web/src
   ```

3. Restart the web service:
   ```bash
   docker-compose restart web
   ```

### Permission Issues

If you encounter permission issues with mounted volumes:

```bash
# On macOS/Windows with Docker Desktop
# Settings → Resources → File Sharing → Ensure project directory is included

# On Linux
# Ensure your user is in the docker group
sudo usermod -aG docker $USER
```

## Production Deployment

Docker is **NOT** used for production deployment. Use Cloudflare Workers:

```bash
# Deploy API to Workers
cd apps/api
pnpm deploy

# Deploy Web to Pages
cd apps/web
pnpm deploy
```

## Tips

1. **Use Make commands** - They're simpler and remember all the flags
2. **Keep containers running** - Faster than restarting for each change
3. **Check logs first** - When something fails, check logs before rebuilding
4. **Use shell access** - Debug issues directly in the container
5. **Clean periodically** - Run `make clean` to free disk space

## Next Steps

- Read the full [README.md](./README.md) for detailed information
- Check [CLAUDE.md](../../CLAUDE.md) for project rules
- Visit [Cloudflare Workers docs](https://developers.cloudflare.com/workers/) for deployment info

## Getting Help

If you encounter issues:

1. Check Docker Desktop is running: `docker info`
2. Check ports aren't in use: `lsof -i :3000`
3. Check logs: `make logs`
4. Try cleaning: `make clean && make dev`
5. Check the [troubleshooting section](#troubleshooting) above
