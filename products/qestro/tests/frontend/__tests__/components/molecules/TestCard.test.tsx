import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TestCard } from '../../../../../frontend/src/components/molecules';

const mockTest = {
  id: 'test-1',
  name: 'Login Test',
  description: 'Test user login functionality',
  status: 'passed' as const,
  lastRun: new Date('2024-01-15T10:30:00Z'),
  duration: 2500,
  framework: 'playwright' as const,
  testType: 'e2e' as const,
};

describe('TestCard Component', () => {
  it('renders test information correctly', () => {
    render(<TestCard {...mockTest} />);
    
    expect(screen.getByText('Login Test')).toBeInTheDocument();
    expect(screen.getByText('Test user login functionality')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('playwright')).toBeInTheDocument();
    expect(screen.getByText('e2e')).toBeInTheDocument();
  });

  it('displays correct status with appropriate styling', () => {
    const { rerender } = render(<TestCard {...mockTest} status="running" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Running')).toHaveClass('text-blue-500');

    rerender(<TestCard {...mockTest} status="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toHaveClass('text-red-500');

    rerender(<TestCard {...mockTest} status="error" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Error')).toHaveClass('text-orange-500');

    rerender(<TestCard {...mockTest} status="idle" />);
    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(screen.getByText('Idle')).toHaveClass('text-gray-500');
  });

  it('formats duration correctly', () => {
    const { rerender } = render(<TestCard {...mockTest} duration={500} />);
    expect(screen.getByText('Duration: 500ms')).toBeInTheDocument();

    rerender(<TestCard {...mockTest} duration={2500} />);
    expect(screen.getByText('Duration: 2.5s')).toBeInTheDocument();

    rerender(<TestCard {...mockTest} duration={undefined} />);
    expect(screen.getByText('Duration: N/A')).toBeInTheDocument();
  });

  it('formats last run time correctly', () => {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const oneDayAgo = new Date(now.getTime() - 86400000);

    const { rerender } = render(<TestCard {...mockTest} lastRun={oneMinuteAgo} />);
    expect(screen.getByText(/Last run: 1m ago/)).toBeInTheDocument();

    rerender(<TestCard {...mockTest} lastRun={oneHourAgo} />);
    expect(screen.getByText(/Last run: 1h ago/)).toBeInTheDocument();

    rerender(<TestCard {...mockTest} lastRun={oneDayAgo} />);
    expect(screen.getByText(/Last run: 1d ago/)).toBeInTheDocument();

    rerender(<TestCard {...mockTest} lastRun={undefined} />);
    expect(screen.getByText('Last run: Never')).toBeInTheDocument();
  });

  it('handles run button click', () => {
    const handleRun = vi.fn();
    render(<TestCard {...mockTest} onRun={handleRun} />);
    
    const runButton = screen.getByRole('button', { name: /run/i });
    fireEvent.click(runButton);
    
    expect(handleRun).toHaveBeenCalledWith('test-1');
  });

  it('handles edit button click', () => {
    const handleEdit = vi.fn();
    render(<TestCard {...mockTest} onEdit={handleEdit} />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    
    expect(handleEdit).toHaveBeenCalledWith('test-1');
  });

  it('handles delete button click', () => {
    const handleDelete = vi.fn();
    render(<TestCard {...mockTest} onDelete={handleDelete} />);
    
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);
    
    expect(handleDelete).toHaveBeenCalledWith('test-1');
  });

  it('handles card click', () => {
    const handleClick = vi.fn();
    render(<TestCard {...mockTest} onClick={handleClick} />);
    
    const card = screen.getByText('Login Test').closest('div');
    fireEvent.click(card!);
    
    expect(handleClick).toHaveBeenCalledWith('test-1');
  });

  it('prevents event bubbling on button clicks', () => {
    const handleClick = vi.fn();
    const handleRun = vi.fn();
    
    render(<TestCard {...mockTest} onClick={handleClick} onRun={handleRun} />);
    
    const runButton = screen.getByRole('button', { name: /run/i });
    fireEvent.click(runButton);
    
    expect(handleRun).toHaveBeenCalledWith('test-1');
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('disables run button when test is running', () => {
    render(<TestCard {...mockTest} status="running" />);
    
    const runButton = screen.getByRole('button', { name: /running/i });
    expect(runButton).toBeDisabled();
  });

  it('shows different framework colors', () => {
    const { rerender } = render(<TestCard {...mockTest} framework="playwright" />);
    expect(screen.getByText('playwright')).toHaveClass('bg-green-100', 'text-green-800');

    rerender(<TestCard {...mockTest} framework="cypress" />);
    expect(screen.getByText('cypress')).toHaveClass('bg-blue-100', 'text-blue-800');

    rerender(<TestCard {...mockTest} framework="selenium" />);
    expect(screen.getByText('selenium')).toHaveClass('bg-purple-100', 'text-purple-800');
  });

  it('shows different test type colors', () => {
    const { rerender } = render(<TestCard {...mockTest} testType="e2e" />);
    expect(screen.getByText('e2e')).toHaveClass('bg-indigo-100', 'text-indigo-800');

    rerender(<TestCard {...mockTest} testType="integration" />);
    expect(screen.getByText('integration')).toHaveClass('bg-yellow-100', 'text-yellow-800');

    rerender(<TestCard {...mockTest} testType="unit" />);
    expect(screen.getByText('unit')).toHaveClass('bg-pink-100', 'text-pink-800');

    rerender(<TestCard {...mockTest} testType="api" />);
    expect(screen.getByText('api')).toHaveClass('bg-teal-100', 'text-teal-800');
  });

  it('applies custom className', () => {
    render(<TestCard {...mockTest} className="custom-card" />);
    
    const card = screen.getByText('Login Test').closest('div');
    expect(card).toHaveClass('custom-card');
  });

  it('truncates long test names', () => {
    const longName = 'This is a very long test name that should be truncated';
    render(<TestCard {...mockTest} name={longName} />);
    
    const nameElement = screen.getByText(longName);
    expect(nameElement).toHaveClass('truncate');
  });

  it('limits description to 2 lines', () => {
    const longDescription = 'This is a very long description that should be limited to two lines and show ellipsis when it exceeds the limit';
    render(<TestCard {...mockTest} description={longDescription} />);
    
    const descriptionElement = screen.getByText(longDescription);
    expect(descriptionElement).toHaveClass('line-clamp-2');
  });
});