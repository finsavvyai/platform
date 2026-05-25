# ============================================================================
# TenantIQ SvelteKit Application Dockerfile
# Multi-stage build for optimized production container
# ============================================================================

# Stage 1: Dependencies & Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy workspace files
COPY pnpm-lock.yaml package.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install dependencies (pnpm with frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile

# Build SvelteKit application
WORKDIR /app/apps/web
RUN pnpm build

# ============================================================================
# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Install pnpm in runtime image
RUN npm install -g pnpm@9.15.0

# Copy built application from builder
COPY --from=builder /app/apps/web/build ./

# Copy package.json for runtime dependencies
COPY --from=builder /app/apps/web/package.json ./
COPY --from=builder /app/package.json ./package.json

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile && pnpm prune --prod

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["/sbin/dumb-init", "--"]

# Start application
CMD ["node", "index.js"]
