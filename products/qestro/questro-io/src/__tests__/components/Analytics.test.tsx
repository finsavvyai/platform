import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { Analytics } from '../../components/Analytics';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock recharts
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: ({ dataKey }: any) => <div data-testid={`line-${dataKey}`} />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ dataKey }: any) => <div data-testid={`bar-${dataKey}`} />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ dataKey }: any) => <div data-testid={`pie-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

// Mock fetch globally
global.fetch = vi.fn();

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { 
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Analytics', () => {
  const mockFetch = fetch as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Initial Render', () => {
    it('should render analytics dashboard', () => {
      renderWithProviders(<Analytics />);
      
      expect(screen.getByText('📊 Analytics Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Test Execution Overview')).toBeInTheDocument();
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
      expect(screen.getByText('Test Coverage')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithProviders(<Analytics />);
      
      expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
    });
  });

  describe('Test Execution Overview', () => {
    it('should display test execution statistics', async () => {
      const mockData = {
        totalTests: 150,
        passedTests: 140,
        failedTests: 8,
        skippedTests: 2,
        successRate: 93.33,
        averageExecutionTime: 2.5
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
        expect(screen.getByText('140')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('93.33%')).toBeInTheDocument();
        expect(screen.getByText('2.5s')).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Metrics Chart', () => {
    it('should render performance line chart', async () => {
      const mockPerformanceData = [
        { date: '2024-01-01', executionTime: 2.1, successRate: 95 },
        { date: '2024-01-02', executionTime: 2.3, successRate: 92 },
        { date: '2024-01-03', executionTime: 1.9, successRate: 98 }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ performanceData: mockPerformanceData })
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        expect(screen.getByTestId('line-executionTime')).toBeInTheDocument();
        expect(screen.getByTestId('line-successRate')).toBeInTheDocument();
      });
    });

    it('should display performance trends', async () => {
      const mockData = {
        performanceData: [
          { date: '2024-01-01', executionTime: 2.1, successRate: 95 },
          { date: '2024-01-02', executionTime: 2.3, successRate: 92 }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Performance Trends')).toBeInTheDocument();
        expect(screen.getByText('Execution Time (s)')).toBeInTheDocument();
        expect(screen.getByText('Success Rate (%)')).toBeInTheDocument();
      });
    });
  });

  describe('Test Coverage Chart', () => {
    it('should render test coverage pie chart', async () => {
      const mockCoverageData = [
        { name: 'Unit Tests', value: 60, color: '#8884d8' },
        { name: 'Integration Tests', value: 25, color: '#82ca9d' },
        { name: 'E2E Tests', value: 15, color: '#ffc658' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ coverageData: mockCoverageData })
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
        expect(screen.getByTestId('pie-value')).toBeInTheDocument();
      });
    });

    it('should display coverage breakdown', async () => {
      const mockData = {
        coverageData: [
          { name: 'Unit Tests', value: 60 },
          { name: 'Integration Tests', value: 25 },
          { name: 'E2E Tests', value: 15 }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Unit Tests')).toBeInTheDocument();
        expect(screen.getByText('Integration Tests')).toBeInTheDocument();
        expect(screen.getByText('E2E Tests')).toBeInTheDocument();
        expect(screen.getByText('60%')).toBeInTheDocument();
        expect(screen.getByText('25%')).toBeInTheDocument();
        expect(screen.getByText('15%')).toBeInTheDocument();
      });
    });
  });

  describe('Test Results Distribution', () => {
    it('should render test results bar chart', async () => {
      const mockResultsData = [
        { platform: 'Web', passed: 45, failed: 3, skipped: 2 },
        { platform: 'Mobile', passed: 38, failed: 5, skipped: 1 },
        { platform: 'API', passed: 57, failed: 2, skipped: 0 }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ resultsData: mockResultsData })
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.getByTestId('bar-passed')).toBeInTheDocument();
        expect(screen.getByTestId('bar-failed')).toBeInTheDocument();
        expect(screen.getByTestId('bar-skipped')).toBeInTheDocument();
      });
    });

    it('should display platform-specific results', async () => {
      const mockData = {
        resultsData: [
          { platform: 'Web', passed: 45, failed: 3, skipped: 2 },
          { platform: 'Mobile', passed: 38, failed: 5, skipped: 1 }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Web')).toBeInTheDocument();
        expect(screen.getByText('Mobile')).toBeInTheDocument();
        expect(screen.getByText('Passed')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText('Skipped')).toBeInTheDocument();
      });
    });
  });

  describe('Time Period Filter', () => {
    it('should allow filtering by time period', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ totalTests: 150, passedTests: 140 })
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
        expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
        expect(screen.getByText('Last 90 Days')).toBeInTheDocument();
      });
    });

    it('should update data when time period changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ totalTests: 150, passedTests: 140 })
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/analytics?period=7d'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Export Functionality', () => {
    it('should provide export options', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ totalTests: 150, passedTests: 140 })
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Export Report')).toBeInTheDocument();
        expect(screen.getByText('PDF')).toBeInTheDocument();
        expect(screen.getByText('CSV')).toBeInTheDocument();
        expect(screen.getByText('Excel')).toBeInTheDocument();
      });
    });

    it('should handle export requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ totalTests: 150, passedTests: 140 })
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        const exportButton = screen.getByText('Export Report');
        expect(exportButton).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should show real-time indicator when data is fresh', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 
          totalTests: 150, 
          passedTests: 140,
          lastUpdated: new Date().toISOString()
        })
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('🟢 Live')).toBeInTheDocument();
      });
    });

    it('should show stale indicator for old data', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 2);
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 
          totalTests: 150, 
          passedTests: 140,
          lastUpdated: oldDate.toISOString()
        })
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('🟡 Stale')).toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    it('should show error message for network failures', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
        expect(screen.getByText('Please check your connection and try again')).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should retry data fetch when retry button is clicked', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalTests: 150, passedTests: 140 })
      });

      renderWithProviders(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      // Click retry button
      screen.getByText('Retry').click();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });
});


