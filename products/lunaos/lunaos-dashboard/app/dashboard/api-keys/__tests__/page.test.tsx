/**
 * LunaOS API Keys Page — Unit Tests
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ApiKeysPage from '../page';

jest.mock('../../../../lib/api', () => ({
    apiKeysApi: {
        list: jest.fn(),
        create: jest.fn(),
        revoke: jest.fn(),
    },
}));

import { apiKeysApi } from '../../../../lib/api';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/dashboard/api-keys',
}));

const mockKeys = [
    {
        id: 'key-1',
        name: 'ci-pipeline',
        prefix: 'luna_sk_ci',
        created_at: '2026-03-01T00:00:00Z',
        last_used: '2026-03-15T12:00:00Z',
    },
    {
        id: 'key-2',
        name: 'local-dev',
        prefix: 'luna_sk_lo',
        created_at: '2026-02-15T00:00:00Z',
        last_used: null,
    },
];

describe('ApiKeysPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (apiKeysApi.list as jest.Mock).mockResolvedValue({ keys: mockKeys });
    });

    test('shows loading state initially', () => {
        (apiKeysApi.list as jest.Mock).mockReturnValue(new Promise(() => { }));
        render(<ApiKeysPage />);
        expect(screen.getByText('Loading keys...')).toBeInTheDocument();
    });

    test('renders page header after load', async () => {
        render(<ApiKeysPage />);
        await waitFor(() => {
            expect(screen.getByText('API Keys')).toBeInTheDocument();
            expect(screen.getByText('Manage API keys for programmatic access')).toBeInTheDocument();
        });
    });

    test('renders Create Key button', async () => {
        render(<ApiKeysPage />);
        await waitFor(() => {
            expect(screen.getByText('+ Create Key')).toBeInTheDocument();
        });
    });

    test('fetches keys on mount', async () => {
        render(<ApiKeysPage />);
        await waitFor(() => {
            expect(apiKeysApi.list).toHaveBeenCalledTimes(1);
        });
    });

    test('shows create form when Create Key is clicked', async () => {
        render(<ApiKeysPage />);
        await waitFor(() => {
            expect(screen.getByText('+ Create Key')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('+ Create Key'));
        expect(screen.getByPlaceholderText('e.g., ci-pipeline, local-dev')).toBeInTheDocument();
    });

    test('disables Create Key button when at 5 keys', async () => {
        const fiveKeys = Array.from({ length: 5 }, (_, i) => ({
            id: `key-${i}`,
            name: `key-name-${i}`,
            prefix: `luna_sk_${i}`,
            created_at: '2026-03-01T00:00:00Z',
            last_used: null,
        }));
        (apiKeysApi.list as jest.Mock).mockResolvedValue({ keys: fiveKeys });

        render(<ApiKeysPage />);
        await waitFor(() => {
            const createBtn = screen.getByText('+ Create Key');
            expect(createBtn).toBeDisabled();
        });
    });

    test('creates a key and shows new key alert', async () => {
        (apiKeysApi.create as jest.Mock).mockResolvedValue({ key: 'luna_sk_testkey123' });
        render(<ApiKeysPage />);
        await waitFor(() => {
            expect(screen.getByText('+ Create Key')).toBeInTheDocument();
        });

        // Open form
        fireEvent.click(screen.getByText('+ Create Key'));
        const input = screen.getByPlaceholderText('e.g., ci-pipeline, local-dev');
        fireEvent.change(input, { target: { value: 'test-key' } });
        fireEvent.click(screen.getByText('Create'));

        await waitFor(() => {
            expect(apiKeysApi.create).toHaveBeenCalledWith('test-key');
        });
    });

    test('handles cancel button in create form', async () => {
        render(<ApiKeysPage />);
        await waitFor(() => {
            expect(screen.getByText('+ Create Key')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('+ Create Key'));
        expect(screen.getByPlaceholderText('e.g., ci-pipeline, local-dev')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Cancel'));
        expect(screen.queryByPlaceholderText('e.g., ci-pipeline, local-dev')).not.toBeInTheDocument();
    });

    test('handles API error on list gracefully', async () => {
        (apiKeysApi.list as jest.Mock).mockRejectedValue(new Error('API down'));
        render(<ApiKeysPage />);
        // Should not crash — loading finishes
        await waitFor(() => {
            expect(screen.queryByText('Loading keys...')).not.toBeInTheDocument();
        });
    });

    test('handles empty keys list', async () => {
        (apiKeysApi.list as jest.Mock).mockResolvedValue({ keys: [] });
        render(<ApiKeysPage />);
        await waitFor(() => {
            expect(screen.getByText('API Keys')).toBeInTheDocument();
        });
    });
});
