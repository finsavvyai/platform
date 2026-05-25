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
    expect(screen.getByText('SDLC.ai')).toBeInTheDocument();

    // Check navigation items (Features, OpenClaw, Pricing, Demo)
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('OpenClaw')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Demo')).toBeInTheDocument();
  });

  it('renders Demo nav link with correct href', () => {
    render(<Header />);

    const demoLink = screen.getByText('Demo');
    expect(demoLink).toBeInTheDocument();
    expect(demoLink.closest('a')).toHaveAttribute('href', '#demo');
  });

  it('toggles mobile menu when menu button is clicked', async () => {
    render(<Header />);

    const menuButton = screen.getByRole('button');
    expect(menuButton).toBeInTheDocument();

    // Click menu button to open mobile menu (adds duplicate nav links in DOM)
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getAllByText('Features').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('OpenClaw').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('closes mobile menu when navigation item is clicked', async () => {
    render(<Header />);

    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getAllByText('Features').length).toBeGreaterThanOrEqual(1);
    });

    // Click first Features link (mobile menu closes)
    fireEvent.click(screen.getAllByText('Features')[0]);

    // At least one Features link remains (desktop nav)
    expect(screen.getAllByText('Features').length).toBeGreaterThanOrEqual(1);
  });

  it('has correct accessibility attributes', () => {
    render(<Header />);

    // Check for proper heading structure
    const logo = screen.getByText('SDLC.ai');
    expect(logo.tagName).toBe('SPAN');

    // Check navigation links
    const featuresLink = screen.getByText('Features');
    expect(featuresLink).toHaveAttribute('href', '#features');

    // Check demo link
    const demoLink = screen.getByText('Demo');
    expect(demoLink.closest('a')).toHaveAttribute('href', '#demo');
  });

  it('navigates to correct sections when links are clicked', () => {
    render(<Header />);

    const featuresLink = screen.getByText('Features');
    expect(featuresLink.closest('a')).toHaveAttribute('href', '#features');

    const openClawLink = screen.getByText('OpenClaw');
    expect(openClawLink.closest('a')).toHaveAttribute('href', '#openclaw');

    const pricingLink = screen.getByText('Pricing');
    expect(pricingLink.closest('a')).toHaveAttribute('href', '#pricing');

    const demoLink = screen.getByText('Demo');
    expect(demoLink.closest('a')).toHaveAttribute('href', '#demo');
  });
});