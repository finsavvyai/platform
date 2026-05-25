/**
 * LunaOS History Page — Unit Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import HistoryPage from '../page';

jest.mock('../../../../lib/api', () => ({
    agentsApi: {
        executions: jest.fn(),
    },
}));

import { agentsApi } from '../../../../lib/api';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/dashboard/history',
}));

describe('HistoryPage', () => {
    test('shows loading spinner initially', () => {
        (agentsApi.executions as jest.Mock).mockReturnValue(new Promise(() => { }));
        render(<HistoryPage />);
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    test('renders page title', async () => {
        (agentsApi.executions as jest.Mock).mockResolvedValue({ executions: [], count: 0 });
        render(<HistoryPage />);
        await waitFor(() => {
            expect(screen.getByText('Execution History')).toBeInTheDocument();
        });
    });

    test('shows empty state when no executions', async () => {
        (agentsApi.executions as jest.Mock).mockResolvedValue({ executions: [], count: 0 });
        render(<HistoryPage />);
        await waitFor(() => {
            expect(screen.getByText('No executions yet')).toBeInTheDocument();
        });
    });

    test('renders execution list', async () => {
        (agentsApi.executions as jest.Mock).mockResolvedValue({
            executions: [
                {
                    id: 'exec-1',
                    agent: 'code-review',
                    provider: 'deepseek',
                    model: 'deepseek-chat',
                    duration_ms: 3200,
                    created_at: '2026-02-08T00:00:00Z',
                },
                {
                    id: 'exec-2',
                    agent: 'security-scan',
                    provider: 'anthropic',
                    model: 'claude-3',
                    duration_ms: 5100,
                    created_at: '2026-02-07T23:00:00Z',
                },
            ],
            count: 2,
        });

        render(<HistoryPage />);
        await waitFor(() => {
            expect(screen.getByText('code-review')).toBeInTheDocument();
            expect(screen.getByText('security-scan')).toBeInTheDocument();
            expect(screen.getByText('deepseek')).toBeInTheDocument();
            expect(screen.getByText('anthropic')).toBeInTheDocument();
        });
    });

    test('displays execution duration', async () => {
        (agentsApi.executions as jest.Mock).mockResolvedValue({
            executions: [
                {
                    id: 'exec-1',
                    agent: 'code-review',
                    provider: 'deepseek',
                    model: 'deepseek-chat',
                    duration_ms: 3200,
                    created_at: '2026-02-08T00:00:00Z',
                },
            ],
            count: 1,
        });

        render(<HistoryPage />);
        await waitFor(() => {
            expect(screen.getByText('3.2s')).toBeInTheDocument();
        });
    });

    test('handles API error gracefully', async () => {
        (agentsApi.executions as jest.Mock).mockRejectedValue(new Error('API error'));
        render(<HistoryPage />);
        // Should not crash
        await waitFor(() => {
            expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
        });
    });

    test('handles response with null executions array', async () => {
        (agentsApi.executions as jest.Mock).mockResolvedValue({
            executions: null,
            count: 0,
        });
        render(<HistoryPage />);
        await waitFor(() => {
            // Falls back to empty array via `|| []` — shows empty state
            expect(screen.getByText('No executions yet')).toBeInTheDocument();
        });
    });

    test('displays -- for null duration_ms', async () => {
        (agentsApi.executions as jest.Mock).mockResolvedValue({
            executions: [
                {
                    id: 'exec-null-dur',
                    agent: 'test-agent',
                    provider: 'openai',
                    model: 'gpt-4',
                    duration_ms: null,
                    created_at: '2026-02-08T00:00:00Z',
                },
            ],
            count: 1,
        });
        render(<HistoryPage />);
        await waitFor(() => {
            expect(screen.getByText('--')).toBeInTheDocument();
        });
    });
});
