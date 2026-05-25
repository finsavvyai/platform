/**
 * Apple Human Interface Guidelines Constants for QueryFlux Mobile
 *
 * This file contains design system constants based on Apple's HIG
 * to ensure consistent, premium iOS user experience.
 */

import { Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Typography Scale - Apple's Dynamic Type
export const Typography = {
  // Large Title
  largeTitle: {
    fontSize: 34,
    fontWeight: '700' as const,
    lineHeight: 41,
    letterSpacing: 0.37,
  },
  // Title 1
  title1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: 0.36,
  },
  // Title 2
  title2: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: 0.35,
  },
  // Title 3
  title3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 25,
    letterSpacing: 0.38,
  },
  // Headline
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: -0.43,
  },
  // Body
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 22,
    letterSpacing: -0.43,
  },
  // Callout
  callout: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 21,
    letterSpacing: -0.32,
  },
  // Subhead
  subhead: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: -0.24,
  },
  // Footnote
  footnote: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    letterSpacing: -0.08,
  },
  // Caption 1
  caption1: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    letterSpacing: 0,
  },
  // Caption 2
  caption2: {
    fontSize: 11,
    fontWeight: '400' as const,
    lineHeight: 13,
    letterSpacing: 0.07,
  },
} as const;

// Spacing System - Apple's 8pt grid
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// Touch Targets - Apple HIG minimums
export const TouchTargets = {
  minimum: 44, // Minimum touch target size for all interactive elements
  buttonHeight: 44,
  iconButton: 44,
  tabHeight: 50,
  listRowHeight: 44,
  searchBarHeight: 44,
} as const;

// Border Radius - Apple HIG corner radius
export const BorderRadius = {
  small: 6,
  medium: 8,
  large: 12,
  xlarge: 16,
  sheet: 16, // Modal sheets
  button: 8,
  input: 10,
  card: 12,
  searchField: 20,
  navigationBar: 0,
  tabBar: 0,
} as const;

// Shadows - Apple HIG depth levels
export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

// Animations - Apple HIG timing curves
export const Animations = {
  duration: {
    instant: 0,
    fast: 150,
    standard: 300,
    slow: 500,
  },
  easing: {
    // iOS default easing curve
    easeInOut: 'cubic-bezier(0.42, 0.0, 0.58, 1.0)',
    // Spring animations
    spring: {
      tension: 65,
      friction: 11,
    },
    // Standard curves
    easeOut: 'cubic-bezier(0.0, 0.0, 0.58, 1.0)',
    easeIn: 'cubic-bezier(0.42, 0.0, 1.0, 1.0)',
  },
} as const;

// Modal Sheet Heights - Apple HIG snap points
export const ModalSheets = {
  small: SCREEN_HEIGHT * 0.25,
  medium: SCREEN_HEIGHT * 0.5,
  large: SCREEN_HEIGHT * 0.75,
  full: SCREEN_HEIGHT * 0.95,
  search: SCREEN_HEIGHT * 0.9,
  share: SCREEN_HEIGHT * 0.4,
  action: SCREEN_HEIGHT * 0.3,
} as const;

// Navigation Bar - Apple HIG specs
export const NavigationBar = {
  height: 44,
  statusBarHeight: 44, // iOS status bar
  totalHeight: 88,
  largeTitleHeight: 96,
  padding: 16,
  iconSize: 24,
  titleFontSize: 17,
  largeTitleFontSize: 34,
} as const;

// Tab Bar - Apple HIG specs
export const TabBar = {
  height: 50,
  iconSize: 24,
  badgeSize: 16,
  activeOpacity: 1.0,
  inactiveOpacity: 0.6,
  animationDuration: 200,
} as const;

// Lists - Apple HIG specs
export const Lists = {
  rowHeight: 44,
  groupedPadding: 16,
  groupedRadius: 10,
  insetGroupedPadding: 32,
  separatorHeight: StyleSheet.hairlineWidth,
  iconSize: 24,
  disclosureIconSize: 16,
  switchWidth: 51,
  switchHeight: 31,
} as const;

