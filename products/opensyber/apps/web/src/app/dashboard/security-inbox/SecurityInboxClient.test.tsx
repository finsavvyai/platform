import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecurityInboxClient } from './SecurityInboxClient';

describe('SecurityInboxClient', () => {
  it('renders heading', () => {
    render(<SecurityInboxClient />);
    expect(screen.getByText('Security Inbox')).toBeInTheDocument();
  });

  it('renders empty state when no data', async () => {
    render(<SecurityInboxClient />);
    expect(await screen.findByText('No Security Inbox Data Yet')).toBeInTheDocument();
  });
});
