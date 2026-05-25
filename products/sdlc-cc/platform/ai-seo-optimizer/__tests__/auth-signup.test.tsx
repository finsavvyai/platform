import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

import SignUpPage from '../pages/auth/signup';

describe('SignUp Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading', () => {
    render(<SignUpPage />);
    expect(screen.getByText('Create your account')).toBeInTheDocument();
  });

  it('renders social auth buttons', () => {
    render(<SignUpPage />);
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument();
    expect(screen.getByText('Continue with Apple')).toBeInTheDocument();
  });

  it('renders name, email, and password fields', () => {
    render(<SignUpPage />);
    expect(screen.getByPlaceholderText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Min. 8 characters')).toBeInTheDocument();
  });

  it('shows error on empty submit', () => {
    render(<SignUpPage />);
    fireEvent.click(screen.getByText('Create account'));
    expect(screen.getByText('Please fill in all fields.')).toBeInTheDocument();
  });

  it('shows error for short password', () => {
    render(<SignUpPage />);
    fireEvent.change(screen.getByPlaceholderText('Jane Smith'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min. 8 characters'), { target: { value: 'short' } });
    fireEvent.click(screen.getByText('Create account'));
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
  });

  it('shows password strength indicator', () => {
    render(<SignUpPage />);
    fireEvent.change(screen.getByPlaceholderText('Min. 8 characters'), { target: { value: 'Abcd1234!' } });
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('renders link to sign in', () => {
    render(<SignUpPage />);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('renders terms notice', () => {
    render(<SignUpPage />);
    expect(screen.getByText(/Terms of Service/)).toBeInTheDocument();
  });
});
