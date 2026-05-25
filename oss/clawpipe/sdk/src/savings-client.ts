/** Savings client — fetches per-project savings from the gateway and caches
 * the result in memory for at most 60s. Errors are swallowed so a savings
 * lookup failure NEVER breaks pipe.prompt() / pipe.stream().
 */

export interface SavingsSnapshot {
  thisMonth: number;
  sinceStart: number;
  percent: number;
  currency: 'USD';
}

export interface SavingsClientConfig {
  gatewayUrl: string;
  apiKey: string;
  projectId: string;
  /** Cache TTL in ms. Default 60_000. Tests may override to 0. */
  ttlMs?: number;
  /** Pluggable fetch — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export class SavingsClient {
  private cfg: Required<Omit<SavingsClientConfig, 'fetchImpl'>> & { fetchImpl: typeof fetch };
  private cached: SavingsSnapshot | null = null;
  private fetchedAt = 0;

  constructor(cfg: SavingsClientConfig) {
    this.cfg = {
      gatewayUrl: cfg.gatewayUrl,
      apiKey: cfg.apiKey,
      projectId: cfg.projectId,
      ttlMs: cfg.ttlMs ?? 60_000,
      fetchImpl: cfg.fetchImpl ?? ((typeof fetch !== 'undefined') ? fetch : (() => { throw new Error('no fetch'); }) as unknown as typeof fetch),
    };
  }

  /** Returns cached value if fresh; else attempts a fetch. Returns null on error. */
  async get(): Promise<SavingsSnapshot | null> {
    const now = Date.now();
    if (this.cached && now - this.fetchedAt < this.cfg.ttlMs) {
      return this.cached;
    }
    try {
      const res = await this.cfg.fetchImpl(`${this.cfg.gatewayUrl}/savings`, {
        headers: {
          Authorization: `Bearer ${this.cfg.apiKey}`,
          'X-Project-Id': this.cfg.projectId,
        },
      });
      if (!res.ok) return this.cached; // don't poison cache on transient errs
      const json = await res.json() as SavingsSnapshot;
      // Defensive shape check
      if (typeof json?.thisMonth !== 'number') return null;
      this.cached = json;
      this.fetchedAt = now;
      return json;
    } catch {
      return null;
    }
  }

  /** For tests: clear cache. */
  reset(): void {
    this.cached = null;
    this.fetchedAt = 0;
  }
}
