import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TeamUserSkeleton } from './TeamUserSkeleton';

describe('TeamUserSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<TeamUserSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders skeleton pulse elements', () => {
    const { container } = render(<TeamUserSkeleton />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders stats grid with 4 items', () => {
    const { container } = render(<TeamUserSkeleton />);
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.children.length).toBe(4);
  });

  it('renders activity rows', () => {
    const { container } = render(<TeamUserSkeleton />);
    const activityRows = container.querySelectorAll('.border-b');
    expect(activityRows.length).toBe(5);
  });
});
