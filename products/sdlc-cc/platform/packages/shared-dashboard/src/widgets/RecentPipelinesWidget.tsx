/**
 * RecentPipelinesWidget Component
 * Displays recent CI/CD pipeline executions and their status
 */

import React, { useState, useEffect } from 'react';
import { DashboardService } from '../services/DashboardService';

interface RecentPipelinesWidgetProps {
  dashboardService: DashboardService;
  className?: string;
}

interface PipelineExecution {
  id: string;
  name: string;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  branch: string;
  commit: string;
  duration?: number;
  startTime: string;
  endTime?: string;
  environment: 'development' | 'staging' | 'production';
  triggeredBy: string;
  repository: string;
}

export const RecentPipelinesWidget: React.FC<RecentPipelinesWidgetProps> = ({
  dashboardService: _dashboardService,
  className = '',
}) => {
  const [pipelines, setPipelines] = useState<PipelineExecution[]>([
    {
      id: 'pipe_001',
      name: 'Production Deploy',
      status: 'success',
      branch: 'main',
      commit: 'a1b2c3d4',
      duration: 754,
      startTime: new Date(Date.now() - 15 * 60000).toISOString(),
      endTime: new Date(Date.now() - 5 * 60000).toISOString(),
      environment: 'production',
      triggeredBy: 'John Doe',
      repository: 'frontend-monorepo',
    },
    {
      id: 'pipe_002',
      name: 'API Gateway Test',
      status: 'running',
      branch: 'feature/api-v2',
      commit: 'e5f6g7h8',
      startTime: new Date(Date.now() - 8 * 60000).toISOString(),
      environment: 'staging',
      triggeredBy: 'Jane Smith',
      repository: 'api-gateway',
    },
    {
      id: 'pipe_003',
      name: 'Security Scan',
      status: 'failed',
      branch: 'develop',
      commit: 'i9j0k1l2',
      duration: 342,
      startTime: new Date(Date.now() - 45 * 60000).toISOString(),
      endTime: new Date(Date.now() - 38 * 60000).toISOString(),
      environment: 'development',
      triggeredBy: 'Bob Johnson',
      repository: 'security-tools',
    },
    {
      id: 'pipe_004',
      name: 'Database Migration',
      status: 'success',
      branch: 'hotfix/db-issue',
      commit: 'm3n4o5p6',
      duration: 1205,
      startTime: new Date(Date.now() - 90 * 60000).toISOString(),
      endTime: new Date(Date.now() - 71 * 60000).toISOString(),
      environment: 'staging',
      triggeredBy: 'Alice Brown',
      repository: 'backend-services',
    },
  ]);

  const [autoRefresh, setAutoRefresh] = useState(true);

  // Simulate real-time updates for running pipelines
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setPipelines(prev =>
        prev.map(pipeline => {
          if (pipeline.status === 'running') {
            const elapsed = Date.now() - new Date(pipeline.startTime).getTime();
            return {
              ...pipeline,
              duration: Math.floor(elapsed / 1000),
            };
          }
          return pipeline;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusIcon = (status: PipelineExecution['status']) => {
    const icons = {
      running: '🔄',
      success: '✅',
      failed: '❌',
      cancelled: '⏹️',
    };
    return icons[status];
  };

  const getStatusColor = (status: PipelineExecution['status']) => {
    const colors = {
      running: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20',
      success: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20',
      failed: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20',
      cancelled: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20',
    };
    return colors[status];
  };

  const getEnvironmentBadge = (environment: PipelineExecution['environment']) => {
    const badges = {
      development: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
      staging: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      production: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    };
    return badges[environment];
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Running...';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const runningPipelinesCount = pipelines.filter(p => p.status === 'running').length;

  return (
    <div className={`card ${className}`}>
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Pipelines</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Latest CI/CD executions
              {runningPipelinesCount > 0 && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  ({runningPipelinesCount} running)
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
              ${autoRefresh
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }
            `}
          >
            {autoRefresh ? '🔄 Auto-refresh' : '⏸️ Paused'}
          </button>
        </div>
      </div>

      <div className="card-body">
        <div className="space-y-3">
          {pipelines.map((pipeline) => (
            <div
              key={pipeline.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Status Icon */}
                <div className={`text-lg ${pipeline.status === 'running' ? 'animate-spin' : ''}`}>
                  {getStatusIcon(pipeline.status)}
                </div>

                {/* Pipeline Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {pipeline.name}
                    </h4>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getEnvironmentBadge(pipeline.environment)}`}>
                      {pipeline.environment}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(pipeline.status)}`}>
                      {pipeline.status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center space-x-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      <span>{pipeline.branch}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <span>{pipeline.commit.substring(0, 7)}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      <span>{pipeline.triggeredBy}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Info */}
              <div className="text-right space-y-1">
                <div className={`font-medium ${getStatusColor(pipeline.status)}`}>
                  {formatDuration(pipeline.duration)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatRelativeTime(pipeline.startTime)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-footer">
        <div className="flex items-center justify-between">
          <a
            href="/sdlc/pipelines"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            View all pipelines
          </a>
          <button
            onClick={() => console.log('Create new pipeline')}
            className="btn-primary btn-sm"
          >
            New Pipeline
          </button>
        </div>
      </div>
    </div>
  );
};