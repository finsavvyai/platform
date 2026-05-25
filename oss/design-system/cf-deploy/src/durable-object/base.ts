export interface DurableObjectStorage {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(options?: unknown): Promise<Map<string, unknown>>;
}

export interface DurableObjectState {
  storage: DurableObjectStorage;
  id: string;
  blockConcurrencyWhile: (callback: () => Promise<void>) => Promise<void>;
}

export class DurableObjectBase {
  protected storage: DurableObjectStorage;
  protected id: string;

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
    this.id = state.id;
  }

  async getState<T = unknown>(key: string): Promise<T | null> {
    const value = await this.storage.get(key);
    return (value as T) || null;
  }

  async setState<T = unknown>(key: string, value: T): Promise<void> {
    await this.storage.put(key, value);
  }

  async deleteState(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }

  async listState(): Promise<Map<string, unknown>> {
    return this.storage.list();
  }

  getId(): string {
    return this.id;
  }
}
