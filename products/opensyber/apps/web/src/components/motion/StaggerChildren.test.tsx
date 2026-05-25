/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaggerChildren, StaggerItem } from './StaggerChildren';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
}));

describe('StaggerChildren', () => {
  it('renders children', () => {
    render(
      <StaggerChildren>
        <div>Item 1</div>
        <div>Item 2</div>
      </StaggerChildren>,
    );
    expect(screen.getByText('Item 1')).toBeDefined();
    expect(screen.getByText('Item 2')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(
      <StaggerChildren className="my-class"><div>Child</div></StaggerChildren>,
    );
    expect(container.firstElementChild?.className).toContain('my-class');
  });
});

describe('StaggerItem', () => {
  it('renders children', () => {
    render(<StaggerItem><span>Content</span></StaggerItem>);
    expect(screen.getByText('Content')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(
      <StaggerItem className="item-class"><span>Styled</span></StaggerItem>,
    );
    expect(container.firstElementChild?.className).toContain('item-class');
  });
});
