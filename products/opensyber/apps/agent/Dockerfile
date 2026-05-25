FROM node:22-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-server \
    fail2ban \
    auditd \
    iptables \
    rkhunter \
    procps \
    iproute2 \
    ca-certificates \
    gosu \
  && rm -rf /var/lib/apt/lists/*

# Configure SSH
RUN mkdir -p /var/run/sshd \
  && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config \
  && sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# Configure auditd for execve monitoring
RUN mkdir -p /etc/audit/rules.d
COPY apps/agent/audit.rules /etc/audit/rules.d/opensyber.rules

# Configure fail2ban
RUN mkdir -p /var/run/fail2ban

# Build stage — install deps with pnpm to resolve workspace: protocol
FROM base AS build
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy only the packages we need
COPY packages/shared/package.json packages/shared/
COPY apps/agent/package.json apps/agent/

# Install deps (workspace-aware)
RUN pnpm install --frozen-lockfile --filter @opensyber/agent...

# Copy built sources
COPY packages/shared/dist packages/shared/dist
COPY apps/agent/dist apps/agent/dist

# Runtime
FROM base AS runtime
WORKDIR /app

# Copy node_modules and dist from build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/agent/node_modules ./apps/agent/node_modules
COPY --from=build /app/apps/agent/dist ./dist
COPY --from=build /app/apps/agent/package.json ./package.json
COPY --from=build /app/packages/shared/dist ./node_modules/@opensyber/shared/dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@opensyber/shared/package.json

# Create non-root user for the agent process
RUN useradd -m -s /bin/bash syberagent \
  && chown -R syberagent:syberagent /app \
  && mkdir -p /home/syberagent/.syber-engine /var/log/opensyber \
  && chown -R syberagent:syberagent /home/syberagent/.syber-engine /var/log/opensyber

# Health check (runs inside the container; Node process is the target)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:18789/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 22

COPY apps/agent/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Entrypoint runs as root to configure iptables / auditd / sshd, then
# drops to `syberagent` via gosu before exec'ing the Node process.
ENTRYPOINT ["/entrypoint.sh"]
