/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkillGrid, SkillCard } from './SkillGrid';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...rest }: any) => (
      <div className={className} data-testid="motion-div">
        {children}
      </div>
    ),
  },
}));

describe('SkillGrid', () => {
  it('renders children in a grid container', () => {
    render(
      <SkillGrid>
        <div>Skill 1</div>
        <div>Skill 2</div>
      </SkillGrid>,
    );

    expect(screen.getByText('Skill 1')).toBeDefined();
    expect(screen.getByText('Skill 2')).toBeDefined();
  });

  it('has responsive grid classes', () => {
    const { container } = render(
      <SkillGrid>
        <div>Content</div>
      </SkillGrid>,
    );

    const grid = container.querySelector('[data-testid="motion-div"]');
    expect(grid?.className).toContain('grid');
    expect(grid?.className).toContain('md:grid-cols-2');
    expect(grid?.className).toContain('lg:grid-cols-3');
  });
});

describe('SkillCard', () => {
  it('renders children in a card wrapper', () => {
    render(
      <SkillCard>
        <p>Card content</p>
      </SkillCard>,
    );

    expect(screen.getByText('Card content')).toBeDefined();
  });

  it('has rounded border styling', () => {
    const { container } = render(
      <SkillCard>
        <p>Styled card</p>
      </SkillCard>,
    );

    const card = container.querySelector('[data-testid="motion-div"]');
    expect(card?.className).toContain('rounded');
    expect(card?.className).toContain('border');
  });
});
