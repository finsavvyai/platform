// HashiCorp Vault adapter — closes ENTERPRISE_ROADMAP.md P1 #9.
//
// Two auth flows supported:
//   - Token: simplest, best for dev. VAULT_TOKEN env var.
//   - AppRole: recommended for production. VAULT_ROLE_ID + VAULT_SECRET_ID.
//
// KV v2 reads only. Writes intentionally not exposed from the API layer;
// secrets should flow Vault → runner, never the other way.
//
// Why not use the vault npm client? It pulls in node streams/crypto which
// Cloudflare Workers doesn't ship. This is a thin fetch() wrapper.

export interface VaultConfig {
  addr: string;
  namespace?: string;
  token?: string;
  roleId?: string;
  secretId?: string;
}

export interface VaultSecret {
  data: Record<string, unknown>;
  version: number;
  createdTime: string;
}

export class VaultClient {
  private config: VaultConfig;
  private cachedToken?: string;
  private tokenExpiresAt = 0;

  constructor(config: VaultConfig) {
    if (!config.addr) throw new Error("vault: addr required");
    if (!config.token && !config.roleId) {
      throw new Error("vault: either token or roleId+secretId required");
    }
    this.config = config;
  }

  async readSecret(mount: string, path: string): Promise<VaultSecret> {
    const token = await this.ensureToken();
    const url = `${this.config.addr}/v1/${mount}/data/${path}`;
    const res = await fetch(url, { headers: this.headers(token) });
    if (!res.ok) {
      throw new Error(`vault: read ${path} failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      data: { data: Record<string, unknown>; metadata: { version: number; created_time: string } };
    };
    return {
      data: body.data.data,
      version: body.data.metadata.version,
      createdTime: body.data.metadata.created_time,
    };
  }

  private async ensureToken(): Promise<string> {
    if (this.config.token) return this.config.token;
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAt - 30_000) {
      return this.cachedToken;
    }
    const loginUrl = `${this.config.addr}/v1/auth/approle/login`;
    const res = await fetch(loginUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        role_id: this.config.roleId,
        secret_id: this.config.secretId,
      }),
    });
    if (!res.ok) {
      throw new Error(`vault: approle login failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      auth: { client_token: string; lease_duration: number };
    };
    this.cachedToken = body.auth.client_token;
    this.tokenExpiresAt = now + body.auth.lease_duration * 1000;
    return this.cachedToken;
  }

  private headers(token?: string): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (token) h["x-vault-token"] = token;
    if (this.config.namespace) h["x-vault-namespace"] = this.config.namespace;
    return h;
  }
}

export function vaultFromEnv(env: Record<string, string | undefined>): VaultClient | null {
  if (!env.VAULT_ADDR) return null;
  return new VaultClient({
    addr: env.VAULT_ADDR,
    namespace: env.VAULT_NAMESPACE,
    token: env.VAULT_TOKEN,
    roleId: env.VAULT_ROLE_ID,
    secretId: env.VAULT_SECRET_ID,
  });
}
