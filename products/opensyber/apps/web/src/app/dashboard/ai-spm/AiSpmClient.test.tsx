import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiSpmClient } from './AiSpmClient';

describe('AiSpmClient', () => {
  it('renders the page heading', () => {
    render(<AiSpmClient />);
    expect(screen.getByText('AI Security Posture Management')).toBeInTheDocument();
  });

  it('shows empty state when no models are present', () => {
    render(<AiSpmClient />);
    expect(screen.getByText('No AI Security Data Yet')).toBeInTheDocument();
  });
});
