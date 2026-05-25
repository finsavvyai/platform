import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { OfflineBanner } from '@/components/molecules/OfflineBanner';

describe('OfflineBanner', () => {
  it('should not render when not visible', () => {
    const { toJSON } = render(<OfflineBanner visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it('should render warning text when visible', () => {
    render(<OfflineBanner visible={true} />);
    expect(screen.getByText(/You are offline/)).toBeTruthy();
  });

  it('should have alert accessibility role', () => {
    render(<OfflineBanner visible={true} />);
    expect(screen.getByLabelText('You are offline')).toBeTruthy();
  });
});
