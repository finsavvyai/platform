import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../src/components/Button';
import { ThemeProvider } from '../src/theme/ThemeProvider';

const renderButton = (props?: React.ComponentProps<typeof Button>) => {
  return render(
    <ThemeProvider>
      <Button {...props}>Click me</Button>
    </ThemeProvider>
  );
};

describe('Button', () => {
  it('should render button with default props', () => {
    renderButton();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should render with primary variant', () => {
    renderButton({ variant: 'primary' });
    const btn = screen.getByRole('button');
    expect(btn).toHaveStyle({ cursor: 'pointer' });
  });

  it('should render with secondary variant', () => {
    renderButton({ variant: 'secondary' });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should render with outline variant', () => {
    renderButton({ variant: 'outline' });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should render with ghost variant', () => {
    renderButton({ variant: 'ghost' });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should support all sizes', () => {
    const { rerender } = renderButton({ size: 'sm' });
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <Button size="md">Click me</Button>
      </ThemeProvider>
    );
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <Button size="lg">Click me</Button>
      </ThemeProvider>
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should handle onClick', async () => {
    const onClick = vi.fn();
    renderButton({ onClick });
    await screen.getByRole('button').click();
    expect(onClick).toHaveBeenCalled();
  });

  it('should be disabled when disabled prop is true', () => {
    renderButton({ disabled: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should show loading state', () => {
    renderButton({ loading: true });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should be disabled when loading is true', () => {
    renderButton({ loading: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should have reduced opacity when disabled', () => {
    renderButton({ disabled: true });
    const btn = screen.getByRole('button');
    expect(btn).toHaveStyle({ opacity: 0.5 });
  });
});
