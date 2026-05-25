import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Waitlist from '../components/Waitlist';

describe('Waitlist', () => {
  it('renders the heading', () => {
    render(<Waitlist />);
    expect(screen.getByText('Ready to rank in the AI era?')).toBeInTheDocument();
  });

  it('renders the email input', () => {
    render(<Waitlist />);
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<Waitlist />);
    expect(screen.getByText('Join')).toBeInTheDocument();
  });

  it('shows error for empty email submission', () => {
    render(<Waitlist />);
    fireEvent.click(screen.getByText('Join'));
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
  });

  it('shows error for invalid email', () => {
    render(<Waitlist />);
    const input = screen.getByPlaceholderText('you@company.com');
    fireEvent.change(input, { target: { value: 'notanemail' } });
    fireEvent.click(screen.getByText('Join'));
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
  });

  it('shows success state for valid email', () => {
    render(<Waitlist />);
    const input = screen.getByPlaceholderText('you@company.com');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Join'));
    expect(screen.getByText("You're on the list")).toBeInTheDocument();
  });

  it('hides form after successful submission', () => {
    render(<Waitlist />);
    const input = screen.getByPlaceholderText('you@company.com');
    fireEvent.change(input, { target: { value: 'user@co.com' } });
    fireEvent.click(screen.getByText('Join'));
    expect(screen.queryByPlaceholderText('you@company.com')).not.toBeInTheDocument();
  });
});
