/**
 * Tests for revenue recognition API handlers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createContractHandler,
  listContractsHandler,
  generateReportHandler,
  getReportHandler,
  type RevRecContractStore,
  type RevRecReportStore,
  type RevRecRequest,
} from '../revrec-handlers';
import type { RevenueContract, RevenueReport } from '../revrec-models';

// --- In-memory stores ---

function createMemoryContractStore(): RevRecContractStore {
  const data = new Map<string, RevenueContract>();
  return {
    async save(contract) { data.set(contract.contract_id, contract); },
    async get(id, tenantId) {
      const c = data.get(id);
      return c && c.tenant_id === tenantId ? c : null;
    },
    async list(tenantId, filter) {
      const all = [...data.values()].filter((c) => c.tenant_id === tenantId);
      if (filter.status) return all.filter((c) => c.status === filter.status);
      return all.slice((filter.page - 1) * filter.limit, filter.page * filter.limit);
    },
  };
}

function createMemoryReportStore(): RevRecReportStore {
  const data = new Map<string, RevenueReport>();
  return {
    async save(report) { data.set(report.report_id, report); },
    async get(id, tenantId) {
      const r = data.get(id);
      return r && r.tenant_id === tenantId ? r : null;
    },
  };
}

const validContractBody = {
  customer_id: 'cust-100',
  name: 'Test Contract',
  start_date: '2026-01-01T00:00:00Z',
  end_date: '2026-12-31T23:59:59Z',
  total_value: 120000,
  currency: 'USD',
  performance_obligations: [
    {
      id: 'ob-1',
      description: 'Platform access',
      standalone_selling_price: 120000,
      allocated_price: 0,
      recognition_type: 'over_time',
      status: 'pending',
    },
  ],
};

const tenantId = '550e8400-e29b-41d4-a716-446655440002';
const baseReq: RevRecRequest = { tenantId, userRole: 'admin' };

describe('createContractHandler', () => {
  let store: RevRecContractStore;

  beforeEach(() => { store = createMemoryContractStore(); });

  it('creates contract with valid input', async () => {
    const handler = createContractHandler(store);
    const res = await handler({ ...baseReq, body: validContractBody });
    expect(res.status).toBe(201);
    const data = (res.body as { data: RevenueContract }).data;
    expect(data.contract_id).toBeTruthy();
    expect(data.tenant_id).toBe(tenantId);
  });

  it('rejects invalid input with 400', async () => {
    const handler = createContractHandler(store);
    const res = await handler({ ...baseReq, body: { name: '' } });
    expect(res.status).toBe(400);
  });

  it('rejects missing obligations', async () => {
    const handler = createContractHandler(store);
    const res = await handler({
      ...baseReq,
      body: { ...validContractBody, performance_obligations: [] },
    });
    expect(res.status).toBe(400);
  });
});

describe('listContractsHandler', () => {
  it('returns empty list for new tenant', async () => {
    const store = createMemoryContractStore();
    const handler = listContractsHandler(store);
    const res = await handler(baseReq);
    expect(res.status).toBe(200);
    expect((res.body as { data: unknown[] }).data).toHaveLength(0);
  });

  it('returns contracts after creation', async () => {
    const store = createMemoryContractStore();
    const create = createContractHandler(store);
    await create({ ...baseReq, body: validContractBody });

    const list = listContractsHandler(store);
    const res = await list(baseReq);
    expect(res.status).toBe(200);
    expect((res.body as { count: number }).count).toBe(1);
  });

  it('enforces tenant isolation', async () => {
    const store = createMemoryContractStore();
    const create = createContractHandler(store);
    await create({ ...baseReq, body: validContractBody });

    const list = listContractsHandler(store);
    const res = await list({ ...baseReq, tenantId: 'other-tenant' });
    expect((res.body as { data: unknown[] }).data).toHaveLength(0);
  });
});

describe('generateReportHandler', () => {
  it('generates report for period', async () => {
    const contractStore = createMemoryContractStore();
    const reportStore = createMemoryReportStore();
    const create = createContractHandler(contractStore);
    await create({ ...baseReq, body: validContractBody });

    const handler = generateReportHandler(contractStore, reportStore);
    const res = await handler({
      ...baseReq,
      body: {
        period_start: '2026-01-01T00:00:00Z',
        period_end: '2026-03-31T23:59:59Z',
      },
    });
    expect(res.status).toBe(201);
    const report = (res.body as { data: RevenueReport }).data;
    expect(report.total_recognized).toBeGreaterThan(0);
    expect(report.waterfall).toBeDefined();
  });

  it('rejects invalid period with 400', async () => {
    const contractStore = createMemoryContractStore();
    const reportStore = createMemoryReportStore();
    const handler = generateReportHandler(contractStore, reportStore);
    const res = await handler({
      ...baseReq,
      body: { period_start: '2027-01-01T00:00:00Z', period_end: '2026-01-01T00:00:00Z' },
    });
    expect(res.status).toBe(400);
  });
});

describe('getReportHandler', () => {
  it('returns 404 for missing report', async () => {
    const store = createMemoryReportStore();
    const handler = getReportHandler(store);
    const res = await handler({
      ...baseReq,
      params: { id: '550e8400-e29b-41d4-a716-446655440099' },
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 for missing report ID', async () => {
    const store = createMemoryReportStore();
    const handler = getReportHandler(store);
    const res = await handler(baseReq);
    expect(res.status).toBe(400);
  });
});
