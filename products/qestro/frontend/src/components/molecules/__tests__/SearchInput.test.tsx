import { describe, it, expect, vi, afterEach } from 'vitest';
import '../../../test/extend-expect';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SearchInput from '../SearchInput';

describe('SearchInput', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with placeholder', () => {
    render(<SearchInput onChange={() => {}} placeholder="Search projects..." />);
    expect(screen.getByPlaceholderText('Search projects...')).toBeTruthy();
  });

  it('calls onChange after debounce', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SearchInput onChange={onChange} debounceMs={300} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(300); });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('debounces multiple rapid inputs', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SearchInput onChange={onChange} debounceMs={300} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 't' } });
    fireEvent.change(input, { target: { value: 'te' } });
    fireEvent.change(input, { target: { value: 'tes' } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('tes');
  });

  it('displays external value', () => {
    render(<SearchInput onChange={() => {}} value="preset" />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('preset');
  });

  it('has accessible label from placeholder', () => {
    render(<SearchInput onChange={() => {}} placeholder="Find items" />);
    expect(screen.getByLabelText('Find items')).toBeTruthy();
  });
});
