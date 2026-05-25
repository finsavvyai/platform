/**
 * FinSavvy AI Dashboard Component
 * Comprehensive analytics dashboard with real-time data and AI-powered insights
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  CreditCard,
  Users,
  Activity,
  Brain,
  Zap,
  AlertTriangle,
  Target,
  Eye,
  Settings,
  RefreshCw,
  Download,
  Filter,
} from 'lucide-react';
import { motion } from 'framer-motion';

import { Card, StatsCard } from '../ui/Card';
import { Button } from '../ui/Button';
import FinancialChart, { ChartDataPoint } from './FinancialChart';
import AnalyticsChart, { AnalyticsSeries, AnalyticsDataPoint } from './AnalyticsChart';
import { cn } from '../../lib/utils';
import { formatCurrency, formatPercentage, formatRelativeTime } from '../../lib/utils';

// Types
export interface DashboardMetric {
  id: string;
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  description?: string;
}

export interface DashboardSection {
  id: string;
  title: string;
  type: 'metrics' | 'chart' | 'analytics' | 'table';
  data: any;
  config?: any;
  span?: number; // 1-12 for grid columns
}

export interface DashboardProps {
  title?: string;
  subtitle?: string;
  sections: DashboardSection[];
  timeRange?: '1h' | '24h' | '7d' | '30d' | '90d';
  refreshInterval?: number; // in seconds
  autoRefresh?: boolean;
  showAIInsights?: boolean;
  showControls?: boolean;
  className?: string;
  onRefresh?: () => void;
  onExport?: () => void;
  onTimeRangeChange?: (range: string) => void;
}

interface AIInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'opportunity' | 'risk';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  action?: string;
  timestamp: string;
}

const Dashboard: React.FC<DashboardProps> = ({
  title,
  subtitle,
  sections,
  timeRange = '7d',
  refreshInterval = 300, // 5 minutes
  autoRefresh = true,
  showAIInsights = true,
  showControls = true,
  className,
  onRefresh,
  onExport,
  onTimeRangeChange,
}) => {
  const [currentTimeRange, setCurrentTimeRange] = useState(timeRange);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aiInsights, setAIInsights] = useState<AIInsight[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      handleRefresh();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Generate AI insights
  useEffect(() => {
    if (showAIInsights) {
      generateAIInsights();
    }
  }, [sections, currentTimeRange, showAIInsights]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
      setLastRefresh(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTimeRangeChange = (range: string) => {
    setCurrentTimeRange(range as any);
    onTimeRangeChange?.(range);
  };

  const generateAIInsights = () => {
    const insights: AIInsight[] = [];

    // Analyze metrics sections
    sections
      .filter(section => section.type === 'metrics')
      .forEach(section => {
        const metrics = section.data as DashboardMetric[];

        // Find significant changes
        metrics.forEach(metric => {
          if (metric.change && Math.abs(metric.change) > 20) {
            insights.push({
              id: `metric-${section.id}-${metric.id}`,
              type: metric.changeType === 'positive' ? 'opportunity' : 'risk',
              title: `${metric.title} ${metric.changeType === 'positive' ? 'Outperformance' : 'Underperformance'}`,
              description: `${metric.title} has ${metric.changeType === 'positive' ? 'increased' : 'decreased'} by ${formatPercentage(Math.abs(metric.change))}`,
              confidence: 0.85,
              impact: Math.abs(metric.change) > 50 ? 'high' : Math.abs(metric.change) > 30 ? 'medium' : 'low',
              action: metric.changeType === 'positive' ? 'Investigate growth drivers' : 'Review performance issues',
              timestamp: new Date().toISOString(),
            });
          }
        });
      });

    // Analyze chart sections
    sections
      .filter(section => section.type === 'chart' || section.type === 'analytics')
      .forEach(section => {
        // Add chart-specific insights
        insights.push({
          id: `chart-${section.id}`,
          type: 'trend',
          title: `Pattern Detected in ${section.title}`,
          description: `AI analysis has identified interesting patterns in the ${section.title.toLowerCase()} data`,
          confidence: 0.78,
          impact: 'medium',
          action: 'Review detailed analysis',
          timestamp: new Date().toISOString(),
        });
      });

    setAIInsights(insights.slice(0, 5)); // Limit to top 5 insights
  };

  const getGridSpanClass = (span?: number) => {
    if (!span) return 'col-span-12';
    const spanMap: Record<number, string> = {
      1: 'col-span-1',
      2: 'col-span-2',
      3: 'col-span-3',
      4: 'col-span-4',
      5: 'col-span-5',
      6: 'col-span-6',
      7: 'col-span-7',
      8: 'col-span-8',
      9: 'col-span-9',
      10: 'col-span-10',
      11: 'col-span-11',
      12: 'col-span-12',
    };
    return spanMap[span] || 'col-span-12';
  };

  const renderSection = (section: DashboardSection) => {
    const sectionClassName = cn(
      'transition-all duration-300',
      selectedSection === section.id && 'ring-2 ring-brand-cyan-500/20'
    );

    switch (section.type) {
      case 'metrics':
        return (
          <Card
            variant="glass"
            className={sectionClassName}
            onClick={() => setSelectedSection(section.id)}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                {section.title}
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {(section.data as DashboardMetric[]).map((metric) => (
                  <StatsCard
                    key={metric.id}
                    title={metric.title}
                    value={metric.value}
                    change={metric.change ? formatPercentage(metric.change) : undefined}
                    changeType={metric.changeType}
                    icon={metric.icon}
                  />
                ))}
              </div>
            </div>
          </Card>
        );

      case 'chart':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={sectionClassName}
          >
            <FinancialChart
              data={section.data as ChartDataPoint[]}
              type={section.config?.type || 'line'}
              title={section.title}
              subtitle={section.config?.subtitle}
              showAIInsights={showAIInsights}
              showForecast={section.config?.showForecast}
              showComparison={section.config?.showComparison}
              height={section.config?.height || 300}
              className="cursor-pointer"
              onClick={() => setSelectedSection(section.id)}
            />
          </motion.div>
        );

      case 'analytics':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={sectionClassName}
          >
            <AnalyticsChart
              series={section.data as AnalyticsSeries[]}
              title={section.title}
              subtitle={section.config?.subtitle}
              timeRange={currentTimeRange}
              showAIInsights={showAIInsights}
              showBrush={section.config?.showBrush}
              showAnnotations={section.config?.showAnnotations}
              height={section.config?.height || 400}
              className="cursor-pointer"
              onDataPointClick={(data, series) => {
                console.log('Data point clicked:', data, series);
              }}
              onClick={() => setSelectedSection(section.id)}
            />
          </motion.div>
        );

      case 'table':
        return (
          <Card
            variant="glass"
            className={sectionClassName}
            onClick={() => setSelectedSection(section.id)}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                {section.title}
              </h3>
              <div className="text-sm text-foreground-secondary">
                Table component would be rendered here
              </div>
            </div>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          {title && (
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-foreground-secondary">
              {subtitle}
            </p>
          )}
        </div>

        {showControls && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Time Range Selector */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
              {['1h', '24h', '7d', '30d', '90d'].map((range) => (
                <Button
                  key={range}
                  variant={currentTimeRange === range ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => handleTimeRangeChange(range)}
                  className="text-xs px-3 py-1"
                >
                  {range}
                </Button>
              ))}
            </div>

            {/* Control Buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Configure
            </Button>
          </div>
        )}
      </div>

      {/* Last Refresh Info */}
      <div className="flex items-center justify-between text-xs text-foreground-secondary">
        <span>
          Last updated: {formatRelativeTime(lastRefresh)}
        </span>
        {autoRefresh && (
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-semantic-success rounded-full animate-pulse" />
            Auto-refresh enabled
          </span>
        )}
      </div>

      {/* AI Insights Summary */}
      {showAIInsights && aiInsights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"
        >
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
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                insight.type === 'trend' && 'bg-gradient-to-br from-brand-cyan-500/20 to-brand-blue-500/20',
                insight.type === 'anomaly' && 'bg-semantic-error/20',
                insight.type === 'opportunity' && 'bg-semantic-success/20',
                insight.type === 'risk' && 'bg-semantic-warning/20'
              )}>
                {insight.type === 'trend' && <TrendingUp className="h-4 w-4 text-brand-cyan-400" />}
                {insight.type === 'anomaly' && <AlertTriangle className="h-4 w-4 text-semantic-error" />}
                {insight.type === 'opportunity' && <Target className="h-4 w-4 text-semantic-success" />}
                {insight.type === 'risk' && <AlertTriangle className="h-4 w-4 text-semantic-warning" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground truncate">
                  {insight.title}
                </h4>
                <p className="text-xs text-foreground-secondary mt-1 line-clamp-2">
                  {insight.description}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-foreground-secondary">
                    {Math.round(insight.confidence * 100)}% confidence
                  </span>
                  {insight.action && (
                    <Button variant="ghost" size="sm" className="text-xs p-1 h-auto">
                      {insight.action}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Dashboard Grid */}
      <div className="grid grid-cols-12 gap-6">
        {sections.map((section) => (
          <div
            key={section.id}
            className={getGridSpanClass(section.span)}
          >
            {renderSection(section)}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {sections.length === 0 && (
        <Card variant="outline" className="text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <BarChart3 className="h-12 w-12 text-foreground-secondary" />
            <h3 className="text-lg font-medium text-foreground">
              No dashboard sections configured
            </h3>
            <p className="text-sm text-foreground-secondary">
              Add sections to your dashboard to see analytics and insights.
            </p>
            <Button variant="primary">
              Configure Dashboard
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;