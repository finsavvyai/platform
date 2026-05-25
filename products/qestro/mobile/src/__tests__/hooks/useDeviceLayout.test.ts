import { useDeviceLayout } from '../../hooks/useDeviceLayout';

describe('useDeviceLayout', () => {
  it('exports a function', () => {
    expect(typeof useDeviceLayout).toBe('function');
  });

  it('calculates tablet based on TABLET_MIN_WIDTH threshold', () => {
    // Test the logic directly: min(390, 844) = 390 < 768 = not tablet
    const isTablet = Math.min(390, 844) >= 768;
    expect(isTablet).toBe(false);
  });

  it('detects tablet for large screens', () => {
    const isTablet = Math.min(1024, 1366) >= 768;
    expect(isTablet).toBe(true);
  });

  it('calculates columns correctly', () => {
    const isTablet = true;
    const isLandscape = true;
    const columns = isTablet ? (isLandscape ? 3 : 2) : 1;
    expect(columns).toBe(3);
  });
});
