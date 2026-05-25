# OpenSyber Docker Configuration Plan

## Executive Summary

This document outlines the comprehensive Docker containerization strategy for the OpenSyber platform. The Docker configurations enable:

- **Local Development**: Run entire stack locally with hot reload
- **Production Deployment**: Optimized containers for cloud deployment
- **CI/CD Integration**: Automated builds and security scanning
- **Multi-Environment Support**: Development, staging, and production configurations

## Architecture Overview

### Services to Containerize

1. **opensyber-api** — Hono API (Cloudflare Worker compatible)
2. **opensyber-web** — Next.js 16 frontend
3. **opensyber-agent** — Node.js daemon for agent containers
4. **tokenforge-api** — TokenForge API (Cloudflare Worker compatible)
5. **tokenforge-web** — TokenForge Next.js frontend
6. **postgres** — PostgreSQL database (development/testing)
7. **redis** — Redis cache (development/testing)
8. **nginx** — Reverse proxy (production)

### Technology Stack

- **Base Images**: node:22-alpine, node:22-slim
- **Package Manager**: pnpm 10.6.2
- **Build Tool**: Turborepo
- **Orchestration**: Docker Compose
- **Reverse Proxy**: Nginx Alpine

## Docker Strategy

### Multi-Stage Builds

All services use multi-stage builds:

1. **deps** — Install dependencies
2. **builder** — Build TypeScript/Next.js
3. **production** — Minimal runtime image

### Image Optimization

- Alpine Linux base images (~50MB vs ~200MB for standard)
- Layer caching for faster rebuilds
- `.dockerignore` to exclude unnecessary files
- Production images target < 150MB per service

### Security Features

- Non-root user execution (node user, uid 1000)
- Read-only root filesystem where possible
- Minimal attack surface (Alpine base)
- Health checks on all services
- Secrets via environment variables only

## Environment Configurations

### Development

- Volume mounts for hot reload
- Source code mounted into containers
- Debug ports exposed
- TypeScript compilation in-container
- Local PostgreSQL and Redis

### Production

- No volume mounts (immutable images)
- Pre-built artifacts only
- Environment-specific configuration
- External services (Cloudflare D1, KV, R2)
- Nginx reverse proxy
- Resource limits enforced

## Service Dependencies

```
┌─────────────────┐     ┌─────────────────┐
│  opensyber-web  │────▶│  opensyber-api  │
└─────────────────┘     └─────────────────┘
        │                       │
        │                       ├────▶ PostgreSQL (dev)
        │                       └────▶ Redis (dev)
        │
┌─────────────────┐     ┌─────────────────┐
│tokenforge-web   │────▶│tokenforge-api   │
└─────────────────┘     └─────────────────┘
        │                       │
        │                       ├────▶ PostgreSQL (dev)
        │                       └────▶ Redis (dev)
        │
┌─────────────────┐
│  nginx          │────▶ All services
└─────────────────┘
```

## CI/CD Pipeline

1. **Build Stage** — Build all Docker images
2. **Test Stage** — Run tests in containers
3. **Scan Stage** — Security scanning with Trivy
4. **Push Stage** — Push to registry (if tagged)
5. **Deploy Stage** — Deploy to Cloudflare (if applicable)

## Migration Path

### Phase 1: Local Development (Current)
- Use Docker Compose for local development
- Replace local Node.js with containers
- Maintain compatibility with Cloudflare deployment

### Phase 2: Self-Hosted Deployment
- Deploy containers to VPS (Hetzner, DigitalOcean)
- Use Docker Compose or Kubernetes
- Replace Cloudflare services with local alternatives

### Phase 3: Hybrid Deployment
- Keep Cloudflare Workers for production
- Use Docker for development, testing, and staging
- Use containers for worker-only services (agent daemon)

## File Structure

```
.luna/sprint-24-agent-security-platform/docker/
├── dockerization-plan.md          # This file
├── Dockerfile.api                 # OpenSyber API Dockerfile
├── Dockerfile.api.dev             # OpenSyber API dev Dockerfile
├── Dockerfile.web                 # OpenSyber Web Dockerfile
├── Dockerfile.web.dev             # OpenSyber Web dev Dockerfile
├── Dockerfile.agent               # Agent daemon Dockerfile
├── Dockerfile.agent.dev           # Agent daemon dev Dockerfile
├── Dockerfile.tokenforge-api      # TokenForge API Dockerfile
├── Dockerfile.tokenforge-api.dev  # TokenForge API dev Dockerfile
├── Dockerfile.tokenforge-web      # TokenForge Web Dockerfile
├── Dockerfile.tokenforge-web.dev  # TokenForge Web dev Dockerfile
├── docker-compose.yml             # Production compose
├── docker-compose.dev.yml         # Development compose
├── docker-compose.test.yml        # Testing compose
├── .dockerignore                  # Docker ignore rules
├── .dockerignore.api              # API-specific ignores
├── .dockerignore.web              # Web-specific ignores
├── nginx.conf                     # Nginx configuration
├── Makefile                       # Helper commands
└── .github/
    └── workflows/
        └── docker.yml             # CI/CD workflow
```

## Next Steps

1. Create Dockerfiles for each service
2. Create Docker Compose configurations
3. Add .dockerignore files
4. Create Nginx configuration
5. Create Makefile for common commands
6. Set up CI/CD workflow
7. Test local development setup
8. Document usage and deployment

## Notes

- Cloudflare Workers deployment remains primary production target
- Docker is for local development, testing, and self-hosted scenarios
- Service boundaries remain the same as monorepo structure
- All environment variables must be externalized
- Database migrations run in separate containers
