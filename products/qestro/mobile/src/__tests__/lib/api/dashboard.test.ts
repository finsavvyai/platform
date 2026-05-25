import { getDashboardStats, getDashboardHealth } from '@/lib/api/dashboard';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) });
});

describe('dashboardApi', () => {
  it('should fetch dashboard stats', async () => {
    await getDashboardStats();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/dashboard/stats'), expect.any(Object));
  });

  it('should fetch dashboard health', async () => {
    await getDashboardHealth();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/dashboard/health'), expect.any(Object));
  });
});
