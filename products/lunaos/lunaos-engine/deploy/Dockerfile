FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@9

FROM base AS dependencies
COPY pnpm-lock.yaml package.json ./
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY . .
RUN pnpm build

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --production --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder /app/packages/cli/dist ./packages/cli/dist

EXPOSE 8040

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8040/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "dist/packages/engine/src/index.js"]
