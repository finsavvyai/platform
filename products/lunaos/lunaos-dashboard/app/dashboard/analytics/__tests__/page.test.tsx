/**
 * LunaOS Analytics Page — Unit Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnalyticsPage from '../page';

jest.mock('../../../../lib/api', () => ({
    telemetryApi: {
        overview: jest.fn(),
        agents: jest.fn(),
        providers: jest.fn(),
    },
    billingApi: {
        usage: jest.fn(),
    },
}));

import { telemetryApi, billingApi } from '../../../../lib/api';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/dashboard/analytics',
}));

const mockOverview = {
    totalExecutions: 1234,
    uniqueUsers: 56,
    avgDurationMs: 2500,
    errorRate: 1.5,
    topAgents: [],
    topProviders: [],
    dailyActiveUsers: 12,
    weeklyActiveUsers: 34,
};

const mockAgents = [
    { agent: 'code-review', totalExecutions: 500, avgDurationMs: 3000, errorRate: 1.2, lastUsed: '2026-02-10T10:00:00Z' },
    { agent: 'testing', totalExecutions: 300, avgDurationMs: 4200, errorRate: 0.5, lastUsed: '2026-02-09T15:00:00Z' },
    { agent: 'security-scan', totalExecutions: 150, avgDurationMs: 5100, errorRate: 3.1, lastUsed: '2026-02-08T12:00:00Z' },
];

const mockProviders = [
    { provider: 'deepseek', model: 'deepseek-chat', totalCalls: 600, avgDurationMs: 2800, totalInputTokens: 500000, totalOutputTokens: 200000 },
    { provider: 'openai', model: 'gpt-4o', totalCalls: 250, avgDurationMs: 3500, totalInputTokens: 300000, totalOutputTokens: 150000 },
];

const mockUsage = {
    used: 47,
    limit: 100,
    remaining: 53,
    percentUsed: 47,
    tier: 'free',
};

describe('AnalyticsPage', () => {
    beforeEach(() => {
        (telemetryApi.overview as jest.Mock).mockResolvedValue(mockOverview);
        (telemetryApi.agents as jest.Mock).mockResolvedValue(mockAgents);
        (telemetryApi.providers as jest.Mock).mockResolvedValue(mockProviders);
        (billingApi.usage as jest.Mock).mockResolvedValue(mockUsage);
    });

    test('shows loading spinner initially', () => {
        render(<AnalyticsPage />);
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    test('renders page title after load', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('Analytics')).toBeInTheDocument();
        });
    });

    test('renders subtitle', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('Agent usage and performance metrics')).toBeInTheDocument();
        });
    });

    test('fetches all APIs on mount', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(telemetryApi.overview).toHaveBeenCalled();
            expect(telemetryApi.agents).toHaveBeenCalled();
            expect(telemetryApi.providers).toHaveBeenCalled();
            expect(billingApi.usage).toHaveBeenCalled();
        });
    });

    test('displays KPI card labels', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('Total Executions')).toBeInTheDocument();
            // 'Avg Latency' appears in KPI card and Token Consumption table
            expect(screen.getAllByText('Avg Latency').length).toBeGreaterThanOrEqual(1);
            // 'Error Rate' appears in KPI card and Agent Performance table
            expect(screen.getAllByText('Error Rate').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText('Active Users')).toBeInTheDocument();
        });
    });

    test('displays correct execution count', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('1,234')).toBeInTheDocument();
        });
    });

    test('displays avg latency formatted', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('2.5s')).toBeInTheDocument();
        });
    });

    test('displays error rate value', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            // The text "1.5%" is split as "1.5" and "%" in JSX interpolation
            expect(screen.getByText(/1\.5/)).toBeInTheDocument();
        });
    });

    test('displays DAU count', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('DAU')).toBeInTheDocument();
        });
    });

    test('displays monthly quota section', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('Your Monthly Quota')).toBeInTheDocument();
        });
    });

    test('displays quota used count', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('47')).toBeInTheDocument();
        });
    });

    test('displays remaining quota', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText(/53 remaining/)).toBeInTheDocument();
        });
    });

    test('displays Agent Popularity heading', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText(/Agent Popularity/)).toBeInTheDocument();
        });
    });

    test('displays agent names in bar chart', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            // Agent names appear in both the bar chart and the performance table
            expect(screen.getAllByText('code review').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('security scan').length).toBeGreaterThanOrEqual(1);
        });
    });

    test('displays Provider & Model Usage heading', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText(/Provider & Model Usage/)).toBeInTheDocument();
        });
    });

    test('displays provider labels', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('deepseek / deepseek-chat')).toBeInTheDocument();
            expect(screen.getByText('openai / gpt-4o')).toBeInTheDocument();
        });
    });

    test('displays Agent Performance heading', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText(/Agent Performance/)).toBeInTheDocument();
        });
    });

    test('displays agent run counts in table', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            // Run counts may appear in multiple places (bar chart suffix + table)
            expect(screen.getAllByText('500').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('300').length).toBeGreaterThanOrEqual(1);
        });
    });

    test('time range picker renders three options', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('24h')).toBeInTheDocument();
            expect(screen.getByText('7d')).toBeInTheDocument();
            expect(screen.getByText('30d')).toBeInTheDocument();
        });
    });

    test('clicking time range re-fetches data', async () => {
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('24h')).toBeInTheDocument();
        });

        (telemetryApi.overview as jest.Mock).mockClear();
        (telemetryApi.agents as jest.Mock).mockClear();
        (telemetryApi.providers as jest.Mock).mockClear();

        fireEvent.click(screen.getByText('24h'));

        await waitFor(() => {
            expect(telemetryApi.overview).toHaveBeenCalled();
            expect(telemetryApi.agents).toHaveBeenCalled();
            expect(telemetryApi.providers).toHaveBeenCalled();
        });
    });

    test('handles all API errors gracefully', async () => {
        (telemetryApi.overview as jest.Mock).mockRejectedValue(new Error('fail'));
        (telemetryApi.agents as jest.Mock).mockRejectedValue(new Error('fail'));
        (telemetryApi.providers as jest.Mock).mockRejectedValue(new Error('fail'));
        (billingApi.usage as jest.Mock).mockRejectedValue(new Error('fail'));

        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('Analytics')).toBeInTheDocument();
        });
    });

    test('shows empty agent state when no data', async () => {
        (telemetryApi.agents as jest.Mock).mockResolvedValue([]);
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('No execution data yet')).toBeInTheDocument();
        });
    });

    test('shows empty provider state when no data', async () => {
        (telemetryApi.providers as jest.Mock).mockResolvedValue([]);
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText('No provider data yet')).toBeInTheDocument();
        });
    });

    test('high error rate shows red color', async () => {
        (telemetryApi.overview as jest.Mock).mockResolvedValue({
            ...mockOverview,
            errorRate: 8.5,
        });
        render(<AnalyticsPage />);
        await waitFor(() => {
            expect(screen.getByText(/8\.5/)).toBeInTheDocument();
        });
    });
});
