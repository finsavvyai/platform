import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ViolationsSkeleton } from './ViolationsSkeleton';

describe('ViolationsSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<ViolationsSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders skeleton pulse elements', () => {
    const { container } = render(<ViolationsSkeleton />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders filter skeletons', () => {
    const { container } = render(<ViolationsSkeleton />);
    // The filter row has 3 skeleton items in a flex container
    const filterRow = container.querySelector('.flex.flex-wrap');
    expect(filterRow).toBeTruthy();
    expect(filterRow!.children.length).toBe(3);
  });

  it('renders 6 violation card skeletons', () => {
    const { container } = render(<ViolationsSkeleton />);
    const list = container.querySelector('.space-y-4');
    expect(list).toBeTruthy();
    expect(list!.children.length).toBe(6);
  });
});
