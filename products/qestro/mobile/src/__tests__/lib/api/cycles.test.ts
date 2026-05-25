import { getCycles, getCycle, createCycle, updateCycle, deleteCycle, getCycleStats } from '@/lib/api/cycles';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) });
});

describe('cyclesApi', () => {
  it('should fetch cycles without filters', async () => {
    await getCycles();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/cycles'), expect.any(Object));
  });

  it('should fetch cycles with projectId filter', async () => {
    await getCycles({ projectId: 'proj-1' });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('projectId=proj-1'), expect.any(Object));
  });

  it('should fetch cycles with status filter', async () => {
    await getCycles({ status: 'in_progress' });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('status=in_progress'), expect.any(Object));
  });

  it('should fetch cycles with environment filter', async () => {
    await getCycles({ environment: 'staging' });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('environment=staging'), expect.any(Object));
  });

  it('should get a single cycle by id', async () => {
    await getCycle('cycle-1');
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/cycles/cycle-1'), expect.any(Object));
  });

  it('should create a cycle', async () => {
    const data = { name: 'Sprint 1', status: 'planned' as const, environment: 'staging', projectId: 'p1' };
    await createCycle(data);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual(data);
  });

  it('should update a cycle', async () => {
    await updateCycle('cycle-1', { status: 'completed' });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/cycles/cycle-1');
    expect(opts.method).toBe('PATCH');
  });

  it('should delete a cycle', async () => {
    await deleteCycle('cycle-1');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/cycles/cycle-1');
    expect(opts.method).toBe('DELETE');
  });

  it('should get cycle stats', async () => {
    await getCycleStats();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/cycles/stats/summary'), expect.any(Object));
  });
});
