import {
  getAutomationRuns,
  getAutomationRun,
  createAutomationRun,
  startRun,
  pauseRun,
  cancelRun,
  getActiveRuns,
} from '../../../lib/api/runs';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('test-token'),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('Runs API', () => {
  it('should fetch automation runs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: { items: [{ id: '1', name: 'Run 1' }], total: 1 },
        }),
    });

    const result = await getAutomationRuns();
    expect(result.data?.items).toHaveLength(1);
  });

  it('should fetch a single run', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ success: true, data: { id: '1', name: 'Run 1' } }),
    });

    const result = await getAutomationRun('1');
    expect(result.data?.name).toBe('Run 1');
  });

  it('should create a run', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ success: true, data: { id: 'new-1' } }),
    });

    await createAutomationRun({ name: 'New Run', environment: 'staging' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/automation-runs'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should start a run', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await startRun('1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/automation-runs/1/start'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should pause a run', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await pauseRun('1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/automation-runs/1/pause'),
      expect.anything(),
    );
  });

  it('should cancel a run', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await cancelRun('1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/automation-runs/1/cancel'),
      expect.anything(),
    );
  });

  it('should fetch active runs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ success: true, data: [{ id: '1', status: 'running' }] }),
    });

    const result = await getActiveRuns();
    expect(result.data).toHaveLength(1);
  });
});
