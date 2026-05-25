/**
 * Shared Victory chart theme and color palette for OpenSyber dashboards.
 * Matches the neutral-900 dark design system.
 */

import { VictoryTheme } from 'victory';

export const COLORS = {
  blue: '#3b82f6',
  cyan: '#06b6d4',
  green: '#22c55e',
  amber: '#f59e0b',
  rose: '#f43f5e',
  teal: '#00E5C3',
  purple: '#a855f7',
  neutral400: '#a3a3a3',
  neutral600: '#525252',
  neutral800: '#262626',
  neutral900: '#171717',
} as const;

export const PIE_PALETTE = [
  COLORS.blue,
  COLORS.cyan,
  COLORS.green,
  COLORS.amber,
  COLORS.rose,
  COLORS.purple,
];

export const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#22C55E',
  info: '#6B7280',
};

export const darkTheme = {
  ...VictoryTheme.grayscale,
  axis: {
    ...VictoryTheme.grayscale.axis,
    style: {
      axis: { stroke: COLORS.neutral600 },
      grid: { stroke: COLORS.neutral800, strokeDasharray: '4,4' },
      tickLabels: { fill: COLORS.neutral400, fontSize: 10 },
      axisLabel: { fill: COLORS.neutral400, fontSize: 12, padding: 30 },
    },
  },
};

export const CHART_PADDING = { top: 20, bottom: 40, left: 50, right: 20 };
export const CHART_HEIGHT = 220;
