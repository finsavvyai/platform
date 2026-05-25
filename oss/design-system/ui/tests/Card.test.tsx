import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../src/components/Card';
import { ThemeProvider } from '../src/theme/ThemeProvider';

const renderCard = (
  props?: React.ComponentProps<typeof Card>,
  children?: React.ReactNode
) => {
  return render(
    <ThemeProvider>
      <Card data-testid="card" {...props}>
        {children || 'Card content'}
      </Card>
    </ThemeProvider>
  );
};

describe('Card', () => {
  it('should render card element', () => {
    renderCard();
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('should render children content', () => {
    renderCard({}, 'Test content');
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render with outlined variant', () => {
    renderCard({ variant: 'outlined' });
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('should render with filled variant', () => {
    renderCard({ variant: 'filled' });
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('should have padding', () => {
    renderCard();
    const card = screen.getByTestId('card');
    expect(card).toHaveStyle({ padding: '16px' });
  });

  it('should have border radius', () => {
    renderCard();
    const card = screen.getByTestId('card');
    expect(card).toHaveStyle({ borderRadius: '12px' });
  });

  it('should render multiple children', () => {
    renderCard(
      {},
      <div>
        <p>Child 1</p>
        <p>Child 2</p>
      </div>
    );
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });

  it('should accept custom className', () => {
    renderCard({ className: 'custom-class' });
    expect(screen.getByTestId('card')).toHaveClass('custom-class');
  });
});
