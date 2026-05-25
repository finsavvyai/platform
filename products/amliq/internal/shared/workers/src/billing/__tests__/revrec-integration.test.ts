import { describe, expect, it, vi } from 'vitest';
import { allocateTransactionPrice, calculateRecognitionSchedule, roundCents } from '../revrec-engine';
import { generateRevenueReport } from '../revrec-report';
import { revenueContractSchema } from '../revrec-models';
import type { RevenueContract } from '../revrec-models';
import {
  createContractHandler,
  listContractsHandler,
  generateReportHandler,
  getReportHandler,
} from '../revrec-handlers';
import type { RevRecContractStore, RevRecReportStore, RevRecRequest } from '../revrec-handlers';

const TENANT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const CONTRACT_UUID = '550e8400-e29b-41d4-a716-446655440001';

function makeContract(overrides?: Partial<RevenueContract>): RevenueContract {
  return {
    contract_id: CONTRACT_UUID,
    tenant_id: TENANT_UUID,
    customer_id: 'cust-001',
    name: 'Enterprise License',
    start_date: '2026-01-01T00:00:00Z',
    end_date: '2027-01-01T00:00:00Z',
    total_value: 120000,
    currency: 'USD',
    status: 'active',
    performance_obligations: [
      {
        id: 'ob-1',
        description: 'Platform license',
        standalone_selling_price: 84000,
        allocated_price: 0,
        recognition_type: 'over_time',
        satisfaction_date: null,
        status: 'in_progress',
      },
      {
        id: 'ob-2',
        description: 'Onboarding service',
        standalone_selling_price: 36000,
        allocated_price: 0,
        recognition_type: 'point_in_time',
        satisfaction_date: '2026-03-15T00:00:00Z',
        status: 'satisfied',
      },
    ],
    ...overrides,
  };
}

describe('RevRec Integration: Contract -> Allocation -> Schedule -> Report', () => {
  it('allocates price proportionally and sums to total', () => {
    const contract = makeContract();
    const allocated = allocateTransactionPrice(contract);

    const totalAllocated = allocated.reduce((s, o) => s + o.allocated_price, 0);
    expect(roundCents(totalAllocated)).toBe(contract.total_value);
  });

  it('generates recognition schedule with correct period count', () => {
    const contract = makeContract();
    const schedule = calculateRecognitionSchedule(contract);

    expect(schedule.contract_id).toBe(CONTRACT_UUID);
    expect(schedule.periods.length).toBe(12);
    expect(roundCents(schedule.total_recognized + schedule.total_deferred))
      .toBe(contract.total_value);
  });

  it('point-in-time obligation recognized in satisfaction month', () => {
    const contract = makeContract();
    const schedule = calculateRecognitionSchedule(contract);

    // March 2026 should have the onboarding recognition spike
    const marchPeriod = schedule.periods.find((p) =>
      p.period_start.startsWith('2026-03'),
    );
    expect(marchPeriod).toBeDefined();
    // Onboarding is 30% of 120000 = 36000
    expect(marchPeriod!.recognized_amount).toBeGreaterThan(7000);
  });

  it('report waterfall balances: opening + bookings - recognized = closing', () => {
    const contracts = [
      makeContract(),
      makeContract({
        contract_id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Support Add-on',
        total_value: 24000,
        start_date: '2026-04-01T00:00:00Z',
        end_date: '2026-10-01T00:00:00Z',
        performance_obligations: [
          {
            id: 'ob-3',
            description: 'Premium support',
            standalone_selling_price: 24000,
            allocated_price: 0,
            recognition_type: 'over_time',
            satisfaction_date: null,
            status: 'in_progress',
          },
        ],
      }),
    ];

    const report = generateRevenueReport({
      tenantId: TENANT_UUID,
      periodStart: '2026-04-01T00:00:00Z',
      periodEnd: '2026-07-01T00:00:00Z',
      contracts,
    });

    const wf = report.waterfall;
    const expectedClosing = roundCents(
      wf.opening_deferred + wf.new_bookings - wf.recognized,
    );
    expect(wf.closing_deferred).toBe(expectedClosing);
    expect(report.contract_breakdowns.length).toBe(2);
  });

  it('contract spanning period boundary is correctly prorated', () => {
    const contract = makeContract();
    const report = generateRevenueReport({
      tenantId: TENANT_UUID,
      periodStart: '2026-03-01T00:00:00Z',
      periodEnd: '2026-06-01T00:00:00Z',
      contracts: [contract],
    });

    expect(report.total_recognized).toBeGreaterThan(0);
    expect(report.total_deferred).toBeGreaterThan(0);
    const bd = report.contract_breakdowns[0];
    expect(bd.completion_pct).toBeGreaterThan(0);
    expect(bd.completion_pct).toBeLessThan(100);
  });

  it('validates contract schema end-to-end', () => {
    const contract = makeContract();
    const result = revenueContractSchema.safeParse(contract);
    expect(result.success).toBe(true);
  });
});

