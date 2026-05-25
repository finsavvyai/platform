# ClawPipe Gateway — Multi-stage Docker build
# Self-hosted deployment for enterprise customers

# Stage 1: Build TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

COPY gateway/package.json gateway/package-lock.json* ./
RUN npm ci --ignore-scripts

COPY gateway/tsconfig.json ./
COPY gateway/src ./src

RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runtime

WORKDIR /app

RUN addgroup -S clawpipe && adduser -S clawpipe -G clawpipe

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=8787

# Auth and encryption
ENV AUTH_SECRET=""

# Database connection (Postgres for self-hosted)
ENV DATABASE_URL=""

# Provider API keys
ENV OPENAI_API_KEY=""
ENV ANTHROPIC_API_KEY=""
ENV DEEPSEEK_API_KEY=""
ENV GROQ_API_KEY=""
ENV MISTRAL_API_KEY=""

# Stripe billing
ENV STRIPE_SECRET_KEY=""
ENV STRIPE_WEBHOOK_SECRET=""

EXPOSE 8787

USER clawpipe

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8787/health || exit 1

CMD ["node", "dist/index.js"]
