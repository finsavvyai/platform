/**
 * FinSavvy AI Analytics Chart Component
 * Multi-series analytics dashboard with real-time data and AI-powered insights
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Brain,
  Zap,
  Target,
  Activity,
  AlertTriangle,
  Info,
  Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Card, StatsCard } from '../ui/Card';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { formatCurrency, formatPercentage, formatRelativeTime } from '../../lib/utils';

// Types
export interface AnalyticsDataPoint {
  timestamp: string;
  value: number;
  category?: string;
  metadata?: Record<string, any>;
}

export interface AnalyticsSeries {
  id: string;
  name: string;
  data: AnalyticsDataPoint[];
  color: string;
  type: 'line' | 'area' | 'bar';
  yAxisId?: 'left' | 'right';
}

export interface AnalyticsChartProps {
  series: AnalyticsSeries[];
  title?: string;
  subtitle?: string;
  height?: number;
  timeRange?: '1h' | '24h' | '7d' | '30d' | '90d';
  showBrush?: boolean;
  showComparison?: boolean;
  showForecast?: boolean;
  showAIInsights?: boolean;
  showAnnotations?: boolean;
  metrics?: {
    total?: number;
    average?: number;
    peak?: number;
    growth?: number;
    efficiency?: number;
  };
  onDataPointClick?: (data: AnalyticsDataPoint, series: AnalyticsSeries) => void;
  className?: string;
}

interface AIInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'correlation' | 'forecast' | 'opportunity';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  action?: string;
  timestamp: string;
  data?: {
    value?: number;
    change?: number;
    prediction?: number;
  };
}

interface Annotation {
  id: string;
  timestamp: string;
  value: number;
  label: string;
  type: 'event' | 'threshold' | 'alert';
  color: string;
}

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  series,
  title,
  subtitle,
  height = 400,
  timeRange = '7d',
  showBrush = true,
  showComparison = false,
  showForecast = false,
  showAIInsights = true,
  showAnnotations = false,
  metrics,
  onDataPointClick,
  className,
}) => {
  const [selectedSeries, setSelectedSeries] = useState<string[]>(series.map(s => s.id));
  const [aiInsights, setAIInsights] = useState<AIInsight[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [timeWindow, setTimeWindow] = useState(timeRange);
  const chartRef = useRef<HTMLDivElement>(null);

  // Generate combined data for all series
  const combinedData = useMemo(() => {
    const timeStamps = new Set<string>();

    // Collect all timestamps
    series.forEach(s => {
      s.data.forEach(point => {
        timeStamps.add(point.timestamp);
      });
    });

    // Create combined data points
    return Array.from(timeStamps)
      .sort()
      .map(timestamp => {
        const point: any = { timestamp };

        series.forEach(s => {
          const dataPoint = s.data.find(d => d.timestamp === timestamp);
          if (dataPoint) {
            point[s.id] = dataPoint.value;
            if (dataPoint.category) {
              point[`${s.id}_category`] = dataPoint.category;
            }
          }
        });

        return point;
      });
  }, [series]);

  // Calculate derived metrics
  const derivedMetrics = useMemo(() => {
    if (series.length === 0) return { total: 0, average: 0, peak: 0, growth: 0, efficiency: 0 };

    const allValues = series.flatMap(s => s.data.map(d => d.value));
    const total = allValues.reduce((sum, val) => sum + val, 0);
    const average = total / allValues.length;
    const peak = Math.max(...allValues);

    // Calculate growth (comparing first and last values across all series)
    const firstValues = series.map(s => s.data[0]?.value || 0);
    const lastValues = series.map(s => s.data[s.data.length - 1]?.value || 0);
    const firstAvg = firstValues.reduce((sum, val) => sum + val, 0) / firstValues.length;
    const lastAvg = lastValues.reduce((sum, val) => sum + val, 0) / lastValues.length;
    const growth = firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;

    // Calculate efficiency (ratio of positive to total changes)
    const changes = allValues.slice(1).map((val, i) => val - allValues[i]);
    const positiveChanges = changes.filter(change => change > 0).length;
    const efficiency = changes.length > 0 ? (positiveChanges / changes.length) * 100 : 0;

    return { total, average, peak, growth, efficiency };
  }, [series]);

  // Generate AI insights
  useEffect(() => {
    if (showAIInsights && series.length > 0) {
      generateAIInsights();
    }
  }, [showAIInsights, series, timeWindow]);

  // Generate annotations
  useEffect(() => {
    if (showAnnotations && series.length > 0) {
      generateAnnotations();
    }
  }, [showAnnotations, series]);

  const generateAIInsights = async () => {
    setIsLoadingInsights(true);

    const insights: AIInsight[] = [];

    // Trend analysis for each series
    series.forEach(s => {
      const data = s.data;
      if (data.length < 2) return;

      const recentValues = data.slice(-7).map(d => d.value);
      const previousValues = data.slice(-14, -7).map(d => d.value);

      if (recentValues.length >= 3 && previousValues.length >= 3) {
        const recentAvg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
        const previousAvg = previousValues.reduce((sum, val) => sum + val, 0) / previousValues.length;
        const change = ((recentAvg - previousAvg) / previousAvg) * 100;

        if (Math.abs(change) > 10) {
          insights.push({
            id: `trend-${s.id}`,
            type: 'trend',
            title: `${s.name} ${change > 0 ? 'Increasing' : 'Decreasing'}`,
            description: `${s.name} has ${change > 0 ? 'increased' : 'decreased'} by ${formatPercentage(Math.abs(change))} in the recent period`,
            confidence: 0.85,
            impact: Math.abs(change) > 25 ? 'high' : Math.abs(change) > 15 ? 'medium' : 'low',
            action: change > 0 ? 'Consider scaling up resources' : 'Investigate the cause of decline',
            timestamp: new Date().toISOString(),
            data: { change },
          });
        }
      }
    });

    // Cross-series correlation analysis
    if (series.length >= 2) {
      const correlation = calculateCorrelation(series[0].data, series[1].data);
      if (Math.abs(correlation) > 0.7) {
        insights.push({
          id: 'correlation-1',
          type: 'correlation',
          title: `Strong ${correlation > 0 ? 'Positive' : 'Negative'} Correlation`,
          description: `${series[0].name} and ${series[1].name} show a ${Math.abs(correlation * 100).toFixed(1)}% ${correlation > 0 ? 'positive' : 'negative'} correlation`,
          confidence: 0.92,
          impact: 'medium',
          action: 'Use this correlation to optimize operations',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Anomaly detection
    series.forEach(s => {
      const anomalies = detectAnomalies(s.data);
      if (anomalies.length > 0) {
        insights.push({
          id: `anomaly-${s.id}`,
          type: 'anomaly',
          title: `Anomalies Detected in ${s.name}`,
          description: `Found ${anomalies.length} unusual data points in ${s.name}`,
          confidence: 0.88,
          impact: 'high',
          action: 'Review these data points for data quality issues',
          timestamp: new Date().toISOString(),
        });
      }
    });

    setAIInsights(insights);
    setIsLoadingInsights(false);
  };

  const generateAnnotations = () => {
    const annotations: Annotation[] = [];

    series.forEach(s => {
      // Add threshold annotations
      const values = s.data.map(d => d.value);
      const max = Math.max(...values);
      const min = Math.min(...values);
      const threshold = min + (max - min) * 0.9;

      s.data.forEach(point => {
        if (point.value >= threshold) {
          annotations.push({
            id: `threshold-${s.id}-${point.timestamp}`,
            timestamp: point.timestamp,
            value: point.value,
            label: 'Peak Value',
            type: 'threshold',
            color: s.color,
          });
        }
      });
    });

    setAnnotations(annotations);
  };

  const calculateCorrelation = (data1: AnalyticsDataPoint[], data2: AnalyticsDataPoint[]): number => {
    // Simple correlation calculation for matching timestamps
    const pairedData: Array<[number, number]> = [];

    data1.forEach(d1 => {
      const d2 = data2.find(d => d.timestamp === d1.timestamp);
      if (d2) {
        pairedData.push([d1.value, d2.value]);
      }
    });

    if (pairedData.length < 2) return 0;

    const n = pairedData.length;
    const sumX = pairedData.reduce((sum, [x]) => sum + x, 0);
    const sumY = pairedData.reduce((sum, [, y]) => sum + y, 0);
    const sumXY = pairedData.reduce((sum, [x, y]) => sum + x * y, 0);
    const sumX2 = pairedData.reduce((sum, [x]) => sum + x * x, 0);
    const sumY2 = pairedData.reduce((sum, [, y]) => sum + y * y, 0);

    const correlation = (n * sumXY - sumX * sumY) /
      Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return isNaN(correlation) ? 0 : correlation;
  };

  const detectAnomalies = (data: AnalyticsDataPoint[]): AnalyticsDataPoint[] => {
    if (data.length < 5) return [];

    const values = data.map(d => d.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    const threshold = 2.5; // Z-score threshold

    return data.filter(d => Math.abs((d.value - mean) / stdDev) > threshold);
  };

  const toggleSeries = (seriesId: string) => {
    setSelectedSeries(prev =>
      prev.includes(seriesId)
        ? prev.filter(id => id !== seriesId)
        : [...prev, seriesId]
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-morphism p-4 rounded-xl border border-white/20 min-w-[200px]">
          <p className="text-sm font-medium text-foreground mb-2">
            {formatRelativeTime(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span
                className="text-sm font-medium"
                style={{ color: entry.color }}
              >
                {entry.name}:
              </span>
              <span className="text-sm font-bold text-foreground">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card variant="glass" className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          {title && (
            <h3 className="text-2xl font-semibold text-foreground mb-2">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-foreground-secondary">
              {subtitle}
            </p>
          )}
        </div>

        {/* Series Controls */}
        <div className="flex flex-wrap gap-2">
          {series.map(s => (
            <Button
              key={s.id}
              variant={selectedSeries.includes(s.id) ? 'primary' : 'outline'}
              size="sm"
              onClick={() => toggleSeries(s.id)}
              className="flex items-center gap-2"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Metrics */}
      {(metrics || series.length > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard
            title="Total"
            value={formatCurrency(metrics?.total || derivedMetrics.total)}
            icon={<Activity className="h-4 w-4" />}
            change={derivedMetrics.growth > 0 ? `+${formatPercentage(derivedMetrics.growth)}` : formatPercentage(derivedMetrics.growth)}
            changeType={derivedMetrics.growth > 0 ? 'positive' : derivedMetrics.growth < 0 ? 'negative' : 'neutral'}
          />
          <StatsCard
            title="Average"
            value={formatCurrency(metrics?.average || derivedMetrics.average)}
            icon={<Target className="h-4 w-4" />}
          />
          <StatsCard
            title="Peak"
            value={formatCurrency(metrics?.peak || derivedMetrics.peak)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatsCard
            title="Growth"
            value={formatPercentage(derivedMetrics.growth)}
            icon={derivedMetrics.growth > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            changeType={derivedMetrics.growth > 0 ? 'positive' : derivedMetrics.growth < 0 ? 'negative' : 'neutral'}
          />
          <StatsCard
            title="Efficiency"
            value={formatPercentage(derivedMetrics.efficiency)}
            icon={<Zap className="h-4 w-4" />}
            changeType={derivedMetrics.efficiency > 70 ? 'positive' : derivedMetrics.efficiency > 40 ? 'neutral' : 'negative'}
          />
        </div>
      )}

      {/* AI Insights */}
      <AnimatePresence>
        {showAIInsights && aiInsights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-4 w-4 text-brand-cyan-400" />
              <h4 className="text-sm font-medium text-foreground">AI Insights</h4>
            </div>

            {aiInsights.map((insight) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'glass-morphism p-4 rounded-xl border border-white/10 flex items-start gap-3',
                  insight.impact === 'high' && 'border-semantic-error/20',
                  insight.impact === 'medium' && 'border-semantic-warning/20',
                  insight.impact === 'low' && 'border-semantic-success/20'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  insight.type === 'trend' && 'bg-gradient-to-br from-brand-cyan-500/20 to-brand-blue-500/20',
                  insight.type === 'anomaly' && 'bg-semantic-error/20',
                  insight.type === 'correlation' && 'bg-semantic-success/20',
                  insight.type === 'forecast' && 'bg-semantic-warning/20',
                  insight.type === 'opportunity' && 'bg-brand-indigo-500/20'
                )}>
                  {insight.type === 'trend' && <TrendingUp className="h-4 w-4 text-brand-cyan-400" />}
                  {insight.type === 'anomaly' && <AlertTriangle className="h-4 w-4 text-semantic-error" />}
                  {insight.type === 'correlation' && <Activity className="h-4 w-4 text-semantic-success" />}
                  {insight.type === 'forecast' && <Info className="h-4 w-4 text-semantic-warning" />}
                  {insight.type === 'opportunity' && <Target className="h-4 w-4 text-brand-indigo-400" />}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-medium text-foreground">
                      {insight.title}
                    </h5>
                    <span className="text-xs text-foreground-secondary">
                      {Math.round(insight.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-xs text-foreground-secondary leading-relaxed">
                    {insight.description}
                  </p>
                  {insight.action && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs"
                    >
                      {insight.action}
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chart */}
      <div className="relative" ref={chartRef}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={combinedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
            <XAxis
              dataKey="timestamp"
              stroke="rgba(255, 255, 255, 0.3)"
              tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis
              yAxisId="left"
              stroke="rgba(255, 255, 255, 0.3)"
              tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(value)}
            />
            {series.some(s => s.yAxisId === 'right') && (
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="rgba(255, 255, 255, 0.3)"
                tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(value)}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {/* Render selected series */}
            {series.filter(s => selectedSeries.includes(s.id)).map((s) => {
              if (s.type === 'line') {
                return (
                  <Line
                    key={s.id}
                    yAxisId={s.yAxisId || 'left'}
                    type="monotone"
                    dataKey={s.id}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                    animationDuration={1000}
                    name={s.name}
                    onClick={(data) => onDataPointClick?.(data, s)}
                  />
                );
              } else if (s.type === 'area') {
                return (
                  <Area
                    key={s.id}
                    yAxisId={s.yAxisId || 'left'}
                    type="monotone"
                    dataKey={s.id}
                    stroke={s.color}
                    fill={s.color}
                    fillOpacity={0.3}
                    strokeWidth={2}
                    animationDuration={1000}
                    name={s.name}
                    onClick={(data) => onDataPointClick?.(data, s)}
                  />
                );
              }
              return null;
            })}

            {/* Annotations */}
            {showAnnotations && annotations.map((annotation) => (
              <ReferenceLine
                key={annotation.id}
                y={annotation.value}
                stroke={annotation.color}
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{
                  value: annotation.label,
                  position: 'top',
                  style: { fill: annotation.color, fontSize: 12 },
                }}
              />
            ))}

            {/* Brush for time range selection */}
            {showBrush && (
              <Brush
                dataKey="timestamp"
                height={30}
                stroke="rgba(255, 255, 255, 0.3)"
                fill="rgba(255, 255, 255, 0.05)"
                travellerWidth={10}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>

        {/* Loading overlay */}
        {isLoadingInsights && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-cyan-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-sm text-foreground-secondary">
                Generating AI insights...
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AnalyticsChart;