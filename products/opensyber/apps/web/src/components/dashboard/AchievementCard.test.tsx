/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AchievementCard } from './AchievementCard';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { initial, animate, transition, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
  },
}));

const baseProps = {
  slug: 'first-scan',
  title: 'First Scan',
  description: 'Run your first security scan',
  icon: 'shield',
  category: 'defense',
  instanceId: 'inst_123',
};

describe('AchievementCard', () => {
  it('renders title and description', () => {
    render(<AchievementCard {...baseProps} earned />);
    expect(screen.getByText('First Scan')).toBeDefined();
    expect(screen.getByText('Run your first security scan')).toBeDefined();
  });

  it('renders category label', () => {
    render(<AchievementCard {...baseProps} earned />);
    expect(screen.getByText('defense')).toBeDefined();
  });

  it('shows Share link when earned', () => {
    render(<AchievementCard {...baseProps} earned />);
    const link = screen.getByText('Share');
    expect(link).toBeDefined();
    expect(link.closest('a')?.getAttribute('href')).toBe(
      '/achievements/inst_123/first-scan',
    );
  });

  it('hides Share link when not earned', () => {
    render(<AchievementCard {...baseProps} earned={false} />);
    expect(screen.queryByText('Share')).toBeNull();
  });

  it('shows lock overlay when not earned', () => {
    const { container } = render(
      <AchievementCard {...baseProps} earned={false} />,
    );
    // Lock icon renders inside the overlay div
    const lockOverlay = container.querySelector('.absolute');
    expect(lockOverlay).toBeDefined();
  });

  it('applies grayscale class when not earned', () => {
    const { container } = render(
      <AchievementCard {...baseProps} earned={false} />,
    );
    expect(container.querySelector('.grayscale')).toBeTruthy();
  });

  it('does not apply grayscale when earned', () => {
    const { container } = render(
      <AchievementCard {...baseProps} earned />,
    );
    expect(container.querySelector('.grayscale')).toBeNull();
  });
});
