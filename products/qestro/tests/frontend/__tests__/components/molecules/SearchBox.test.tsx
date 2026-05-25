import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SearchBox } from '../../../../../frontend/src/components/molecules';

describe('SearchBox Component', () => {
  it('renders with default props', () => {
    render(<SearchBox />);
    
    const input = screen.getByPlaceholderText('Search...');
    expect(input).toBeInTheDocument();
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });

  it('handles value changes', () => {
    const handleChange = vi.fn();
    render(<SearchBox onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test query' } });
    
    expect(handleChange).toHaveBeenCalledWith('test query');
  });

  it('handles search on Enter key', () => {
    const handleSearch = vi.fn();
    render(<SearchBox onSearch={handleSearch} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'search term' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });
    
    expect(handleSearch).toHaveBeenCalledWith('search term');
  });

  it('shows clear button when there is a value', () => {
    render(<SearchBox value="test" />);
    
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('handles clear action', () => {
    const handleChange = vi.fn();
    const handleClear = vi.fn();
    
    render(<SearchBox value="test" onChange={handleChange} onClear={handleClear} />);
    
    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);
    
    expect(handleClear).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('shows filter button when showFilter is true', () => {
    const handleFilterClick = vi.fn();
    render(<SearchBox showFilter onFilterClick={handleFilterClick} />);
    
    const filterButton = screen.getByRole('button', { name: /filter/i });
    expect(filterButton).toBeInTheDocument();
    
    fireEvent.click(filterButton);
    expect(handleFilterClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    render(<SearchBox isLoading />);
    
    expect(screen.getByTestId('loading-search-icon')).toBeInTheDocument();
  });

  it('displays suggestions when available', async () => {
    const suggestions = ['suggestion 1', 'suggestion 2', 'suggestion 3'];
    render(<SearchBox suggestions={suggestions} value="sug" />);
    
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    
    await waitFor(() => {
      expect(screen.getByText('suggestion 1')).toBeInTheDocument();
      expect(screen.getByText('suggestion 2')).toBeInTheDocument();
      expect(screen.getByText('suggestion 3')).toBeInTheDocument();
    });
  });

  it('filters suggestions based on input value', async () => {
    const suggestions = ['apple', 'banana', 'apricot'];
    render(<SearchBox suggestions={suggestions} value="ap" />);
    
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    
    await waitFor(() => {
      expect(screen.getByText('apple')).toBeInTheDocument();
      expect(screen.getByText('apricot')).toBeInTheDocument();
      expect(screen.queryByText('banana')).not.toBeInTheDocument();
    });
  });

  it('handles suggestion click', async () => {
    const handleChange = vi.fn();
    const handleSearch = vi.fn();
    const suggestions = ['suggestion 1', 'suggestion 2'];
    
    render(
      <SearchBox
        suggestions={suggestions}
        value="sug"
        onChange={handleChange}
        onSearch={handleSearch}
      />
    );
    
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    
    await waitFor(() => {
      const suggestion = screen.getByText('suggestion 1');
      fireEvent.click(suggestion);
    });
    
    expect(handleChange).toHaveBeenCalledWith('suggestion 1');
    expect(handleSearch).toHaveBeenCalledWith('suggestion 1');
  });

  it('hides suggestions on Escape key', async () => {
    const suggestions = ['suggestion 1', 'suggestion 2'];
    render(<SearchBox suggestions={suggestions} value="sug" />);
    
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    
    await waitFor(() => {
      expect(screen.getByText('suggestion 1')).toBeInTheDocument();
    });
    
    fireEvent.keyPress(input, { key: 'Escape', code: 'Escape' });
    
    await waitFor(() => {
      expect(screen.queryByText('suggestion 1')).not.toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    render(<SearchBox className="custom-search" />);
    
    expect(screen.getByRole('textbox').closest('.custom-search')).toBeInTheDocument();
  });

  it('uses custom placeholder', () => {
    render(<SearchBox placeholder="Search for items..." />);
    
    expect(screen.getByPlaceholderText('Search for items...')).toBeInTheDocument();
  });
});