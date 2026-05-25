import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { CheckCircle, XCircle, AlertCircle, Clock, Loader2, Zap } from 'lucide-react';

export interface StatusIndicatorProps {
  status: 'success' | 'error' | 'warning' | 'info' | 'loading' | 'idle';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showPulse?: boolean;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = 'md',
  showIcon = true,
  showPulse = false,
  className
}) => {
  const statusConfig = {
    success: {
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-200',
      label: 'Success'
    },
    error: {
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-200',
      label: 'Error'
    },
    warning: {
      icon: AlertCircle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-200',
      label: 'Warning'
    },
    info: {
      icon: Zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-200',
      label: 'Info'
    },
    loading: {
      icon: Loader2,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      borderColor: 'border-indigo-200',
      label: 'Loading'
    },
    idle: {
      icon: Clock,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-200',
      label: 'Idle'
    }
  };

  const sizeConfig = {
    sm: {
      container: 'px-2 py-1 text-xs',
      icon: 'w-3 h-3',
      dot: 'w-2 h-2'
    },
    md: {
      container: 'px-3 py-1.5 text-sm',
      icon: 'w-4 h-4',
      dot: 'w-3 h-3'
    },
    lg: {
      container: 'px-4 py-2 text-base',
      icon: 'w-5 h-5',
      dot: 'w-4 h-4'
    }
  };

  const config = statusConfig[status];
  const sizeClasses = sizeConfig[size];
  const Icon = config.icon;
  const displayLabel = label || config.label;

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        config.bgColor,
        config.borderColor,
        sizeClasses.container,
        className
      )}
    >
      {showIcon && (
        <div className="flex items-center">
          {status === 'loading' ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Icon className={cn(sizeClasses.icon, config.color)} />
            </motion.div>
          ) : (
            <Icon className={cn(sizeClasses.icon, config.color)} />
          )}
        </div>
      )}

      {!showIcon && (
        <div className="flex items-center">
          <motion.div
            className={cn(
              'rounded-full',
              sizeClasses.dot,
              config.color.replace('text-', 'bg-')
            )}
            animate={showPulse ? { scale: [1, 1.2, 1] } : {}}
            transition={showPulse ? { duration: 2, repeat: Infinity } : {}}
          />
        </div>
      )}

      {displayLabel && (
        <span className={cn('ml-2', config.color)}>
          {displayLabel}
        </span>
      )}
    </div>
  );
};