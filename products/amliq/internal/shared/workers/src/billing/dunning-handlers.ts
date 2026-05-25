/**
 * Dunning API Endpoint Handlers
 * REST handlers for dunning management: config, status, retry, dashboard.
 * Admin role required for config changes; read access for subscription owners.
 */

import { z } from 'zod';
import {
  createDunningConfigSchema,
  updateDunningConfigSchema,
  manualRetrySchema,
  dunningStatusQuerySchema,
  dunningDashboardQuerySchema,
} from './dunning-validation';
import { DunningScheduler, DunningStore } from './dunning-scheduler';
import { DunningConfig } from './dunning-models';

// --- Request/Response types ---

export interface DunningRequest {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  tenantId: string;
  userRole: string;
}

export interface DunningResponse {
  status: number;
  body: unknown;
}

// --- Config Store interface ---

export interface DunningConfigStore {
  getConfig(tenantId: string): Promise<DunningConfig | null>;
  saveConfig(tenantId: string, config: DunningConfig): Promise<void>;
}

// --- Dashboard Metrics interface ---

export interface DunningMetrics {
  total_active: number;
  total_recovered: number;
  total_exhausted: number;
  recovery_rate: number;
  total_amount_at_risk: number;
  total_amount_recovered: number;
}

// --- Handler functions ---

export function createGetConfigHandler(configStore: DunningConfigStore) {
  return async (req: DunningRequest): Promise<DunningResponse> => {
    const config = await configStore.getConfig(req.tenantId);
    if (!config) {
      return { status: 404, body: { error: 'Dunning configuration not found' } };
    }
    return { status: 200, body: { data: config } };
  };
}

export function createUpdateConfigHandler(configStore: DunningConfigStore) {
  return async (req: DunningRequest): Promise<DunningResponse> => {
    if (req.userRole !== 'admin') {
      return { status: 403, body: { error: 'Admin role required' } };
    }

    const existing = await configStore.getConfig(req.tenantId);
    const schema = existing ? updateDunningConfigSchema : createDunningConfigSchema;
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return { status: 400, body: { error: 'Validation failed', details: parsed.error.issues } };
    }

    const merged = existing
      ? { ...existing, ...parsed.data }
      : (parsed.data as DunningConfig);
    await configStore.saveConfig(req.tenantId, merged);
    return { status: 200, body: { data: merged } };
  };
}

export function createGetSubscriptionDunningHandler(store: DunningStore) {
  return async (req: DunningRequest): Promise<DunningResponse> => {
    const subscriptionId = req.params?.id;
    if (!subscriptionId) {
      return { status: 400, body: { error: 'Subscription ID is required' } };
    }

    const schedule = await store.findBySubscription(subscriptionId);
    if (!schedule) {
      return { status: 404, body: { error: 'No dunning schedule found' } };
    }

    if (schedule.tenant_id !== req.tenantId) {
      return { status: 403, body: { error: 'Access denied' } };
    }

    return { status: 200, body: { data: schedule } };
  };
}

export function createManualRetryHandler(scheduler: DunningScheduler, store: DunningStore) {
  return async (req: DunningRequest): Promise<DunningResponse> => {
    if (req.userRole !== 'admin') {
      return { status: 403, body: { error: 'Admin role required' } };
    }

    const subscriptionId = req.params?.id;
    if (!subscriptionId) {
      return { status: 400, body: { error: 'Subscription ID is required' } };
    }

    const parsed = manualRetrySchema.safeParse(req.body);
    if (!parsed.success) {
      return { status: 400, body: { error: 'Validation failed', details: parsed.error.issues } };
    }

    const schedule = await store.findBySubscription(subscriptionId);
    if (!schedule) {
      return { status: 404, body: { error: 'No dunning schedule found' } };
    }
    if (schedule.tenant_id !== req.tenantId) {
      return { status: 403, body: { error: 'Access denied' } };
    }

    try {
      const attempt = await scheduler.executeRetry(schedule.id);
      return { status: 200, body: { data: attempt } };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Retry failed';
      return { status: 500, body: { error: message } };
    }
  };
}

export function createDashboardHandler() {
  return async (req: DunningRequest): Promise<DunningResponse> => {
    if (req.userRole !== 'admin') {
      return { status: 403, body: { error: 'Admin role required' } };
    }

    const parsed = dunningDashboardQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      return { status: 400, body: { error: 'Validation failed', details: parsed.error.issues } };
    }

    const metrics: DunningMetrics = {
      total_active: 0,
      total_recovered: 0,
      total_exhausted: 0,
      recovery_rate: 0,
      total_amount_at_risk: 0,
      total_amount_recovered: 0,
    };

    return { status: 200, body: { data: metrics, period: parsed.data.period } };
  };
}
