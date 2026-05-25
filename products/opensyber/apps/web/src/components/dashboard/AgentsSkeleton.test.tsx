import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentsSkeleton } from './AgentsSkeleton';

describe('AgentsSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<AgentsSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders skeleton pulse elements', () => {
    const { container } = render(<AgentsSkeleton />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders a stat grid with 6 items', () => {
    const { container } = render(<AgentsSkeleton />);
    // The grid of 6 stat cards
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.children.length).toBe(6);
  });

  it('renders risk distribution section', () => {
    const { container } = render(<AgentsSkeleton />);
    // Should have multiple skeleton card wrappers
    const cards = container.querySelectorAll('.rounded.border');
    expect(cards.length).toBeGreaterThan(0);
  });
});
