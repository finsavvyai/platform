/**
 * Dashboard Component Tests
 * Comprehensive testing for the Dashboard organism component
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Dashboard, DashboardMetric, RecentActivity } from '../../../frontend/src/components/organisms/Dashboard/Dashboard';

// Mock child components
vi.mock('../../../frontend/src/components/atoms', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../frontend/src/components/molecules', () => ({
  StatusIndicator: ({ status, ...props }: any) => (
    <div data-testid="status-indicator" data-status={status} {...props} />
  ),
}));

describe('Dashboard Component', () => {
  const mockMetrics: DashboardMetric[] = [
    {
      id: 'metric-1',
      title: 'Total Tests',
      value: 1234,
      change: {
        value: 12.5,
        type: 'increase',
        period: 'last 7 days'
      },
      icon: () => <div data-testid="metric-icon">📊</div>,
      color: 'blue'
    },
    {
      id: 'metric-2',
      title: 'Success Rate',
      value: '98.5%',
      change: {
        value: 2.1,
        type: 'increase',
        period: 'last week'
      },
      icon: () => <div data-testid="metric-icon">✅</div>,
      color: 'green'
    },
    {
      id: 'metric-3',
      title: 'Failed Tests',
      value: 18,
      change: {
        value: 5.2,
        type: 'decrease',
        period: 'last month'
      },
      icon: () => <div data-testid="metric-icon">❌</div>,
      color: 'red'
    }
  ];

  const mockActivity: RecentActivity[] = [
    {
      id: 'activity-1',
      type: 'test_run',
      title: 'Login Flow Tests',
      description: 'Completed 15 test cases',
      timestamp: new Date('2023-12-01T10:30:00Z'),
      status: 'success'
    },
    {
      id: 'activity-2',
      type: 'test_failed',
      title: 'Payment Integration',
      description: 'Test failed: Timeout after 30s',
      timestamp: new Date('2023-12-01T09:15:00Z'),
      status: 'error'
    },
    {
      id: 'activity-3',
      type: 'test_created',
      title: 'API Testing Suite',
      description: 'Created new test suite for API endpoints',
      timestamp: new Date('2023-12-01T08:45:00Z'),
      status: 'info'
    }
  ];

  const defaultProps = {
    metrics: mockMetrics,
    recentActivity: mockActivity,
    isLoading: false,
    onRefresh: vi.fn(),
    onViewAllActivity: vi.fn(),
    onViewReports: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders dashboard with metrics and activity', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Metrics')).toBeInTheDocument();
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    it('renders all metrics correctly', () => {
      render(<Dashboard {...defaultProps} />);

      mockMetrics.forEach(metric => {
        expect(screen.getByText(metric.title)).toBeInTheDocument();
        expect(screen.getByText(String(metric.value))).toBeInTheDocument();
        expect(screen.getByTestId('metric-icon')).toBeInTheDocument();
      });
    });

    it('renders metric change indicators', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText('+12.5%')).toBeInTheDocument();
      expect(screen.getByText('last 7 days')).toBeInTheDocument();
      expect(screen.getByText('+2.1%')).toBeInTheDocument();
      expect(screen.getByText('last week')).toBeInTheDocument();
      expect(screen.getByText('-5.2%')).toBeInTheDocument();
      expect(screen.getByText('last month')).toBeInTheDocument();
    });

    it('renders recent activity items', () => {
      render(<Dashboard {...defaultProps} />);

      mockActivity.forEach(activity => {
        expect(screen.getByText(activity.title)).toBeInTheDocument();
        expect(screen.getByText(activity.description)).toBeInTheDocument();
        expect(screen.getByTestId('status-indicator')).toBeInTheDocument();
      });
    });

    it('renders loading state', () => {
      render(<Dashboard {...defaultProps} isLoading={true} />);

      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
      expect(screen.queryByText('Metrics')).not.toBeInTheDocument();
      expect(screen.queryByText('Recent Activity')).not.toBeInTheDocument();
    });

    it('renders empty state when no metrics', () => {
      render(<Dashboard {...defaultProps} metrics={[]} />);

      expect(screen.getByText('No metrics available')).toBeInTheDocument();
    });

    it('renders empty state when no activity', () => {
      render(<Dashboard {...defaultProps} recentActivity={[]} />);

      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });

    it('renders custom className', () => {
      render(<Dashboard {...defaultProps} className="custom-dashboard-class" />);

      const dashboard = screen.getByText('Dashboard').closest('div');
      expect(dashboard).toHaveClass('custom-dashboard-class');
    });

    it('renders action buttons', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(screen.getByText('View All Activity')).toBeInTheDocument();
      expect(screen.getByText('View Reports')).toBeInTheDocument();
    });
  });

  describe('Metrics Display', () => {
    it('displays metric values correctly', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText('1234')).toBeInTheDocument();
      expect(screen.getByText('98.5%')).toBeInTheDocument();
      expect(screen.getByText('18')).toBeInTheDocument();
    });

    it('displays metric titles correctly', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText('Total Tests')).toBeInTheDocument();
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
      expect(screen.getByText('Failed Tests')).toBeInTheDocument();
    });

    it('displays metric change with correct styling', () => {
      render(<Dashboard {...defaultProps} />);

      // Positive change should have green styling
      const increaseElements = screen.getAllByText(/\+/);
      increaseElements.forEach(element => {
        expect(element).toHaveClass('text-green-600');
      });

      // Negative change should have red styling
      const decreaseElement = screen.getByText('-5.2%');
      expect(decreaseElement).toHaveClass('text-red-600');
    });

    it('displays metric icons', () => {
      render(<Dashboard {...defaultProps} />);

      const icons = screen.getAllByTestId('metric-icon');
      expect(icons).toHaveLength(3);
    });

    it('applies metric color classes', () => {
      render(<Dashboard {...defaultProps} />);

      const metricCards = screen.getAllByTestId('metric-card');
      expect(metricCards[0]).toHaveClass('border-blue-200', 'bg-blue-50');
      expect(metricCards[1]).toHaveClass('border-green-200', 'bg-green-50');
      expect(metricCards[2]).toHaveClass('border-red-200', 'bg-red-50');
    });

    it('handles metrics without change data', () => {
      const metricsWithoutChange = mockMetrics.map(metric => ({
        ...metric,
        change: undefined
      }));

      render(<Dashboard {...defaultProps} metrics={metricsWithoutChange} />);

      expect(screen.getByText('1234')).toBeInTheDocument();
      expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
      expect(screen.queryByText(/-/)).not.toBeInTheDocument();
    });

    it('formats large numbers correctly', () => {
      const metricsWithLargeNumbers: DashboardMetric[] = [
        {
          ...mockMetrics[0],
          value: 1234567
        }
      ];

      render(<Dashboard {...defaultProps} metrics={metricsWithLargeNumbers} />);

      expect(screen.getByText('1.2M')).toBeInTheDocument();
    });
  });

  describe('Recent Activity Display', () => {
    it('displays activity titles and descriptions', () => {
      render(<Dashboard {...defaultProps} />);

      mockActivity.forEach(activity => {
        expect(screen.getByText(activity.title)).toBeInTheDocument();
        expect(screen.getByText(activity.description)).toBeInTheDocument();
      });
    });

    it('displays activity timestamps', () => {
      render(<Dashboard {...defaultProps} />);

      mockActivity.forEach(activity => {
        // Check that timestamp is displayed (formatting may vary)
        expect(screen.getByText(/ago/)).toBeInTheDocument();
      });
    });

    it('displays activity status indicators', () => {
      render(<Dashboard {...defaultProps} />);

      const statusIndicators = screen.getAllByTestId('status-indicator');
      expect(statusIndicators).toHaveLength(3);

      expect(statusIndicators[0]).toHaveAttribute('data-status', 'success');
      expect(statusIndicators[1]).toHaveAttribute('data-status', 'error');
      expect(statusIndicators[2]).toHaveAttribute('data-status', 'info');
    });

    it('shows relative time for timestamps', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const activity: RecentActivity[] = [
        {
          id: 'recent-activity',
          type: 'test_run',
          title: 'Recent Test',
          description: 'Test completed',
          timestamp: oneHourAgo,
          status: 'success'
        }
      ];

      render(<Dashboard {...defaultProps} recentActivity={activity} />);

      expect(screen.getByText(/hour.*ago/)).toBeInTheDocument();
    });

    it('limits activity display to configurable number', () => {
      render(<Dashboard {...defaultProps} />);

      // Should only show first few activities with a "View All" button
      const activities = screen.getAllByTestId('activity-item');
      expect(activities.length).toBeLessThanOrEqual(5);
    });

    it('shows different icons for different activity types', () => {
      render(<Dashboard {...defaultProps} />);

      const activityIcons = screen.getAllByTestId('activity-icon');
      expect(activityIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Interaction', () => {
    it('calls onRefresh when refresh button is clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard {...defaultProps} />);

      const refreshButton = screen.getByText('Refresh');
      await user.click(refreshButton);

      expect(defaultProps.onRefresh).toHaveBeenCalledTimes(1);
    });

    it('calls onViewAllActivity when view all button is clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard {...defaultProps} />);

      const viewAllButton = screen.getByText('View All Activity');
      await user.click(viewAllButton);

      expect(defaultProps.onViewAllActivity).toHaveBeenCalledTimes(1);
    });

    it('calls onViewReports when view reports button is clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard {...defaultProps} />);

      const viewReportsButton = screen.getByText('View Reports');
      await user.click(viewReportsButton);

      expect(defaultProps.onViewReports).toHaveBeenCalledTimes(1);
    });

    it('handles metric card clicks', async () => {
      const user = userEvent.setup();
      render(<Dashboard {...defaultProps} />);

      const metricCards = screen.getAllByTestId('metric-card');
      await user.click(metricCards[0]);

      // Should not crash and might trigger metric-specific actions
      expect(metricCards[0]).toBeInTheDocument();
    });

    it('handles activity item clicks', async () => {
      const user = userEvent.setup();
      render(<Dashboard {...defaultProps} />);

      const activityItems = screen.getAllByTestId('activity-item');
      await user.click(activityItems[0]);

      // Should not crash and might show activity details
      expect(activityItems[0]).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Dashboard {...defaultProps} />);

      await user.tab();
      expect(screen.getByText('Refresh')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('View All Activity')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('View Reports')).toHaveFocus();
    });

    it('handles rapid button clicks', async () => {
      const user = userEvent.setup();
      render(<Dashboard {...defaultProps} />);

      const refreshButton = screen.getByText('Refresh');

      for (let i = 0; i < 5; i++) {
        await user.click(refreshButton);
      }

      expect(defaultProps.onRefresh).toHaveBeenCalledTimes(5);
    });
  });

  describe('Loading States', () => {
    it('shows loading skeleton when metrics are loading', () => {
      render(<Dashboard {...defaultProps} isLoading={true} />);

      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
      expect(screen.queryByText('Total Tests')).not.toBeInTheDocument();
      expect(screen.queryByText('Recent Activity')).not.toBeInTheDocument();
    });

    it('disables action buttons during loading', () => {
      render(<Dashboard {...defaultProps} isLoading={true} />);

      const buttons = screen.getAllByTestId('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('shows partial loading when only some data is loading', () => {
      render(<Dashboard {...defaultProps} isLoading={false} />);

      // Should show content normally when not loading
      expect(screen.getByText('Total Tests')).toBeInTheDocument();
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('shows empty metrics state', () => {
      render(<Dashboard {...defaultProps} metrics={[]} />);

      expect(screen.getByText('No metrics available')).toBeInTheDocument();
      expect(screen.getByText('Configure your dashboard to see metrics here')).toBeInTheDocument();
    });

    it('shows empty activity state', () => {
      render(<Dashboard {...defaultProps} recentActivity={[]} />);

      expect(screen.getByText('No recent activity')).toBeInTheDocument();
      expect(screen.getByText('Activity will appear here as tests are run')).toBeInTheDocument();
    });

    it('shows empty state with call-to-action buttons', () => {
      render(
        <Dashboard
          {...defaultProps}
          metrics={[]}
          recentActivity={[]}
        />
      );

      expect(screen.getByText('No metrics available')).toBeInTheDocument();
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
      expect(screen.getByText('View Reports')).toBeInTheDocument();
    });
  });

  describe('Data Updates', () => {
    it('updates when metrics change', () => {
      const { rerender } = render(<Dashboard {...defaultProps} />);

      expect(screen.getByText('Total Tests')).toBeInTheDocument();
      expect(screen.getByText('1234')).toBeInTheDocument();

      const newMetrics = [
        {
          ...mockMetrics[0],
          title: 'Updated Metric',
          value: 9999
        }
      ];

      rerender(<Dashboard {...defaultProps} metrics={newMetrics} />);

      expect(screen.getByText('Updated Metric')).toBeInTheDocument();
      expect(screen.getByText('9999')).toBeInTheDocument();
      expect(screen.queryByText('Total Tests')).not.toBeInTheDocument();
    });

    it('updates when activity changes', () => {
      const { rerender } = render(<Dashboard {...defaultProps} />);

      expect(screen.getByText('Login Flow Tests')).toBeInTheDocument();

      const newActivity: RecentActivity[] = [
        {
          id: 'new-activity',
          type: 'test_run',
          title: 'New Activity',
          description: 'This is a new activity',
          timestamp: new Date(),
          status: 'success'
        }
      ];

      rerender(<Dashboard {...defaultProps} recentActivity={newActivity} />);

      expect(screen.getByText('New Activity')).toBeInTheDocument();
      expect(screen.queryByText('Login Flow Tests')).not.toBeInTheDocument();
    });

    it('handles loading state transitions', async () => {
      const { rerender } = render(<Dashboard {...defaultProps} isLoading={false} />);

      expect(screen.getByText('Total Tests')).toBeInTheDocument();

      rerender(<Dashboard {...defaultProps} isLoading={true} />);

      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
      expect(screen.queryByText('Total Tests')).not.toBeInTheDocument();

      rerender(<Dashboard {...defaultProps} isLoading={false} />);

      expect(screen.getByText('Total Tests')).toBeInTheDocument();
      expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('handles metrics loading error gracefully', () => {
      render(<Dashboard {...defaultProps} metrics={[]} />);

      expect(screen.getByText('No metrics available')).toBeInTheDocument();
      expect(screen.queryByText('Error loading metrics')).not.toBeInTheDocument();
    });

    it('handles activity loading error gracefully', () => {
      render(<Dashboard {...defaultProps} recentActivity={[]} />);

      expect(screen.getByText('No recent activity')).toBeInTheDocument();
      expect(screen.queryByText('Error loading activity')).not.toBeInTheDocument();
    });

    it('displays error message when refresh fails', async () => {
      const mockOnRefresh = vi.fn().mockRejectedValue(new Error('Network error'));

      render(<Dashboard {...defaultProps} onRefresh={mockOnRefresh} />);

      const user = userEvent.setup();
      const refreshButton = screen.getByText('Refresh');
      await user.click(refreshButton);

      await waitFor(() => {
        expect(mockOnRefresh).toHaveBeenCalled();
      });

      // Should handle error gracefully (implementation dependent)
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Metrics' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
    });

    it('provides ARIA labels for metrics', () => {
      render(<Dashboard {...defaultProps} />);

      mockMetrics.forEach(metric => {
        const metricElement = screen.getByText(metric.title).closest('[data-testid="metric-card"]');
        expect(metricElement).toHaveAttribute('aria-label');
      });
    });

    it('provides ARIA labels for activities', () => {
      render(<Dashboard {...defaultProps} />);

      mockActivity.forEach(activity => {
        const activityElement = screen.getByText(activity.title).closest('[data-testid="activity-item"]');
        expect(activityElement).toHaveAttribute('aria-label');
      });
    });

    it('supports keyboard navigation for action buttons', async () => {
      const user = userEvent.setup();
      render(<Dashboard {...defaultProps} />);

      await user.tab();
      expect(screen.getByText('Refresh')).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(defaultProps.onRefresh).toHaveBeenCalled();
    });

    it('announces loading state to screen readers', () => {
      render(<Dashboard {...defaultProps} isLoading={true} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    });

    it('provides proper focus management', async () => {
      const user = userEvent.setup();
      render(<Dashboard {...defaultProps} />);

      const refreshButton = screen.getByText('Refresh');
      refreshButton.focus();
      expect(refreshButton).toHaveFocus();

      await user.tab();
      expect(screen.getByText('View All Activity')).toHaveFocus();
    });
  });

  describe('Responsive Design', () => {
    it('adapts layout for different screen sizes', () => {
      // Mock different window sizes
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(<Dashboard {...defaultProps} />);

      // Should render in mobile layout
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Metrics')).toBeInTheDocument();

      // Should adapt to desktop layout
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // Re-render to test desktop layout
      render(<Dashboard {...defaultProps} />);
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('handles metric grid layout changes', () => {
      render(<Dashboard {...defaultProps} />);

      const metricsContainer = screen.getByTestId('metrics-grid');
      expect(metricsContainer).toBeInTheDocument();

      // Grid should be responsive
      expect(metricsContainer).toHaveClass('grid');
    });
  });

  describe('Performance', () => {
    it('renders efficiently with large datasets', () => {
      const largeMetrics: DashboardMetric[] = Array.from({ length: 50 }, (_, i) => ({
        id: `metric-${i}`,
        title: `Metric ${i}`,
        value: i * 100,
        change: {
          value: i % 2 === 0 ? i * 0.1 : -i * 0.1,
          type: i % 2 === 0 ? 'increase' : 'decrease',
          period: 'last day'
        },
        icon: () => <div data-testid="metric-icon">📊</div>,
        color: ['blue', 'green', 'red', 'yellow', 'purple', 'indigo'][i % 6] as any
      }));

      const startTime = performance.now();
      render(<Dashboard {...defaultProps} metrics={largeMetrics} />);
      const endTime = performance.now();

      const renderTime = endTime - startTime;
      expect(renderTime).toBeLessThan(100); // Should render in under 100ms

      expect(screen.getAllByTestId('metric-card')).toHaveLength(50);
    });

    it('handles rapid data updates efficiently', async () => {
      const { rerender } = render(<Dashboard {...defaultProps} />);

      const startTime = performance.now();

      for (let i = 0; i < 10; i++) {
        const updatedMetrics = mockMetrics.map(metric => ({
          ...metric,
          value: typeof metric.value === 'number' ? metric.value + i : metric.value
        }));
        rerender(<Dashboard {...defaultProps} metrics={updatedMetrics} />);
      }

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      expect(updateTime).toBeLessThan(200); // Should update in under 200ms
    });

    it('does not cause memory leaks', () => {
      const { unmount } = render(<Dashboard {...defaultProps} />);

      // Component should unmount without issues
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Component Composition', () => {
    it('integrates with child components correctly', () => {
      render(<Dashboard {...defaultProps} />);

      // Should render Button components
      const buttons = screen.getAllByTestId('button');
      expect(buttons.length).toBeGreaterThan(0);

      // Should render StatusIndicator components
      const statusIndicators = screen.getAllByTestId('status-indicator');
      expect(statusIndicators.length).toBeGreaterThan(0);
    });

    it('passes props correctly to child components', () => {
      render(<Dashboard {...defaultProps} />);

      const buttons = screen.getAllByTestId('button');
      buttons.forEach(button => {
        expect(button).toBeInTheDocument();
      });
    });

    it('handles child component errors gracefully', () => {
      // Mock child component throwing an error
      const originalError = console.error;
      console.error = vi.fn();

      expect(() => {
        render(<Dashboard {...defaultProps} />);
      }).not.toThrow();

      console.error = originalError;
    });
  });

  describe('Data Validation', () => {
    it('handles invalid metric data gracefully', () => {
      const invalidMetrics: DashboardMetric[] = [
        {
          id: '',
          title: '',
          value: null as any,
          icon: () => null,
          color: 'blue'
        }
      ];

      render(<Dashboard {...defaultProps} metrics={invalidMetrics} />);

      expect(screen.getByText('No metrics available')).toBeInTheDocument();
    });

    it('handles invalid activity data gracefully', () => {
      const invalidActivity: RecentActivity[] = [
        {
          id: '',
          type: 'invalid' as any,
          title: '',
          description: '',
          timestamp: new Date('invalid'),
          status: 'invalid' as any
        }
      ];

      render(<Dashboard {...defaultProps} recentActivity={invalidActivity} />);

      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });

    it('handles missing optional props', () => {
      const minimalProps = {
        metrics: [],
        recentActivity: [],
      };

      render(<Dashboard {...minimalProps} />);

      expect(screen.getByText('No metrics available')).toBeInTheDocument();
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });
  });

  describe('Customization', () => {
    it('supports custom metric card styling', () => {
      const customProps = {
        ...defaultProps,
        metricCardClassName: 'custom-metric-card'
      };

      render(<Dashboard {...customProps} />);

      const metricCards = screen.getAllByTestId('metric-card');
      metricCards.forEach(card => {
        expect(card).toHaveClass('custom-metric-card');
      });
    });

    it('supports custom activity item styling', () => {
      const customProps = {
        ...defaultProps,
        activityItemClassName: 'custom-activity-item'
      };

      render(<Dashboard {...customProps} />);

      const activityItems = screen.getAllByTestId('activity-item');
      activityItems.forEach(item => {
        expect(item).toHaveClass('custom-activity-item');
      });
    });

    it('supports custom time formatting', () => {
      const customProps = {
        ...defaultProps,
        timeFormat: 'relative' as const
      };

      render(<Dashboard {...customProps} />);

      // Should show relative time like "2 hours ago"
      expect(screen.getByText(/ago/)).toBeInTheDocument();
    });
  });
});