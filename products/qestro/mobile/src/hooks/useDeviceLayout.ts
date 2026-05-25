import { useWindowDimensions } from 'react-native';

interface DeviceLayout {
  isTablet: boolean;
  isLandscape: boolean;
  columns: number;
  contentWidth: number;
}

const TABLET_MIN_WIDTH = 768;

export function useDeviceLayout(): DeviceLayout {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_MIN_WIDTH;
  const isLandscape = width > height;
  const columns = isTablet ? (isLandscape ? 3 : 2) : 1;
  const contentWidth = isTablet ? Math.min(width - 64, 960) : width;

  return { isTablet, isLandscape, columns, contentWidth };
}
