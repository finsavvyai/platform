import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrustScoreIndicator } from './TrustScoreIndicator';

describe('TrustScoreIndicator', () => {
  it('shows unbound state when not bound', () => {
    render(<TrustScoreIndicator score={null} bound={false} />);
    expect(screen.getByText('Unbound')).toBeDefined();
  });

  it('shows unbound state when bound is false even with score', () => {
    render(<TrustScoreIndicator score={95} bound={false} />);
    expect(screen.getByText('Unbound')).toBeDefined();
  });

  it('shows green score for high trust', () => {
    render(<TrustScoreIndicator score={95} bound={true} />);
    expect(screen.getByText('95')).toBeDefined();
    expect(screen.getByText('Trust')).toBeDefined();
  });

  it('shows amber score for medium trust', () => {
    render(<TrustScoreIndicator score={65} bound={true} />);
    expect(screen.getByText('65')).toBeDefined();
  });

  it('shows red score for low trust', () => {
    render(<TrustScoreIndicator score={30} bound={true} />);
    expect(screen.getByText('30')).toBeDefined();
  });

  it('shows score of exactly 80 as green', () => {
    render(<TrustScoreIndicator score={80} bound={true} />);
    expect(screen.getByText('80')).toBeDefined();
  });

  it('shows score of exactly 50 as amber', () => {
    render(<TrustScoreIndicator score={50} bound={true} />);
    expect(screen.getByText('50')).toBeDefined();
  });
});
