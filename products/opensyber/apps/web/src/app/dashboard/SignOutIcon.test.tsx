/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignOutIcon } from './SignOutIcon';

const mockSignOut = vi.fn();

vi.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

describe('SignOutIcon', () => {
  it('renders a button with sign out label', () => {
    render(<SignOutIcon />);
    expect(screen.getByLabelText('Sign out')).toBeDefined();
  });

  it('renders with title attribute', () => {
    render(<SignOutIcon />);
    expect(screen.getByTitle('Sign out')).toBeDefined();
  });

  it('calls signOut with callbackUrl on click', () => {
    render(<SignOutIcon />);
    fireEvent.click(screen.getByLabelText('Sign out'));
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
  });
});
