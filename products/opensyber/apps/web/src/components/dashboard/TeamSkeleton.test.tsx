import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TeamSkeleton } from './TeamSkeleton';

describe('TeamSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<TeamSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders skeleton pulse elements', () => {
    const { container } = render(<TeamSkeleton />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders stats grid with 6 items', () => {
    const { container } = render(<TeamSkeleton />);
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.children.length).toBe(6);
  });

  it('renders a members table skeleton with headers and rows', () => {
    const { container } = render(<TeamSkeleton />);
    const table = container.querySelector('table');
    expect(table).toBeTruthy();
    const headerCells = table!.querySelectorAll('th');
    expect(headerCells.length).toBe(5);
    const bodyRows = table!.querySelectorAll('tbody tr');
    expect(bodyRows.length).toBe(3);
  });
});
