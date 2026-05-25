import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock next-auth before importing component
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: {},
    push: vi.fn(),
  }),
}));

import SignInPage from '../pages/auth/signin';
import { signIn } from 'next-auth/react';

describe('SignIn Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading', () => {
    render(<SignInPage />);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('renders social auth buttons', () => {
    render(<SignInPage />);
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument();
    expect(screen.getByText('Continue with Apple')).toBeInTheDocument();
  });

  it('renders email and password fields', () => {
    render(<SignInPage />);
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
  });

  it('renders sign in button', () => {
    render(<SignInPage />);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('shows error on empty submit', () => {
    render(<SignInPage />);
    fireEvent.click(screen.getByText('Sign in'));
    expect(screen.getByText('Please fill in all fields.')).toBeInTheDocument();
  });

  it('renders link to sign up', () => {
    render(<SignInPage />);
    expect(screen.getByText('Sign up')).toBeInTheDocument();
  });

  it('calls signIn on Google button click', () => {
    render(<SignInPage />);
    fireEvent.click(screen.getByText('Continue with Google'));
    expect(signIn).toHaveBeenCalledWith('google', expect.any(Object));
  });

  it('calls signIn on GitHub button click', () => {
    render(<SignInPage />);
    fireEvent.click(screen.getByText('Continue with GitHub'));
    expect(signIn).toHaveBeenCalledWith('github', expect.any(Object));
  });

  it('toggles password visibility', () => {
    render(<SignInPage />);
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByLabelText('Show password'));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByLabelText('Hide password'));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('renders forgot password link', () => {
    render(<SignInPage />);
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
  });
});
