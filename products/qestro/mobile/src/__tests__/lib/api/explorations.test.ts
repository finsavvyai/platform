import { explorationsApi } from '../../../lib/api';

const mockFetch = jest.fn();
jest.mock('../../../lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => mockFetch(...args),
}));

describe('explorationsApi', () => {
  beforeEach(() => mockFetch.mockReset());

  it('getExplorations fetches all', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [{ id: 'e1', title: 'Login Flow' }] });
    const res = await explorationsApi.getExplorations();
    expect(mockFetch).toHaveBeenCalledWith('/api/explorations');
    expect(res.data).toHaveLength(1);
  });

  it('getExplorations with status filter', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [] });
    await explorationsApi.getExplorations('active');
    expect(mockFetch).toHaveBeenCalledWith('/api/explorations?status=active');
  });

  it('getExploration fetches single', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { id: 'e1' } });
    await explorationsApi.getExploration('e1');
    expect(mockFetch).toHaveBeenCalledWith('/api/explorations/e1');
  });

  it('createExploration sends POST', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { id: 'e2' } });
    await explorationsApi.createExploration({ title: 'New', status: 'active', projectId: 'p1' });
    expect(mockFetch).toHaveBeenCalledWith('/api/explorations', expect.objectContaining({ method: 'POST' }));
  });

  it('addFinding sends POST with finding data', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await explorationsApi.addFinding('e1', { type: 'bug', title: 'Crash', description: 'App crashes' });
    expect(mockFetch).toHaveBeenCalledWith('/api/explorations/e1/findings', expect.objectContaining({ method: 'POST' }));
  });

  it('deleteExploration sends DELETE', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await explorationsApi.deleteExploration('e1');
    expect(mockFetch).toHaveBeenCalledWith('/api/explorations/e1', expect.objectContaining({ method: 'DELETE' }));
  });
});
