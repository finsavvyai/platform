/**
 * LunaOS Visualizer Page — Unit Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VisualizerPage from '../page';

jest.mock('../../../../lib/api', () => ({
    agentsApi: {
        list: jest.fn(),
        executions: jest.fn(),
    },
}));

import { agentsApi } from '../../../../lib/api';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/dashboard/visualizer',
}));

const mockAgents = {
    agents: [
        { slug: 'code-review', name: 'Code Review', category: 'review', tier: 'free', hasSystemPrompt: true },
        { slug: 'testing', name: 'Testing', category: 'testing', tier: 'free', hasSystemPrompt: true },
    ],
    total: 2,
    free: 2,
    pro: 0,
};

const mockExecutions = {
    executions: [
        {
            id: 'exec-1',
            agent: 'code-review',
            provider: 'deepseek',
            model: 'deepseek-chat',
            duration_ms: 3200,
            created_at: '2026-02-10T10:00:00Z',
            output: '## Analysis\nCode looks good.\n## Recommendations\nAdd more tests.\n## Summary\nOverall pass.',
            status: 'completed',
        },
        {
            id: 'exec-2',
            agent: 'testing',
            provider: 'openai',
            model: 'gpt-4o',
            duration_ms: 4500,
            created_at: '2026-02-09T15:00:00Z',
            output: '## Test Plan\nUnit tests needed.\n## Coverage\n85% coverage.',
            status: 'completed',
        },
        {
            id: 'exec-3',
            agent: 'code-review',
            provider: 'anthropic',
            model: 'claude-3',
            duration_ms: 2100,
            created_at: '2026-02-08T12:00:00Z',
            output: '',
            status: 'error',
        },
    ],
    count: 3,
};

describe('VisualizerPage', () => {
    beforeEach(() => {
        (agentsApi.list as jest.Mock).mockResolvedValue(mockAgents);
        (agentsApi.executions as jest.Mock).mockResolvedValue(mockExecutions);
    });

    test('shows loading spinner initially', () => {
        render(<VisualizerPage />);
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    test('renders page title after load', async () => {
        render(<VisualizerPage />);
        await waitFor(() => {
            expect(screen.getByText('Agent Visualizer')).toBeInTheDocument();
        });
    });

    test('renders subtitle', async () => {
        render(<VisualizerPage />);
        await waitFor(() => {
            expect(screen.getByText('Explore agent reasoning chains step-by-step')).toBeInTheDocument();
        });
    });

    test('fetches agents and executions on mount', async () => {
        render(<VisualizerPage />);
        await waitFor(() => {
            expect(agentsApi.list).toHaveBeenCalled();
            expect(agentsApi.executions).toHaveBeenCalled();
        });
    });

    test('renders execution sidebar with count', async () => {
        render(<VisualizerPage />);
        await waitFor(() => {
            expect(screen.getByText(/Recent Executions/)).toBeInTheDocument();
        });
    });

    test('lists executions in sidebar by agent name', async () => {
        render(<VisualizerPage />);
        await waitFor(() => {
            // Agent names appear in sidebar buttons — there may be multiple Code Review entries
            const codeReviewElements = screen.getAllByText('Code Review');
            expect(codeReviewElements.length).toBeGreaterThanOrEqual(1);
        });
    });

    test('auto-selects first execution and shows chain', async () => {
        render(<VisualizerPage />);
        await waitFor(() => {
            // The chain header should show the first execution's agent
            // 'Code Review' appears in both sidebar and chain header
            const elements = screen.getAllByText(/Code Review/i);
            expect(elements.length).toBeGreaterThanOrEqual(1);
        });
    });

    test('shows chain status badge', async () => {
        render(<VisualizerPage />);
        await waitFor(() => {
            expect(screen.getByText('complete')).toBeInTheDocument();
        });
    });

    test('shows reasoning steps in chain', async () => {
        render(<VisualizerPage />);
        await waitFor(() => {
            expect(screen.getByText('Context Analysis')).toBeInTheDocument();
            expect(screen.getByText('Input Parsing')).toBeInTheDocument();
            expect(screen.getByText('Report Generation')).toBeInTheDocument();
        });
    });

    test('shows dynamic steps parsed from output sections', async () => {
        render(<VisualizerPage />);
        await waitFor(() => {
            expect(screen.getByText('Analysis')).toBeInTheDocument();
            expect(screen.getByText('Recommendations')).toBeInTheDocument();
            expect(screen.getByText('Summary')).toBeInTheDocument();
        });
    });

    test('shows chain metadata counts', async () => {
        render(<VisualizerPage />);
        await waitFor(() => {
            expect(screen.getByText(/reasoning steps/)).toBeInTheDocument();
            expect(screen.getByText(/total$/)).toBeInTheDocument();
            expect(screen.getByText(/tokens/)).toBeInTheDocument();
        });
    });

    test('clicking step expands its detail text', async () => {
        render(<VisualizerPage />);
        await waitFor(() => {
            expect(screen.getByText('Context Analysis')).toBeInTheDocument();
        });

        const stepCard = screen.getByText('Context Analysis').closest('[class*="neon-card"]');
        if (stepCard) {
            fireEvent.click(stepCard);
        }

        await waitFor(() => {
            expect(screen.getByText(/Reading project context/)).toBeInTheDocument();
        });
    });

    test('clicking different execution switches chain view', async () => {
        render(<VisualizerPage />);
        await waitFor(() => {
            // Wait for sidebar to load
            expect(screen.getByText(/Recent Executions/)).toBeInTheDocument();
        });

        // Find the Testing button in sidebar and click it
        const buttons = screen.getAllByRole('button');
        const testingButton = buttons.find(b => b.textContent?.includes('Testing'));
        if (testingButton) {
            fireEvent.click(testingButton);
        }

        await waitFor(() => {
            // After clicking, the chain should update
            // Test Plan is from the testing agent's output
            expect(screen.getByText('Test Plan')).toBeInTheDocument();
        });
    });

    test('shows empty state when no executions', async () => {
        (agentsApi.executions as jest.Mock).mockResolvedValue({ executions: [], count: 0 });

        render(<VisualizerPage />);
        await waitFor(() => {
            expect(screen.getByText('No executions yet')).toBeInTheDocument();
        });
    });

    test('shows helpful message in empty state', async () => {
        (agentsApi.executions as jest.Mock).mockResolvedValue({ executions: [], count: 0 });

        render(<VisualizerPage />);
        await waitFor(() => {
            expect(screen.getByText(/Run an agent from the Agents page or CLI/)).toBeInTheDocument();
        });
    });

    test('handles API errors gracefully', async () => {
        (agentsApi.list as jest.Mock).mockRejectedValue(new Error('fail'));
        (agentsApi.executions as jest.Mock).mockRejectedValue(new Error('fail'));

        render(<VisualizerPage />);
        await waitFor(() => {
            expect(screen.getByText('No executions yet')).toBeInTheDocument();
        });
    });

    test('error execution shows error in chain status', async () => {
        // Only provide the error execution
        (agentsApi.executions as jest.Mock).mockResolvedValue({
            executions: [{
                id: 'exec-err',
                agent: 'code-review',
                provider: 'anthropic',
                model: 'claude-3',
                duration_ms: 2100,
                created_at: '2026-02-08T12:00:00Z',
                output: '',
                status: 'error',
            }],
            count: 1,
        });

        render(<VisualizerPage />);
        await waitFor(() => {
            // The chain header status badge should show "error"
            // The sidebar also shows "error" status
            const errorTexts = screen.getAllByText('error');
            expect(errorTexts.length).toBeGreaterThanOrEqual(1);
        });
    });

    test('execution dates are displayed in sidebar', async () => {
        render(<VisualizerPage />);
        await waitFor(() => {
            const dateElements = screen.getAllByText(/2\/10\/2026/);
            expect(dateElements.length).toBeGreaterThan(0);
        });
    });
});
