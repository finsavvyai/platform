import { describe, it, expect, vi } from 'vitest';
import '../../../test/extend-expect';
import { render, screen, fireEvent } from '@testing-library/react';
import Checkbox from '../Checkbox';

describe('Checkbox', () => {
  it('renders unchecked by default', () => {
    render(<Checkbox checked={false} onChange={() => {}} label="Accept" />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });

  it('renders checked when checked prop is true', () => {
    render(<Checkbox checked={true} onChange={() => {}} label="Accept" />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('calls onChange with new value on click', () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Accept" />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders label text', () => {
    render(<Checkbox checked={false} onChange={() => {}} label="Terms" />);
    expect(screen.getByText('Terms')).toBeTruthy();
  });

  it('disables checkbox when disabled', () => {
    render(<Checkbox checked={false} onChange={() => {}} disabled label="Locked" />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('generates id from label', () => {
    render(<Checkbox checked={false} onChange={() => {}} label="My Label" />);
    expect(screen.getByRole('checkbox').getAttribute('id')).toBe('checkbox-my-label');
  });

  it('uses custom id when provided', () => {
    render(<Checkbox checked={false} onChange={() => {}} id="custom-id" label="Test" />);
    expect(screen.getByRole('checkbox').getAttribute('id')).toBe('custom-id');
  });
});
