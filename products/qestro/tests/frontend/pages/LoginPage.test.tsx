/**
 * LoginPage Component Tests
 * Comprehensive testing for the LoginPage component
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LoginPage from '../../../frontend/src/pages/LoginPage';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

// Mock auth store
vi.mock('../../../frontend/src/stores/authStore', () => ({
  useAuthStore: () => ({
    login: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('LoginPage Component', () => {
  const mockLogin = vi.fn();
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks
    vi.mocked(require('react-router-dom').useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
    });
  });

  describe('Rendering', () => {
    it('renders login page with all elements', () => {
      render(<LoginPage />);

      expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Remember me' })).toBeInTheDocument();
    });

    it('renders signup link', () => {
      render(<LoginPage />);

      const signupLink = screen.getByText('start your free trial');
      expect(signupLink).toBeInTheDocument();
      expect(signupLink.closest('a')).toHaveAttribute('href', '/signup');
    });

    it('renders password visibility toggle', () => {
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('renders with proper semantic structure', () => {
      render(<LoginPage />);

      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });

    it('renders with responsive design classes', () => {
      render(<LoginPage />);

      const container = screen.getByRole('main').parentElement;
      expect(container).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center');
    });

    it('renders with gradient background', () => {
      render(<LoginPage />);

      const container = screen.getByRole('main').parentElement;
      expect(container).toHaveClass('bg-gradient-to-br', 'from-indigo-50', 'via-white', 'to-purple-50');
    });
  });

  describe('Form Interaction', () => {
    it('allows user to type email', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      await user.type(emailInput, 'test@example.com');

      expect(emailInput).toHaveValue('test@example.com');
    });

    it('allows user to type password', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'password123');

      expect(passwordInput).toHaveValue('password123');
    });

    it('toggles password visibility', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText('Password');
      const toggleButton = screen.getByRole('button', { name: /show password/i });

      // Initially password should be hidden
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Click to show password
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');

      // Click to hide password
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('allows user to check remember me', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const rememberMeCheckbox = screen.getByRole('checkbox', { name: 'Remember me' });
      expect(rememberMeCheckbox).not.toBeChecked();

      await user.click(rememberMeCheckbox);
      expect(rememberMeCheckbox).toBeChecked();

      await user.click(rememberMeCheckbox);
      expect(rememberMeCheckbox).not.toBeChecked();
    });

    it('submits form with correct data', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(true);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('submits form on Enter key press in email field', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(true);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('handles form submission with remember me checked', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(true);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const rememberMeCheckbox = screen.getByRole('checkbox', { name: 'Remember me' });
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(rememberMeCheckbox);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });
  });

  describe('Form Validation', () => {
    it('shows email validation error for invalid email', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      });
    });

    it('shows password validation error for empty password', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });

    it('shows validation error for short password', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, '123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least/i)).toBeInTheDocument();
      });
    });

    it('clears validation errors when user starts typing', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      // Trigger validation error
      await user.type(emailInput, 'invalid');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      });

      // Start typing valid email
      await user.clear(emailInput);
      await user.type(emailInput, 'test@example.com');

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/invalid email/i)).not.toBeInTheDocument();
      });
    });

    it('prevents form submission with invalid data', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const submitButton = screen.getByRole('button', { name: 'Sign in' });
      await user.click(submitButton);

      // Should not call login with empty data
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('shows loading state during login', async () => {
      vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
      });

      render(<LoginPage />);

      const submitButton = screen.getByRole('button', { name: 'Sign in' });
      expect(submitButton).toBeDisabled();
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    it('disables form inputs during loading', () => {
      vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
      });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const rememberMeCheckbox = screen.getByRole('checkbox', { name: 'Remember me' });

      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(rememberMeCheckbox).toBeDisabled();
    });

    it('shows loading text on submit button', () => {
      vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
      });

      render(<LoginPage />);

      const submitButton = screen.getByRole('button', { name: 'Signing in...' });
      expect(submitButton).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('displays login error message', () => {
      vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Invalid email or password',
      });

      render(<LoginPage />);

      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
      expect(screen.getByTestId('error-icon')).toBeInTheDocument();
    });

    it('shows error with proper styling', () => {
      vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Invalid credentials',
      });

      render(<LoginPage />);

      const errorMessage = screen.getByText('Invalid credentials');
      expect(errorMessage).toHaveClass('text-red-600');
    });

    it('clears error when user starts typing', async () => {
      const user = userEvent.setup();
      vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Invalid credentials',
      });

      render(<LoginPage />);

      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();

      const emailInput = screen.getByLabelText('Email address');
      await user.type(emailInput, 'test@example.com');

      // Error should be cleared when user interacts with form
      expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
    });

    it('shows network error message', () => {
      vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Network error. Please try again.',
      });

      render(<LoginPage />);

      expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument();
    });

    it('handles multiple error types', () => {
      vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Account temporarily locked. Please try again later.',
      });

      render(<LoginPage />);

      expect(screen.getByText('Account temporarily locked. Please try again later.')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('navigates to dashboard on successful login', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(true);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('does not navigate on failed login', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(false);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'wrongpassword');
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });

    it('navigates to signup page when signup link is clicked', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const signupLink = screen.getByText('start your free trial');
      await user.click(signupLink);

      // Link should have correct href
      expect(signupLink.closest('a')).toHaveAttribute('href', '/signup');
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      render(<LoginPage />);

      expect(screen.getByRole('heading', { level: 2, name: 'Welcome back' })).toBeInTheDocument();
    });

    it('has proper form labels', () => {
      render(<LoginPage />);

      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Remember me')).toBeInTheDocument();
    });

    it('has proper button descriptions', () => {
      render(<LoginPage />);

      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.tab();
      expect(screen.getByLabelText('Email address')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Password')).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus();
    });

    it('announces form submission status', async () => {
      const user = userEvent.setup();
      vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
      });

      render(<LoginPage />);

      const submitButton = screen.getByRole('button', { name: 'Signing in...' });
      expect(submitButton).toHaveAttribute('aria-busy', 'true');
    });

    it('announces error messages to screen readers', () => {
      vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Login failed',
      });

      render(<LoginPage />);

      const errorMessage = screen.getByText('Login failed');
      expect(errorMessage).toHaveRole('alert');
    });

    it('has proper focus management', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      await user.click(emailInput);
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Password')).toHaveFocus();
    });
  });

  describe('Form State Management', () => {
    it('maintains form state during re-renders', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');

      // Re-render component
      rerender(<LoginPage />);

      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });

    it('resets form after successful submission', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(true);

      const { rerender } = render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });

      // After navigation, form might be reset
      rerender(<LoginPage />);

      expect(emailInput).toHaveValue('');
      expect(passwordInput).toHaveValue('');
    });

    it('preserves form state when validation errors occur', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });

      // Email should be preserved
      expect(emailInput).toHaveValue('test@example.com');
    });
  });

  describe('Security Features', () => {
    it('prevents password autofill in insecure contexts', () => {
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    });

    it('has proper input types', () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('disables form during submission to prevent double submission', async () => {
      const user = userEvent.setup();
      vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
      });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');

      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
    });
  });

  describe('Responsive Design', () => {
    it('adapts to mobile screen sizes', () => {
      render(<LoginPage />);

      const container = screen.getByRole('main').parentElement;
      expect(container).toHaveClass('px-4', 'sm:px-6', 'lg:px-8');
    });

    it('maintains proper layout on different screen sizes', () => {
      render(<LoginPage />);

      const formContainer = screen.getByRole('form');
      expect(formContainer).toBeInTheDocument();

      // Should be centered and responsive
      const mainContainer = screen.getByRole('main').parentElement;
      expect(mainContainer).toHaveClass('flex', 'items-center', 'justify-center');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty form submission gracefully', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const submitButton = screen.getByRole('button', { name: 'Sign in' });
      await user.click(submitButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });

    it('handles very long email addresses', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const longEmail = 'very.long.email.address.that.exceeds.normal.length.limit@example.com';

      await user.type(emailInput, longEmail);
      expect(emailInput).toHaveValue(longEmail);
    });

    it('handles very long passwords', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText('Password');
      const longPassword = 'A'.repeat(200);

      await user.type(passwordInput, longPassword);
      expect(passwordInput).toHaveValue(longPassword);
    });

    it('handles special characters in email', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const emailWithSpecialChars = 'test+tag@example-domain.co.uk';

      await user.type(emailInput, emailWithSpecialChars);
      expect(emailInput).toHaveValue(emailWithSpecialChars);
    });

    it('handles rapid form submissions', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(true);

      render(<LoginPage />);

      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      // Click multiple times rapidly
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      await waitFor(() => {
        // Should only call login once due to loading state
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });
    });

    it('handles component unmounting during loading', () => {
      vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
      });

      const { unmount } = render(<LoginPage />);

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Integration', () => {
    it('integrates with auth store correctly', async () => {
      const user = userEvent.setup();
      const mockLoginImplementation = vi.fn().mockResolvedValue(true);

      vi.mocked(require('../../../frontend/src/stores/authStore').useAuthStore).mockReturnValue({
        login: mockLoginImplementation,
        isLoading: false,
        error: null,
      });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLoginImplementation).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('integrates with react-router correctly', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(true);

      render(<LoginPage />);

      const signupLink = screen.getByText('start your free trial');
      expect(signupLink.closest('a')).toHaveAttribute('href', '/signup');
    });

    it('handles navigation redirect after login', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(true);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });
  });
});