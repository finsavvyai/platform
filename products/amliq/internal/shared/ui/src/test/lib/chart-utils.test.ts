/**
 * Chart utilities tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CHART_COLORS,
  TIME_RANGES,
  aggregateDataByTimeRange,
  transformToChartData,
  transformToAnalyticsSeries,
  calculateStatistics,
  detectOutliers,
  calculateTrend,
  calculateCorrelation,
  simpleLinearRegression,
  generateForecast,
  validateChartData,
  validateAnalyticsData,
  formatChartLabel,
  getChartColor,
  calculateTrend as calculateChartTrend,
} from '../../lib/chart-utils';
import { AnalyticsDataPoint, AnalyticsSeries } from '../../components/charts';

describe('Chart Utilities', () => {
  const mockAnalyticsData: AnalyticsDataPoint[] = [
    { timestamp: '2023-12-01T00:00:00Z', value: 100 },
    { timestamp: '2023-12-01T01:00:00Z', value: 120 },
    { timestamp: '2023-12-01T02:00:00Z', value: 110 },
    { timestamp: '2023-12-01T03:00:00Z', value: 130 },
    { timestamp: '2023-12-01T04:00:00Z', value: 125 },
  ];

  const mockSeriesData = [
    { timestamp: '2023-12-01', revenue: 1000, users: 50, category: 'growth' },
    { timestamp: '2023-12-02', revenue: 1200, users: 60, category: 'growth' },
    { timestamp: '2023-12-03', revenue: 1100, users: 55, category: 'decline' },
    { timestamp: '2023-12-04', revenue: 1300, users: 65, category: 'growth' },
  ];

  beforeEach(() => {
    // Reset test data before each test
  });

  describe('CHART_COLORS', () => {
    it('contains expected color palettes', () => {
      expect(CHART_COLORS.primary).toHaveLength(5);
      expect(CHART_COLORS.secondary).toHaveLength(5);
      expect(CHART_COLORS.semantic).toHaveProperty('success');
      expect(CHART_COLORS.semantic).toHaveProperty('warning');
      expect(CHART_COLORS.semantic).toHaveProperty('error');
      expect(CHART_COLORS.semantic).toHaveProperty('info');
    });

    it('contains valid hex colors', () => {
      const allColors = [
        ...CHART_COLORS.primary,
        ...CHART_COLORS.secondary,
        Object.values(CHART_COLORS.semantic),
      ];

      allColors.forEach(color => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });
  });

  describe('TIME_RANGES', () => {
    it('contains expected time ranges', () => {
      expect(TIME_RANGES).toHaveProperty('1h');
      expect(TIME_RANGES).toHaveProperty('24h');
      expect(TIME_RANGES).toHaveProperty('7d');
      expect(TIME_RANGES).toHaveProperty('30d');
      expect(TIME_RANGES).toHaveProperty('90d');
    });

    it('has correct duration values', () => {
      expect(TIME_RANGES['1h'].duration).toBe(60 * 60 * 1000);
      expect(TIME_RANGES['24h'].duration).toBe(24 * 60 * 60 * 1000);
      expect(TIME_RANGES['7d'].duration).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('aggregateDataByTimeRange', () => {
    it('aggregates data by sum', () => {
      const result = aggregateDataByTimeRange(mockAnalyticsData, '1h', 'sum');
      expect(result).toHaveLength(5);
      expect(result[0].value).toBe(100);
    });

    it('aggregates data by average', () => {
      const testData = [
        { timestamp: '2023-12-01T00:00:00Z', value: 100 },
        { timestamp: '2023-12-01T00:30:00Z', value: 200 },
        { timestamp: '2023-12-01T01:00:00Z', value: 150 },
      ];

      const result = aggregateDataByTimeRange(testData, '1h', 'average');
      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(150); // (100 + 200) / 2
    });

    it('aggregates data by max', () => {
      const result = aggregateDataByTimeRange(mockAnalyticsData, '1h', 'max');
      expect(result).toHaveLength(5);
      expect(Math.max(...result.map(r => r.value))).toBe(130);
    });

    it('aggregates data by min', () => {
      const result = aggregateDataByTimeRange(mockAnalyticsData, '1h', 'min');
      expect(result).toHaveLength(5);
      expect(Math.min(...result.map(r => r.value))).toBe(100);
    });

    it('aggregates data by count', () => {
      const result = aggregateDataByTimeRange(mockAnalyticsData, '1h', 'count');
      expect(result).toHaveLength(5);
      expect(result[0].value).toBe(1);
    });

    it('handles empty data', () => {
      const result = aggregateDataByTimeRange([], '1h', 'sum');
      expect(result).toHaveLength(0);
    });

    it('returns data sorted by timestamp', () => {
      const result = aggregateDataByTimeRange(mockAnalyticsData, '1h', 'sum');
      const timestamps = result.map(r => new Date(r.timestamp).getTime());
      expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
    });
  });

  describe('transformToChartData', () => {
    it('transforms data correctly', () => {
      const result = transformToChartData(mockSeriesData, 'timestamp', 'revenue');

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({
        date: '2023-12-01',
        value: 1000,
        label: '2023-12-01',
        category: 'growth',
      });
    });

    it('applies value transform', () => {
      const result = transformToChartData(
        mockSeriesData,
        'timestamp',
        'revenue',
        { valueTransform: (val) => val * 2 }
      );

      expect(result[0].value).toBe(2000);
    });

    it('applies label transform', () => {
      const result = transformToChartData(
        mockSeriesData,
        'timestamp',
        'revenue',
        { labelTransform: (item) => `Day: ${item.timestamp}` }
      );

      expect(result[0].label).toBe('Day: 2023-12-01');
    });

    it('handles missing values', () => {
      const dataWithMissing = [
        { timestamp: '2023-12-01', revenue: null },
        { timestamp: '2023-12-02', revenue: undefined },
        { timestamp: '2023-12-03', revenue: 'invalid' },
      ];

      const result = transformToChartData(dataWithMissing, 'timestamp', 'revenue');

      expect(result[0].value).toBe(0);
      expect(result[1].value).toBe(0);
      expect(result[2].value).toBe(0);
    });
  });

  describe('transformToAnalyticsSeries', () => {
    it('transforms to analytics series', () => {
      const seriesConfig = [
        { key: 'revenue', name: 'Revenue', color: '#06b6d4', type: 'line' as const },
        { key: 'users', name: 'Users', color: '#3b82f6', type: 'bar' as const },
      ];

      const result = transformToAnalyticsSeries(mockSeriesData, seriesConfig);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('revenue');
      expect(result[0].name).toBe('Revenue');
      expect(result[0].data).toHaveLength(4);
      expect(result[0].data[0].value).toBe(1000);
    });

    it('handles custom xKey', () => {
      const data = [
        { date: '2023-12-01', value: 100 },
        { date: '2023-12-02', value: 200 },
      ];

      const seriesConfig = [
        { key: 'value', name: 'Value', color: '#06b6d4', type: 'line' as const },
      ];

      const result = transformToAnalyticsSeries(data, seriesConfig, 'date');

      expect(result[0].data[0].timestamp).toBe('2023-12-01');
    });

    it('includes metadata in data points', () => {
      const dataWithMeta = [
        { timestamp: '2023-12-01', value: 100, metadata: { source: 'api' } },
      ];

      const seriesConfig = [
        { key: 'value', name: 'Value', color: '#06b6d4', type: 'line' as const },
      ];

      const result = transformToAnalyticsSeries(dataWithMeta, seriesConfig);

      expect(result[0].data[0].metadata).toEqual({ source: 'api' });
    });
  });

  describe('calculateStatistics', () => {
    it('calculates basic statistics', () => {
      const values = [1, 2, 3, 4, 5];
      const stats = calculateStatistics(values);

      expect(stats.mean).toBe(3);
      expect(stats.median).toBe(3);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(5);
      expect(stats.variance).toBe(2);
      expect(stats.stdDev).toBe(Math.sqrt(2));
    });

    it('handles empty array', () => {
      const stats = calculateStatistics([]);

      expect(stats.mean).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.stdDev).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.variance).toBe(0);
    });

    it('calculates median correctly for even length', () => {
      const values = [1, 2, 3, 4];
      const stats = calculateStatistics(values);

      expect(stats.median).toBe(2.5);
    });

    it('calculates median correctly for odd length', () => {
      const values = [1, 2, 3, 4, 5];
      const stats = calculateStatistics(values);

      expect(stats.median).toBe(3);
    });
  });

  describe('detectOutliers', () => {
    it('detects outliers using z-score', () => {
      const values = [10, 12, 13, 14, 15, 16, 18, 100]; // 100 is an outlier
      const outliers = detectOutliers(values, 2);

      expect(outliers).toContain(100);
      expect(outliers).toHaveLength(1);
    });

    it('handles empty array', () => {
      const outliers = detectOutliers([]);
      expect(outliers).toHaveLength(0);
    });

    it('adjusts threshold sensitivity', () => {
      const values = [10, 12, 13, 14, 15, 25]; // 25 might be an outlier depending on threshold
      const outliersHigh = detectOutliers(values, 1);
      const outliersLow = detectOutliers(values, 3);

      expect(outliersHigh.length).toBeGreaterThanOrEqual(outliersLow.length);
    });
  });

  describe('calculateTrend', () => {
    it('detects upward trend', () => {
      const values = [10, 20, 30, 40, 50];
      const trend = calculateChartTrend(values);
      expect(trend).toBe('up');
    });

    it('detects downward trend', () => {
      const values = [50, 40, 30, 20, 10];
      const trend = calculateChartTrend(values);
      expect(trend).toBe('down');
    });

    it('detects stable trend', () => {
      const values = [30, 31, 29, 30, 32];
      const trend = calculateChartTrend(values);
      expect(trend).toBe('stable');
    });

    it('handles insufficient data', () => {
      const values = [10];
      const trend = calculateChartTrend(values);
      expect(trend).toBe('stable');
    });
  });

  describe('calculateCorrelation', () => {
    it('calculates positive correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const correlation = calculateCorrelation(x, y);
      expect(correlation).toBeCloseTo(1, 5);
    });

    it('calculates negative correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 4, 3, 2, 1];
      const correlation = calculateCorrelation(x, y);
      expect(correlation).toBeCloseTo(-1, 5);
    });

    it('calculates no correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 1, 1, 1, 1];
      const correlation = calculateCorrelation(x, y);
      expect(correlation).toBe(0);
    });

    it('handles different length arrays', () => {
      const x = [1, 2, 3];
      const y = [1, 2];
      const correlation = calculateCorrelation(x, y);
      expect(correlation).toBe(0);
    });

    it('handles empty arrays', () => {
      const correlation = calculateCorrelation([], []);
      expect(correlation).toBe(0);
    });
  });

  describe('simpleLinearRegression', () => {
    it('calculates linear regression', () => {
      const data = [
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
        { x: 4, y: 8 },
      ];

      const regression = simpleLinearRegression(data);

      expect(regression.slope).toBeCloseTo(2, 5);
      expect(regression.intercept).toBeCloseTo(0, 5);
      expect(regression.r2).toBeCloseTo(1, 5);
    });

    it('handles empty data', () => {
      const regression = simpleLinearRegression([]);
      expect(regression.slope).toBe(0);
      expect(regression.intercept).toBe(0);
      expect(regression.r2).toBe(0);
    });
  });

  describe('generateForecast', () => {
    it('generates forecast data', () => {
      const forecast = generateForecast(mockAnalyticsData, 3);

      expect(forecast).toHaveLength(3);
      forecast.forEach((point, index) => {
        expect(point.timestamp).toBeTruthy();
        expect(point.category).toBe('forecast');
        expect(point.value).toBeGreaterThanOrEqual(0);
      });
    });

    it('handles insufficient data', () => {
      const forecast = generateForecast([{ timestamp: '2023-12-01', value: 100 }], 3);
      expect(forecast).toHaveLength(0);
    });

    it('handles empty data', () => {
      const forecast = generateForecast([], 3);
      expect(forecast).toHaveLength(0);
    });
  });

  describe('validateChartData', () => {
    it('validates correct chart data', () => {
      const data = [
        { date: '2023-12-01', value: 100 },
        { date: '2023-12-02', value: 200 },
      ];

      expect(validateChartData(data)).toBe(true);
    });

    it('rejects invalid chart data', () => {
      const invalidData = [
        { date: '', value: 100 },
        { date: '2023-12-02', value: NaN },
      ];

      expect(validateChartData(invalidData)).toBe(false);
    });

    it('handles empty array', () => {
      expect(validateChartData([])).toBe(true);
    });
  });

  describe('validateAnalyticsData', () => {
    it('validates correct analytics data', () => {
      expect(validateAnalyticsData(mockAnalyticsData)).toBe(true);
    });

    it('rejects invalid timestamps', () => {
      const invalidData = [
        { timestamp: 'invalid-date', value: 100 },
      ];

      expect(validateAnalyticsData(invalidData)).toBe(false);
    });

    it('rejects invalid values', () => {
      const invalidData = [
        { timestamp: '2023-12-01T00:00:00Z', value: NaN },
      ];

      expect(validateAnalyticsData(invalidData)).toBe(false);
    });
  });

  describe('formatChartLabel', () => {
    it('formats date labels', () => {
      const formatted = formatChartLabel('2023-12-25', 'date');
      expect(formatted).toBe('Dec 25, 2023');
    });

    it('formats currency labels', () => {
      const formatted = formatChartLabel(1234.56, 'currency');
      expect(formatted).toBe('$1,234.56');
    });

    it('formats percentage labels', () => {
      const formatted = formatChartLabel(25, 'percentage');
      expect(formatted).toBe('25.0%');
    });

    it('formats number labels', () => {
      const formatted = formatChartLabel(1234.56, 'number');
      expect(formatted).toBe('1,235');
    });

    it('accepts custom options', () => {
      const formatted = formatChartLabel(1234.56, 'currency', {
        minimumFractionDigits: 0,
      });
      expect(formatted).toBe('$1,235');
    });
  });

  describe('getChartColor', () => {
    it('returns colors from primary palette', () => {
      expect(getChartColor(0, 'primary')).toBe(CHART_COLORS.primary[0]);
      expect(getChartColor(3, 'primary')).toBe(CHART_COLORS.primary[3]);
    });

    it('wraps around palette', () => {
      const color1 = getChartColor(0, 'primary');
      const color7 = getChartColor(7, 'primary'); // 7 % 5 = 2
      expect(color7).toBe(CHART_COLORS.primary[2]);
      expect(color7).not.toBe(color1);
    });

    it('uses default palette', () => {
      const color = getChartColor(0);
      expect(color).toBe(CHART_COLORS.primary[0]);
    });
  });
});