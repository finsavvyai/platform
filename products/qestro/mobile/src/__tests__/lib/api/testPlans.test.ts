import { getTestPlans, getTestPlan, createTestPlan, updateTestPlan, deleteTestPlan, runTestPlan } from '@/lib/api/testPlans';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) });
});

describe('testPlansApi', () => {
  it('should fetch test plans without filters', async () => {
    await getTestPlans();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/test-plans'), expect.any(Object));
  });

  it('should fetch test plans with projectId filter', async () => {
    await getTestPlans({ projectId: 'proj-1' });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('projectId=proj-1'), expect.any(Object));
  });

  it('should fetch test plans with status filter', async () => {
    await getTestPlans({ status: 'active' });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('status=active'), expect.any(Object));
  });

  it('should get a single test plan by id', async () => {
    await getTestPlan('plan-1');
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/test-plans/plan-1'), expect.any(Object));
  });

  it('should create a test plan', async () => {
    const data = { name: 'My Plan', status: 'draft' as const, projectId: 'p1', testCaseIds: [] };
    await createTestPlan(data);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual(data);
  });

  it('should update a test plan', async () => {
    await updateTestPlan('plan-1', { name: 'Updated' });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/test-plans/plan-1');
    expect(opts.method).toBe('PATCH');
  });

  it('should delete a test plan', async () => {
    await deleteTestPlan('plan-1');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/test-plans/plan-1');
    expect(opts.method).toBe('DELETE');
  });

  it('should run a test plan', async () => {
    await runTestPlan('plan-1');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/test-plans/plan-1/run');
    expect(opts.method).toBe('POST');
  });
});
