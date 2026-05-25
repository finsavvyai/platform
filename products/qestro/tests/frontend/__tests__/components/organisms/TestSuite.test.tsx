import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TestSuite } from '../../../../../frontend/src/components/organisms';

const mockTests = [
  {
    id: 'test-1',
    name: 'Login Test',
    description: 'Test user login functionality',
    status: 'passed' as const,
    lastRun: new Date('2024-01-15T10:30:00Z'),
    duration: 2500,
    framework: 'playwright' as const,
    testType: 'e2e' as const,
    tags: ['auth', 'critical'],
  },
  {
    id: 'test-2',
    name: 'Registration Test',
    description: 'Test user registration flow',
    status: 'failed' as const,
    lastRun: new Date('2024-01-15T09:15:00Z'),
    duration: 3200,
    framework: 'cypress' as const,
    testType: 'e2e' as const,
    tags: ['auth'],
  },
  {
    id: 'test-3',
    name: 'API Test',
    description: 'Test API endpoints',
    status: 'running' as const,
    lastRun: new Date('2024-01-15T11:00:00Z'),
    duration: 1800,
    framework: 'playwright' as const,
    testType: 'api' as const,
    tags: ['api'],
  },
];

describe('TestSuite Component', () => {
  it('renders test suite with correct statistics', () => {
    render(<TestSuite tests={mockTests} title="My Test Suite" />);
    
    expect(screen.getByText('My Test Suite')).toBeInTheDocument();
    expect(screen.getByText('3 tests • 1 passed • 1 failed')).toBeInTheDocument();
    expect(screen.getByText('1 Passed')).toBeInTheDocument();
    expect(screen.getByText('1 Failed')).toBeInTheDocument();
    expect(screen.getByText('1 Running')).toBeInTheDocument();
  });

  it('displays all test cards', () => {
    render(<TestSuite tests={mockTests} />);
    
    expect(screen.getByText('Login Test')).toBeInTheDocument();
    expect(screen.getByText('Registration Test')).toBeInTheDocument();
    expect(screen.getByText('API Test')).toBeInTheDocument();
  });

  it('handles run all button click', () => {
    const handleRunAll = vi.fn();
    render(<TestSuite tests={mockTests} onRunAll={handleRunAll} />);
    
    const runAllButton = screen.getByRole('button', { name: /run all/i });
    fireEvent.click(runAllButton);
    
    expect(handleRunAll).toHaveBeenCalledTimes(1);
  });

  it('shows stop all button when tests are running', () => {
    render(<TestSuite tests={mockTests} />);
    
    expect(screen.getByRole('button', { name: /stop all/i })).toBeInTheDocument();
  });

  it('handles create test button click', () => {
    const handleCreateTest = vi.fn();
    render(<TestSuite tests={mockTests} onCreateTest={handleCreateTest} />);
    
    const createButton = screen.getByRole('button', { name: /new test/i });
    fireEvent.click(createButton);
    
    expect(handleCreateTest).toHaveBeenCalledTimes(1);
  });

  it('filters tests by search query', async () => {
    render(<TestSuite tests={mockTests} />);
    
    const searchInput = screen.getByPlaceholderText('Search tests...');
    fireEvent.change(searchInput, { target: { value: 'login' } });
    
    await waitFor(() => {
      expect(screen.getByText('Login Test')).toBeInTheDocument();
      expect(screen.queryByText('Registration Test')).not.toBeInTheDocument();
      expect(screen.queryByText('API Test')).not.toBeInTheDocument();
    });
  });

  it('filters tests by status', async () => {
    render(<TestSuite tests={mockTests} />);
    
    // Open filters
    const filterButton = screen.getByRole('button', { name: /filter/i });
    fireEvent.click(filterButton);
    
    await waitFor(() => {
      const statusSelect = screen.getByDisplayValue('All');
      fireEvent.change(statusSelect, { target: { value: 'passed' } });
    });
    
    await waitFor(() => {
      expect(screen.getByText('Login Test')).toBeInTheDocument();
      expect(screen.queryByText('Registration Test')).not.toBeInTheDocument();
      expect(screen.queryByText('API Test')).not.toBeInTheDocument();
    });
  });

  it('sorts tests by different criteria', async () => {
    render(<TestSuite tests={mockTests} />);
    
    // Open filters
    const filterButton = screen.getByRole('button', { name: /filter/i });
    fireEvent.click(filterButton);
    
    await waitFor(() => {
      const sortSelect = screen.getByDisplayValue('Name');
      fireEvent.change(sortSelect, { target: { value: 'status' } });
    });
    
    // Tests should be reordered by status
    const testCards = screen.getAllByText(/Test$/);
    expect(testCards[0]).toHaveTextContent('Registration Test'); // failed comes first alphabetically
  });

  it('toggles between grid and list view', () => {
    render(<TestSuite tests={mockTests} />);
    
    const listViewButton = screen.getByRole('button', { name: /list view/i });
    fireEvent.click(listViewButton);
    
    // Check if the container has list view classes
    const container = screen.getByText('Login Test').closest('.space-y-4');
    expect(container).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<TestSuite tests={[]} isLoading />);
    
    expect(screen.getByText('Loading tests...')).toBeInTheDocument();
  });

  it('shows empty state when no tests', () => {
    render(<TestSuite tests={[]} />);
    
    expect(screen.getByText('No tests found')).toBeInTheDocument();
    expect(screen.getByText('Create Your First Test')).toBeInTheDocument();
  });

  it('shows filtered empty state', async () => {
    render(<TestSuite tests={mockTests} />);
    
    const searchInput = screen.getByPlaceholderText('Search tests...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    await waitFor(() => {
      expect(screen.getByText('No tests match your filters')).toBeInTheDocument();
    });
  });

  it('handles individual test actions', () => {
    const handleRunTest = vi.fn();
    const handleEditTest = vi.fn();
    const handleDeleteTest = vi.fn();
    
    render(
      <TestSuite
        tests={mockTests}
        onRunTest={handleRunTest}
        onEditTest={handleEditTest}
        onDeleteTest={handleDeleteTest}
      />
    );
    
    // Find the first test's run button
    const runButtons = screen.getAllByRole('button', { name: /run/i });
    fireEvent.click(runButtons[0]);
    expect(handleRunTest).toHaveBeenCalledWith('test-1');
    
    // Find the first test's edit button
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);
    expect(handleEditTest).toHaveBeenCalledWith('test-1');
    
    // Find the first test's delete button
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);
    expect(handleDeleteTest).toHaveBeenCalledWith('test-1');
  });

  it('handles test card clicks', () => {
    const handleTestClick = vi.fn();
    render(<TestSuite tests={mockTests} onTestClick={handleTestClick} />);
    
    const testCard = screen.getByText('Login Test').closest('div');
    fireEvent.click(testCard!);
    
    expect(handleTestClick).toHaveBeenCalledWith('test-1');
  });

  it('applies custom className', () => {
    render(<TestSuite tests={mockTests} className="custom-suite" />);
    
    const container = screen.getByText('Test Suite').closest('.custom-suite');
    expect(container).toBeInTheDocument();
  });

  it('searches in test descriptions and tags', async () => {
    render(<TestSuite tests={mockTests} />);
    
    const searchInput = screen.getByPlaceholderText('Search tests...');
    fireEvent.change(searchInput, { target: { value: 'critical' } });
    
    await waitFor(() => {
      expect(screen.getByText('Login Test')).toBeInTheDocument();
      expect(screen.queryByText('Registration Test')).not.toBeInTheDocument();
      expect(screen.queryByText('API Test')).not.toBeInTheDocument();
    });
  });
});