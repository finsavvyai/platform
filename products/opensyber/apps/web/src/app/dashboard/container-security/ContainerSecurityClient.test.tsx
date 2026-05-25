import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContainerSecurityClient } from './ContainerSecurityClient';

describe('ContainerSecurityClient', () => {
  it('renders page title and description', () => {
    render(<ContainerSecurityClient />);
    expect(screen.getByText('Container Security')).toBeInTheDocument();
    expect(
      screen.getByText(/Scans container images for vulnerabilities/)
    ).toBeInTheDocument();
  });

  it('shows empty state when no container data is present', () => {
    render(<ContainerSecurityClient />);
    expect(screen.getByText('No Container Security Data Yet')).toBeInTheDocument();
  });
});
