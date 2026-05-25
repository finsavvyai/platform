/**
 * LunaOS Settings Page — Unit Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import SettingsPage from '../page';

jest.mock('../../../../lib/api', () => ({
    authApi: {
        me: jest.fn(),
    },
    healthApi: {
        check: jest.fn(),
    },
}));

import { authApi, healthApi } from '../../../../lib/api';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/dashboard/settings',
}));

describe('SettingsPage', () => {
    beforeEach(() => {
        (authApi.me as jest.Mock).mockResolvedValue({
            id: 'user-1',
            name: 'Shahar',
            email: 'shahar@lunaos.ai',
            tier: 'pro',
        });
        (healthApi.check as jest.Mock).mockResolvedValue({
            status: 'ok',
            version: '1.0.0',
            latency: '42ms',
        });
    });

    test('shows loading spinner initially', () => {
        render(<SettingsPage />);
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    test('renders settings heading after load', async () => {
        render(<SettingsPage />);
        await waitFor(() => {
            expect(screen.getByText('Settings')).toBeInTheDocument();
        });
    });

    test('renders Account section', async () => {
        render(<SettingsPage />);
        await waitFor(() => {
            expect(screen.getByText(/Account/)).toBeInTheDocument();
        });
    });

    test('displays user info', async () => {
        render(<SettingsPage />);
        await waitFor(() => {
            expect(screen.getByText('Shahar')).toBeInTheDocument();
            expect(screen.getByText('shahar@lunaos.ai')).toBeInTheDocument();
        });
    });

    test('shows API Connected when healthy', async () => {
        render(<SettingsPage />);
        await waitFor(() => {
            expect(screen.getByText('Connected')).toBeInTheDocument();
        });
    });

    test('shows API Unreachable when health check fails', async () => {
        (healthApi.check as jest.Mock).mockRejectedValue(new Error('timeout'));
        render(<SettingsPage />);
        await waitFor(() => {
            expect(screen.getByText('Unreachable')).toBeInTheDocument();
        });
    });

    test('renders CLI Setup section', async () => {
        render(<SettingsPage />);
        await waitFor(() => {
            expect(screen.getByText(/CLI Setup/)).toBeInTheDocument();
            expect(screen.getByText('luna init --cloud')).toBeInTheDocument();
        });
    });

    test('renders About Luna & Nippy section', async () => {
        render(<SettingsPage />);
        await waitFor(() => {
            expect(screen.getByText(/About Luna/)).toBeInTheDocument();
            expect(screen.getByText(/one-eyed cat adopted at 2 months old/)).toBeInTheDocument();
            expect(screen.getAllByText(/Nippy/).length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText(/Better Call Saul/)).toBeInTheDocument();
        });
    });

    test('handles missing user data', async () => {
        (authApi.me as jest.Mock).mockResolvedValue(null);
        render(<SettingsPage />);
        await waitFor(() => {
            expect(screen.getByText('Settings')).toBeInTheDocument();
        });
    });

    test('handles auth API error gracefully', async () => {
        (authApi.me as jest.Mock).mockRejectedValue(new Error('auth failed'));
        render(<SettingsPage />);
        // Should not crash - catch block handles the error
        await waitFor(() => {
            // After loading finishes, page renders (in finally block)
            expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
        });
    });

    test('displays health version and latency', async () => {
        render(<SettingsPage />);
        await waitFor(() => {
            expect(screen.getByText('Version')).toBeInTheDocument();
            expect(screen.getByText('1.0.0')).toBeInTheDocument();
            expect(screen.getByText('Latency')).toBeInTheDocument();
            expect(screen.getByText('42ms')).toBeInTheDocument();
        });
    });

    test('displays -- for missing version and latency', async () => {
        (healthApi.check as jest.Mock).mockResolvedValue({
            status: 'ok',
        });
        render(<SettingsPage />);
        await waitFor(() => {
            expect(screen.getByText('Connected')).toBeInTheDocument();
            expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(2);
        });
    });
});
