/**
 * Alert Banner Component
 * Displays critical alerts at the top of the dashboard
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface AlertBannerProps {
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  count?: number;
  onDismiss?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  severity,
  message,
  count,
  onDismiss,
}) => {
  const getSeverityColor = () => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white border-red-700';
      case 'high':
        return 'bg-orange-500 text-white border-orange-600';
      case 'medium':
        return 'bg-yellow-500 text-gray-900 border-yellow-600';
      case 'low':
        return 'bg-blue-500 text-white border-blue-600';
      default:
        return 'bg-gray-500 text-white border-gray-600';
    }
  };

  return (
    <div className={`mb-6 p-4 rounded-lg border ${getSeverityColor()} flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6" />
        <div>
          <p className="font-medium">
            {message}
            {count && count > 1 && ` (${count} alerts)`}
          </p>
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
