import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../src/components/Badge';
import { ThemeProvider } from '../src/theme/ThemeProvider';

const renderBadge = (props?: React.ComponentProps<typeof Badge>) => {
  return render(
    <ThemeProvider>
      <Badge {...props}>Badge</Badge>
    </ThemeProvider>
  );
};

describe('Badge', () => {
  it('should render badge element', () => {
    renderBadge();
    expect(screen.getByText('Badge')).toBeInTheDocument();
  });

  it('should render with solid variant', () => {
    renderBadge({ variant: 'solid' });
    expect(screen.getByText('Badge')).toBeInTheDocument();
  });

  it('should render with outline variant', () => {
    renderBadge({ variant: 'outline' });
    expect(screen.getByText('Badge')).toBeInTheDocument();
  });

  it('should render with primary color', () => {
    renderBadge({ color: 'primary' });
    expect(screen.getByText('Badge')).toBeInTheDocument();
  });

  it('should render with secondary color', () => {
    renderBadge({ color: 'secondary' });
    expect(screen.getByText('Badge')).toBeInTheDocument();
  });

  it('should render with success color', () => {
    renderBadge({ color: 'success' });
    expect(screen.getByText('Badge')).toBeInTheDocument();
  });

  it('should render with destructive color', () => {
    renderBadge({ color: 'destructive' });
    expect(screen.getByText('Badge')).toBeInTheDocument();
  });

  it('should have inline-flex display', () => {
    renderBadge();
    const badge = screen.getByText('Badge');
    expect(badge).toHaveStyle({ display: 'inline-flex' });
  });

  it('should have proper padding', () => {
    renderBadge();
    const badge = screen.getByText('Badge');
    expect(badge).toHaveStyle({ padding: '4px 8px' });
  });
});
