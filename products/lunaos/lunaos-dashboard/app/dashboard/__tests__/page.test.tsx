/**
 * LunaOS Dashboard Page — Unit Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../page';

jest.mock('../../../lib/api', () => ({
    agentsApi: {
        list: jest.fn(),
        executions: jest.fn(),
    },
    healthApi: {
        check: jest.fn(),
    },
    servicesApi: {
        catalog: jest.fn(),
    },
}));

import { agentsApi, healthApi, servicesApi } from '../../../lib/api';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/dashboard',
}));

describe('DashboardPage', () => {
    beforeEach(() => {
        (agentsApi.list as jest.Mock).mockResolvedValue({
            agents: [
                { slug: 'code-review', name: 'Code Review', category: 'review', tier: 'free', hasSystemPrompt: true },
                { slug: 'security-scan', name: 'Security Scan', category: 'security', tier: 'pro', hasSystemPrompt: true },
            ],
            total: 2,
            free: 1,
            pro: 1,
        });
        (agentsApi.executions as jest.Mock).mockResolvedValue({
            executions: [],
            count: 0,
        });
        (healthApi.check as jest.Mock).mockResolvedValue({
            status: 'ok',
            latency: '42ms',
        });
        (servicesApi.catalog as jest.Mock).mockResolvedValue({
            services: [],
            total: 0,
        });
    });

    test('renders loading skeleton initially', () => {
        render(<DashboardPage />);
        // DashboardSkeleton renders animated pulse elements
        expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    test('renders dashboard heading after load', async () => {
        render(<DashboardPage />);
        await waitFor(() => {
            expect(screen.getByText('Dashboard')).toBeInTheDocument();
        });
    });

    test('renders subtitle', async () => {
        render(<DashboardPage />);
        await waitFor(() => {
            expect(screen.getByText('Your AI agent command center')).toBeInTheDocument();
        });
    });

    test('fetches agents, executions, and health on mount', async () => {
        render(<DashboardPage />);
        await waitFor(() => {
            expect(agentsApi.list).toHaveBeenCalled();
            expect(agentsApi.executions).toHaveBeenCalled();
            expect(healthApi.check).toHaveBeenCalled();
        });
    });

    test('displays stat cards', async () => {
        render(<DashboardPage />);
        await waitFor(() => {
            expect(screen.getByText('Total Agents')).toBeInTheDocument();
            expect(screen.getByText('Executions')).toBeInTheDocument();
            expect(screen.getByText('API Status')).toBeInTheDocument();
            expect(screen.getByText('Plan')).toBeInTheDocument();
        });
    });

    test('displays agent count', async () => {
        render(<DashboardPage />);
        await waitFor(() => {
            expect(screen.getByText('2')).toBeInTheDocument(); // total
        });
    });

    test('shows API online status', async () => {
        render(<DashboardPage />);
        await waitFor(() => {
            expect(screen.getByText('Online')).toBeInTheDocument();
        });
    });

    test('shows API offline when check fails', async () => {
        (healthApi.check as jest.Mock).mockResolvedValue(null);
        render(<DashboardPage />);
        await waitFor(() => {
            expect(screen.getByText('Offline')).toBeInTheDocument();
        });
    });

    test('renders Quick Run section', async () => {
        render(<DashboardPage />);
        await waitFor(() => {
            expect(screen.getByText('Quick Run')).toBeInTheDocument();
            expect(screen.getByText('View all agents →')).toBeInTheDocument();
        });
    });

    test('renders CLI banner', async () => {
        render(<DashboardPage />);
        await waitFor(() => {
            expect(screen.getByText(/npx luna-agents run code-review/)).toBeInTheDocument();
            expect(screen.getByText('Prefer the terminal?')).toBeInTheDocument();
        });
    });

    test('shows empty execution state', async () => {
        render(<DashboardPage />);
        await waitFor(() => {
            expect(screen.getByText('No executions yet')).toBeInTheDocument();
        });
    });

    test('shows free agents in quick run', async () => {
        render(<DashboardPage />);
        await waitFor(() => {
            expect(screen.getByText('Code Review')).toBeInTheDocument();
        });
    });

    test('handles API errors gracefully', async () => {
        (agentsApi.list as jest.Mock).mockRejectedValue(new Error('API down'));
        render(<DashboardPage />);
        // Should not crash — the catch block handles errors and loading finishes
        await waitFor(() => {
            // After error, loading should finish — we should not see skeleton
            expect(document.querySelector('.animate-pulse')).toBeNull();
        });
    });

    test('renders recent executions when available', async () => {
        (agentsApi.executions as jest.Mock).mockResolvedValue({
            executions: [
                {
                    id: '1',
                    agent: 'code-review',
                    provider: 'deepseek',
                    created_at: '2026-02-01T00:00:00Z',
                    duration_ms: 3200,
                    status: 'completed',
                },
                {
                    id: '2',
                    agent: 'security-scan',
                    provider: 'openai',
                    created_at: '2026-02-02T00:00:00Z',
                    duration_ms: null,
                    status: 'completed',
                },
            ],
            count: 2,
        });
        render(<DashboardPage />);
        await waitFor(() => {
            expect(screen.getByText('code-review')).toBeInTheDocument();
            expect(screen.getByText('3.2s')).toBeInTheDocument();
            expect(screen.getByText('--')).toBeInTheDocument(); // null duration
        });
    });

    test('handles executions API failure gracefully', async () => {
        (agentsApi.executions as jest.Mock).mockRejectedValue(new Error('executions down'));
        render(<DashboardPage />);
        await waitFor(() => {
            // Should still render, catch falls back to empty
            expect(screen.getByText('Dashboard')).toBeInTheDocument();
        });
    });

    test('handles health API failure gracefully', async () => {
        (healthApi.check as jest.Mock).mockRejectedValue(new Error('health down'));
        render(<DashboardPage />);
        await waitFor(() => {
            // Health should fall back to null → Offline
            expect(screen.getByText('Offline')).toBeInTheDocument();
        });
    });
});
