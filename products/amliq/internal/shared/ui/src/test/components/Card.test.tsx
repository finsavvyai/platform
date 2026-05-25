/**
 * Card component tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, StatsCard } from '../../components/ui/Card';

describe('Card Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Card', () => {
    it('renders with default props', () => {
      render(
        <Card>
          <div>Card content</div>
        </Card>
      );

      const card = screen.getByText('Card content').parentElement;
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('rounded-2xl');
    });

    it('renders with different variants', () => {
      const variants = ['default', 'glass', 'elevated', 'flat', 'outline', 'gradient', 'interactive'] as const;

      variants.forEach(variant => {
        const { unmount } = render(
          <Card variant={variant}>
            <div>Test {variant}</div>
          </Card>
        );
        expect(screen.getByText(`Test ${variant}`)).toBeInTheDocument();
        unmount();
      });
    });

    it('renders with different sizes', () => {
      const sizes = ['sm', 'md', 'lg', 'xl'] as const;

      sizes.forEach(size => {
        const { unmount } = render(
          <Card size={size}>
            <div>Size {size}</div>
          </Card>
        );
        expect(screen.getByText(`Size ${size}`)).toBeInTheDocument();
        unmount();
      });
    });

    it('applies custom className', () => {
      render(
        <Card className="custom-card">
          <div>Content</div>
        </Card>
      );

      const card = screen.getByText('Content').parentElement;
      expect(card).toHaveClass('custom-card');
    });

    it('shows loading state', () => {
      render(
        <Card loading>
          <div>Loading content</div>
        </Card>
      );

      const card = screen.getByText('Loading content').parentElement;
      expect(card).toHaveClass('opacity-70', 'pointer-events-none');
    });

    it('shows shimmer effect', () => {
      render(
        <Card shimmer>
          <div>Shimmer content</div>
        </Card>
      );

      const shimmer = document.querySelector('.shimmer');
      expect(shimmer).toBeInTheDocument();
    });

    it('handles interactive props', () => {
      render(
        <Card interactive>
          <div>Interactive card</div>
        </Card>
      );

      const card = screen.getByText('Interactive card').parentElement;
      expect(card).toHaveClass('cursor-pointer');
    });

    it('supports click events', () => {
      const handleClick = vi.fn();
      render(
        <Card onClick={handleClick}>
          <div>Clickable</div>
        </Card>
      );

      const card = screen.getByText('Clickable').parentElement;
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(
        <Card ref={ref}>
          <div>Ref card</div>
        </Card>
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardHeader', () => {
    it('renders header content', () => {
      render(
        <Card>
          <CardHeader>
            <div>Header content</div>
          </CardHeader>
        </Card>
      );

      expect(screen.getByText('Header content')).toBeInTheDocument();
    });

    it('applies proper styling classes', () => {
      render(
        <Card>
          <CardHeader>
            <div>Header</div>
          </CardHeader>
        </Card>
      );

      const header = screen.getByText('Header').parentElement;
      expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5');
    });

    it('shows shimmer effect', () => {
      render(
        <Card>
          <CardHeader shimmer>
            <div>Shimmer header</div>
          </CardHeader>
        </Card>
      );

      const shimmer = document.querySelector('.shimmer');
      expect(shimmer).toBeInTheDocument();
    });
  });

  describe('CardTitle', () => {
    it('renders title with default h3 tag', () => {
      render(
        <Card>
          <CardTitle>Card Title</CardTitle>
        </Card>
      );

      const title = screen.getByRole('heading', { name: 'Card Title', level: 3 });
      expect(title).toBeInTheDocument();
    });

    it('renders title with custom tag', () => {
      render(
        <Card>
          <CardTitle as="h1">Main Title</CardTitle>
        </Card>
      );

      const title = screen.getByRole('heading', { name: 'Main Title', level: 1 });
      expect(title).toBeInTheDocument();
    });

    it('applies proper typography classes', () => {
      render(
        <Card>
          <CardTitle>Styled Title</CardTitle>
        </Card>
      );

      const title = screen.getByRole('heading', { name: 'Styled Title' });
      expect(title).toHaveClass('text-2xl', 'font-semibold', 'tracking-tight');
    });
  });

  describe('CardDescription', () => {
    it('renders description text', () => {
      render(
        <Card>
          <CardDescription>Description text</CardDescription>
        </Card>
      );

      const description = screen.getByText('Description text');
      expect(description).toBeInTheDocument();
      expect(description.tagName).toBe('P');
    });

    it('applies proper styling classes', () => {
      render(
        <Card>
          <CardDescription>Styled description</CardDescription>
        </Card>
      );

      const description = screen.getByText('Styled description');
      expect(description).toHaveClass('text-sm', 'leading-relaxed');
    });
  });

  describe('CardContent', () => {
    it('renders content with default padding', () => {
      render(
        <Card>
          <CardContent>Content here</CardContent>
        </Card>
      );

      const content = screen.getByText('Content here').parentElement;
      expect(content).toHaveClass('p-6', 'pt-0');
    });

    it('renders content without padding', () => {
      render(
        <Card>
          <CardContent noPadding>No padding content</CardContent>
        </Card>
      );

      const content = screen.getByText('No padding content').parentElement;
      expect(content).not.toHaveClass('p-6', 'pt-0');
    });
  });

  describe('CardFooter', () => {
    it('renders footer content', () => {
      render(
        <Card>
          <CardFooter>Footer content</CardFooter>
        </Card>
      );

      const footer = screen.getByText('Footer content').parentElement;
      expect(footer).toHaveClass('flex', 'items-center');
    });

    it('applies proper positioning classes', () => {
      render(
        <Card>
          <CardFooter>Positioned footer</CardFooter>
        </Card>
      );

      const footer = screen.getByText('Positioned footer').parentElement;
      expect(footer).toHaveClass('p-6', 'pt-0');
    });
  });

  describe('StatsCard', () => {
    it('renders stats with title and value', () => {
      render(
        <StatsCard
          title="Total Revenue"
          value="$10,000"
        />
      );

      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('$10,000')).toBeInTheDocument();
    });

    it('renders with positive change', () => {
      render(
        <StatsCard
          title="Growth"
          value="100"
          change="+12%"
          changeType="positive"
        />
      );

      expect(screen.getByText('↑ 12%')).toBeInTheDocument();
    });

    it('renders with negative change', () => {
      render(
        <StatsCard
          title="Loss"
          value="50"
          change="-5%"
          changeType="negative"
        />
      );

      expect(screen.getByText('↓ -5%')).toBeInTheDocument();
    });

    it('renders with icon', () => {
      render(
        <StatsCard
          title="Users"
          value="1,234"
          icon={<div data-testid="test-icon">Icon</div>}
        />
      );

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <StatsCard
          title="Custom"
          value="100"
          className="custom-stats"
        />
      );

      const card = screen.getByText('Custom').closest('.custom-stats');
      expect(card).toBeInTheDocument();
    });

    it('handles click events', () => {
      const handleClick = vi.fn();
      render(
        <StatsCard
          title="Clickable"
          value="200"
          onClick={handleClick}
        />
      );

      const card = screen.getByText('Clickable').closest('[role="button"]');
      fireEvent.click(card!);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders with neutral change', () => {
      render(
        <StatsCard
          title="Stable"
          value="300"
          change="0%"
          changeType="neutral"
        />
      );

      const change = screen.getByText('0%');
      expect(change).toBeInTheDocument();
      expect(change).toHaveClass('text-foreground-secondary');
    });

    it('supports large values', () => {
      render(
        <StatsCard
          title="Big Number"
          value={123456789}
        />
      );

      expect(screen.getByText('123456789')).toBeInTheDocument();
    });

    it('handles long titles', () => {
      const longTitle = 'A'.repeat(100);
      render(
        <StatsCard
          title={longTitle}
          value="100"
        />
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });
  });

  describe('Complete Card Structure', () => {
    it('renders complete card with all components', () => {
      render(
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Complete Card</CardTitle>
            <CardDescription>This is a description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Main content goes here</p>
          </CardContent>
          <CardFooter>
            <button>Action</button>
          </CardFooter>
        </Card>
      );

      expect(screen.getByRole('heading', { name: 'Complete Card' })).toBeInTheDocument();
      expect(screen.getByText('This is a description')).toBeInTheDocument();
      expect(screen.getByText('Main content goes here')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });

    it('maintains component hierarchy', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Hierarchy Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div>Nested content</div>
          </CardContent>
        </Card>
      );

      const title = screen.getByRole('heading', { name: 'Hierarchy Test' });
      const content = screen.getByText('Nested content');

      expect(title.parentElement).toContainElement(content);
    });
  });
});