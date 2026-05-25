import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MitreAttackClient } from './MitreAttackClient';

describe('MitreAttackClient', () => {
  it('renders page heading', () => {
    render(<MitreAttackClient />);
    expect(screen.getByText('MITRE ATT&CK Coverage')).toBeInTheDocument();
  });

  it('shows empty state when no tactics data is present', () => {
    render(<MitreAttackClient />);
    expect(screen.getByText('No MITRE ATT&CK Data Yet')).toBeInTheDocument();
  });
});
