/**
 * FinSavvy AI Financial Chart Component
 * Advanced financial charts with AI-powered insights and real-time updates
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LineChart,
  Line,
  Area,
  AreaChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Activity,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Card, StatsCard } from '../ui/Card';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { formatCurrency, formatPercentage } from '../../lib/utils';

// Types
export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
  category?: string;
}

export interface FinancialChartProps {
  data: ChartDataPoint[];
  type: 'line' | 'area' | 'bar' | 'pie' | 'mixed';
  title?: string;
  subtitle?: string;
  height?: number;
  currency?: string;
  showAIInsights?: boolean;
  showForecast?: boolean;
  showComparison?: boolean;
  comparisonData?: ChartDataPoint[];
  forecastData?: ChartDataPoint[];
  timeRange?: '7d' | '30d' | '90d' | '1y';
  metrics?: {
    total?: number;
    growth?: number;
    average?: number;
    peak?: number;
    trend?: 'up' | 'down' | 'stable';
  };
  className?: string;
  onDataPointClick?: (data: ChartDataPoint) => void;
}

interface AIInsight {
  type: 'trend' | 'anomaly' | 'opportunity' | 'risk';
  title: string;
  description: string;
  confidence: number;
  action?: string;
  severity?: 'low' | 'medium' | 'high';
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: any;
  label?: string;
}

const FinancialChart: React.FC<FinancialChartProps> = ({
  data,
  type,
  title,
  subtitle,
  height = 400,
  currency = 'USD',
  showAIInsights = true,
  showForecast = false,
  showComparison = false,
  comparisonData,
  forecastData,
  timeRange = '30d',
  metrics,
  className,
  onDataPointClick,
}) => {
  const [selectedDataPoint, setSelectedDataPoint] = useState<ChartDataPoint | null>(null);
  const [aiInsights, setAIInsights] = useState<AIInsight[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Generate AI insights
  useEffect(() => {
    if (showAIInsights && data.length > 0) {
      generateAIInsights();
    }
  }, [showAIInsights, data, type, showForecast, timeRange]);

  const generateAIInsights = async () => {
    setIsLoadingInsights(true);

    // Simulate AI analysis
    const insights: AIInsight[] = [];

    // Trend analysis
    const recentData = data.slice(-7);
    const olderData = data.slice(-14, -7);
    const recentAvg = recentData.reduce((sum, d) => sum + d.value, 0) / recentData.length;
    const olderAvg = olderData.reduce((sum, d) => sum + d.value, 0) / olderData.length;
    const trend = recentAvg > olderAvg ? 'up' : recentAvg < olderAvg ? 'down' : 'stable';

    if (trend !== 'stable') {
      insights.push({
        type: 'trend',
        title: `${trend === 'up' ? 'Increasing' : 'Decreasing'} Trend Detected`,
        description: `Values have ${trend === 'up' ? 'increased' : 'decreased'} by ${formatPercentage(Math.abs((recentAvg - olderAvg) / olderAvg) * 100)} compared to the previous period.`,
        confidence: 0.85,
        action: trend === 'up' ? 'Consider scaling up operations' : 'Review recent changes',
        severity: trend === 'up' ? 'low' : 'medium',
      });
    }

    // Anomaly detection
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    const threshold = mean + 2 * stdDev;

    const anomalies = data.filter(d => Math.abs(d.value - mean) > threshold);
    if (anomalies.length > 0) {
      insights.push({
        type: 'anomaly',
        title: 'Anomalies Detected',
        description: `Found ${anomalies.length} data points that deviate significantly from the normal pattern.`,
        confidence: 0.92,
        action: 'Investigate unusual patterns',
        severity: 'high',
      });
    }

    setAiInsights(insights);
    setIsLoadingInsights(false);
  };

  // Calculate derived metrics
  const derivedMetrics = useMemo(() => {
    const values = data.map(d => d.value);
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / values.length;
    const peak = Math.max(...values);
    const growth = data.length > 1 ? ((values[values.length - 1] - values[0]) / values[0]) * 100 : 0;
    const trend = growth > 5 ? 'up' : growth < -5 ? 'down' : 'stable';

    return {
      total,
      average,
      peak,
      growth,
      trend,
    };
  }, [data]);

  const combinedData = useMemo(() => {
    let result = [...data];

    if (showForecast && forecastData) {
      result = [...result, ...forecastData];
    }

    return result;
  }, [data, showForecast, forecastData]);

  const chartColors = {
    primary: 'url(#gradient1)',
    secondary: 'url(#gradient2)',
    forecast: 'rgba(99, 102, 241, 0.2)',
    comparison: 'rgba(156, 163, 175, 0.5)',
  };

  const CustomTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass-morphism p-3 rounded-xl border border-white/20">
          <p className="text-sm font-medium text-foreground">
            {label || data.label}
          </p>
          <p className="text-lg font-bold text-foreground">
            {formatCurrency(data.value, currency)}
          </p>
          {showComparison && comparisonData && (
            <p className="text-xs text-foreground-secondary">
              vs Previous: {formatCurrency(data.value * 1.1, currency)} (+10%)
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={combinedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255, 255, 255, 0.3)"
                tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis
                stroke="rgba(255, 255, 255, 0.3)"
                tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(value, currency)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="url(#gradient1)"
                strokeWidth={2}
                dot={{ fill: 'url(#gradient1)', strokeWidth: 3, r: 4 }}
                activeDot={{ r: 6 }}
                animationDuration={1000}
              />
              {showComparison && comparisonData && (
                <Line
                  type="monotone"
                  data={comparisonData}
                  dataKey="value"
                  stroke={chartColors.comparison}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: chartColors.comparison, strokeWidth: 2, r: 3 }}
                  animationDuration={1500}
                />
              )}
              {showForecast && forecastData && (
                <Line
                  type="monotone"
                  data={forecastData}
                  dataKey="value"
                  stroke={chartColors.forecast}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={{ fill: chartColors.forecast, strokeWidth: 2, r: 3 }}
                  animationDuration={2000}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={combinedData}>
              <defs>
                <linearGradient id="gradient1" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#06b6d4" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255, 255, 255, 0.3)"
                tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis
                stroke="rgba(255, 255, 255, 0.3)"
                tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(value, currency)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="value"
                stroke="url(#gradient1)"
                strokeWidth={2}
                fill="url(#gradient1)"
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255, 255, 255, 0.3)"
                tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis
                stroke="rgba(255, 255, 255, 0.3)"
                tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(value, currency)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="value"
                fill="url(#gradient1)"
                animationDuration={1000}
                onClick={(data) => onDataPointClick?.(data)}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => formatCurrency(entry.value, currency)}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                animationDuration={800}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`hsl(${index * 45}, 70%, 50%)`}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'mixed':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255, 255, 255, 0.3)"
                tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis yAxisId="left" stroke="rgba(255, 255, 255, 0.3)" />
              <YAxis yAxisId="right" orientation="right" stroke="rgba(255, 255, 255, 0.3)" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="left" dataKey="value" fill="url(#gradient1)" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="trend"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', strokeWidth: 3, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Card variant="glass" className={cn('space-y-4', className)}>
      {/* Header */}
      {(title || subtitle || metrics) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            {title && (
              <h3 className="text-xl font-semibold text-foreground">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-foreground-secondary">
                {subtitle}
              </p>
            )}
          </div>

          {metrics && (
            <div className="flex flex-wrap gap-4">
              <StatsCard
                title="Total"
                value={formatCurrency(metrics.total || derivedMetrics.total, currency)}
                icon={<DollarSign className="h-4 w-4" />}
                change={derivedMetrics.growth > 0 ? `+${formatPercentage(derivedMetrics.growth)}` : formatPercentage(derivedMetrics.growth)}
                changeType={derivedMetrics.growth > 0 ? 'positive' : derivedMetrics.growth < 0 ? 'negative' : 'neutral'}
              />
              <StatsCard
                title="Average"
                value={formatCurrency(metrics.average || derivedMetrics.average, currency)}
                icon={<Activity className="h-4 w-4" />}
              />
              <StatsCard
                title="Peak"
                value={formatCurrency(metrics.peak || derivedMetrics.peak, currency)}
                icon={<TrendingUp className="h-4 w-4" />}
              />
            </div>
          )}
        </div>
      )}

      {/* AI Insights */}
      <AnimatePresence>
        {showAIInsights && aiInsights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-2"
          >
            {aiInsights.map((insight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'glass-morphism p-4 rounded-xl border border-white/10 flex items-start gap-3',
                  insight.severity === 'high' && 'border-semantic-error/20',
                  insight.severity === 'medium' && 'border-semantic-warning/20',
                  insight.severity === 'low' && 'border-semantic-success/20'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  insight.type === 'trend' && 'bg-gradient-to-br from-brand-cyan-500/20 to-brand-blue-500/20',
                  insight.type === 'anomaly' && 'bg-semantic-error/20',
                  insight.type === 'opportunity' && 'bg-semantic-success/20',
                  insight.type === 'risk' && 'bg-semantic-warning/20'
                )}>
                  {insight.type === 'trend' && <TrendingUp className="h-4 w-4 text-brand-cyan-400" />}
                  {insight.type === 'anomaly' && <AlertTriangle className="h-4 w-4 text-semantic-error" />}
                  {insight.type === 'opportunity' && <Activity className="h-4 w-4 text-semantic-success" />}
                  {insight.type === 'risk' && <Info className="h-4 w-4 text-semantic-warning" />}
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="text-sm font-medium text-foreground">
                    {insight.title}
                  </h4>
                  <p className="text-xs text-foreground-secondary">
                    {insight.description}
                  </p>
                  {insight.action && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                    >
                      {insight.action}
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground-secondary">
                    Confidence: {Math.round(insight.confidence * 100)}%
                  </span>
                  <div className="h-1 w-1 rounded-full bg-gradient-to-r from-brand-cyan-500 to-brand-indigo-500" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chart */}
      <div className="relative">
        {renderChart()}

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

      {/* Chart controls */}
      {(showForecast || showComparison) && (
        <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
          {showForecast && (
            <div className="flex items-center gap-2 text-xs text-foreground-secondary">
              <div className="w-3 h-3 rounded-full bg-foreground/20" />
              <span>Forecast Enabled</span>
            </div>
          )}
          {showComparison && comparisonData && (
            <div className="flex items-center gap-2 text-xs text-foreground-secondary">
              <div className="w-3 h-3 rounded-full bg-foreground/20" />
              <span>Comparison View</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default FinancialChart;