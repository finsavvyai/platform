/**
 * Gateway Router with Failover and Circuit Breaker
 * Routes payments to the optimal gateway based on configurable rules.
 * Automatic failover on primary gateway failure; circuit breaker
 * prevents hammering a failing gateway.
 */

import { z } from 'zod';
import type { GatewayRegistry, PaymentGateway, PaymentIntent, PaymentResult } from './gateway-models';
import { GatewayError } from './gateway-models';

// --- Routing Rule Schema ---

export const routingRuleSchema = z.object({
  id: z.string().min(1),
  conditions: z.object({
    currency: z.string().length(3).regex(/^[A-Z]{3}$/).optional(),
    country: z.string().length(2).regex(/^[A-Z]{2}$/).optional(),
    amount_min: z.number().nonnegative().optional(),
    amount_max: z.number().positive().optional(),
  }),
  preferred_gateway: z.string().min(1),
  fallback_gateway: z.string().min(1).optional(),
  priority: z.number().int().min(0).default(0),
});

export type RoutingRule = z.infer<typeof routingRuleSchema>;

// --- Circuit Breaker State ---

interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

// --- Gateway Health ---

export interface GatewayHealth {
  gateway: string;
  successCount: number;
  failureCount: number;
  isHealthy: boolean;
  avgLatencyMs: number;
  lastChecked: number;
}

// --- Gateway Router ---

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 60_000;

export class GatewayRouter {
  private registry: GatewayRegistry;
  private rules: RoutingRule[] = [];
  private circuits = new Map<string, CircuitState>();
  private healthStats = new Map<string, { successes: number; failures: number; totalLatency: number }>();

  constructor(registry: GatewayRegistry) {
    this.registry = registry;
  }

  setRules(rules: RoutingRule[]): void {
    this.rules = [...rules].sort((a, b) => b.priority - a.priority);
  }

  /** Select the best gateway based on rules and circuit state. */
  route(intent: PaymentIntent): PaymentGateway {
    for (const rule of this.rules) {
      if (this.matchesRule(rule, intent)) {
        const primary = this.getHealthyGateway(rule.preferred_gateway);
        if (primary) return primary;

        if (rule.fallback_gateway) {
          const fallback = this.getHealthyGateway(rule.fallback_gateway);
          if (fallback) return fallback;
        }
      }
    }

    const defaultGw = this.registry.getDefault();
    if (defaultGw && !this.isCircuitOpen(defaultGw.name)) return defaultGw;

    throw new GatewayError('No healthy gateway available', 'router');
  }

  /** Route and process a payment with automatic failover. */
  async processPayment(intent: PaymentIntent): Promise<PaymentResult> {
    const primary = this.route(intent);
    const start = Date.now();

    try {
      const result = await primary.authorize(intent);
      this.recordSuccess(primary.name, Date.now() - start);
      return result;
    } catch (err) {
      this.recordFailure(primary.name);

      const fallback = this.findFallback(intent, primary.name);
      if (fallback) {
        const fbStart = Date.now();
        try {
          const result = await fallback.authorize(intent);
          this.recordSuccess(fallback.name, Date.now() - fbStart);
          return result;
        } catch (fbErr) {
          this.recordFailure(fallback.name);
          throw fbErr;
        }
      }

      throw err;
    }
  }

  /** Get health stats for all registered gateways. */
  getHealth(): GatewayHealth[] {
    return this.registry.list().map((name) => {
      const stats = this.healthStats.get(name) ?? { successes: 0, failures: 0, totalLatency: 0 };
      const total = stats.successes + stats.failures;
      return {
        gateway: name,
        successCount: stats.successes,
        failureCount: stats.failures,
        isHealthy: !this.isCircuitOpen(name),
        avgLatencyMs: total > 0 ? Math.round(stats.totalLatency / total) : 0,
        lastChecked: Date.now(),
      };
    });
  }

  // --- Internal ---

  private matchesRule(rule: RoutingRule, intent: PaymentIntent): boolean {
    const { conditions } = rule;
    if (conditions.currency && conditions.currency !== intent.currency) return false;
    if (conditions.amount_min !== undefined && intent.amount < conditions.amount_min) return false;
    if (conditions.amount_max !== undefined && intent.amount > conditions.amount_max) return false;
    return true;
  }

  private getHealthyGateway(name: string): PaymentGateway | null {
    if (this.isCircuitOpen(name)) return null;
    return this.registry.get(name) ?? null;
  }

  private findFallback(intent: PaymentIntent, excludeName: string): PaymentGateway | null {
    for (const rule of this.rules) {
      if (this.matchesRule(rule, intent) && rule.fallback_gateway && rule.fallback_gateway !== excludeName) {
        return this.getHealthyGateway(rule.fallback_gateway);
      }
    }
    for (const name of this.registry.list()) {
      if (name !== excludeName && !this.isCircuitOpen(name)) {
        return this.registry.get(name) ?? null;
      }
    }
    return null;
  }

  private isCircuitOpen(name: string): boolean {
    const state = this.circuits.get(name);
    if (!state || !state.isOpen) return false;
    if (Date.now() - state.lastFailure > CIRCUIT_RESET_MS) {
      state.isOpen = false;
      state.failures = 0;
      return false;
    }
    return true;
  }

  private recordSuccess(name: string, latencyMs: number): void {
    const stats = this.healthStats.get(name) ?? { successes: 0, failures: 0, totalLatency: 0 };
    stats.successes++;
    stats.totalLatency += latencyMs;
    this.healthStats.set(name, stats);
  }

  private recordFailure(name: string): void {
    const stats = this.healthStats.get(name) ?? { successes: 0, failures: 0, totalLatency: 0 };
    stats.failures++;
    this.healthStats.set(name, stats);

    const circuit = this.circuits.get(name) ?? { failures: 0, lastFailure: 0, isOpen: false };
    circuit.failures++;
    circuit.lastFailure = Date.now();
    if (circuit.failures >= CIRCUIT_THRESHOLD) circuit.isOpen = true;
    this.circuits.set(name, circuit);
  }
}
