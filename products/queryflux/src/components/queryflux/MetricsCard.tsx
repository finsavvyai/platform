import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

export interface MetricData {
  label: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
  };
  icon: LucideIcon;
  iconColor?: string;
}

interface MetricsCardProps {
  metric: MetricData;
  className?: string;
}

export function MetricsCard({ metric, className }: MetricsCardProps) {
  const Icon = metric.icon;

  return (
    <Card className={cn('animate-rise transition-all hover:-translate-y-0.5 hover:border-primary/45', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {metric.label}
        </CardTitle>
        <div
          className={cn(
            'rounded-2xl p-2.5',
            metric.iconColor || 'bg-primary/10 text-primary'
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-3xl font-black tracking-tight tabular-nums">{metric.value}</div>
            <div className="metric-sparkline mt-4 h-1.5 w-28 rounded-full" />
          </div>
          {metric.change && (
            <div
              className={cn('rounded-full px-2.5 py-1 text-xs font-bold', {
                'text-success': metric.change.trend === 'up',
                'text-destructive': metric.change.trend === 'down',
                'text-muted-foreground': metric.change.trend === 'neutral',
              })}
            >
              {metric.change.trend === 'up' && <span className="mr-1">↑</span>}
              {metric.change.trend === 'down' && <span className="mr-1">↓</span>}
              {Math.abs(metric.change.value)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricsGridProps {
  metrics: MetricData[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function MetricsGrid({ metrics, columns = 4, className }: MetricsGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        {
          'grid-cols-1 md:grid-cols-2': columns === 2,
          'grid-cols-1 md:grid-cols-2 lg:grid-cols-3': columns === 3,
          'grid-cols-1 md:grid-cols-2 lg:grid-cols-4': columns === 4,
        },
        className
      )}
    >
      {metrics.map((metric, index) => (
        <MetricsCard key={index} metric={metric} />
      ))}
    </div>
  );
}
