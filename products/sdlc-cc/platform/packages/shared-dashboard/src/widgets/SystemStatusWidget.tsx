/**
 * SystemStatusWidget Component
 * Displays real-time system status and health indicators
 */

import React, { useState, useEffect } from 'react';
import { DashboardService } from '../services/DashboardService';

interface SystemStatusWidgetProps {
  dashboardService: DashboardService;
  className?: string;
}

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  uptime: number;
  responseTime: number;
  lastCheck: string;
  icon: string;
}

export const SystemStatusWidget: React.FC<SystemStatusWidgetProps> = ({
  dashboardService: _dashboardService,
  className = '',
}) => {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'API Gateway',
      status: 'operational',
      uptime: 99.9,
      responseTime: 124,
      lastCheck: new Date().toISOString(),
      icon: '🛡️',
    },
    {
      name: 'SDLC Pipelines',
      status: 'operational',
      uptime: 99.7,
      responseTime: 89,
      lastCheck: new Date().toISOString(),
      icon: '🚀',
    },
    {
      name: 'AI Assistant',
      status: 'operational',
      uptime: 99.8,
      responseTime: 156,
      lastCheck: new Date().toISOString(),
      icon: '🤖',
    },
    {
      name: 'Billing System',
      status: 'operational',
      uptime: 99.9,
      responseTime: 203,
      lastCheck: new Date().toISOString(),
      icon: '💳',
    },
    {
      name: 'Database',
      status: 'operational',
      uptime: 99.95,
      responseTime: 45,
      lastCheck: new Date().toISOString(),
      icon: '🗄️',
    },
    {
      name: 'Authentication',
      status: 'operational',
      uptime: 99.9,
      responseTime: 67,
      lastCheck: new Date().toISOString(),
      icon: '🔐',
    },
  ]);

  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(false);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setServices(prevServices =>
        prevServices.map(service => ({
          ...service,
          responseTime: Math.max(20, service.responseTime + (Math.random() - 0.5) * 20),
          lastCheck: new Date().toISOString(),
        }))
      );
      setLastUpdated(new Date());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'operational':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
      case 'degraded':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20';
      case 'down':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getStatusDot = (status: ServiceStatus['status']) => {
    const colors = {
      operational: 'bg-green-500',
      degraded: 'bg-yellow-500',
      down: 'bg-red-500',
    };
    return colors[status];
  };

  const getResponseTimeColor = (responseTime: number) => {
    if (responseTime < 100) return 'text-green-600 dark:text-green-400';
    if (responseTime < 200) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const overallStatus = services.every(s => s.status === 'operational')
    ? 'operational'
    : services.some(s => s.status === 'down')
    ? 'down'
    : 'degraded';

  const averageUptime = services.reduce((sum, s) => sum + s.uptime, 0) / services.length;
  const averageResponseTime = services.reduce((sum, s) => sum + s.responseTime, 0) / services.length;

  return (
    <div className={`card ${className}`}>
      <div className="card-header">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">System Status</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStatusDot(overallStatus)} ${overallStatus === 'operational' ? 'animate-pulse' : ''}`}></div>
            <span className={`text-sm font-medium capitalize ${getStatusColor(overallStatus)}`}>
              {overallStatus}
            </span>
          </div>
        </div>
      </div>

      <div className="card-body space-y-4">
        {/* Overall Metrics */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {averageUptime.toFixed(2)}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Average Uptime</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${getResponseTimeColor(averageResponseTime)}`}>
              {Math.round(averageResponseTime)}ms
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg Response</div>
          </div>
        </div>

        {/* Service List */}
        <div className="space-y-3">
          {services.map((service, _index) => (
            <div key={service.name} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{service.icon}</span>
                  <div className={`w-2 h-2 rounded-full ${getStatusDot(service.status)} ${service.status === 'operational' ? 'animate-pulse' : ''}`}></div>
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{service.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(service.lastCheck).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4 text-sm">
                <div className="text-right">
                  <div className={`font-medium ${getResponseTimeColor(service.responseTime)}`}>
                    {service.responseTime}ms
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">Response</div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {service.uptime}%
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">Uptime</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-footer">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
          <button
            onClick={() => {
              setLoading(true);
              // Simulate refresh
              setTimeout(() => setLoading(false), 1000);
            }}
            disabled={loading}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
};