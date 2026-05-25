import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StorylinesClient } from './StorylinesClient';

describe('StorylinesClient', () => {
  it('renders page title and description', () => {
    render(<StorylinesClient />);
    expect(screen.getByText('Storyline Attack Reconstruction')).toBeInTheDocument();
    expect(screen.getByText(/Automatically correlates processes/)).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<StorylinesClient />);
    expect(screen.getByText('No Attack Storylines Yet')).toBeInTheDocument();
  });
});
