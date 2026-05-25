# Build stage for dependencies
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Build stage for web app
FROM base AS web-builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/web
RUN npm run build

# Build stage for API
FROM base AS api-builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/api
RUN npm run build

# Production web stage
FROM node:20-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=web-builder /app/apps/web/.next /app/.next
COPY --from=web-builder /app/apps/web/public /app/public
COPY --from=web-builder /app/apps/web/package.json /app/package.json
COPY --from=deps /app/node_modules /app/node_modules

RUN npm cache clean --force && npm install -g pnpm
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "--max-old-space-size=512", "/app/node_modules/.bin/next", "start", "-p", "3000"]

# Production API stage
FROM node:20-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=api-builder /app/apps/api/dist /app/dist
COPY --from=api-builder /app/apps/api/package.json /app/package.json
COPY --from=deps /app/node_modules /app/node_modules

RUN npm cache clean --force
RUN addgroup -g 1001 -S nodejs && adduser -S hono -u 1001

USER hono
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "/app/dist/index.js"]
