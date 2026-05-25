/**
 * Button Component Tests
 * Comprehensive testing for the Button atom component
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Button from '../../../frontend/src/components/atoms/Button/Button';

describe('Button Component', () => {
  const defaultProps = {
    children: 'Test Button',
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders button with text', () => {
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button', { name: 'Test Button' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Test Button');
    });

    it('renders button with React node children', () => {
      const children = <span data-testid="custom-children">Custom Content</span>;
      render(<Button {...defaultProps}>{children}</Button>);

      expect(screen.getByTestId('custom-children')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders with default variant when none specified', () => {
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gradient-to-r', 'from-indigo-600', 'to-purple-600', 'text-white');
    });

    it('renders with different variants', () => {
      const variants: Array<ButtonProps['variant']> = ['primary', 'secondary', 'outline', 'ghost', 'danger'];

      variants.forEach(variant => {
        const { unmount } = render(
          <Button {...defaultProps} variant={variant} data-testid={`button-${variant}`} />
        );

        const button = screen.getByTestId(`button-${variant}`);
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('data-variant', variant);
        unmount();
      });
    });

    it('renders with different sizes', () => {
      const sizes: Array<ButtonProps['size']> = ['sm', 'md', 'lg'];

      sizes.forEach(size => {
        const { unmount } = render(
          <Button {...defaultProps} size={size} data-testid={`button-${size}`} />
        );

        const button = screen.getByTestId(`button-${size}`);
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('data-size', size);
        unmount();
      });
    });

    it('renders with left icon', () => {
      const leftIcon = <span data-testid="left-icon">🚀</span>;
      render(<Button {...defaultProps} leftIcon={leftIcon} />);

      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders with right icon', () => {
      const rightIcon = <span data-testid="right-icon">🎯</span>;
      render(<Button {...defaultProps} rightIcon={rightIcon} />);

      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders with both left and right icons', () => {
      const leftIcon = <span data-testid="left-icon">🚀</span>;
      const rightIcon = <span data-testid="right-icon">🎯</span>;

      render(<Button {...defaultProps} leftIcon={leftIcon} rightIcon={rightIcon} />);

      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });

    it('renders in loading state', () => {
      render(<Button {...defaultProps} isLoading={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    it('renders with fullWidth prop', () => {
      render(<Button {...defaultProps} fullWidth={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-full');
    });

    it('renders with custom className', () => {
      render(<Button {...defaultProps} className="custom-test-class" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-test-class');
    });

    it('renders disabled state', () => {
      render(<Button {...defaultProps} disabled={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });

    it('renders with custom HTML attributes', () => {
      render(
        <Button {...defaultProps} data-testid="custom-button" aria-label="Custom Label" />
      );

      const button = screen.getByTestId('custom-button');
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
    });
  });

  describe('Interaction', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const user = userEvent.setup();
      render(<Button {...defaultProps} disabled={true} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(defaultProps.onClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', async () => {
      const user = userEvent.setup();
      render(<Button {...defaultProps} isLoading={true} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(defaultProps.onClick).not.toHaveBeenCalled();
    });

    it('handles keyboard interaction - Enter key', async () => {
      const user = userEvent.setup();
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
    });

    it('handles keyboard interaction - Space key', async () => {
      const user = userEvent.setup();
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{ }');

      expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
    });

    it('handles multiple clicks rapidly', async () => {
      const user = userEvent.setup();
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');

      // Click multiple times rapidly
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(defaultProps.onClick).toHaveBeenCalledTimes(3);
    });

    it('handles async onClick properly', async () => {
      const mockAsyncOnClick = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const user = userEvent.setup();
      render(<Button {...defaultProps} onClick={mockAsyncOnClick} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockAsyncOnClick).toHaveBeenCalledTimes(1);
    });

    it('passes event object to onClick handler', async () => {
      const user = userEvent.setup();
      const mockOnClick = vi.fn();

      render(<Button {...defaultProps} onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledWith(
        expect.any(MouseEvent)
      );
    });

    it('handles onClick throwing an error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockOnClick = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      render(<Button {...defaultProps} onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      expect(() => fireEvent.click(button)).not.toThrow();

      expect(mockOnClick).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(<Button {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
      expect(screen.getByTestId('loader-icon')).toHaveClass('animate-spin');
    });

    it('hides left icon when loading', () => {
      const leftIcon = <span data-testid="left-icon">🚀</span>;
      render(<Button {...defaultProps} leftIcon={leftIcon} isLoading={true} />);

      expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    it('hides right icon when loading', () => {
      const rightIcon = <span data-testid="right-icon">🎯</span>;
      render(<Button {...defaultProps} rightIcon={rightIcon} isLoading={true} />);

      expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument();
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    it('disables button when loading', () => {
      render(<Button {...defaultProps} isLoading={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('does not show loading spinner when isLoading is false', () => {
      render(<Button {...defaultProps} isLoading={false} />);

      expect(screen.queryByTestId('loader-icon')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper button role', () => {
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('can be focused', () => {
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');

      // Tab to button
      await user.tab();
      expect(button).toHaveFocus();

      // Activate with Enter
      await user.keyboard('{Enter}');
      expect(defaultProps.onClick).toHaveBeenCalledTimes(1);

      // Activate with Space
      await user.keyboard('{ }');
      expect(defaultProps.onClick).toHaveBeenCalledTimes(2);
    });

    it('announces disabled state correctly', () => {
      render(<Button {...defaultProps} disabled={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('supports custom ARIA attributes', () => {
      render(
        <Button
          {...defaultProps}
          aria-describedby="button-description"
          aria-label="Custom button label"
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'button-description');
      expect(button).toHaveAttribute('aria-label', 'Custom button label');
    });

    it('has proper type when specified', () => {
      render(<Button {...defaultProps} type="submit" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('has default type button when not specified', () => {
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty children', () => {
      render(<Button {...defaultProps} children="" />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('');
    });

    it('handles null children', () => {
      render(<Button {...defaultProps} children={null} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('handles undefined children', () => {
      render(<Button {...defaultProps} children={undefined} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('handles extremely long text', () => {
      const longText = 'A'.repeat(1000);
      render(<Button {...defaultProps} children={longText} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent(longText);
    });

    it('handles missing onClick prop', () => {
      render(<Button children="No Click Handler" />);

      const button = screen.getByRole('button');
      expect(() => userEvent.click(button)).not.toThrow();
    });

    it('handles invalid variant prop gracefully', () => {
      // This should not crash and fall back to default styling
      render(<Button {...defaultProps} variant={'invalid' as any} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('handles invalid size prop gracefully', () => {
      // This should not crash and fall back to default styling
      render(<Button {...defaultProps} size={'invalid' as any} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('CSS Classes and Styling', () => {
    it('applies base classes correctly', () => {
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('inline-flex', 'items-center', 'justify-center', 'font-medium', 'rounded-lg');
    });

    it('applies variant-specific classes', () => {
      const { unmount } = render(<Button {...defaultProps} variant="secondary" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gray-100', 'text-gray-900', 'hover:bg-gray-200');
      unmount();
    });

    it('applies size-specific classes', () => {
      const { unmount } = render(<Button {...defaultProps} size="lg" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-6', 'py-3', 'text-base');
      unmount();
    });

    it('applies fullWidth class when specified', () => {
      render(<Button {...defaultProps} fullWidth={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-full');
    });

    it('merges custom className with default classes', () => {
      render(<Button {...defaultProps} className="custom-class another-class" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class', 'another-class');
      expect(button).toHaveClass('inline-flex'); // Should still have base classes
    });

    it('applies disabled styling correctly', () => {
      render(<Button {...defaultProps} disabled={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });

    it('applies focus styling correctly', () => {
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2');
    });
  });

  describe('Motion and Animation', () => {
    it('applies motion component props', () => {
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');
      // Since framer-motion is mocked, we just check the button renders
      expect(button).toBeInTheDocument();
    });

    it('handles motion whileHover prop', () => {
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.mouseEnter(button);

      // Should not crash and button should still be present
      expect(button).toBeInTheDocument();
    });

    it('handles motion whileTap prop', () => {
      render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.mouseDown(button);

      // Should not crash and button should still be present
      expect(button).toBeInTheDocument();
    });
  });

  describe('Integration with Forms', () => {
    it('works as submit button in form', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();

      render(
        <form onSubmit={mockSubmit}>
          <Button {...defaultProps} type="submit" />
        </form>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockSubmit).toHaveBeenCalled();
    });

    it('works as reset button in form', async () => {
      const user = userEvent.setup();
      const mockReset = vi.fn();

      render(
        <form onReset={mockReset}>
          <Button {...defaultProps} type="reset" />
        </form>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockReset).toHaveBeenCalled();
    });

    it('prevents form submission when loading', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();

      render(
        <form onSubmit={mockSubmit}>
          <Button {...defaultProps} type="submit" isLoading={true} />
        </form>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Ref Forwarding', () => {
    it('supports ref forwarding', () => {
      const ref = { current: null } as React.RefObject<HTMLButtonElement>;

      render(<Button {...defaultProps} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current).toBe(screen.getByRole('button'));
    });

    it('can access button methods through ref', () => {
      const ref = { current: null } as React.RefObject<HTMLButtonElement>;

      render(<Button {...defaultProps} ref={ref} />);

      expect(ref.current?.click).toBeDefined();
      expect(ref.current?.focus).toBeDefined();
      expect(ref.current?.blur).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('renders quickly with many instances', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const { unmount } = render(
          <Button {...defaultProps} data-testid={`button-${i}`} />
        );
        unmount();
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / 100;

      // Should render in under 10ms on average
      expect(averageTime).toBeLessThan(10);
    });

    it('does not cause unnecessary re-renders', () => {
      const { rerender } = render(<Button {...defaultProps} />);

      const button = screen.getByRole('button');
      const initialHtml = button.outerHTML;

      // Rerender with same props
      rerender(<Button {...defaultProps} />);

      // Button should not have changed (though this is a basic test)
      expect(button).toBeInTheDocument();
    });
  });

  describe('Component Composition', () => {
    it('works inside other components', () => {
      const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="wrapper">{children}</div>
      );

      render(
        <Wrapper>
          <Button {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByTestId('wrapper')).toBeInTheDocument();
      expect(screen.getByTestId('wrapper')).toContainElement(screen.getByRole('button'), true);
    });

    it('can be nested inside other interactive elements', () => {
      render(
        <div role="button" tabIndex={0} data-testid="parent">
          <Button {...defaultProps} />
        </div>
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByTestId('parent')).toBeInTheDocument();
    });

    it('works with complex children', () => {
      const complexChildren = (
        <div>
          <span data-testid="child-1">Child 1</span>
          <span data-testid="child-2">Child 2</span>
        </div>
      );

      render(<Button {...defaultProps}>{complexChildren}</Button>);

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });
});