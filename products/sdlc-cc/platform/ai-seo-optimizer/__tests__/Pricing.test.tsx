import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Pricing from '../components/Pricing';

describe('Pricing', () => {
  it('renders the section heading', () => {
    render(<Pricing />);
    expect(screen.getByText('Simple, transparent pricing')).toBeInTheDocument();
  });

  it('renders all three plan names', () => {
    render(<Pricing />);
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('renders the free price', () => {
    render(<Pricing />);
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('renders the growth price', () => {
    render(<Pricing />);
    expect(screen.getByText('$79')).toBeInTheDocument();
  });

  it('highlights the growth plan', () => {
    render(<Pricing />);
    expect(screen.getByText('Most Popular')).toBeInTheDocument();
  });

  it('renders CTA buttons for each plan', () => {
    render(<Pricing />);
    expect(screen.getByText('Start Free')).toBeInTheDocument();
    expect(screen.getByText('Join Waitlist')).toBeInTheDocument();
    expect(screen.getByText('Contact Sales')).toBeInTheDocument();
  });
});
