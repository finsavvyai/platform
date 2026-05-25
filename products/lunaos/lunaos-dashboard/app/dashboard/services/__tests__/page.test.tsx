/**
 * LunaOS Services Hub Page — Unit Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import ServicesHubPage from '../page';

jest.mock('../../../../lib/api', () => ({
    servicesApi: {
        catalog: jest.fn(),
        health: jest.fn(),
        test: jest.fn(),
    },
}));

import { servicesApi } from '../../../../lib/api';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/dashboard/services',
}));

const mockCatalog = {
    services: [
        { id: 'agent-engine', name: 'Agent Engine', status: 'active', tier: 'core', category: 'agents' },
        { id: 'rag-pipeline', name: 'RAG Pipeline', status: 'active', tier: 'core', category: 'rag' },
        { id: 'discord-gateway', name: 'Discord Gateway', status: 'inactive', tier: 'integration', category: 'channels' },
    ],
    total: 3,
    byTier: { core: 2, integration: 1 },
    byStatus: { active: 2, inactive: 1 },
};

const mockHealth = {
    status: 'healthy',
    latency: '45ms',
    checks: {
        database: { ok: true },
        redis: { ok: true },
        queue: { ok: false },
    },
};

describe('ServicesHubPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (servicesApi.catalog as jest.Mock).mockResolvedValue(mockCatalog);
        (servicesApi.health as jest.Mock).mockResolvedValue(mockHealth);
    });

    test('shows loading spinner initially', () => {
        (servicesApi.catalog as jest.Mock).mockReturnValue(new Promise(() => { }));
        (servicesApi.health as jest.Mock).mockReturnValue(new Promise(() => { }));
        render(<ServicesHubPage />);
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    test('renders page header after load', async () => {
        render(<ServicesHubPage />);
        await waitFor(() => {
            expect(screen.getByText('Services Hub')).toBeInTheDocument();
            expect(screen.getByText(/Manage all OpenClaw-powered services/)).toBeInTheDocument();
        });
    });

    test('renders system status banner', async () => {
        render(<ServicesHubPage />);
        await waitFor(() => {
            expect(screen.getByText(/All Systems Operational/)).toBeInTheDocument();
        });
    });

    test('shows degraded status when health is degraded', async () => {
        (servicesApi.health as jest.Mock).mockResolvedValue({
            ...mockHealth,
            status: 'degraded',
        });
        render(<ServicesHubPage />);
        await waitFor(() => {
            expect(screen.getByText(/Degraded Performance/)).toBeInTheDocument();
        });
    });

    test('renders stats row with correct counts', async () => {
        render(<ServicesHubPage />);
        await waitFor(() => {
            expect(screen.getByText('Total Services')).toBeInTheDocument();
            expect(screen.getByText('Active')).toBeInTheDocument();
            expect(screen.getByText('Core')).toBeInTheDocument();
            // "Integrations" appears in both stat card and section heading
            expect(screen.getAllByText('Integrations').length).toBeGreaterThanOrEqual(1);
        });
    });

    test('renders core services section', async () => {
        render(<ServicesHubPage />);
        await waitFor(() => {
            expect(screen.getByText('Core Services')).toBeInTheDocument();
        });
    });

    test('renders integration services section', async () => {
        render(<ServicesHubPage />);
        await waitFor(() => {
            // The integration section title
            expect(screen.getAllByText('Integrations').length).toBeGreaterThanOrEqual(1);
        });
    });

    test('shows health check badges', async () => {
        render(<ServicesHubPage />);
        await waitFor(() => {
            expect(screen.getByText('database')).toBeInTheDocument();
            expect(screen.getByText('redis')).toBeInTheDocument();
            expect(screen.getByText('queue')).toBeInTheDocument();
        });
    });

    test('renders latency in status banner', async () => {
        render(<ServicesHubPage />);
        await waitFor(() => {
            expect(screen.getByText(/45ms/)).toBeInTheDocument();
        });
    });

    test('handles API errors gracefully', async () => {
        (servicesApi.catalog as jest.Mock).mockRejectedValue(new Error('API error'));
        (servicesApi.health as jest.Mock).mockRejectedValue(new Error('API error'));
        render(<ServicesHubPage />);
        // Should not crash — loading finishes
        await waitFor(() => {
            expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
        });
    });

    test('handles null health gracefully', async () => {
        (servicesApi.health as jest.Mock).mockResolvedValue(null);
        render(<ServicesHubPage />);
        await waitFor(() => {
            expect(screen.getByText(/Checking.../)).toBeInTheDocument();
        });
    });
});
