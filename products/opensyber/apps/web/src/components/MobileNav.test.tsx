/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileNav } from './MobileNav';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('MobileNav', () => {
  it('renders hamburger button', () => {
    render(<MobileNav isSignedIn={false} />);
    expect(screen.getByLabelText('Open menu')).toBeDefined();
  });

  it('opens drawer and shows nav links on click', () => {
    render(<MobileNav isSignedIn={false} />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    expect(screen.getByText('Pricing')).toBeDefined();
    expect(screen.getByText('Skills')).toBeDefined();
    expect(screen.getByText('Docs')).toBeDefined();
    expect(screen.getByText('Blog')).toBeDefined();
    expect(screen.getByText('Demo')).toBeDefined();
    expect(screen.getByText('Threat Intel')).toBeDefined();
  });

  it('shows Sign In when not signed in', () => {
    render(<MobileNav isSignedIn={false} />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    const signInLink = screen.getByText('Sign In');
    expect(signInLink.closest('a')?.getAttribute('href')).toBe('/sign-in');
  });

  it('shows Go to Dashboard when signed in', () => {
    render(<MobileNav isSignedIn={true} />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    const dashLink = screen.getByText('Go to Dashboard');
    expect(dashLink.closest('a')?.getAttribute('href')).toBe('/dashboard');
  });

  it('closes on close button click', () => {
    render(<MobileNav isSignedIn={false} />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    fireEvent.click(screen.getByLabelText('Close menu'));
    // Drawer should be translated off-screen
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('translate-x-full');
  });
});
