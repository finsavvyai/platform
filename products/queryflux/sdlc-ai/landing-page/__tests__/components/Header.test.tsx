import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Header from '../../components/Header';

// Mock next/router for navigation testing
vi.mock('next/router', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      pathname: '/',
    };
  },
}));

describe('Header Component', () => {
  it('renders logo and navigation items', () => {
    render(<Header />);

    // Check logo
    expect(screen.getByText('OpenSyber')).toBeInTheDocument();

    // Check navigation items
    expect(screen.getByText('Model Coverage')).toBeInTheDocument();
    expect(screen.getByText('Runtime Control Flow')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Trust Signals')).toBeInTheDocument();
  });

  it('renders demo button', () => {
    render(<Header />);

    const demoButton = screen.getByText('Start Secure Pilot');
    expect(demoButton).toBeInTheDocument();
    expect(demoButton.closest('a')).toHaveAttribute('href', '#demo');
  });

  it('toggles mobile menu when menu button is clicked', async () => {
    render(<Header />);

    // Find mobile menu button (hidden on desktop)
    const menuButton = screen.getByRole('button', { hidden: true });
    expect(menuButton).toBeInTheDocument();

    // Menu should be closed initially
    expect(screen.queryByText('Model Coverage')).not.toBeVisible();

    // Click menu button to open
    fireEvent.click(menuButton);

    // Wait for mobile menu to appear
    await waitFor(() => {
      expect(screen.getByText('Model Coverage')).toBeVisible();
      expect(screen.getByText('Runtime Control Flow')).toBeVisible();
      expect(screen.getByText('Pricing')).toBeVisible();
      expect(screen.getByText('Trust Signals')).toBeVisible();
    });
  });

  it('closes mobile menu when navigation item is clicked', async () => {
    render(<Header />);

    // Open mobile menu
    const menuButton = screen.getByRole('button', { hidden: true });
    fireEvent.click(menuButton);

    // Wait for menu to open
    await waitFor(() => {
      expect(screen.getByText('Model Coverage')).toBeVisible();
    });

    // Click a navigation item
    fireEvent.click(screen.getByText('Model Coverage'));

    // Menu should close (item no longer visible)
    await waitFor(() => {
      expect(screen.queryByText('Model Coverage')).not.toBeVisible();
    });
  });

  it('has correct accessibility attributes', () => {
    render(<Header />);

    // Check for proper heading structure
    const logo = screen.getByText('OpenSyber');
    expect(logo.tagName).toBe('SPAN');

    // Check navigation links
    const modelCoverageLink = screen.getByText('Model Coverage');
    expect(modelCoverageLink).toHaveAttribute('href', '#security');

    // Check demo button
    const demoButton = screen.getByText('Start Secure Pilot');
    expect(demoButton.closest('a')).toHaveAttribute('href', '#demo');
  });

  it('navigates to correct sections when links are clicked', () => {
    render(<Header />);

    const modelCoverageLink = screen.getByText('Model Coverage');
    expect(modelCoverageLink.closest('a')).toHaveAttribute('href', '#security');

    const runtimeControlFlowLink = screen.getByText('Runtime Control Flow');
    expect(runtimeControlFlowLink.closest('a')).toHaveAttribute('href', '#features');

    const pricingLink = screen.getByText('Pricing');
    expect(pricingLink.closest('a')).toHaveAttribute('href', '#pricing');

    const demoLink = screen.getByText('Trust Signals');
    expect(demoLink.closest('a')).toHaveAttribute('href', '#demo');
  });
});
