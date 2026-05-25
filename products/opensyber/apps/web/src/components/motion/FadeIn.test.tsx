/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FadeIn } from './FadeIn';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('FadeIn', () => {
  it('renders children', () => {
    render(<FadeIn><p>Hello</p></FadeIn>);
    expect(screen.getByText('Hello')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(<FadeIn className="custom-class"><p>Test</p></FadeIn>);
    expect(container.firstElementChild?.className).toContain('custom-class');
  });

  it('renders with different directions', () => {
    const directions = ['up', 'down', 'left', 'right', 'none'] as const;
    for (const dir of directions) {
      const { unmount } = render(<FadeIn direction={dir}><span>{dir}</span></FadeIn>);
      expect(screen.getByText(dir)).toBeDefined();
      unmount();
    }
  });
});
