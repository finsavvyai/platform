/**
 * MetricsOverviewWidget Component
 * Displays comprehensive metrics and analytics across all products
 */
import React, { useState, useEffect } from 'react';
export const MetricsOverviewWidget = ({ dashboardService, className = '', }) => {
    const [timeRange, setTimeRange] = useState('24h');
    const [metrics, setMetrics] = useState([
        {
            id: 'api-calls',
            name: 'API Calls',
            value: 1247,
            change: { value: 12.5, type: 'increase', period: 'vs yesterday' },
            target: 2000,
            color: 'text-blue-600 dark:text-blue-400',
        },
        {
            id: 'pipeline-success',
            name: 'Pipeline Success Rate',
            value: 94.7,
            change: { value: 2.3, type: 'increase', period: 'vs last week' },
            target: 95,
            unit: '%',
            color: 'text-green-600 dark:text-green-400',
        },
        {
            id: 'active-users',
            name: 'Active Users',
            value: 892,
            change: { value: 8.1, type: 'increase', period: 'vs last week' },
            color: 'text-purple-600 dark:text-purple-400',
        },
        {
            id: 'avg-response-time',
            name: 'Avg Response Time',
            value: 156,
            change: { value: 5.2, type: 'decrease', period: 'vs yesterday' },
            target: 200,
            unit: 'ms',
            color: 'text-orange-600 dark:text-orange-400',
        },
        {
            id: 'error-rate',
            name: 'Error Rate',
            value: 0.8,
            change: { value: 0.3, type: 'decrease', period: 'vs last week' },
            target: 1.0,
            unit: '%',
            color: 'text-red-600 dark:text-red-400',
        },
        {
            id: 'revenue',
            name: 'Monthly Revenue',
            value: 45890,
            change: { value: 15.7, type: 'increase', period: 'vs last month' },
            unit: '$',
            color: 'text-green-600 dark:text-green-400',
        },
    ]);
    const [chartData, setChartData] = useState({
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
            {
                label: 'API Calls',
                data: [820, 932, 901, 934, 1290, 1330, 1247],
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
            },
            {
                label: 'Pipeline Executions',
                data: [12, 19, 15, 17, 23, 21, 18],
                borderColor: 'rgb(16, 185, 129)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
            },
        ],
    });
    // Simulate real-time metric updates
    useEffect(() => {
        const interval = setInterval(() => {
            setMetrics(prev => prev.map(metric => {
                if (metric.id === 'api-calls') {
                    const newValue = Number(metric.value) + Math.floor(Math.random() * 5 - 2);
                    return { ...metric, value: Math.max(0, newValue) };
                }
                if (metric.id === 'active-users') {
                    const newValue = Number(metric.value) + Math.floor(Math.random() * 3 - 1);
                    return { ...metric, value: Math.max(0, newValue) };
                }
                return metric;
            }));
        }, 5000);
        return () => clearInterval(interval);
    }, []);
    const timeRanges = [
        { value: '1h', label: '1 Hour' },
        { value: '24h', label: '24 Hours' },
        { value: '7d', label: '7 Days' },
        { value: '30d', label: '30 Days' },
    ];
    const formatMetricValue = (value, unit) => {
        if (typeof value === 'string')
            return value;
        if (unit === '%')
            return `${value}%`;
        if (unit === '$')
            return `$${value.toLocaleString()}`;
        if (unit === 'ms')
            return `${value}ms`;
        return value.toLocaleString();
    };
    const getProgressPercentage = (value, target) => {
        return Math.min((value / target) * 100, 100);
    };
    const getProgressColor = (percentage) => {
        if (percentage >= 90)
            return 'bg-green-500';
        if (percentage >= 70)
            return 'bg-yellow-500';
        return 'bg-red-500';
    };
    return (<div className={`card ${className}`}>
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Metrics Overview</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Key performance indicators
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {timeRanges.map((range) => (<button key={range.value} onClick={() => setTimeRange(range.value)} className={`
                  px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                  ${timeRange === range.value
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'}
                `}>
                {range.label}
              </button>))}
          </div>
        </div>
      </div>

      <div className="card-body">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {metrics.map((metric) => (<div key={metric.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {metric.name}
                </h4>
                {metric.target && (<span className="text-xs text-gray-500 dark:text-gray-400">
                    Target: {formatMetricValue(metric.target, metric.unit)}
                  </span>)}
              </div>
              <div className="flex items-center space-x-2 mb-2">
                <div className={`text-2xl font-bold ${metric.color}`}>
                  {formatMetricValue(metric.value, metric.unit)}
                </div>
                {metric.change && (<div className={`flex items-center space-x-1 text-xs ${metric.change.type === 'increase' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                    </svg>
                    <span>{Math.abs(metric.change.value)}%</span>
                  </div>)}
              </div>
              {metric.target && (<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(getProgressPercentage(Number(metric.value), metric.target))}`} style={{ width: `${getProgressPercentage(Number(metric.value), metric.target)}%` }}></div>
                </div>)}
              {metric.change && (<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {metric.change.period}
                </div>)}
            </div>))}
        </div>

        {/* Simple Chart Visualization */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            API Calls & Pipeline Trends
          </h4>
          <div className="h-40 flex items-end space-x-2">
            {chartData.labels.map((label, index) => (<div key={label} className="flex-1 flex flex-col items-center">
                <div className="w-full flex items-end space-x-1" style={{ height: '120px' }}>
                  {chartData.datasets.map((dataset, datasetIndex) => (<div key={datasetIndex} className="flex-1 rounded-t transition-all duration-300 hover:opacity-80" style={{
                    height: `${(dataset.data[index] / Math.max(...dataset.data)) * 100}%`,
                    backgroundColor: dataset.borderColor,
                }} title={`${dataset.label}: ${dataset.data[index]}`}></div>))}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {label}
                </div>
              </div>))}
          </div>
          <div className="flex items-center justify-center space-x-4 mt-4">
            {chartData.datasets.map((dataset, index) => (<div key={index} className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dataset.borderColor }}></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{dataset.label}</span>
              </div>))}
          </div>
        </div>
      </div>

      <div className="card-footer">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Updated in real-time • Last refresh: {new Date().toLocaleTimeString()}
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => console.log('Export metrics')} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              Export
            </button>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <a href="/analytics" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              Detailed Analytics
            </a>
          </div>
        </div>
      </div>
    </div>);
};
//# sourceMappingURL=MetricsOverviewWidget.js.map