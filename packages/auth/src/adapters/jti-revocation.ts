import { sha256Hex } from "../token-utils.js";

export interface JtiRevocationStore {
  revoke(jti: string, ttlSeconds: number): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
}

export interface RedisJtiClient {
  setEx(key: string, ttlSeconds: number, value: string): Promise<unknown> | unknown;
  get(key: string): Promise<string | null | undefined> | string | null | undefined;
  del?(key: string): Promise<unknown> | unknown;
}

export interface RedisJtiStoreOptions {
  readonly client: RedisJtiClient;
  readonly keyPrefix?: string;
}

export class NullJtiStore implements JtiRevocationStore {
  async revoke(): Promise<void> {
    return;
  }
  async isRevoked(): Promise<boolean> {
    return false;
  }
}

export class InMemoryJtiStore implements JtiRevocationStore {
  private readonly revocations = new Map<string, number>();

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    this.revocations.set(jti, Date.now() + ttlSeconds * 1000);
  }

  async isRevoked(jti: string): Promise<boolean> {
    const expiresAt = this.revocations.get(jti);
    if (expiresAt === undefined) return false;
    if (expiresAt < Date.now()) {
      this.revocations.delete(jti);
      return false;
    }
    return true;
  }

  size(): number {
    return this.revocations.size;
  }
}

export class RedisJtiStore implements JtiRevocationStore {
  private readonly client: RedisJtiClient;
  private readonly keyPrefix: string;

  constructor(options: RedisJtiStoreOptions) {
    this.client = options.client;
    this.keyPrefix = options.keyPrefix ?? "auth:jti:";
  }

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    if (!isUsableJti(jti)) return;
    const ttl = Math.floor(ttlSeconds);
    const key = await this.keyFor(jti);
    if (ttl <= 0) {
      await this.client.del?.(key);
      return;
    }
    await this.client.setEx(key, ttl, "1");
  }

  async isRevoked(jti: string): Promise<boolean> {
    if (!isUsableJti(jti)) return false;
    const value = await this.client.get(await this.keyFor(jti));
    return value !== null && value !== undefined;
  }

  private async keyFor(jti: string): Promise<string> {
    return `${this.keyPrefix}${await sha256Hex(jti)}`;
  }
}

const isUsableJti = (jti: string): boolean => jti.trim().length > 0;
