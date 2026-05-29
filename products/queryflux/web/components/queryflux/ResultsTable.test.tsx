import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsTable, QueryResult } from './ResultsTable';

const mockResult: QueryResult = {
  columns: ['id', 'name', 'email'],
  rows: [
    [1, 'Alice', 'alice@example.com'],
    [2, 'Bob', 'bob@example.com'],
    [3, 'Charlie', 'charlie@example.com'],
  ],
  rowCount: 3,
  executionTime: 45,
};

describe('ResultsTable', () => {
  it('renders loading state', () => {
    render(<ResultsTable result={null} loading={true} />);
    expect(screen.getByText(/Executing query/i)).toBeInTheDocument();
  });

  it('renders error message', () => {
    const error = 'Syntax error at line 1';
    render(<ResultsTable result={null} error={error} />);
    expect(screen.getByText(/Syntax error at line 1/i)).toBeInTheDocument();
  });

  it('renders empty state when no result', () => {
    render(<ResultsTable result={null} />);
    expect(screen.getByText(/Execute a query to see results/i)).toBeInTheDocument();
  });

  it('renders table with data', () => {
    render(<ResultsTable result={mockResult} />);

    // Check headers
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();

    // Check data
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('displays row count and execution time', () => {
    render(<ResultsTable result={mockResult} />);

    // Row count and execution time are split across child spans
    expect(screen.getByText((_, element) => {
      return element?.tagName === 'SPAN' && element?.textContent === '3 rows';
    })).toBeInTheDocument();
    expect(screen.getByText((_, element) => {
      return element?.tagName === 'SPAN' && element?.textContent === 'in 45ms';
    })).toBeInTheDocument();
  });

  it('sorts table when column header is clicked', () => {
    render(<ResultsTable result={mockResult} />);

    const nameHeader = screen.getByText('name');
    fireEvent.click(nameHeader);

    // Should show sort indicator
    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('calls onExport when Export button is clicked', () => {
    const handleExport = vi.fn();
    render(<ResultsTable result={mockResult} onExport={handleExport} />);

    const exportButton = screen.getByRole('button', { name: /Export/i });
    fireEvent.click(exportButton);

    expect(handleExport).toHaveBeenCalled();
  });

  it('toggles sort direction when same column clicked twice', () => {
    render(<ResultsTable result={mockResult} />);

    const nameHeader = screen.getByText('name');
    fireEvent.click(nameHeader);
    expect(screen.getByText('↑')).toBeInTheDocument();

    // Click again to toggle to desc
    fireEvent.click(nameHeader);
    expect(screen.getByText('↓')).toBeInTheDocument();
  });

  it('copies cell value on double-click', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ResultsTable result={mockResult} />);
    const cell = screen.getByText('Alice');
    fireEvent.doubleClick(cell.closest('td')!);

    expect(writeText).toHaveBeenCalledWith('Alice');
  });
});
