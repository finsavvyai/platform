import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApiSecurityClient } from './ApiSecurityClient';

describe('ApiSecurityClient', () => {
  it('renders page title and description', () => {
    render(<ApiSecurityClient />);
    expect(screen.getByText('API Security')).toBeInTheDocument();
    expect(screen.getByText(/Discover, monitor, and protect/)).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<ApiSecurityClient />);
    expect(screen.getByText('No API Security Data Yet')).toBeInTheDocument();
  });
});
