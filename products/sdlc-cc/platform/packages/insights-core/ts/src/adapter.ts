import type { Insight, Receipt } from "./types.js";

export interface Capabilities {
  idempotent: boolean;
  requires_approval: boolean;
}

export interface Preview {
  summary: string;
  payload: Record<string, unknown>;
}

export interface Adapter {
  name(): string;
  capabilities(): Capabilities;
  validate(params: Record<string, unknown>): void;
  dryRun(ins: Insight, params: Record<string, unknown>): Promise<Preview>;
  execute(ins: Insight, params: Record<string, unknown>): Promise<Receipt>;
}

export class Registry {
  private readonly adapters = new Map<string, Adapter>();

  register(a: Adapter): void {
    if (this.adapters.has(a.name())) {
      throw new Error(`adapter already registered: ${a.name()}`);
    }
    this.adapters.set(a.name(), a);
  }

  get(name: string): Adapter | undefined {
    return this.adapters.get(name);
  }

  names(): string[] {
    return [...this.adapters.keys()];
  }
}
