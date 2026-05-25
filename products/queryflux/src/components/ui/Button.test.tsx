import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /Click me/i });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('bg-primary');
  });

  it('renders destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole('button', { name: /Delete/i });
    expect(button.className).toContain('bg-destructive');
  });

  it('renders outline variant', () => {
    render(<Button variant="outline">Outline</Button>);
    const button = screen.getByRole('button', { name: /Outline/i });
    expect(button.className).toContain('border');
    expect(button.className).toContain('bg-background');
  });

  it('renders secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button', { name: /Secondary/i });
    expect(button.className).toContain('bg-secondary');
  });

  it('renders ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole('button', { name: /Ghost/i });
    expect(button.className).toContain('hover:bg-accent');
  });

  it('renders link variant', () => {
    render(<Button variant="link">Link</Button>);
    const button = screen.getByRole('button', { name: /Link/i });
    expect(button.className).toContain('underline-offset-4');
  });

  it('renders default size', () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole('button', { name: /Default/i });
    expect(button.className).toContain('h-11');
    expect(button.className).toContain('px-8');
  });

  it('renders sm size', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole('button', { name: /Small/i });
    expect(button.className).toContain('h-9');
    expect(button.className).toContain('px-3');
  });

  it('renders lg size', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole('button', { name: /Large/i });
    expect(button.className).toContain('h-12');
  });

  it('renders icon size', () => {
    render(<Button size="icon">I</Button>);
    const button = screen.getByRole('button', { name: /I/i });
    expect(button.className).toContain('h-11');
    expect(button.className).toContain('w-11');
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('passes additional className', () => {
    render(<Button className="my-custom-class">Custom</Button>);
    const button = screen.getByRole('button', { name: /Custom/i });
    expect(button.className).toContain('my-custom-class');
  });

  it('handles onClick', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole('button', { name: /Click/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