describe('RevRec Integration: Handler Pipeline', () => {
  function createStores() {
    const contracts = new Map<string, RevenueContract>();
    const reports = new Map<string, unknown>();

    const contractStore: RevRecContractStore = {
      save: vi.fn(async (c: RevenueContract) => { contracts.set(c.contract_id, c); }),
      get: vi.fn(async (id: string, tid: string) => {
        const c = contracts.get(id);
        return c && c.tenant_id === tid ? c : null;
      }),
      list: vi.fn(async (tid: string) => {
        return Array.from(contracts.values()).filter((c) => c.tenant_id === tid);
      }),
    };

    const reportStore: RevRecReportStore = {
      save: vi.fn(async (r: unknown) => { reports.set((r as Record<string, string>).report_id, r); }),
      get: vi.fn(async (id: string) => (reports.get(id) as Record<string, unknown> | null) ?? null),
    };

    return { contractStore, reportStore, contracts, reports };
  }

  it('create contract -> list -> generate report -> get report', async () => {
    const { contractStore, reportStore } = createStores();
    const createHandler = createContractHandler(contractStore);
    const listHandler = listContractsHandler(contractStore);
    const genReport = generateReportHandler(contractStore, reportStore);
    const getReport = getReportHandler(reportStore);

    // Step 1: Create contract
    const createReq: RevRecRequest = {
      tenantId: TENANT_UUID,
      userRole: 'admin',
      body: {
        customer_id: 'cust-001',
        name: 'SaaS Platform License',
        start_date: '2026-01-01T00:00:00Z',
        end_date: '2027-01-01T00:00:00Z',
        total_value: 60000,
        currency: 'USD',
        performance_obligations: [
          {
            id: 'ob-1',
            description: 'License',
            standalone_selling_price: 60000,
            allocated_price: 0,
            recognition_type: 'over_time',
            status: 'in_progress',
          },
        ],
      },
    };
    const createRes = await createHandler(createReq);
    expect(createRes.status).toBe(201);

    // Step 2: List contracts
    const listRes = await listHandler({ tenantId: TENANT_UUID, userRole: 'admin', query: {} });
    expect(listRes.status).toBe(200);
    const listBody = listRes.body as Record<string, unknown>;
    expect((listBody.data as unknown[]).length).toBe(1);

    // Step 3: Generate report
    const reportReq: RevRecRequest = {
      tenantId: TENANT_UUID,
      userRole: 'admin',
      body: {
        period_start: '2026-01-01T00:00:00Z',
        period_end: '2026-07-01T00:00:00Z',
      },
    };
    const reportRes = await genReport(reportReq);
    expect(reportRes.status).toBe(201);
    const reportBody = reportRes.body as Record<string, Record<string, unknown>>;
    const reportId = reportBody.data.report_id as string;
    expect(reportId).toBeTruthy();
    expect(reportBody.data.total_recognized).toBeGreaterThan(0);

    // Step 4: Retrieve generated report
    const getRes = await getReport({
      tenantId: TENANT_UUID,
      userRole: 'admin',
      params: { id: reportId },
    });
    expect(getRes.status).toBe(200);
  });

  it('invalid contract body returns 400', async () => {
    const { contractStore } = createStores();
    const handler = createContractHandler(contractStore);
    const res = await handler({
      tenantId: TENANT_UUID,
      userRole: 'admin',
      body: { name: '' },
    });
    expect(res.status).toBe(400);
  });

  it('report for non-existent id returns 404', async () => {
    const { reportStore } = createStores();
    const handler = getReportHandler(reportStore);
    const res = await handler({
      tenantId: TENANT_UUID,
      userRole: 'admin',
      params: { id: '550e8400-e29b-41d4-a716-446655440099' },
    });
    expect(res.status).toBe(404);
  });
});
