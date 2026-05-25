/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CountUp } from './CountUp';

vi.mock('framer-motion', () => ({
  useInView: () => false,
}));

describe('CountUp', () => {
  it('renders without crashing', () => {
    const { container } = render(<CountUp end={100} />);
    const span = container.querySelector('span');
    expect(span).toBeDefined();
  });

  it('renders prefix and suffix', () => {
    const { container } = render(<CountUp end={50} prefix="$" suffix="+" />);
    expect(container.textContent).toContain('$');
    expect(container.textContent).toContain('+');
  });

  it('applies custom className', () => {
    const { container } = render(<CountUp end={100} className="text-xl" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-xl');
  });

  it('starts at 0 when not in view', () => {
    const { container } = render(<CountUp end={100} />);
    expect(container.textContent).toContain('0');
  });

  it('handles decimal places', () => {
    const { container } = render(<CountUp end={99.5} decimals={1} />);
    expect(container.textContent).toContain('0.0');
  });
});
