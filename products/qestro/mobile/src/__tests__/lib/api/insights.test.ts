import { insightsApi } from '../../../lib/api';

const mockFetch = jest.fn();
jest.mock('../../../lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => mockFetch(...args),
}));

describe('insightsApi', () => {
  beforeEach(() => mockFetch.mockReset());

  it('getInsightsOverview fetches overview data', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { passRate: 92, totalExecutions: 150 } });
    const res = await insightsApi.getInsightsOverview();
    expect(mockFetch).toHaveBeenCalledWith('/api/insights/overview');
    expect(res.data?.passRate).toBe(92);
  });

  it('getWeeklyInsights fetches weekly data', async () => {
    mockFetch.mockResolvedValue({ success: true, data: {} });
    await insightsApi.getWeeklyInsights();
    expect(mockFetch).toHaveBeenCalledWith('/api/insights/weekly');
  });

  it('getInsightsTrend fetches trend data', async () => {
    mockFetch.mockResolvedValue({ success: true, data: {} });
    await insightsApi.getInsightsTrend();
    expect(mockFetch).toHaveBeenCalledWith('/api/insights/trend');
  });
});
