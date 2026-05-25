import { recordingsApi } from '../../../lib/api';

const mockFetch = jest.fn();
jest.mock('../../../lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => mockFetch(...args),
}));

describe('recordingsApi', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('getRecordingSessions fetches sessions', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [{ id: 'r1', name: 'Session 1' }] });
    const res = await recordingsApi.getRecordingSessions();
    expect(mockFetch).toHaveBeenCalledWith('/api/recordings/openclaw/sessions');
    expect(res.data).toHaveLength(1);
  });

  it('getActiveRecordings fetches active sessions', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [] });
    await recordingsApi.getActiveRecordings();
    expect(mockFetch).toHaveBeenCalledWith('/api/recordings/openclaw/sessions/active');
  });

  it('getRecording fetches single recording', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { id: 'r1' } });
    const res = await recordingsApi.getRecording('r1');
    expect(mockFetch).toHaveBeenCalledWith('/api/recordings/openclaw/r1');
    expect(res.data?.id).toBe('r1');
  });

  it('startRecording sends POST with data', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { id: 'r2', status: 'active' } });
    const res = await recordingsApi.startRecording({ url: 'https://example.com', name: 'Test', framework: 'playwright' });
    expect(mockFetch).toHaveBeenCalledWith('/api/recordings/openclaw/start', expect.objectContaining({ method: 'POST' }));
    expect(res.data?.status).toBe('active');
  });

  it('stopRecording sends POST', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { id: 'r1', status: 'completed' } });
    const res = await recordingsApi.stopRecording('r1');
    expect(mockFetch).toHaveBeenCalledWith('/api/recordings/openclaw/r1/stop', expect.objectContaining({ method: 'POST' }));
    expect(res.data?.status).toBe('completed');
  });

  it('addInteraction sends interaction data', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await recordingsApi.addInteraction('r1', { type: 'click', selector: '#btn' });
    expect(mockFetch).toHaveBeenCalledWith('/api/recordings/openclaw/r1/interactions', expect.objectContaining({ method: 'POST' }));
  });
});
