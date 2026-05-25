# Multi-stage Dockerfile for Claude Agent Platform
# Supports multiple service targets: api, web, agents, gateway

# ====================================================================
# Base Node.js Stage
# ====================================================================
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    curl \
    dumb-init \
    tzdata \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Set timezone
ENV TZ=UTC

# Create app user
RUN addgroup -g 1001 -S claude && \
    adduser -S claude -u 1001

# Set working directory
WORKDIR /app

# ====================================================================
# Dependencies Stage
# ====================================================================
FROM base AS deps

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/database/package.json ./packages/database/
COPY packages/cache/package.json ./packages/cache/
COPY packages/messaging/package.json ./packages/messaging/
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/

# Install pnpm
RUN npm install -g pnpm@8

# Install dependencies
RUN pnpm install --frozen-lockfile

# ====================================================================
# Builder Stage
# ====================================================================
FROM base AS builder

# Copy node modules
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY packages/ ./packages/
COPY tsconfig.json ./

# Install pnpm
RUN npm install -g pnpm@8

# Build packages
RUN pnpm run build:packages

# ====================================================================
# API Service Target
# ====================================================================
FROM base AS api

# Copy built packages
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/dist ./packages/database/dist/
COPY --from=builder /app/packages/cache/dist ./packages/cache/dist/
COPY --from=builder /app/packages/messaging/dist ./packages/messaging/dist/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist/
COPY --from=builder /app/packages/types/dist ./packages/types/dist/

# Copy API source
COPY packages/api/ ./packages/api/
COPY packages/database/ ./packages/database/

# Install API-specific dependencies
WORKDIR /app/packages/api
RUN pnpm install --frozen-lockfile --production

# Generate Prisma client
RUN pnpm run db:generate

# Switch to non-root user
USER claude

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Expose port
EXPOSE 3001

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# ====================================================================
# Web Service Target
# ====================================================================
FROM base AS web

# Copy built packages
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist/
COPY --from=builder /app/packages/types/dist ./packages/types/dist/

# Copy web source
COPY apps/web/ ./apps/web/

# Install web-specific dependencies
WORKDIR /app/apps/web
RUN pnpm install --frozen-lockfile --production

# Build Next.js app
RUN pnpm run build

# Switch to non-root user
USER claude

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Expose port
EXPOSE 3000

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["pnpm", "start"]

# ====================================================================
# Luna Agents Service Target
# ====================================================================
FROM base AS agents

# Copy built packages
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist/
COPY --from=builder /app/packages/types/dist ./packages/types/dist/

# Copy agents source
COPY luna-agents/ ./luna-agents/

# Install agents-specific dependencies
WORKDIR /app/luna-agents
RUN pnpm install --frozen-lockfile --production

# Build agents
RUN pnpm run build

# Switch to non-root user
USER claude

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3002/api/health || exit 1

# Expose port
EXPOSE 3002

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# ====================================================================
# API Gateway Service Target
# ====================================================================
FROM base AS gateway

# Copy built packages
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist/
COPY --from=builder /app/packages/types/dist ./packages/types/dist/

# Copy gateway source
COPY packages/gateway/ ./packages/gateway/

# Install gateway-specific dependencies
WORKDIR /app/packages/gateway
RUN pnpm install --frozen-lockfile --production

# Build gateway
RUN pnpm run build

# Switch to non-root user
USER claude

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3003/api/health || exit 1

# Expose port
EXPOSE 3003

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# ====================================================================
# Development Stage
# ====================================================================
FROM base AS development

# Copy source code
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY luna-agents/ ./luna-agents/
COPY tsconfig.json ./

# Install all dependencies (including dev)
RUN npm install -g pnpm@8 && \
    pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @claude-agent/database db:generate

# Switch to non-root user
USER claude

# Install development tools
RUN npm install -g nodemon tsx

# Expose ports
EXPOSE 3000 3001 3002 3003 5555 9229

# Start development services
ENTRYPOINT ["dumb-init", "--"]
CMD ["pnpm", "run", "dev"]

# ====================================================================
# Default Target
# ====================================================================
FROM api
