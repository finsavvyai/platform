import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToxicCombinationsClient } from './ToxicCombinationsClient';

describe('ToxicCombinationsClient', () => {
  it('renders page title', () => {
    render(<ToxicCombinationsClient />);
    expect(screen.getByText('Toxic Combinations')).toBeInTheDocument();
  });

  it('renders empty state when no data', async () => {
    render(<ToxicCombinationsClient />);
    expect(await screen.findByText('No Toxic Combinations Data Yet')).toBeInTheDocument();
  });
});
