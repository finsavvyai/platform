/**
 * LunaOS Login Page — Unit Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../page';

jest.mock('../../../../lib/api', () => ({
    authApi: {
        login: jest.fn(),
        isAuthenticated: jest.fn(() => false),
    },
}));

import { authApi } from '../../../../lib/api';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}));

describe('LoginPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders login form with LunaOS branding', () => {
        render(<LoginPage />);
        expect(screen.getByText(/LunaOS/)).toBeInTheDocument();
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    test('renders signup link', () => {
        render(<LoginPage />);
        const link = screen.getByText('Sign Up');
        expect(link).toBeInTheDocument();
        expect(link.closest('a')).toHaveAttribute('href', '/auth/signup');
    });

    test('submits login form successfully', async () => {
        (authApi.login as jest.Mock).mockResolvedValueOnce({
            ok: true,
            data: { token: 'test-token' },
        });

        render(<LoginPage />);

        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@luna.ai' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(authApi.login).toHaveBeenCalledWith('test@luna.ai', 'password123');
            expect(mockPush).toHaveBeenCalledWith('/dashboard');
        });
    });

    test('shows error message on failed login', async () => {
        (authApi.login as jest.Mock).mockResolvedValueOnce({
            ok: false,
            data: { error: 'Invalid credentials' },
        });

        render(<LoginPage />);

        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad@luna.ai' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(screen.getByText(/Invalid credentials/)).toBeInTheDocument();
        });
    });

    test('shows default error when no error message in response', async () => {
        (authApi.login as jest.Mock).mockResolvedValueOnce({
            ok: false,
            data: {},
        });

        render(<LoginPage />);

        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad@luna.ai' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
        });
    });

    test('shows network error on fetch failure', async () => {
        (authApi.login as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        render(<LoginPage />);

        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@luna.ai' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(screen.getByText(/Network error/i)).toBeInTheDocument();
        });
    });

    test('shows loading state during submission', async () => {
        let resolveLogin: (value: unknown) => void;
        (authApi.login as jest.Mock).mockReturnValueOnce(
            new Promise((resolve) => { resolveLogin = resolve; })
        );

        render(<LoginPage />);

        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@luna.ai' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(screen.getByText('Signing in...')).toBeInTheDocument();
        });

        resolveLogin!({ ok: true, data: { token: 'tok' } });
    });

    test('includes CLI hint', () => {
        render(<LoginPage />);
        expect(screen.getByText(/luna init --cloud/)).toBeInTheDocument();
    });

    test('email and password inputs are required', () => {
        render(<LoginPage />);
        expect(screen.getByLabelText('Email')).toBeRequired();
        expect(screen.getByLabelText('Password')).toBeRequired();
    });
});
