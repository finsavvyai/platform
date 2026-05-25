import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryEditor } from './QueryEditor';

describe('QueryEditor', () => {
  it('renders the editor with placeholder text', () => {
    render(<QueryEditor />);
    expect(screen.getByPlaceholderText(/Enter your SQL query/i)).toBeInTheDocument();
  });

  it('calls onChange when text is entered', () => {
    const handleChange = vi.fn();
    render(<QueryEditor onChange={handleChange} />);

    const textarea = screen.getByPlaceholderText(/Enter your SQL query/i);
    fireEvent.change(textarea, { target: { value: 'SELECT * FROM users' } });

    expect(handleChange).toHaveBeenCalledWith('SELECT * FROM users');
  });

  it('calls onExecute when Execute button is clicked', () => {
    const handleExecute = vi.fn();
    render(<QueryEditor value="SELECT * FROM users" onExecute={handleExecute} />);

    const executeButton = screen.getByRole('button', { name: /Execute/i });
    fireEvent.click(executeButton);

    expect(handleExecute).toHaveBeenCalledWith('SELECT * FROM users');
  });

  it('disables Execute button when query is empty', () => {
    render(<QueryEditor value="" />);

    const executeButton = screen.getByRole('button', { name: /Execute/i });
    expect(executeButton).toBeDisabled();
  });

  it('executes query on Ctrl+Enter', () => {
    const handleExecute = vi.fn();
    render(<QueryEditor value="SELECT 1" onExecute={handleExecute} />);

    const textarea = screen.getByPlaceholderText(/Enter your SQL query/i);
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    expect(handleExecute).toHaveBeenCalledWith('SELECT 1');
  });

  it('saves query on Ctrl+S', () => {
    const handleSave = vi.fn();
    render(<QueryEditor value="SELECT 1" onSave={handleSave} />);

    const textarea = screen.getByPlaceholderText(/Enter your SQL query/i);
    fireEvent.keyDown(textarea, { key: 's', ctrlKey: true });

    expect(handleSave).toHaveBeenCalledWith('SELECT 1');
  });

  it('calls onSave when Save button is clicked', () => {
    const handleSave = vi.fn();
    render(<QueryEditor value="SELECT * FROM users" onSave={handleSave} />);

    const saveButton = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(saveButton);

    expect(handleSave).toHaveBeenCalledWith('SELECT * FROM users');
  });

  it('inserts spaces on Tab key', () => {
    const handleChange = vi.fn();
    render(<QueryEditor value="SELECT" onChange={handleChange} />);

    const textarea = screen.getByPlaceholderText(/Enter your SQL query/i);
    // Set selection position
    Object.defineProperty(textarea, 'selectionStart', { value: 6, writable: true });
    Object.defineProperty(textarea, 'selectionEnd', { value: 6, writable: true });
    fireEvent.keyDown(textarea, { key: 'Tab' });

    expect(handleChange).toHaveBeenCalledWith('SELECT  ');
  });

  it('tracks selected text on selection', () => {
    render(<QueryEditor value="SELECT * FROM users" />);

    const textarea = screen.getByPlaceholderText(/Enter your SQL query/i);
    Object.defineProperty(textarea, 'selectionStart', { value: 0, writable: true });
    Object.defineProperty(textarea, 'selectionEnd', { value: 6, writable: true });
    fireEvent.select(textarea);

    expect(screen.getByText(/Selected: 6/i)).toBeInTheDocument();
  });

  it('shows line count and character count', () => {
    const query = 'SELECT * FROM users\nWHERE id = 1';
    render(<QueryEditor value={query} />);

    expect(screen.getByText(/Lines: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Chars: 32/i)).toBeInTheDocument();
  });
});
