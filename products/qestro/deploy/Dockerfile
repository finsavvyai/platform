# Multi-stage Dockerfile for Qestro Playwright Test Runner
# Optimized for cloud deployment with minimal image size and security hardening

# Stage 1: Builder - Install dependencies and compile TypeScript
FROM node:20-alpine AS builder

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

WORKDIR /app

# Copy package files for dependency resolution
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with production-only flag for builder
RUN npm ci && npm cache clean --force

# Copy source code
COPY src ./src
COPY tests ./tests

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Runtime - Minimal production image with Playwright
FROM mcr.microsoft.com/playwright:v1.45.0-noble

ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=false \
    CHROME_NO_SANDBOX=true \
    FIREFOX_NO_SANDBOX=true \
    WEBKIT_NO_SANDBOX=true

WORKDIR /app

# Copy package files for production dependencies only
COPY package*.json ./

# Install production dependencies and Playwright browsers
RUN npm ci --only=production && \
    npm cache clean --force && \
    npx playwright install chromium firefox webkit && \
    npx playwright install-deps

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy configuration files
COPY drizzle.config.ts ./
COPY playwright.config.ts ./

# Create non-root user for security
RUN useradd -m -u 1001 testrunner && \
    chown -R testrunner:testrunner /app

USER testrunner

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Expose port for API and WebSocket
EXPOSE 3000 3001

# Default command - start test runner service
CMD ["node", "dist/index.js"]
