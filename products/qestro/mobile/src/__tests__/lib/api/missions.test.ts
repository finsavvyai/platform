import { missionsApi } from '../../../lib/api';

const mockFetch = jest.fn();
jest.mock('../../../lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => mockFetch(...args),
}));

describe('missionsApi', () => {
  beforeEach(() => mockFetch.mockReset());

  it('getMissions fetches all', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [{ id: 'm1', title: 'Scout' }] });
    const res = await missionsApi.getMissions();
    expect(mockFetch).toHaveBeenCalledWith('/api/missions');
    expect(res.data).toHaveLength(1);
  });

  it('getMissions with filters adds query params', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [] });
    await missionsApi.getMissions({ status: 'running', type: 'SCOUT' });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('status=running'));
  });

  it('createMission sends POST', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { id: 'm2' } });
    await missionsApi.createMission({ type: 'TICKET', title: 'Bug fix' });
    expect(mockFetch).toHaveBeenCalledWith('/api/missions', expect.objectContaining({ method: 'POST' }));
  });

  it('cancelMission sends POST', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await missionsApi.cancelMission('m1');
    expect(mockFetch).toHaveBeenCalledWith('/api/missions/m1/cancel', expect.objectContaining({ method: 'POST' }));
  });

  it('deleteMission sends DELETE', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await missionsApi.deleteMission('m1');
    expect(mockFetch).toHaveBeenCalledWith('/api/missions/m1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('getMissionStats fetches summary', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { total: 10 } });
    await missionsApi.getMissionStats();
    expect(mockFetch).toHaveBeenCalledWith('/api/missions/stats/summary');
  });
});