// Search Bar - Apple HIG specs
export const SearchBar = {
  height: 44,
  borderRadius: 10,
  iconSize: 16,
  clearButtonSize: 16,
  placeholderOpacity: 0.6,
  animationDuration: 200,
} as const;

// Buttons - Apple HIG specs
export const Buttons = {
  heights: {
    small: 32,
    medium: 44,
    large: 50,
  },
  borderRadius: {
    small: 6,
    medium: 8,
    large: 12,
  },
  padding: {
    small: 16,
    medium: 24,
    large: 32,
  },
  fontSize: {
    small: 14,
    medium: 16,
    large: 18,
  },
  activeOpacity: 0.6,
} as const;

// Form Controls - Apple HIG specs
export const FormControls = {
  inputHeight: 44,
  inputBorderRadius: 10,
  labelFontSize: 14,
  labelSpacing: 4,
  errorFontSize: 12,
  helperFontSize: 12,
  switchWidth: 51,
  switchHeight: 31,
  sliderHeight: 44,
  stepperHeight: 29,
  stepperWidth: 95,
} as const;

// Accessibility - Apple HIG guidelines
export const Accessibility = {
  minimumTouchTarget: 44,
  colorContrastRatio: 4.5, // WCAG AA standard
  reducedMotionScale: 0.3,
  hapticFeedback: {
    light: 'impactLight',
    medium: 'impactMedium',
    heavy: 'impactHeavy',
    success: 'notificationSuccess',
    warning: 'notificationWarning',
    error: 'notificationError',
  },
} as const;

// Colors - Apple HIG semantic colors
export const SemanticColors = {
  // System colors
  systemBlue: '#007AFF',
  systemGreen: '#34C759',
  systemIndigo: '#5856D6',
  systemOrange: '#FF9500',
  systemPink: '#FF2D92',
  systemPurple: '#AF52DE',
  systemRed: '#FF3B30',
  systemTeal: '#5AC8FA',
  systemYellow: '#FFCC00',

  // Gray scale
  systemGray: '#8E8E93',
  systemGray2: '#AEAEB2',
  systemGray3: '#C7C7CC',
  systemGray4: '#D1D1D6',
  systemGray5: '#E5E5EA',
  systemGray6: '#F2F2F7',

  // Background colors
  systemBackground: '#FFFFFF',
  secondarySystemBackground: '#F2F2F7',
  tertiarySystemBackground: '#FFFFFF',

  // Grouped background colors
  systemGroupedBackground: '#F2F2F7',
  secondarySystemGroupedBackground: '#FFFFFF',
  tertiarySystemGroupedBackground: '#F2F2F7',

  // Fill colors
  systemFill: '#78788033',
  secondarySystemFill: '#78788028',
  tertiarySystemFill: '#7676801E',
  quaternarySystemFill: '#74748014',

  // Text colors
  label: '#000000',
  secondaryLabel: '#3C3C4399',
  tertiaryLabel: '#3C3C4366',
  quaternaryLabel: '#3C3C434E',

  // Separator colors
  separator: '#3C3C434A',
  opaqueSeparator: '#C6C6C8',
} as const;

// Platform-specific adaptations
export const Platform = {
  iOS: {
    // iOS specific values
    statusBarHeight: 44,
    homeIndicatorHeight: 34,
    safeAreaInsets: {
      top: 44,
      bottom: 34,
      left: 0,
      right: 0,
    },
  },
  // Android adaptations would go here
} as const;

// Breakpoints for responsive design
export const Breakpoints = {
  small: SCREEN_WIDTH < 375, // iPhone SE
  medium: SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414, // iPhone 12/13
  large: SCREEN_WIDTH >= 414, // iPhone 12/13 Plus/Max
  tablet: SCREEN_WIDTH >= 768, // iPad
} as const;

export default {
  Typography,
  Spacing,
  TouchTargets,
  BorderRadius,
  Shadows,
  Animations,
  ModalSheets,
  NavigationBar,
  TabBar,
  Lists,
  SearchBar,
  Buttons,
  FormControls,
  Accessibility,
  SemanticColors,
  Platform,
  Breakpoints,
} as const;