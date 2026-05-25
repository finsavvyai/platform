/**
 * Revenue Recognition API Handlers
 * REST handlers for revenue recognition: contracts CRUD and report generation.
 * Follows the same pattern as dunning-handlers.ts.
 */

import {
  createContractSchema,
  generateReportSchema,
  listContractsQuerySchema,
} from './revrec-validation';
import { revenueContractSchema, type RevenueContract, type RevenueReport } from './revrec-models';
import { generateRevenueReport } from './revrec-report';

// --- Request/Response types ---

export interface RevRecRequest {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  tenantId: string;
  userRole: string;
}

export interface RevRecResponse {
  status: number;
  body: unknown;
}

// --- Store interface ---

export interface RevRecContractStore {
  save(contract: RevenueContract): Promise<void>;
  get(contractId: string, tenantId: string): Promise<RevenueContract | null>;
  list(tenantId: string, filter: { status?: string; page: number; limit: number }): Promise<RevenueContract[]>;
}

export interface RevRecReportStore {
  save(report: RevenueReport): Promise<void>;
  get(reportId: string, tenantId: string): Promise<RevenueReport | null>;
}

// --- Handler factories ---

/** POST /contracts -- create a new revenue contract. */
export function createContractHandler(store: RevRecContractStore) {
  return async (req: RevRecRequest): Promise<RevRecResponse> => {
    const parsed = createContractSchema.safeParse(req.body);
    if (!parsed.success) {
      return { status: 400, body: { error: 'Validation failed', details: parsed.error.issues } };
    }

    const contractId = generateId();
    const now = new Date().toISOString();
    const contract: RevenueContract = {
      ...parsed.data,
      contract_id: contractId,
      tenant_id: req.tenantId,
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    const validate = revenueContractSchema.safeParse(contract);
    if (!validate.success) {
      return { status: 400, body: { error: 'Contract validation failed', details: validate.error.issues } };
    }

    await store.save(contract);
    return { status: 201, body: { data: contract } };
  };
}

/** GET /contracts -- list contracts for tenant with pagination. */
export function listContractsHandler(store: RevRecContractStore) {
  return async (req: RevRecRequest): Promise<RevRecResponse> => {
    const parsed = listContractsQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      return { status: 400, body: { error: 'Validation failed', details: parsed.error.issues } };
    }

    const contracts = await store.list(req.tenantId, {
      status: parsed.data.status,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });

    return { status: 200, body: { data: contracts, count: contracts.length } };
  };
}

/** POST /reports/generate -- generate report for a period. */
export function generateReportHandler(
  contractStore: RevRecContractStore,
  reportStore: RevRecReportStore,
) {
  return async (req: RevRecRequest): Promise<RevRecResponse> => {
    const parsed = generateReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return { status: 400, body: { error: 'Validation failed', details: parsed.error.issues } };
    }

    const contracts = await contractStore.list(req.tenantId, {
      status: 'active',
      page: 1,
      limit: 1000,
    });

    const report = generateRevenueReport({
      tenantId: req.tenantId,
      periodStart: parsed.data.period_start,
      periodEnd: parsed.data.period_end,
      contracts,
    });

    await reportStore.save(report);
    return { status: 201, body: { data: report } };
  };
}

/** GET /reports/:id -- fetch a previously generated report. */
export function getReportHandler(store: RevRecReportStore) {
  return async (req: RevRecRequest): Promise<RevRecResponse> => {
    const reportId = req.params?.id;
    if (!reportId) {
      return { status: 400, body: { error: 'Report ID is required' } };
    }

    const report = await store.get(reportId, req.tenantId);
    if (!report) {
      return { status: 404, body: { error: 'Report not found' } };
    }

    return { status: 200, body: { data: report } };
  };
}

// --- Helpers ---

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}
