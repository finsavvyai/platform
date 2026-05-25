import { devicesApi } from '../../../lib/api';

const mockFetch = jest.fn();
jest.mock('../../../lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => mockFetch(...args),
}));

describe('devicesApi', () => {
  beforeEach(() => mockFetch.mockReset());

  it('getDevices fetches all', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [{ id: 'd1', name: 'iPhone 15' }] });
    const res = await devicesApi.getDevices();
    expect(mockFetch).toHaveBeenCalledWith('/api/devices');
    expect(res.data).toHaveLength(1);
  });

  it('getDevices with filters adds query params', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [] });
    await devicesApi.getDevices({ platform: 'ios', status: 'available' });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('platform=ios'));
  });

  it('reserveDevice sends POST', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await devicesApi.reserveDevice('d1');
    expect(mockFetch).toHaveBeenCalledWith('/api/devices/d1/reserve', expect.objectContaining({ method: 'POST' }));
  });

  it('releaseDevice sends DELETE', async () => {
    mockFetch.mockResolvedValue({ success: true });
    await devicesApi.releaseDevice('res1');
    expect(mockFetch).toHaveBeenCalledWith('/api/devices/reservations/res1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('getProviders fetches list', async () => {
    mockFetch.mockResolvedValue({ success: true, data: [{ name: 'BrowserStack' }] });
    await devicesApi.getProviders();
    expect(mockFetch).toHaveBeenCalledWith('/api/devices/providers');
  });
});
