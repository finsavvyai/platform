import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecurityGraphClient } from './SecurityGraphClient';

describe('SecurityGraphClient', () => {
  it('renders the page title', () => {
    render(<SecurityGraphClient />);
    expect(screen.getByText('Security Graph')).toBeDefined();
  });

  it('renders empty state when no data', async () => {
    render(<SecurityGraphClient />);
    expect(await screen.findByText('No Security Graph Data Yet')).toBeDefined();
  });
});
