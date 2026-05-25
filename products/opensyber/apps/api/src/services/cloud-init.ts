/** Cloud-init user_data builder for Hetzner agent provisioning. */

export interface CloudInitOptions {
  instanceId: string;
  gatewayToken: string;
  apiBaseUrl: string;
  agentImage: string;
  region?: string;
  tailscaleAuthKey?: string;
}

export function buildCloudInit(opts: CloudInitOptions): string {
  if (!opts.instanceId) throw new Error('instanceId is required');
  if (!opts.gatewayToken) throw new Error('gatewayToken is required');
  if (!opts.apiBaseUrl) throw new Error('apiBaseUrl is required');
  if (!opts.agentImage) throw new Error('agentImage is required');

  const { instanceId, gatewayToken, apiBaseUrl, agentImage, region, tailscaleAuthKey } = opts;

  // cloud-config is YAML — indentation matters
  return `#cloud-config
package_update: true
package_upgrade: true

packages:
  - ca-certificates
  - curl
  - gnupg
  - fail2ban
  - auditd
  - unattended-upgrades

write_files:
  - path: /etc/opensyber/agent.env
    permissions: "0600"
    content: |
      OPENSYBER_INSTANCE_ID=${instanceId}
      OPENSYBER_GATEWAY_TOKEN=${gatewayToken}
      OPENSYBER_API_URL=${apiBaseUrl}
      OPENSYBER_REGION=${region ?? 'eu-central'}

  - path: /etc/fail2ban/jail.local
    permissions: "0644"
    content: |
      [sshd]
      enabled = true
      maxretry = 3
      bantime = 3600

  - path: /etc/audit/rules.d/opensyber.rules
    permissions: "0640"
    content: |
      -a always,exit -F arch=b64 -S execve -k exec_log
      -a always,exit -F arch=b64 -S connect -k net_log
      -w /etc/opensyber/ -p wa -k config_change

runcmd:
  # Install Docker CE
  - install -m 0755 -d /etc/apt/keyrings
  - |
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \\
      gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  - chmod a+r /etc/apt/keyrings/docker.gpg
  - |
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \\
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \\
    > /etc/apt/sources.list.d/docker.list
  - apt-get update
  - apt-get install -y docker-ce docker-ce-cli containerd.io

  # Harden SSH — no root login, no password auth
  - sed -i 's/#PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
  - sed -i 's/#PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  - systemctl restart sshd

  # Start fail2ban and auditd
  - systemctl enable --now fail2ban
  - systemctl enable --now auditd

  # Create non-root user for agent
  - useradd -m -s /bin/bash -G docker syberagent

  # Pull agent image
  - docker pull ${agentImage}
${tailscaleAuthKey ? `
  # Install Docker Compose plugin
  - apt-get install -y docker-compose-plugin

  # Write Docker Compose with Tailscale sidecar
  - |
    cat > /etc/opensyber/docker-compose.yml << 'COMPOSE'
    services:
      tailscale:
        image: tailscale/tailscale:latest
        hostname: agent-${instanceId}
        environment:
          - TS_AUTHKEY=${tailscaleAuthKey}
          - TS_HOSTNAME=agent-${instanceId}
          - TS_USERSPACE=true
          - TS_STATE_DIR=/var/lib/tailscale
          - TS_ACCEPT_ROUTES=true
        volumes:
          - tailscale-state:/var/lib/tailscale
        cap_add:
          - NET_ADMIN
          - NET_RAW
        restart: unless-stopped
        healthcheck:
          test: ["CMD", "tailscale", "status"]
          interval: 30s
          timeout: 10s
          retries: 3

      ollama:
        image: ollama/ollama:latest
        volumes:
          - ollama-models:/root/.ollama
        restart: unless-stopped
        healthcheck:
          test: ["CMD", "ollama", "list"]
          interval: 30s
          timeout: 10s
          retries: 5

      agent:
        image: ${agentImage}
        network_mode: "service:tailscale"
        env_file: /etc/opensyber/agent.env
        environment:
          - OLLAMA_URL=http://ollama:11434
        security_opt:
          - no-new-privileges:true
        cap_drop:
          - ALL
        cap_add:
          - NET_BIND_SERVICE
          - NET_ADMIN
        read_only: true
        tmpfs:
          - /tmp:rw,noexec,nosuid
        volumes:
          - /var/log/opensyber:/var/log/opensyber
        restart: unless-stopped
        depends_on:
          tailscale:
            condition: service_healthy
          ollama:
            condition: service_healthy

    volumes:
      tailscale-state:
      ollama-models:
    COMPOSE

  # Start via Docker Compose (agent shares Tailscale network)
  - docker compose -f /etc/opensyber/docker-compose.yml up -d

  # Pull self-hosted guard model into Ollama (background — non-blocking)
  - docker compose -f /etc/opensyber/docker-compose.yml exec -d ollama ollama pull superagent-guard-1.7b-Q8_0
` : `
  # Run agent container (no Tailscale — standalone mode)
  - |
    docker run -d \\
      --name opensyber-agent \\
      --restart unless-stopped \\
      --env-file /etc/opensyber/agent.env \\
      --security-opt no-new-privileges:true \\
      --cap-drop ALL \\
      --cap-add NET_BIND_SERVICE \\
      --cap-add NET_ADMIN \\
      --read-only \\
      --tmpfs /tmp:rw,noexec,nosuid \\
      -p 22:22 \\
      -v /var/log/opensyber:/var/log/opensyber \\
      ${agentImage}
`}
  # Callback to API — mark instance as provisioned
  - |
    curl -sf -X POST "${apiBaseUrl}/webhooks/agent/provisioned" \\
      -H "Content-Type: application/json" \\
      -H "X-Gateway-Token: ${gatewayToken}" \\
      -H "X-Instance-Id: ${instanceId}" \\
      -d "{\\"instanceId\\":\\"${instanceId}\\",\\"event\\":\\"provisioned\\"}" \\
      || echo "Callback failed — agent health monitor will update status"
`;
}

/** Base64-encode cloud-init script for Hetzner user_data API field. */
export function encodeCloudInit(script: string): string {
  return btoa(unescape(encodeURIComponent(script)));
}

/** Default GHCR image path. Override with AGENT_IMAGE env var. */
export const DEFAULT_AGENT_IMAGE =
  'ghcr.io/finsavvyai/opensyber-agent:latest';
