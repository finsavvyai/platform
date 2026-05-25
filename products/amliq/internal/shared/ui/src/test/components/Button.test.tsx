/**
 * Button component tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Button } from '../../components/ui/Button';

describe('Button Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default props', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });

    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-brand-cyan-500');
    expect(button).not.toBeDisabled();
  });

  it('renders with different variants', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost', 'link', 'destructive'] as const;

    variants.forEach(variant => {
      const { unmount } = render(<Button variant={variant}>Test</Button>);
      const button = screen.getByRole('button', { name: 'Test' });

      expect(button).toBeInTheDocument();
      unmount();
    });
  });

  it('renders with different sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

    sizes.forEach(size => {
      const { unmount } = render(<Button size={size}>Test</Button>);
      const button = screen.getByRole('button', { name: 'Test' });

      expect(button).toBeInTheDocument();
      unmount();
    });
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button', { name: 'Click me' });
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);

    const button = screen.getByRole('button', { name: 'Disabled' });

    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<Button loading>Loading</Button>);

    const button = screen.getByRole('button', { name: 'Loading' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-loading', 'true');
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Test</Button>);

    const button = screen.getByRole('button', { name: 'Test' });
    expect(button).toHaveClass('custom-class');
  });

  it('renders with icon', () => {
    render(<Button icon="🚀">With Icon</Button>);

    const button = screen.getByRole('button', { name: 'With Icon' });
    expect(button).toBeInTheDocument();
  });

  it('supports ripple effect', () => {
    render(<Button ripple>Ripple</Button>);

    const button = screen.getByRole('button', { name: 'Ripple' });
    expect(button).toHaveAttribute('data-ripple', 'true');
  });

  it('renders as different element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Link Button' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
  });

  it('applies correct accessibility attributes', () => {
    render(<Button aria-label="Custom label">Button</Button>);

    const button = screen.getByRole('button', { name: 'Custom label' });
    expect(button).toHaveAttribute('aria-label', 'Custom label');
  });

  it('handles keyboard events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Button</Button>);

    const button = screen.getByRole('button', { name: 'Button' });

    button.focus();
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(button, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('can be focused programmatically', () => {
    render(<Button>Button</Button>);

    const button = screen.getByRole('button', { name: 'Button' });
    button.focus();

    expect(button).toHaveFocus();
  });

  it('supports form attributes', () => {
    render(
      <form>
        <Button type="submit" formAction="/submit">
          Submit
        </Button>
      </form>
    );

    const button = screen.getByRole('button', { name: 'Submit' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('formAction', '/submit');
  });

  it('does not render when children are empty', () => {
    const { container } = render(<Button></Button>);
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('handles long text content', () => {
    const longText = 'A'.repeat(1000);
    render(<Button>{longText}</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent(longText);
  });

  it('combines multiple props correctly', () => {
    render(
      <Button
        variant="outline"
        size="lg"
        loading
        disabled
        className="custom"
        icon="🎉"
      >
        Complex Button
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Complex Button' });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button).toHaveClass('custom');
  });

  it('has proper semantic markup', () => {
    render(<Button>Semantic Button</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  it('respects disabled state with keyboard events', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);

    const button = screen.getByRole('button', { name: 'Disabled' });
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter' });

    expect(handleClick).not.toHaveBeenCalled();
  });
});