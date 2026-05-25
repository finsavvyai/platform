import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { Play, Edit, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '../../atoms';

export interface TestCardProps {
  id: string;
  name: string;
  description?: string;
  status: 'idle' | 'running' | 'passed' | 'failed' | 'error';
  lastRun?: Date;
  duration?: number;
  framework: 'playwright' | 'cypress' | 'selenium';
  testType: 'e2e' | 'integration' | 'unit' | 'api';
  onRun?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
  className?: string;
}

export const TestCard: React.FC<TestCardProps> = ({
  id,
  name,
  description,
  status,
  lastRun,
  duration,
  framework,
  testType,
  onRun,
  onEdit,
  onDelete,
  onClick,
  className
}) => {
  const statusConfig = {
    idle: {
      icon: Clock,
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      label: 'Idle'
    },
    running: {
      icon: Clock,
      color: 'text-blue-500',
      bgColor: 'bg-blue-100',
      label: 'Running'
    },
    passed: {
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      label: 'Passed'
    },
    failed: {
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-100',
      label: 'Failed'
    },
    error: {
      icon: AlertCircle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-100',
      label: 'Error'
    }
  };

  const frameworkColors = {
    playwright: 'bg-green-100 text-green-800',
    cypress: 'bg-blue-100 text-blue-800',
    selenium: 'bg-purple-100 text-purple-800'
  };

  const testTypeColors = {
    e2e: 'bg-indigo-100 text-indigo-800',
    integration: 'bg-yellow-100 text-yellow-800',
    unit: 'bg-pink-100 text-pink-800',
    api: 'bg-teal-100 text-teal-800'
  };

  const currentStatus = statusConfig[status];
  const StatusIcon = currentStatus.icon;

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatLastRun = (date?: Date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <motion.div
      whileHover={{ y: -2, shadow: '0 10px 25px rgba(0,0,0,0.1)' }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-6 cursor-pointer transition-all duration-200 hover:shadow-lg',
        className
      )}
      onClick={() => onClick?.(id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {name}
          </h3>
          {description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {description}
            </p>
          )}
        </div>

        <div className={cn(
          'flex items-center px-2 py-1 rounded-full text-xs font-medium ml-4',
          currentStatus.bgColor
        )}>
          <StatusIcon className={cn('w-3 h-3 mr-1', currentStatus.color)} />
          <span className={currentStatus.color}>{currentStatus.label}</span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex items-center space-x-2 mb-4">
        <span className={cn(
          'px-2 py-1 rounded-full text-xs font-medium',
          frameworkColors[framework]
        )}>
          {framework}
        </span>
        <span className={cn(
          'px-2 py-1 rounded-full text-xs font-medium',
          testTypeColors[testType]
        )}>
          {testType}
        </span>
      </div>

      {/* Metadata */}
      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <div className="flex items-center space-x-4">
          <span>Last run: {formatLastRun(lastRun)}</span>
          <span>Duration: {formatDuration(duration)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onRun?.(id);
          }}
          leftIcon={<Play className="w-4 h-4" />}
          disabled={status === 'running'}
        >
          {status === 'running' ? 'Running...' : 'Run'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(id);
          }}
          leftIcon={<Edit className="w-4 h-4" />}
        >
          Edit
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(id);
          }}
          leftIcon={<Trash2 className="w-4 h-4" />}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Delete
        </Button>
      </div>
    </motion.div>
  );
};