export interface JtiRevocationStore {
  revoke(jti: string, ttlSeconds: number): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
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
