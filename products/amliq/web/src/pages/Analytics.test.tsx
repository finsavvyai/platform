import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Analytics } from './Analytics';
import * as useAnalyticsModule from '../hooks/useAnalytics';

vi.mock('../hooks/useAnalytics');
vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));
vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}));
vi.mock('../components/charts/AreaChart', () => ({
  AreaChartComponent: ({ title }: any) => <div>Chart: {title}</div>,
}));
vi.mock('../components/charts/DonutChart', () => ({
  DonutChart: ({ title }: any) => <div>Donut: {title}</div>,
}));
vi.mock('../components/charts/BarChart', () => ({
  BarChartComponent: ({ title }: any) => <div>Bar: {title}</div>,
}));
vi.mock('../components/analytics/ScreeningHeatmap', () => ({
  ScreeningHeatmap: () => <div>Heatmap</div>,
}));

const mockAnalytics = {
  screeningVolume: [],
  dispositionBreakdown: [],
  riskDistribution: [],
};

beforeEach(() => { vi.clearAllMocks() });

describe('Analytics', () => {
  it('shows loading spinner', () => {
    vi.spyOn(useAnalyticsModule, 'useAnalytics').mockReturnValue({
      analytics: null, loading: true, error: null,
    });
    render(<Analytics />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('shows error state', () => {
    vi.spyOn(useAnalyticsModule, 'useAnalytics').mockReturnValue({
      analytics: null, loading: false, error: new Error('API error'),
    });
    render(<Analytics />);
    expect(screen.getByRole('alert')).toHaveTextContent('API error');
  });

  it('shows empty state when no analytics data', () => {
    vi.spyOn(useAnalyticsModule, 'useAnalytics').mockReturnValue({
      analytics: null, loading: false, error: null,
    });
    render(<Analytics />);
    expect(screen.getByText(/no screening data yet/i)).toBeInTheDocument();
  });

  it('renders charts when analytics data present', () => {
    vi.spyOn(useAnalyticsModule, 'useAnalytics').mockReturnValue({
      analytics: mockAnalytics as any, loading: false, error: null,
    });
    render(<Analytics />);
    expect(screen.getByText(/chart:/i)).toBeInTheDocument();
    expect(screen.getByText(/donut:/i)).toBeInTheDocument();
    expect(screen.getByText(/bar:/i)).toBeInTheDocument();
    expect(screen.getByText('Heatmap')).toBeInTheDocument();
  });
});
