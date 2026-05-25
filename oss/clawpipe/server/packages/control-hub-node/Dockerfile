FROM node:20-alpine

WORKDIR /app

COPY packages/control-hub-node/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY packages/control-hub-node/server.js ./server.js
COPY packages/control-hub-node/public ./public

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=9090

EXPOSE 9090

CMD ["node", "server.js"]
