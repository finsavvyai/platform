import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Input } from '../../../../../frontend/src/components/atoms';
import { Search, User } from 'lucide-react';

describe('Input Component', () => {
  it('renders with default props', () => {
    render(<Input placeholder="Enter text" />);
    
    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('border', 'border-gray-300', 'rounded-lg');
  });

  it('renders with label', () => {
    render(<Input label="Username" placeholder="Enter username" />);
    
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('shows error state correctly', () => {
    render(<Input error="This field is required" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('border-red-500');
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByTestId('error-icon')).toBeInTheDocument();
  });

  it('shows helper text', () => {
    render(<Input helperText="Enter at least 8 characters" />);
    
    expect(screen.getByText('Enter at least 8 characters')).toBeInTheDocument();
  });

  it('renders with left and right icons', () => {
    render(
      <Input
        leftIcon={<Search data-testid="search-icon" />}
        rightIcon={<User data-testid="user-icon" />}
        placeholder="Search users"
      />
    );
    
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    expect(screen.getByTestId('user-icon')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveClass('pl-10', 'pr-10');
  });

  it('handles password input with toggle', () => {
    render(<Input isPassword placeholder="Enter password" />);
    
    const input = screen.getByPlaceholderText('Enter password');
    const toggleButton = screen.getByRole('button');
    
    expect(input).toHaveAttribute('type', 'password');
    
    fireEvent.click(toggleButton);
    expect(input).toHaveAttribute('type', 'text');
    
    fireEvent.click(toggleButton);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('renders different variants correctly', () => {
    const { rerender } = render(<Input variant="filled" />);
    expect(screen.getByRole('textbox')).toHaveClass('bg-gray-100');

    rerender(<Input variant="outline" />);
    expect(screen.getByRole('textbox')).toHaveClass('border-2', 'border-gray-200');

    rerender(<Input variant="default" />);
    expect(screen.getByRole('textbox')).toHaveClass('border', 'border-gray-300');
  });

  it('renders different sizes correctly', () => {
    const { rerender } = render(<Input inputSize="sm" />);
    expect(screen.getByRole('textbox')).toHaveClass('px-3', 'py-2', 'text-sm');

    rerender(<Input inputSize="md" />);
    expect(screen.getByRole('textbox')).toHaveClass('px-4', 'py-3', 'text-sm');

    rerender(<Input inputSize="lg" />);
    expect(screen.getByRole('textbox')).toHaveClass('px-5', 'py-4', 'text-base');
  });

  it('handles focus and blur events', () => {
    const handleFocus = vi.fn();
    const handleBlur = vi.fn();
    
    render(<Input onFocus={handleFocus} onBlur={handleBlur} />);
    
    const input = screen.getByRole('textbox');
    
    fireEvent.focus(input);
    expect(handleFocus).toHaveBeenCalledTimes(1);
    
    fireEvent.blur(input);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('handles value changes', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test value' } });
    
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('test value');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" />);
    
    expect(screen.getByRole('textbox')).toHaveClass('custom-input');
  });

  it('shows error icon when there is an error', () => {
    render(<Input error="Error message" />);
    
    expect(screen.getByTestId('error-icon')).toBeInTheDocument();
  });

  it('prioritizes error over helper text', () => {
    render(<Input error="Error message" helperText="Helper text" />);
    
    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
  });
});