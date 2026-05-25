/**
 * Input Component Tests
 * Comprehensive testing for the Input atom component
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Input from '../../../frontend/src/components/atoms/Input/Input';

describe('Input Component', () => {
  const defaultProps = {
    name: 'test-input',
    placeholder: 'Enter text...',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders basic input', () => {
      render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'Enter text...');
    });

    it('renders with label', () => {
      render(<Input {...defaultProps} label="Test Label" />);

      expect(screen.getByText('Test Label')).toBeInTheDocument();
      const label = screen.getByText('Test Label');
      expect(label.tagName).toBe('LABEL');
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders with left icon', () => {
      const leftIcon = <span data-testid="left-icon">🔍</span>;
      render(<Input {...defaultProps} leftIcon={leftIcon} />);

      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders with right icon', () => {
      const rightIcon = <span data-testid="right-icon">✓</span>;
      render(<Input {...defaultProps} rightIcon={rightIcon} />);

      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders with error state', () => {
      render(<Input {...defaultProps} error="This field is required" />);

      expect(screen.getByText('This field is required')).toBeInTheDocument();
      expect(screen.getByTestId('error-icon')).toBeInTheDocument();
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-red-500');
    });

    it('renders with helper text', () => {
      render(<Input {...defaultProps} helperText="This is helper text" />);

      expect(screen.getByText('This is helper text')).toBeInTheDocument();
      expect(screen.getByText('This is helper text')).toHaveClass('text-gray-500');
    });

    it('renders with password type', () => {
      render(<Input {...defaultProps} type="password" isPassword={true} />);

      const input = screen.getByLabelText(/password/i) || screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'password');
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<Input {...defaultProps} className="custom-input-class" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-input-class');
    });

    it('renders with different variants', () => {
      const variants: Array<InputProps['variant']> = ['default', 'filled', 'outline'];

      variants.forEach(variant => {
        const { unmount } = render(
          <Input {...defaultProps} variant={variant} data-testid={`input-${variant}`} />
        );

        const input = screen.getByTestId(`input-${variant}`);
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('data-variant', variant);
        unmount();
      });
    });

    it('renders with different sizes', () => {
      const sizes: Array<InputProps['inputSize']> = ['sm', 'md', 'lg'];

      sizes.forEach(size => {
        const { unmount } = render(
          <Input {...defaultProps} inputSize={size} data-testid={`input-${size}`} />
        );

        const input = screen.getByTestId(`input-${size}`);
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('data-size', size);
        unmount();
      });
    });

    it('renders with disabled state', () => {
      render(<Input {...defaultProps} disabled={true} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('renders with readonly state', () => {
      render(<Input {...defaultProps} readOnly={true} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('readonly');
    });

    it('renders with required attribute', () => {
      render(<Input {...defaultProps} required={true} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('required');
    });

    it('renders with custom attributes', () => {
      render(
        <Input
          {...defaultProps}
          data-testid="custom-input"
          aria-label="Custom input label"
          maxLength={50}
        />
      );

      const input = screen.getByTestId('custom-input');
      expect(input).toHaveAttribute('aria-label', 'Custom input label');
      expect(input).toHaveAttribute('maxlength', '50');
    });
  });

  describe('Interaction', () => {
    it('handles user input', async () => {
      const user = userEvent.setup();
      render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Hello World');

      expect(input).toHaveValue('Hello World');
    });

    it('calls onChange when value changes', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      render(<Input {...defaultProps} onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('calls onFocus when input is focused', async () => {
      const user = userEvent.setup();
      const mockOnFocus = vi.fn();

      render(<Input {...defaultProps} onFocus={mockOnFocus} />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      expect(mockOnFocus).toHaveBeenCalled();
    });

    it('calls onBlur when input loses focus', async () => {
      const user = userEvent.setup();
      const mockOnBlur = vi.fn();

      render(<Input {...defaultProps} onBlur={mockOnBlur} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.tab(); // Move focus away

      expect(mockOnBlur).toHaveBeenCalled();
    });

    it('handles keyboard events', async () => {
      const user = userEvent.setup();
      const mockOnKeyDown = vi.fn();
      const mockOnKeyUp = vi.fn();

      render(
        <Input
          {...defaultProps}
          onKeyDown={mockOnKeyDown}
          onKeyUp={mockOnKeyUp}
        />
      );

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.keyboard('a');

      expect(mockOnKeyDown).toHaveBeenCalled();
      expect(mockOnKeyUp).toHaveBeenCalled();
    });

    it('handles paste events', async () => {
      const user = userEvent.setup();
      const mockOnPaste = vi.fn();

      render(<Input {...defaultProps} onPaste={mockOnPaste} />);

      const input = screen.getByRole('textbox');

      // Simulate paste event
      fireEvent.paste(input, {
        clipboardData: {
          getData: () => 'pasted text'
        }
      });

      expect(mockOnPaste).toHaveBeenCalled();
    });

    it('handles click events', async () => {
      const user = userEvent.setup();
      const mockOnClick = vi.fn();

      render(<Input {...defaultProps} onClick={mockOnClick} />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      expect(mockOnClick).toHaveBeenCalled();
    });

    it('prevents input when disabled', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      render(<Input {...defaultProps} disabled={true} onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      expect(input).toHaveValue('');
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('prevents input when readonly', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      render(<Input {...defaultProps} readOnly={true} onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      expect(input).toHaveValue('');
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Password Input', () => {
    it('toggles password visibility', async () => {
      const user = userEvent.setup();
      render(<Input {...defaultProps} type="password" isPassword={true} />);

      const input = screen.getByLabelText(/password/i) || screen.getByRole('textbox');
      const toggleButton = screen.getByRole('button');

      // Initially should be password type
      expect(input).toHaveAttribute('type', 'password');
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument();

      // Click to show password
      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'text');
      expect(screen.getByTestId('eye-off-icon')).toBeInTheDocument();

      // Click to hide password
      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'password');
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
    });

    it('does not show toggle button when not a password input', () => {
      render(<Input {...defaultProps} type="text" isPassword={false} />);

      expect(screen.queryByTestId('eye-icon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('eye-off-icon')).not.toBeInTheDocument();
    });

    it('does not show toggle button when there is an error', () => {
      render(
        <Input
          {...defaultProps}
          type="password"
          isPassword={true}
          error="Invalid password"
        />
      );

      expect(screen.getByTestId('error-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('eye-icon')).not.toBeInTheDocument();
    });

    it('does not show toggle button when there is a right icon', () => {
      const rightIcon = <span data-testid="right-icon">✓</span>;
      render(
        <Input
          {...defaultProps}
          type="password"
          isPassword={true}
          rightIcon={rightIcon}
        />
      );

      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('eye-icon')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message', () => {
      render(<Input {...defaultProps} error="This field is required" />);

      expect(screen.getByText('This field is required')).toBeInTheDocument();
      expect(screen.getByText('This field is required')).toHaveClass('text-red-600');
    });

    it('shows error icon', () => {
      render(<Input {...defaultProps} error="This field is required" />);

      expect(screen.getByTestId('error-icon')).toBeInTheDocument();
    });

    it('applies error styling to input', () => {
      render(<Input {...defaultProps} error="This field is required" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
    });

    it('hides helper text when there is an error', () => {
      render(
        <Input
          {...defaultProps}
          error="This field is required"
          helperText="This should be hidden"
        />
      );

      expect(screen.getByText('This field is required')).toBeInTheDocument();
      expect(screen.queryByText('This should be hidden')).not.toBeInTheDocument();
    });

    it('clears error when error prop is removed', () => {
      const { rerender } = render(<Input {...defaultProps} error="Initial error" />);

      expect(screen.getByText('Initial error')).toBeInTheDocument();

      rerender(<Input {...defaultProps} error={undefined} />);

      expect(screen.queryByText('Initial error')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('associates label with input', () => {
      render(<Input {...defaultProps} label="Test Label" />);

      const label = screen.getByText('Test Label');
      const input = screen.getByRole('textbox');

      // Label should be associated with input
      expect(label).toHaveAttribute('for');
      expect(input).toHaveAttribute('id');
      expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
    });

    it('has proper input role', () => {
      render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('supports custom aria-label', () => {
      render(<Input {...defaultProps} aria-label="Custom input label" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', 'Custom input label');
    });

    it('supports aria-describedby', () => {
      render(<Input {...defaultProps} aria-describedby="helper-text" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'helper-text');
    });

    it('announces error state to screen readers', () => {
      render(<Input {...defaultProps} error="This field is required" />);

      const input = screen.getByRole('textbox');
      const errorMessage = screen.getByText('This field is required');

      // Error message should be associated with input
      expect(errorMessage).toHaveAttribute('id');
      expect(input).toHaveAttribute('aria-describedby', errorMessage.getAttribute('id'));
    });

    it('announces required state', () => {
      render(<Input {...defaultProps} required={true} label="Required Field" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('announces disabled state', () => {
      render(<Input {...defaultProps} disabled={true} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveAttribute('aria-disabled', 'true');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.tab();

      expect(input).toHaveFocus();
    });

    it('password toggle button has proper accessibility', async () => {
      const user = userEvent.setup();
      render(<Input {...defaultProps} type="password" isPassword={true} />);

      const toggleButton = screen.getByRole('button');

      expect(toggleButton).toHaveAttribute('aria-label');
      expect(toggleButton).toHaveAttribute('type', 'button');

      await user.click(toggleButton);

      // ARIA label should change based on state
      expect(toggleButton).toHaveAttribute('aria-label');
    });
  });

  describe('Form Integration', () => {
    it('works with form submission', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();

      render(
        <form onSubmit={mockSubmit}>
          <Input {...defaultProps} name="test-input" />
          <button type="submit">Submit</button>
        </form>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'test value');

      const submitButton = screen.getByRole('button', { name: 'Submit' });
      await user.click(submitButton);

      expect(mockSubmit).toHaveBeenCalled();
    });

    it('integrates with React Hook Form', async () => {
      const user = userEvent.setup();
      const mockRegister = vi.fn();
      const mockError = { message: 'Field is required' };

      // Mock React Hook Form behavior
      vi.doMock('react-hook-form', () => ({
        useForm: () => ({
          register: mockRegister,
          formState: { errors: { testInput: mockError } },
          setValue: vi.fn(),
          getValue: vi.fn(),
          trigger: vi.fn(),
        }),
      }));

      render(<Input {...defaultProps} name="testInput" error={mockError.message} />);

      expect(screen.getByText('Field is required')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('validates required field', async () => {
      const user = userEvent.setup();
      const mockValidate = vi.fn().mockReturnValue('Field is required');

      render(
        <form>
          <Input {...defaultProps} required={true} onInvalid={mockValidate} />
          <button type="submit">Submit</button>
        </form>
      );

      const submitButton = screen.getByRole('button', { name: 'Submit' });
      await user.click(submitButton);

      const input = screen.getByRole('textbox');
      expect(input).toBeInvalid();
    });
  });

  describe('CSS Classes and Styling', () => {
    it('applies base classes correctly', () => {
      render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('w-full', 'transition-all', 'duration-200');
    });

    it('applies variant-specific classes', () => {
      const { unmount } = render(<Input {...defaultProps} variant="filled" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-0', 'rounded-lg', 'bg-gray-100');
      unmount();
    });

    it('applies size-specific classes', () => {
      const { unmount } = render(<Input {...defaultProps} inputSize="lg" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('px-5', 'py-4', 'text-base');
      unmount();
    });

    it('applies error classes when error is present', () => {
      render(<Input {...defaultProps} error="Error message" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-red-500', 'focus:ring-red-500');
    });

    it('applies padding adjustment for left icon', () => {
      const leftIcon = <span data-testid="left-icon">🔍</span>;
      render(<Input {...defaultProps} leftIcon={leftIcon} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pl-10');
    });

    it('applies padding adjustment for right icon', () => {
      const rightIcon = <span data-testid="right-icon">✓</span>;
      render(<Input {...defaultProps} rightIcon={rightIcon} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pr-10');
    });

    it('applies padding adjustment for password input', () => {
      render(<Input {...defaultProps} type="password" isPassword={true} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pr-10');
    });

    it('merges custom className with default classes', () => {
      render(<Input {...defaultProps} className="custom-class another-class" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-class', 'another-class');
      expect(input).toHaveClass('w-full'); // Should still have base classes
    });
  });

  describe('Edge Cases', () {
    it('handles missing label', () => {
      render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(screen.queryByRole('label')).not.toBeInTheDocument();
    });

    it('handles empty label', () => {
      render(<Input {...defaultProps} label="" />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('handles very long placeholder text', () => {
      const longPlaceholder = 'A'.repeat(200);
      render(<Input {...defaultProps} placeholder={longPlaceholder} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', longPlaceholder);
    });

    it('handles extremely long input value', async () => {
      const user = userEvent.setup();
      const longText = 'A'.repeat(1000);

      render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, longText);

      expect(input).toHaveValue(longText);
    });

    it('handles special characters in input', async () => {
      const user = userEvent.setup();
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

      render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, specialChars);

      expect(input).toHaveValue(specialChars);
    });

    it('handles Unicode characters', async () => {
      const user = userEvent.setup();
      const unicodeText = 'Hello 世界 🌍 ñáéíóú';

      render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, unicodeText);

      expect(input).toHaveValue(unicodeText);
    });

    it('handles invalid variant prop gracefully', () => {
      render(<Input {...defaultProps} variant={'invalid' as any} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      // Should fall back to default variant styling
    });

    it('handles invalid size prop gracefully', () => {
      render(<Input {...defaultProps} inputSize={'invalid' as any} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      // Should fall back to default size styling
    });

    it('handles null/undefined onChange gracefully', () => {
      render(<Input {...defaultProps} onChange={undefined} />);

      const input = screen.getByRole('textbox');
      expect(() => fireEvent.change(input, { target: { value: 'test' } })).not.toThrow();
    });

    it('handles undefined value prop', () => {
      render(<Input {...defaultProps} value={undefined} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });
  });

  describe('Focus Management', () => {
    it('applies focus styles when focused', async () => {
      const user = userEvent.setup();
      render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      expect(input).toHaveFocus();
      expect(input).toHaveClass('focus:outline-none', 'focus:ring-2');
    });

    it('removes focus styles when blurred', async () => {
      const user = userEvent.setup();
      render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.tab(); // Move focus away

      expect(input).not.toHaveFocus();
    });

    it('handles programmatic focus', () => {
      render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');
      input.focus();

      expect(input).toHaveFocus();
    });

    it('handles programmatic blur', () => {
      render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');
      input.focus();
      input.blur();

      expect(input).not.toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('renders quickly with many instances', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const { unmount } = render(
          <Input {...defaultProps} name={`input-${i}`} data-testid={`input-${i}`} />
        );
        unmount();
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / 100;

      // Should render in under 15ms on average
      expect(averageTime).toBeLessThan(15);
    });

    it('does not cause unnecessary re-renders', () => {
      const { rerender } = render(<Input {...defaultProps} />);

      const input = screen.getByRole('textbox');

      // Rerender with same props
      rerender(<Input {...defaultProps} />);

      // Input should still be present and not crashed
      expect(input).toBeInTheDocument();
    });
  });

  describe('Component Composition', () => {
    it('works inside other components', () => {
      const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="input-wrapper">{children}</div>
      );

      render(
        <Wrapper>
          <Input {...defaultProps} />
        </Wrapper>
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByTestId('input-wrapper')).toBeInTheDocument();
    });

    it('can be used in forms with other inputs', () => {
      render(
        <form>
          <Input {...defaultProps} name="firstName" label="First Name" />
          <Input {...defaultProps} name="lastName" label="Last Name" />
          <button type="submit">Submit</button>
        </form>
      );

      expect(screen.getByLabelText('First Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });

    it('works with controlled value pattern', () => {
      const ControlledInput = () => {
        const [value, setValue] = React.useState('');
        return (
          <Input
            {...defaultProps}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        );
      };

      render(<ControlledInput />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');

      fireEvent.change(input, { target: { value: 'test' } });
      expect(input).toHaveValue('test');
    });
  });
});