# Production Dockerfile for Admin UI (Next.js)
# Classic (non-standalone) deploy — prerender of /_not-found regresses under
# standalone output; revisit once root cause is fixed.
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runtime
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./next.config.js

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --spider -q http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]

LABEL org.opencontainers.image.title="SDLC Admin UI" \
      org.opencontainers.image.description="Admin dashboard for SDLC Platform" \
      org.opencontainers.image.source="https://github.com/sdlc-ai/platform"
