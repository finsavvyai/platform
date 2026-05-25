/**
 * Metrics Overview Component
 * Displays aggregate metrics across all products
 */

import React from 'react';
import { TrendingUp, Users, DollarSign, Activity, Server, AlertTriangle } from 'lucide-react';

interface AggregateMetrics {
  totalRequests: number;
  totalUsers: number;
  totalRevenue: number;
  averageResponseTime: number;
  overallUptime: number;
  activeProducts: number;
  timestamp: string;
}

interface MetricsOverviewProps {
  metrics: AggregateMetrics;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ metrics }) => {
  const metricCards = [
    {
      title: 'Total Requests',
      value: metrics.totalRequests.toLocaleString(),
      icon: TrendingUp,
      color: 'bg-blue-500',
      change: '+12.5%',
      changeType: 'positive' as const,
    },
    {
      title: 'Active Users',
      value: metrics.totalUsers.toLocaleString(),
      icon: Users,
      color: 'bg-green-500',
      change: '+8.2%',
      changeType: 'positive' as const,
    },
    {
      title: 'Total Revenue',
      value: `$${(metrics.totalRevenue / 1000).toFixed(1)}k`,
      icon: DollarSign,
      color: 'bg-purple-500',
      change: '+15.3%',
      changeType: 'positive' as const,
    },
    {
      title: 'Avg Response Time',
      value: `${metrics.averageResponseTime.toFixed(0)}ms`,
      icon: Activity,
      color: 'bg-orange-500',
      change: '-5.2%',
      changeType: 'positive' as const,
    },
    {
      title: 'Overall Uptime',
      value: `${metrics.overallUptime.toFixed(2)}%`,
      icon: Server,
      color: 'bg-teal-500',
      change: '+0.1%',
      changeType: 'positive' as const,
    },
    {
      title: 'Active Products',
      value: metrics.activeProducts.toString(),
      icon: AlertTriangle,
      color: 'bg-indigo-500',
      change: '0',
      changeType: 'neutral' as const,
    },
  ];

  const getChangeColor = (type: 'positive' | 'negative' | 'neutral') => {
    switch (type) {
      case 'positive':
        return 'text-green-600 dark:text-green-400';
      case 'negative':
        return 'text-red-600 dark:text-red-400';
      case 'neutral':
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      {metricCards.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${metric.color} p-3 rounded-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {metric.title}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {metric.value}
              </p>
              <p className={`text-sm font-medium mt-2 ${getChangeColor(metric.changeType)}`}>
                {metric.change} from last hour
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
