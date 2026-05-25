import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ExecutiveClient } from './ExecutiveClient';

describe('ExecutiveClient', () => {
  it('renders the page title', () => {
    render(<ExecutiveClient />);
    expect(screen.getByText('Executive Dashboard')).toBeInTheDocument();
  });

  it('renders empty state when no data', async () => {
    render(<ExecutiveClient />);
    expect(await screen.findByText('No Executive Data Yet')).toBeInTheDocument();
  });
});
