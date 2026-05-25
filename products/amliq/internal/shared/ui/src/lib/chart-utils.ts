/**
 * Chart utilities and helpers for data visualization
 */

import { ChartDataPoint, AnalyticsDataPoint, AnalyticsSeries } from '../components/charts';

// Color palettes for charts
export const CHART_COLORS = {
  primary: [
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#ec4899', // pink
  ],
  secondary: [
    '#14b8a6', // teal
    '#0ea5e9', // sky
    '#4f46e5', // indigo
    '#7c3aed', // violet
    '#d946ef', // fuchsia
  ],
  semantic: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',
  },
  gradients: {
    cyan: ['url(#gradient-cyan)', 'url(#gradient-cyan-light)'],
    blue: ['url(#gradient-blue)', 'url(#gradient-blue-light)'],
    indigo: ['url(#gradient-indigo)', 'url(#gradient-indigo-light)'],
  },
};

// Time range configurations
export const TIME_RANGES = {
  '1h': { label: '1 Hour', duration: 60 * 60 * 1000, interval: 60 * 1000 },
  '24h': { label: '24 Hours', duration: 24 * 60 * 60 * 1000, interval: 15 * 60 * 1000 },
  '7d': { label: '7 Days', duration: 7 * 24 * 60 * 60 * 1000, interval: 60 * 60 * 1000 },
  '30d': { label: '30 Days', duration: 30 * 24 * 60 * 60 * 1000, interval: 24 * 60 * 60 * 1000 },
  '90d': { label: '90 Days', duration: 90 * 24 * 60 * 60 * 1000, interval: 7 * 24 * 60 * 60 * 1000 },
};

// Data aggregation functions
export function aggregateDataByTimeRange(
  data: AnalyticsDataPoint[],
  timeRange: string,
  aggregationType: 'sum' | 'average' | 'max' | 'min' | 'count' = 'sum'
): AnalyticsDataPoint[] {
  const config = TIME_RANGES[timeRange as keyof typeof TIME_RANGES];
  if (!config) return data;

  const interval = config.interval;
  const aggregated = new Map<string, number[]>();

  // Group data by time intervals
  data.forEach(point => {
    const timestamp = new Date(point.timestamp);
    const roundedTime = Math.floor(timestamp.getTime() / interval) * interval;
    const key = new Date(roundedTime).toISOString();

    if (!aggregated.has(key)) {
      aggregated.set(key, []);
    }
    aggregated.get(key)!.push(point.value);
  });

  // Aggregate values
  return Array.from(aggregated.entries()).map(([timestamp, values]) => {
    let aggregatedValue = 0;

    switch (aggregationType) {
      case 'sum':
        aggregatedValue = values.reduce((sum, val) => sum + val, 0);
        break;
      case 'average':
        aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length;
        break;
      case 'max':
        aggregatedValue = Math.max(...values);
        break;
      case 'min':
        aggregatedValue = Math.min(...values);
        break;
      case 'count':
        aggregatedValue = values.length;
        break;
    }

    return {
      timestamp,
      value: aggregatedValue,
    };
  }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// Chart data transformation utilities
export function transformToChartData(
  data: any[],
  xKey: string,
  yKey: string,
  options?: {
    dateFormat?: string;
    valueTransform?: (value: any) => number;
    labelTransform?: (item: any) => string;
  }
): ChartDataPoint[] {
  return data.map(item => ({
    date: item[xKey],
    value: options?.valueTransform ? options.valueTransform(item[yKey]) : Number(item[yKey]) || 0,
    label: options?.labelTransform ? options.labelTransform(item) : item.label || item[xKey],
    category: item.category,
  }));
}

export function transformToAnalyticsSeries(
  data: any[],
  seriesConfig: Array<{
    key: string;
    name: string;
    color: string;
    type: 'line' | 'area' | 'bar';
    yAxisId?: 'left' | 'right';
  }>,
  xKey: string = 'timestamp'
): AnalyticsSeries[] {
  return seriesConfig.map(config => ({
    id: config.key,
    name: config.name,
    color: config.color,
    type: config.type,
    yAxisId: config.yAxisId,
    data: data.map(item => ({
      timestamp: item[xKey],
      value: Number(item[config.key]) || 0,
      category: item.category,
      metadata: item.metadata,
    })),
  }));
}

// Statistical utilities
export function calculateStatistics(values: number[]) {
  if (values.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, variance: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median,
    stdDev,
    min: Math.min(...values),
    max: Math.max(...values),
    variance,
  };
}

export function detectOutliers(values: number[], threshold: number = 2): number[] {
  const stats = calculateStatistics(values);
  return values.filter(value => Math.abs((value - stats.mean) / stats.stdDev) > threshold);
}

export function calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
  if (values.length < 2) return 'stable';

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));

  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

  const change = (secondAvg - firstAvg) / firstAvg;

  if (change > 0.05) return 'up';
  if (change < -0.05) return 'down';
  return 'stable';
}

