/**
 * LunaOS Signup Page — Unit Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignupPage from '../page';

jest.mock('../../../../lib/api', () => ({
    authApi: {
        signup: jest.fn(),
    },
}));

import { authApi } from '../../../../lib/api';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}));

describe('SignupPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders signup form with LunaOS branding', () => {
        render(<SignupPage />);
        expect(screen.getByText(/LunaOS/)).toBeInTheDocument();
        expect(screen.getByText('Create your account')).toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    test('renders login link', () => {
        render(<SignupPage />);
        const link = screen.getByText('Sign In');
        expect(link).toBeInTheDocument();
        expect(link.closest('a')).toHaveAttribute('href', '/auth/login');
    });

    test('renders Luna story tagline', () => {
        render(<SignupPage />);
        expect(screen.getByText(/one-eyed cat who watches the cursor/)).toBeInTheDocument();
    });

    test('submits signup form successfully', async () => {
        (authApi.signup as jest.Mock).mockResolvedValueOnce({
            ok: true,
            data: { token: 'new-token' },
        });

        render(<SignupPage />);

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Luna User' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@luna.ai' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secure12345' } });
        fireEvent.click(screen.getByRole('button', { name: /create account/i }));

        await waitFor(() => {
            expect(authApi.signup).toHaveBeenCalledWith('new@luna.ai', 'secure12345', 'Luna User');
            expect(mockPush).toHaveBeenCalledWith('/dashboard');
        });
    });

    test('shows error on failed signup', async () => {
        (authApi.signup as jest.Mock).mockResolvedValueOnce({
            ok: false,
            data: { error: 'Email already exists' },
        });

        render(<SignupPage />);

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'exists@luna.ai' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass1234567' } });
        fireEvent.click(screen.getByRole('button', { name: /create account/i }));

        await waitFor(() => {
            expect(screen.getByText('Email already exists')).toBeInTheDocument();
        });
    });

    test('shows default error when no error message in response', async () => {
        (authApi.signup as jest.Mock).mockResolvedValueOnce({
            ok: false,
            data: {},
        });

        render(<SignupPage />);

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@x.com' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
        fireEvent.click(screen.getByRole('button', { name: /create account/i }));

        await waitFor(() => {
            expect(screen.getByText('Sign up failed')).toBeInTheDocument();
        });
    });

    test('shows network error on exception', async () => {
        (authApi.signup as jest.Mock).mockRejectedValueOnce(new Error('Network fail'));

        render(<SignupPage />);

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@luna.ai' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
        fireEvent.click(screen.getByRole('button', { name: /create account/i }));

        await waitFor(() => {
            expect(screen.getByText(/Network error/i)).toBeInTheDocument();
        });
    });

    test('password field has minimum length requirement', () => {
        render(<SignupPage />);
        const passwordInput = screen.getByLabelText('Password');
        expect(passwordInput).toHaveAttribute('minLength', '8');
    });

    test('name field has autofocus', () => {
        render(<SignupPage />);
        const nameInput = screen.getByLabelText('Name');
        // React autoFocus sets focus via JS, not the HTML attribute
        expect(document.activeElement).toBe(nameInput);
    });

    test('all fields are required', () => {
        render(<SignupPage />);
        expect(screen.getByLabelText('Name')).toBeRequired();
        expect(screen.getByLabelText('Email')).toBeRequired();
        expect(screen.getByLabelText('Password')).toBeRequired();
    });
});
