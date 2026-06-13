import type { CustomerId } from "@finsavvyai/billing";

/**
 * Per-customer, per-entitlement usage counter for the current billing period.
 *
 * The entitlement resolver gives a `limit`; this records consumption against
 * it. Production wires a durable, period-scoped implementation (KV / Postgres
 * keyed by customer + key + period). `InMemoryUsageMeter` is dev/test only and
 * resets when the process restarts.
 */
export interface UsageMeter {
  record(customerId: CustomerId, key: string): Promise<void>;
  used(customerId: CustomerId, key: string): Promise<number>;
}

export class InMemoryUsageMeter implements UsageMeter {
  private readonly counts = new Map<string, number>();

  public async record(customerId: CustomerId, key: string): Promise<void> {
    const id = this.id(customerId, key);
    this.counts.set(id, (this.counts.get(id) ?? 0) + 1);
  }

  public async used(customerId: CustomerId, key: string): Promise<number> {
    return this.counts.get(this.id(customerId, key)) ?? 0;
  }

  private id(customerId: CustomerId, key: string): string {
    return `${customerId}:${key}`;
  }
}
