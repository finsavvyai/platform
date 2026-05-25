/**
 * LunaOS Chains Page — Unit Tests
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ChainsPage from '../page';

jest.mock('../../../../lib/api', () => ({
    chainsApi: {
        listPresets: jest.fn(),
        history: jest.fn(),
        execute: jest.fn(),
    },
}));

import { chainsApi } from '../../../../lib/api';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/dashboard/chains',
}));

jest.mock('next/link', () => {
    return ({ children, ...props }: { children: React.ReactNode; href: string }) => (
        <a {...props}>{children}</a>
    );
});

const mockPresets = [
    {
        slug: 'full-review',
        name: 'Full Review',
        description: 'Code review + security + docs',
        agents: ['code-review', 'security-scan', 'doc-gen'],
    },
    {
        slug: 'quick-fix',
        name: 'Quick Fix',
        description: 'Analyze + fix code issues',
        agents: ['code-review', 'auto-fix'],
    },
];

const mockHistory = [
    {
        id: 'chain-exec-1',
        chain: 'full-review',
        status: 'completed',
        created_at: '2026-03-10T14:00:00Z',
        duration_ms: 12000,
    },
];

describe('ChainsPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (chainsApi.listPresets as jest.Mock).mockResolvedValue({
            presets: mockPresets,
            total: 2,
        });
        (chainsApi.history as jest.Mock).mockResolvedValue({
            executions: mockHistory,
            count: 1,
        });
    });

    test('shows loading spinner initially', () => {
        (chainsApi.listPresets as jest.Mock).mockReturnValue(new Promise(() => { }));
        (chainsApi.history as jest.Mock).mockReturnValue(new Promise(() => { }));
        render(<ChainsPage />);
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    test('renders page header after load', async () => {
        render(<ChainsPage />);
        await waitFor(() => {
            expect(screen.getByText('Agent Chains')).toBeInTheDocument();
        });
    });

    test('renders chain description', async () => {
        render(<ChainsPage />);
        await waitFor(() => {
            expect(
                screen.getByText(/Multi-agent workflows/)
            ).toBeInTheDocument();
        });
    });

    test('renders Visual Builder link', async () => {
        render(<ChainsPage />);
        await waitFor(() => {
            expect(screen.getByText('Visual Builder')).toBeInTheDocument();
        });
    });

    test('renders preset chain cards', async () => {
        render(<ChainsPage />);
        await waitFor(() => {
            expect(screen.getByText('Full Review')).toBeInTheDocument();
            expect(screen.getByText('Quick Fix')).toBeInTheDocument();
        });
    });

    test('renders CLI banner with presets', async () => {
        render(<ChainsPage />);
        await waitFor(() => {
            expect(screen.getByText('Run chains from terminal')).toBeInTheDocument();
            expect(screen.getByText(/luna chain full-review/)).toBeInTheDocument();
        });
    });

    test('handles API error gracefully', async () => {
        (chainsApi.listPresets as jest.Mock).mockRejectedValue(new Error('API error'));
        (chainsApi.history as jest.Mock).mockRejectedValue(new Error('API error'));
        render(<ChainsPage />);
        // Should not crash — loading finishes and page renders
        await waitFor(() => {
            expect(screen.getByText('Agent Chains')).toBeInTheDocument();
        });
    });

    test('toggles active chain on card click', async () => {
        render(<ChainsPage />);
        await waitFor(() => {
            expect(screen.getByText('Full Review')).toBeInTheDocument();
        });

        // Find and click a chain card — the card title should exist
        const fullReviewCard = screen.getByText('Full Review').closest('button') ||
            screen.getByText('Full Review').closest('[class*="cursor"]');
        if (fullReviewCard) {
            fireEvent.click(fullReviewCard);
        }
    });

    test('handles empty presets list', async () => {
        (chainsApi.listPresets as jest.Mock).mockResolvedValue({ presets: [], total: 0 });
        render(<ChainsPage />);
        await waitFor(() => {
            expect(screen.getByText('Agent Chains')).toBeInTheDocument();
        });
    });
});
