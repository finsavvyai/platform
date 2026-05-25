import { describe, it, expect, vi } from 'vitest';
import '../../../test/extend-expect';
import { render, screen, fireEvent } from '@testing-library/react';
import Select from '../Select';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Charlie' },
];

describe('Select', () => {
  it('renders all options', () => {
    render(<Select options={options} value="" onChange={() => {}} />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Charlie')).toBeTruthy();
  });

  it('renders placeholder as disabled option', () => {
    render(<Select options={options} value="" onChange={() => {}} placeholder="Pick one" />);
    const placeholder = screen.getByText('Pick one') as HTMLOptionElement;
    expect(placeholder.disabled).toBe(true);
  });

  it('calls onChange when selection changes', () => {
    const onChange = vi.fn();
    render(<Select options={options} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('renders label when provided', () => {
    render(<Select options={options} value="" onChange={() => {}} label="Priority" />);
    expect(screen.getByText('Priority')).toBeTruthy();
    expect(screen.getByLabelText('Priority')).toBeTruthy();
  });

  it('renders error message with alert role', () => {
    render(<Select options={options} value="" onChange={() => {}} error="Required field" />);
    expect(screen.getByRole('alert').textContent).toBe('Required field');
    expect(screen.getByRole('combobox').getAttribute('aria-invalid')).toBe('true');
  });

  it('disables select when disabled prop is true', () => {
    render(<Select options={options} value="" onChange={() => {}} disabled />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true);
  });

  it('reflects selected value', () => {
    render(<Select options={options} value="b" onChange={() => {}} />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('b');
  });
});
