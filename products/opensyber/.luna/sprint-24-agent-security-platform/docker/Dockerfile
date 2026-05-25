# Multi-stage Dockerfile for OpenSyber Next.js Applications
# Optimized for both development and production builds

# ============================================
# Stage 1: Base - Dependencies
# ============================================
FROM node:22-alpine AS base
# Install pnpm
RUN npm install -g pnpm@10.6.2
# Set working directory
WORKDIR /app
# Configure pnpm
RUN pnpm config set store-dir /root/.pnpm-store

# ============================================
# Stage 2: Development
# ============================================
FROM base AS development

# Install build dependencies
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    sqlite

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./
COPY tsconfig.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy all source code
COPY . .

# Expose Next.js port
EXPOSE 3000 3001

# Default to development mode
CMD ["pnpm", "dev"]

# ============================================
# Stage 3: Dependencies (for production)
# ============================================
FROM base AS dependencies

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./
COPY tsconfig.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# ============================================
# Stage 4: Builder
# ============================================
FROM dependencies AS builder

# Copy all source code
COPY . .

# Build all packages (uses Turborepo)
RUN pnpm run build

# ============================================
# Stage 5: Production (for Node.js server)
# ============================================
FROM base AS production

# Install production dependencies only
RUN apk add --no-cache wget

# Copy built artifacts from builder
COPY --from=builder /app/apps/web/.next /app/apps/web/.next
COPY --from=builder /app/apps/web/public /app/apps/web/public
COPY --from=builder /app/apps/web/package.json /app/apps/web/
COPY --from=builder /apps/web/node_modules /app/apps/web/node_modules

WORKDIR /app/apps/web

# Set environment to production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Expose port
EXPOSE 3000

# Run Next.js in production mode
CMD ["node", "node_modules/next/dist/bin/next", "start"]

# ============================================
# Stage 6: Static Export (for Cloudflare Pages)
# ============================================
FROM node:22-alpine AS static-export

# Install dependencies
RUN npm install -g pnpm@10.6.2
WORKDIR /app

# Copy and build
COPY --from=builder /app /app

# Create static export (for testing, actual CF build uses OpenNext)
RUN cd apps/web && pnpm run build

# Output will be in apps/web/out
