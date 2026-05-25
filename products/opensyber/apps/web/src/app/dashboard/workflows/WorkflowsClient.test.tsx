import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkflowsClient } from './WorkflowsClient';

describe('WorkflowsClient', () => {
  it('renders the page heading', () => {
    render(<WorkflowsClient />);
    expect(screen.getByText('SOAR Workflows')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<WorkflowsClient />);
    expect(screen.getByText('No Workflows Yet')).toBeInTheDocument();
  });
});