export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
  const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

  const correlation = (n * sumXY - sumX * sumY) /
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return isNaN(correlation) ? 0 : correlation;
}

// Forecasting utilities
export function simpleLinearRegression(data: { x: number; y: number }[]) {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };

  const sumX = data.reduce((sum, point) => sum + point.x, 0);
  const sumY = data.reduce((sum, point) => sum + point.y, 0);
  const sumXY = data.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumX2 = data.reduce((sum, point) => sum + point.x * point.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const meanY = sumY / n;
  const ssTotal = data.reduce((sum, point) => sum + Math.pow(point.y - meanY, 2), 0);
  const ssResidual = data.reduce((sum, point) => {
    const predicted = slope * point.x + intercept;
    return sum + Math.pow(point.y - predicted, 2);
  }, 0);
  const r2 = 1 - (ssResidual / ssTotal);

  return { slope, intercept, r2 };
}

export function generateForecast(
  data: AnalyticsDataPoint[],
  periods: number = 7
): AnalyticsDataPoint[] {
  if (data.length < 2) return [];

  // Convert to numeric x values
  const numericData = data.map((point, index) => ({
    x: index,
    y: point.value,
  }));

  const regression = simpleLinearRegression(numericData);
  const lastTimestamp = new Date(data[data.length - 1].timestamp).getTime();
  const timeInterval = data.length > 1
    ? (lastTimestamp - new Date(data[0].timestamp).getTime()) / (data.length - 1)
    : 24 * 60 * 60 * 1000; // Default to 1 day

  const forecast: AnalyticsDataPoint[] = [];

  for (let i = 1; i <= periods; i++) {
    const futureX = numericData.length + i - 1;
    const predictedValue = regression.slope * futureX + regression.intercept;
    const futureTimestamp = lastTimestamp + (i * timeInterval);

    forecast.push({
      timestamp: new Date(futureTimestamp).toISOString(),
      value: Math.max(0, predictedValue), // Ensure non-negative values
      category: 'forecast',
    });
  }

  return forecast;
}

// Chart animation utilities
export const ANIMATION_CONFIG = {
  default: { duration: 1000, ease: 'easeOut' },
  fast: { duration: 500, ease: 'easeOut' },
  slow: { duration: 2000, ease: 'easeInOut' },
  bounce: { duration: 1200, ease: 'easeOut' },
};

export function getChartAnimation(type: 'default' | 'fast' | 'slow' | 'bounce' = 'default') {
  return ANIMATION_CONFIG[type];
}

// Data validation utilities
export function validateChartData(data: ChartDataPoint[]): boolean {
  return data.every(point =>
    point.date &&
    typeof point.value === 'number' &&
    !isNaN(point.value)
  );
}

export function validateAnalyticsData(data: AnalyticsDataPoint[]): boolean {
  return data.every(point =>
    point.timestamp &&
    typeof point.value === 'number' &&
    !isNaN(point.value) &&
    !isNaN(new Date(point.timestamp).getTime())
  );
}

// Formatting utilities for charts
export function formatChartLabel(
  value: string | number,
  type: 'date' | 'currency' | 'percentage' | 'number' = 'number',
  options?: Intl.NumberFormatOptions
): string {
  switch (type) {
    case 'date':
      return new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...options,
      });
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        ...options,
      }).format(Number(value));
    case 'percentage':
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        ...options,
      }).format(Number(value) / 100);
    default:
      return new Intl.NumberFormat('en-US', options).format(Number(value));
  }
}

// Color utilities
export function getChartColor(index: number, palette: keyof typeof CHART_COLORS = 'primary'): string {
  const colors = CHART_COLORS[palette];
  return colors[index % colors.length];
}

export function generateGradient(id: string, color: string, lightColor?: string): string {
  return `url(#gradient-${id})`;
}

// Responsive chart utilities
export function getResponsiveDimensions(
  containerWidth: number,
  aspectRatio: number = 16 / 9
): { width: number; height: number } {
  const width = containerWidth;
  const height = width / aspectRatio;
  return { width, height };
}

export function getBreakpointConfig(breakpoint: 'sm' | 'md' | 'lg' | 'xl') {
  const configs = {
    sm: { margin: { top: 5, right: 5, left: 5, bottom: 5 }, fontSize: 10 },
    md: { margin: { top: 5, right: 30, left: 20, bottom: 5 }, fontSize: 12 },
    lg: { margin: { top: 5, right: 30, left: 20, bottom: 5 }, fontSize: 12 },
    xl: { margin: { top: 5, right: 30, left: 20, bottom: 5 }, fontSize: 14 },
  };
  return configs[breakpoint];
}