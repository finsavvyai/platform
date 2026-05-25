/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { NavigationProgress } from './NavigationProgress';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

describe('NavigationProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows progress bar immediately after render', () => {
    const { container } = render(<NavigationProgress />);
    expect(container.querySelector('.bg-info')).toBeDefined();
    expect(container.querySelector('.bg-info')).not.toBeNull();
  });

  it('hides progress bar after timeout', () => {
    const { container } = render(<NavigationProgress />);
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(container.querySelector('.bg-info')).toBeNull();
  });

  it('renders with fixed positioning', () => {
    const { container } = render(<NavigationProgress />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain('fixed');
  });
});
