export interface AIProvider {
  name: string;
  convertNLToSQL(prompt: string, schema: string): Promise<string>;
  optimizeQuery(sql: string, schema: string): Promise<{ optimizedSQL: string; explanation: string }>;
  explainQuery(sql: string): Promise<string>;
  isHealthy(): Promise<boolean>;
}

export interface AIProviderConfig {
  openHandsURL?: string;
  openHandsAPIKey?: string;
  openClawURL?: string;
  openClawAPIKey?: string;
}

async function postJSON<T>(url: string, body: unknown, apiKey?: string, timeoutMs = 60_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}: ${text}`);
    }

    return (await resp.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function getHealth(url: string): Promise<boolean> {
  try {
    const resp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
    return resp.ok;
  } catch {
    return false;
  }
}

// ── OpenHands Provider ─────────────────────────────────────────

export class OpenHandsProvider implements AIProvider {
  name = 'openhands';
  constructor(private baseURL: string, private apiKey?: string) {}

  async convertNLToSQL(prompt: string, schema: string): Promise<string> {
    const res = await postJSON<{ sql: string }>(
      `${this.baseURL}/api/queryflux/generate-sql`,
      { prompt, schema },
      this.apiKey,
    );
    return res.sql.trim();
  }

  async optimizeQuery(sql: string, schema: string) {
    const res = await postJSON<{ optimizedQuery: string; explanation: string }>(
      `${this.baseURL}/api/queryflux/optimize`,
      { query: sql, schema },
      this.apiKey,
    );
    return { optimizedSQL: res.optimizedQuery, explanation: res.explanation };
  }

  async explainQuery(sql: string): Promise<string> {
    const res = await postJSON<{ explanation: string }>(
      `${this.baseURL}/api/queryflux/explain`,
      { query: sql },
      this.apiKey,
    );
    return res.explanation;
  }

  async isHealthy(): Promise<boolean> {
    return getHealth(this.baseURL);
  }
}

// ── OpenClaw Provider ──────────────────────────────────────────

export class OpenClawProvider implements AIProvider {
  name = 'openclaw';
  constructor(private baseURL: string, private apiKey?: string) {}

  async convertNLToSQL(prompt: string, schema: string): Promise<string> {
    const res = await postJSON<{ sql: string }>(
      `${this.baseURL}/api/v1/nl-to-sql`,
      { naturalLanguage: prompt, databaseSchema: schema },
      this.apiKey,
    );
    return res.sql.trim();
  }

  async optimizeQuery(sql: string, schema: string) {
    const res = await postJSON<{ optimizedQuery: string; explanation: string }>(
      `${this.baseURL}/api/v1/optimize-query`,
      { sql, schema },
      this.apiKey,
    );
    return { optimizedSQL: res.optimizedQuery, explanation: res.explanation };
  }

  async explainQuery(sql: string): Promise<string> {
    const res = await postJSON<{ explanation: string }>(
      `${this.baseURL}/api/v1/explain-query`,
      { sql },
      this.apiKey,
    );
    return res.explanation;
  }

  async isHealthy(): Promise<boolean> {
    return getHealth(this.baseURL);
  }
}
