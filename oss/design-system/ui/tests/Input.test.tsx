import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '../src/components/Input';
import { ThemeProvider } from '../src/theme/ThemeProvider';

const renderInput = (props?: React.ComponentProps<typeof Input>) => {
  return render(
    <ThemeProvider>
      <Input {...props} />
    </ThemeProvider>
  );
};

describe('Input', () => {
  it('should render input element', () => {
    renderInput();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render with label', () => {
    renderInput({ label: 'Username' });
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('should render with placeholder', () => {
    renderInput({ placeholder: 'Enter username' });
    expect(screen.getByPlaceholderText('Enter username')).toBeInTheDocument();
  });

  it('should support email type', () => {
    renderInput({ type: 'email' });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.type).toBe('email');
  });

  it('should support password type', () => {
    const { container } = renderInput({ type: 'password' });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('should support number type', () => {
    const { container } = renderInput({ type: 'number' });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('number');
  });

  it('should display error message', () => {
    renderInput({ error: 'Username is required' });
    expect(screen.getByText('Username is required')).toBeInTheDocument();
  });

  it('should show disabled state', () => {
    renderInput({ disabled: true });
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('should accept input value', () => {
    renderInput({ defaultValue: 'test' });
    expect(screen.getByDisplayValue('test')).toBeInTheDocument();
  });

  it('should render label and input together', () => {
    renderInput({ label: 'Email', type: 'email' });
    expect(screen.getByText('Email')).toBeInTheDocument();
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.type).toBe('email');
  });
});
