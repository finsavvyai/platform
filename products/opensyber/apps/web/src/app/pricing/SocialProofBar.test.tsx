/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SocialProofBar } from './SocialProofBar';

describe('SocialProofBar', () => {
  it('renders developer count', () => {
    render(<SocialProofBar />);
    expect(screen.getByText('2,400+')).toBeDefined();
  });

  it('renders G2 rating', () => {
    render(<SocialProofBar />);
    expect(screen.getByText('4.9 / 5')).toBeDefined();
  });

  it('renders SOC 2 badge', () => {
    render(<SocialProofBar />);
    expect(screen.getByText('SOC 2 Type II')).toBeDefined();
  });

  it('renders Product Hunt badge', () => {
    render(<SocialProofBar />);
    expect(screen.getByText(/Product Hunt/)).toBeDefined();
  });

  it('renders four proof items', () => {
    render(<SocialProofBar />);
    expect(screen.getAllByTestId('proof-item')).toHaveLength(4);
  });

  it('has accessible region label', () => {
    render(<SocialProofBar />);
    const region = screen.getByRole('region', { name: /social proof/i });
    expect(region).toBeDefined();
  });
});
