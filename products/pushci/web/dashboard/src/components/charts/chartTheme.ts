import { VictoryThemeDefinition } from 'victory';

const ZINC_700 = '#3f3f46';
const ZINC_500 = '#71717a';
const ZINC_400 = '#a1a1aa';

export const darkChartTheme: VictoryThemeDefinition = {
  axis: {
    style: {
      axis: { stroke: ZINC_700, strokeWidth: 1 },
      grid: { stroke: ZINC_700, strokeDasharray: '4,4' },
      tickLabels: { fill: ZINC_500, fontSize: 10, padding: 5 },
      axisLabel: { fill: ZINC_400, fontSize: 11, padding: 30 },
    },
  },
  chart: { padding: { top: 20, bottom: 40, left: 50, right: 20 } },
  line: {
    style: {
      data: { stroke: '#10b981', strokeWidth: 2 },
    },
  },
  bar: {
    style: {
      data: { fill: '#10b981' },
      labels: { fill: ZINC_400, fontSize: 10 },
    },
  },
  tooltip: {
    style: { fill: '#e4e4e7', fontSize: 11 },
    flyoutStyle: {
      fill: '#18181b',
      stroke: ZINC_700,
      strokeWidth: 1,
    },
  },
};

export const CHART_COLORS = {
  emerald: '#10b981',
  red: '#ef4444',
  zinc: '#71717a',
  amber: '#f59e0b',
  sky: '#0ea5e9',
} as const;
