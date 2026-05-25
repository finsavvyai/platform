/**
 * LunaOS Agent Catalog Page — Unit Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AgentsPage from '../page';

jest.mock('../../../../lib/api', () => ({
    agentsApi: {
        list: jest.fn(),
    },
}));

import { agentsApi } from '../../../../lib/api';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/dashboard/agents',
}));

const mockAgents = {
    agents: [
        { slug: 'code-review', name: 'Code Review', category: 'review', tier: 'free', hasSystemPrompt: true },
        { slug: 'security-scan', name: 'Security Scan', category: 'security', tier: 'pro', hasSystemPrompt: true },
        { slug: 'test-gen', name: 'Test Generator', category: 'testing', tier: 'free', hasSystemPrompt: true },
    ],
    total: 3,
    free: 2,
    pro: 1,
};

describe('AgentsPage', () => {
    beforeEach(() => {
        (agentsApi.list as jest.Mock).mockResolvedValue(mockAgents);
    });

    test('shows loading skeleton initially', () => {
        render(<AgentsPage />);
        expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    test('renders page title after load', async () => {
        render(<AgentsPage />);
        await waitFor(() => {
            expect(screen.getByText('Agent Catalog')).toBeInTheDocument();
        });
    });

    test('fetches agents on mount', async () => {
        render(<AgentsPage />);
        await waitFor(() => {
            expect(agentsApi.list).toHaveBeenCalled();
        });
    });

    test('renders all agents', async () => {
        render(<AgentsPage />);
        await waitFor(() => {
            expect(screen.getByText('Code Review')).toBeInTheDocument();
            expect(screen.getByText('Security Scan')).toBeInTheDocument();
            expect(screen.getByText('Test Generator')).toBeInTheDocument();
        });
    });

    test('renders search input', async () => {
        render(<AgentsPage />);
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Search agents...')).toBeInTheDocument();
        });
    });

    test('search filters agents by name', async () => {
        render(<AgentsPage />);
        await waitFor(() => {
            expect(screen.getByText('Code Review')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByPlaceholderText('Search agents...'), { target: { value: 'security' } });

        await waitFor(() => {
            expect(screen.getByText('Security Scan')).toBeInTheDocument();
            expect(screen.queryByText('Code Review')).not.toBeInTheDocument();
        });
    });

    test('renders tier filter buttons', async () => {
        render(<AgentsPage />);
        await waitFor(() => {
            expect(screen.getByText(/All \(/)).toBeInTheDocument();
            expect(screen.getByText(/Free \(/)).toBeInTheDocument();
            expect(screen.getByText(/Pro \(/)).toBeInTheDocument();
        });
    });

    test('tier filter shows only matching agents', async () => {
        render(<AgentsPage />);
        await waitFor(() => {
            expect(screen.getByText('Code Review')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Pro \(/));

        await waitFor(() => {
            expect(screen.getByText('Security Scan')).toBeInTheDocument();
            expect(screen.queryByText('Code Review')).not.toBeInTheDocument();
        });
    });

    test('agents link to execution page', async () => {
        render(<AgentsPage />);
        await waitFor(() => {
            const link = screen.getByText('Code Review').closest('a');
            expect(link).toHaveAttribute('href', '/dashboard/agents/code-review');
        });
    });

    test('handles API error gracefully', async () => {
        (agentsApi.list as jest.Mock).mockRejectedValue(new Error('Failed'));
        render(<AgentsPage />);
        // Should not crash
        await waitFor(() => {
            expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
        });
    });
});
