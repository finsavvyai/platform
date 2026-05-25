/**
 * Hook that returns the current color palette based on system appearance.
 */

import { useColorScheme } from 'react-native';
import { lightColors, darkColors, type ColorTokens } from '../theme/colors';

export function useThemeColors(): ColorTokens {
  const scheme = useColorScheme();
  return scheme === 'light' ? lightColors : darkColors;
}
