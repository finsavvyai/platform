import type { GatewayResponse, SemanticCache } from "./types.js";

export class InMemorySemanticCache implements SemanticCache {
  private readonly store = new Map<string, GatewayResponse>();

  async get(key: string): Promise<GatewayResponse | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: GatewayResponse): Promise<void> {
    this.store.set(key, value);
  }

  size(): number {
    return this.store.size;
  }
}
