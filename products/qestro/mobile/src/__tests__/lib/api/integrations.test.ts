import { integrationsApi } from '../../../lib/api';

const mockFetch = jest.fn();
jest.mock('../../../lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => mockFetch(...args),
}));

describe('integrationsApi', () => {
  beforeEach(() => mockFetch.mockReset());

  it('getIntegrations fetches all', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [{ id: 'i1', name: 'GitHub' }] });
    const res = await integrationsApi.getIntegrations();
    expect(mockFetch).toHaveBeenCalledWith('/api/integrations');
    expect(res.data).toHaveLength(1);
  });

  it('getIntegrations with filters adds query params', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [] });
    await integrationsApi.getIntegrations({ type: 'ci', status: 'connected' });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('type=ci'));
  });

  it('syncIntegration sends POST', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await integrationsApi.syncIntegration('i1');
    expect(mockFetch).toHaveBeenCalledWith('/api/integrations/i1/sync', expect.objectContaining({ method: 'POST' }));
  });

  it('deleteIntegration sends DELETE', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await integrationsApi.deleteIntegration('i1');
    expect(mockFetch).toHaveBeenCalledWith('/api/integrations/i1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('createIntegration sends POST with data', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { id: 'i2', name: 'Slack' } });
    await integrationsApi.createIntegration({ name: 'Slack', type: 'chat', status: 'connected' });
    expect(mockFetch).toHaveBeenCalledWith('/api/integrations', expect.objectContaining({ method: 'POST' }));
  });
});
